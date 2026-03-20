import { ExchangeRate } from '../exchanges/base/ExchangeAdapter';
import { ExchangeRegistry } from '../exchanges/ExchangeRegistry';
import { PriceCache } from '../cache/PriceCache';

export class PriceService {
  constructor(
    private registry: ExchangeRegistry,
    private cache: PriceCache,
  ) {}

  async getRates(baseCurrency: string, quoteCurrency: string, amount: number = 1): Promise<ExchangeRate[]> {
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();
    const adapters = this.registry.getAll();

    const results = await Promise.allSettled(
      adapters.map(async (adapter) => {
        const name = adapter.getName();

        // For amount=1, use WS-updated cache (instant, no RPC calls)
        if (amount === 1) {
          const cached = this.cache.get(name, base, quote);
          if (cached !== null) {
            return { exchangeName: name, rate: cached };
          }
        }

        // Fallback to adapter (REST/Quoter/OrderBook)
        const rate = await adapter.getRate(base, quote, amount);
        if (rate !== null) {
          return { exchangeName: name, rate };
        }

        return null;
      })
    );

    const rates: ExchangeRate[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        rates.push(result.value);
      }
    }

    return rates;
  }
}
