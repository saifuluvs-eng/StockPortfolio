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
  integer,
  real,
  unique,
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
}, (table) => [
  index("IDX_portfolio_user").on(table.userId),
]);

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
}, (table) => [
  index("IDX_watchlist_user_symbol").on(table.userId, table.symbol),
  unique("UQ_watchlist_user_symbol").on(table.userId, table.symbol),
]);

// Trade transactions for detailed P&L tracking
export const tradeTransactions = pgTable("trade_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol: varchar("symbol").notNull(),
  side: varchar("side").notNull(), // "buy" or "sell"
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  price: decimal("price", { precision: 18, scale: 8 }).notNull(),
  fee: decimal("fee", { precision: 18, scale: 8 }).default('0'),
  feeAsset: varchar("fee_asset").default('USDT'),
  tradeId: varchar("trade_id"), // External trade ID from exchange
  executedAt: timestamp("executed_at").notNull(), // Exchange execution time
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_trades_user_symbol_time").on(table.userId, table.symbol, table.executedAt),
  index("IDX_trades_user_time").on(table.userId, table.executedAt),
  index("IDX_trades_user_trade_id").on(table.userId, table.tradeId),
  unique("UQ_trades_user_trade_id").on(table.userId, table.tradeId),
]);

// Technical indicators cache for performance
export const technicalIndicators = pgTable("technical_indicators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  timeframe: varchar("timeframe").notNull(), // "1m", "5m", "15m", "1h", "4h", "1d"
  indicatorType: varchar("indicator_type").notNull(), // "rsi", "macd", "bb", "ema", etc.
  value: decimal("value", { precision: 18, scale: 8 }),
  metadata: jsonb("metadata"), // Additional indicator data (upper/lower bounds, signals, etc.)
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_indicators_composite").on(table.symbol, table.timeframe, table.indicatorType, table.timestamp),
  index("IDX_indicators_latest").on(table.symbol, table.timeframe, table.indicatorType),
  unique("UQ_indicators_unique").on(table.symbol, table.timeframe, table.indicatorType, table.timestamp),
]);

// Smart alerts and notifications
export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol: varchar("symbol").notNull(),
  alertType: varchar("alert_type").notNull(), // "price", "volume", "technical", "ai_signal"
  condition: jsonb("condition").notNull(), // Alert trigger conditions
  message: text("message").notNull(),
  isActive: boolean("is_active").default(true),
  triggered: boolean("triggered").default(false),
  triggerCount: integer("trigger_count").default(0),
  lastTriggered: timestamp("last_triggered"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_alerts_user_active").on(table.userId, table.isActive),
  index("IDX_alerts_user_symbol").on(table.userId, table.symbol, table.isActive),
]);

// AI analysis results storage
export const aiAnalysis = pgTable("ai_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  symbol: varchar("symbol").notNull(),
  analysisType: varchar("analysis_type").notNull(), // "sentiment", "pattern", "prediction", "recommendation"
  confidence: real("confidence"), // 0.0 to 1.0
  signal: varchar("signal"), // "bullish", "bearish", "neutral"
  reasoning: text("reasoning"),
  metadata: jsonb("metadata"), // Full AI response data
  timeframe: varchar("timeframe"),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_ai_analysis_symbol").on(table.symbol),
  index("IDX_ai_analysis_user").on(table.userId, table.symbol, table.timeframe),
  index("IDX_ai_analysis_validity").on(table.validUntil),
]);

// Market data cache for performance
export const marketData = pgTable("market_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  price: decimal("price", { precision: 18, scale: 8 }).notNull(),
  volume24h: decimal("volume_24h", { precision: 18, scale: 2 }),
  priceChange24h: decimal("price_change_24h", { precision: 18, scale: 8 }),
  priceChangePercent24h: real("price_change_percent_24h"),
  high24h: decimal("high_24h", { precision: 18, scale: 8 }),
  low24h: decimal("low_24h", { precision: 18, scale: 8 }),
  marketCap: decimal("market_cap", { precision: 18, scale: 2 }),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_market_data_symbol").on(table.symbol),
  index("IDX_market_data_updated").on(table.updatedAt),
  unique("UQ_market_data_symbol").on(table.symbol),
]);

// Scan presets for saved scanning configurations
export const scanPresets = pgTable("scan_presets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  description: text("description"),
  scanType: varchar("scan_type").notNull(), // "custom", "high_potential", "reversal"
  filters: jsonb("filters").notNull(),
  isPublic: boolean("is_public").default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Performance analytics for portfolio tracking
export const portfolioAnalytics = pgTable("portfolio_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  totalValue: decimal("total_value", { precision: 18, scale: 2 }).notNull(),
  totalPnl: decimal("total_pnl", { precision: 18, scale: 2 }).notNull(),
  totalPnlPercent: real("total_pnl_percent").notNull(),
  dayChange: decimal("day_change", { precision: 18, scale: 2 }),
  dayChangePercent: real("day_change_percent"),
  positions: jsonb("positions"), // Snapshot of positions
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_portfolio_analytics_user_date").on(table.userId, table.date),
  unique("UQ_portfolio_analytics_user_date").on(table.userId, table.date),
]);

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertPortfolioPosition = typeof portfolioPositions.$inferInsert;
export type PortfolioPosition = typeof portfolioPositions.$inferSelect;

export type InsertScanHistory = typeof scanHistory.$inferInsert;
export type ScanHistory = typeof scanHistory.$inferSelect;

export type InsertWatchlistItem = typeof watchlist.$inferInsert;
export type WatchlistItem = typeof watchlist.$inferSelect;

// Enhanced trading types
export type InsertTradeTransaction = typeof tradeTransactions.$inferInsert;
export type TradeTransaction = typeof tradeTransactions.$inferSelect;

export type InsertTechnicalIndicator = typeof technicalIndicators.$inferInsert;
export type TechnicalIndicator = typeof technicalIndicators.$inferSelect;

export type InsertAlert = typeof alerts.$inferInsert;
export type Alert = typeof alerts.$inferSelect;

export type InsertAiAnalysis = typeof aiAnalysis.$inferInsert;
export type AiAnalysis = typeof aiAnalysis.$inferSelect;

export type InsertMarketData = typeof marketData.$inferInsert;
export type MarketData = typeof marketData.$inferSelect;

export type InsertScanPreset = typeof scanPresets.$inferInsert;
export type ScanPreset = typeof scanPresets.$inferSelect;

export type InsertPortfolioAnalytics = typeof portfolioAnalytics.$inferInsert;
export type PortfolioAnalytics = typeof portfolioAnalytics.$inferSelect;

// Zod schemas for validation
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

export const insertTradeTransactionSchema = createInsertSchema(tradeTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertTechnicalIndicatorSchema = createInsertSchema(technicalIndicators).omit({
  id: true,
  createdAt: true,
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  createdAt: true,
  lastTriggered: true,
});

export const insertAiAnalysisSchema = createInsertSchema(aiAnalysis).omit({
  id: true,
  createdAt: true,
});

export const insertMarketDataSchema = createInsertSchema(marketData).omit({
  id: true,
  updatedAt: true,
});

export const insertScanPresetSchema = createInsertSchema(scanPresets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
});

export const insertPortfolioAnalyticsSchema = createInsertSchema(portfolioAnalytics).omit({
  id: true,
  createdAt: true,
});
