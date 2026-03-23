import Fastify from 'fastify';
import { ratesRoutes } from '../../src/routes/rates';
import { PriceService } from '../../src/services/PriceService';
import { ExchangeRegistry } from '../../src/exchanges/ExchangeRegistry';
import { PriceCache } from '../../src/cache/PriceCache';
import { ALL_ADAPTERS, TEST_PAIRS, ratesUrl, estimateUrl } from '../config';

function assert(condition: boolean, msg: string) {
  console.log(condition ? `  PASS: ${msg}` : `  FAIL: ${msg}`);
}

async function main() {
  const fastify = Fastify();
  const registry = new ExchangeRegistry();
  for (const adapter of ALL_ADAPTERS) {
    registry.register(adapter);
  }
  const service = new PriceService(registry, new PriceCache());
  ratesRoutes(fastify, service);

  const pair1 = TEST_PAIRS[0]; // BTC/USDT

  console.log(`\n--- GET ${ratesUrl(pair1.base, pair1.quote)} ---`);
  {
    const res = await fastify.inject({ method: 'GET', url: ratesUrl(pair1.base, pair1.quote) });
    const body = JSON.parse(res.body);
    assert(res.statusCode === 200, `status 200`);
    assert(body.rates.length >= 2, `got ${body.rates.length} rates`);
    for (const r of body.rates) {
      console.log(`  ${r.exchangeName}: ${r.rate}`);
      assert(r.rate > 0, `${r.exchangeName} rate > 0`);
    }
  }

  console.log(`\n--- GET ${estimateUrl(pair1.base, pair1.quote)} ---`);
  {
    const res = await fastify.inject({ method: 'GET', url: estimateUrl(pair1.base, pair1.quote) });
    const body = JSON.parse(res.body);
    assert(res.statusCode === 200, `status 200`);
    assert(body.averageRate > 0, `averageRate=${body.averageRate}`);
    assert(body.bestRate.rate > 0, `bestRate=${body.bestRate.rate}`);
    console.log(`  averageRate: ${body.averageRate}`);
    console.log(`  bestRate: ${body.bestRate.exchangeName} ${body.bestRate.rate}`);
  }

  console.log('\nDone.');
  await fastify.close();
}

main().catch(console.error);
