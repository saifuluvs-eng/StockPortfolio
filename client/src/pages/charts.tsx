// client/src/pages/charts.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Inline Error Boundary so the page never goes fully black.
 */
class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { hasError: boolean; msg?: string }
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, msg: undefined };
  }

  static getDerivedStateFromError(err: unknown) {
    return {
      hasError: true,
      msg: err instanceof Error ? err.message : String(err),
    };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("Charts ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ padding: 16 }}>
          <h2 style={{ margin: 0 }}>Something went wrong on this page.</h2>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#222",
              color: "#eee",
              padding: 12,
              borderRadius: 8,
            }}
          >
            {this.state.msg}
          </pre>
        </main>
      );
    }
    return this.props.children;
  }
}

/** Safe helpers */
function safeString(val: unknown, fallback = ""): string {
  return typeof val === "string" ? val : fallback;
}
function safeReplace(
  val: unknown,
  pattern: string | RegExp,
  replacement: string
): string {
  return safeString(val).replace(pattern as any, replacement);
}

/** Map our numeric/letter res to TradingView’s interval strings */
function mapResolution(res: string): string {
  switch (res) {
    case "15":
    case "30":
    case "60":
    case "240":
      return res; // minutes
    case "1D":
      return "1D";
    case "1W":
      return "1W";
    default:
      return "60";
  }
}

/** Map our res to Binance Kline interval */
function toBinanceInterval(res: string): string {
  switch (mapResolution(res)) {
    case "15":
      return "15m";
    case "30":
      return "30m";
    case "60":
      return "1h";
    case "240":
      return "4h";
    case "1D":
      return "1d";
    case "1W":
      return "1w";
    default:
      return "1h";
  }
}

/** Update the current URL’s query params without reloading */
function updateUrlQuery(next: Record<string, string | undefined>) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined || v === null || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  window.history.replaceState({}, "", url.toString());
}

/** Convert user text to a clean base ticker (letters only, uppercase) */
function sanitizeBaseTicker(input: string): string {
  const lettersOnly =
    (input || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, " ")
      .trim()
      .split(/\s+/)[0] || "";
  if (lettersOnly.endsWith("USDT")) return lettersOnly.slice(0, -4);
  return lettersOnly;
}

/** Build a USDT pair from base; if already ends with USDT, keep it */
function toUsdtPair(baseOrPair: string): string {
  const up = (baseOrPair || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!up) return "BTCUSDT";
  return up.endsWith("USDT") ? up : `${up}USDT`;
}

/* ------------------------- indicator calculations ------------------------- */
type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

function ema(values: number[], period: number): number[] {
  const out: number[] = [];
  if (values.length === 0) return out;
  const k = 2 / (period + 1);
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    const v = values[i] * k + prev * (1 - k);
    out.push(v);
    prev = v;
  }
  return out;
}

function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out.push(sum / period);
    else out.push(values[i]); // seed
  }
  return out;
}

function rsi(values: number[], period = 14): number[] {
  const out: number[] = [];
  if (values.length < 2) return values.map(() => 50);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period && i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  gains /= period;
  losses /= period;
  let rs = losses === 0 ? 100 : gains / losses;
  out[period] = 100 - 100 / (1 + rs);
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    gains = (gains * (period - 1) + gain) / period;
    losses = (losses * (period - 1) + loss) / period;
    rs = losses === 0 ? 100 : gains / losses;
    out[i] = 100 - 100 / (1 + rs);
  }
  for (let i = 0; i < period && i < values.length; i++) out[i] = out[period] ?? 50;
  return out;
}

function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = values.map((_, i) => (emaFast[i] ?? 0) - (emaSlow[i] ?? 0));
  const signalLine = ema(macdLine, signal);
  const histogram = macdLine.map((v, i) => v - (signalLine[i] ?? 0));
  return { macdLine, signalLine, histogram };
}

function stoch(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod = 14,
  dPeriod = 3
) {
  const k: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const start = Math.max(0, i - kPeriod + 1);
    const hh = Math.max(...highs.slice(start, i + 1));
    const ll = Math.min(...lows.slice(start, i + 1));
    const denom = hh - ll === 0 ? 1 : hh - ll;
    k.push(((closes[i] - ll) / denom) * 100);
  }
  const d = sma(k, dPeriod);
  return { k, d };
}

function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number[] {
  const trs: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      trs.push(highs[i] - lows[i]);
    } else {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trs.push(tr);
    }
  }
  return ema(trs, period);
}

/** Bollinger Bands */
function bollinger(
  values: number[],
  period = 20,
  mult = 2
): { mid: number[]; upper: number[]; lower: number[] } {
  const mid = sma(values, period);
  const upper: number[] = [];
  const lower: number[] = [];

  // Rolling stddev using sum/sumsq
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    sumSq += values[i] * values[i];
    if (i >= period) {
      sum -= values[i - period];
      sumSq -= values[i - period] * values[i - 1];
      sumSq += values[i - period] * values[i - period]; // keep typescript calm; adjusted above line
    }
    let mean = values[i];
    let std = 0;
    if (i >= period - 1) {
      mean = sum / period;
      const variance = sumSq / period - mean * mean;
      std = Math.sqrt(Math.max(variance, 0));
    }
    upper.push(mean + mult * std);
    lower.push(mean - mult * std);
  }
  return { mid, upper, lower };
}

/** ADX (+DI, -DI) with Wilder's smoothing */
function adx(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): { adx: number[]; plusDI: number[]; minusDI: number[] } {
  const len = closes.length;
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 0; i < len; i++) {
    if (i === 0) {
      tr.push(highs[i] - lows[i]);
      plusDM.push(0);
      minusDM.push(0);
    } else {
      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];
      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

      const trVal = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      tr.push(trVal);
    }
  }

  const rma = (vals: number[], p: number) => {
    const out: number[] = [];
    let prev = vals.slice(0, p).reduce((a, b) => a + b, 0);
    out[p - 1] = prev;
    for (let i = p; i < vals.length; i++) {
      prev = prev - prev / p + vals[i];
      out[i] = prev;
    }
    for (let i = 0; i < p - 1; i++) out[i] = vals[i];
    return out;
  };

  const atrRma = rma(tr, period);
  const plusDMRma = rma(plusDM, period);
  const minusDMRma = rma(minusDM, period);

  const plusDI: number[] = [];
  const minusDI: number[] = [];
  const dx: number[] = [];

  for (let i = 0; i < len; i++) {
    const atrVal = atrRma[i] || 1;
    const pdi = (plusDMRma[i] / atrVal) * 100;
    const mdi = (minusDMRma[i] / atrVal) * 100;
    plusDI.push(pdi);
    minusDI.push(mdi);
    const denom = pdi + mdi === 0 ? 1 : pdi + mdi;
    dx.push((Math.abs(pdi - mdi) / denom) * 100);
  }

  const adxArr = rma(dx, period).map((v, i) =>
    i >= period - 1 ? v / period : v
  );

  return { adx: adxArr, plusDI, minusDI };
}

/** OBV + simple smoothing */
function obv(closes: number[], volumes: number[]): { obv: number[] } {
  const out: number[] = [];
  let cur = 0;
  out.push(cur);
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) cur += volumes[i];
    else if (closes[i] < closes[i - 1]) cur -= volumes[i];
    out.push(cur);
  }
  return { obv: out };
}

/** VWAP (session from beginning of fetched data) */
function vwap(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[]
): number[] {
  const out: number[] = [];
  let cumPV = 0;
  let cumVol = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumPV += tp * volumes[i];
    cumVol += volumes[i];
    out.push(cumVol === 0 ? closes[i] : cumPV / cumVol);
  }
  return out;
}

