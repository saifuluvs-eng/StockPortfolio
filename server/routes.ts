import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { binanceService } from "./services/binanceService";
import { technicalIndicators } from "./services/technicalIndicators";
import { insertPortfolioPositionSchema, insertWatchlistItemSchema } from "@shared/schema";
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

  // Portfolio routes
  app.get('/api/portfolio', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const positions = await storage.getPortfolioPositions(userId);
      
      // Calculate P&L for each position
      const positionsWithPnL = await Promise.all(
        positions.map(async (position) => {
          let currentPrice: number;
          const entryPrice = parseFloat(position.entryPrice);
          
          try {
            currentPrice = await binanceService.getCurrentPrice(position.symbol);
          } catch (error) {
            console.warn(`Failed to fetch current price for ${position.symbol}, using entry price as fallback:`, error);
            currentPrice = entryPrice; // Fallback to entry price if API fails
          }
          
          const quantity = parseFloat(position.quantity);
          const currentValue = currentPrice * quantity;
          const entryValue = entryPrice * quantity;
          const pnl = currentValue - entryValue;
          const pnlPercent = entryValue > 0 ? (pnl / entryValue) * 100 : 0;

          return {
            ...position,
            currentPrice,
            currentValue,
            pnl,
            pnlPercent,
          };
        })
      );

      res.json(positionsWithPnL);
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      res.status(500).json({ message: "Failed to fetch portfolio" });
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
