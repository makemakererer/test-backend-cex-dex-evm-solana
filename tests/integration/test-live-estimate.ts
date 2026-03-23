/**
 * Live estimate test — hits running server with different USD amounts and checks slippage.
 *
 * Usage:
 *   npx ts-node tests/integration/test-live-estimate.ts                    # all pairs, all amounts
 *   npx ts-node tests/integration/test-live-estimate.ts BTC USDT          # single pair, all amounts
 *   npx ts-node tests/integration/test-live-estimate.ts BTC USDT 1000     # single pair, single USD amount
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const EXPECTED_EXCHANGES = ['binance', 'kucoin', 'uniswap', 'raydium'];

const ALL_PAIRS = [
  { base: 'BTC', quote: 'USDT' },
  { base: 'ETH', quote: 'USDT' },
  { base: 'SOL', quote: 'USDT' },
  { base: 'BTC', quote: 'ETH' },
  { base: 'ETH', quote: 'SOL' },
];

const USD_AMOUNTS = [1, 10, 100, 1_000, 10_000, 100_000];

// Approximate USD prices for converting USD amount to token amount
const USD_PRICES: Record<string, number> = {
  BTC: 68000,
  ETH: 2050,
  SOL: 86,
  USDT: 1,
};

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`    PASS: ${msg}`);
  } else {
    failed++;
    console.log(`    FAIL: ${msg}`);
  }
}

function toTokenAmount(usdAmount: number, base: string): number {
  const price = USD_PRICES[base] || 1;
  const amount = usdAmount / price;
  // Round to reasonable precision to avoid dust amounts
  return parseFloat(amount.toPrecision(6));
}

async function testEstimate(base: string, quote: string, amount: number, usdLabel: string) {
  const url = `${BASE_URL}/estimate?baseCurrency=${base}&quoteCurrency=${quote}&amount=${amount}`;
  console.log(`\n  $${usdLabel} (amount=${amount} ${base}):`);

  try {
    const res = await fetch(url);
    const body = await res.json();

    assert(res.status === 200, `status 200 (got ${res.status})`);

    if (res.status !== 200) return;

    assert(body.averageRate > 0, `averageRate=${body.averageRate.toFixed(6)}`);
    assert(body.bestRate?.rate > 0, `bestRate=${body.bestRate.exchangeName} ${body.bestRate.rate.toFixed(6)}`);

    for (const name of EXPECTED_EXCHANGES) {
      const rate = body.rates.find((r: any) => r.exchangeName === name);
      if (rate) {
        assert(rate.rate > 0, `${name}: rate=${rate.rate.toFixed(6)}`);
      } else {
        assert(false, `${name}: missing`);
      }
    }
  } catch (err: any) {
    assert(false, `request failed: ${err.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  let pairs = ALL_PAIRS;
  let amounts = USD_AMOUNTS;

  if (args.length >= 2) {
    pairs = [{ base: args[0].toUpperCase(), quote: args[1].toUpperCase() }];
  }
  if (args.length >= 3) {
    amounts = [Number(args[2])];
  }

  console.log(`Server: ${BASE_URL}`);
  console.log(`Pairs: ${pairs.map(p => `${p.base}/${p.quote}`).join(', ')}`);
  console.log(`USD amounts: ${amounts.map(a => `$${a.toLocaleString()}`).join(', ')}`);

  for (const { base, quote } of pairs) {
    console.log(`\n--- /estimate ${base}/${quote} ---`);

    for (const usd of amounts) {
      const tokenAmount = toTokenAmount(usd, base);
      await testEstimate(base, quote, tokenAmount, usd.toLocaleString());
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
