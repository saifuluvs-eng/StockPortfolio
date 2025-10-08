import { ADX, ATR, EMA, MACD, RSI } from "technicalindicators";

import { api } from "@/lib/api";
import { toBinance } from "@/lib/symbols";

export type TechPayload = {
  summary?: string;
  indicators: {
    close: number | null;
    rsi?: number;
    macd?: { macd: number; signal: number; histogram: number };
    adx?: number;
    ema: { e20?: number; e50?: number; e200?: number };
    atrPct?: number;
    vol?: { last: number | null; zScore: number | null; xAvg50: number | null } | null;
    srProximityPct?: number;
    trendScore: number;
  };
  generatedAt: string;
  isPlaceholder?: boolean;
};

export type AIPayload = {
  source: "openai" | "heuristic";
  summary: string;
  entry?: string;
  target?: string;
  stop?: string;
  confidence: "low" | "med" | "high";
  generatedAt: string;
};

type MetricsResponse = {
  symbol: string;
  tf: string;
  generatedAt: string;
  summary?: string;
  indicators: TechPayload["indicators"];
};

export type OhlcvCandle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type OhlcvResult = {
  candles: OhlcvCandle[];
  source: "live" | "synthetic";
};

type OhlcvResponse = {
  symbol: string;
  tf: string;
  generatedAt: string;
  candles: OhlcvCandle[];
};

const ENABLE_LEGACY_SCANNER =
  (import.meta.env.VITE_ENABLE_LEGACY_SCANNER ?? "true").toLowerCase() !== "false";

type LegacyScanRow = {
  title?: string;
  value?: string | number;
  signal?: string;
  reason?: string;
};

type LegacyScanResult = {
  ts?: number;
  symbol?: string;
  timeframe?: string;
  summary?: { label?: string; score?: string };
  overallScore?: string;
  technicals?: LegacyScanRow[];
  breakdown?: LegacyScanRow[];
};

type MarketTicker = {
  price?: string;
  lastPrice?: string;
  close?: string;
  closePrice?: string;
  volume?: string;
  quoteVolume?: string;
};

