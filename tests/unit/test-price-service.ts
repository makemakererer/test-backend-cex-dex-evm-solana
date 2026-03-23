import { PriceService } from '../../src/services/PriceService';
import { ExchangeRegistry } from '../../src/exchanges/ExchangeRegistry';
import { PriceCache } from '../../src/cache/PriceCache';
import { ExchangeAdapter } from '../../src/exchanges/base/ExchangeAdapter';
import { TEST_PAIRS } from '../config';

function assert(condition: boolean, msg: string) {
  console.log(condition ? `  PASS: ${msg}` : `  FAIL: ${msg}`);
}

function mockAdapter(name: string, rate: number | null): ExchangeAdapter {
  return {
    getName: () => name,
    getRate: async (_b, _q, _amount) => rate,
  };
}

async function main() {
  const { base, quote } = TEST_PAIRS[0];

  console.log('\n--- PriceService.getRates: returns rates from all adapters ---');
  {
    const registry = new ExchangeRegistry();
    registry.register(mockAdapter('exchange-a', 10));
    registry.register(mockAdapter('exchange-b', 8));
    const service = new PriceService(registry, new PriceCache());

    const rates = await service.getRates(base, quote);
    assert(rates.length === 2, 'got 2 rates');
    assert(rates[0].exchangeName === 'exchange-a' && rates[0].rate === 10, 'exchange-a rate=10');
    assert(rates[1].exchangeName === 'exchange-b' && rates[1].rate === 8, 'exchange-b rate=8');
  }

  console.log('\n--- PriceService.getRates: skips adapter returning null ---');
  {
    const registry = new ExchangeRegistry();
    registry.register(mockAdapter('exchange-a', 10));
    registry.register(mockAdapter('exchange-b', null));
    const service = new PriceService(registry, new PriceCache());

    const rates = await service.getRates(base, quote);
    assert(rates.length === 1, 'got 1 rate (null skipped)');
    assert(rates[0].exchangeName === 'exchange-a', 'only exchange-a returned');
  }

  console.log('\n--- PriceService.getRates: skips adapter that throws ---');
  {
    const registry = new ExchangeRegistry();
    registry.register(mockAdapter('exchange-a', 10));
    registry.register({
      getName: () => 'exchange-fail',
      getRate: async (_b, _q, _amount) => { throw new Error('connection error'); },
    });
    const service = new PriceService(registry, new PriceCache());

    const rates = await service.getRates(base, quote);
    assert(rates.length === 1, 'got 1 rate (error skipped)');
    assert(rates[0].exchangeName === 'exchange-a', 'only exchange-a returned');
  }

  console.log('\n--- PriceService.getCachedRates: returns rates from cache ---');
  {
    const registry = new ExchangeRegistry();
    registry.register(mockAdapter('exchange-a', 10));
    const cache = new PriceCache();
    cache.set('exchange-a', base, quote, 42);
    const service = new PriceService(registry, cache);

    const rates = service.getCachedRates(base, quote);
    assert(rates.length === 1, 'got 1 rate from cache');
    assert(rates[0].rate === 42, 'rate from cache = 42');
  }

  console.log('\n--- PriceService.getCachedRates: cross-rate from cache ---');
  {
    const registry = new ExchangeRegistry();
    registry.register(mockAdapter('dex', 0));
    const cache = new PriceCache();
    cache.set('dex', 'BTC', 'SOL', 791);
    cache.set('dex', 'SOL', 'USDT', 85);
    const service = new PriceService(registry, cache);

    const rates = service.getCachedRates('BTC', 'USDT');
    assert(rates.length === 1, 'got 1 cross-rate');
    assert(Math.abs(rates[0].rate - 791 * 85) < 0.01, `cross-rate = ${rates[0].rate} (expected ${791 * 85})`);
  }

  console.log('\nDone.');
}

main().catch(console.error);
