# Overview

This is a cryptocurrency trading analysis dashboard that provides real-time market scanning, technical analysis, and portfolio management. The application uses Supabase for authentication and PostgreSQL for persistent data storage via Drizzle ORM. It integrates with Binance's API for live market data and uses OpenAI for AI-powered trading insights. The app is fully optimized for both desktop and mobile devices and can be deployed on Vercel or run locally on Replit.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

**November 23, 2025 - FIXED: Dashboard Market Overview BTC/ETH Price Display**:
- **Removed non-functional WebSocket code**
  - Server doesn't have WebSocket endpoint implementation
  - WebSocket connections were failing silently on both Portfolio and Dashboard
  - Replaced with pure REST API approach using ticker endpoints

- **Dashboard Market Overview now uses REST API fetches**
  - Fixed ticker endpoint to return `price` field (was returning `lastPrice`)
  - Fallback queries fetch from `/api/market/ticker/BTCUSDT` and `/api/market/ticker/ETHUSDT`
  - These endpoints working correctly and returning valid ticker data
  - Prices stored in Zustand store and displayed in Market Overview card
  - Refetch interval: 15 seconds

- **Fixed Gainers page auto-refresh logging**
  - Auto-refresh timer message now shows only minutes (was showing "X minutes (X sec)")
  - Console log example: `[Gainers] Auto-refresh configured for 12.3 minutes`

- **TopGainersCard properly updates timestamp**
  - Dashboard card now syncs "last updated" timestamp when periodic polling finds fresh data
  - Timestamp updates every 5 seconds when new data detected in localStorage

- **Simplified architecture**
  - Removed complex WebSocket subscription logic
  - Both Portfolio and Dashboard now share simple REST API polling for prices
  - More reliable and maintainable without WebSocket infrastructure
  - Works identically in dev (Replit) and production (Vercel)

**November 23, 2025 - FIXED: Dashboard Market Overview BTC/ETH Price Updates**:
- **Unified BTC/ETH price display** across Dashboard and Portfolio
  - Portfolio now ALWAYS subscribes to BTCUSDT/ETHUSDT prices (not just portfolio positions)
  - Dashboard reads from shared Zustand price store (`usePrices()`) instead of separate API calls
  - Eliminates duplicate fetching and ensures prices always match Portfolio page
  - Fallback: If Portfolio not visited, Dashboard fetches BTC/ETH from API once and stores in shared store
  - Both pages now sync prices in real-time through the same state management

- **Portfolio WebSocket now includes BTC/ETH subscriptions**
  - Portfolio subscribes to BTCUSDT + ETHUSDT first, then portfolio positions
  - Guarantees BTC/ETH prices are always in the shared store
  - Dashboard can reliably read these prices for Market Overview section

- **Removed redundant WebSocket setup** in Dashboard
  - Portfolio handles WebSocket subscriptions for BTC/ETH and updates the shared store
  - Dashboard listens to the same store, eliminating duplicate subscriptions
  - Result: BTC/ETH prices update together on both pages in real-time

- **Market Overview section** now displays live, updating prices
  - Price data flows: Portfolio WebSocket → Zustand Store → Dashboard Display
  - Fallback queries only run if Portfolio hasn't been visited
  - 15-second refetch interval for fallback (increased from 10s to reduce API load)

**November 23, 2025 - FIXED: Gainers Page Auto-Refresh & Production Deployment**:
- **Fixed auto-refresh failure** on Gainers page
  - Changed from direct Binance API (geo-blocked on Replit) to backend endpoint
  - Gainers page now fetches from `/api/market/gainers` with fallback support
  - Manual refresh now works correctly with proper error handling and logging
  
- **Created Vercel serverless function** for production deployment
  - New file: `api/market/gainers.ts` (Vercel function)
  - Returns same format: `{ ok: true, rows: [...], timestamp: ... }`
  - Handles Binance API failures gracefully with proper error responses
  - Filters USDT pairs, excludes leveraged tokens (UP/DOWN/BULL/BEAR)
  - Returns top 50 gainers sorted by 24h change percentage
  - Works both on Replit dev server and Vercel production

