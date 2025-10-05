export type HighPotentialTimeframe = "1h" | "4h" | "1d";

export interface HighPotentialFilters {
  timeframe: HighPotentialTimeframe;
  minVolUSD: number;
  excludeLeveraged: boolean;
  capRange: [number, number];
}

export interface HighPotentialSocial {
  pos: number;
  neg: number;
  neu: number;
  avgVoteDelta: number;
}

export interface HighPotentialCoin {
  symbol: string;
  baseAsset: string;
  name: string;
  price: number;
  change24hPct: number;
  vol24h: number;
  vol7dAvg: number;
  intraTFVolRatio: number;
  rsi: number;
  macd: {
    crossBullishRecent: boolean;
    histogram: number;
  };
  adx: {
    adx: number;
    plusDI: number;
    minusDI: number;
  };
  ema: {
    ema20: number;
    ema50: number;
    ema200: number;
  };
  resistance20: number;
  breakoutDistancePct: number;
  marketCap: number;
  marketCapRank?: number | null;
  social: HighPotentialSocial;
  score: number;
  confidence: "High" | "Medium" | "Watch" | "Low";
  bucket: "Breakout Zone" | "Oversold Recovery" | "Strong Momentum" | null;
  sparkline: number[];
  updatedAt: number;
  dataStale?: boolean;
}

export interface HighPotentialBuckets {
  breakoutZone: HighPotentialCoin[];
  oversoldRecovery: HighPotentialCoin[];
  strongMomentum: HighPotentialCoin[];
}

export interface HighPotentialResponse {
  dataStale: boolean;
  timeframe: HighPotentialTimeframe;
  filters: HighPotentialFilters;
  top: HighPotentialCoin[];
  buckets: HighPotentialBuckets;
}
