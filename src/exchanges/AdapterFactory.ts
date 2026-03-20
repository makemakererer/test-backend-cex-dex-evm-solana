import { ExchangeAdapter } from './base/ExchangeAdapter';
import { BinanceAdapter } from './cex/BinanceAdapter';
import { KuCoinAdapter } from './cex/KuCoinAdapter';
import { UniswapAdapter } from './dex/UniswapAdapter';
import { RaydiumAdapter } from './dex/RaydiumAdapter';

const ADAPTER_MAP: Record<string, () => ExchangeAdapter> = {
  binance: () => new BinanceAdapter(),
  kucoin: () => new KuCoinAdapter(),
  uniswap: () => new UniswapAdapter(),
  raydium: () => new RaydiumAdapter(),
};

export function createAdapter(name: string): ExchangeAdapter {
  const factory = ADAPTER_MAP[name];
  if (!factory) {
    throw new Error(`Unknown exchange adapter: "${name}". Available: ${Object.keys(ADAPTER_MAP).join(', ')}`);
  }
  return factory();
}

export function createAdapters(names: string[]): ExchangeAdapter[] {
  return names.map(createAdapter);
}
