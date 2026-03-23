import { UniswapAdapter } from '../../src/exchanges/dex/UniswapAdapter';

async function main() {
  const uniswap = new UniswapAdapter();

  console.log('Starting WebSocket subscriptions...');
  await uniswap.init((exchange, base, quote, rate) => {
    console.log(`[cache] ${exchange} ${base}/${quote} = ${rate}`);
  });

  console.log('\nWaiting 30s for Swap events...');
  console.log('(WETH/USDT pool is most active, should see events within seconds)\n');

  // Check rate before and after WS events
  const rateBefore = await uniswap.getRate('ETH', 'USDT', 1);
  console.log(`\nETH/USDT rate (Quoter): ${rateBefore}`);

  await new Promise(resolve => setTimeout(resolve, 30000));

  const rateAfter = await uniswap.getRate('ETH', 'USDT', 1);
  console.log(`\nETH/USDT rate (after WS): ${rateAfter}`);

  await uniswap.destroy();
  console.log('\nDone.');
  process.exit(0);
}

main().catch(console.error);
