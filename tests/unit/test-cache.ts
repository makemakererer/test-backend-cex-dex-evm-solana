import { PriceCache } from '../../src/cache/PriceCache';
import { TEST_PAIRS, CEX_ADAPTERS } from '../config';

function assert(condition: boolean, msg: string) {
  console.log(condition ? `  PASS: ${msg}` : `  FAIL: ${msg}`);
}

async function main() {
  const { base, quote } = TEST_PAIRS[2];
  const { base: base2, quote: quote2 } = TEST_PAIRS[3];
  const exchange1 = CEX_ADAPTERS[0].getName();
  const exchange2 = CEX_ADAPTERS[1].getName();

  console.log('\n--- Cache: basic get/set ---');
  const cache = new PriceCache();

  assert(cache.get(exchange1, base, quote) === null, 'empty cache returns null');

  cache.set(exchange1, base, quote, 70000);
  assert(cache.get(exchange1, base, quote) === 70000, 'returns cached value');
  assert(cache.get(exchange2, base, quote) === null, 'different exchange returns null');
  assert(cache.get(exchange1, base2, quote2) === null, 'different pair returns null');

  console.log('\n--- Cache: update on new price ---');
  cache.set(exchange1, base, quote, 71000);
  assert(cache.get(exchange1, base, quote) === 71000, 'updated value returned');

  console.log('\n--- Cache: clear ---');
  cache.set(exchange1, base, quote, 70000);
  cache.set(exchange2, base2, quote2, 2100);
  cache.clear();
  assert(cache.get(exchange1, base, quote) === null, 'cleared cache returns null');
  assert(cache.get(exchange2, base2, quote2) === null, 'cleared cache returns null (2)');

  console.log('\nDone.');
}

main().catch(console.error);
