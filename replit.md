# Overview

This project is a cryptocurrency trading analysis dashboard providing real-time market scanning, technical analysis, and portfolio management. It integrates with Binance for live market data. AI features (Gemini) are temporarily disabled for stability. The application uses Supabase for authentication and PostgreSQL for data storage via Drizzle ORM. **Deployment**: Vercel serverless functions (production) + Express server (local development on Replit). The business vision is to empower traders with comprehensive tools and analytics to make informed decisions in the volatile crypto market.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

**December 8, 2025 - IMPROVED: TOP PICKS + MOMENTUM Scanners**:

- **TOP PICKS Page - Smart Confluence Scoring**
  - New multi-factor scoring algorithm based on:
    - Momentum (5-15% = +25pts, any positive = +15pts)
    - Volume ($20M+ = +15pts, $10M+ = +8pts)
    - Trend alignment via EMA (when data available = +20pts)
    - RSI health (35-68 range = +15pts)
    - Volume surge (>1.5x avg = +10pts)
  - Tags: "Strong Momentum", "High Volume", "Uptrend", "RSI Dip", "Volume Surge", "PERFECT Setup"
  - Shows coins scored 30+ with clear "Why we picked this" reasons

- **MOMENTUM Scanner - Pivot-Based Stops (Fixed 5% Flattening)**
  - Real pivot low detection from hourly klines (local minima)
  - Stop calculated with 0.4% buffer below pivot
  - Returns null when no valid pivot exists
  - Risk % now varies naturally (2.1%, 4.7%, 8.3%, etc.)
  - "GAINING SPEED" signal when no pivot available
  - Displays "-" for Stop/Risk when unavailable

- **DATA Page - Multi-Timeframe RSI**
  - RSI endpoint now accepts multiple timeframes: `?timeframe=15m,1h,4h,1d,1w`
  - Returns RSI for each: `{ rsi: { "15m": 45, "1h": 52, "4h": 38, ... } }`

- **ANALYSE Page - 15 Technical Indicators**
  - Expanded scanner from 7 to 15 breakdown items:
    - RSI, MACD, EMA 9/20, EMA 20/50, EMA 200, Bollinger Bands
    - Stochastic, Williams %R, VWAP, Volume, OBV, ATR
    - 24h Change, Support Level, Resistance Level

- **Fallback Data** - Added graceful fallback when Binance API blocked (cloud restrictions)

**December 8, 2025 - MAJOR: Vercel Serverless Migration + AI Temporarily Disabled**:

- **Removed Gemini AI Integration** - AI features temporarily disabled to restore application stability
  - Removed all `/api/ai/*` routes from Express server
  - Created stub handlers returning "temporarily unavailable" messages
  - AI Summary panel commented out from frontend

- **Created Native Vercel Serverless Functions** - Replaced Express-in-serverless approach
  - All API routes now in `/api/` directory as individual Vercel serverless functions
  - Created shared utilities in `/api/lib/serverless.ts` for CORS and error handling
  - Market data: `/api/market/fear-greed.ts`, `/api/market/gainers.ts`, `/api/market/rsi.ts`
  - Strategy scanners: `/api/market/strategies/momentum.ts`, `support-resistance.ts`, `volume-spike.ts`, `trend-dip.ts`, `top-picks.ts`
  - Scanner: `/api/scanner/scan.ts` with technical indicator calculations
  - Portfolio stubs: `/api/portfolio/*.ts` (placeholder until database integration)
  - Watchlist stubs: `/api/watchlist.ts`, `/api/watchlist/[id].ts`
  - AI stubs: `/api/ai/*.ts` returning graceful unavailable messages

- **Updated Vercel Configuration** - Removed broken catch-all handler
  - Individual routes now auto-routed by Vercel's file-based routing
  - CORS headers configured at Vercel level
  - Cache-Control headers for API responses

- **Local Development** - Express server (`server/standalone.ts`) continues to work locally on Replit

**November 25, 2025 - FIXED: AI Summary Button + Indicator Filtering**:

- **Generate Button Loading State (`client/src/components/analyse/AiSummaryPanel.tsx`)**
  - Added `isGenerating` state to track manual API calls
  - Wand icon now spins during generation
  - Button disables during generation to prevent duplicate clicks

- **Indicator Name Filtering (`server/gemini_tech_summary.js`)**
  - Added post-processing filter to remove indicator names from Gemini response
  - Removes: EMA, MACD, RSI, VWAP, OBV, ADX, Stochastic, ATR, Bollinger, Williams %R, SAR, etc.
  - Cleans up extra spaces/newlines left by filtering
  - Much more reliable than trying to restrict Gemini's output via prompts

