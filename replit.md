# Overview

This project is a cryptocurrency trading analysis dashboard offering real-time market scanning, technical analysis, and portfolio management. It integrates with Binance for live market data. The application uses Supabase for authentication and PostgreSQL for data storage via Drizzle ORM. The business vision is to empower traders with comprehensive tools and analytics to make informed decisions in the volatile crypto market.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript, using Vite.
- **Routing**: Hash-based routing with `wouter`.
- **State Management**: React Query for server state, React Context for authentication, Zustand for shared prices, local component state for UI.
- **UI Library**: Radix UI components styled with Tailwind CSS (shadcn/ui "new-york" variant).
- **Caching Strategy**: `localStorage` for ticker data (30s TTL), Zustand store for live prices.

## Backend Architecture
- **Runtime Environment**: Dual-mode, supporting local Express.js development (Replit) and Vercel serverless functions (production).
- **API Structure**: Modular API routes under `/api/` for portfolio, scanner, watchlist, market data, AI, OHLCV, metrics, and fear & greed.
- **Caching**: In-memory Map-based caching with TTL for expensive operations (45-90s for market data), and HTTP cache headers.
- **AI Service**: Gemini API initialized at request-time to support Vercel serverless (currently disabled for stability).
- **Market Data Service**: CoinMarketCap API service with fallback support for Fear & Greed index.

## Authentication & Authorization
- **Primary Auth**: Supabase Authentication using JWT tokens, with server-side verification.
- **User Profile Storage**: PostgreSQL `users` table via Drizzle ORM.
- **Demo Mode**: `X-Demo-User-Id` header for testing.

## Data Storage
- **Schema Definition**: Centralized in `shared/schema.ts` using Drizzle ORM.
- **Database**: PostgreSQL via Supabase, using Neon HTTP driver. Schema managed by Drizzle Kit.
- **Key Tables**: `portfolio_positions`, `watchlist`, `scan_history`, `trade_transactions`, `portfolio_analytics`, `market_data`, `ai_analysis`.

## Feature Specifications
- **AI Summary**: Generates professional trader-style analysis from technical indicators using Google Gemini. It computes high-level summary fields (trend_bias, momentum_state, volume_context, volatility_state) and sends them to Gemini, which is instructed to interpret these fields without repeating raw indicator values or numbers.
- **Market Fear & Greed Index**: Displays CoinMarketCap Fear & Greed Index with color-coded sentiment on the Dashboard, updated hourly.
- **Real-time Ticker Data**: Fetches and displays BTC/ETH prices with percentage changes, updated every 30 seconds via REST API polling with local storage caching.
- **Strategy Scanners**: Includes "Hot Setups" (confluence view), Support/Resistance, Trend Dip, Volume Spike, and Momentum scanners. Backend optimizations include Kline cache, increased pool size, and rate limiting delays.
- **Momentum Scanner Logic**: Improved volume factor comparison, prioritized RSI warnings, new "LOW VOLUME" signal, and pivot-based stop loss calculations.
- **Top Picks Page**: Features a smart confluence scoring algorithm based on momentum, volume, trend alignment, RSI health, and volume surge, displaying coins with clear "Why we picked this" reasons.

# External Dependencies

- **Market Data**: Binance REST API (`api.binance.com/api/v3`) for real-time tickers and OHLC data.
- **Market Sentiment**: CoinMarketCap API (`pro-api.coinmarketcap.com/v3`) for Fear & Greed index.
- **AI Services**: Google Gemini API (`gemini-1.5-flash` model) for market analysis and AI Summary (currently disabled).
- **Authentication**: Supabase Auth.
- **Database**: Supabase PostgreSQL.