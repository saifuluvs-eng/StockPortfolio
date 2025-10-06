import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { setupAuth, isAuthenticated as replitIsAuthenticated } from "./replitAuth";
import { binanceService } from "./services/binanceService";
import { technicalIndicators } from "./services/technicalIndicators";
import { aiService } from "./services/aiService";
import { portfolioService } from "./services/portfolioService";
import { insertPortfolioPositionSchema, insertWatchlistItemSchema, insertTradeTransactionSchema } from "@shared/schema";
import { z } from "zod";

function parseBooleanQuery(value: unknown): boolean {
  if (Array.isArray(value)) return parseBooleanQuery(value[0]);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    return !["0", "false", "no"].includes(normalized);
  }
  return false;
}

// A robust authentication middleware placeholder.
// When authentication is enabled, this will protect routes.
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  // In a real app, you'd use the real authentication middleware.
  // For now, we'll attach a demo user to the request object.
  // This makes it easy to switch to real auth later.
  (req as any).user = { id: "demo-user" };
  next();
  // return replitIsAuthenticated(req, res, next);
};

export function registerRoutes(app: Express): void {
  // Auth middleware
  // TODO: Uncomment this when you are ready to enable real authentication.
  //await setupAuth(app);

  // Auth routes
  // This route should also be protected to get the currently logged-in user.
  app.get('/api/auth/user', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Enhanced Portfolio routes
  app.get('/api/portfolio', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const summary = await portfolioService.getPortfolioSummary(userId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      res.status(500).json({ message: "Failed to fetch portfolio" });
    }
  });

  app.get('/api/portfolio/allocation', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const allocation = await portfolioService.getAssetAllocation(userId);
      res.json(allocation);
    } catch (error) {
      console.error("Error fetching asset allocation:", error);
      res.status(500).json({ message: "Failed to fetch asset allocation" });
    }
  });

  app.get('/api/portfolio/performance', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const days = parseInt(req.query.days as string) || 30;
      const metrics = await portfolioService.getPerformanceMetrics(userId, days);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching performance metrics:", error);
      res.status(500).json({ message: "Failed to fetch performance metrics" });
    }
  });

  app.get('/api/portfolio/analytics', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const analytics = await storage.getPortfolioAnalytics(userId, startDate, endDate);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching portfolio analytics:", error);
      res.status(500).json({ message: "Failed to fetch portfolio analytics" });
    }
  });

  app.get('/api/portfolio/transactions', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const symbol = req.query.symbol as string;
      const transactions = await portfolioService.getTransactionHistory(userId, symbol);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transaction history:", error);
      res.status(500).json({ message: "Failed to fetch transaction history" });
    }
  });

  app.post('/api/portfolio/transactions', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
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

  app.post('/api/portfolio', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
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

  app.patch('/api/portfolio/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      
      // For PATCH, we should allow partial updates.
      // .partial() makes all fields in the schema optional.
      const validatedData = insertPortfolioPositionSchema.partial().parse(req.body);
      
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

  app.delete('/api/portfolio/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
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
  app.get('/api/market/ticker/:symbol', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const ticker = await binanceService.getTickerData(symbol);
      res.json(ticker);
    } catch (error) {
      console.error("Error fetching ticker:", error);
      res.status(500).json({ message: "Failed to fetch ticker data" });
    }
  });

  app.get('/api/market/gainers', async (_req: Request, res: Response) => {
    try {
      type RawGainer = {
        symbol: string;
        lastPrice?: string;
        price?: string;
        priceChangePercent?: string;
        changePct?: string;
        quoteVolume?: string;
        volume?: string;
        highPrice?: string;
        high?: string;
        lowPrice?: string;
        low?: string;
      };

      const gainers = await binanceService.getTopGainers();
      const toNumber = (value: unknown) => {
        if (typeof value === "number") return value;
        if (typeof value === "string" && value.trim().length) {
          const parsed = Number.parseFloat(value);
          return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
      };
      const rows = gainers
        .filter((item: Partial<RawGainer>): item is RawGainer => typeof item?.symbol === "string")
        .map((item) => ({
          symbol: item.symbol,
          price: toNumber(item.lastPrice ?? item.price),
          changePct: toNumber(item.priceChangePercent ?? item.changePct),
          volume: toNumber(item.quoteVolume ?? item.volume),
          high: toNumber(item.highPrice ?? item.high),
          low: toNumber(item.lowPrice ?? item.low),
        }));

      res.json({ rows });
    } catch (error) {
      console.error("Error fetching gainers:", error);
      res.status(500).json({ message: "Failed to fetch gainers" });
    }
  });

  // AI Analysis endpoints
  app.post('/api/ai/analyze/:symbol', async (req: Request, res: Response) => {
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

  app.get('/api/ai/market-overview', async (req: Request, res: Response) => {
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

  app.get('/api/ai/sentiment/:symbol/:timeframe', async (req: Request, res: Response) => {
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
  app.post('/api/scanner/scan', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { symbol, timeframe, filters } = req.body;

      const analysis = await technicalIndicators.analyzeSymbol(symbol, timeframe);

      // Save scan history
      await storage.createScanHistory({
        userId,
        scanType: 'custom',
        filters: { symbol, timeframe, ...filters },
        results: analysis,
      });

      res.json(analysis);
    } catch (error) {
      console.error("Error performing scan:", error);
      res.status(500).json({ message: "Failed to perform scan" });
    }
  });

  app.get('/api/scanner/history', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { type } = req.query;
      const history = await storage.getScanHistory(
        userId,
        typeof type === 'string' && type.length > 0 ? type : undefined,
      );
      res.json(history);
    } catch (error) {
      console.error("Error fetching scan history:", error);
      res.status(500).json({ message: "Failed to fetch scan history" });
    }
  });

  // Watchlist routes
  app.get('/api/watchlist', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const watchlist = await storage.getWatchlist(userId);
      res.json(watchlist);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  app.post('/api/watchlist', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
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

  app.delete('/api/watchlist/:symbol', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const symbol = req.params.symbol;
      const removed = await storage.removeFromWatchlist(userId, symbol);
      res.json({ success: removed });
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      res.status(500).json({ message: "Failed to remove from watchlist" });
    }
  });
}
