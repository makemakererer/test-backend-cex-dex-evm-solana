import { BinanceAdapter } from '../../src/exchanges/cex/BinanceAdapter';
import { KuCoinAdapter } from '../../src/exchanges/cex/KuCoinAdapter';
import { TEST_PAIRS } from '../config';
import type { OnPriceUpdate } from '../../src/exchanges/base/ExchangeAdapter';

async function main() {
  const binance = new BinanceAdapter();
  const kucoin = new KuCoinAdapter();

  let updateCount = 0;
  const onPriceUpdate: OnPriceUpdate = (_exchange, _base, _quote, _rate) => {
    updateCount++;
  };

  console.log('Starting WebSocket subscriptions...');
  await Promise.all([binance.init(onPriceUpdate), kucoin.init(onPriceUpdate)]);

  console.log('\nWaiting 5s for WS prices to arrive...\n');
  await new Promise(r => setTimeout(r, 5000));

  for (const { base, quote } of TEST_PAIRS) {
    const [bRate, kRate] = await Promise.all([
      binance.getRate(base, quote, 1),
      kucoin.getRate(base, quote, 1),
    ]);
    console.log(`${base}/${quote}  binance=${bRate}  kucoin=${kRate}`);
  }

  await Promise.all([binance.destroy(), kucoin.destroy()]);
  console.log(`\nDone. WS updates received: ${updateCount}`);
  process.exit(0);
}

main().catch(console.error);