- **Auto-refresh now fully functional**
  - Randomized 10-15 minute intervals prevent sync issues
  - Backend endpoint works on both local and production
  - Browser console logs track when auto-refresh runs: `[Gainers] ✓ Auto-refreshing data now...`

**November 23, 2025 - NEW: Gainers Page Auto-Refresh & Dashboard Card**:
- **Added Gainers page auto-refresh every 10-15 minutes**
  - Auto-refresh runs on randomized 10-15 minute intervals to prevent synchronized updates
  - Manual refresh button still works as before
  - Uses same `fetchData(true)` function to silently update data without page reload
  - Displays "Last updated" timestamp that updates with each refresh
  - Auto-refresh clears on component unmount
  
- **Created Top Gainers Card on Dashboard**
  - New dedicated `TopGainersCard` component (client/src/components/dashboard/TopGainersCard.tsx)
  - Shows top 3 market gainers with symbols and 24h percentage gains
  - Features "view more →" link to navigate to full Gainers page
  - Displays "last updated" timestamp that syncs automatically
  - Dual data source:
    1. Primary: Reads from localStorage (populated by Gainers page auto-refresh)
    2. Fallback: Fetches from `/api/market/gainers` backend endpoint for first-time visitors
  - Listens for storage changes to sync with Gainers page updates
  - Periodic polling (every 5 seconds) ensures up-to-date data across tabs
  - All data synced in real-time between Dashboard and Gainers page

**November 22, 2025 - RESOLVED: API Endpoints Fixed**:
- **Fixed hanging Gemini API issue in AI Summary**
  - Added 15-second timeout to `/api/ai/summary` endpoint
  - Used AbortController to prevent indefinite hangs on slow Gemini API
  - Endpoint now gracefully falls back to technical-only analysis if AI service times out
  - Result: AI Summary panel now loads immediately without hanging the page

- **Removed external Render backend dependency**
  - Deleted `client/src/initApiBase.ts` (fetch interceptor for external backend routing)
  - Removed `VITE_API_BASE` environment variable usage
  - Frontend now uses relative API paths → routes to local Express (dev) or Vercel functions (production)
  - Cleaned up all Render-specific configuration and comments
  - Result: Clean, direct architecture with no external backend proxy needed

- **Migrated AI Summary from OpenAI to Google Gemini**
  - Updated all AI endpoints to use `gemini-2.5-flash` model
  - Implemented custom prompt template for meaningful analysis
  - AI Summary now: Bullish/Bearish bias, why, what to expect, levels to watch, risk assessment
  - Button renamed to "Generate" and changed from auto-trigger to manual-only
  - Fixed endpoint to return plain text formatted summary
  - Removed old compiled OpenAI code (`server/ai.js`)

**Both `/api/scanner/scan` and `/api/ai/summary` endpoints now working perfectly:**
- Scanner: Returns full technical analysis with 15+ indicators
- AI Summary: Returns Gemini-powered market insights with structured formatting

**November 12, 2025**:
- **Completed database migration from SQLite to PostgreSQL (Supabase)**
- **Created comprehensive Vercel deployment documentation**
- **Verified Vercel serverless function compatibility**
- Migrated from React Router to Wouter for hash-based routing consistency
- Completed Priority 1 & 2 Mobile Optimizations
- Reverted from CoinGecko back to Binance API
- Made Supabase primary authentication method (Firebase optional)
- Server configured to bind to `0.0.0.0:5000` for Replit environment

# System Architecture

## Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**Routing**: Hash-based routing using `wouter` with `useHashLocation` hook to avoid server-side routing conflicts

**State Management**: 
- React Query (TanStack Query) for server state with 20-second stale time and disabled window focus refetching
- React Context for authentication state (Firebase Auth)
- Local component state for UI interactions

**UI Library**: Radix UI components styled with Tailwind CSS using the "new-york" variant from shadcn/ui

**Path Aliases**: 
- `@/` maps to `client/src/`
- `@shared/` maps to `shared/`
- `@assets/` maps to `attached_assets/`

## Backend Architecture

**Runtime Environment**: Dual-mode execution supporting both local development and serverless deployment

**Local Development (Replit)**:
- Express.js server with Vite middleware for HMR
- PostgreSQL database via Supabase (DATABASE_URL)
- Server binds to `0.0.0.0:5000` for Replit webview access

