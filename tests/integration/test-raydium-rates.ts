import { RaydiumAdapter } from '../../src/exchanges/dex/RaydiumAdapter';
import { TEST_PAIRS } from '../config';

function assert(condition: boolean, msg: string) {
  console.log(condition ? `  PASS: ${msg}` : `  FAIL: ${msg}`);
}

async function main() {
  const raydium = new RaydiumAdapter();

  for (const { base, quote } of TEST_PAIRS) {
    console.log(`\n--- ${base}/${quote} ---`);
    const rate = await raydium.getRate(base, quote, 1);
    console.log(`  raydium: ${rate}`);
    assert(rate !== null && rate > 0, `rate > 0`);
  }

  console.log('\nDone.');
}

main().catch(console.error);
