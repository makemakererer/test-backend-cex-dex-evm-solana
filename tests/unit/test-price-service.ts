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
    getRate: async () => rate,
  };
}

async function main() {
  const { base, quote } = TEST_PAIRS[0];

  console.log('\n--- PriceService: returns rates from all adapters ---');
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

  console.log('\n--- PriceService: skips adapter returning null ---');
  {
    const registry = new ExchangeRegistry();
    registry.register(mockAdapter('exchange-a', 10));
    registry.register(mockAdapter('exchange-b', null));
    const service = new PriceService(registry, new PriceCache());

    const rates = await service.getRates(base, quote);
    assert(rates.length === 1, 'got 1 rate (null skipped)');
    assert(rates[0].exchangeName === 'exchange-a', 'only exchange-a returned');
  }

  console.log('\n--- PriceService: skips adapter that throws ---');
  {
    const registry = new ExchangeRegistry();
    registry.register(mockAdapter('exchange-a', 10));
    registry.register({
      getName: () => 'exchange-fail',
      getRate: async () => { throw new Error('connection error'); },
    });
    const service = new PriceService(registry, new PriceCache());

    const rates = await service.getRates(base, quote);
    assert(rates.length === 1, 'got 1 rate (error skipped)');
    assert(rates[0].exchangeName === 'exchange-a', 'only exchange-a returned');
  }

  console.log('\n--- PriceService: uses cache on second call ---');
  {
    let callCount = 0;
    const countingAdapter: ExchangeAdapter = {
      getName: () => 'counter',
      getRate: async () => { callCount++; return 42; },
    };
    const registry = new ExchangeRegistry();
    registry.register(countingAdapter);
    const service = new PriceService(registry, new PriceCache());

    await service.getRates(base, quote);
    await service.getRates(base, quote);
    assert(callCount === 1, 'adapter called only once (second call from cache)');
  }

  console.log('\nDone.');
}

main().catch(console.error);