**Production (Vercel)**:
- Vercel serverless functions in `/api` directory
- Each API route is a standalone serverless function
- PostgreSQL database via Supabase (same DATABASE_URL)
- No in-memory fallback needed - persistent database storage

**API Structure**:
- `/api/portfolio/*` - Portfolio position management
- `/api/scanner/*` - Market scanning and analysis
- `/api/watchlist/*` - User watchlist management
- `/api/market/*` - Binance market data proxy
- `/api/ai/*` - AI-powered insights and analysis
- `/api/ohlcv` - OHLC candlestick data
- `/api/metrics` - Technical indicator calculations

**Caching Strategy**:
- In-memory Map-based caching for expensive operations (metrics, news)
- TTL-based cache invalidation (45-90 seconds for market data)
- HTTP cache headers for CDN optimization (`s-maxage`, `stale-while-revalidate`)

## Authentication & Authorization

**Primary Auth**: Supabase Authentication with JWT token-based verification

**Token Flow**:
1. Client obtains Supabase session token via Supabase Auth SDK
2. Token sent in `Authorization: Bearer <token>` header
3. Server verifies token using Supabase client
4. User ID extracted from verified token claims

**User Profile Storage**: PostgreSQL `users` table via Drizzle ORM

**Demo Mode**: `X-Demo-User-Id` header support for development/testing without full auth

**Firebase (Optional)**: Legacy Firebase authentication is still supported for backwards compatibility
- Firebase Admin SDK can verify Firebase tokens if configured
- User profiles stored in Firestore when using Firebase auth

## Data Storage

**Schema Definition**: Centralized in `shared/schema.ts` using Drizzle ORM with PostgreSQL

**Database**: PostgreSQL via Supabase (both development and production)
- Connection via Neon HTTP driver (`@neondatabase/serverless`)
- Schema managed by Drizzle Kit migrations
- Connection string in `DATABASE_URL` environment variable

**Storage Implementation**: `DatabaseStorage` class in `server/storage.ts` provides data access layer
- Uses Drizzle ORM for type-safe queries
- Supports complex queries with filters, sorting, and pagination
- Fallback in-memory storage in serverless functions when database unavailable (backward compatibility)

**Key Tables/Collections**:
- `portfolio_positions` - User cryptocurrency holdings with entry price and quantity
- `watchlist` - User-specific symbol watchlist with unique constraint on (userId, symbol)
- `scan_history` - Historical scan results with filters and outcomes
- `trade_transactions` - Individual trade records for P&L calculations
- `portfolio_analytics` - Aggregated performance metrics
- `market_data` - Cached market snapshots
- `ai_analysis` - Stored AI-generated insights

**Timestamp Handling**: SQLite uses integer Unix timestamps; Firestore uses native Timestamp objects with conversion layer

## External Dependencies

**Market Data**: Binance REST API (`api.binance.com/api/v3`)
- Free tier with no authentication required
- Endpoints: `/ticker/24hr`, `/ticker/price`, `/klines` (OHLC data)
- Note: Binance API is geo-blocked on Replit (HTTP 451 error), but works when deployed outside Replit

**AI Services**: Google Gemini API with `gemini-2.5-flash` model for market analysis and AI Summary
- Replaces previous OpenAI integration
- Custom prompts for meaningful trading analysis without raw number repetition
- API key stored in `GEMINI_API_KEY` environment variable

**News**: CryptoPanic API for cryptocurrency news aggregation

**Authentication**: Supabase Auth (primary) + Firebase Auth (optional legacy support)
- Supabase: JWT token verification, PostgreSQL user profiles
- Firebase: Firebase Admin SDK for token verification and Firestore profile persistence (if configured)

**Build Tools**:
- Vite for frontend bundling with React plugin
- TypeScript compiler with path mapping
- PostCSS with Tailwind CSS and Autoprefixer
- Drizzle Kit for database migrations

**Deployment Platform**: Vercel with serverless functions and edge caching
- Rewrites configuration in `vercel.json` for API routing
- SPA fallback to `/index.html` for client-side routing
- Singapore region (`sin1`) for low-latency Asia-Pacific access
- No external backend proxy needed (architecture simplified)