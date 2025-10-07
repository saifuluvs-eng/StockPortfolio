import { api } from "@/lib/api";

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

let metricsUnsupported = false;

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
    throw new Error(detail || `Failed to load legacy technicals (${res.status})`);
  }

  const payload = (await res.json()) as { data?: LegacyScanResult[] };
  const result = Array.isArray(payload.data) ? payload.data[0] : undefined;
  if (!result) {
    throw new Error("Legacy scanner returned no data");
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
  };
}

export async function computeTechnicalAll(
  symbol: string,
  tf: string,
): Promise<TechPayload> {
  const url = `/api/metrics?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`;
  if (metricsUnsupported) {
    return await fetchLegacyTechnical(symbol, tf);
  }

  try {
    const res = await api(url);

    if (!res.ok) {
      if (res.status === 404) {
        metricsUnsupported = true;
        return await fetchLegacyTechnical(symbol, tf);
      }
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
    };
  } catch (error) {
    // Attempt legacy fallback when metrics endpoint is unavailable.
    try {
      return await fetchLegacyTechnical(symbol, tf);
    } catch (legacyError) {
      throw legacyError instanceof Error ? legacyError : error instanceof Error ? error : new Error("Technical scan failed");
    }
  }
}

export async function computeAI(
  symbol: string,
  tf: string,
  tech?: TechPayload,
): Promise<AIPayload> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    source: "heuristic",
    summary: `AI-style read for ${symbol} @ ${tf}`,
    entry: "—",
    target: "—",
    stop: "—",
    confidence: "med",
    generatedAt: new Date().toISOString(),
  };
}
