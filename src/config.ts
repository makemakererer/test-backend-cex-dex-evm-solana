import 'dotenv/config';

// Enabled exchanges — add/remove adapters here
export const ENABLED_EXCHANGES: string[] = ['binance', 'kucoin', 'uniswap', 'raydium'];

export const SUPPORTED_CURRENCIES = ['BTC', 'ETH', 'SOL', 'USDT'] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

export const PORT = Number(process.env.PORT) || 3000;
export const ETH_RPC_URL = process.env.ETH_RPC_URL || 'https://eth.llamarpc.com';
export const ETH_WS_URL = process.env.ETH_WS_URL || 'wss://ethereum-rpc.publicnode.com';

// Intermediary currency for CEX cross-rate calculation
export const CEX_CROSS_RATE_QUOTE = 'USDT';

// Intermediary tokens for DEX cross-rate calculation (tried in order)
export const DEX_CROSS_RATE_INTERMEDIARIES = ['USDT', 'WETH', 'SOL'];

export const DEFAULT_USD_AMOUNT_FOR_RATES = 100; //100$


// Ethereum mainnet token addresses & decimals
export const ETH_TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
  WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  WBTC: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  WSOL: { address: '0xD31a59c85aE9D8edEFeC411D448f90841571b89c', decimals: 9 },
};

// currency name → token name mapping (BTC trades as WBTC, ETH as WETH on Uniswap)
export const CURRENCY_TO_ETH_TOKEN: Record<string, string> = {
  BTC: 'WBTC',
  ETH: 'WETH',
  USDT: 'USDT',
  USDC: 'USDC',
  SOL: 'WSOL',
};

// Uniswap V3 Quoter contract
export const UNISWAP_QUOTER_ADDRESS: `0x${string}` = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

// Uniswap V3 pool addresses
export const UNISWAP_POOLS: Record<string, { address: `0x${string}`; token0: string; token1: string; fee: number }> = {
  'WBTC/WETH': { address: '0xCBCdF9626bC03E24f779434178A73a0B4bad62eD', token0: 'WBTC', token1: 'WETH', fee: 3000 },
  'WETH/USDT_500': { address: '0x11b815efB8f581194ae79006d24E0d814B7697F6', token0: 'WETH', token1: 'USDT', fee: 500 },
  'WETH/USDT': { address: '0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36', token0: 'WETH', token1: 'USDT', fee: 3000 },
  'WBTC/USDT': { address: '0x9Db9e0e53058C89e5B94e29621a205198648425B', token0: 'WBTC', token1: 'USDT', fee: 3000 },
  'WETH/WSOL': { address: '0x127452F3f9cDc0389b0Bf59ce6131aA3Bd763598', token0: 'WETH', token1: 'WSOL', fee: 3000 },
};

// Solana RPC
export const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Solana / Yellowstone gRPC
export const GEYSER_URL = process.env.GEYSER_URL || 'https://grpc.solana.streamingfast.io:443';
export const GEYSER_TOKEN = process.env.GEYSER_TOKEN || '';

// Raydium CLMM account data offsets (PoolState struct after 8-byte discriminator)
// liquidity (u128): offset 237, sqrt_price_x64 (u128): offset 253
export const RAYDIUM_CLMM_LIQUIDITY_OFFSET = 237;
export const RAYDIUM_CLMM_SQRT_PRICE_OFFSET = 253;

// fee: fraction (e.g. 0.0001 = 1bps)
export const RAYDIUM_CLMM_POOLS: Record<string, { address: string; mintA: string; mintB: string; decimalsA: number; decimalsB: number; fee: number }> = {
  'SOL/USDT': { address: '3nMFwZXwY1s1M5s8vYAHqd4wGs4iSxXE4LRoUMMYqEgF', mintA: 'SOL', mintB: 'USDT', decimalsA: 9, decimalsB: 6, fee: 0.0001 },
  'SOL/USDC': { address: '3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv', mintA: 'SOL', mintB: 'USDC', decimalsA: 9, decimalsB: 6, fee: 0.0004 },
  'SOL/BTC':  { address: 'HCfytQ49w6Dn9UhHCqjNYTZYQ6z5SwqmsyYYqW4EKDdA', mintA: 'SOL', mintB: 'BTC', decimalsA: 9, decimalsB: 8, fee: 0.0005 },
  'SOL/ETH':  { address: 'z5UnzBcUnzQPoeHe5eVPoYczaTQ2BhwwDD9PN7Fq16v', mintA: 'SOL', mintB: 'ETH', decimalsA: 9, decimalsB: 8, fee: 0.0025 },
  'ETH/USDT': { address: '2BE8nvNrFaNbzSbiQqhyTwF4d8QCpjyp4W2tYNMZwQ2A', mintA: 'ETH', mintB: 'USDT', decimalsA: 8, decimalsB: 6, fee: 0.002 }, //Very low liquidity pool
};

// Solana token mint addresses & decimals
export const SOL_TOKENS: Record<string, { mint: string; decimals: number }> = {
  SOL:  { mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
  USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  BTC:  { mint: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', decimals: 8 }, // Wormhole BTC
  ETH:  { mint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', decimals: 8 }, // Wormhole ETH
};
