import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { isAuthenticated } from "./auth";
import { binanceService } from "./services/binanceService";
import { technicalIndicators } from "./services/technicalIndicators";
import { aiService } from "./services/aiService";
import { portfolioService } from "./services/portfolioService";
import { binanceWebSocketService } from "./services/binanceWebSocketService";
import { insertPortfolioPositionSchema, insertWatchlistItemSchema, insertTradeTransactionSchema } from "@shared/schema";
import { z } from "zod";

export interface RegisterRoutesOptions {
  enableWebSockets?: boolean;
}

export async function registerRoutes(
  app: Express,
  options: RegisterRoutesOptions = {},
): Promise<Server | undefined> {
  const { enableWebSockets = true } = options;
  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req, res) => {
    try {
      const authUser = req.user!;
      const profile = await storage.upsertUser({
        id: authUser.id,
        email: authUser.email ?? undefined,
        displayName: authUser.displayName ?? undefined,
        profileImageUrl: authUser.picture ?? undefined,
      });

      res.json({
        id: profile.id,
        email: profile.email ?? authUser.email ?? null,
        displayName: profile.displayName ?? authUser.displayName ?? null,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        profileImageUrl: profile.profileImageUrl ?? authUser.picture ?? null,
        createdAt: profile.createdAt ?? null,
        updatedAt: profile.updatedAt ?? null,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Enhanced Portfolio routes
  app.get('/api/portfolio', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.json({
          totalValue: 0,
          totalPnL: 0,
          totalPnLPercent: 0,
          dayChange: 0,
          dayChangePercent: 0,
          positions: []
        });
      }
      const userId = req.user.id;
      const summary = await portfolioService.getPortfolioSummary(userId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      res.status(500).json({ message: "Failed to fetch portfolio" });
    }
  });

  app.get('/api/portfolio/allocation', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.json([]);
      }
      const userId = req.user.id;
      const allocation = await portfolioService.getAssetAllocation(userId);
      res.json(allocation);
    } catch (error) {
      console.error("Error fetching asset allocation:", error);
      res.status(500).json({ message: "Failed to fetch asset allocation" });
    }
  });

  app.get('/api/portfolio/performance', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.json({
          totalReturn: 0,
          totalReturnPercent: 0,
          volatility: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
          winRate: 0,
          avgWinPercent: 0,
          avgLossPercent: 0,
          bestTrade: 0,
          worstTrade: 0
        });
      }
      const userId = req.user.id;
      const days = parseInt(req.query.days as string) || 30;
      const metrics = await portfolioService.getPerformanceMetrics(userId, days);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching performance metrics:", error);
      res.status(500).json({ message: "Failed to fetch performance metrics" });
    }
  });

  app.get('/api/portfolio/analytics', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.json([]);
      }
      const userId = req.user.id;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const analytics = await storage.getPortfolioAnalytics(userId, startDate, endDate);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching portfolio analytics:", error);
      res.status(500).json({ message: "Failed to fetch portfolio analytics" });
    }
  });

  app.get('/api/portfolio/transactions', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.json([]);
      }
      const userId = req.user.id;
      const symbol = req.query.symbol as string;
      const transactions = await portfolioService.getTransactionHistory(userId, symbol);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transaction history:", error);
      res.status(500).json({ message: "Failed to fetch transaction history" });
    }
  });

  app.post('/api/portfolio/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertTradeTransactionSchema.parse({
        ...req.body,
        userId,
        executedAt: new Date(req.body.executedAt) // Convert string to Date
      });
      const transaction = await portfolioService.addTransaction(userId, validatedData);
      res.json(transaction);
    } catch (error) {
      console.error("Error adding transaction:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to add transaction" });
      }
    }
  });

  app.post('/api/portfolio', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertPortfolioPositionSchema.parse({
        ...req.body,
        userId,
      });
      
      const position = await storage.createPortfolioPosition(validatedData);
      res.json(position);
    } catch (error) {
      console.error("Error creating portfolio position:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create position" });
      }
    }
  });

  app.patch('/api/portfolio/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const validatedData = insertPortfolioPositionSchema.omit({ userId: true }).parse(req.body);
      
      const updated = await storage.updatePortfolioPosition(id, userId, validatedData);
      if (!updated) {
        return res.status(404).json({ message: "Position not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating portfolio position:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update position" });
      }
    }
  });

  app.delete('/api/portfolio/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const deleted = await storage.deletePortfolioPosition(id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Position not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting portfolio position:", error);
      res.status(500).json({ message: "Failed to delete position" });
    }
  });

  // Market data routes
  app.get('/api/market/ticker/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const ticker = await binanceService.getTickerData(symbol);
      res.json(ticker);
    } catch (error) {
      console.error("Error fetching ticker:", error);
      res.status(500).json({ message: "Failed to fetch ticker data" });
    }
  });

  app.get('/api/market/gainers', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const gainers = await binanceService.getTopGainers(limit);
      res.json(gainers);
    } catch (error) {
      console.error("Error fetching gainers:", error);
      res.status(500).json({ message: "Failed to fetch gainers" });
    }
  });

  // AI Analysis endpoints
  app.post('/api/ai/analyze/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { analysisType = 'recommendation', timeframe = '4h' } = req.body;
      
      // Get technical analysis for the symbol
      const technicalAnalysis = await technicalIndicators.analyzeSymbol(symbol, timeframe);
      
      // Get market data
      const marketData = await binanceService.getTickerData(symbol);
      
      // Generate AI insight
      const aiInsight = await aiService.generateCryptoInsight(
        symbol,
        technicalAnalysis,
        marketData
      );
      
      res.json(aiInsight);
    } catch (error) {
      console.error("Error generating AI analysis:", error);
      res.status(500).json({ message: "Failed to generate AI analysis" });
    }
  });

  app.get('/api/ai/market-overview', async (req, res) => {
    try {
      // Get top gainers and market data
      const gainers = await binanceService.getTopGainers(20);
      
      // Create market summary
      const marketSummary = {
        topGainers: gainers.slice(0, 5),
        averageGain: gainers.reduce((sum, g) => sum + parseFloat(g.priceChangePercent), 0) / gainers.length,
        highVolumeCount: gainers.filter(g => parseFloat(g.quoteVolume) > 10000000).length,
        timestamp: new Date().toISOString(),
      };
      
      // Generate AI market overview
      const overview = await aiService.generateMarketOverview(marketSummary);
      
      res.json(overview);
    } catch (error) {
      console.error("Error generating market overview:", error);
      res.status(500).json({ message: "Failed to generate market overview" });
    }
  });

  app.get('/api/ai/sentiment/:symbol/:timeframe', async (req, res) => {
    try {
      const { symbol, timeframe = '4h' } = req.params;
      
      // Get price data and technical analysis
      const klines = await binanceService.getKlineData(symbol, timeframe as string, 50);
      const priceData = klines.map(k => parseFloat(k.close));
      const technicalData = await technicalIndicators.analyzeSymbol(symbol, timeframe);
      
      // Generate sentiment analysis
      const sentiment = await aiService.analyzeMarketSentiment(symbol, priceData, technicalData);
      
      res.json(sentiment);
    } catch (error) {
      console.error("Error analyzing sentiment:", error);
      res.status(500).json({ message: "Failed to analyze sentiment" });
    }
  });

  // Scanner routes
  app.post('/api/scanner/scan', async (req: any, res) => {
    try {
      console.log('SCAN route hit. Body:', req.body);
      const { symbol, timeframe, filters } = req.body;

      // Allow scanning BTCUSDT without authentication
      if (symbol.toUpperCase() !== 'BTCUSDT' && !req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const userId = req.user?.id;
      
      const analysis = await technicalIndicators.analyzeSymbol(symbol, timeframe);
      
      // Save scan history only for authenticated users
      if (userId) {
        await storage.createScanHistory({
          userId,
          scanType: 'custom',
          filters: { symbol, timeframe, ...filters },
          results: analysis,
        });
      }
      
      res.json(analysis);
    } catch (error) {
      console.error("Error performing scan:", error);
      res.status(500).json({ message: "Failed to perform scan" });
    }
  });

  app.post('/api/scanner/high-potential', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const filters = req.body;
      
      const results = await technicalIndicators.scanHighPotential(filters);
      
      // Save scan history
      await storage.createScanHistory({
        userId,
        scanType: 'high_potential',
        filters,
        results,
      });
      
      res.json(results);
    } catch (error) {
      console.error("Error scanning high potential:", error);
      res.status(500).json({ message: "Failed to scan high potential coins" });
    }
  });

  // Watchlist routes
  app.get('/api/watchlist', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.json([]);
      }
      const userId = req.user.id;
      const watchlist = await storage.getWatchlist(userId);
      res.json(watchlist);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  app.post('/api/watchlist', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertWatchlistItemSchema.parse({
        ...req.body,
        userId,
      });
      
      const item = await storage.addToWatchlist(validatedData);
      res.json(item);
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to add to watchlist" });
      }
    }
  });
  if (!enableWebSockets) {
    return undefined;
  }

  const httpServer = createServer(app);

  // With Pusher, we no longer need to manage a WebSocket server here.
  // We just need to ensure the Binance WebSocket service is running and
  // proxying data to Pusher.

  const popularSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT'];

  // Initialize WebSocket service for popular symbols to ensure they're always available
  // The service will now automatically proxy these to Pusher.
  console.log('Initializing permanent subscriptions for popular symbols...');
  popularSymbols.forEach(symbol => {
    binanceWebSocketService.subscribeToTicker(symbol);
  });

  // We can add a simple endpoint for the client to get the Pusher key.
  app.get('/api/pusher/config', (req, res) => {
    res.json({
      key: process.env.PUSHER_KEY,
      cluster: process.env.PUSHER_CLUSTER,
    });
  });

  return httpServer;
}
