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

function getSignal(value: number, bullishThreshold: number, bearishThreshold: number): 'bullish' | 'bearish' | 'neutral' {
  if (value > bullishThreshold) return 'bullish';
  if (value < bearishThreshold) return 'bearish';
  return 'neutral';
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
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);
    const avgVolume = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / avgVolume;
    
    const high24h = Math.max(...highs.slice(-6));
    const low24h = Math.min(...lows.slice(-6));
    const priceChange = ((currentPrice - closes[closes.length - 7]) / closes[closes.length - 7]) * 100;
    
    const breakdown = [
      {
        title: 'RSI (14)',
        value: Math.round(rsi),
        signal: rsi < 30 ? 'bullish' : rsi > 70 ? 'bearish' : 'neutral',
        reason: rsi < 30 ? 'Oversold - potential bounce' : rsi > 70 ? 'Overbought - potential pullback' : 'Neutral momentum'
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
        reason: currentPrice > ema200[ema200.length - 1] ? 'Long-term uptrend' : 'Long-term downtrend'
      },
      {
        title: 'Volume',
        value: `${volumeRatio.toFixed(1)}x avg`,
        signal: volumeRatio > 1.5 ? 'bullish' : volumeRatio < 0.5 ? 'bearish' : 'neutral',
        reason: volumeRatio > 1.5 ? 'Above average volume - strong interest' : volumeRatio < 0.5 ? 'Low volume - weak conviction' : 'Normal volume'
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
        reason: `Recent low at $${low24h.toFixed(2)}`
      },
      {
        title: 'Resistance Level',
        value: `$${high24h.toFixed(2)}`,
        signal: currentPrice < high24h * 0.98 ? 'bearish' : 'neutral',
        reason: `Recent high at $${high24h.toFixed(2)}`
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
        ema20: { value: ema20[ema20.length - 1], signal: 'neutral' },
        ema50: { value: ema50[ema50.length - 1], signal: 'neutral' },
        ema200: { value: ema200[ema200.length - 1], signal: 'neutral' },
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
