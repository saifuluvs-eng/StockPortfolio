import {
  users,
  portfolioPositions,
  scanHistory,
  watchlist,
  type User,
  type UpsertUser,
  type PortfolioPosition,
  type InsertPortfolioPosition,
  type ScanHistory,
  type InsertScanHistory,
  type WatchlistItem,
  type InsertWatchlistItem,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Portfolio operations
  getPortfolioPositions(userId: string): Promise<PortfolioPosition[]>;
  createPortfolioPosition(position: InsertPortfolioPosition): Promise<PortfolioPosition>;
  updatePortfolioPosition(id: string, userId: string, position: Partial<InsertPortfolioPosition>): Promise<PortfolioPosition | null>;
  deletePortfolioPosition(id: string, userId: string): Promise<boolean>;
  
  // Scan history operations
  createScanHistory(scan: InsertScanHistory): Promise<ScanHistory>;
  getScanHistory(userId: string, scanType?: string): Promise<ScanHistory[]>;
  
  // Watchlist operations
  getWatchlist(userId: string): Promise<WatchlistItem[]>;
  addToWatchlist(item: InsertWatchlistItem): Promise<WatchlistItem>;
  removeFromWatchlist(userId: string, symbol: string): Promise<boolean>;
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
    return (result.rowCount ?? 0) > 0;
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
    return (result.rowCount ?? 0) > 0;
  }
}

export const storage = new DatabaseStorage();
