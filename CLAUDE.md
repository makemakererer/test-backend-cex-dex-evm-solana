# Crypto Aggregator

## Project Overview
API service for comparing prices on cryptoassets between CEX / DEX , EVM / SVM exchanges.
Two endpoints: /estimate and /getRates

## MCP
Always use context7 when working with library APIs: viem, ccxt, 
@solana/web3.js, fastify, zod, @uniswap/v3-sdk.

## Tech Stack
- TypeScript + Node.js
- Fastify
- Zod
- ccxt (Binance, KuCoin) — WebSocket
- viem (Uniswap — EVM/Ethereum RPC)
- @uniswap/v3-sdk + @uniswap/sdk-core (математика пулів)
- @solana/web3.js (Raydium)
- dotenv

## Library Versions (always use latest stable)
- ethers: ^6.x
- ccxt: ^4.x
- fastify: ^5.x
- @solana/web3.js: ^1.x
- @uniswap/v3-sdk: ^3.x
- @uniswap/sdk-core: ^5.x

## Uniswap approach
Read price directly from pool contract via ethers.js + @uniswap/v3-sdk:
- Call slot0() on Uniswap V3 pool contract to get sqrtPriceX96
- Use @uniswap/v3-sdk math for price calculation from sqrtPriceX96
- Adjust for token decimals via @uniswap/sdk-core Token entities

## Supported Exchanges
- Binance (CEX) — ccxt WebSocket
- KuCoin (CEX) — ccxt WebSocket
- Uniswap (DEX, Ethereum) — viem + quote from lp token v2/v3
- Raydium (DEX, Solana) — REST API

## Supported Currencies
ETH, BTC, SOL, USDT

## Architecture Pattern
Strategy + Registry: each exchange realise ExchangeAdapter interface

## Key Principles
- Adding new exchange = new adapter file + 1 line in Registry
- Error on one exchange dont stop others
- In-memory cache with TTL for prices

## Commands
- npm run dev — run with ts-node-dev
- npm run build — compile
- npm start — run builded

## Project Structure
src/
├── exchanges/
│   ├── base/ExchangeAdapter.ts
│   ├── cex/ (Binance, KuCoin)
│   ├── dex/ (Uniswap, Raydium)
│   └── ExchangeRegistry.ts
├── services/
├── routes/
├── cache/
└── app.ts