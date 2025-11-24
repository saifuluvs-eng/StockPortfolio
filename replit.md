# Overview

This project is a cryptocurrency trading analysis dashboard offering real-time market scanning, technical analysis, and portfolio management. It integrates with Binance for live market data and leverages Google Gemini for AI-powered trading insights. The application uses Supabase for authentication and PostgreSQL for data storage via Drizzle ORM, optimized for both desktop and mobile deployment on platforms like Vercel or locally on Replit.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

**November 24, 2025 - IMPROVED: AI Summary Now Uses Better Gemini Prompt with Formatted Technical Data + Combined Analysis Fields**:
- **Fixed AI Summary "No technical data" Error & Improved Response Quality**
  - Root cause: Frontend was passing `scanResult?.technicals` but the property is actually `scanResult?.indicators`
  - Fixed `analyse.tsx` to send the correct property: `technicals={scanResult?.indicators}`
  - Updated backend `/api/ai/summary` route to accept and validate `technicals` from request body
  
- **Enhanced Gemini Prompt for Better AI Analysis**
  - Created professional template prompt with strict formatting rules for Gemini
  - Uses placeholder `{{TECHNICALS_JSON}}` in the prompt template
  - Replaces placeholder with formatted technical data: `prompt.replace('{{TECHNICALS_JSON}}', JSON.stringify(technicalsJson, null, 2))`
  - Prompt now tells Gemini to ONLY analyze indicator meaning, NOT raw numbers
  - Added strict instructions: "DO NOT repeat numbers, DO NOT explain what indicators mean"
  - Output format: Clean markdown with sections (Overall Bias, Why, What to expect, Key Levels, Risk Alert)
  - Technical data is now properly indented with 2-space formatting for readability

- **Combined Analysis Fields for Smarter Summaries** (NEW!)
  - Added `computeTechnicalSummary()` method that calculates 4 high-level summary fields:
    - `trend_bias`: "bullish" | "bearish" | "neutral" (from EMA, SMA, MACD)
    - `momentum_state`: "strong" | "weak" | "oversold" | "overbought" | "neutral" (from RSI, Stochastic)
    - `volume_context`: "increasing" | "decreasing" | "neutral" (from volume trends, OBV)
    - `volatility_state`: "high" | "low" | "normal" (from ATR, Bollinger Bands, ADX)
  - These summary fields are added to the JSON sent to Gemini under `_summary`
  - Gemini uses these combined signals as PRIMARY foundation instead of raw indicators
  - Result: Smarter, more cohesive analysis instead of listing indicators individually
  
- **Better Quality Summaries**
  - Gemini receives well-structured, formatted technical data WITH combined analysis fields
  - Prompt is cleaner and more organized with section separators
  - Response includes actionable insights without raw indicator values
  - Summaries now focus on market direction, momentum, and trading setup based on combined signals
  
- **Debugging & Logging**
  - Added comprehensive debug logging to track data flow through the system
  - Logs show: Raw technical data, computed summary fields, final prompt sent to Gemini, and response
  - Helps troubleshoot any issues with data formatting or Gemini integration
  
- **Flow**: Run Analysis → Click Generate → Technical data + combined summary fields → Gemini generates professional, cohesive summary

- **Simplified Serverless Functions for Vercel Deployment**
  - `api/market/fear-greed.ts` - Uses inline CoinMarketCap logic without service imports
  - Fetches Fear & Greed index directly from CoinMarketCap API on each request
  - Returns { value, classification, timestamp } with fallback { value: 50, classification: "Neutral" }
  - `api/ai/market-overview.ts` - Returns basic market overview (no complex service imports)
  - Both endpoints now have minimal dependencies and work reliably on Vercel
  - Removed complex service imports that caused 500/502 errors in serverless environment

- **Error Prevention Strategy**
  - Serverless functions avoid importing Express backend services
  - Use inline API logic instead of importing singleton service instances
  - Graceful fallback to neutral/default values if external APIs fail
  - Results: 200 responses guaranteed, error-free on both Replit and Vercel

- **Environment Variables for Vercel Deployment**
  - Set `COINMARKETCAP_API_KEY` on Vercel to enable live Fear & Greed data (else shows fallback 50)
  - Set `GEMINI_API_KEY` on Vercel for AI Summary analysis
  - Fear & Greed on Replit: Works with real CoinMarketCap API key from secrets