/** Supertrend (period p, multiplier m). Returns upper/lower bands and trend dir. */
function supertrend(
  highs: number[],
  lows: number[],
  closes: number[],
  p = 10,
  m = 3
): { trend: number[]; upper: number[]; lower: number[]; line: number[] } {
  const len = closes.length;
  const atrArr = atr(highs, lows, closes, p);
  const upper: number[] = new Array(len).fill(0);
  const lower: number[] = new Array(len).fill(0);
  const trend: number[] = new Array(len).fill(1); // 1 up, -1 down
  const line: number[] = new Array(len).fill(0);

  for (let i = 0; i < len; i++) {
    const hl2 = (highs[i] + lows[i]) / 2;
    const basicUpper = hl2 + m * (atrArr[i] ?? 0);
    const basicLower = hl2 - m * (atrArr[i] ?? 0);

    if (i === 0) {
      upper[i] = basicUpper;
      lower[i] = basicLower;
      trend[i] = 1;
      line[i] = lower[i];
      continue;
    }

    upper[i] =
      basicUpper < upper[i - 1] || closes[i - 1] > upper[i - 1]
        ? basicUpper
        : upper[i - 1];

    lower[i] =
      basicLower > lower[i - 1] || closes[i - 1] < lower[i - 1]
        ? basicLower
        : lower[i - 1];

    if (closes[i] > upper[i - 1]) {
      trend[i] = 1;
    } else if (closes[i] < lower[i - 1]) {
      trend[i] = -1;
    } else {
      trend[i] = trend[i - 1];
    }

    line[i] = trend[i] === 1 ? lower[i] : upper[i];
  }

  return { trend, upper, lower, line };
}

type TIStatus = "Bullish" | "Bearish" | "Neutral";
function cmpWithBuffer(a: number, b: number, bufferRatio = 0.002): TIStatus {
  if (a > b * (1 + bufferRatio)) return "Bullish";
  if (a < b * (1 - bufferRatio)) return "Bearish";
  return "Neutral";
}

