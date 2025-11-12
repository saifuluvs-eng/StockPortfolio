# Overview

This is a cryptocurrency trading analysis dashboard that provides real-time market scanning, technical analysis, and portfolio management. The application uses Firebase Authentication for user management and supports both local SQLite (via Drizzle ORM) and Firebase Firestore for data persistence. It integrates with Binance's API for live market data and uses OpenAI for AI-powered trading insights.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

**November 12, 2025**:
- Migrated from Vercel to Replit's persistent server architecture
- Fixed React hook violation in Account.tsx (moved useEffect before conditional returns)
- Added `/api/ai/summary` endpoint for AI Summary panel with resilient error handling
- Server configured to bind to `0.0.0.0:5000` for Replit environment
- Made Firebase authentication optional - app now uses Supabase as primary auth
- Created database tables via Drizzle migrations

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

**Local Development**:
- Express.js server with Vite middleware for HMR
- Better-SQLite3 for local database (`local.db`)
- WebSocket support for real-time features

**Production (Serverless)**:
- Vercel serverless functions in `/api` directory
- Each API route is a standalone serverless function
- Firebase Firestore for production data storage
- Fallback in-memory storage when database unavailable

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

**Primary Auth**: Firebase Authentication with token-based verification

**Token Flow**:
1. Client obtains Firebase ID token via Firebase Auth SDK
2. Token sent in `Authorization: Bearer <token>` header
3. Server verifies token using Firebase Admin SDK
4. User ID extracted from verified token claims

**User Profile Storage**: Firestore `users` collection keyed by Firebase UID, merged with token claims

**Demo Mode**: `X-Demo-User-Id` header support for development/testing without full auth

**Service Account Configuration**: Supports three methods:
- Path to service account JSON (`FIREBASE_SERVICE_ACCOUNT_PATH`)
- Raw JSON string (`FIREBASE_SERVICE_ACCOUNT_JSON`)
- Individual environment variables (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)

## Data Storage

**Schema Definition**: Centralized in `shared/schema.ts` using Drizzle ORM

**Dual Storage Strategy**:
- **Local/Development**: SQLite via Drizzle + Better-SQLite3
- **Production**: Firebase Firestore with document-based models

**Storage Abstraction**: `IStorage` interface in `server/storage.ts` provides unified API regardless of backend

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

**Market Data**: Binance REST API (`api.binance.com`)
- Rate limiting with 120ms minimum interval between requests
- User-Agent header for API compliance
- Exponential backoff on errors (60-second base)
- Klines (candlestick) endpoint for OHLCV data
- 24hr ticker endpoint for price/volume statistics

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