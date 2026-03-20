export class PriceCache {
  private cache = new Map<string, number>();

  private key(exchange: string, base: string, quote: string): string {
    return `${exchange}:${base}:${quote}`;
  }

  get(exchange: string, base: string, quote: string): number | null {
    return this.cache.get(this.key(exchange, base, quote)) ?? null;
  }

  set(exchange: string, base: string, quote: string, value: number): void {
    this.cache.set(this.key(exchange, base, quote), value);
  }

  clear(): void {
    this.cache.clear();
  }
}
