import Client, { CommitmentLevel, SubscribeRequest, SubscribeUpdate } from '@triton-one/yellowstone-grpc';
import { ClientDuplexStream } from '@grpc/grpc-js';
import { Connection, PublicKey } from '@solana/web3.js';
import { ExchangeAdapter, OnPriceUpdate } from '../base/ExchangeAdapter';
import {
	GEYSER_URL,
	GEYSER_TOKEN,
	SOLANA_RPC_URL,
	SOL_TOKENS,
	RAYDIUM_CLMM_POOLS,
	RAYDIUM_CLMM_SQRT_PRICE_OFFSET,
	RAYDIUM_CLMM_LIQUIDITY_OFFSET,
	SUPPORTED_CURRENCIES,
	DEX_CROSS_RATE_INTERMEDIARIES,
} from '../../config';
import { CachedPoolState, PoolConfig } from './types/raydium';
import { calculateRaydiumSwapOutput, readU128LE, sqrtPriceX64ToPrice } from './utils/raydiumMath';

const RECONNECT_TIMEOUT = 10000;

export class RaydiumAdapter implements ExchangeAdapter {
	private geyserClient: Client | null = null;
	private geyserStream: ClientDuplexStream<SubscribeRequest, SubscribeUpdate> | null = null;
	private reconnectTimeout: NodeJS.Timeout | null = null;
	private onPriceUpdate: OnPriceUpdate | null = null;
	// pool address → config
	private poolByAddress = new Map<string, PoolConfig>();
	// pool address → on-chain state from Geyser
	private poolStates = new Map<string, CachedPoolState>();
	// "BASE:QUOTE" → pool lookup for swap direction
	private poolByPair = new Map<string, { address: string; sellA: boolean; config: PoolConfig }>();

	getName(): string {
		return 'raydium';
	}

	async init(onPriceUpdate: OnPriceUpdate): Promise<void> {
		this.onPriceUpdate = onPriceUpdate;

		const supported = new Set<string>(SUPPORTED_CURRENCIES);

		for (const [pairKey, poolConfig] of Object.entries(RAYDIUM_CLMM_POOLS)) {
			if (!supported.has(poolConfig.mintA) && !supported.has(poolConfig.mintB)) continue;
			const config: PoolConfig = { pairKey, ...poolConfig };
			this.poolByAddress.set(poolConfig.address, config);

			// Forward: mintA → mintB (sell A)
			this.poolByPair.set(`${poolConfig.mintA}:${poolConfig.mintB}`, {
				address: poolConfig.address,
				sellA: true,
				config,
			});
			// Reverse: mintB → mintA (sell B)
			this.poolByPair.set(`${poolConfig.mintB}:${poolConfig.mintA}`, {
				address: poolConfig.address,
				sellA: false,
				config,
			});
		}

		if (this.poolByAddress.size === 0) return;

		this.geyserClient = new Client(GEYSER_URL, GEYSER_TOKEN || undefined, {
			grpcMaxDecodingMessageSize: 64 * 1024 * 1024,
			grpcMaxEncodingMessageSize: 64 * 1024 * 1024,
			grpcTcpNodelay: true,
		});

		await this.createGeyserStream();
		await this.loadInitialPoolStates(onPriceUpdate);
	}

	async destroy(): Promise<void> {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		await this.cleanupGeyserStream();
		this.geyserClient = null;
		this.onPriceUpdate = null;
		this.poolByAddress.clear();
		this.poolStates.clear();
		this.poolByPair.clear();
	}

	private async loadInitialPoolStates(onPriceUpdate: OnPriceUpdate): Promise<void> {
		const connection = new Connection(SOLANA_RPC_URL);
		const entries = Array.from(this.poolByAddress.entries());
		const pubkeys = entries.map(([addr]) => new PublicKey(addr));

		try {
			const accounts = await connection.getMultipleAccountsInfo(pubkeys);

			for (let i = 0; i < entries.length; i++) {
				const [address, config] = entries[i];
				const account = accounts[i];
				if (!account?.data || account.data.length < RAYDIUM_CLMM_SQRT_PRICE_OFFSET + 16) continue;

				const data = Buffer.from(account.data);
				const sqrtPriceX64 = readU128LE(data, RAYDIUM_CLMM_SQRT_PRICE_OFFSET);
				const liquidity = readU128LE(data, RAYDIUM_CLMM_LIQUIDITY_OFFSET);

				if (sqrtPriceX64 === 0n) continue;

				// Only set if Geyser hasn't already pushed a newer state
				if (!this.poolStates.has(address)) {
					this.poolStates.set(address, { sqrtPriceX64, liquidity });
				}

				const midPrice = sqrtPriceX64ToPrice(sqrtPriceX64, config.decimalsA, config.decimalsB);
				if (midPrice > 0 && isFinite(midPrice)) {
					onPriceUpdate(this.getName(), config.mintA, config.mintB, midPrice);
					onPriceUpdate(this.getName(), config.mintB, config.mintA, 1 / midPrice);
					console.log(`[raydium rpc] ${config.pairKey} price=${midPrice.toFixed(6)}`);
				}
			}
		} catch (err: any) {
			console.error(`[raydium rpc] failed to load initial states: ${err.message}`);
		}
	}

