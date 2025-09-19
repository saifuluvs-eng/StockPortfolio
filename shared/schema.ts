import { sql } from 'drizzle-orm';
import {
  index,
  sqliteTable,
  text,
  integer,
  real,
  unique,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { v4 as uuidv4 } from 'uuid';

// Portfolio positions
export const portfolioPositions = sqliteTable("portfolio_positions", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id").notNull(),
  symbol: text("symbol").notNull(), // e.g., "BTCUSDT"
  quantity: real("quantity").notNull(),
  entryPrice: real("entry_price").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("IDX_portfolio_user").on(table.userId),
]);

// Scan history
export const scanHistory = sqliteTable("scan_history", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id").notNull(),
  scanType: text("scan_type").notNull(), // "custom", "high_potential", "gainers"
  filters: text("filters", { mode: 'json' }),
  results: text("results", { mode: 'json' }),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Watchlist
export const watchlist = sqliteTable("watchlist", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id").notNull(),
  symbol: text("symbol").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("IDX_watchlist_user_symbol").on(table.userId, table.symbol),
  unique("UQ_watchlist_user_symbol").on(table.userId, table.symbol),
]);

// Trade transactions for detailed P&L tracking
export const tradeTransactions = sqliteTable("trade_transactions", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id").notNull(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // "buy" or "sell"
  quantity: real("quantity").notNull(),
  price: real("price").notNull(),
  fee: real("fee").default(0),
  feeAsset: text("fee_asset").default('USDT'),
  tradeId: text("trade_id"), // External trade ID from exchange
  executedAt: integer("executed_at", { mode: 'timestamp' }).notNull(), // Exchange execution time
  notes: text("notes"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("IDX_trades_user_symbol_time").on(table.userId, table.symbol, table.executedAt),
  index("IDX_trades_user_time").on(table.userId, table.executedAt),
  index("IDX_trades_user_trade_id").on(table.userId, table.tradeId),
  unique("UQ_trades_user_trade_id").on(table.userId, table.tradeId),
]);

// Technical indicators cache for performance
export const technicalIndicators = sqliteTable("technical_indicators", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(), // "1m", "5m", "15m", "1h", "4h", "1d"
  indicatorType: text("indicator_type").notNull(), // "rsi", "macd", "bb", "ema", etc.
  value: real("value"),
  metadata: text("metadata", { mode: 'json' }), // Additional indicator data (upper/lower bounds, signals, etc.)
  timestamp: integer("timestamp", { mode: 'timestamp' }).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("IDX_indicators_composite").on(table.symbol, table.timeframe, table.indicatorType, table.timestamp),
  index("IDX_indicators_latest").on(table.symbol, table.timeframe, table.indicatorType),
  unique("UQ_indicators_unique").on(table.symbol, table.timeframe, table.indicatorType, table.timestamp),
]);

// Smart alerts and notifications
export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id").notNull(),
  symbol: text("symbol").notNull(),
  alertType: text("alert_type").notNull(), // "price", "volume", "technical", "ai_signal"
  condition: text("condition", { mode: 'json' }).notNull(), // Alert trigger conditions
  message: text("message").notNull(),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  triggered: integer("triggered", { mode: 'boolean' }).default(false),
  triggerCount: integer("trigger_count").default(0),
  lastTriggered: integer("last_triggered", { mode: 'timestamp' }),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("IDX_alerts_user_active").on(table.userId, table.isActive),
  index("IDX_alerts_user_symbol").on(table.userId, table.symbol, table.isActive),
]);

// AI analysis results storage
export const aiAnalysis = sqliteTable("ai_analysis", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id"),
  symbol: text("symbol").notNull(),
  analysisType: text("analysis_type").notNull(), // "sentiment", "pattern", "prediction", "recommendation"
  confidence: real("confidence"), // 0.0 to 1.0
  signal: text("signal"), // "bullish", "bearish", "neutral"
  reasoning: text("reasoning"),
  metadata: text("metadata", { mode: 'json' }), // Full AI response data
  timeframe: text("timeframe"),
  validUntil: integer("valid_until", { mode: 'timestamp' }),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("IDX_ai_analysis_symbol").on(table.symbol),
  index("IDX_ai_analysis_user").on(table.userId, table.symbol, table.timeframe),
  index("IDX_ai_analysis_validity").on(table.validUntil),
]);

// Market data cache for performance
export const marketData = sqliteTable("market_data", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  symbol: text("symbol").notNull(),
  price: real("price").notNull(),
  volume24h: real("volume_24h"),
  priceChange24h: real("price_change_24h"),
  priceChangePercent24h: real("price_change_percent_24h"),
  high24h: real("high_24h"),
  low24h: real("low_24h"),
  marketCap: real("market_cap"),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("IDX_market_data_symbol").on(table.symbol),
  index("IDX_market_data_updated").on(table.updatedAt),
  unique("UQ_market_data_symbol").on(table.symbol),
]);

// Scan presets for saved scanning configurations
export const scanPresets = sqliteTable("scan_presets", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  scanType: text("scan_type").notNull(), // "custom", "high_potential", "reversal"
  filters: text("filters", { mode: 'json' }).notNull(),
  isPublic: integer("is_public", { mode: 'boolean' }).default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Performance analytics for portfolio tracking
export const portfolioAnalytics = sqliteTable("portfolio_analytics", {
  id: text("id").primaryKey().$defaultFn(() => uuidv4()),
  userId: text("user_id").notNull(),
  date: integer("date", { mode: 'timestamp' }).notNull(),
  totalValue: real("total_value").notNull(),
  totalPnl: real("total_pnl").notNull(),
  totalPnlPercent: real("total_pnl_percent").notNull(),
  dayChange: real("day_change"),
  dayChangePercent: real("day_change_percent"),
  positions: text("positions", { mode: 'json' }), // Snapshot of positions
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
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
