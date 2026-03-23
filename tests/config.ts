import { createAdapter, createAdapters } from '../src/exchanges/AdapterFactory';

export const TEST_PAIRS = [
  { base: 'BTC', quote: 'ETH' },
  { base: 'ETH', quote: 'BTC' },
  { base: 'BTC', quote: 'USDT' },
  { base: 'ETH', quote: 'USDT' },
  { base: 'SOL', quote: 'USDT' },
  { base: 'ETH', quote: 'USDT' },
];

export const CEX_ADAPTERS = createAdapters(['binance', 'kucoin']);
export const DEX_ADAPTERS = createAdapters(['uniswap', 'raydium']);
export const ALL_ADAPTERS = createAdapters(['binance', 'kucoin', 'uniswap', 'raydium']);

export function ratesUrl(base: string, quote: string): string {
  return `/getRates?baseCurrency=${base}&quoteCurrency=${quote}`;
}

export function estimateUrl(base: string, quote: string): string {
  return `/estimate?baseCurrency=${base}&quoteCurrency=${quote}`;
}
