export interface PoolConfig {
  pairKey: string;
  mintA: string;
  mintB: string;
  decimalsA: number;
  decimalsB: number;
  fee: number;
}

export interface CachedPoolState {
  sqrtPriceX64: bigint;
  liquidity: bigint;
}
