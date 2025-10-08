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
const ENABLE_LEGACY_SCANNER = false;

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
  };
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
  const url = `/api/metrics?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`;
  if (metricsUnsupported) {
    return createPlaceholderTechnical(
      symbol,
      tf,
      "Metrics API unavailable. Showing placeholder indicators.",
    );
  }

  try {
    const res = await api(url);

    if (!res.ok) {
      if (res.status === 404) {
        metricsUnsupported = true;
        return createPlaceholderTechnical(
          symbol,
          tf,
          "Metrics API unavailable (404). Showing placeholder indicators.",
        );
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
    console.warn("computeTechnicalAll: metrics fetch failed", error);
    // Attempt legacy fallback when metrics endpoint is unavailable.
    try {
      return await fetchLegacyTechnical(symbol, tf);
    } catch (legacyError) {
      console.warn("computeTechnicalAll: legacy fallback failed", legacyError);
      return createPlaceholderTechnical(
        symbol,
        tf,
        "Unable to load live technical metrics. Showing placeholder indicators.",
      );
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
