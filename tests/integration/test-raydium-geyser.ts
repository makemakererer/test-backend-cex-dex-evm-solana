import { RaydiumAdapter } from '../../src/exchanges/dex/RaydiumAdapter';

async function main() {
  const raydium = new RaydiumAdapter();

  console.log('Connecting to Yellowstone gRPC...');
  await raydium.init((exchange, base, quote, rate) => {
    // callback fires on each price update
  });

  console.log('\nWaiting 30s for CLMM pool updates...\n');

  const rateBefore = await raydium.getRate('SOL', 'USDT', 1);
  console.log(`SOL/USDT rate (REST fallback): ${rateBefore}`);

  await new Promise(r => setTimeout(r, 30000));

  const rateAfter = await raydium.getRate('SOL', 'USDT', 1);
  console.log(`\nSOL/USDT rate (after Geyser): ${rateAfter}`);

  await raydium.destroy();
  console.log('\nDone.');
  process.exit(0);
}

main().catch(console.error);