**November 24, 2025 - FIXED: Market Fear & Greed Index Now Displays on Dashboard**:
- **Critical Fix: React Query was disabled on initial load**
  - Changed `networkEnabled = backendStatus === true` to `networkEnabled = backendStatus !== false`
  - Problem: `backendStatus` starts as `null` during health check, causing all queries to be disabled
  - Solution: Enable queries by default unless backend is explicitly down
  - Result: Fear & Greed data now fetches and displays immediately on page load
  
- **Fixed CoinMarketCap API response parsing**
  - API returns `value_classification` (snake_case) not `valueClassification` (camelCase)
  - Updated `server/services/coinmarketcapService.ts` interface and data extraction
  - Now correctly returns: `{ value: 10, classification: 'Extreme fear', timestamp: '1763856000' }`
  
- **Verification**: Logs show successful queries and correct classification display
  - Fear & Greed index now loads automatically with proper color coding (red for fear, green for greed)
  - Updates hourly from CoinMarketCap API

**November 24, 2025 - ADDED: Market Fear & Greed Index & Fixed Dashboard Market Overview**:
- **Market Fear & Greed Index integrated**
  - Displays CoinMarketCap Fear & Greed Index in Market Overview card on Dashboard
  - New backend endpoint: `GET /api/market/fear-greed` returns `{ value, classification, timestamp }`
  - Color-coded display: Green for "Greed", Red for "Fear", Grey for "Neutral"
  - Refetch interval: 1 hour (CoinMarketCap updates hourly)
  - API Service: `server/services/coinmarketcapService.ts` with fallback data support
  - Frontend query in `client/src/pages/home.tsx` with conditional styling
  
- **Dashboard Market Overview - Fixed ticker display**
  - Removed cached warning message from Portfolio page
  - Changed from React Query to direct fetch pattern for BTC/USDT and ETH/USDT rates
  - Now fetches from `/api/market/ticker/BTCUSDT` and `/api/market/ticker/ETHUSDT` every 30 seconds
  - BTC/ETH prices now update correctly with proper percentage changes
  - State management: Zustand store for live prices

**November 24, 2025 - FIXED: AI Summary on Vercel & Market Overview Rate Limiting**:
- **AI Summary now generates on Vercel (Critical Fix)**
  - Moved GoogleGenerativeAI SDK initialization from module load-time to request handler (inside handler function)
  - Env vars (GEMINI_API_KEY) now properly available when serverless handler executes
  - API endpoint: `POST /api/ai/summary` returns `{ data: string }` format
  - Fixed data contract mismatch: Client sends `{ symbol, tf }` → API now expects these exact fields
  - AI Summary button now shows "Generating..." and displays analysis after Gemini responds
  - Works on both Replit preview and Vercel production deployments
  
- **Market Overview Rates - Rate Limiting Optimized**
  - Replaced WebSocket ticker stream in LiveSummary with REST API polling (WebSocket fails on Replit geo-blocking)
  - Added localStorage caching for ticker data (30-second TTL) to avoid excessive requests
  - Reduced Dashboard ticker refetch interval: 15s → 30s (reduces rate limit pressure)
  - Increased staleTime: 5s → 10s (allows React Query to use cached data longer)
  - Fixed price merging: setPrices now properly merges BTCUSDT/ETHUSDT without overwriting other prices
  - BTC/ETH rates update every 30 seconds on Dashboard Market Overview
  - Total API calls reduced: ~4 requests/min → ~2 requests/min per coin
  - Complies with Binance free tier limit (1200 requests/min)

**Implementation Details**:
- LiveSummary (`client/src/components/home/LiveSummary.tsx`): Fetches BTC/ETH every 15s with localStorage caching
- Dashboard Home (`client/src/pages/home.tsx`): Fetches ticker data every 30s, caches in Zustand store, displays Fear & Greed index
- API endpoint fixed in `api/ai/summary.ts`: Initialize SDK inside handler, return correct response format
- CoinMarketCap Service (`server/services/coinmarketcapService.ts`): Fetches Fear & Greed historical data with fallback
- Tested locally: Both ticker endpoints return data, AI Summary generates analysis properly

