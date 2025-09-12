import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { binanceService } from "./services/binanceService";
import { technicalIndicators } from "./services/technicalIndicators";
import { aiService } from "./services/aiService";
import { portfolioService } from "./services/portfolioService";
import { insertPortfolioPositionSchema, insertWatchlistItemSchema, insertTradeTransactionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Enhanced Portfolio routes
  app.get('/api/portfolio', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summary = await portfolioService.getPortfolioSummary(userId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      res.status(500).json({ message: "Failed to fetch portfolio" });
    }
  });

  app.get('/api/portfolio/allocation', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const allocation = await portfolioService.getAssetAllocation(userId);
      res.json(allocation);
    } catch (error) {
      console.error("Error fetching asset allocation:", error);
      res.status(500).json({ message: "Failed to fetch asset allocation" });
    }
  });

  app.get('/api/portfolio/performance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const days = parseInt(req.query.days as string) || 30;
      const metrics = await portfolioService.getPerformanceMetrics(userId, days);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching performance metrics:", error);
      res.status(500).json({ message: "Failed to fetch performance metrics" });
    }
  });

  app.get('/api/portfolio/analytics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const analytics = await storage.getPortfolioAnalytics(userId, startDate, endDate);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching portfolio analytics:", error);
      res.status(500).json({ message: "Failed to fetch portfolio analytics" });
    }
  });

  app.get('/api/portfolio/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const gainers = await binanceService.getTopGainers();
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

  // Ticker data endpoint for charts
  app.get('/api/market/ticker/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const ticker = await binanceService.getTickerData(symbol);
      res.json(ticker);
    } catch (error) {
      console.error("Error fetching ticker data:", error);
      res.status(500).json({ message: "Failed to fetch ticker data" });
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
  app.post('/api/scanner/scan', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  app.post('/api/scanner/high-potential', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.get('/api/watchlist', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const watchlist = await storage.getWatchlist(userId);
      res.json(watchlist);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  app.post('/api/watchlist', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected to WebSocket');
    
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'subscribe') {
          // Handle subscription to price updates
          console.log('Client subscribed to:', data.symbol);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
  });

  // Broadcast price updates to connected clients
  setInterval(async () => {
    const clients = Array.from(wss.clients).filter(client => client.readyState === WebSocket.OPEN);
    if (clients.length > 0) {
      try {
        const btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
        const ethPrice = await binanceService.getCurrentPrice('ETHUSDT');
        
        const priceUpdate = {
          type: 'price_update',
          data: {
            BTCUSDT: btcPrice,
            ETHUSDT: ethPrice,
          }
        };

        clients.forEach(client => {
          client.send(JSON.stringify(priceUpdate));
        });
      } catch (error) {
        console.error('Error broadcasting price updates:', error);
      }
    }
  }, 5000);

  return httpServer;
}
