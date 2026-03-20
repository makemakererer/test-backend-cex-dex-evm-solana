import { UniswapAdapter } from '../../src/exchanges/dex/UniswapAdapter';
import { TEST_PAIRS } from '../config';

function assert(condition: boolean, msg: string) {
  console.log(condition ? `  PASS: ${msg}` : `  FAIL: ${msg}`);
}

async function main() {
  const uniswap = new UniswapAdapter();

  for (const { base, quote } of TEST_PAIRS) {
    console.log(`\n--- ${base}/${quote} ---`);
    const rate = await uniswap.getRate(base, quote);
    console.log(`  uniswap: ${rate}`);
    assert(rate !== null && rate > 0, `rate > 0`);
  }

  console.log('\nDone.');
}

main().catch(console.error);
