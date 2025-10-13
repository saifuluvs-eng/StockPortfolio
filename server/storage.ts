import {
  portfolioPositions,
  scanHistory,
  watchlist,
  aiAnalysis,
  tradeTransactions,
  portfolioAnalytics,
  marketData,
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
import { firestore as adminFirestore } from "./firebaseAdmin";
import { Timestamp, type DocumentData, type DocumentSnapshot } from "firebase-admin/firestore";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";
export interface User extends Record<string, unknown> {
  id: string;
  email?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface UpsertUser extends Record<string, unknown> {
  id: string;
  email?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

const usersCollection = adminFirestore.collection("users");

function mapTimestamp(value: unknown): Date | null | undefined {
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number") {
    return new Date(value);
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : new Date(parsed);
  }

  return undefined;
}

function mapUserSnapshot(snapshot: DocumentSnapshot<DocumentData>): User | undefined {
  if (!snapshot.exists) {
    return undefined;
  }

  const data = snapshot.data() ?? {};
  const { createdAt: rawCreatedAt, updatedAt: rawUpdatedAt, photoURL, ...rest } = data;
  const createdAt = mapTimestamp(rawCreatedAt) ?? null;
  const updatedAt = mapTimestamp(rawUpdatedAt) ?? null;

  return {
    ...rest,
    id: snapshot.id,
    email: typeof data.email === "string" ? data.email : null,
    displayName: typeof data.displayName === "string" ? data.displayName : null,
    firstName: typeof data.firstName === "string" ? data.firstName : null,
    lastName: typeof data.lastName === "string" ? data.lastName : null,
    profileImageUrl:
      typeof data.profileImageUrl === "string"
        ? data.profileImageUrl
        : typeof photoURL === "string"
          ? photoURL
          : null,
    createdAt,
    updatedAt,
  } satisfies User;
}

function buildUserPayload(userData: UpsertUser): Record<string, unknown> {
  const { id: _id, ...rest } = userData;
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) {
      payload[key] = value;
    }
  }

  return payload;
}

export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Portfolio operations
  getPortfolioPositions(userId: string): Promise<PortfolioPosition[]>;
  createPortfolioPosition(position: InsertPortfolioPosition): Promise<PortfolioPosition>;
  upsertPortfolioPosition(
    userId: string,
    position: {
      symbol: string;
      quantity: number;
      entryPrice: number;
      notes?: string | null;
    },
  ): Promise<PortfolioPosition>;
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
    const snapshot = await usersCollection.doc(id).get();
    return mapUserSnapshot(snapshot);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const docRef = usersCollection.doc(userData.id);
    const existing = await docRef.get();
    const payload = buildUserPayload(userData);
    const now = Timestamp.now();

    payload.updatedAt = now;

    if (!existing.exists || !existing.data()?.createdAt) {
      payload.createdAt = now;
    }

    await docRef.set(payload, { merge: true });

    const snapshot = await docRef.get();
    const user = mapUserSnapshot(snapshot);

    if (!user) {
      throw new Error(`Failed to persist user profile for ${userData.id}`);
    }
    return user;
  }

  // Portfolio operations
  async getPortfolioPositions(userId: string): Promise<PortfolioPosition[]> {
    return await db
      .select()
      .from(portfolioPositions)
      .where(eq(portfolioPositions.userId, userId))
      .orderBy(desc(portfolioPositions.updatedAt), desc(portfolioPositions.createdAt));
  }

  async createPortfolioPosition(position: InsertPortfolioPosition): Promise<PortfolioPosition> {
    const [newPosition] = await db
      .insert(portfolioPositions)
      .values(position)
      .returning();
    return newPosition;
  }

  async upsertPortfolioPosition(
    userId: string,
    position: { symbol: string; quantity: number; entryPrice: number; notes?: string | null },
  ): Promise<PortfolioPosition> {
    const normalizedSymbol = position.symbol.trim().toUpperCase();
    const normalizedNotes = position.notes === undefined ? undefined : position.notes ?? null;

    const [record] = await db
      .insert(portfolioPositions)
      .values({
        userId,
        symbol: normalizedSymbol,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        notes: normalizedNotes,
      })
      .onConflictDoUpdate({
        target: [portfolioPositions.userId, portfolioPositions.symbol],
        set: {
          quantity: position.quantity,
          entryPrice: position.entryPrice,
          notes: normalizedNotes,
          updatedAt: new Date(),
        },
      })
      .returning();

    return record;
  }

  async updatePortfolioPosition(id: string, userId: string, position: Partial<InsertPortfolioPosition>): Promise<PortfolioPosition | null> {
    const payload: Partial<InsertPortfolioPosition> & { updatedAt?: Date | null } = { ...position };
    if (payload.notes === undefined) {
      // do nothing; keep existing value
    } else {
      payload.notes = payload.notes ?? null;
    }

    const [updatedPosition] = await db
      .update(portfolioPositions)
      .set({ ...payload, updatedAt: new Date() })
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
    if (symbols.length === 0) {
      return [];
    }
    return await db
      .select()
      .from(marketData)
      .where(inArray(marketData.symbol, symbols));
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
