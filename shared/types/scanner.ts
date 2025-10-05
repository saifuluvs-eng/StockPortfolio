export type ScanSignal = "bullish" | "bearish" | "neutral";

export interface ScanIndicator {
  value?: number | null;
  signal?: ScanSignal | string | null;
  score?: number | null;
  tier?: number | null;
  description?: string | null;
  [key: string]: unknown;
}

export interface ScanResult {
  symbol: string;
  price: number;
  indicators?: Record<string, ScanIndicator | null> | null;
  totalScore: number;
  recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
  meta?: Record<string, unknown> | null;
}
