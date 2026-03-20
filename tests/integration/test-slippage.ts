import Fastify from 'fastify';
import { ratesRoutes } from '../../src/routes/rates';
import { PriceService } from '../../src/services/PriceService';
import { ExchangeRegistry } from '../../src/exchanges/ExchangeRegistry';
import { PriceCache } from '../../src/cache/PriceCache';
import { ALL_ADAPTERS, estimateUrl } from '../config';

async function main() {
  const fastify = Fastify();
  const registry = new ExchangeRegistry();
  for (const adapter of ALL_ADAPTERS) {
    registry.register(adapter);
  }
  const service = new PriceService(registry, new PriceCache());
  ratesRoutes(fastify, service);

  const amounts = [0.00001, 0.0001, 0.001, 0.01, 0.1, 0.5, 1, 2, 3];

  for (const amount of amounts) {
    const url = estimateUrl('BTC', 'USDT') + `&amount=${amount}`;
    console.log(`\n--- BTC/USDT amount=${amount} ---`);
    const res = await fastify.inject({ method: 'GET', url });
    const body = JSON.parse(res.body);

    if (!body.rates || body.rates.length === 0) {
      console.log('  no rates available');
      continue;
    }

    for (const r of body.rates) {
      console.log(`  ${r.exchangeName}: ${r.rate}`);
    }
    console.log(`  >>> best: ${body.bestRate.exchangeName} @ ${body.bestRate.rate}`);
  }

  console.log('\nDone.');
  await fastify.close();
}

main().catch(console.error);
