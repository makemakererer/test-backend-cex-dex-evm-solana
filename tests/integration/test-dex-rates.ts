import { TEST_PAIRS, DEX_ADAPTERS } from '../config';

async function main() {
  // Init adapters (Raydium needs Geyser + RPC to populate pool states)
  for (const adapter of DEX_ADAPTERS) {
    if (adapter.init) {
      await adapter.init((exchange, base, quote, rate) => {
        console.log(`[cache] ${exchange} ${base}/${quote} = ${rate}`);
      });
    }
  }

  for (const { base, quote } of TEST_PAIRS) {
    console.log(`\n--- ${base}/${quote} ---`);

    const results = await Promise.all(
      DEX_ADAPTERS.map(async (adapter) => ({
        name: adapter.getName(),
        rate: await adapter.getRate(base, quote, 0.1),
      }))
    );

    for (const { name, rate } of results) {
      console.log(`  ${name}: ${rate}`);
    }
  }

  // Cleanup
  for (const adapter of DEX_ADAPTERS) {
    if (adapter.destroy) await adapter.destroy();
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch(console.error);


