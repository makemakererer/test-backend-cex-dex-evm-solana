import Fastify from 'fastify';
import { ratesRoutes } from '../../src/routes/rates';
import { PriceService } from '../../src/services/PriceService';
import { ExchangeRegistry } from '../../src/exchanges/ExchangeRegistry';
import { PriceCache } from '../../src/cache/PriceCache';
import { ExchangeAdapter } from '../../src/exchanges/base/ExchangeAdapter';
import { ratesUrl, estimateUrl } from '../config';

const base = 'BTC', quote = 'ETH';

function assert(condition: boolean, msg: string) {
  console.log(condition ? `  PASS: ${msg}` : `  FAIL: ${msg}`);
}

function mockAdapter(name: string, rate: number): ExchangeAdapter {
  return {
    getName: () => name,
    getRate: async (_b, _q, _amount) => rate,
  };
}

function buildTestApp() {
  const fastify = Fastify();
  const registry = new ExchangeRegistry();
  registry.register(mockAdapter('binance', 10));
  registry.register(mockAdapter('kucoin', 8));
  // Pre-populate cache (simulates WS updates for /getRates and USD conversion)
  const cache = new PriceCache();
  cache.set('binance', base, quote, 10);
  cache.set('kucoin', base, quote, 8);
  cache.set('binance', base, 'USDT', 68000);
  cache.set('kucoin', base, 'USDT', 68000);
  const service = new PriceService(registry, cache);
  ratesRoutes(fastify, service);
  return fastify;
}

async function main() {
  const app = buildTestApp();

  console.log('\n--- GET /getRates: valid pair ---');
  {
    const res = await app.inject({ method: 'GET', url: ratesUrl(base, quote) });
    const body = JSON.parse(res.body);
    assert(res.statusCode === 200, `status 200 (got ${res.statusCode})`);
    assert(body.rates.length === 2, 'got 2 rates');
    assert(body.rates[0].exchangeName === 'binance' && body.rates[0].rate === 10, 'binance rate=10');
    assert(body.rates[1].exchangeName === 'kucoin' && body.rates[1].rate === 8, 'kucoin rate=8');
  }

  console.log('\n--- GET /getRates: invalid currency ---');
  {
    const res = await app.inject({ method: 'GET', url: ratesUrl('DOGE', quote) });
    assert(res.statusCode === 400, `status 400 (got ${res.statusCode})`);
  }

  console.log('\n--- GET /getRates: same currency ---');
  {
    const res = await app.inject({ method: 'GET', url: ratesUrl(base, base) });
    assert(res.statusCode === 400, `status 400 (got ${res.statusCode})`);
  }

  console.log('\n--- GET /getRates: missing params ---');
  {
    const res = await app.inject({ method: 'GET', url: '/getRates' });
    assert(res.statusCode === 400, `status 400 (got ${res.statusCode})`);
  }

  console.log('\n--- GET /estimate: valid pair ---');
  {
    const res = await app.inject({ method: 'GET', url: estimateUrl(base, quote) });
    const body = JSON.parse(res.body);
    assert(res.statusCode === 200, `status 200 (got ${res.statusCode})`);
    assert(body.averageRate === 9, `averageRate=9 (got ${body.averageRate})`);
    assert(body.bestRate.exchangeName === 'binance', `bestRate is binance (got ${body.bestRate.exchangeName})`);
    assert(body.rates.length === 2, 'got 2 rates');
  }

  console.log('\nDone.');
  await app.close();
}

main().catch(console.error);
