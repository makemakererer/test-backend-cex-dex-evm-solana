import ccxt from 'ccxt';
import { BaseCexAdapter } from './BaseCexAdapter';

export class BinanceAdapter extends BaseCexAdapter {
  protected exchange = new ccxt.pro.binance({ enableRateLimit: true });

  getName(): string {
    return 'binance';
  }
}
