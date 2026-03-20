import Fastify from 'fastify';
import { ratesRoutes } from '../../src/routes/rates';
import { PriceService } from '../../src/services/PriceService';
import { ExchangeRegistry } from '../../src/exchanges/ExchangeRegistry';
import { PriceCache } from '../../src/cache/PriceCache';
import { ExchangeAdapter } from '../../src/exchanges/base/ExchangeAdapter';
import { TEST_PAIRS, ratesUrl, estimateUrl } from '../config';

function assert(condition: boolean, msg: string) {
  console.log(condition ? `  PASS: ${msg}` : `  FAIL: ${msg}`);
}

function mockAdapter(name: string, rate: number): ExchangeAdapter {
  return {
    getName: () => name,
    getRate: async () => rate,
  };
}

function buildTestApp() {
  const fastify = Fastify();
  const registry = new ExchangeRegistry();
  registry.register(mockAdapter('binance', 10));
  registry.register(mockAdapter('kucoin', 8));
  const service = new PriceService(registry, new PriceCache());
  ratesRoutes(fastify, service);
  return fastify;
}

async function main() {
  const app = buildTestApp();
  const { base, quote } = TEST_PAIRS[0]; // BTC/ETH

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
    assert(body.bestRate.exchangeName === 'kucoin', `bestRate is kucoin (got ${body.bestRate.exchangeName})`);
    assert(body.rates.length === 2, 'got 2 rates');
  }

  console.log('\nDone.');
  await app.close();
}

main().catch(console.error);
