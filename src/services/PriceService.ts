import { ExchangeRate } from '../exchanges/base/ExchangeAdapter';
import { ExchangeRegistry } from '../exchanges/ExchangeRegistry';
import { PriceCache } from '../cache/PriceCache';
import { SUPPORTED_CURRENCIES, DEFAULT_USD_AMOUNT_FOR_RATES } from '../config';

export class PriceService {
  constructor(
    private registry: ExchangeRegistry,
    private cache: PriceCache,
  ) {}

  /** /getRates — cached mid-prices (slot0 for DEX, last trade for CEX) */
  getCachedRates(baseCurrency: string, quoteCurrency: string): ExchangeRate[] {
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();
    const adapters = this.registry.getAll();
    const rates: ExchangeRate[] = [];

    for (const adapter of adapters) {
      const name = adapter.getName();
      let rate = this.cache.get(name, base, quote);

      // Cross-rate from cache: base→mid × mid→quote
      if (rate === null) {
        for (const mid of SUPPORTED_CURRENCIES) {
          if (mid === base || mid === quote) continue;
          const baseMid = this.cache.get(name, base, mid);
          const midQuote = this.cache.get(name, mid, quote);
          if (baseMid !== null && midQuote !== null) {
            rate = baseMid * midQuote;
            break;
          }
        }
      }

      if (rate !== null) {
        rates.push({ exchangeName: name, rate });
      }
    }

    return rates;
  }

  /** /estimate — real swap simulation via adapters */
  async getRates(baseCurrency: string, quoteCurrency: string, amount?: number): Promise<ExchangeRate[]> {
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();

    // Default: convert DEFAULT_USD_AMOUNT_FOR_RATES to token amount via cache
    if (amount == null) {
      if (base === 'USDT') {
        amount = DEFAULT_USD_AMOUNT_FOR_RATES;
      } else {
        const cached = this.getCachedRates(base, 'USDT');
        const avgRate = cached.length > 0
          ? cached.reduce((s, r) => s + r.rate, 0) / cached.length
          : null;
        amount = avgRate ? DEFAULT_USD_AMOUNT_FOR_RATES / avgRate : 1;
      }
    }

    const adapters = this.registry.getAll();

    const results = await Promise.allSettled(
      adapters.map(async (adapter) => {
        const name = adapter.getName();
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
