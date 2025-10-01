export interface ScanIndicator {
  value?: number;
  signal?: "bullish" | "bearish" | "neutral";
  score?: number;
  tier?: number;
  description?: string;
}

export interface ScanResult {
  symbol: string;
  price: number;
  indicators: Record<string, ScanIndicator>;
  totalScore: number;
  recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
  meta?: Record<string, unknown> | null;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  createdAt?: number | string | null;
}

export interface ScanHistoryItem {
  id: string;
  scanType: string;
  filters?: { symbol?: string; timeframe?: string } | null;
  results?: ScanResult | null;
  createdAt?: number | string | null;
}

export interface HighPotentialFilters {
  timeframe?: string;
  minScore?: number;
  minVolume?: string;
  excludeStablecoins?: boolean;
  limit?: number;
}
