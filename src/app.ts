import Fastify from 'fastify';
import { PORT, ENABLED_EXCHANGES } from './config';
import { ExchangeRegistry } from './exchanges/ExchangeRegistry';
import { createAdapters } from './exchanges/AdapterFactory';
import { PriceCache } from './cache/PriceCache';
import { PriceService } from './services/PriceService';
import { ratesRoutes } from './routes/rates';

export function buildApp() {
  const fastify = Fastify({ logger: true });

  const registry = new ExchangeRegistry();
  for (const adapter of createAdapters(ENABLED_EXCHANGES)) {
    registry.register(adapter);
  }

  const cache = new PriceCache();
  const priceService = new PriceService(registry, cache);

  ratesRoutes(fastify, priceService);

  fastify.addHook('onReady', async () => {
    await registry.initAll((exchange, base, quote, rate) => {
      cache.set(exchange, base, quote, rate);
      console.log(`[cache] ${exchange} ${base}/${quote} = ${rate}`);
    });
  });

  fastify.addHook('onClose', async () => {
    await registry.destroyAll();
  });

  return fastify;
}

async function main() {
  const app = buildApp();

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Server running on port ${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
