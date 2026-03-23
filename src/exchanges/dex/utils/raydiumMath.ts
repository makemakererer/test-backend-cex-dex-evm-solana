import { CachedPoolState, PoolConfig } from '../types/raydium';

export function readU128LE(data: Buffer, offset: number): bigint {
  const low = data.readBigUInt64LE(offset);
  const high = data.readBigUInt64LE(offset + 8);
  return low + (high << 64n);
}

export function sqrtPriceX64ToPrice(sqrtPriceX64: bigint, decimalsA: number, decimalsB: number): number {
  const sqrtPrice = Number(sqrtPriceX64) / Number(2n ** 64n);
  const price = sqrtPrice * sqrtPrice;
  return price * 10 ** (decimalsA - decimalsB);
}

/**
 * CLMM swap output calculation (single tick range approximation).
 *
 * Selling tokenA (token0 -> token1):
 *   amountOut = L * P * deltaX / (L + deltaX * sqrtP)
 *
 * Selling tokenB (token1 -> token0):
 *   sqrtPNew = sqrtP + deltaY / L
 *   amountOut = deltaY / (sqrtP * sqrtPNew)
 *
 * where sqrtP = sqrtPriceX64 / 2^64, P = (sqrtP)^2, L = liquidity
 */
export function calculateRaydiumSwapOutput(
  amount: number,
  state: CachedPoolState,
  config: Pick<PoolConfig, 'decimalsA' | 'decimalsB' | 'fee'>,
  sellA: boolean,
): number {
  const decimalsIn = sellA ? config.decimalsA : config.decimalsB;
  const decimalsOut = sellA ? config.decimalsB : config.decimalsA;

  const amountInSmallest = amount * 10 ** decimalsIn;
  const amountAfterFee = amountInSmallest * (1 - config.fee);

  const sqrtPrice = Number(state.sqrtPriceX64) / Number(2n ** 64n);
  const liquidity = Number(state.liquidity);

  if (liquidity === 0 || sqrtPrice === 0) return 0;

  let amountOutSmallest: number;

  if (sellA) {
    const price = sqrtPrice * sqrtPrice;
    amountOutSmallest = (liquidity * price * amountAfterFee) / (liquidity + amountAfterFee * sqrtPrice);
  } else {
    const sqrtPriceNew = sqrtPrice + amountAfterFee / liquidity;
    amountOutSmallest = amountAfterFee / (sqrtPrice * sqrtPriceNew);
  }

  const amountOutHuman = amountOutSmallest / 10 ** decimalsOut;
  return amountOutHuman / amount;
}
