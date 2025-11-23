# Overview

This project is a cryptocurrency trading analysis dashboard offering real-time market scanning, technical analysis, and portfolio management. It integrates with Binance for live market data and leverages Google Gemini for AI-powered trading insights. The application uses Supabase for authentication and PostgreSQL for data storage via Drizzle ORM, optimized for both desktop and mobile deployment on platforms like Vercel or locally on Replit.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript, using Vite.
- **Routing**: Hash-based routing with `wouter` to avoid server-side conflicts.
- **State Management**: React Query for server state (20s stale time, no refetch on window focus), React Context for authentication, and local component state for UI.
- **UI Library**: Radix UI components styled with Tailwind CSS (shadcn/ui "new-york" variant).
- **Path Aliases**: `@/` (client/src), `@shared/` (shared/), `@assets/` (attached_assets/).

## Backend Architecture
- **Runtime Environment**: Dual-mode, supporting local Express.js development (Replit) and Vercel serverless functions (production).
- **API Structure**: Modular API routes under `/api/` for portfolio, scanner, watchlist, market data, AI, OHLCV, and metrics.
- **Caching**: In-memory Map-based caching for expensive operations with TTL-based invalidation (45-90s for market data), and HTTP cache headers for CDN optimization.

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
- **AI Services**: Google Gemini API (`gemini-2.5-flash` model) for market analysis and AI Summary.
- **News**: CryptoPanic API for cryptocurrency news aggregation.
- **Authentication**: Supabase Auth (primary) and Firebase Auth (optional).
- **Build Tools**: Vite, TypeScript, PostCSS, Tailwind CSS, Drizzle Kit.
- **Deployment Platform**: Vercel for serverless functions and edge caching.