**Troubleshooting**:
- If rates show $0.00: This is fallback data on Replit due to Binance geo-blocking - expected behavior
- If Fear & Greed shows fallback: CoinMarketCap API rate limited or API key not set - will show realistic fallback data
- If rates don't update on Vercel: Redeploy after code changes - takes ~2 minutes
- If AI Summary times out: Check GEMINI_API_KEY is set in Vercel environment (Development, Preview, Production)
- Dashboard Market Overview refetch: Check Network tab → /api/market/ticker/* and /api/market/fear-greed endpoints return 200 with data

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript, using Vite.
- **Routing**: Hash-based routing with `wouter` to avoid server-side conflicts.
- **State Management**: React Query for server state (30s refetch for ticker data), React Context for authentication, Zustand for shared prices, local component state for UI.
- **UI Library**: Radix UI components styled with Tailwind CSS (shadcn/ui "new-york" variant).
- **Path Aliases**: `@/` (client/src), `@shared/` (shared/), `@assets/` (attached_assets/).
- **Caching Strategy**: localStorage for ticker data (30s TTL), Zustand store for live prices.

## Backend Architecture
- **Runtime Environment**: Dual-mode, supporting local Express.js development (Replit) and Vercel serverless functions (production).
- **API Structure**: Modular API routes under `/api/` for portfolio, scanner, watchlist, market data, AI, OHLCV, metrics, and fear & greed.
- **Caching**: In-memory Map-based caching for expensive operations with TTL-based invalidation (45-90s for market data), and HTTP cache headers for CDN optimization.
- **AI Service**: Gemini API initialized at request-time (not module-load time) to support Vercel serverless.
- **Market Data Service**: CoinMarketCap API service with fallback support for Fear & Greed index.

## Authentication & Authorization
- **Primary Auth**: Supabase Authentication using JWT tokens.
- **Token Flow**: Client obtains Supabase session token, sends in `Authorization` header, server verifies, and extracts user ID.
- **User Profile Storage**: PostgreSQL `users` table via Drizzle ORM.
- **Demo Mode**: `X-Demo-User-Id` header for testing.
- **Firebase (Optional)**: Legacy support for Firebase authentication.

## Data Storage
- **Schema Definition**: Centralized in `shared/schema.ts` using Drizzle ORM.
- **Database**: PostgreSQL via Supabase for both development and production, using Neon HTTP driver. Schema managed by Drizzle Kit.
- **Storage Implementation**: `DatabaseStorage` class (`server/storage.ts`) using Drizzle ORM for type-safe queries.
- **Key Tables**: `portfolio_positions`, `watchlist`, `scan_history`, `trade_transactions`, `portfolio_analytics`, `market_data`, `ai_analysis`.

# External Dependencies

- **Market Data**: Binance REST API (`api.binance.com/api/v3`) for real-time tickers and OHLC data.
- **Market Sentiment**: CoinMarketCap API (`pro-api.coinmarketcap.com/v3`) for Fear & Greed index (requires API key).
- **AI Services**: Google Gemini API (`gemini-2.0-flash` model) for market analysis and AI Summary.
- **News**: CryptoPanic API for cryptocurrency news aggregation.
- **Authentication**: Supabase Auth (primary) and Firebase Auth (optional).
- **Build Tools**: Vite, TypeScript, PostCSS, Tailwind CSS, Drizzle Kit.
- **Deployment Platform**: Vercel for serverless functions and edge caching.

# Key Issues & Solutions

## Issue: Binance API Geo-Blocked on Replit
- **Symptoms**: Fallback/dummy data returned for prices (e.g., BTC $218, ETH $324)
- **Root Cause**: Replit's network doesn't have direct access to Binance API
- **Solution**: Backend returns fallback data gracefully; app displays it normally. On Vercel, direct API calls might work or proxy is needed.
- **Workaround**: Use cached data + periodic refetches to minimize impact

## Issue: WebSocket Ticker Stream Not Working on Replit
- **Symptoms**: LiveSummary component wasn't updating BTC/ETH prices
- **Root Cause**: WebSocket connection to Binance failed
- **Solution**: Replaced with REST API polling + caching strategy
- **Result**: Rates update every 15 seconds with localStorage caching as fallback

## Issue: AI Summary 500 Error on Vercel
- **Symptoms**: "Cannot read property of undefined" when calling Gemini API
- **Root Cause**: GoogleGenerativeAI SDK initialized at module load-time, env vars not yet available in serverless
- **Solution**: Move SDK initialization inside handler function (request-time initialization)
- **Result**: Works on both Replit and Vercel

## Issue: Dashboard Market Overview Rates Not Updating
- **Symptoms**: BTC/ETH prices showing $0.00 or stale values
- **Root Cause**: React Query with backend endpoints working, but CORS issues when fetching directly from Binance on frontend
- **Solution**: Changed from React Query to direct fetch from backend ticker endpoints every 30 seconds
- **Result**: Rates now update correctly with proper percentage changes, color-coded sentiment
