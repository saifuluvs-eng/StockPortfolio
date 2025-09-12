# Overview

CryptoTrader Pro is a comprehensive cryptocurrency trading platform that provides portfolio management, technical analysis, and market insights. The application is built as a full-stack web application with a React frontend and Express.js backend, utilizing the Binance API for real-time market data. Users can manage their cryptocurrency portfolios, perform technical analysis with custom scans, and track top-performing coins with advanced filtering capabilities.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built using **React with TypeScript** and follows a modern component-based architecture:
- **UI Framework**: Uses shadcn/ui components built on top of Radix UI primitives for consistent, accessible design
- **Styling**: Tailwind CSS for utility-first styling with a dark theme configuration
- **State Management**: React Query (@tanstack/react-query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation for type-safe form management
- **Build Tool**: Vite for fast development and optimized production builds

## Backend Architecture
The backend uses **Express.js** with a modular, service-oriented architecture:
- **API Design**: RESTful API structure with organized route handlers
- **Database Layer**: Drizzle ORM for type-safe database operations with PostgreSQL
- **Authentication**: Replit Auth integration with session-based authentication using express-session
- **External Services**: Binance API integration for real-time cryptocurrency market data
- **WebSocket Support**: WebSocket server for real-time data streaming capabilities

## Database Design
Uses **PostgreSQL** with Drizzle ORM providing type-safe database operations:
- **Session Management**: Dedicated sessions table for authentication state persistence
- **User Management**: Users table storing profile information from Replit Auth
- **Portfolio Tracking**: Portfolio positions table linking users to their cryptocurrency holdings
- **Activity Logging**: Scan history and watchlist tables for user activity tracking
- **Data Types**: Uses precise decimal types for financial data to ensure accuracy

## Authentication & Authorization
Implements **Replit Auth** for secure user management:
- **OAuth Integration**: Seamless login through Replit's OAuth system
- **Session Security**: Secure session management with PostgreSQL storage
- **Route Protection**: Middleware-based authentication checks for protected routes
- **User Context**: Consistent user identification across frontend and backend

## Technical Analysis Engine
Custom technical analysis system for cryptocurrency market evaluation:
- **Real-time Data**: Live price feeds and market data from Binance API
- **Indicators Library**: Implementation of common technical indicators (RSI, MACD, SMA, EMA, etc.)
- **Scoring System**: Proprietary scoring algorithm for buy/sell recommendations
- **Multi-timeframe Analysis**: Support for various timeframes (15min, 1hr, 4hr, 1day)
- **Custom Scanning**: Advanced filtering and screening capabilities

## Chart Integration
**TradingView Widgets** for professional-grade charting:
- **Real-time Charts**: Live price charts with multiple timeframe support
- **Technical Overlays**: Built-in technical analysis tools and indicators
- **Responsive Design**: Charts adapt to different screen sizes and themes
- **Symbol Integration**: Seamless integration with Binance trading pairs

# External Dependencies

## Market Data Provider
- **Binance API**: Real-time cryptocurrency prices, 24hr statistics, historical data, and market information for all trading pairs

## Authentication Service
- **Replit Auth**: OAuth-based authentication system providing secure user login, profile management, and session handling

## Database Service
- **Neon PostgreSQL**: Serverless PostgreSQL database with connection pooling via @neondatabase/serverless driver

## Chart Provider
- **TradingView**: Advanced charting widgets for technical analysis, providing professional trading tools and real-time market visualization

## UI Components
- **shadcn/ui**: Pre-built, accessible React components based on Radix UI primitives
- **Radix UI**: Low-level UI primitives for building high-quality, accessible design systems
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development

## Development Tools
- **Vite**: Modern build tool for fast development server and optimized production builds
- **TypeScript**: Type safety across the entire application stack
- **Drizzle Kit**: Database migrations and schema management
- **React Query**: Server state synchronization and caching