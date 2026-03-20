import { ExchangeAdapter, OnPriceUpdate } from './base/ExchangeAdapter';

export class ExchangeRegistry {
  private adapters: ExchangeAdapter[] = [];

  register(adapter: ExchangeAdapter): void {
    this.adapters.push(adapter);
  }

  getAll(): ExchangeAdapter[] {
    return this.adapters;
  }

  getByName(name: string): ExchangeAdapter | undefined {
    return this.adapters.find(a => a.getName() === name);
  }

  async initAll(onPriceUpdate: OnPriceUpdate): Promise<void> {
    await Promise.all(
      this.adapters.map(a => a.init?.(onPriceUpdate))
    );
  }

  async destroyAll(): Promise<void> {
    await Promise.all(
      this.adapters.map(a => a.destroy?.())
    );
  }
}
