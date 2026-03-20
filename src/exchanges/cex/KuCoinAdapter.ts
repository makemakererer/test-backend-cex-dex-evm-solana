import ccxt from 'ccxt';
import { BaseCexAdapter } from './BaseCexAdapter';

export class KuCoinAdapter extends BaseCexAdapter {
  protected exchange = new ccxt.pro.kucoin({ enableRateLimit: true });

  getName(): string {
    return 'kucoin';
  }
}