const LEGACY_TF_MAP: Record<string, string> = {
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

const createPlaceholderTechnical = (symbol: string, tf: string, reason?: string): TechPayload => {
  const summary =
    reason ??
    "Live technical metrics are currently unavailable. Showing placeholder indicators.";

  return {
    summary,
    indicators: {
      close: null,
      rsi: null,
      macd: { macd: Number.NaN, signal: Number.NaN, histogram: Number.NaN },
      adx: null,
      ema: { e20: null, e50: null, e200: null },
      atrPct: null,
      vol: null,
      srProximityPct: null,
      trendScore: 0,
    },
    generatedAt: new Date().toISOString(),
    isPlaceholder: true,
  };
};

const KLINE_INTERVAL_TO_MS: Record<string, number> = {
  "1m": 60000,
  "3m": 3 * 60000,
  "5m": 5 * 60000,
  "15m": 15 * 60000,
  "30m": 30 * 60000,
  "1h": 60 * 60000,
  "2h": 2 * 60 * 60000,
  "4h": 4 * 60 * 60000,
  "6h": 6 * 60 * 60000,
  "8h": 8 * 60 * 60000,
  "12h": 12 * 60 * 60000,
  "1d": 24 * 60 * 60000,
  "3d": 3 * 24 * 60 * 60000,
  "1w": 7 * 24 * 60 * 60000,
  "1M": 30 * 24 * 60 * 60000,
};

const TF_INTERVAL_MAP: Record<string, string> = {
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "2h": "2h",
  "3h": "3h",
  "4h": "4h",
  "6h": "6h",
  "8h": "8h",
  "12h": "12h",
  "1d": "1d",
  "1w": "1w",
  "1M": "1M",
};

function fallbackBasePrice(symbol: string): number {
  const upper = symbol.toUpperCase();
  if (upper.includes("BTC")) return 45000;
  if (upper.includes("ETH")) return 3000;
  if (upper.includes("BNB")) return 430;
  if (upper.includes("SOL")) return 110;
  if (upper.includes("ADA")) return 0.55;
  if (upper.includes("DOGE")) return 0.12;
  return 25;
}

function hashSeed(input: string): number {
  let h = 2166136261 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t ^= t >>> 15;
    t = Math.imul(t, t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    t ^= t >>> 14;
    return (t >>> 0) / 4294967296;
  };
}

function intervalToMs(tf: string): number {
  const interval = TF_INTERVAL_MAP[tf] ?? tf;
  const normalized = KLINE_INTERVAL_TO_MS[interval]
    ? interval
    : (interval || "").toLowerCase();
  return KLINE_INTERVAL_TO_MS[normalized] ?? KLINE_INTERVAL_TO_MS["1h"];
}

function generateSyntheticOhlcv(symbol: string, tf: string, limit = 240): OhlcvCandle[] {
  const ms = intervalToMs(tf);
  const rng = createRng(`ohlcv:${symbol}:${tf}:${limit}`);
  const basePrice = fallbackBasePrice(symbol);
  const candles: OhlcvCandle[] = [];
  const now = Date.now();
  let previousClose = basePrice * (0.9 + rng() * 0.2);

  for (let i = limit - 1; i >= 0; i -= 1) {
    const openTime = now - (limit - 1 - i) * ms;
    const drift = (rng() - 0.5) * 0.02;
    const shock = (rng() - 0.5) * 0.04;
    const close = Math.max(0.0001, previousClose * (1 + drift + shock));
    const open = previousClose;
    const high = Math.max(open, close) * (1 + Math.abs(shock) * 0.5);
    const low = Math.min(open, close) * (1 - Math.abs(shock) * 0.5);
    const volume = Math.max(
      1,
      (basePrice * 1000 * (0.6 + rng() * 0.8)) / Math.max(ms / 60000, 1),
    );
    const closeTime = openTime + ms - 1;
    candles.push({ openTime, closeTime, open, high, low, close, volume });
    previousClose = close;
  }

  return candles;
}

function generateSyntheticTechnical(symbol: string, tf: string): TechPayload {
  const interval = TF_INTERVAL_MAP[tf] ?? tf;
  const rng = createRng(`tech:${symbol}:${interval}`);
  const basePrice = fallbackBasePrice(symbol);
  const close = basePrice * (0.85 + rng() * 0.3);
  const rsi = Math.min(85, Math.max(15, 30 + rng() * 40));
  const macdCore = (rng() - 0.5) * 2;
  const macdSignal = macdCore + (rng() - 0.5) * 0.5;
  const macdHistogram = macdCore - macdSignal;
  const adx = Math.min(60, Math.max(12, 18 + rng() * 35));
  const ema20 = close * (0.98 + rng() * 0.04);
  const ema50 = close * (0.96 + rng() * 0.08);
  const ema200 = close * (0.9 + rng() * 0.2);
  const atrPct = Math.max(0.5, rng() * 4);
  const volumeBaseline = basePrice * 1000;
  const volumeLast = volumeBaseline * (0.7 + rng() * 0.6);
  const volumeZ = (rng() - 0.5) * 2;
  const srProximity = Math.abs(rng() - 0.5) * 15;
  const trendScore = Math.round((20 + rng() * 60) * 100) / 100;

  return {
    summary: "Synthetic technical snapshot while live metrics are unavailable.",
    indicators: {
      close,
      rsi,
      macd: { macd: macdCore, signal: macdSignal, histogram: macdHistogram },
      adx,
      ema: { e20: ema20, e50: ema50, e200: ema200 },
      atrPct,
      vol: {
        last: volumeLast,
        zScore: volumeZ,
        xAvg50: volumeBaseline,
      },
      srProximityPct: srProximity,
      trendScore,
    },
    generatedAt: new Date().toISOString(),
    isPlaceholder: false,
  };
}

const BINANCE_INTERVAL_MAP: Record<string, string> = {
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

async function fetchBinanceKlines(symbol: string, tf: string, limit = 500): Promise<OhlcvCandle[]> {
  const interval = BINANCE_INTERVAL_MAP[tf];
  if (!interval) {
    throw new Error(`Unsupported timeframe: ${tf}`);
  }
  const url = new URL("https://api.binance.com/api/v3/klines");
  url.searchParams.set("symbol", symbol.toUpperCase());
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(Math.max(200, Math.min(limit, 1000))));

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Binance klines error: ${res.status}`);
  }
  const raw = (await res.json()) as any[];
  if (!Array.isArray(raw)) {
    throw new Error("Unexpected klines payload");
  }

  return raw.map((row) => ({
    openTime: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    closeTime: Number(row[6]),
  }));
}

function round(value?: number | null, decimals = 2): number | undefined {
  if (value === null || value === undefined || Number.isNaN(value)) return undefined;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function computeIndicatorsFromCandles(candles: OhlcvCandle[]): TechPayload["indicators"] {
  if (!candles.length) {
    throw new Error("Cannot compute indicators without candles");
  }

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);
  const lastIndex = candles.length - 1;
  const lastClose = closes[lastIndex];
  const lastVolume = volumes[lastIndex];

  const takeLast = <T,>(arr: T[]): T | undefined => (arr.length ? arr[arr.length - 1] : undefined);

  const rsiSeries = RSI.calculate({ period: 14, values: closes });
  const macdSeries = MACD.calculate({
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
    values: closes,
  });
  const adxSeries = ADX.calculate({ period: 14, close: closes, high: highs, low: lows });
  const ema20Series = EMA.calculate({ period: 20, values: closes });
  const ema50Series = EMA.calculate({ period: 50, values: closes });
  const ema200Series = EMA.calculate({ period: 200, values: closes });
  const atrSeries = ATR.calculate({ period: 14, close: closes, high: highs, low: lows });

  const rsi = takeLast(rsiSeries);
  const macd = takeLast(macdSeries);
  const adx = takeLast(adxSeries)?.adx;
  const ema20 = takeLast(ema20Series);
  const ema50 = takeLast(ema50Series);
  const ema200 = takeLast(ema200Series);
  const atr = takeLast(atrSeries);

  const volumeWindow = Math.min(50, volumes.length);
  const recent = volumes.slice(-volumeWindow);
  const mean = recent.reduce((sum, v) => sum + v, 0) / Math.max(1, recent.length);
  const variance = recent.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / Math.max(1, recent.length);
  const stddev = Math.sqrt(variance);
  const volZ = stddev ? (volumes[lastIndex] - mean) / stddev : 0;
  const volX = mean ? volumes[lastIndex] / mean : 1;

  const lookback = Math.max(60, 20 * 3);
  const sample = candles.slice(-lookback);
  let swingHigh = sample[0]?.high ?? lastClose;
  let swingLow = sample[0]?.low ?? lastClose;
  for (let i = 1; i < sample.length - 1; i += 1) {
    const current = sample[i];
    const prev = sample[i - 1];
    const next = sample[i + 1];
    if (current.high > prev.high && current.high > next.high) {
      swingHigh = Math.max(swingHigh, current.high);
    }
    if (current.low < prev.low && current.low < next.low) {
      swingLow = Math.min(swingLow, current.low);
    }
  }
  const distanceToHigh = lastClose
    ? Math.abs(((swingHigh - lastClose) / lastClose) * 100)
    : undefined;
  const distanceToLow = lastClose ? Math.abs(((lastClose - swingLow) / lastClose) * 100) : undefined;
  const srProximityPct =
    distanceToHigh !== undefined && distanceToLow !== undefined
      ? round(Math.min(distanceToHigh, distanceToLow))
      : undefined;

  let trendScore = 50;
  if (ema20 !== undefined && ema50 !== undefined && ema200 !== undefined) {
    if (ema20 > ema50 && ema50 > ema200) trendScore += 15;
    if (ema20 < ema50 && ema50 < ema200) trendScore -= 15;
    const prevEma20 = ema20Series[ema20Series.length - 2];
    if (prevEma20 !== undefined) {
      const slope = Math.sign(ema20 - prevEma20);
      trendScore += slope * 5;
    }
  }
  if (typeof rsi === "number") {
    if (rsi >= 55 && rsi <= 65) trendScore += 5;
    if (rsi < 45 || rsi > 75) trendScore -= 5;
  }
  if (typeof adx === "number") {
    if (adx > 25) trendScore += 5;
    if (adx < 15) trendScore -= 5;
  }
  trendScore = Math.max(0, Math.min(100, Math.round(trendScore)));

  const macdPayload =
    macd && typeof macd.MACD === "number" && typeof macd.signal === "number" && typeof macd.histogram === "number"
      ? {
          macd: round(macd.MACD),
          signal: round(macd.signal),
          histogram: round(macd.histogram),
        }
      : undefined;

  const atrPct = atr && lastClose ? round((atr / lastClose) * 100, 1) : undefined;

  return {
    close: lastClose ?? null,
    rsi: round(rsi, 1),
    macd: macdPayload,
    adx: round(adx, 1),
    ema: {
      e20: round(ema20),
      e50: round(ema50),
      e200: round(ema200),
    },
    atrPct,
    vol: {
      last: lastVolume ?? null,
      zScore: round(volZ),
      xAvg50: round(volX),
    },
    srProximityPct,
    trendScore,
  };
}

async function computeLocalTechnical(symbol: string, tf: string): Promise<TechPayload> {
  const candles = await fetchBinanceKlines(symbol, tf, 500);
  const indicators = computeIndicatorsFromCandles(candles);
  return {
    summary: `Technical snapshot generated from live Binance data for ${symbol} @ ${tf}.`,
    indicators,
    generatedAt: new Date().toISOString(),
    isPlaceholder: false,
  };
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const numeric = Number.parseFloat(value.replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function consumeRow(rows: LegacyScanRow[] | undefined, title: string): LegacyScanRow | undefined {
  if (!rows) return undefined;
  const normalized = title.trim().toLowerCase();
  return rows.find((row) => row.title?.trim().toLowerCase() === normalized);
}

function parseMacd(row: LegacyScanRow | undefined): { macd: number; signal: number; histogram: number } | undefined {
  if (!row) return undefined;
  const macd = parseNumber(row.value);
  if (macd == null) return undefined;
  const match = row.reason?.match(/signal\s(-?\d+(?:\.\d+)?)/i);
  const signal = match ? parseNumber(match[1]) : null;
  const histogram = signal == null ? null : macd - signal;
  if (signal == null || histogram == null) {
    return { macd, signal: Number.NaN, histogram: Number.NaN };
  }
  return { macd, signal, histogram };
}

async function fetchLegacyTicker(symbol: string): Promise<MarketTicker | null> {
  try {
    const res = await api(`/api/market/ticker/${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as MarketTicker;
    return data ?? null;
  } catch {
    return null;
  }
}

async function fetchLegacyTechnical(symbol: string, tf: string): Promise<TechPayload> {
  if (!ENABLE_LEGACY_SCANNER) {
    return createPlaceholderTechnical(
      symbol,
      tf,
      "Legacy scanner disabled in this build. Showing placeholder indicators.",
    );
  }
  try {
    const legacyTf = LEGACY_TF_MAP[tf] ?? tf;
    const body = {
      symbol,
      timeframe: legacyTf,
      filters: {},
    };
    const res = await api("/api/scanner/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.warn("Legacy scanner request failed", res.status, detail);
      return createPlaceholderTechnical(
        symbol,
        tf,
        "Legacy scanner unavailable. Showing placeholder indicators.",
      );
    }

    const payload = (await res.json()) as { data?: LegacyScanResult[] };
    const result = Array.isArray(payload.data) ? payload.data[0] : undefined;
    if (!result) {
      console.warn("Legacy scanner returned no data payload");
      return createPlaceholderTechnical(
        symbol,
        tf,
        "Legacy scanner returned no data. Showing placeholder indicators.",
      );
    }

    const rows = (result.technicals ?? result.breakdown ?? []).filter(
      (row): row is LegacyScanRow => Boolean(row && row.title),
    );

    const [ticker] = await Promise.all([fetchLegacyTicker(symbol)]);

    const close =
      parseNumber(ticker?.lastPrice) ??
      parseNumber(ticker?.price) ??
      parseNumber(ticker?.closePrice) ??
      parseNumber(ticker?.close) ??
      null;

    const summaryScore =
      parseNumber(result.summary?.score ?? result.overallScore) ?? parseNumber(result.overallScore ?? null) ?? 0;

    const indicators: TechPayload["indicators"] = {
      close,
      rsi: parseNumber(consumeRow(rows, "RSI")?.value),
      macd: parseMacd(consumeRow(rows, "MACD")),
      adx: parseNumber(consumeRow(rows, "ADX")?.value),
      ema: {
        e20: parseNumber(consumeRow(rows, "EMA 20")?.value),
        e50: parseNumber(consumeRow(rows, "EMA 50")?.value),
        e200: parseNumber(consumeRow(rows, "EMA 200")?.value),
      },
      atrPct: parseNumber(consumeRow(rows, "ATR (14)")?.value),
      vol: null,
      srProximityPct: undefined,
      trendScore: summaryScore ?? 0,
    };

    return {
      summary: result.summary?.label,
      indicators,
      generatedAt: result.ts ? new Date(result.ts).toISOString() : new Date().toISOString(),
      isPlaceholder: false,
    };
  } catch (error) {
    console.warn("Legacy scanner request encountered an error", error);
    return createPlaceholderTechnical(
      symbol,
      tf,
      "Legacy scanner error. Showing placeholder indicators.",
    );
  }
}

export async function computeTechnicalAll(
  symbol: string,
  tf: string,
): Promise<TechPayload> {
  const normalizedSymbol = toBinance(symbol);
  const url = `/api/metrics?symbol=${encodeURIComponent(normalizedSymbol)}&tf=${encodeURIComponent(tf)}`;

  try {
    const res = await api(url);

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || `Failed to load metrics (${res.status})`);
    }

    const data = (await res.json()) as MetricsResponse;

    if (!data?.indicators) {
      throw new Error("Metrics response missing indicators");
    }

    return {
      summary: data.summary,
      indicators: data.indicators,
      generatedAt: data.generatedAt ?? new Date().toISOString(),
      isPlaceholder: false,
    };
  } catch (error) {
    console.warn("computeTechnicalAll: metrics fetch failed", error);
    try {
      return await computeLocalTechnical(normalizedSymbol, tf);
    } catch (localError) {
      console.warn("computeTechnicalAll: local technical computation failed", localError);
    }
    // Attempt legacy fallback when metrics endpoint is unavailable.
    try {
      const legacy = await fetchLegacyTechnical(normalizedSymbol, tf);
      if (!legacy.isPlaceholder) {
        return legacy;
      }
    } catch (legacyError) {
      console.warn("computeTechnicalAll: legacy fallback failed", legacyError);
    }
    return generateSyntheticTechnical(normalizedSymbol, tf);
  }
}

