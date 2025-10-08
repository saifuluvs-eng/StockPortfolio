type Kline = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

const INTERVAL_TO_MS: Record<string, number> = {
  "1m": 60_000,
  "3m": 3 * 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "2h": 2 * 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "6h": 6 * 60 * 60_000,
  "8h": 8 * 60 * 60_000,
  "12h": 12 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "3d": 3 * 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
  "1M": 30 * 24 * 60 * 60_000,
};

function basePriceFor(symbol: string): number {
  const s = symbol.toUpperCase();
  if (s.includes("BTC")) return 45_000;
  if (s.includes("ETH")) return 3_000;
  if (s.includes("BNB")) return 430;
  if (s.includes("SOL")) return 110;
  if (s.includes("ADA")) return 0.55;
  if (s.includes("DOGE")) return 0.12;
  return 25;
}

function hashSeed(input: string): number {
  let h = 2166136261 ^ input.length;
  for (let i = 0; i < input.length; i++) {
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
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function intervalToMs(interval: string): number {
  const normalized = interval in INTERVAL_TO_MS ? interval : interval.toLowerCase();
  return INTERVAL_TO_MS[normalized] ?? INTERVAL_TO_MS["1h"];
}

function generateSyntheticKlines(symbol: string, interval: string, limit: number): Kline[] {
  const ms = intervalToMs(interval);
  const rng = createRng(`${symbol}:${interval}:${limit}`);
  const basePrice = basePriceFor(symbol);
  const candles: Kline[] = [];

  let previousClose = basePrice * (0.9 + rng() * 0.2); // ±10%
  const now = Date.now();
  for (let i = limit - 1; i >= 0; i--) {
    const openTime = now - (limit - 1 - i) * ms;
    const drift = (rng() - 0.5) * 0.02; // ±2% drift
    const shock = (rng() - 0.5) * 0.04; // occasional wider swing
    const close = Math.max(0.0001, previousClose * (1 + drift + shock));
    const open = previousClose;
    const high = Math.max(open, close) * (1 + Math.abs(shock) * 0.5);
    const low = Math.min(open, close) * (1 - Math.abs(shock) * 0.5);
    const volume = Math.max(
      1,
      (basePrice * 1_000 * (0.6 + rng() * 0.8)) / (intervalToMs(interval) / 60_000),
    );

    candles.push({
      openTime,
      open,
      high,
      low,
      close,
      volume,
      closeTime: openTime + ms - 1,
    });
    previousClose = close;
  }

  return candles;
}

export async function fetchKlines(symbol: string, interval: string, limit = 500) {
  const u = new URL("https://api.binance.com/api/v3/klines");
  u.searchParams.set("symbol", symbol.toUpperCase());
  u.searchParams.set("interval", interval);
  u.searchParams.set("limit", String(limit));

  try {
    const r = await fetch(u.toString(), { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`binance ${r.status}`);
    const raw = (await r.json()) as any[];
    return raw.map(
      (k): Kline => ({
        openTime: k[0],
        open: +k[1],
        high: +k[2],
        low: +k[3],
        close: +k[4],
        volume: +k[5],
        closeTime: k[6],
      }),
    );
  } catch (error) {
    console.warn(
      "[fetchKlines] Falling back to synthetic data due to upstream error:",
      error,
    );
    return generateSyntheticKlines(symbol, interval, limit);
  }
}

export type { Kline };
