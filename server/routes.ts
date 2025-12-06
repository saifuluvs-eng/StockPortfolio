import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated as replitIsAuthenticated } from "./replitAuth";
import { binanceService } from "./services/binanceService";
import { technicalIndicators } from "./services/technicalIndicators";
import { aiService } from "./services/aiService";
import { portfolioService } from "./services/portfolioService";
import {
  insertPortfolioPositionSchema,
  insertWatchlistItemSchema,
  insertTradeTransactionSchema,
  type InsertPortfolioPosition,
} from "@shared/schema";
import { z } from "zod";
import { registerMetricsRoute } from "./routes/metrics";
import { registerNewsRoute } from "./routes/news";
import { registerOhlcvRoute } from "./routes/ohlcv";

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

export function registerRoutes(app: Express): Server {
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (socket) => {
    socket.on("message", (message) => {
      socket.send(message.toString());
    });
  });

  server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/ws") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (websocket) => {
      wss.emit("connection", websocket, request);
    });
  });
  // Auth middleware
  // TODO: Uncomment this when you are ready to enable real authentication.
  //await setupAuth(app);

  registerMetricsRoute(app);
  registerNewsRoute(app);
  registerOhlcvRoute(app);

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

  async function upsertPortfolioPosition(req: Request) {
    const userId = (req as any).user.id;
    const validatedData = insertPortfolioPositionSchema.parse({
      ...req.body,
      userId,
    });

    const { symbol, quantity, entryPrice, notes } = validatedData;
    return storage.upsertPortfolioPosition(userId, {
      symbol,
      quantity,
      entryPrice,
      notes: notes ?? null,
    });
  }

  async function updatePortfolioPosition(req: Request, updates: Partial<InsertPortfolioPosition>) {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const payload: Partial<InsertPortfolioPosition> = { ...updates };
    if (payload.notes !== undefined) {
      payload.notes = payload.notes ?? null;
    }

    const updated = await storage.updatePortfolioPosition(id, userId, payload);
    if (!updated) {
      return null;
    }
    return updated;
  }

  async function deletePortfolioPositionById(req: Request) {
    const userId = (req as any).user.id;
    const { id } = req.params;
    if (!id?.trim()) {
      return { deleted: false, reason: 'missing-id' as const };
    }

    const deleted = await storage.deletePortfolioPosition(id, userId);
    return { deleted, reason: deleted ? null : 'not-found' as const };
  }

  app.get('/api/portfolio/positions', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const positions = await storage.getPortfolioPositions(userId);
      res.json({ data: positions, userId });
    } catch (error) {
      console.error('Error fetching portfolio positions:', error);
      res.status(500).json({ message: 'Failed to fetch portfolio positions' });
    }
  });

  app.get('/api/portfolio/debug', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as { id: string }).id;
      const count = await storage.countPortfolioPositions(userId);
      res.json({ userId, count });
    } catch (error) {
      console.error('Error fetching portfolio debug info:', error);
      res.status(500).json({ message: 'Failed to fetch portfolio debug info' });
    }
  });

  app.post('/api/portfolio/positions', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const position = await upsertPortfolioPosition(req);
      res.status(201).json({ data: position });
    } catch (error) {
      console.error('Error creating portfolio position:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create position' });
      }
    }
  });

  app.post('/api/portfolio', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const position = await upsertPortfolioPosition(req);
      res.json(position);
    } catch (error) {
      console.error('Error creating portfolio position:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create position' });
      }
    }
  });

  app.patch('/api/portfolio/positions/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertPortfolioPositionSchema.partial().parse(req.body);
      const updated = await updatePortfolioPosition(req, validatedData);
      if (!updated) {
        return res.status(404).json({ error: 'Not found' });
      }

      res.json({ data: updated });
    } catch (error) {
      console.error('Error updating portfolio position:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to update position' });
      }
    }
  });

  app.patch('/api/portfolio/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertPortfolioPositionSchema.partial().parse(req.body);
      const updated = await updatePortfolioPosition(req, validatedData);
      if (!updated) {
        return res.status(404).json({ message: 'Position not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating portfolio position:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to update position' });
      }
    }
  });

  app.delete('/api/portfolio/positions/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { deleted, reason } = await deletePortfolioPositionById(req);
      if (!deleted) {
        if (reason === 'missing-id') {
          return res.status(400).json({ error: 'Missing id' });
        }
        return res.status(404).json({ error: 'Not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting portfolio position:', error);
      res.status(500).json({ message: 'Failed to delete position' });
    }
  });

  app.delete('/api/portfolio/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { deleted, reason } = await deletePortfolioPositionById(req);
      if (!deleted) {
        if (reason === 'missing-id') {
          return res.status(400).json({ message: 'Invalid id' });
        }
        return res.status(404).json({ message: 'Position not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting portfolio position:', error);
      res.status(500).json({ message: 'Failed to delete position' });
    }
  });

  // Market data routes
  app.get('/api/market/ticker/:symbol', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const ticker = await binanceService.getTickerData(symbol);
      // Map lastPrice to price for consistent API response
      res.json({
        symbol: ticker.symbol,
        price: ticker.lastPrice,
        priceChangePercent: ticker.priceChangePercent,
        priceChange: ticker.priceChange,
        highPrice: ticker.highPrice,
        lowPrice: ticker.lowPrice,
        volume: ticker.volume,
        quoteVolume: ticker.quoteVolume
      });
    } catch (error) {
      console.error("Error fetching ticker:", error);
      res.status(500).json({ message: "Failed to fetch ticker data" });
    }
  });

  app.get('/api/market/fear-greed', async (_req: Request, res: Response) => {
    try {
      const { coinmarketcapService } = await import('./services/coinmarketcapService');
      const fgData = await coinmarketcapService.getFearGreedIndex();
      res.json(fgData);
    } catch (error) {
      console.error("Error fetching Fear & Greed index:", error);
      res.status(500).json({ message: "Failed to fetch Fear & Greed index" });
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

  app.post('/api/ai/summary', async (req: Request, res: Response) => {
    try {
      const { symbol, tf, technicals, focus } = req.body;
      console.log(`[API] /api/ai/summary called. Symbol: ${symbol}, Focus: ${focus}`);
      if (!symbol) {
        return res.status(400).json({ error: "symbol is required" });
      }
      const timeframe = tf || '4h';

      // Check if technical data is missing or empty
      const isMissingData = !technicals ||
        (typeof technicals === "object" && Object.keys(technicals).length === 0) ||
        (Array.isArray(technicals) && technicals.length === 0);

      if (isMissingData) {
        console.warn(`No technical data received for ${symbol}`);
        return res.json({
          data: `Error: No technical data received.`,
        });
      }

      // Use the provided technicals or fetch if not provided
      let technicalAnalysis = technicals;
      if (!technicalAnalysis) {
        try {
          technicalAnalysis = await technicalIndicators.analyzeSymbol(symbol, timeframe);
        } catch (error) {
          console.warn(`Could not fetch technical analysis for ${symbol}:`, error);
          technicalAnalysis = {
            symbol,
            totalScore: 50,
            recommendation: 'hold',
            indicators: {}
          };
        }
      }

      // Generate AI summary using Gemini
      try {
        console.log("[AI Summary] Input technicalAnalysis:", JSON.stringify(technicalAnalysis).slice(0, 300));
        const aiSummary = await aiService.generateCryptoInsight(
          symbol,
          technicalAnalysis,
          { timeframe },
          focus || 'institutional'
        );
        console.log("[AI Summary] Response:", aiSummary.reasoning.slice(0, 200));
        res.json({ data: aiSummary.reasoning || "No summary available." });
      } catch (aiError) {
        const errorMsg = aiError instanceof Error ? aiError.message : String(aiError);
        console.error("AI service error:", errorMsg);

        // Check if it's a rate limiting issue
        if (errorMsg.includes("429") || errorMsg.includes("rate") || errorMsg.includes("Resource exhausted")) {
          return res.json({
            data: "AI service is temporarily busy (rate limited). Try again in a few moments. Analysis still available from technical indicators."
          });
        }

        // For other errors, return a helpful message
        return res.json({
          data: "AI analysis unavailable at the moment. Please try again shortly."
        });
      }
    } catch (error) {
      console.error("Error in /api/ai/summary:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        error: "Failed to generate AI summary",
        message: errorMsg
      });
    }
  });

  // Scanner routes
  app.post('/api/scanner/scan', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { symbol, timeframe, filters } = req.body;

      const analysis = await technicalIndicators.analyzeSymbol(symbol, timeframe);
      console.log(`[API] /scan result for ${symbol}. Keys: ${Object.keys(analysis).join(",")}`);
      console.log(`[API] /scan candles present: ${analysis.candles ? analysis.candles.length : "No"}`);

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

  // High Potential Route
  app.post('/api/high-potential', async (req: Request, res: Response) => {
    try {
      // We ignore req.body.coins for now and scan top pairs on backend as planned
      // to ensure we have full candle history for calculations.
      // If user provided coins, we could filter by them, but for now we scan top 30.

      console.log("High Potential Request Body:", req.body);

      if (req.body.debug) {
        console.log("Debug mode enabled, returning mock data");
        const results = technicalIndicators.getDebugHighPotentialCoins();
        return res.json({ data: results });
      }

      const results = await technicalIndicators.scanHighPotentialUser();
      res.json({ data: results });
    } catch (error) {
      console.error("Error fetching high potential coins:", error);
      res.status(500).json({ message: "Failed to fetch high potential coins" });
    }
  });

  // Market Data Routes
  app.get('/api/market/rsi', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const data = await technicalIndicators.getMarketRSI(limit);
      res.json(data);
    } catch (error) {
      console.error("Error fetching market RSI:", error);
      res.status(500).json({ message: "Failed to fetch market RSI data" });
    }
  });

  app.get('/api/market/strategies/trend-dip', async (req: Request, res: Response) => {
    console.log("[API] /api/market/strategies/trend-dip called");
    try {
      const data = await technicalIndicators.scanTrendDip();
      console.log(`[API] trend-dip success. Found ${data.length} items.`);
      res.json(data);
    } catch (error) {
      console.error("Error fetching trend-dip strategy:", error);
      res.status(500).json({ message: "Failed to fetch trend-dip strategy" });
    }
  });

  app.get('/api/market/strategies/volume-spike', async (req: Request, res: Response) => {
    try {
      const data = await technicalIndicators.scanVolumeSpike();
      res.json(data);
    } catch (error) {
      console.error("Error fetching volume-spike strategy:", error);
      res.status(500).json({ message: "Failed to fetch volume-spike strategy" });
    }
  });

  app.get('/api/market/strategies/support-resistance', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(String(req.query?.limit || "20"), 10);
      const days = parseInt(String(req.query?.days || "8"), 10);

      console.log(`[API routes.ts] /support-resistance called with limit=${limit}, days=${days}`);

      const data = await technicalIndicators.scanSupportResistance(limit, days);
      res.json(data);
    } catch (error) {
      console.error("Error fetching support-resistance strategy:", error);
      res.status(500).json({ message: "Failed to fetch support-resistance strategy" });
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
  return server;
}