export async function computeAI(
  symbol: string,
  tf: string,
  tech?: TechPayload,
): Promise<AIPayload> {
  const normalizedSymbol = toBinance(symbol);
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    source: "heuristic",
    summary: `AI-style read for ${normalizedSymbol} @ ${tf}`,
    entry: "—",
    target: "—",
    stop: "—",
    confidence: "med",
    generatedAt: new Date().toISOString(),
  };
}

export async function fetchOhlcv(symbol: string, tf: string): Promise<OhlcvResult> {
  const normalizedSymbol = toBinance(symbol);
  const url = `/api/ohlcv?symbol=${encodeURIComponent(normalizedSymbol)}&tf=${encodeURIComponent(tf)}`;
  try {
    const res = await api(url);
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || `Failed to load ohlcv (${res.status})`);
    }
    const payload = (await res.json()) as OhlcvResponse;
    if (!payload?.candles || !Array.isArray(payload.candles) || payload.candles.length === 0) {
      throw new Error("Payload missing candles");
    }
    return { candles: payload.candles, source: "live" };
  } catch (error) {
    console.warn("fetchOhlcv: backend fetch failed, attempting direct Binance fetch", error);
    try {
      const candles = await fetchBinanceKlines(normalizedSymbol, tf, 500);
      return { candles, source: "live" };
    } catch (directError) {
      console.warn("fetchOhlcv: direct Binance fetch failed, using synthetic data", directError);
    }
    return {
      candles: generateSyntheticOhlcv(normalizedSymbol, tf),
      source: "synthetic",
    };
  }
}
