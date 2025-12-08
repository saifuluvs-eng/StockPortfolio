import { VercelRequest, VercelResponse } from '@vercel/node';

const BINANCE_BASE = 'https://api.binance.com/api/v3';

function cors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
}

function sendJson(res: VercelResponse, data: unknown): void {
  cors(res);
  res.status(200).json(data);
}

function sendError(res: VercelResponse, status: number, message: string): void {
  cors(res);
  res.status(status).json({ error: message });
}

function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - change) / period;
    }
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const k = 2 / (period + 1);
  ema[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function calculateSMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] || 0;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12[ema12.length - 1] - ema26[ema26.length - 1];
  const signal = macd * 0.9;
  return { macd, signal, histogram: macd - signal };
}

function calculateBollingerBands(closes: number[], period: number = 20): { upper: number; middle: number; lower: number; squeeze: boolean } {
  const sma = calculateSMA(closes, period);
  const slice = closes.slice(-period);
  const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = sma + (2 * stdDev);
  const lower = sma - (2 * stdDev);
  const squeeze = (upper - lower) / sma < 0.1;
  return { upper, middle: sma, lower, squeeze };
}

function calculateStochastic(highs: number[], lows: number[], closes: number[], period: number = 14): { k: number; d: number } {
  const highestHigh = Math.max(...highs.slice(-period));
  const lowestLow = Math.min(...lows.slice(-period));
  const currentClose = closes[closes.length - 1];
  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100 || 50;
  const d = k * 0.9;
  return { k, d };
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  const trueRanges: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const tr1 = highs[i] - lows[i];
    const tr2 = Math.abs(highs[i] - closes[i - 1]);
    const tr3 = Math.abs(lows[i] - closes[i - 1]);
    trueRanges.push(Math.max(tr1, tr2, tr3));
  }
  return calculateSMA(trueRanges, Math.min(period, trueRanges.length));
}

function calculateVWAP(closes: number[], volumes: number[]): number {
  let totalPV = 0, totalV = 0;
  for (let i = 0; i < closes.length; i++) {
    totalPV += closes[i] * volumes[i];
    totalV += volumes[i];
  }
  return totalV > 0 ? totalPV / totalV : closes[closes.length - 1];
}

function calculateOBV(closes: number[], volumes: number[]): number {
  let obv = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
  }
  return obv;
}

function calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  const highestHigh = Math.max(...highs.slice(-period));
  const lowestLow = Math.min(...lows.slice(-period));
  const currentClose = closes[closes.length - 1];
  return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100 || -50;
}

