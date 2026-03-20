import { createPublicClient, http, webSocket, parseUnits, type WatchContractEventReturnType } from 'viem';
import { mainnet } from 'viem/chains';
import { ExchangeAdapter, OnPriceUpdate } from '../base/ExchangeAdapter';
import { UNISWAP_V3_QUOTER_ABI } from '../../abi/uniswapV3Quoter';
import { UNISWAP_V3_SWAP_EVENT_ABI } from '../../abi/uniswapV3Events';
import {
  ETH_RPC_URL,
  ETH_WS_URL,
  ETH_TOKENS,
  CURRENCY_TO_ETH_TOKEN,
  UNISWAP_POOLS,
  UNISWAP_QUOTER_ADDRESS,
  DEX_CROSS_RATE_INTERMEDIARIES,
} from '../../config';

export class UniswapAdapter implements ExchangeAdapter {
  private httpClient;
  private wsClient;
  private unwatchers: WatchContractEventReturnType[] = [];

  constructor() {
    this.httpClient = createPublicClient({
      chain: mainnet,
      transport: http(ETH_RPC_URL),
    });
    this.wsClient = createPublicClient({
      chain: mainnet,
      transport: webSocket(ETH_WS_URL),
    });
  }

  getName(): string {
    return 'uniswap';
  }

  async init(onPriceUpdate: OnPriceUpdate): Promise<void> {
    const tokenToCurrency = Object.fromEntries(
      Object.entries(CURRENCY_TO_ETH_TOKEN).map(([k, v]) => [v, k])
    );

    const supportedTokens = new Set(Object.values(CURRENCY_TO_ETH_TOKEN));

    for (const [pairKey, poolConfig] of Object.entries(UNISWAP_POOLS)) {
      if (!supportedTokens.has(poolConfig.token0) || !supportedTokens.has(poolConfig.token1)) continue;

      const token0Info = ETH_TOKENS[poolConfig.token0];
      const token1Info = ETH_TOKENS[poolConfig.token1];
      if (!token0Info || !token1Info) continue;

      const unwatch = this.wsClient.watchContractEvent({
        address: poolConfig.address,
        abi: UNISWAP_V3_SWAP_EVENT_ABI,
        eventName: 'Swap',
        onLogs: (logs) => {
          for (const log of logs) {
            const { sqrtPriceX96 } = log.args;
            if (sqrtPriceX96 == null) continue;

            const token0Price = this.sqrtPriceX96ToPrice(
              sqrtPriceX96,
              token0Info.decimals,
              token1Info.decimals,
            );

            const baseCurrency = tokenToCurrency[poolConfig.token0];
            const quoteCurrency = tokenToCurrency[poolConfig.token1];
            if (baseCurrency && quoteCurrency) {
              onPriceUpdate(this.getName(), baseCurrency, quoteCurrency, token0Price);
              if (token0Price !== 0) {
                onPriceUpdate(this.getName(), quoteCurrency, baseCurrency, 1 / token0Price);
              }
            }

            console.log(`[uniswap ws] ${pairKey}: ${baseCurrency}/${quoteCurrency}=${token0Price.toFixed(6)}`);
          }
        },
      });

      this.unwatchers.push(unwatch);
    }
    console.log(`[uniswap ws] subscribed to ${Object.keys(UNISWAP_POOLS).length} pools`);
  }

  async destroy(): Promise<void> {
    for (const unwatch of this.unwatchers) {
      unwatch();
    }
    this.unwatchers = [];
  }

  async getRate(baseCurrency: string, quoteCurrency: string, amount: number = 1): Promise<number | null> {
    const baseToken = CURRENCY_TO_ETH_TOKEN[baseCurrency.toUpperCase()];
    const quoteToken = CURRENCY_TO_ETH_TOKEN[quoteCurrency.toUpperCase()];
    if (!baseToken || !quoteToken) return null;

    const directRate = await this.getPoolRate(baseToken, quoteToken, amount);
    if (directRate !== null) return directRate;

    for (const mid of DEX_CROSS_RATE_INTERMEDIARIES) {
      if (mid === baseToken || mid === quoteToken) continue;

      const [baseMid, quoteMid] = await Promise.all([
        this.getPoolRate(baseToken, mid, amount),
        this.getPoolRate(quoteToken, mid, 1),
      ]);

      if (baseMid !== null && quoteMid !== null && quoteMid !== 0) {
        return baseMid / quoteMid;
      }
    }

    return null;
  }

  private async getPoolRate(tokenA: string, tokenB: string, amount: number): Promise<number | null> {
    const poolConfig = UNISWAP_POOLS[`${tokenA}/${tokenB}`] || UNISWAP_POOLS[`${tokenB}/${tokenA}`];
    if (!poolConfig) return null;

    const tokenAInfo = ETH_TOKENS[tokenA];
    const tokenBInfo = ETH_TOKENS[tokenB];
    if (!tokenAInfo || !tokenBInfo) return null;

    try {
      const amountIn = parseUnits(amount.toString(), tokenAInfo.decimals);

      const amountOut = await this.httpClient.readContract({
        address: UNISWAP_QUOTER_ADDRESS,
        abi: UNISWAP_V3_QUOTER_ABI,
        functionName: 'quoteExactInputSingle',
        args: [tokenAInfo.address, tokenBInfo.address, poolConfig.fee, amountIn, 0n],
      });

      const outputAmount = Number(amountOut) / (10 ** tokenBInfo.decimals);
      return outputAmount / amount;
    } catch {
      return null;
    }
  }

  private sqrtPriceX96ToPrice(sqrtPriceX96: bigint, decimals0: number, decimals1: number): number {
    const sqrtPrice = Number(sqrtPriceX96) / Number(2n ** 96n);
    const price = sqrtPrice * sqrtPrice;
    return price * (10 ** (decimals0 - decimals1));
  }
}
