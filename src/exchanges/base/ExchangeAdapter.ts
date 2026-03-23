export interface ExchangeRate {
  exchangeName: string;
  rate: number;
}

export type OnPriceUpdate = (exchange: string, base: string, quote: string, rate: number) => void;

export interface ExchangeAdapter {
  getName(): string;
  getRate(baseCurrency: string, quoteCurrency: string, amount: number): Promise<number | null>;
  init?(onPriceUpdate: OnPriceUpdate): Promise<void>;
  destroy?(): Promise<void>;
}