- **Result**: Clean trader-language analysis without any indicator name mentions

**November 25, 2025 - INTEGRATED: Gemini Technical Summary Module**:

- **New Module: `server/gemini_tech_summary.js`**
  - Complete single-file solution for technical indicator calculation
  - Computes 10+ technical indicators (EMA, RSI, MACD, VWAP, ATR, Bollinger Bands, OBV, ADX, Stochastic, Williams %R, Parabolic SAR)
  - Builds 4 combined fields: `trend_bias`, `momentum_state`, `volume_context`, `volatility_state`
  - Sends only these 4 summary fields to Gemini (NEVER raw indicator names)
  - Handles Gemini API with retry logic and rate limiting (429 errors)
  - Supports two usage modes:
    - `runSummaryWithIndicators()` - with pre-computed indicators
    - `runSummary()` - with OHLCV candles (computes indicators internally)

- **Updated: `server/services/aiService.ts`**
  - Modified `generateCryptoInsight()` to use new gemini_tech_summary module
  - Dynamically imports module at request-time (compatible with Vercel serverless)
  - Extracts precomputed indicators and passes to `runSummaryWithIndicators()`
  - Cleaner code flow: indicators → summary fields → Gemini prompt → response

- **Data Flow Improvement**
  - No raw indicator data sent to Gemini (prevents indicator names in output)
  - Only structured trader-style summary fields: trend state, momentum state, volume context, volatility state
  - Result: Professional trader-style analysis (e.g., "Price is trading below VWAP" → "Price strengthening with sellers in control")

**November 24, 2025 - FIXED: AI Summary Button + Rate Limiting Handling**:

- **Symbol Mismatch Caching Bug Fixed (`client/src/hooks/useAiSummary.ts`)**
  - ROOT CAUSE: Cache key included `technicals` object reference, but invalidation didn't match
  - FIXED: Changed to 3-part key `["aiSummary", symbol, tf]` matching invalidation logic
  - RESULT: Symbol switching now properly clears stale cache
  
- **Generate Button Now Working (`client/src/components/analyse/AiSummaryPanel.tsx`)**
  - Button was working but API was failing silently
  - Simplified logic: direct API call + cache update
  - Added console debugging for troubleshooting
  
- **Gemini API Rate Limiting Handled (`server/services/aiService.ts`)**
  - Added retry logic with exponential backoff (1s, 2s, 4s waits)
  - Detects 429 errors and retries up to 3 times
  - Falls back gracefully when rate limited
  
- **Better Error Messages (`server/routes.ts`)**
  - Detects rate limiting specifically and returns: "AI service is temporarily busy. Try again in a few moments."
  - Other errors return: "AI analysis unavailable at the moment. Please try again shortly."
  - User-friendly messaging instead of 502 errors

- **Data Flow Improvements**
  - Express wraps technical data: `{ indicators: technicalAnalysis }`
  - Combined signals sends ONLY 4 summary fields to Gemini
  - Result: Pure trader-style analysis (not robot listings)

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript, using Vite.
- **Routing**: Hash-based routing with `wouter`.
- **State Management**: React Query for server state (e.g., 30s refetch for ticker data), React Context for authentication, Zustand for shared prices, local component state for UI.
- **UI Library**: Radix UI components styled with Tailwind CSS (shadcn/ui "new-york" variant).
- **Caching Strategy**: `localStorage` for ticker data (30s TTL), Zustand store for live prices.

## Backend Architecture
- **Runtime Environment**: Dual-mode, supporting local Express.js development (Replit) and Vercel serverless functions (production).
- **API Structure**: Modular API routes under `/api/` for portfolio, scanner, watchlist, market data, AI, OHLCV, metrics, and fear & greed.
- **Caching**: In-memory Map-based caching with TTL for expensive operations (45-90s for market data), and HTTP cache headers.
- **AI Service**: Gemini API initialized at request-time to support Vercel serverless.
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

# External Dependencies

- **Market Data**: Binance REST API (`api.binance.com/api/v3`) for real-time tickers and OHLC data.
- **Market Sentiment**: CoinMarketCap API (`pro-api.coinmarketcap.com/v3`) for Fear & Greed index.
- **AI Services**: Google Gemini API (`gemini-1.5-flash` model) for market analysis and AI Summary.
- **Authentication**: Supabase Auth.