import { BinanceAdapter } from '../../src/exchanges/cex/BinanceAdapter';
import { KuCoinAdapter } from '../../src/exchanges/cex/KuCoinAdapter';
import { TEST_PAIRS } from '../config';

async function main() {
  const binance = new BinanceAdapter();
  const kucoin = new KuCoinAdapter();

  console.log('Starting WebSocket subscriptions...');
  await Promise.all([binance.init(), kucoin.init()]);

  console.log('\nWaiting 5s for WS prices to arrive...\n');
  await new Promise(r => setTimeout(r, 5000));

  for (const { base, quote } of TEST_PAIRS) {
    const [bRate, kRate] = await Promise.all([
      binance.getRate(base, quote),
      kucoin.getRate(base, quote),
    ]);
    console.log(`${base}/${quote}  binance=${bRate}  kucoin=${kRate}`);
  }

  await Promise.all([binance.destroy(), kucoin.destroy()]);
  console.log('\nDone.');
  process.exit(0);
}

main().catch(console.error);
