/**
 * Live server test — hits running server and checks that all exchanges return prices.
 *
 * Usage:
 *   npx ts-node tests/integration/test-live-rates.ts                  # all pairs
 *   npx ts-node tests/integration/test-live-rates.ts BTC USDT         # single pair
 *   npx ts-node tests/integration/test-live-rates.ts ETH USDT         # single pair
 *   npx ts-node tests/integration/test-live-rates.ts --endpoint estimate BTC USDT
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const EXPECTED_EXCHANGES = ['binance', 'kucoin', 'uniswap', 'raydium'];

const ALL_PAIRS = [
  { base: 'BTC', quote: 'USDT' },
  { base: 'ETH', quote: 'USDT' },
  { base: 'SOL', quote: 'USDT' },
  { base: 'BTC', quote: 'ETH' },
  { base: 'ETH', quote: 'SOL' },
  { base: 'BTC', quote: 'SOL' },
];

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${msg}`);
  } else {
    failed++;
    console.log(`  FAIL: ${msg}`);
  }
}

async function testGetRates(base: string, quote: string) {
  const url = `${BASE_URL}/getRates?baseCurrency=${base}&quoteCurrency=${quote}`;
  console.log(`\n--- GET /getRates ${base}/${quote} ---`);

  const res = await fetch(url);
  const body = await res.json();

  assert(res.status === 200, `status 200 (got ${res.status})`);
  assert(Array.isArray(body.rates), 'rates is array');

  const returned = new Set(body.rates.map((r: any) => r.exchangeName));

  for (const name of EXPECTED_EXCHANGES) {
    const rate = body.rates.find((r: any) => r.exchangeName === name);
    if (rate) {
      assert(rate.rate > 0, `${name}: rate=${rate.rate}`);
    } else {
      assert(false, `${name}: missing`);
    }
  }

  return body.rates;
}

async function testEstimate(base: string, quote: string) {
  const url = `${BASE_URL}/estimate?baseCurrency=${base}&quoteCurrency=${quote}`;
  console.log(`\n--- GET /estimate ${base}/${quote} ---`);

  const res = await fetch(url);
  const body = await res.json();

  assert(res.status === 200, `status 200 (got ${res.status})`);
  assert(body.averageRate > 0, `averageRate=${body.averageRate}`);
  assert(body.bestRate && body.bestRate.rate > 0, `bestRate=${body.bestRate?.exchangeName} ${body.bestRate?.rate}`);

  for (const r of body.rates) {
    assert(r.rate > 0, `${r.exchangeName}: rate=${r.rate}`);
  }

  return body;
}

async function main() {
  const args = process.argv.slice(2);

  let endpoint = 'getRates';
  let pairs = ALL_PAIRS;

  // Parse --endpoint flag
  const endpointIdx = args.indexOf('--endpoint');
  if (endpointIdx !== -1) {
    endpoint = args[endpointIdx + 1] || 'getRates';
    args.splice(endpointIdx, 2);
  }

  // If base/quote passed as args, test only that pair
  if (args.length >= 2) {
    pairs = [{ base: args[0].toUpperCase(), quote: args[1].toUpperCase() }];
  }

  console.log(`Server: ${BASE_URL}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Pairs: ${pairs.map(p => `${p.base}/${p.quote}`).join(', ')}`);

  for (const { base, quote } of pairs) {
    try {
      if (endpoint === 'estimate') {
        await testEstimate(base, quote);
      } else {
        await testGetRates(base, quote);
      }
    } catch (err: any) {
      assert(false, `${base}/${quote} request failed: ${err.message}`);
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
