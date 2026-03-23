export function sqrtPriceX96ToPrice(sqrtPriceX96: bigint, decimals0: number, decimals1: number): number {
  const sqrtPrice = Number(sqrtPriceX96) / Number(2n ** 96n);
  const price = sqrtPrice * sqrtPrice;
  return price * (10 ** (decimals0 - decimals1));
}
