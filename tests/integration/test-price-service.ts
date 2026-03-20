import { PriceService } from '../../src/services/PriceService';
import { ExchangeRegistry } from '../../src/exchanges/ExchangeRegistry';
import { PriceCache } from '../../src/cache/PriceCache';
import { TEST_PAIRS, CEX_ADAPTERS } from '../config';

async function main() {
  const registry = new ExchangeRegistry();
  for (const adapter of CEX_ADAPTERS) {
    registry.register(adapter);
  }
  const service = new PriceService(registry, new PriceCache());

  for (const { base, quote } of TEST_PAIRS) {
    console.log(`\n--- ${base}/${quote} ---`);
    const rates = await service.getRates(base, quote);
    for (const { exchangeName, rate } of rates) {
      console.log(`  ${exchangeName}: ${rate}`);
    }
  }

  console.log('\nDone.');
}

main().catch(console.error);
