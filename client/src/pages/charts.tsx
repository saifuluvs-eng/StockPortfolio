import React, { useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';

// If you don't have this lib, run: npm i technicalindicators
// We keep all imports type-only to avoid SSR issues; dynamic import below.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as TI from 'technicalindicators';

/**
 * This file replaces client/src/pages/charts.tsx
 * It fetches Binance klines for a symbol + interval, computes indicators,
 * and renders a "Technical Indicators" panel that updates with timeframe.
 *
 * Scope (for now):
 *  - Compute: MA (SMA), EMA, MACD, ADX, RSI, Bollinger Bands, ATR, OBV, VWAP
 *  - Show status (Bullish/Bearish/Neutral) + last value for each
 *  - No overlays drawn on TV chart yet — we keep it robust first
 *  - Dark UI matching the site; no white theme
 */

type Interval = '1m'|'5m'|'15m'|'1h'|'4h'|'1d';

const INTERVALS: Interval[] = ['15m','1h','4h','1d'];

// Binance symbol input will be like BTCUSDT, AVAXUSDT, etc.
// We default to BTCUSDT to stay safe.

// ---- Helpers --------------------------------------------------------------

interface Candle {
  time: number; // ms epoch
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchKlines(symbol: string, interval: Interval, limit = 500): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines failed: ${res.status}`);
  const data: any[] = await res.json();
  return data.map(k => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

function last<T>(arr: T[]): T | undefined { return arr[arr.length - 1]; }

function safeNumber(n: any): number | undefined {
  const x = typeof n === 'number' ? n : parseFloat(String(n));
  return Number.isFinite(x) ? x : undefined;
}

function pct(a: number, b: number) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  return ((a - b) / Math.abs(b)) * 100;
}

// Status helpers -----------------------------------------------------------

function bullBearNeutral(value?: number, ref?: number, epsilon = 1e-8) {
  if (value == null || ref == null) return 'Neutral';
  if (value > ref + epsilon) return 'Bullish';
  if (value < ref - epsilon) return 'Bearish';
  return 'Neutral';
}

function signStatus(x?: number, upIsBull = true, epsilon = 1e-8) {
  if (x == null) return 'Neutral';
  if (x > epsilon) return upIsBull ? 'Bullish' : 'Bearish';
  if (x < -epsilon) return upIsBull ? 'Bearish' : 'Bullish';
  return 'Neutral';
}

// Indicator compute --------------------------------------------------------

interface Indicators {
  sma20?: number;
  ema20?: number;
  macd?: { MACD?: number; signal?: number; histogram?: number };
  adx14?: number;
  rsi14?: number;
  bb20?: { middle?: number; upper?: number; lower?: number; bandwidth?: number };
  atr14?: number;
  obv?: number;
  vwap?: number;
}

function computeIndicators(candles: Candle[]): Indicators {
  const close = candles.map(c => c.close);
  const high = candles.map(c => c.high);
  const low = candles.map(c => c.low);
  const vol = candles.map(c => c.volume);
  const typical = candles.map(c => (c.high + c.low + c.close) / 3);

  const sma20Series = TI.SMA.calculate({ period: 20, values: close });
  const ema20Series = TI.EMA.calculate({ period: 20, values: close });

  const macdSeries = TI.MACD.calculate({ values: close, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });

  const adxSeries = TI.ADX.calculate({ close, high, low, period: 14 });
  const rsiSeries = TI.RSI.calculate({ values: close, period: 14 });

  const bbSeries = TI.BollingerBands.calculate({ period: 20, values: close, stdDev: 2 });

  const atrSeries = TI.ATR.calculate({ high, low, close, period: 14 });

  const obvSeries = TI.OBV.calculate({ close, volume: vol });

  // VWAP (session-less simple cumulative)
  let cumPV = 0; let cumV = 0; let vwapVal: number | undefined;
  for (let i = 0; i < candles.length; i++) {
    const tp = typical[i];
    const v = vol[i];
    if (!Number.isFinite(tp) || !Number.isFinite(v)) continue;
    cumPV += tp * v;
    cumV += v;
    vwapVal = cumV > 0 ? cumPV / cumV : undefined;
  }

  const bbLast = last(bbSeries);

  return {
    sma20: last(sma20Series),
    ema20: last(ema20Series),
    macd: last(macdSeries),
    adx14: last(adxSeries)?.adx,
    rsi14: last(rsiSeries),
    bb20: bbLast ? { middle: bbLast.middle, upper: bbLast.upper, lower: bbLast.lower, bandwidth: bbLast.upper && bbLast.lower ? (bbLast.upper - bbLast.lower) / (bbLast.middle || 1) : undefined } : undefined,
    atr14: last(atrSeries),
    obv: last(obvSeries),
    vwap: vwapVal,
  };
}

// Status derivation --------------------------------------------------------

interface IndicatorStatusItem {
  key: string;
  label: string;
  value: string; // formatted
  status: 'Bullish'|'Bearish'|'Neutral';
  hint?: string;
}

function deriveStatuses(ind: Indicators, lastClose?: number): IndicatorStatusItem[] {
  const items: IndicatorStatusItem[] = [];

  // MA / EMA vs price
  if (ind.sma20 != null && lastClose != null) {
    items.push({
      key: 'sma20',
      label: 'SMA (20)',
      value: ind.sma20.toFixed(2),
      status: bullBearNeutral(lastClose, ind.sma20) as any,
      hint: `Price ${(pct(lastClose, ind.sma20) >= 0 ? 'above' : 'below')} SMA by ${Math.abs(pct(lastClose, ind.sma20)).toFixed(2)}%`,
    });
  }
  if (ind.ema20 != null && lastClose != null) {
    items.push({
      key: 'ema20',
      label: 'EMA (20)',
      value: ind.ema20.toFixed(2),
      status: bullBearNeutral(lastClose, ind.ema20) as any,
      hint: `Price ${(pct(lastClose, ind.ema20) >= 0 ? 'above' : 'below')} EMA by ${Math.abs(pct(lastClose, ind.ema20)).toFixed(2)}%`,
    });
  }

  // MACD
  if (ind.macd) {
    const { MACD, signal, histogram } = ind.macd;
    const cross = (MACD != null && signal != null) ? signStatus((MACD - signal)) : 'Neutral';
    items.push({
      key: 'macd',
      label: 'MACD (12,26,9)',
      value: `macd ${safeNumber(MACD)?.toFixed(2) ?? '—'}, signal ${safeNumber(signal)?.toFixed(2) ?? '—'}, hist ${safeNumber(histogram)?.toFixed(2) ?? '—'}`,
      status: cross as any,
      hint: 'MACD above signal is bullish; below is bearish',
    });
  }

  // ADX strength
  if (ind.adx14 != null) {
    const s = ind.adx14;
    let strength = 'Weak';
    if (s >= 25 && s < 35) strength = 'Moderate';
    else if (s >= 35 && s < 50) strength = 'Strong';
    else if (s >= 50) strength = 'Very strong';
    items.push({ key: 'adx', label: 'ADX (14)', value: s.toFixed(2), status: 'Neutral', hint: `${strength} trend strength` });
  }

  // RSI
  if (ind.rsi14 != null) {
    const r = ind.rsi14;
    let st: 'Bullish'|'Bearish'|'Neutral' = 'Neutral';
    if (r > 55) st = 'Bullish';
    if (r < 45) st = 'Bearish';
    items.push({ key: 'rsi', label: 'RSI (14)', value: r.toFixed(2), status: st, hint: r>70? 'Overbought zone' : r<30? 'Oversold zone' : 'Neutral zone' });
  }

  // Bollinger
  if (ind.bb20 && lastClose != null) {
    const { upper, lower, middle, bandwidth } = ind.bb20;
    const st = upper != null && lower != null ? (lastClose > upper ? 'Bearish' : lastClose < lower ? 'Bullish' : 'Neutral') : 'Neutral';
    items.push({ key: 'bb', label: 'Bollinger (20,2)', value: `mid ${middle?.toFixed(2) ?? '—'}`, status: st as any, hint: `Band ${bandwidth ? (bandwidth*100).toFixed(2)+'%' : '—'}` });
  }

  // ATR (volatility)
  if (ind.atr14 != null && lastClose != null) {
    const p = (ind.atr14 / lastClose) * 100;
    items.push({ key: 'atr', label: 'ATR (14)', value: ind.atr14.toFixed(4), status: 'Neutral', hint: `~${p.toFixed(2)}% of price` });
  }

  // OBV trend
  if (ind.obv != null) {
    items.push({ key: 'obv', label: 'OBV', value: ind.obv.toFixed(0), status: 'Neutral', hint: 'Rising OBV supports uptrend' });
  }

  // VWAP vs price
  if (ind.vwap != null && lastClose != null) {
    items.push({ key: 'vwap', label: 'VWAP', value: ind.vwap.toFixed(2), status: bullBearNeutral(lastClose, ind.vwap) as any, hint: `Price ${(pct(lastClose, ind.vwap) >= 0 ? 'above' : 'below')} VWAP by ${Math.abs(pct(lastClose, ind.vwap)).toFixed(2)}%` });
  }

  return items;
}

// UI ----------------------------------------------------------------------

const Badge: FC<{status: 'Bullish'|'Bearish'|'Neutral'}> = ({ status }) => {
  const color = status === 'Bullish' ? '#22c55e' : status === 'Bearish' ? '#ef4444' : '#a3a3a3';
  return (
    <span style={{
      display:'inline-block', padding:'2px 8px', borderRadius:9999, fontSize:12,
      background: 'rgba(255,255,255,0.04)', color, border: `1px solid ${color}33`
    }}>{status}</span>
  );
};

const rowStyle: React.CSSProperties = { display:'grid', gridTemplateColumns:'160px 1fr 120px', gap:12, alignItems:'center', padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)' };

const ChartsPage: FC = () => {
  const [symbol, setSymbol] = useState<string>('BTCUSDT');
  const [interval, setInterval] = useState<Interval>('1h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|undefined>();

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(undefined);
      try {
        const data = await fetchKlines(symbol, interval, 500);
        if (!alive) return;
        setCandles(data);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? 'Failed to load data');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [symbol, interval]);

  const ind = useMemo(() => candles.length ? computeIndicators(candles) : {}, [candles]);
  const lastClose = candles.length ? candles[candles.length-1].close : undefined;
  const statuses = useMemo(() => deriveStatuses(ind, lastClose), [ind, lastClose]);

  return (
    <div style={{ padding: 16, color:'#e5e7eb', background:'#0b0b0f', minHeight:'100vh' }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Charts / Scanner</h1>

      {/* Controls */}
      <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom: 16 }}>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z]/g,''))}
          placeholder="e.g., BTCUSDT"
          style={{ background:'#111318', color:'#e5e7eb', border:'1px solid #1f2430', padding:'10px 12px', borderRadius:10 }}
        />
        <div style={{ display:'flex', gap:8 }}>
          {INTERVALS.map(iv => (
            <button key={iv} onClick={() => setInterval(iv)}
              style={{ padding:'8px 10px', borderRadius:10, border:'1px solid #1f2430', background: interval===iv? '#111827' : '#0f131a', color:'#e5e7eb' }}>
              {iv}
            </button>
          ))}
        </div>
      </div>

      {/* Technical Indicators Panel */}
      <div style={{ background:'#0f1117', border:'1px solid #1f2430', borderRadius:14, overflow:'hidden', boxShadow:'0 8px 24px rgba(0,0,0,0.35)' }}>
        <div style={{ padding:'12px 14px', borderBottom:'1px solid #1f2430', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:600 }}>Technical Indicators</div>
          <div style={{ fontSize:12, opacity:0.8 }}>{symbol} • {interval} {loading ? '• Loading…' : ''}</div>
        </div>

        {error && (
          <div style={{ padding:12, color:'#f87171' }}>Error: {error}</div>
        )}

        {!error && statuses.length === 0 && (
          <div style={{ padding:12, opacity:0.7 }}>No data</div>
        )}

        {!error && statuses.length > 0 && (
          <div>
            {statuses.map(it => (
              <div key={it.key} style={rowStyle}>
                <div style={{ opacity:0.9 }}>{it.label}</div>
                <div style={{ opacity:0.9 }}>{it.value} <span style={{ fontSize:12, opacity:0.6, marginLeft:8 }}>{it.hint}</span></div>
                <div style={{ textAlign:'right' }}><Badge status={it.status} /></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize:12, opacity:0.7 }}>Tip: Type a symbol like AVAXUSDT, INJUSDT, RENDERUSDT. Panel updates by timeframe.</div>
    </div>
  );
};

export default ChartsPage;
