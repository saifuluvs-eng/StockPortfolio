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
    case "1":
    case "3":
    case "5":
    case "15":
    case "30":
    case "60":
    case "120":
    case "240":
    case "480":
      return res; // minutes
    case "D":
    case "1D":
      return "1D";
    case "W":
    case "1W":
      return "1W";
    case "M":
    case "1M":
      return "1M";
    default:
      return "60";
  }
}

/** Map our res to Binance Kline interval */
function toBinanceInterval(res: string): string {
  switch (mapResolution(res)) {
    case "1":
      return "1m";
    case "3":
      return "3m";
    case "5":
      return "5m";
    case "15":
      return "15m";
    case "30":
      return "30m";
    case "60":
      return "1h";
    case "120":
      return "2h";
    case "240":
      return "4h";
    case "480":
      return "8h";
    case "1D":
      return "1d";
    case "1W":
      return "1w";
    case "1M":
      return "1M";
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
      sumSq -= values[i - period] * values[i - period];
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

  // Wilder's EMA (RMA)
  const rma = (vals: number[], p: number) => {
    const out: number[] = [];
    let prev = vals.slice(0, p).reduce((a, b) => a + b, 0);
    out[p - 1] = prev;
    for (let i = p; i < vals.length; i++) {
      prev = prev - prev / p + vals[i];
      out[i] = prev;
    }
    // seed leading
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

  // ADX is RMA of DX
  const adxArr = rma(dx, period).map((v, i) =>
    i >= period - 1 ? v / period : v
  );

  return { adx: adxArr, plusDI, minusDI };
}

/** OBV + simple smoothing for signal */
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

type TIStatus = "Bullish" | "Bearish" | "Neutral";
function cmpWithBuffer(a: number, b: number, bufferRatio = 0.002): TIStatus {
  // buffer ~0.2% to avoid flip-flop
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

  // Resolution / timeframe from URL (?res=)
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
      setInputError("Enter a base ticker like BTC, ETH, AVAX.");
      return;
    }
    setInputError("");
    const nextPair = toUsdtPair(cleanedBase);
    setCurrentPair(nextPair); // local state for chart + indicators
    updateUrlQuery({ s: nextPair });

    // refresh iframe immediately
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

  /* ---------------------------- Technical panel --------------------------- */
  const [tiLoading, setTiLoading] = useState(false);
  const [tiError, setTiError] = useState<string | null>(null);
  const [tiData, setTiData] = useState<{
    close: number;

    ema20: number;
    ema50: number;
    ema200: number;
    sma20: number;

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

        // Parse candles
        const candles: Candle[] = rows.map((r) => ({
          openTime: r[0],
          open: parseFloat(r[1]),
          high: parseFloat(r[2]),
          low: parseFloat(r[3]),
          close: parseFloat(r[4]),
          volume: parseFloat(r[5]),
          closeTime: r[6],
        }));
        if (candles.length < 50) throw new Error("Not enough data returned.");

        const closes = candles.map((c) => c.close);
        const highs = candles.map((c) => c.high);
        const lows = candles.map((c) => c.low);
        const volumes = candles.map((c) => c.volume);

        // Core sets
        const ema20Arr = ema(closes, 20);
        const ema50Arr = ema(closes, 50);
        const ema200Arr = ema(closes, 200);
        const sma20Arr = sma(closes, 20);

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

        const last = closes.length - 1;
        const data = {
          close: closes[last],

          ema20: ema20Arr[last],
          ema50: ema50Arr[last],
          ema200: ema200Arr[last],
          sma20: sma20Arr[last],

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

    // Bollinger Bands (mean reversion style)
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
    const obvStat = cmpWithBuffer(tiData.obv, tiData.obvSma, 0.0); // no buffer needed
    // VWAP: intraperiod fair value
    const vwapStat = cmpWithBuffer(px, tiData.vwap);

    // Push rows
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
          {/* Base ticker input (auto-USDT) */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>
              Base ticker (auto-USDT)
            </label>
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

          {/* Resolution */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>Resolution</label>
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
              <option value="1">1</option>
              <option value="3">3</option>
              <option value="5">5</option>
              <option value="15">15</option>
              <option value="30">30</option>
              <option value="60">60</option>
              <option value="120">120</option>
              <option value="240">240</option>
              <option value="480">480</option>
              <option value="1D">1D</option>
              <option value="1W">1W</option>
              <option value="1M">1M</option>
            </select>
          </div>

          {/* Indicator toggles (for chart visual only) */}
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              background: "#131313",
              border: "1px dashed #333",
              borderRadius: 10,
              padding: "8px 12px",
            }}
          >
            <span style={{ fontSize: 12, opacity: 0.75 }}>Chart Indicators:</span>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={emaOn}
                onChange={() => setEmaOn((v) => !v)}
              />
              <span style={{ fontSize: 13 }}>EMA</span>
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={rsiOn}
                onChange={() => setRsiOn((v) => !v)}
              />
              <span style={{ fontSize: 13 }}>RSI</span>
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={macdOn}
                onChange={() => setMacdOn((v) => !v)}
              />
              <span style={{ fontSize: 13 }}>MACD</span>
            </label>
          </div>

          {/* Quick read-only info */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Pair:&nbsp;<code style={{ fontSize: 13 }}>{currentPair}</code>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Base:&nbsp;<code style={{ fontSize: 13 }}>{currentBase}</code>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Res:&nbsp;<code style={{ fontSize: 13 }}>{resSelect}</code>
            </div>
          </div>
        </div>

        {/* Inline validation message */}
        {inputError ? (
          <div
            style={{
              background: "#2a1717",
              border: "1px solid #5a2a2a",
              color: "#ffb3b3",
              padding: "8px 12px",
              borderRadius: 8,
              margin: "0 0 12px 0",
              maxWidth: 1200,
            }}
          >
            {inputError}
          </div>
        ) : null}

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

        {/* Technical Indicators Panel */}
        <section
          style={{
            marginTop: 18,
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
          Change the base ticker or resolution and the table will refresh.
        </p>
      </main>
    </ErrorBoundary>
  );
}
