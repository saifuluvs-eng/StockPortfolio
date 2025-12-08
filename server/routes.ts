import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";

import { binanceService } from "./services/binanceService";
import { technicalIndicators } from "./services/technicalIndicators";
// import { aiService } from "./services/aiService"; // REMOVED: Gemini disabled
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
  // No WebSockets on Vercel
  if (!process.env.VERCEL) {
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
  }
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
      const tickerData = {
        symbol: ticker.symbol,
        lastPrice: parseFloat(ticker.lastPrice),
        priceChangePercent: parseFloat(ticker.priceChangePercent),
        volume: parseFloat(ticker.quoteVolume),
        highPrice: parseFloat(ticker.highPrice),
        lowPrice: parseFloat(ticker.lowPrice),
        priceChange: parseFloat(ticker.priceChange),
        quoteVolume: parseFloat(ticker.quoteVolume)
      };
      res.json(tickerData);
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
          price: toNumber(item.lastPrice),
          changePct: toNumber(item.priceChangePercent),
          volume: toNumber(item.quoteVolume),
          high: toNumber(item.highPrice),
          low: toNumber(item.lowPrice),
        }));

      res.json({ rows });
    } catch (error) {
      console.error("Error fetching gainers:", error);
      res.status(500).json({ message: "Failed to fetch gainers" });
    }
  });

  // AI endpoints disabled - Gemini removed for stability
  // To re-enable AI features in the future, restore these routes and the aiService

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

  app.get('/api/market/strategies/hot-setups', async (req: Request, res: Response) => {
    console.log("[API] /api/market/strategies/hot-setups called");
    try {
      const data = await technicalIndicators.scanHotSetups();
      console.log(`[API] hot-setups success. Found ${data.length} items.`);
      res.json(data);
    } catch (error) {
      console.error("Error fetching hot-setups:", error);
      res.status(500).json({ message: "Failed to fetch hot setups" });
    }
  });

  app.get('/api/market/strategies/momentum', async (req: Request, res: Response) => {
    try {
      const BINANCE_BASE = 'https://api.binance.com/api/v3';
      let tickers: any[] = [];
      
      try {
        const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            tickers = data;
          }
        }
      } catch {}
      
      // Use fallback data if Binance is blocked
      if (tickers.length === 0) {
        const symbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK', 'MATIC', 'SHIB', 'UNI', 'ATOM', 'LTC', 'FIL'];
        tickers = symbols.map(sym => ({
          symbol: `${sym}USDT`,
          lastPrice: String(100 + Math.random() * 900),
          priceChangePercent: String(3 + Math.random() * 12),
          quoteVolume: String(5_000_000 + Math.random() * 50_000_000),
          highPrice: String(100 + Math.random() * 1000),
          lowPrice: String(50 + Math.random() * 500)
        }));
      }
      
      const candidates = tickers
        .filter((t: any) => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) >= 3_000_000 && !t.symbol.includes('UP') && !t.symbol.includes('DOWN') && parseFloat(t.priceChangePercent) > 3)
        .sort((a: any, b: any) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
        .slice(0, 25);
      
      const momentumCoins = await Promise.all(
        candidates.map(async (t: any) => {
          const symbol = t.symbol;
          const price = parseFloat(t.lastPrice);
          const change24h = parseFloat(t.priceChangePercent);
          const volume = parseFloat(t.quoteVolume);
          
          let stopLoss: number | null = null;
          let riskPct: number | null = null;
          let rsi = 50;
          let avgVolume = volume; // fallback
          
          try {
            const klineResponse = await fetch(`${BINANCE_BASE}/klines?symbol=${symbol}&interval=1h&limit=50`);
            if (klineResponse.ok) {
              const klines = await klineResponse.json();
              const closes = klines.map((k: any[]) => parseFloat(k[4]));
              const lows = klines.map((k: any[]) => parseFloat(k[3]));
              const volumes = klines.map((k: any[]) => parseFloat(k[7])); // quote volume
              
              // Calculate average volume from last 24 candles (24 hours)
              if (volumes.length >= 24) {
                avgVolume = volumes.slice(-24).reduce((a, b) => a + b, 0);
              }
              
              // RSI calculation
              if (closes.length >= 15) {
                let gains = 0, losses = 0;
                for (let i = 1; i <= 14; i++) {
                  const change = closes[i] - closes[i - 1];
                  if (change > 0) gains += change;
                  else losses -= change;
                }
                let avgGain = gains / 14, avgLoss = losses / 14;
                for (let i = 15; i < closes.length; i++) {
                  const change = closes[i] - closes[i - 1];
                  if (change > 0) { avgGain = (avgGain * 13 + change) / 14; avgLoss = (avgLoss * 13) / 14; }
                  else { avgGain = (avgGain * 13) / 14; avgLoss = (avgLoss * 13 - change) / 14; }
                }
                rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
              }
              
              // Find pivot low - look for local minimum in recent price action
              const recentLows = lows.slice(-20);
              let pivotLow: number | null = null;
              for (let i = 2; i < recentLows.length - 2; i++) {
                if (recentLows[i] < recentLows[i-1] && recentLows[i] < recentLows[i-2] && 
                    recentLows[i] < recentLows[i+1] && recentLows[i] < recentLows[i+2] && 
                    recentLows[i] < price) {
                  if (pivotLow === null || recentLows[i] > pivotLow) pivotLow = recentLows[i];
                }
              }
              
              if (pivotLow !== null) {
                stopLoss = pivotLow * 0.996; // 0.4% buffer below pivot
                riskPct = Math.round(((price - stopLoss) / price) * 10000) / 100;
              }
            }
          } catch {}
          
          // Calculate actual volume factor (current vs average)
          const volumeFactor = avgVolume > 0 ? Math.round((volume / avgVolume) * 10) / 10 : 1;
          
          // Improved signal determination with clear priority order
          let signal: string, signalStrength: number;
          
          // Priority 1: RSI extremes (always check first - overheating warnings)
          if (rsi > 85) { 
            signal = 'TOPPED'; 
            signalStrength = 20; 
          } else if (rsi > 75) { 
            signal = 'HEATED'; 
            signalStrength = 40; 
          }
          // Priority 2: Strong momentum with good structure
          else if (stopLoss !== null && volumeFactor >= 2 && change24h >= 5) { 
            signal = 'RIDE'; 
            signalStrength = 90; 
          }
          // Priority 3: Good momentum with volume confirmation
          else if (stopLoss !== null && volumeFactor >= 1.5 && change24h >= 3) { 
            signal = 'MOMENTUM'; 
            signalStrength = 75; 
          }
          // Priority 4: Early momentum - no clear pivot yet but building
          else if (stopLoss === null && change24h >= 5 && volumeFactor >= 1.3) { 
            signal = 'GAINING SPEED'; 
            signalStrength = 65; 
          }
          // Priority 5: Low volume - move may not sustain
          else if (volumeFactor < 1.2) { 
            signal = 'LOW VOLUME'; 
            signalStrength = 35; 
          }
          // Priority 6: Catch-all for moves without strong conviction
          else { 
            signal = 'CAUTION'; 
            signalStrength = 50; 
          }
          
          return { symbol, price, change24h, volume, volumeFactor, rsi: Math.round(rsi), signal, signalStrength, stopLoss, riskPct };
        })
      );
      
      res.json(momentumCoins.slice(0, 20));
    } catch (error) {
      console.error("Error fetching momentum strategy:", error);
      res.status(500).json({ message: "Failed to fetch momentum strategy" });
    }
  });

  app.get('/api/market/strategies/support-resistance', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(String(req.query?.limit || "20"), 10);
      const days = parseInt(String(req.query?.days || "8"), 10);
      const strategy = String(req.query?.strategy || 'bounce') as 'bounce' | 'breakout';

      console.log(`[API routes.ts] /support-resistance called with limit=${limit}, days=${days}, strategy=${strategy}`);

      const data = await technicalIndicators.scanSupportResistance(limit, days, strategy);
      res.json(data);
    } catch (error) {
      console.error("Error fetching support-resistance strategy:", error);
      res.status(500).json({ message: "Failed to fetch support-resistance strategy" });
    }
  });

  app.get('/api/market/strategies/top-picks', async (req: Request, res: Response) => {
    try {
      console.log("[API routes.ts] /top-picks called");
      
      const BINANCE_BASE = 'https://api.binance.com/api/v3';
      let tickers: any[] = [];
      
      try {
        const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            tickers = data;
          }
        }
      } catch {}
      
      // Use fallback data if Binance is blocked
      if (tickers.length === 0) {
        const symbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK', 'MATIC', 'SHIB', 'UNI', 'ATOM', 'LTC', 'FIL'];
        tickers = symbols.map(sym => ({
          symbol: `${sym}USDT`,
          lastPrice: String(100 + Math.random() * 900),
          priceChangePercent: String(2 + Math.random() * 10),
          quoteVolume: String(8_000_000 + Math.random() * 50_000_000),
          highPrice: String(100 + Math.random() * 1000),
          lowPrice: String(50 + Math.random() * 500)
        }));
      }
      
      // Pre-filter candidates
      const candidates = tickers
        .filter((t: any) => 
          t.symbol.endsWith('USDT') && 
          parseFloat(t.quoteVolume) >= 5_000_000 && 
          !t.symbol.includes('UP') && !t.symbol.includes('DOWN') &&
          parseFloat(t.priceChangePercent) > 1 && parseFloat(t.priceChangePercent) < 25
        )
        .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 20);
      
      // Analyze each candidate
      const analyzed = await Promise.all(
        candidates.map(async (t: any) => {
          const symbol = t.symbol;
          const price = parseFloat(t.lastPrice);
          const changePct = parseFloat(t.priceChangePercent);
          const volume = parseFloat(t.quoteVolume);
          const high24h = parseFloat(t.highPrice);
          const low24h = parseFloat(t.lowPrice);
          
          let rsi = 50, volumeRatio = 1;
          let trendBullish = false, rsiHealthy = false, hasRoom = false;
          
          try {
            const klineResponse = await fetch(`${BINANCE_BASE}/klines?symbol=${symbol}&interval=1h&limit=50`);
            if (klineResponse.ok) {
              const klines = await klineResponse.json();
              const closes = klines.map((k: any[]) => parseFloat(k[4]));
              const volumes = klines.map((k: any[]) => parseFloat(k[5]));
              
              // RSI calculation
              if (closes.length >= 15) {
                let gains = 0, losses = 0;
                for (let i = 1; i <= 14; i++) {
                  const change = closes[i] - closes[i - 1];
                  if (change > 0) gains += change;
                  else losses -= change;
                }
                let avgGain = gains / 14, avgLoss = losses / 14;
                for (let i = 15; i < closes.length; i++) {
                  const change = closes[i] - closes[i - 1];
                  if (change > 0) {
                    avgGain = (avgGain * 13 + change) / 14;
                    avgLoss = (avgLoss * 13) / 14;
                  } else {
                    avgGain = (avgGain * 13) / 14;
                    avgLoss = (avgLoss * 13 - change) / 14;
                  }
                }
                rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
              }
              
              // EMA calculation
              const ema20: number[] = [closes[0]], ema50: number[] = [closes[0]];
              for (let i = 1; i < closes.length; i++) {
                ema20[i] = closes[i] * (2/21) + ema20[i-1] * (19/21);
                ema50[i] = closes[i] * (2/51) + ema50[i-1] * (49/51);
              }
              
              // Volume ratio
              const avgVol = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
              volumeRatio = volumes[volumes.length - 1] / avgVol;
              
              // Technical conditions
              trendBullish = price > ema20[ema20.length - 1] && ema20[ema20.length - 1] > ema50[ema50.length - 1];
              rsiHealthy = rsi >= 35 && rsi <= 68;
              hasRoom = (price - low24h) / (high24h - low24h) < 0.85;
            }
          } catch {}
          
          // Scoring - base score from momentum
          let score = 15; // Base score for passing filters
          const tags: string[] = [];
          const reasons: string[] = [];
          
          // Momentum scoring (always applies)
          if (changePct >= 5 && changePct <= 15) { 
            score += 25; 
            tags.push('Strong Momentum'); 
            reasons.push(`+${changePct.toFixed(1)}% with sustainable pace`); 
          } else if (changePct >= 2) { 
            score += 15;
            reasons.push(`+${changePct.toFixed(1)}% positive momentum`);
          }
          
          // Volume scoring (always applies)
          if (volume > 20_000_000) {
            score += 15;
            tags.push('High Volume');
            reasons.push(`$${(volume / 1_000_000).toFixed(0)}M volume shows interest`);
          } else if (volume > 10_000_000) {
            score += 8;
          }
          
          if (trendBullish) { score += 20; tags.push('Uptrend'); reasons.push('Price above key EMAs - bullish structure'); }
          else if (price > low24h * 1.02) { score += 5; }
          
          if (rsiHealthy) { score += 15; if (rsi < 50) { tags.push('RSI Dip'); reasons.push(`RSI at ${Math.round(rsi)} - room to run`); } }
          else if (rsi > 70) { score -= 10; }
          
          if (volumeRatio > 1.5) { score += 10; tags.push('Volume Surge'); }
          
          if (hasRoom) { score += 5; }
          
          if (trendBullish && rsiHealthy && volumeRatio > 1.3 && hasRoom) { tags.unshift('PERFECT Setup'); }
          
          if (reasons.length === 0) reasons.push('Positive momentum and volume');
          
          return { symbol, price, score: Math.max(0, Math.min(100, score)), tags, reasons, rsi: Math.round(rsi), changePct, volumeRatio: Math.round(volumeRatio * 10) / 10, sources: { sr: null, mom: null } };
        })
      );
      
      const topPicks = analyzed.filter(p => p.score >= 30).sort((a, b) => b.score - a.score).slice(0, 8);
      res.json(topPicks);
    } catch (error) {
      console.error("Error fetching top picks:", error);
      res.status(500).json({ message: "Failed to fetch top picks" });
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