async function handleScanPost(req: VercelRequest, res: VercelResponse) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const symbol = body?.symbol || 'BTCUSDT';
    const timeframe = body?.timeframe || '4h';
    
    const klineResponse = await fetch(`${BINANCE_BASE}/klines?symbol=${symbol}&interval=${timeframe}&limit=100`);
    if (!klineResponse.ok) return sendError(res, 500, 'Failed to fetch market data');
    
    const klines = await klineResponse.json();
    const closes = klines.map((k: any[]) => parseFloat(k[4]));
    const highs = klines.map((k: any[]) => parseFloat(k[2]));
    const lows = klines.map((k: any[]) => parseFloat(k[3]));
    const volumes = klines.map((k: any[]) => parseFloat(k[5]));
    
    const currentPrice = closes[closes.length - 1];
    const rsi = calculateRSI(closes);
    const ema9 = calculateEMA(closes, 9);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);
    const avgVolume = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / avgVolume;
    
    const macd = calculateMACD(closes);
    const bb = calculateBollingerBands(closes);
    const stoch = calculateStochastic(highs, lows, closes);
    const atr = calculateATR(highs, lows, closes);
    const vwap = calculateVWAP(closes, volumes);
    const obv = calculateOBV(closes, volumes);
    const williamsR = calculateWilliamsR(highs, lows, closes);
    
    const high24h = Math.max(...highs.slice(-6));
    const low24h = Math.min(...lows.slice(-6));
    const priceChange = ((currentPrice - closes[closes.length - 7]) / closes[closes.length - 7]) * 100;
    const atrPercent = (atr / currentPrice) * 100;
    
    const breakdown = [
      {
        title: 'RSI (14)',
        value: Math.round(rsi),
        signal: rsi < 30 ? 'bullish' : rsi > 70 ? 'bearish' : 'neutral',
        reason: rsi < 30 ? 'Oversold - potential bounce' : rsi > 70 ? 'Overbought - potential pullback' : 'Neutral momentum'
      },
      {
        title: 'MACD',
        value: macd.histogram > 0 ? 'Bullish' : 'Bearish',
        signal: macd.histogram > 0 ? 'bullish' : 'bearish',
        reason: macd.histogram > 0 ? 'MACD above signal line - bullish momentum' : 'MACD below signal line - bearish momentum'
      },
      {
        title: 'EMA 9/20 Cross',
        value: ema9[ema9.length - 1] > ema20[ema20.length - 1] ? 'Bullish' : 'Bearish',
        signal: ema9[ema9.length - 1] > ema20[ema20.length - 1] ? 'bullish' : 'bearish',
        reason: ema9[ema9.length - 1] > ema20[ema20.length - 1] ? 'Fast EMA above slow - upward momentum' : 'Fast EMA below slow - downward momentum'
      },
      {
        title: 'EMA 20/50 Cross',
        value: ema20[ema20.length - 1] > ema50[ema50.length - 1] ? 'Bullish' : 'Bearish',
        signal: ema20[ema20.length - 1] > ema50[ema50.length - 1] ? 'bullish' : 'bearish',
        reason: ema20[ema20.length - 1] > ema50[ema50.length - 1] ? 'Short-term trend above medium-term' : 'Short-term trend below medium-term'
      },
      {
        title: 'Price vs EMA 200',
        value: currentPrice > ema200[ema200.length - 1] ? 'Above' : 'Below',
        signal: currentPrice > ema200[ema200.length - 1] ? 'bullish' : 'bearish',
        reason: currentPrice > ema200[ema200.length - 1] ? 'Long-term uptrend confirmed' : 'Long-term downtrend'
      },
      {
        title: 'Bollinger Bands',
        value: currentPrice > bb.upper ? 'Overbought' : currentPrice < bb.lower ? 'Oversold' : 'In Range',
        signal: currentPrice < bb.lower ? 'bullish' : currentPrice > bb.upper ? 'bearish' : 'neutral',
        reason: bb.squeeze ? 'Bollinger squeeze - breakout imminent' : currentPrice < bb.lower ? 'Price at lower band - potential bounce' : currentPrice > bb.upper ? 'Price at upper band - potential pullback' : 'Price within normal range'
      },
      {
        title: 'Stochastic',
        value: `${Math.round(stoch.k)}`,
        signal: stoch.k < 20 ? 'bullish' : stoch.k > 80 ? 'bearish' : 'neutral',
        reason: stoch.k < 20 ? 'Stochastic oversold - potential reversal' : stoch.k > 80 ? 'Stochastic overbought - watch for pullback' : 'Stochastic in neutral zone'
      },
      {
        title: 'Williams %R',
        value: `${Math.round(williamsR)}`,
        signal: williamsR < -80 ? 'bullish' : williamsR > -20 ? 'bearish' : 'neutral',
        reason: williamsR < -80 ? 'Deeply oversold' : williamsR > -20 ? 'Overbought territory' : 'Neutral range'
      },
      {
        title: 'VWAP',
        value: currentPrice > vwap ? 'Above' : 'Below',
        signal: currentPrice > vwap ? 'bullish' : 'bearish',
        reason: currentPrice > vwap ? 'Trading above VWAP - bullish intraday bias' : 'Trading below VWAP - bearish intraday bias'
      },
      {
        title: 'Volume',
        value: `${volumeRatio.toFixed(1)}x avg`,
        signal: volumeRatio > 1.5 ? 'bullish' : volumeRatio < 0.5 ? 'bearish' : 'neutral',
        reason: volumeRatio > 1.5 ? 'Above average volume - strong interest' : volumeRatio < 0.5 ? 'Low volume - weak conviction' : 'Normal volume'
      },
      {
        title: 'OBV Trend',
        value: obv > 0 ? 'Positive' : 'Negative',
        signal: obv > 0 ? 'bullish' : 'bearish',
        reason: obv > 0 ? 'Accumulation pattern detected' : 'Distribution pattern detected'
      },
      {
        title: 'Volatility (ATR)',
        value: `${atrPercent.toFixed(2)}%`,
        signal: atrPercent > 5 ? 'neutral' : atrPercent < 2 ? 'neutral' : 'neutral',
        reason: atrPercent > 5 ? 'High volatility - wider stops needed' : atrPercent < 2 ? 'Low volatility - tight range' : 'Normal volatility'
      },
      {
        title: '24h Change',
        value: `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`,
        signal: priceChange > 2 ? 'bullish' : priceChange < -2 ? 'bearish' : 'neutral',
        reason: priceChange > 2 ? 'Strong upward momentum' : priceChange < -2 ? 'Downward pressure' : 'Consolidating'
      },
      {
        title: 'Support Level',
        value: `$${low24h.toFixed(2)}`,
        signal: currentPrice > low24h * 1.02 ? 'bullish' : 'neutral',
        reason: `Recent low provides support at $${low24h.toFixed(2)}`
      },
      {
        title: 'Resistance Level',
        value: `$${high24h.toFixed(2)}`,
        signal: currentPrice < high24h * 0.98 ? 'bearish' : 'bullish',
        reason: `Recent high at $${high24h.toFixed(2)} - ${currentPrice >= high24h * 0.98 ? 'testing resistance' : 'room to run'}`
      }
    ];
    
    const bullishCount = breakdown.filter(b => b.signal === 'bullish').length;
    const bearishCount = breakdown.filter(b => b.signal === 'bearish').length;
    const overallSignal = bullishCount > bearishCount ? 'bullish' : bearishCount > bullishCount ? 'bearish' : 'neutral';
    
    return sendJson(res, {
      symbol,
      timeframe,
      price: currentPrice,
      breakdown,
      indicators: {
        rsi: { value: Math.round(rsi), signal: rsi < 30 ? 'bullish' : rsi > 70 ? 'bearish' : 'neutral' },
        macd: { value: macd.histogram, signal: macd.histogram > 0 ? 'bullish' : 'bearish' },
        ema9: { value: ema9[ema9.length - 1], signal: 'neutral' },
        ema20: { value: ema20[ema20.length - 1], signal: 'neutral' },
        ema50: { value: ema50[ema50.length - 1], signal: 'neutral' },
        ema200: { value: ema200[ema200.length - 1], signal: 'neutral' },
        bollingerBands: { upper: bb.upper, middle: bb.middle, lower: bb.lower, squeeze: bb.squeeze },
        stochastic: { k: stoch.k, d: stoch.d },
        atr: { value: atr, percent: atrPercent },
        vwap: { value: vwap, signal: currentPrice > vwap ? 'bullish' : 'bearish' },
        obv: { value: obv, signal: obv > 0 ? 'bullish' : 'bearish' },
        williamsR: { value: williamsR, signal: williamsR < -80 ? 'bullish' : williamsR > -20 ? 'bearish' : 'neutral' },
        volume: { value: volumeRatio, signal: volumeRatio > 1.5 ? 'bullish' : 'neutral' }
      },
      summary: {
        signal: overallSignal,
        bullish: bullishCount,
        bearish: bearishCount,
        neutral: breakdown.length - bullishCount - bearishCount
      }
    });
  } catch (e) {
    console.error('Scanner error:', e);
    return sendError(res, 500, 'Scanner failed');
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') { cors(res); return res.status(200).end(); }
  cors(res);

  const url = new URL(req.url || '', 'http://localhost');
  const pathname = url.pathname.replace('/api/scanner', '').replace(/^\//, '');

  if (pathname === 'scan' || pathname === '') {
    if (req.method === 'POST') {
      return handleScanPost(req, res);
    }
    
    try {
      const { symbols, timeframe = '4h', limit = 10 } = req.query;
      const symbolList = symbols ? (Array.isArray(symbols) ? symbols : [symbols]) : ['BTCUSDT', 'ETHUSDT'];

      const results = await Promise.all(
        (symbolList as string[]).slice(0, Number(limit)).map(async (symbol: string) => {
          try {
            const klineResponse = await fetch(`${BINANCE_BASE}/klines?symbol=${symbol}&interval=${timeframe}&limit=100`);
            if (!klineResponse.ok) return null;
            const klines = await klineResponse.json();
            const closes = klines.map((k: any[]) => parseFloat(k[4]));
            const volumes = klines.map((k: any[]) => parseFloat(k[5]));
            const rsi = calculateRSI(closes);
            const ema20 = calculateEMA(closes, 20);
            const ema50 = calculateEMA(closes, 50);
            const currentPrice = closes[closes.length - 1];
            const avgVolume = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
            const currentVolume = volumes[volumes.length - 1];

            return {
              symbol,
              price: currentPrice,
              rsi: Math.round(rsi * 100) / 100,
              ema20: Math.round(ema20[ema20.length - 1] * 100) / 100,
              ema50: Math.round(ema50[ema50.length - 1] * 100) / 100,
              trend: ema20[ema20.length - 1] > ema50[ema50.length - 1] ? 'bullish' : 'bearish',
              volumeRatio: Math.round((currentVolume / avgVolume) * 100) / 100,
              signal: rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral'
            };
          } catch { return null; }
        })
      );

      return sendJson(res, results.filter(Boolean));
    } catch {
      return sendError(res, 500, 'Scanner failed');
    }
  }

  sendError(res, 404, `Scanner endpoint not found: ${pathname}`);
}
