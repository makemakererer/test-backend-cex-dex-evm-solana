import { TEST_PAIRS, DEX_ADAPTERS } from '../config';

async function main() {
  for (const { base, quote } of TEST_PAIRS) {
    console.log(`\n--- ${base}/${quote} ---`);

    const results = await Promise.all(
      DEX_ADAPTERS.map(async (adapter) => ({
        name: adapter.getName(),
        rate: await adapter.getRate(base, quote, 0.01),
      }))
    );

    for (const { name, rate } of results) {
      console.log(`  ${name}: ${rate}`);
    }
  }
}

main().catch(console.error);
