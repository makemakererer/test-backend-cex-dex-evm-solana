import { createPublicClient, http, webSocket, parseUnits, type WatchContractEventReturnType } from 'viem';
import { mainnet } from 'viem/chains';
import { ExchangeAdapter, OnPriceUpdate } from '../base/ExchangeAdapter';
import { UNISWAP_V3_QUOTER_ABI } from '../../abi/uniswapV3Quoter';
import { UNISWAP_V3_SWAP_EVENT_ABI } from '../../abi/uniswapV3Events';
import { UNISWAP_V3_POOL_ABI } from '../../abi/uniswapV3Pool';
import { sqrtPriceX96ToPrice } from './utils/uniswapMath';
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

            const token0Price = sqrtPriceX96ToPrice(
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

    // Read initial prices from slot0
    for (const [pairKey, poolConfig] of Object.entries(UNISWAP_POOLS)) {
      if (!supportedTokens.has(poolConfig.token0) || !supportedTokens.has(poolConfig.token1)) continue;

      const token0Info = ETH_TOKENS[poolConfig.token0];
      const token1Info = ETH_TOKENS[poolConfig.token1];
      if (!token0Info || !token1Info) continue;

      try {
        const slot0 = await this.httpClient.readContract({
          address: poolConfig.address,
          abi: UNISWAP_V3_POOL_ABI,
          functionName: 'slot0',
        });

        const sqrtPriceX96 = slot0[0];
        const token0Price = sqrtPriceX96ToPrice(sqrtPriceX96, token0Info.decimals, token1Info.decimals);

        const baseCurrency = tokenToCurrency[poolConfig.token0];
        const quoteCurrency = tokenToCurrency[poolConfig.token1];
        if (baseCurrency && quoteCurrency && token0Price > 0) {
          onPriceUpdate(this.getName(), baseCurrency, quoteCurrency, token0Price);
          onPriceUpdate(this.getName(), quoteCurrency, baseCurrency, 1 / token0Price);
          console.log(`[uniswap slot0] ${pairKey}: ${baseCurrency}/${quoteCurrency}=${token0Price.toFixed(6)}`);
        }
      } catch (err: any) {
        console.error(`[uniswap slot0] ${pairKey} failed: ${err.message}`);
      }
    }
  }

  async destroy(): Promise<void> {
    for (const unwatch of this.unwatchers) {
      unwatch();
    }
    this.unwatchers = [];
  }

  async getRate(baseCurrency: string, quoteCurrency: string, amount: number): Promise<number | null> {
    const baseToken = CURRENCY_TO_ETH_TOKEN[baseCurrency.toUpperCase()];
    const quoteToken = CURRENCY_TO_ETH_TOKEN[quoteCurrency.toUpperCase()];
    if (!baseToken || !quoteToken) return null;

    const directRate = await this.getPoolRate(baseToken, quoteToken, amount);

    // Try all intermediaries (2-hop: base -> mid -> quote) and pick the best rate
    const crossRates = await Promise.all(
      DEX_CROSS_RATE_INTERMEDIARIES
        .filter(mid => mid !== baseToken && mid !== quoteToken)
        .map(async (mid) => {
          // Step 1: swap base -> mid
          const baseMidRate = await this.getPoolRate(baseToken, mid, amount);
          if (baseMidRate === null) return null;

          // Step 2: swap actual mid output -> quote
          const midOutput = amount * baseMidRate;
          const midQuoteRate = await this.getPoolRate(mid, quoteToken, midOutput);
          if (midQuoteRate === null) return null;

          return baseMidRate * midQuoteRate;
        })
    );

    const validCrossRates = crossRates.filter((r): r is number => r !== null);
    const bestCrossRate = validCrossRates.length > 0 ? Math.max(...validCrossRates) : null;

    if (directRate === null) return bestCrossRate;
    if (bestCrossRate === null) return directRate;
    return Math.max(directRate, bestCrossRate);
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
    } catch (err: any) {
      console.error(`[uniswap quoter] ${tokenA}/${tokenB} amount=${amount} failed: ${err.shortMessage || err.message}`);
      return null;
    }
  }
}