/* ---------------------------------- page --------------------------------- */
export default function Charts() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = useMemo(() => new URLSearchParams(search), [search]);

  // Read pair from URL (?s=), default to BTCUSDT
  const rawPair = params.get("s");
  const initialPair = toUsdtPair(safeString(rawPair, "BTCUSDT"));
  const initialBase = safeReplace(initialPair, /USDT$/, "");

  // Timeframe from URL (?res=) - default 1Hr
  const rawRes = params.get("res");
  const initialRes = mapResolution(safeString(rawRes, "60"));

  // Indicators URL (?ind=)
  const rawInd = safeString(params.get("ind"), "");
  const initialSet = new Set(
    rawInd
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

  // UI state
  const [baseInput, setBaseInput] = useState<string>(initialBase);
  const [resSelect, setResSelect] = useState<string>(initialRes);
  const [inputError, setInputError] = useState<string>("");

  // Toggle state (for chart studies)
  const [emaOn, setEmaOn] = useState<boolean>(initialSet.has("ema"));
  const [rsiOn, setRsiOn] = useState<boolean>(initialSet.has("rsi"));
  const [macdOn, setMacdOn] = useState<boolean>(initialSet.has("macd"));

  // The currently active pair we render chart + indicators for
  const [currentPair, setCurrentPair] = useState<string>(initialPair);
  const currentBase = currentPair.replace(/USDT$/, "");

  // TradingView symbol using the currentPair
  const exchange = "BINANCE";
  const tvSymbol = `${exchange}:${currentPair}`;

  // Chart studies list (only affects the iframe visual)
  const studies = useMemo(() => {
    const arr: string[] = [];
    if (emaOn) arr.push("MAExp@tv-basicstudies"); // EMA
    if (rsiOn) arr.push("RSI@tv-basicstudies"); // RSI
    if (macdOn) arr.push("MACD@tv-basicstudies"); // MACD
    return arr;
  }, [emaOn, rsiOn, macdOn]);

  // Build iframe URL (append each study)
  const iframeSrc = useMemo(() => {
    const u = new URL("https://s.tradingview.com/widgetembed/");
    u.searchParams.set("symbol", tvSymbol);
    u.searchParams.set("interval", resSelect);
    u.searchParams.set("theme", "dark");
    u.searchParams.set("style", "1");
    u.searchParams.set("timezone", "Etc/UTC");
    u.searchParams.set("withdateranges", "1");
    u.searchParams.set("hide_side_toolbar", "0");
    u.searchParams.set("allow_symbol_change", "1");
    u.searchParams.set("save_image", "0");
    for (const s of studies) u.searchParams.append("studies", s);
    return u.toString();
  }, [tvSymbol, resSelect, studies]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    if (iframeRef.current) iframeRef.current.src = iframeSrc;
  }, [iframeSrc]);

  // Sync indicator toggles to URL (?ind=)
  useEffect(() => {
    const enabled: string[] = [];
    if (emaOn) enabled.push("ema");
    if (rsiOn) enabled.push("rsi");
    if (macdOn) enabled.push("macd");
    updateUrlQuery({ ind: enabled.join(",") || undefined });
  }, [emaOn, rsiOn, macdOn]);

  // Handlers for toolbar
  function applyBaseTicker() {
    const cleanedBase = sanitizeBaseTicker(baseInput);
    if (!cleanedBase) {
      setInputError("Enter a coin name like BTC, ETH, AVAX.");
      return;
    }
    setInputError("");
    const nextPair = toUsdtPair(cleanedBase);
    setCurrentPair(nextPair);
    updateUrlQuery({ s: nextPair });

    const u = new URL(iframeSrc);
    u.searchParams.set("symbol", `${exchange}:${nextPair}`);
    if (iframeRef.current) iframeRef.current.src = u.toString();
  }

  function applyResolution(nextRes: string) {
    const mapped = mapResolution(nextRes);
    setResSelect(mapped);
    updateUrlQuery({ res: mapped });
    const u = new URL(iframeSrc);
    u.searchParams.set("interval", mapped);
    if (iframeRef.current) iframeRef.current.src = u.toString();
  }

  function onBaseChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
    setBaseInput(next);
    if (inputError && next) setInputError("");
  }

  function onBaseKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      applyBaseTicker();
    }
  }

  /* ---------------------------- 24hr box stats ---------------------------- */
  const [boxStats, setBoxStats] = useState<{
    symbol: string;
    lastPrice: number;
    highPrice: number;
    lowPrice: number;
    priceChangePercent: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetch24h() {
      try {
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(
          currentPair
        )}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Binance 24hr error: ${res.status}`);
        const j = await res.json();
        const data = {
          symbol: j.symbol,
          lastPrice: parseFloat(j.lastPrice),
          highPrice: parseFloat(j.highPrice),
          lowPrice: parseFloat(j.lowPrice),
          priceChangePercent: parseFloat(j.priceChangePercent),
        };
        if (!cancelled) setBoxStats(data);
      } catch (e) {
        if (!cancelled) setBoxStats(null);
      }
    }
    fetch24h();
    return () => {
      cancelled = true;
    };
  }, [currentPair]);

  /* ---------------------------- Technical panel --------------------------- */
  const [tiLoading, setTiLoading] = useState(false);
  const [tiError, setTiError] = useState<string | null>(null);
  const [tiData, setTiData] = useState<{
    close: number;

    ema20: number;
    ema50: number;
    ema200: number;
    sma20: number;
    sma50: number;
    sma200: number;

    rsi14: number;
    macd: number;
    macdSignal: number;
    macdHist: number;

    stochK: number;
    stochD: number;

    atr: number;
    atrPct: number;

    bbMid: number;
    bbUpper: number;
    bbLower: number;

    adx: number;
    diPlus: number;
    diMinus: number;

    obv: number;
    obvSma: number;

    vwap: number;

    // EMA Ribbon
    emaRibbon: Record<number, number>;

    // Supertrend
    stTrend: number; // 1 up, -1 down
    stLine: number;

    // Cross summaries
    ema20gt50: boolean;
    ema20gt50_prev: boolean;
    sma50gt200: boolean;
    sma50gt200_prev: boolean;

    updatedAt: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setTiLoading(true);
        setTiError(null);

        const interval = toBinanceInterval(resSelect);
        const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
          currentPair
        )}&interval=${interval}&limit=500`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Binance error: ${res.status}`);
        const rows: any[] = await res.json();

        const candles: Candle[] = rows.map((r) => ({
          openTime: r[0],
          open: parseFloat(r[1]),
          high: parseFloat(r[2]),
          low: parseFloat(r[3]),
          close: parseFloat(r[4]),
          volume: parseFloat(r[5]),
          closeTime: r[6],
        }));
        if (candles.length < 220) throw new Error("Not enough data returned.");

        const closes = candles.map((c) => c.close);
        const highs = candles.map((c) => c.high);
        const lows = candles.map((c) => c.low);
        const volumes = candles.map((c) => c.volume);

        // Core sets
        const ema20Arr = ema(closes, 20);
        const ema50Arr = ema(closes, 50);
        const ema200Arr = ema(closes, 200);
        const sma20Arr = sma(closes, 20);
        const sma50Arr = sma(closes, 50);
        const sma200Arr = sma(closes, 200);

        const rsiArr = rsi(closes, 14);
        const { macdLine, signalLine, histogram } = macd(closes, 12, 26, 9);
        const { k: stochKArr, d: stochDArr } = stoch(highs, lows, closes, 14, 3);
        const atrArr = atr(highs, lows, closes, 14);

        const { mid: bbMidArr, upper: bbUpperArr, lower: bbLowerArr } = bollinger(
          closes,
          20,
          2
        );

        const { adx: adxArr, plusDI, minusDI } = adx(highs, lows, closes, 14);

        const { obv: obvArr } = obv(closes, volumes);
        const obvSmaArr = sma(obvArr, 10);

        const vwapArr = vwap(highs, lows, closes, volumes);

        // EMA Ribbon (8/13/21/34/55)
        const ribbonPeriods = [8, 13, 21, 34, 55];
        const emaRibbon: Record<number, number> = {};
        for (const p of ribbonPeriods) {
          emaRibbon[p] = ema(closes, p)[closes.length - 1];
        }
        const prevEma20 = ema20Arr[closes.length - 2];
        const prevEma50 = ema50Arr[closes.length - 2];
        const prevSma50 = sma50Arr[closes.length - 2];
        const prevSma200 = sma200Arr[closes.length - 2];

        // Supertrend (10, 3)
        const st = supertrend(highs, lows, closes, 10, 3);

        const last = closes.length - 1;
        const data = {
          close: closes[last],

          ema20: ema20Arr[last],
          ema50: ema50Arr[last],
          ema200: ema200Arr[last],
          sma20: sma20Arr[last],
          sma50: sma50Arr[last],
          sma200: sma200Arr[last],

          rsi14: rsiArr[last],
          macd: macdLine[last],
          macdSignal: signalLine[last],
          macdHist: histogram[last],

          stochK: stochKArr[last],
          stochD: stochDArr[last],

          atr: atrArr[last],
          atrPct: (atrArr[last] / closes[last]) * 100,

          bbMid: bbMidArr[last],
          bbUpper: bbUpperArr[last],
          bbLower: bbLowerArr[last],

          adx: adxArr[last],
          diPlus: plusDI[last],
          diMinus: minusDI[last],

          obv: obvArr[last],
          obvSma: obvSmaArr[last],

          vwap: vwapArr[last],

          emaRibbon,

          stTrend: st.trend[last],
          stLine: st.line[last],

          ema20gt50: ema20Arr[last] > ema50Arr[last],
          ema20gt50_prev: prevEma20 > prevEma50,
          sma50gt200: sma50Arr[last] > sma200Arr[last],
          sma50gt200_prev: prevSma50 > prevSma200,

          updatedAt: candles[last].closeTime,
        };

        if (!cancelled) setTiData(data);
      } catch (e: any) {
        if (!cancelled) setTiError(e?.message || "Failed to load indicators.");
      } finally {
        if (!cancelled) setTiLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [currentPair, resSelect]);

  // Build statuses
  const statuses = useMemo(() => {
    if (!tiData) return [];

    const s: { name: string; value: string; status: TIStatus; note?: string }[] =
      [];

    const px = tiData.close;

    // MAs
    const sEma20 = cmpWithBuffer(px, tiData.ema20);
    const sEma50 = cmpWithBuffer(px, tiData.ema50);
    const sEma200 = cmpWithBuffer(px, tiData.ema200);
    const sSma20 = cmpWithBuffer(px, tiData.sma20);

    // RSI
    const rsiStat: TIStatus =
      tiData.rsi14 > 60 ? "Bullish" : tiData.rsi14 < 40 ? "Bearish" : "Neutral";

    // MACD
    const macdStat: TIStatus =
      tiData.macd > tiData.macdSignal
        ? "Bullish"
        : tiData.macd < tiData.macdSignal
        ? "Bearish"
        : "Neutral";

    // Stoch
    const stochStat: TIStatus =
      tiData.stochK < 20 ? "Bullish" : tiData.stochK > 80 ? "Bearish" : "Neutral";

    // ATR (volatility only)
    const atrNote = "Higher % = more volatility";

    // Bollinger Bands
    const bbStat: TIStatus =
      px < tiData.bbLower ? "Bullish" : px > tiData.bbUpper ? "Bearish" : "Neutral";

    // ADX: trend strength + direction from DI
    const trendStrong = tiData.adx >= 25;
    const adxNote = "ADX ≥ 25 indicates stronger trend";
    const adxStat: TIStatus = trendStrong
      ? tiData.diPlus > tiData.diMinus
        ? "Bullish"
        : tiData.diMinus > tiData.diPlus
        ? "Bearish"
        : "Neutral"
      : "Neutral";

    // OBV vs its SMA
    const obvStat = cmpWithBuffer(tiData.obv, tiData.obvSma, 0.0);

    // VWAP
    const vwapStat = cmpWithBuffer(px, tiData.vwap);

    // EMA Ribbon summary
    const ribbonOrder = [8, 13, 21, 34, 55].map((p) => tiData.emaRibbon[p]);
    const ribbonBull =
      ribbonOrder[0] > ribbonOrder[1] &&
      ribbonOrder[1] > ribbonOrder[2] &&
      ribbonOrder[2] > ribbonOrder[3] &&
      ribbonOrder[3] > ribbonOrder[4];
    const ribbonBear =
      ribbonOrder[0] < ribbonOrder[1] &&
      ribbonOrder[1] < ribbonOrder[2] &&
      ribbonOrder[2] < ribbonOrder[3] &&
      ribbonOrder[3] < ribbonOrder[4];
    const ribbonStat: TIStatus = ribbonBull ? "Bullish" : ribbonBear ? "Bearish" : "Neutral";

    // Supertrend
    const stStat: TIStatus = tiData.stTrend === 1 ? "Bullish" : "Bearish";
    const stNote = "Supertrend (10,3): price vs trailing line";

    // MA Cross Summary
    const ema20x50_now = tiData.ema20gt50;
    const ema20x50_prev = tiData.ema20gt50_prev;
    const emaCrossNote =
      ema20x50_now && !ema20x50_prev
        ? "EMA20 crossed ABOVE EMA50 (Golden)"
        : !ema20x50_now && ema20x50_prev
        ? "EMA20 crossed BELOW EMA50 (Death)"
        : ema20x50_now
        ? "EMA20 > EMA50"
        : "EMA20 < EMA50";
    const emaCrossStat: TIStatus = ema20x50_now ? "Bullish" : "Bearish";

    const sma50x200_now = tiData.sma50gt200;
    const sma50x200_prev = tiData.sma50gt200_prev;
    const smaCrossNote =
      sma50x200_now && !sma50x200_prev
        ? "SMA50 crossed ABOVE SMA200 (Golden)"
        : !sma50x200_now && sma50x200_prev
        ? "SMA50 crossed BELOW SMA200 (Death)"
        : sma50x200_now
        ? "SMA50 > SMA200"
        : "SMA50 < SMA200";
    const smaCrossStat: TIStatus = sma50x200_now ? "Bullish" : "Bearish";

    // Push rows
    s.push({
      name: "MA Cross (EMA20 vs EMA50)",
      value: emaCrossNote,
      status: emaCrossStat,
    });
    s.push({
      name: "MA Cross (SMA50 vs SMA200)",
      value: smaCrossNote,
      status: smaCrossStat,
    });

    s.push({
      name: "EMA Ribbon (8/13/21/34/55)",
      value: ribbonBull ? "Aligned Up" : ribbonBear ? "Aligned Down" : "Mixed",
      status: ribbonStat,
      note: "Aligned = stronger trend bias",
    });

    s.push({
      name: "Supertrend (10,3)",
      value: `Trend ${tiData.stTrend === 1 ? "Up" : "Down"} · Line ${tiData.stLine.toFixed(2)} · Px ${px.toFixed(2)}`,
      status: stStat,
      note: stNote,
    });

    s.push({
      name: "Price vs EMA20",
      value: `${px.toFixed(2)} / ${tiData.ema20.toFixed(2)}`,
      status: sEma20,
    });
    s.push({
      name: "Price vs EMA50",
      value: `${px.toFixed(2)} / ${tiData.ema50.toFixed(2)}`,
      status: sEma50,
    });
    s.push({
      name: "Price vs EMA200",
      value: `${px.toFixed(2)} / ${tiData.ema200.toFixed(2)}`,
      status: sEma200,
    });
    s.push({
      name: "Price vs SMA20",
      value: `${px.toFixed(2)} / ${tiData.sma20.toFixed(2)}`,
      status: sSma20,
    });

    s.push({
      name: "RSI (14)",
      value: tiData.rsi14.toFixed(2),
      status: rsiStat,
    });

    s.push({
      name: "MACD (12,26,9)",
      value: `MACD ${tiData.macd.toFixed(4)}  Signal ${tiData.macdSignal.toFixed(
        4
      )}  Hist ${tiData.macdHist.toFixed(4)}`,
      status: macdStat,
    });

    s.push({
      name: "Stoch (14,3)",
      value: `%K ${tiData.stochK.toFixed(2)}  %D ${tiData.stochD.toFixed(2)}`,
      status: stochStat,
    });

    s.push({
      name: "ATR (14)",
      value: `${tiData.atr.toFixed(2)} (${tiData.atrPct.toFixed(2)}%)`,
      status: "Neutral",
      note: atrNote,
    });

    s.push({
      name: "Bollinger Bands (20,2)",
      value: `U ${tiData.bbUpper.toFixed(2)}  M ${tiData.bbMid.toFixed(
        2
      )}  L ${tiData.bbLower.toFixed(2)}`,
      status: bbStat,
      note: "Outside bands = stretched; mean reversion risk",
    });

    s.push({
      name: "ADX (14) + DI",
      value: `ADX ${tiData.adx.toFixed(2)}  +DI ${tiData.diPlus.toFixed(
        1
      )}  -DI ${tiData.diMinus.toFixed(1)}`,
      status: adxStat,
      note: adxNote,
    });

    s.push({
      name: "OBV (vs SMA 10)",
      value: `OBV ${Math.round(tiData.obv)}  SMA ${Math.round(tiData.obvSma)}`,
      status: obvStat,
      note: "Above SMA = positive flow",
    });

    s.push({
      name: "VWAP",
      value: `${px.toFixed(2)} / ${tiData.vwap.toFixed(2)}`,
      status: vwapStat,
      note: "Above VWAP = intraperiod strength",
    });

    return s;
  }, [tiData]);

  function StatusPill({ st }: { st: TIStatus }) {
    const bg = st === "Bullish" ? "#12381f" : st === "Bearish" ? "#3a181a" : "#262626";
    const bd = st === "Bullish" ? "#1d6b35" : st === "Bearish" ? "#6b1d22" : "#3a3a3a";
    const txt = st === "Bullish" ? "#9ef7bb" : st === "Bearish" ? "#ffb3b3" : "#ddd";
    const icon = st === "Bullish" ? "▲" : st === "Bearish" ? "▼" : "→";
    return (
      <span
        style={{
          background: bg,
          border: `1px solid ${bd}`,
          color: txt,
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 12,
        }}
      >
        {icon} {st}
      </span>
    );
  }

  return (
    <ErrorBoundary>
      <main
        style={{
          padding: 16,
          color: "#e0e0e0",
          background: "#0f0f0f",
          minHeight: "100vh",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Charts</h1>

        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            background: "#161616",
            border: "1px solid #2a2a2a",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            maxWidth: 1200,
          }}
        >
          {/* Coin Name input (auto-USDT) */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>Coin Name</label>
            <input
              value={baseInput}
              onChange={onBaseChange}
              onKeyDown={onBaseKeyDown}
              placeholder="BTC, ETH, AVAX"
              maxLength={10}
              style={{
                background: "#0e0e0e",
                color: "#e0e0e0",
                border: "1px solid #333",
                borderRadius: 8,
                padding: "8px 10px",
                minWidth: 180,
                outline: "none",
              }}
            />
            <button
              onClick={applyBaseTicker}
              style={{
                background: "#232323",
                color: "#e0e0e0",
                border: "1px solid #333",
                borderRadius: 8,
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Apply
            </button>
          </div>

          {/* Timeframe */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>Timeframe</label>
            <select
              value={resSelect}
              onChange={(e) => applyResolution(e.target.value)}
              style={{
                background: "#0e0e0e",
                color: "#e0e0e0",
                border: "1px solid #333",
                borderRadius: 8,
                padding: "8px 10px",
                outline: "none",
              }}
            >
              <option value="15">15min</option>
              <option value="30">30min</option>
              <option value="60">1Hr</option>
              <option value="240">4hr</option>
              <option value="1D">1D</option>
              <option value="1W">1W</option>
            </select>
          </div>
        </div>

        {/* FOUR BOXES: Coin Name | Current Price | 24hr high/low | 24hr % */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
            gap: 12,
            maxWidth: 1200,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              background: "#171717",
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              padding: "12px 14px",
            }}
          >
            <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>
              Coin Name
            </div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{currentBase}</div>
          </div>

          <div
            style={{
              background: "#171717",
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              padding: "12px 14px",
            }}
          >
            <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>
              Current Price
            </div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              {boxStats ? boxStats.lastPrice.toFixed(4) : "—"}
            </div>
          </div>

          <div
            style={{
              background: "#171717",
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              padding: "12px 14px",
            }}
          >
            <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>
              24hr high / 24hr low
            </div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              {boxStats
                ? `${boxStats.highPrice.toFixed(4)} / ${boxStats.lowPrice.toFixed(
                    4
                  )}`
                : "—"}
            </div>
          </div>

          <div
            style={{
              background: "#171717",
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              padding: "12px 14px",
            }}
          >
            <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>
              24hr %
            </div>
            <div
              style={{
                fontWeight: 600,
                fontSize: 16,
                color:
                  boxStats && boxStats.priceChangePercent >= 0
                    ? "#9ef7bb"
                    : "#ffb3b3",
              }}
            >
              {boxStats
                ? `${boxStats.priceChangePercent.toFixed(2)}%`
                : "—"}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div
          style={{
            width: "100%",
            maxWidth: 1200,
            height: 600,
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid #2a2a2a",
            background: "#0b0b0b",
          }}
        >
          <iframe
            ref={iframeRef}
            title="TradingView Chart"
            src={iframeSrc}
            style={{ width: "100%", height: "100%", border: "0" }}
            allow="clipboard-write; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-downloads"
          />
        </div>

        {/* Inline validation message */}
        {/* (kept after chart so it doesn't push layout when typing) */}
        {inputError ? (
          <div
            style={{
              background: "#2a1717",
              border: "1px solid #5a2a2a",
              color: "#ffb3b3",
              padding: "8px 12px",
              borderRadius: 8,
              margin: "12px 0",
              maxWidth: 1200,
            }}
          >
            {inputError}
          </div>
        ) : null}

        {/* Technical Indicators Panel */}
        <section
          style={{
            marginTop: 6,
            background: "#151515",
            border: "1px solid #2a2a2a",
            borderRadius: 12,
            padding: 12,
            maxWidth: 1200,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Technical Indicators</h2>
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              (updates with {currentPair} · {resSelect})
            </span>
          </div>

          {tiLoading ? (
            <div style={{ marginTop: 10, opacity: 0.8 }}>Loading…</div>
          ) : tiError ? (
            <div
              style={{
                marginTop: 10,
                background: "#2a1717",
                border: "1px solid #5a2a2a",
                color: "#ffb3b3",
                padding: "8px 12px",
                borderRadius: 8,
              }}
            >
              {tiError}
            </div>
          ) : tiData ? (
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns:
                  "minmax(220px, 1.2fr) minmax(160px, 1fr) minmax(120px, .8fr)",
                gap: 10,
              }}
            >
              {statuses.map((row, idx) => (
                <div key={idx} style={{ display: "contents" }}>
                  <div
                    style={{
                      background: "#181818",
                      border: "1px solid #2e2e2e",
                      borderRadius: 10,
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ fontSize: 13, opacity: 0.85 }}>{row.name}</div>
                    {row.note ? (
                      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
                        {row.note}
                      </div>
                    ) : null}
                  </div>
                  <div
                    style={{
                      background: "#181818",
                      border: "1px solid #2e2e2e",
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 13,
                    }}
                  >
                    {row.value}
                  </div>
                  <div
                    style={{
                      background: "#181818",
                      border: "1px solid #2e2e2e",
                      borderRadius: 10,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <StatusPill st={row.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {tiData ? (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
              Last update: {new Date(tiData.updatedAt).toLocaleString()}
            </div>
          ) : null}
        </section>

        <p style={{ marginTop: 16, opacity: 0.85 }}>
          This panel uses Binance public candles to compute indicators on the fly.
          Change the coin or timeframe and the table will refresh.
        </p>
      </main>
    </ErrorBoundary>
  );
}
// client/src/pages/charts.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Inline Error Boundary so the page never goes fully black.
 */
class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { hasError: boolean; msg?: string }
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, msg: undefined };
  }

  static getDerivedStateFromError(err: unknown) {
    return {
      hasError: true,
      msg: err instanceof Error ? err.message : String(err),
    };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("Charts ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ padding: 16 }}>
          <h2 style={{ margin: 0 }}>Something went wrong on this page.</h2>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#222",
              color: "#eee",
              padding: 12,
              borderRadius: 8,
            }}
          >
            {this.state.msg}
          </pre>
        </main>
      );
    }
    return this.props.children;
  }
}

/** Safe helpers */
function safeString(val: unknown, fallback = ""): string {
  return typeof val === "string" ? val : fallback;
}
function safeReplace(
  val: unknown,
  pattern: string | RegExp,
  replacement: string
): string {
  return safeString(val).replace(pattern as any, replacement);
}

/** Map our numeric/letter res to TradingView’s interval strings */
function mapResolution(res: string): string {
  switch (res) {
    case "15":
    case "30":
    case "60":
    case "240":
      return res; // minutes
    case "1D":
      return "1D";
    case "1W":
      return "1W";
    default:
      return "60";
  }
}

/** Map our res to Binance Kline interval */
function toBinanceInterval(res: string): string {
  switch (mapResolution(res)) {
    case "15":
      return "15m";
    case "30":
      return "30m";
    case "60":
      return "1h";
    case "240":
      return "4h";
    case "1D":
      return "1d";
    case "1W":
      return "1w";
    default:
      return "1h";
  }
}

/** Update the current URL’s query params without reloading */
function updateUrlQuery(next: Record<string, string | undefined>) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined || v === null || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  window.history.replaceState({}, "", url.toString());
}

/** Convert user text to a clean base ticker (letters only, uppercase) */
function sanitizeBaseTicker(input: string): string {
  const lettersOnly =
    (input || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, " ")
      .trim()
      .split(/\s+/)[0] || "";
  if (lettersOnly.endsWith("USDT")) return lettersOnly.slice(0, -4);
  return lettersOnly;
}

/** Build a USDT pair from base; if already ends with USDT, keep it */
function toUsdtPair(baseOrPair: string): string {
  const up = (baseOrPair || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!up) return "BTCUSDT";
  return up.endsWith("USDT") ? up : `${up}USDT`;
}

/* ------------------------- indicator calculations ------------------------- */
type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

function ema(values: number[], period: number): number[] {
  const out: number[] = [];
  if (values.length === 0) return out;
  const k = 2 / (period + 1);
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    const v = values[i] * k + prev * (1 - k);
    out.push(v);
    prev = v;
  }
  return out;
}

function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out.push(sum / period);
    else out.push(values[i]); // seed
  }
  return out;
}

function rsi(values: number[], period = 14): number[] {
  const out: number[] = [];
  if (values.length < 2) return values.map(() => 50);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period && i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  gains /= period;
  losses /= period;
  let rs = losses === 0 ? 100 : gains / losses;
  out[period] = 100 - 100 / (1 + rs);
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    gains = (gains * (period - 1) + gain) / period;
    losses = (losses * (period - 1) + loss) / period;
    rs = losses === 0 ? 100 : gains / losses;
    out[i] = 100 - 100 / (1 + rs);
  }
  for (let i = 0; i < period && i < values.length; i++) out[i] = out[period] ?? 50;
  return out;
}

function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = values.map((_, i) => (emaFast[i] ?? 0) - (emaSlow[i] ?? 0));
  const signalLine = ema(macdLine, signal);
  const histogram = macdLine.map((v, i) => v - (signalLine[i] ?? 0));
  return { macdLine, signalLine, histogram };
}

function stoch(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod = 14,
  dPeriod = 3
) {
  const k: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const start = Math.max(0, i - kPeriod + 1);
    const hh = Math.max(...highs.slice(start, i + 1));
    const ll = Math.min(...lows.slice(start, i + 1));
    const denom = hh - ll === 0 ? 1 : hh - ll;
    k.push(((closes[i] - ll) / denom) * 100);
  }
  const d = sma(k, dPeriod);
  return { k, d };
}

function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number[] {
  const trs: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      trs.push(highs[i] - lows[i]);
    } else {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trs.push(tr);
    }
  }
  return ema(trs, period);
}

/** Bollinger Bands */
function bollinger(
  values: number[],
  period = 20,
  mult = 2
): { mid: number[]; upper: number[]; lower: number[] } {
  const mid = sma(values, period);
  const upper: number[] = [];
  const lower: number[] = [];

  // Rolling stddev using sum/sumsq
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    sumSq += values[i] * values[i];
    if (i >= period) {
      sum -= values[i - period];
      sumSq -= values[i - period] * values[i - 1];
      sumSq += values[i - period] * values[i - period]; // keep typescript calm; adjusted above line
    }
    let mean = values[i];
    let std = 0;
    if (i >= period - 1) {
      mean = sum / period;
      const variance = sumSq / period - mean * mean;
      std = Math.sqrt(Math.max(variance, 0));
    }
    upper.push(mean + mult * std);
    lower.push(mean - mult * std);
  }
  return { mid, upper, lower };
}

/** ADX (+DI, -DI) with Wilder's smoothing */
function adx(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): { adx: number[]; plusDI: number[]; minusDI: number[] } {
  const len = closes.length;
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 0; i < len; i++) {
    if (i === 0) {
      tr.push(highs[i] - lows[i]);
      plusDM.push(0);
      minusDM.push(0);
    } else {
      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];
      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

      const trVal = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      tr.push(trVal);
    }
  }

  const rma = (vals: number[], p: number) => {
    const out: number[] = [];
    let prev = vals.slice(0, p).reduce((a, b) => a + b, 0);
    out[p - 1] = prev;
    for (let i = p; i < vals.length; i++) {
      prev = prev - prev / p + vals[i];
      out[i] = prev;
    }
    for (let i = 0; i < p - 1; i++) out[i] = vals[i];
    return out;
  };

  const atrRma = rma(tr, period);
  const plusDMRma = rma(plusDM, period);
  const minusDMRma = rma(minusDM, period);

  const plusDI: number[] = [];
  const minusDI: number[] = [];
  const dx: number[] = [];

  for (let i = 0; i < len; i++) {
    const atrVal = atrRma[i] || 1;
    const pdi = (plusDMRma[i] / atrVal) * 100;
    const mdi = (minusDMRma[i] / atrVal) * 100;
    plusDI.push(pdi);
    minusDI.push(mdi);
    const denom = pdi + mdi === 0 ? 1 : pdi + mdi;
    dx.push((Math.abs(pdi - mdi) / denom) * 100);
  }

  const adxArr = rma(dx, period).map((v, i) =>
    i >= period - 1 ? v / period : v
  );

  return { adx: adxArr, plusDI, minusDI };
}

/** OBV + simple smoothing */
function obv(closes: number[], volumes: number[]): { obv: number[] } {
  const out: number[] = [];
  let cur = 0;
  out.push(cur);
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) cur += volumes[i];
    else if (closes[i] < closes[i - 1]) cur -= volumes[i];
    out.push(cur);
  }
  return { obv: out };
}

/** VWAP (session from beginning of fetched data) */
function vwap(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[]
): number[] {
  const out: number[] = [];
  let cumPV = 0;
  let cumVol = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumPV += tp * volumes[i];
    cumVol += volumes[i];
    out.push(cumVol === 0 ? closes[i] : cumPV / cumVol);
  }
  return out;
}

/** Supertrend (period p, multiplier m). Returns upper/lower bands and trend dir. */
function supertrend(
  highs: number[],
  lows: number[],
  closes: number[],
  p = 10,
  m = 3
): { trend: number[]; upper: number[]; lower: number[]; line: number[] } {
  const len = closes.length;
  const atrArr = atr(highs, lows, closes, p);
  const upper: number[] = new Array(len).fill(0);
  const lower: number[] = new Array(len).fill(0);
  const trend: number[] = new Array(len).fill(1); // 1 up, -1 down
  const line: number[] = new Array(len).fill(0);

  for (let i = 0; i < len; i++) {
    const hl2 = (highs[i] + lows[i]) / 2;
    const basicUpper = hl2 + m * (atrArr[i] ?? 0);
    const basicLower = hl2 - m * (atrArr[i] ?? 0);

    if (i === 0) {
      upper[i] = basicUpper;
      lower[i] = basicLower;
      trend[i] = 1;
      line[i] = lower[i];
      continue;
    }

    upper[i] =
      basicUpper < upper[i - 1] || closes[i - 1] > upper[i - 1]
        ? basicUpper
        : upper[i - 1];

    lower[i] =
      basicLower > lower[i - 1] || closes[i - 1] < lower[i - 1]
        ? basicLower
        : lower[i - 1];

    if (closes[i] > upper[i - 1]) {
      trend[i] = 1;
    } else if (closes[i] < lower[i - 1]) {
      trend[i] = -1;
    } else {
      trend[i] = trend[i - 1];
    }

    line[i] = trend[i] === 1 ? lower[i] : upper[i];
  }

  return { trend, upper, lower, line };
}

type TIStatus = "Bullish" | "Bearish" | "Neutral";
function cmpWithBuffer(a: number, b: number, bufferRatio = 0.002): TIStatus {
  if (a > b * (1 + bufferRatio)) return "Bullish";
  if (a < b * (1 - bufferRatio)) return "Bearish";
  return "Neutral";
}

/* ---------------------------------- page --------------------------------- */
export default function Charts() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = useMemo(() => new URLSearchParams(search), [search]);

  // Read pair from URL (?s=), default to BTCUSDT
  const rawPair = params.get("s");
  const initialPair = toUsdtPair(safeString(rawPair, "BTCUSDT"));
  const initialBase = safeReplace(initialPair, /USDT$/, "");

  // Timeframe from URL (?res=) - default 1Hr
  const rawRes = params.get("res");
  const initialRes = mapResolution(safeString(rawRes, "60"));

  // Indicators URL (?ind=)
  const rawInd = safeString(params.get("ind"), "");
  const initialSet = new Set(
    rawInd
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

  // UI state
  const [baseInput, setBaseInput] = useState<string>(initialBase);
  const [resSelect, setResSelect] = useState<string>(initialRes);
  const [inputError, setInputError] = useState<string>("");

  // Toggle state (for chart studies)
  const [emaOn, setEmaOn] = useState<boolean>(initialSet.has("ema"));
  const [rsiOn, setRsiOn] = useState<boolean>(initialSet.has("rsi"));
  const [macdOn, setMacdOn] = useState<boolean>(initialSet.has("macd"));

  // The currently active pair we render chart + indicators for
  const [currentPair, setCurrentPair] = useState<string>(initialPair);
  const currentBase = currentPair.replace(/USDT$/, "");

  // TradingView symbol using the currentPair
  const exchange = "BINANCE";
  const tvSymbol = `${exchange}:${currentPair}`;

  // Chart studies list (only affects the iframe visual)
  const studies = useMemo(() => {
    const arr: string[] = [];
    if (emaOn) arr.push("MAExp@tv-basicstudies"); // EMA
    if (rsiOn) arr.push("RSI@tv-basicstudies"); // RSI
    if (macdOn) arr.push("MACD@tv-basicstudies"); // MACD
    return arr;
  }, [emaOn, rsiOn, macdOn]);

  // Build iframe URL (append each study)
  const iframeSrc = useMemo(() => {
    const u = new URL("https://s.tradingview.com/widgetembed/");
    u.searchParams.set("symbol", tvSymbol);
    u.searchParams.set("interval", resSelect);
    u.searchParams.set("theme", "dark");
    u.searchParams.set("style", "1");
    u.searchParams.set("timezone", "Etc/UTC");
    u.searchParams.set("withdateranges", "1");
    u.searchParams.set("hide_side_toolbar", "0");
    u.searchParams.set("allow_symbol_change", "1");
    u.searchParams.set("save_image", "0");
    for (const s of studies) u.searchParams.append("studies", s);
    return u.toString();
  }, [tvSymbol, resSelect, studies]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    if (iframeRef.current) iframeRef.current.src = iframeSrc;
  }, [iframeSrc]);

  // Sync indicator toggles to URL (?ind=)
  useEffect(() => {
    const enabled: string[] = [];
    if (emaOn) enabled.push("ema");
    if (rsiOn) enabled.push("rsi");
    if (macdOn) enabled.push("macd");
    updateUrlQuery({ ind: enabled.join(",") || undefined });
  }, [emaOn, rsiOn, macdOn]);

  // Handlers for toolbar
  function applyBaseTicker() {
    const cleanedBase = sanitizeBaseTicker(baseInput);
    if (!cleanedBase) {
      setInputError("Enter a coin name like BTC, ETH, AVAX.");
      return;
    }
    setInputError("");
    const nextPair = toUsdtPair(cleanedBase);
    setCurrentPair(nextPair);
    updateUrlQuery({ s: nextPair });

    const u = new URL(iframeSrc);
    u.searchParams.set("symbol", `${exchange}:${nextPair}`);
    if (iframeRef.current) iframeRef.current.src = u.toString();
  }

  function applyResolution(nextRes: string) {
    const mapped = mapResolution(nextRes);
    setResSelect(mapped);
    updateUrlQuery({ res: mapped });
    const u = new URL(iframeSrc);
    u.searchParams.set("interval", mapped);
    if (iframeRef.current) iframeRef.current.src = u.toString();
  }

  function onBaseChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
    setBaseInput(next);
    if (inputError && next) setInputError("");
  }

  function onBaseKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      applyBaseTicker();
    }
  }

  /* ---------------------------- 24hr box stats ---------------------------- */
  const [boxStats, setBoxStats] = useState<{
    symbol: string;
    lastPrice: number;
    highPrice: number;
    lowPrice: number;
    priceChangePercent: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetch24h() {
      try {
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(
          currentPair
        )}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Binance 24hr error: ${res.status}`);
        const j = await res.json();
        const data = {
          symbol: j.symbol,
          lastPrice: parseFloat(j.lastPrice),
          highPrice: parseFloat(j.highPrice),
          lowPrice: parseFloat(j.lowPrice),
          priceChangePercent: parseFloat(j.priceChangePercent),
        };
        if (!cancelled) setBoxStats(data);
      } catch (e) {
        if (!cancelled) setBoxStats(null);
      }
    }
    fetch24h();
    return () => {
      cancelled = true;
    };
  }, [currentPair]);

  /* ---------------------------- Technical panel --------------------------- */
  const [tiLoading, setTiLoading] = useState(false);
  const [tiError, setTiError] = useState<string | null>(null);
  const [tiData, setTiData] = useState<{
    close: number;

    ema20: number;
    ema50: number;
    ema200: number;
    sma20: number;
    sma50: number;
    sma200: number;

    rsi14: number;
    macd: number;
    macdSignal: number;
    macdHist: number;

    stochK: number;
    stochD: number;

    atr: number;
    atrPct: number;

    bbMid: number;
    bbUpper: number;
    bbLower: number;

    adx: number;
    diPlus: number;
    diMinus: number;

    obv: number;
    obvSma: number;

    vwap: number;

    // EMA Ribbon
    emaRibbon: Record<number, number>;

    // Supertrend
    stTrend: number; // 1 up, -1 down
    stLine: number;

    // Cross summaries
    ema20gt50: boolean;
    ema20gt50_prev: boolean;
    sma50gt200: boolean;
    sma50gt200_prev: boolean;

    updatedAt: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setTiLoading(true);
        setTiError(null);

        const interval = toBinanceInterval(resSelect);
        const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
          currentPair
        )}&interval=${interval}&limit=500`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Binance error: ${res.status}`);
        const rows: any[] = await res.json();

        const candles: Candle[] = rows.map((r) => ({
          openTime: r[0],
          open: parseFloat(r[1]),
          high: parseFloat(r[2]),
          low: parseFloat(r[3]),
          close: parseFloat(r[4]),
          volume: parseFloat(r[5]),
          closeTime: r[6],
        }));
        if (candles.length < 220) throw new Error("Not enough data returned.");

        const closes = candles.map((c) => c.close);
        const highs = candles.map((c) => c.high);
        const lows = candles.map((c) => c.low);
        const volumes = candles.map((c) => c.volume);

        // Core sets
        const ema20Arr = ema(closes, 20);
        const ema50Arr = ema(closes, 50);
        const ema200Arr = ema(closes, 200);
        const sma20Arr = sma(closes, 20);
        const sma50Arr = sma(closes, 50);
        const sma200Arr = sma(closes, 200);

        const rsiArr = rsi(closes, 14);
        const { macdLine, signalLine, histogram } = macd(closes, 12, 26, 9);
        const { k: stochKArr, d: stochDArr } = stoch(highs, lows, closes, 14, 3);
        const atrArr = atr(highs, lows, closes, 14);

        const { mid: bbMidArr, upper: bbUpperArr, lower: bbLowerArr } = bollinger(
          closes,
          20,
          2
        );

        const { adx: adxArr, plusDI, minusDI } = adx(highs, lows, closes, 14);

        const { obv: obvArr } = obv(closes, volumes);
        const obvSmaArr = sma(obvArr, 10);

        const vwapArr = vwap(highs, lows, closes, volumes);

        // EMA Ribbon (8/13/21/34/55)
        const ribbonPeriods = [8, 13, 21, 34, 55];
        const emaRibbon: Record<number, number> = {};
        for (const p of ribbonPeriods) {
          emaRibbon[p] = ema(closes, p)[closes.length - 1];
        }
        const prevEma20 = ema20Arr[closes.length - 2];
        const prevEma50 = ema50Arr[closes.length - 2];
        const prevSma50 = sma50Arr[closes.length - 2];
        const prevSma200 = sma200Arr[closes.length - 2];

        // Supertrend (10, 3)
        const st = supertrend(highs, lows, closes, 10, 3);

        const last = closes.length - 1;
        const data = {
          close: closes[last],

          ema20: ema20Arr[last],
          ema50: ema50Arr[last],
          ema200: ema200Arr[last],
          sma20: sma20Arr[last],
          sma50: sma50Arr[last],
          sma200: sma200Arr[last],

          rsi14: rsiArr[last],
          macd: macdLine[last],
          macdSignal: signalLine[last],
          macdHist: histogram[last],

          stochK: stochKArr[last],
          stochD: stochDArr[last],

          atr: atrArr[last],
          atrPct: (atrArr[last] / closes[last]) * 100,

          bbMid: bbMidArr[last],
          bbUpper: bbUpperArr[last],
          bbLower: bbLowerArr[last],

          adx: adxArr[last],
          diPlus: plusDI[last],
          diMinus: minusDI[last],

          obv: obvArr[last],
          obvSma: obvSmaArr[last],

          vwap: vwapArr[last],

          emaRibbon,

          stTrend: st.trend[last],
          stLine: st.line[last],

          ema20gt50: ema20Arr[last] > ema50Arr[last],
          ema20gt50_prev: prevEma20 > prevEma50,
          sma50gt200: sma50Arr[last] > sma200Arr[last],
          sma50gt200_prev: prevSma50 > prevSma200,

          updatedAt: candles[last].closeTime,
        };

        if (!cancelled) setTiData(data);
      } catch (e: any) {
        if (!cancelled) setTiError(e?.message || "Failed to load indicators.");
      } finally {
        if (!cancelled) setTiLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [currentPair, resSelect]);

  // Build statuses
  const statuses = useMemo(() => {
    if (!tiData) return [];

    const s: { name: string; value: string; status: TIStatus; note?: string }[] =
      [];

    const px = tiData.close;

    // MAs
    const sEma20 = cmpWithBuffer(px, tiData.ema20);
    const sEma50 = cmpWithBuffer(px, tiData.ema50);
    const sEma200 = cmpWithBuffer(px, tiData.ema200);
    const sSma20 = cmpWithBuffer(px, tiData.sma20);

    // RSI
    const rsiStat: TIStatus =
      tiData.rsi14 > 60 ? "Bullish" : tiData.rsi14 < 40 ? "Bearish" : "Neutral";

    // MACD
    const macdStat: TIStatus =
      tiData.macd > tiData.macdSignal
        ? "Bullish"
        : tiData.macd < tiData.macdSignal
        ? "Bearish"
        : "Neutral";

    // Stoch
    const stochStat: TIStatus =
      tiData.stochK < 20 ? "Bullish" : tiData.stochK > 80 ? "Bearish" : "Neutral";

    // ATR (volatility only)
    const atrNote = "Higher % = more volatility";

    // Bollinger Bands
    const bbStat: TIStatus =
      px < tiData.bbLower ? "Bullish" : px > tiData.bbUpper ? "Bearish" : "Neutral";

    // ADX: trend strength + direction from DI
    const trendStrong = tiData.adx >= 25;
    const adxNote = "ADX ≥ 25 indicates stronger trend";
    const adxStat: TIStatus = trendStrong
      ? tiData.diPlus > tiData.diMinus
        ? "Bullish"
        : tiData.diMinus > tiData.diPlus
        ? "Bearish"
        : "Neutral"
      : "Neutral";

    // OBV vs its SMA
    const obvStat = cmpWithBuffer(tiData.obv, tiData.obvSma, 0.0);

    // VWAP
    const vwapStat = cmpWithBuffer(px, tiData.vwap);

    // EMA Ribbon summary
    const ribbonOrder = [8, 13, 21, 34, 55].map((p) => tiData.emaRibbon[p]);
    const ribbonBull =
      ribbonOrder[0] > ribbonOrder[1] &&
      ribbonOrder[1] > ribbonOrder[2] &&
      ribbonOrder[2] > ribbonOrder[3] &&
      ribbonOrder[3] > ribbonOrder[4];
    const ribbonBear =
      ribbonOrder[0] < ribbonOrder[1] &&
      ribbonOrder[1] < ribbonOrder[2] &&
      ribbonOrder[2] < ribbonOrder[3] &&
      ribbonOrder[3] < ribbonOrder[4];
    const ribbonStat: TIStatus = ribbonBull ? "Bullish" : ribbonBear ? "Bearish" : "Neutral";

    // Supertrend
    const stStat: TIStatus = tiData.stTrend === 1 ? "Bullish" : "Bearish";
    const stNote = "Supertrend (10,3): price vs trailing line";

    // MA Cross Summary
    const ema20x50_now = tiData.ema20gt50;
    const ema20x50_prev = tiData.ema20gt50_prev;
    const emaCrossNote =
      ema20x50_now && !ema20x50_prev
        ? "EMA20 crossed ABOVE EMA50 (Golden)"
        : !ema20x50_now && ema20x50_prev
        ? "EMA20 crossed BELOW EMA50 (Death)"
        : ema20x50_now
        ? "EMA20 > EMA50"
        : "EMA20 < EMA50";
    const emaCrossStat: TIStatus = ema20x50_now ? "Bullish" : "Bearish";

    const sma50x200_now = tiData.sma50gt200;
    const sma50x200_prev = tiData.sma50gt200_prev;
    const smaCrossNote =
      sma50x200_now && !sma50x200_prev
        ? "SMA50 crossed ABOVE SMA200 (Golden)"
        : !sma50x200_now && sma50x200_prev
        ? "SMA50 crossed BELOW SMA200 (Death)"
        : sma50x200_now
        ? "SMA50 > SMA200"
        : "SMA50 < SMA200";
    const smaCrossStat: TIStatus = sma50x200_now ? "Bullish" : "Bearish";

    // Push rows
    s.push({
      name: "MA Cross (EMA20 vs EMA50)",
      value: emaCrossNote,
      status: emaCrossStat,
    });
    s.push({
      name: "MA Cross (SMA50 vs SMA200)",
      value: smaCrossNote,
      status: smaCrossStat,
    });

    s.push({
      name: "EMA Ribbon (8/13/21/34/55)",
      value: ribbonBull ? "Aligned Up" : ribbonBear ? "Aligned Down" : "Mixed",
      status: ribbonStat,
      note: "Aligned = stronger trend bias",
    });

    s.push({
      name: "Supertrend (10,3)",
      value: `Trend ${tiData.stTrend === 1 ? "Up" : "Down"} · Line ${tiData.stLine.toFixed(2)} · Px ${px.toFixed(2)}`,
      status: stStat,
      note: stNote,
    });

    s.push({
      name: "Price vs EMA20",
      value: `${px.toFixed(2)} / ${tiData.ema20.toFixed(2)}`,
      status: sEma20,
    });
    s.push({
      name: "Price vs EMA50",
      value: `${px.toFixed(2)} / ${tiData.ema50.toFixed(2)}`,
      status: sEma50,
    });
    s.push({
      name: "Price vs EMA200",
      value: `${px.toFixed(2)} / ${tiData.ema200.toFixed(2)}`,
      status: sEma200,
    });
    s.push({
      name: "Price vs SMA20",
      value: `${px.toFixed(2)} / ${tiData.sma20.toFixed(2)}`,
      status: sSma20,
    });

    s.push({
      name: "RSI (14)",
      value: tiData.rsi14.toFixed(2),
      status: rsiStat,
    });

    s.push({
      name: "MACD (12,26,9)",
      value: `MACD ${tiData.macd.toFixed(4)}  Signal ${tiData.macdSignal.toFixed(
        4
      )}  Hist ${tiData.macdHist.toFixed(4)}`,
      status: macdStat,
    });

    s.push({
      name: "Stoch (14,3)",
      value: `%K ${tiData.stochK.toFixed(2)}  %D ${tiData.stochD.toFixed(2)}`,
      status: stochStat,
    });

    s.push({
      name: "ATR (14)",
      value: `${tiData.atr.toFixed(2)} (${tiData.atrPct.toFixed(2)}%)`,
      status: "Neutral",
      note: atrNote,
    });

    s.push({
      name: "Bollinger Bands (20,2)",
      value: `U ${tiData.bbUpper.toFixed(2)}  M ${tiData.bbMid.toFixed(
        2
      )}  L ${tiData.bbLower.toFixed(2)}`,
      status: bbStat,
      note: "Outside bands = stretched; mean reversion risk",
    });

    s.push({
      name: "ADX (14) + DI",
      value: `ADX ${tiData.adx.toFixed(2)}  +DI ${tiData.diPlus.toFixed(
        1
      )}  -DI ${tiData.diMinus.toFixed(1)}`,
      status: adxStat,
      note: adxNote,
    });

    s.push({
      name: "OBV (vs SMA 10)",
      value: `OBV ${Math.round(tiData.obv)}  SMA ${Math.round(tiData.obvSma)}`,
      status: obvStat,
      note: "Above SMA = positive flow",
    });

    s.push({
      name: "VWAP",
      value: `${px.toFixed(2)} / ${tiData.vwap.toFixed(2)}`,
      status: vwapStat,
      note: "Above VWAP = intraperiod strength",
    });

    return s;
  }, [tiData]);

  function StatusPill({ st }: { st: TIStatus }) {
    const bg = st === "Bullish" ? "#12381f" : st === "Bearish" ? "#3a181a" : "#262626";
    const bd = st === "Bullish" ? "#1d6b35" : st === "Bearish" ? "#6b1d22" : "#3a3a3a";
    const txt = st === "Bullish" ? "#9ef7bb" : st === "Bearish" ? "#ffb3b3" : "#ddd";
    const icon = st === "Bullish" ? "▲" : st === "Bearish" ? "▼" : "→";
    return (
      <span
        style={{
          background: bg,
          border: `1px solid ${bd}`,
          color: txt,
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 12,
        }}
      >
        {icon} {st}
      </span>
    );
  }

  return (
    <ErrorBoundary>
      <main
        style={{
          padding: 16,
          color: "#e0e0e0",
          background: "#0f0f0f",
          minHeight: "100vh",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Charts</h1>

        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            background: "#161616",
            border: "1px solid #2a2a2a",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            maxWidth: 1200,
          }}
        >
          {/* Coin Name input (auto-USDT) */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>Coin Name</label>
            <input
              value={baseInput}
              onChange={onBaseChange}
              onKeyDown={onBaseKeyDown}
              placeholder="BTC, ETH, AVAX"
              maxLength={10}
              style={{
                background: "#0e0e0e",
                color: "#e0e0e0",
                border: "1px solid #333",
                borderRadius: 8,
                padding: "8px 10px",
                minWidth: 180,
                outline: "none",
              }}
            />
            <button
              onClick={applyBaseTicker}
              style={{
                background: "#232323",
                color: "#e0e0e0",
                border: "1px solid #333",
                borderRadius: 8,
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Apply
            </button>
          </div>

          {/* Timeframe */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>Timeframe</label>
            <select
              value={resSelect}
              onChange={(e) => applyResolution(e.target.value)}
              style={{
                background: "#0e0e0e",
                color: "#e0e0e0",
                border: "1px solid #333",
                borderRadius: 8,
                padding: "8px 10px",
                outline: "none",
              }}
            >
              <option value="15">15min</option>
              <option value="30">30min</option>
              <option value="60">1Hr</option>
              <option value="240">4hr</option>
              <option value="1D">1D</option>
              <option value="1W">1W</option>
            </select>
          </div>
        </div>

        {/* FOUR BOXES: Coin Name | Current Price | 24hr high/low | 24hr % */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
            gap: 12,
            maxWidth: 1200,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              background: "#171717",
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              padding: "12px 14px",
            }}
          >
            <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>
              Coin Name
            </div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{currentBase}</div>
          </div>

          <div
            style={{
              background: "#171717",
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              padding: "12px 14px",
            }}
          >
            <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>
              Current Price
            </div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              {boxStats ? boxStats.lastPrice.toFixed(4) : "—"}
            </div>
          </div>

          <div
            style={{
              background: "#171717",
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              padding: "12px 14px",
            }}
          >
            <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>
              24hr high / 24hr low
            </div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              {boxStats
                ? `${boxStats.highPrice.toFixed(4)} / ${boxStats.lowPrice.toFixed(
                    4
                  )}`
                : "—"}
            </div>
          </div>

          <div
            style={{
              background: "#171717",
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              padding: "12px 14px",
            }}
          >
            <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>
              24hr %
            </div>
            <div
              style={{
                fontWeight: 600,
                fontSize: 16,
                color:
                  boxStats && boxStats.priceChangePercent >= 0
                    ? "#9ef7bb"
                    : "#ffb3b3",
              }}
            >
              {boxStats
                ? `${boxStats.priceChangePercent.toFixed(2)}%`
                : "—"}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div
          style={{
            width: "100%",
            maxWidth: 1200,
            height: 600,
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid #2a2a2a",
            background: "#0b0b0b",
          }}
        >
          <iframe
            ref={iframeRef}
            title="TradingView Chart"
            src={iframeSrc}
            style={{ width: "100%", height: "100%", border: "0" }}
            allow="clipboard-write; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-downloads"
          />
        </div>

        {/* Inline validation message */}
        {/* (kept after chart so it doesn't push layout when typing) */}
        {inputError ? (
          <div
            style={{
              background: "#2a1717",
              border: "1px solid #5a2a2a",
              color: "#ffb3b3",
              padding: "8px 12px",
              borderRadius: 8,
              margin: "12px 0",
              maxWidth: 1200,
            }}
          >
            {inputError}
          </div>
        ) : null}

        {/* Technical Indicators Panel */}
        <section
          style={{
            marginTop: 6,
            background: "#151515",
            border: "1px solid #2a2a2a",
            borderRadius: 12,
            padding: 12,
            maxWidth: 1200,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Technical Indicators</h2>
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              (updates with {currentPair} · {resSelect})
            </span>
          </div>

          {tiLoading ? (
            <div style={{ marginTop: 10, opacity: 0.8 }}>Loading…</div>
          ) : tiError ? (
            <div
              style={{
                marginTop: 10,
                background: "#2a1717",
                border: "1px solid #5a2a2a",
                color: "#ffb3b3",
                padding: "8px 12px",
                borderRadius: 8,
              }}
            >
              {tiError}
            </div>
          ) : tiData ? (
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns:
                  "minmax(220px, 1.2fr) minmax(160px, 1fr) minmax(120px, .8fr)",
                gap: 10,
              }}
            >
              {statuses.map((row, idx) => (
                <div key={idx} style={{ display: "contents" }}>
                  <div
                    style={{
                      background: "#181818",
                      border: "1px solid #2e2e2e",
                      borderRadius: 10,
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ fontSize: 13, opacity: 0.85 }}>{row.name}</div>
                    {row.note ? (
                      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
                        {row.note}
                      </div>
                    ) : null}
                  </div>
                  <div
                    style={{
                      background: "#181818",
                      border: "1px solid #2e2e2e",
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 13,
                    }}
                  >
                    {row.value}
                  </div>
                  <div
                    style={{
                      background: "#181818",
                      border: "1px solid #2e2e2e",
                      borderRadius: 10,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <StatusPill st={row.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {tiData ? (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
              Last update: {new Date(tiData.updatedAt).toLocaleString()}
            </div>
          ) : null}
        </section>

        <p style={{ marginTop: 16, opacity: 0.85 }}>
          This panel uses Binance public candles to compute indicators on the fly.
          Change the coin or timeframe and the table will refresh.
        </p>
      </main>
    </ErrorBoundary>
  );
}
