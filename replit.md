# Overview

This is a cryptocurrency trading analysis dashboard that provides real-time market scanning, technical analysis, and portfolio management. The application uses Supabase for authentication and PostgreSQL for persistent data storage via Drizzle ORM. It integrates with Binance's API for live market data and uses OpenAI for AI-powered trading insights. The app is fully optimized for both desktop and mobile devices and can be deployed on Vercel or run locally on Replit.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

**November 12, 2025**:
- **Completed database migration from SQLite to PostgreSQL (Supabase)**
  - Migrated all table schemas from SQLite to Postgres-compatible types
  - Updated Drizzle ORM configuration to use Neon HTTP driver for Supabase
  - Changed column types: `real` → `doublePrecision`, `integer timestamps` → `timestamp`, `text{mode:json}` → `jsonb`
  - Successfully pushed schema to Supabase database using `drizzle-kit push`
  - App now uses persistent PostgreSQL storage that works on both local development and Vercel deployment
- **Created comprehensive Vercel deployment documentation**
  - Added `.env.example` with all required environment variables
  - Created `DEPLOYMENT.md` with step-by-step Vercel deployment guide
  - Documented database setup, environment variables, and troubleshooting
- **Verified Vercel serverless function compatibility**
  - All `/api` functions properly structured for Vercel deployment
  - Storage layer uses database with fallback support
  - Hash-based routing works on serverless platforms
- Migrated from React Router to Wouter for hash-based routing consistency
- Completed Priority 1 & 2 Mobile Optimizations (architect-verified):
  - Landing page: Sheet-based hamburger nav, responsive hero, 48px touch targets
  - Auth pages: Input font ≥16px to prevent iOS zoom, 44-48px touch targets
  - Dashboard: Responsive 8-tile grid (1→2→3→4→5 cols), 44px buttons
  - Portfolio: Horizontal-scroll table, responsive stat cards
- Reverted from CoinGecko back to Binance API (works when deployed outside Replit)
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

**AI Services**: OpenAI API with GPT-5 model for market analysis and insights

**News**: CryptoPanic API for cryptocurrency news aggregation

**Authentication**: Firebase Auth and Firebase Admin SDK
- Token verification via `verifyIdToken`
- Firestore for user profile persistence

**Build Tools**:
- Vite for frontend bundling with React plugin
- TypeScript compiler with path mapping
- PostCSS with Tailwind CSS and Autoprefixer
- Drizzle Kit for database migrations

**Deployment Platform**: Vercel with serverless functions and edge caching
- Rewrites configuration in `vercel.json` for API routing
- SPA fallback to `/index.html` for client-side routing
- Singapore region (`sin1`) for low-latency Asia-Pacific access