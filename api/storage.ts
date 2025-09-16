import {
  users,
  portfolioPositions,
  scanHistory,
  watchlist,
  aiAnalysis,
  tradeTransactions,
  portfolioAnalytics,
  marketData,
  type User,
  type UpsertUser,
  type PortfolioPosition,
  type InsertPortfolioPosition,
  type ScanHistory,
  type InsertScanHistory,
  type WatchlistItem,
  type InsertWatchlistItem,
  type AiAnalysis,
  type InsertAiAnalysis,
  type TradeTransaction,
  type InsertTradeTransaction,
  type PortfolioAnalytics,
  type InsertPortfolioAnalytics,
  type MarketData,
  type InsertMarketData,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Portfolio operations
  getPortfolioPositions(userId: string): Promise<PortfolioPosition[]>;
  createPortfolioPosition(position: InsertPortfolioPosition): Promise<PortfolioPosition>;
  updatePortfolioPosition(id: string, userId: string, position: Partial<InsertPortfolioPosition>): Promise<PortfolioPosition | null>;
  deletePortfolioPosition(id: string, userId: string): Promise<boolean>;
  
  // Trade transaction operations
  getTradeTransactions(userId: string, symbol?: string): Promise<TradeTransaction[]>;
  createTradeTransaction(transaction: InsertTradeTransaction): Promise<TradeTransaction>;
  getTradeTransactionsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<TradeTransaction[]>;
  
  // Portfolio analytics operations
  getPortfolioAnalytics(userId: string, startDate?: Date, endDate?: Date): Promise<PortfolioAnalytics[]>;
  createPortfolioAnalytics(analytics: InsertPortfolioAnalytics): Promise<PortfolioAnalytics>;
  getLatestPortfolioAnalytics(userId: string): Promise<PortfolioAnalytics | null>;
  
  // Market data operations
  getMarketData(symbols: string[]): Promise<MarketData[]>;
  upsertMarketData(marketData: InsertMarketData): Promise<MarketData>;
  
  // Scan history operations
  createScanHistory(scan: InsertScanHistory): Promise<ScanHistory>;
  getScanHistory(userId: string, scanType?: string): Promise<ScanHistory[]>;
  
  // Watchlist operations
  getWatchlist(userId: string): Promise<WatchlistItem[]>;
  addToWatchlist(item: InsertWatchlistItem): Promise<WatchlistItem>;
  removeFromWatchlist(userId: string, symbol: string): Promise<boolean>;
  
  // AI Analysis operations
  createAiAnalysis(analysis: InsertAiAnalysis): Promise<AiAnalysis>;
  getAiAnalysis(userId?: string, symbol?: string, analysisType?: string): Promise<AiAnalysis[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Portfolio operations
  async getPortfolioPositions(userId: string): Promise<PortfolioPosition[]> {
    return await db
      .select()
      .from(portfolioPositions)
      .where(eq(portfolioPositions.userId, userId))
      .orderBy(desc(portfolioPositions.createdAt));
  }

  async createPortfolioPosition(position: InsertPortfolioPosition): Promise<PortfolioPosition> {
    const [newPosition] = await db
      .insert(portfolioPositions)
      .values(position)
      .returning();
    return newPosition;
  }

  async updatePortfolioPosition(id: string, userId: string, position: Partial<InsertPortfolioPosition>): Promise<PortfolioPosition | null> {
    const [updatedPosition] = await db
      .update(portfolioPositions)
      .set({ ...position, updatedAt: new Date() })
      .where(and(
        eq(portfolioPositions.id, id),
        eq(portfolioPositions.userId, userId)
      ))
      .returning();
    return updatedPosition || null;
  }

  async deletePortfolioPosition(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(portfolioPositions)
      .where(and(
        eq(portfolioPositions.id, id),
        eq(portfolioPositions.userId, userId)
      ));
    return (result.changes ?? 0) > 0;
  }

  // Scan history operations
  async createScanHistory(scan: InsertScanHistory): Promise<ScanHistory> {
    const [newScan] = await db
      .insert(scanHistory)
      .values(scan)
      .returning();
    return newScan;
  }

  async getScanHistory(userId: string, scanType?: string): Promise<ScanHistory[]> {
    const conditions = [eq(scanHistory.userId, userId)];
    if (scanType) {
      conditions.push(eq(scanHistory.scanType, scanType));
    }
    
    return await db
      .select()
      .from(scanHistory)
      .where(and(...conditions))
      .orderBy(desc(scanHistory.createdAt))
      .limit(50);
  }

  // Watchlist operations
  async getWatchlist(userId: string): Promise<WatchlistItem[]> {
    return await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, userId))
      .orderBy(desc(watchlist.createdAt));
  }

  async addToWatchlist(item: InsertWatchlistItem): Promise<WatchlistItem> {
    const [newItem] = await db
      .insert(watchlist)
      .values(item)
      .returning();
    return newItem;
  }

  async removeFromWatchlist(userId: string, symbol: string): Promise<boolean> {
    const result = await db
      .delete(watchlist)
      .where(and(
        eq(watchlist.userId, userId),
        eq(watchlist.symbol, symbol)
      ));
    return (result.changes ?? 0) > 0;
  }

  // Trade transaction operations
  async getTradeTransactions(userId: string, symbol?: string): Promise<TradeTransaction[]> {
    const conditions = [eq(tradeTransactions.userId, userId)];
    if (symbol) {
      conditions.push(eq(tradeTransactions.symbol, symbol));
    }
    
    return await db
      .select()
      .from(tradeTransactions)
      .where(and(...conditions))
      .orderBy(desc(tradeTransactions.executedAt));
  }

  async createTradeTransaction(transaction: InsertTradeTransaction): Promise<TradeTransaction> {
    const [newTransaction] = await db
      .insert(tradeTransactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async getTradeTransactionsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<TradeTransaction[]> {
    return await db
      .select()
      .from(tradeTransactions)
      .where(and(
        eq(tradeTransactions.userId, userId),
        gte(tradeTransactions.executedAt, startDate),
        lte(tradeTransactions.executedAt, endDate)
      ))
      .orderBy(desc(tradeTransactions.executedAt));
  }

  // Portfolio analytics operations
  async getPortfolioAnalytics(userId: string, startDate?: Date, endDate?: Date): Promise<PortfolioAnalytics[]> {
    const conditions = [eq(portfolioAnalytics.userId, userId)];
    
    if (startDate) {
      conditions.push(gte(portfolioAnalytics.date, startDate));
    }
    if (endDate) {
      conditions.push(lte(portfolioAnalytics.date, endDate));
    }
    
    return await db
      .select()
      .from(portfolioAnalytics)
      .where(and(...conditions))
      .orderBy(desc(portfolioAnalytics.date));
  }

  async createPortfolioAnalytics(analytics: InsertPortfolioAnalytics): Promise<PortfolioAnalytics> {
    const [newAnalytics] = await db
      .insert(portfolioAnalytics)
      .values(analytics)
      .returning();
    return newAnalytics;
  }

  async getLatestPortfolioAnalytics(userId: string): Promise<PortfolioAnalytics | null> {
    const [latest] = await db
      .select()
      .from(portfolioAnalytics)
      .where(eq(portfolioAnalytics.userId, userId))
      .orderBy(desc(portfolioAnalytics.date))
      .limit(1);
    return latest || null;
  }

  // Market data operations
  async getMarketData(symbols: string[]): Promise<MarketData[]> {
    return await db
      .select()
      .from(marketData)
      .where(
        symbols.length > 0 
          ? eq(marketData.symbol, symbols[0]) // Simple implementation for now
          : undefined
      );
  }

  async upsertMarketData(data: InsertMarketData): Promise<MarketData> {
    const [upsertedData] = await db
      .insert(marketData)
      .values(data)
      .onConflictDoUpdate({
        target: marketData.symbol,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upsertedData;
  }

  // AI Analysis operations
  async createAiAnalysis(analysis: InsertAiAnalysis): Promise<AiAnalysis> {
    const [newAnalysis] = await db
      .insert(aiAnalysis)
      .values(analysis)
      .returning();
    return newAnalysis;
  }

  async getAiAnalysis(userId?: string, symbol?: string, analysisType?: string): Promise<AiAnalysis[]> {
    const conditions = [];
    
    if (userId) {
      conditions.push(eq(aiAnalysis.userId, userId));
    }
    if (symbol) {
      conditions.push(eq(aiAnalysis.symbol, symbol));
    }
    if (analysisType) {
      conditions.push(eq(aiAnalysis.analysisType, analysisType));
    }
    
    return await db
      .select()
      .from(aiAnalysis)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(aiAnalysis.createdAt))
      .limit(50);
  }
}

export const storage = new DatabaseStorage();
