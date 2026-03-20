import { PriceCache } from '../../src/cache/PriceCache';
import { TEST_PAIRS, CEX_ADAPTERS } from '../config';

function assert(condition: boolean, msg: string) {
  console.log(condition ? `  PASS: ${msg}` : `  FAIL: ${msg}`);
}

async function main() {
  const cache = new PriceCache(5000);
  const checkPair = TEST_PAIRS[2]; // BTC/USDT

  console.log('\n--- Fetch rates and populate cache ---');
  for (const { base, quote } of TEST_PAIRS) {
    for (const adapter of CEX_ADAPTERS) {
      const rate = await adapter.getRate(base, quote);
      if (rate !== null) {
        cache.set(adapter.getName(), base, quote, rate);
        console.log(`  ${adapter.getName()} ${base}/${quote}: ${rate}`);
      }
    }
  }

  console.log('\n--- Verify cache hit ---');
  for (const { base, quote } of TEST_PAIRS) {
    for (const adapter of CEX_ADAPTERS) {
      const cached = cache.get(adapter.getName(), base, quote);
      assert(cached !== null, `${adapter.getName()} ${base}/${quote} cached`);
    }
  }

  console.log('\n--- Verify cache returns same value as fetched ---');
  const rate = await CEX_ADAPTERS[0].getRate(checkPair.base, checkPair.quote);
  const cached = cache.get(CEX_ADAPTERS[0].getName(), checkPair.base, checkPair.quote);
  assert(
    cached !== null && rate !== null && Math.abs(cached - rate) / rate < 0.01,
    `cached ${checkPair.base}/${checkPair.quote} within 1% of live rate`
  );

  console.log('\n--- Verify cache miss after clear ---');
  cache.clear();
  for (const adapter of CEX_ADAPTERS) {
    assert(
      cache.get(adapter.getName(), checkPair.base, checkPair.quote) === null,
      `${adapter.getName()} ${checkPair.base}/${checkPair.quote} cleared`
    );
  }

  console.log('\nDone.');
}

main().catch(console.error);
