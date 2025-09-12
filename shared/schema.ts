import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  decimal,
  text,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - mandatory for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Portfolio positions
export const portfolioPositions = pgTable("portfolio_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol: varchar("symbol").notNull(), // e.g., "BTCUSDT"
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 18, scale: 8 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Scan history
export const scanHistory = pgTable("scan_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scanType: varchar("scan_type").notNull(), // "custom", "high_potential", "gainers"
  filters: jsonb("filters"),
  results: jsonb("results"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Watchlist
export const watchlist = pgTable("watchlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol: varchar("symbol").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertPortfolioPosition = typeof portfolioPositions.$inferInsert;
export type PortfolioPosition = typeof portfolioPositions.$inferSelect;

export type InsertScanHistory = typeof scanHistory.$inferInsert;
export type ScanHistory = typeof scanHistory.$inferSelect;

export type InsertWatchlistItem = typeof watchlist.$inferInsert;
export type WatchlistItem = typeof watchlist.$inferSelect;

export const insertPortfolioPositionSchema = createInsertSchema(portfolioPositions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScanHistorySchema = createInsertSchema(scanHistory).omit({
  id: true,
  createdAt: true,
});

export const insertWatchlistItemSchema = createInsertSchema(watchlist).omit({
  id: true,
  createdAt: true,
});