	private async createGeyserStream(): Promise<void> {
		if (!this.geyserClient) {
			console.error('[raydium geyser] client not initialized');
			return;
		}

		await this.cleanupGeyserStream();

		const poolAddresses = Array.from(this.poolByAddress.keys());

		try {
			console.log('[raydium geyser] connecting to gRPC ...');

			this.geyserStream = await this.geyserClient.subscribe();

			const stream = this.geyserStream;
			if (!stream) {
				console.error('[raydium geyser] stream not initialized');
				return;
			}

			const request: SubscribeRequest = {
				accounts: {
					raydiumPools: {
						account: poolAddresses,
						owner: [],
						filters: [],
					},
				},
				commitment: CommitmentLevel.PROCESSED,
				slots: {},
				transactions: {},
				transactionsStatus: {},
				blocks: {},
				blocksMeta: {},
				entry: {},
				accountsDataSlice: [],
			};

			await new Promise<void>((resolve, reject) => {
				stream.write(request, (err: any) => {
					if (err) reject(err);
					else resolve();
				});
			});

			console.log(`[raydium geyser] subscribed to ${poolAddresses.length} CLMM pools`);

			stream.on('data', (data: SubscribeUpdate) => {
				if (!data.account?.account) return;

				const acc = data.account.account;
				const pubkey = new PublicKey(Buffer.from(acc.pubkey)).toBase58();
				const config = this.poolByAddress.get(pubkey);
				if (!config) return;

				const accountData = Buffer.from(acc.data);
				if (accountData.length < RAYDIUM_CLMM_SQRT_PRICE_OFFSET + 16) return;

				const sqrtPriceX64 = readU128LE(accountData, RAYDIUM_CLMM_SQRT_PRICE_OFFSET);
				const liquidity = readU128LE(accountData, RAYDIUM_CLMM_LIQUIDITY_OFFSET);

				if (sqrtPriceX64 === 0n) return;

				this.poolStates.set(pubkey, { sqrtPriceX64, liquidity });

				// Mid-price for PriceCache (amount=1 fast path)
				const midPrice = sqrtPriceX64ToPrice(sqrtPriceX64, config.decimalsA, config.decimalsB);
				if (midPrice > 0 && isFinite(midPrice) && this.onPriceUpdate) {
					this.onPriceUpdate(this.getName(), config.mintA, config.mintB, midPrice);
					this.onPriceUpdate(this.getName(), config.mintB, config.mintA, 1 / midPrice);
				}

				console.log(`[raydium geyser] ${config.pairKey} price=${midPrice.toFixed(6)}`);
			});

			stream.on('end', () => {
				console.warn('[raydium geyser] stream ended by server');
				this.handleReconnection();
			});

			stream.on('error', (error: Error) => {
				console.error(`[raydium geyser] stream error: ${error.message}`);
				this.handleReconnection();
			});
		} catch (err: any) {
			console.error(`[raydium geyser] connection failed: ${err.message}`);
			this.handleReconnection();
		}
	}

	private handleReconnection(): void {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
		}

		this.reconnectTimeout = setTimeout(async () => {
			this.reconnectTimeout = null;
			await this.cleanupGeyserStream();
			await this.createGeyserStream();
		}, RECONNECT_TIMEOUT);
	}

	private async cleanupGeyserStream(): Promise<void> {
		if (this.geyserStream) {
			try {
				this.geyserStream.removeAllListeners();
				this.geyserStream.cancel();
				this.geyserStream.destroy();
			} catch {}
			this.geyserStream = null;
		}
	}

	async getRate(baseCurrency: string, quoteCurrency: string, amount: number): Promise<number | null> {
		const base = baseCurrency.toUpperCase();
		const quote = quoteCurrency.toUpperCase();
		
		if (!SOL_TOKENS[base] || !SOL_TOKENS[quote]) return null;
		
		const directRate = this.getPoolSwapRate(base, quote, amount);

		// Try all intermediaries (2-hop swap: base -> mid -> quote) and pick the best rate
		let bestCrossRate: number | null = null;
		for (const mid of DEX_CROSS_RATE_INTERMEDIARIES) {
			if (mid === base || mid === quote) continue;

			const baseMidRate = this.getPoolSwapRate(base, mid, amount);
			if (baseMidRate === null) continue;

			const midOutput = amount * baseMidRate;
			const midQuoteRate = this.getPoolSwapRate(mid, quote, midOutput);
			if (midQuoteRate === null) continue;

			const rate = baseMidRate * midQuoteRate;
			if (bestCrossRate === null || rate > bestCrossRate) {
				bestCrossRate = rate;
			}
		}

		if (directRate === null) return bestCrossRate;
		if (bestCrossRate === null) return directRate;
		return Math.max(directRate, bestCrossRate);
	}

	private getPoolSwapRate(base: string, quote: string, amount: number): number | null {
		const poolInfo = this.poolByPair.get(`${base}:${quote}`);
		if (!poolInfo) return null;

		const state = this.poolStates.get(poolInfo.address);
		if (!state || state.liquidity === 0n) return null;

		return calculateRaydiumSwapOutput(amount, state, poolInfo.config, poolInfo.sellA);
	}
}
