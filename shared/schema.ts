import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  text,
  timestamp,
  doublePrecision,
  boolean,
  unique,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

// Portfolio positions
export const portfolioPositions = pgTable("portfolio_positions", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id").notNull(),
  symbol: text("symbol").notNull(), // e.g., "BTCUSDT"
  quantity: doublePrecision("quantity").notNull(),
  entryPrice: doublePrecision("entry_price").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_portfolio_user").on(table.userId),
  unique("UQ_portfolio_user_symbol").on(table.userId, table.symbol),
]);

// Scan history
export const scanHistory = pgTable("scan_history", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id").notNull(),
  scanType: text("scan_type").notNull(), // "custom", "high_potential", "gainers"
  filters: jsonb("filters"),
  results: jsonb("results"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Watchlist
export const watchlist = pgTable("watchlist", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id").notNull(),
  symbol: text("symbol").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_watchlist_user_symbol").on(table.userId, table.symbol),
  unique("UQ_watchlist_user_symbol").on(table.userId, table.symbol),
]);

// Trade transactions for detailed P&L tracking
export const tradeTransactions = pgTable("trade_transactions", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id").notNull(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // "buy" or "sell"
  quantity: doublePrecision("quantity").notNull(),
  price: doublePrecision("price").notNull(),
  fee: doublePrecision("fee").default(0),
  feeAsset: text("fee_asset").default('USDT'),
  tradeId: text("trade_id"), // External trade ID from exchange
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
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(), // "1m", "5m", "15m", "1h", "4h", "1d"
  indicatorType: text("indicator_type").notNull(), // "rsi", "macd", "bb", "ema", etc.
  value: doublePrecision("value"),
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
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id").notNull(),
  symbol: text("symbol").notNull(),
  alertType: text("alert_type").notNull(), // "price", "volume", "technical", "ai_signal"
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
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id"),
  symbol: text("symbol").notNull(),
  analysisType: text("analysis_type").notNull(), // "sentiment", "pattern", "prediction", "recommendation"
  confidence: doublePrecision("confidence"), // 0.0 to 1.0
  signal: text("signal"), // "bullish", "bearish", "neutral"
  reasoning: text("reasoning"),
  metadata: jsonb("metadata"), // Full AI response data
  timeframe: text("timeframe"),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_ai_analysis_symbol").on(table.symbol),
  index("IDX_ai_analysis_user").on(table.userId, table.symbol, table.timeframe),
  index("IDX_ai_analysis_validity").on(table.validUntil),
]);

// Market data cache for performance
export const marketData = pgTable("market_data", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  symbol: text("symbol").notNull(),
  price: doublePrecision("price").notNull(),
  volume24h: doublePrecision("volume_24h"),
  priceChange24h: doublePrecision("price_change_24h"),
  priceChangePercent24h: doublePrecision("price_change_percent_24h"),
  high24h: doublePrecision("high_24h"),
  low24h: doublePrecision("low_24h"),
  marketCap: doublePrecision("market_cap"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_market_data_symbol").on(table.symbol),
  index("IDX_market_data_updated").on(table.updatedAt),
  unique("UQ_market_data_symbol").on(table.symbol),
]);

// Scan presets for saved scanning configurations
export const scanPresets = pgTable("scan_presets", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  scanType: text("scan_type").notNull(), // "custom", "high_potential", "reversal"
  filters: jsonb("filters").notNull(),
  isPublic: boolean("is_public").default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Performance analytics for portfolio tracking
export const portfolioAnalytics = pgTable("portfolio_analytics", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull(),
  totalValue: doublePrecision("total_value").notNull(),
  totalPnl: doublePrecision("total_pnl").notNull(),
  totalPnlPercent: doublePrecision("total_pnl_percent").notNull(),
  dayChange: doublePrecision("day_change"),
  dayChangePercent: doublePrecision("day_change_percent"),
  positions: jsonb("positions"), // Snapshot of positions
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_portfolio_analytics_user_date").on(table.userId, table.date),
  unique("UQ_portfolio_analytics_user_date").on(table.userId, table.date),
]);

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
