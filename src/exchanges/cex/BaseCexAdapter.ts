import { Exchange } from 'ccxt';
import { ExchangeAdapter, OnPriceUpdate } from '../base/ExchangeAdapter';
import { CEX_CROSS_RATE_QUOTE, SUPPORTED_CURRENCIES } from '../../config';

export abstract class BaseCexAdapter implements ExchangeAdapter {
  protected abstract exchange: Exchange;
  private wsRunning = false;

  abstract getName(): string;

  async init(onPriceUpdate: OnPriceUpdate): Promise<void> {
    const symbols: string[] = [];
    for (const currency of SUPPORTED_CURRENCIES) {
      if (currency === CEX_CROSS_RATE_QUOTE) continue;
      symbols.push(`${currency}/${CEX_CROSS_RATE_QUOTE}`);
    }
    symbols.push('ETH/BTC');

    this.wsRunning = true;

    for (const symbol of symbols) {
      this.startWatchLoop(symbol, onPriceUpdate);
    }

    console.log(`[${this.getName()} ws] subscribed to ${symbols.join(', ')}`);

    // Load initial prices via REST (don't wait for first WS tick)
    for (const symbol of symbols) {
      try {
        const ticker = await this.exchange.fetchTicker(symbol);
        if (ticker.last != null) {
          const [base, quote] = symbol.split('/');
          onPriceUpdate(this.getName(), base, quote, ticker.last);
          if (ticker.last !== 0) {
            onPriceUpdate(this.getName(), quote, base, 1 / ticker.last);
          }
          console.log(`[${this.getName()} rest] ${symbol}=${ticker.last}`);
        }
      } catch (err: any) {
        console.error(`[${this.getName()} rest] ${symbol} failed: ${err.message}`);
      }
    }
  }

  async destroy(): Promise<void> {
    this.wsRunning = false;
    try {
      await this.exchange.close();
    } catch {
      // ignore
    }
  }

  private startWatchLoop(symbol: string, onPriceUpdate: OnPriceUpdate): void {
    const loop = async () => {
      while (this.wsRunning) {
        try {
          const ticker = await (this.exchange as any).watchTicker(symbol);
          if (ticker.last != null) {
            const [base, quote] = symbol.split('/');
            onPriceUpdate(this.getName(), base, quote, ticker.last);
            if (ticker.last !== 0) {
              onPriceUpdate(this.getName(), quote, base, 1 / ticker.last);
            }
            console.log(`[${this.getName()} ws] ${symbol}=${ticker.last}`);
          }
        } catch {
          if (!this.wsRunning) break;
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    };
    loop();
  }

  async getRate(baseCurrency: string, quoteCurrency: string, amount: number): Promise<number | null> {
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();
    const symbol = `${base}/${quote}`;

    const directRate = await this.fetchEffectiveRate(symbol, amount);
    const crossRate = await this.getCrossRate(base, quote, amount);

    if (directRate === null) return crossRate;
    if (crossRate === null) return directRate;
    return Math.max(directRate, crossRate);
  }

  private async getCrossRate(base: string, quote: string, amount: number): Promise<number | null> {
    // Step 1: sell base -> USDT
    const baseRate = await this.fetchEffectiveRate(`${base}/${CEX_CROSS_RATE_QUOTE}`, amount);
    if (baseRate === null) return null;

    // Step 2: get approximate quote price, then sell proportional $ amount of quote
    const refQuoteRate = await this.fetchEffectiveRate(`${quote}/${CEX_CROSS_RATE_QUOTE}`, 1); //1 is price per 1 quote token //TODO: Here is better do oracle price
    if (refQuoteRate === null || refQuoteRate === 0) return null;

    const quoteAmount = (amount * baseRate) / refQuoteRate;
    const quoteRate = await this.fetchEffectiveRate(`${quote}/${CEX_CROSS_RATE_QUOTE}`, quoteAmount);
    if (quoteRate === null || quoteRate === 0) return null;

    return baseRate / quoteRate;
  }

  private async fetchEffectiveRate(symbol: string, amount: number): Promise<number | null> {
    try {
      const orderBook = await this.exchange.fetchOrderBook(symbol, 100);
      const bids = orderBook.bids;

      if (bids.length === 0) return null;

      let remaining = amount;
      let totalProceeds = 0;

      for (const [price, volume] of bids) {
        if (price == null || volume == null) continue;
        const fill = Math.min(remaining, volume);
        totalProceeds += fill * price;
        remaining -= fill;
        if (remaining <= 0) break;
      }

      if (remaining > 0) return null;

      return totalProceeds / amount;
    } catch {
      return null;
    }
  }
}

