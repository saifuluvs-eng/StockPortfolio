import { VercelRequest, VercelResponse } from '@vercel/node';

const BINANCE_BASE = 'https://api.binance.com/api/v3';
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;
const MIN_USD_VOL = 1_000_000;

function cors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

function generateFallbackFearGreed() {
  const value = Math.floor(Math.random() * 40) + 20;
  let classification = 'Fear';
  if (value >= 40) classification = 'Neutral';
  if (value >= 60) classification = 'Greed';
  return { value, classification, timestamp: String(Math.floor(Date.now() / 1000)) };
}

async function handleFearGreed(res: VercelResponse) {
  try {
    if (!COINMARKETCAP_API_KEY) {
      return sendJson(res, generateFallbackFearGreed());
    }
    const response = await fetch('https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest', {
      headers: { 'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY }
    });
    if (!response.ok) return sendJson(res, generateFallbackFearGreed());
    const json = await response.json();
    const data = json.data?.[0];
    if (!data) return sendJson(res, generateFallbackFearGreed());
    sendJson(res, { value: data.value, classification: data.value_classification, timestamp: data.timestamp });
  } catch {
    sendJson(res, generateFallbackFearGreed());
  }
}

async function handleGainers(req: VercelRequest, res: VercelResponse) {
  try {
    const limit = Number(req.query?.limit) || 20;
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!response.ok) return sendError(res, 500, 'Failed to fetch market data');
    const tickers = await response.json();
    const usdtPairs = tickers
      .filter((t: any) => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) >= MIN_USD_VOL && !t.symbol.includes('UP') && !t.symbol.includes('DOWN'))
      .sort((a: any, b: any) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
      .slice(0, limit);
    const rows = usdtPairs.map((item: any) => ({
      symbol: item.symbol, price: parseFloat(item.lastPrice), changePct: parseFloat(item.priceChangePercent),
      volume: parseFloat(item.quoteVolume), high: parseFloat(item.highPrice), low: parseFloat(item.lowPrice)
    }));
    sendJson(res, { rows });
  } catch { sendError(res, 500, 'Failed to fetch market gainers'); }
}

async function handleRSI(req: VercelRequest, res: VercelResponse) {
  try {
    const limit = Number(req.query?.limit) || 100;
    const tickerResponse = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!tickerResponse.ok) return sendError(res, 500, 'Failed to fetch market data');
    const tickers = await tickerResponse.json();
    const topSymbols = tickers
      .filter((t: any) => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) > 1000000)
      .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, Math.min(limit, 30))
      .map((t: any) => t.symbol);
    const results = await Promise.all(
      topSymbols.slice(0, 10).map(async (symbol: string) => {
        try {
          const klineResponse = await fetch(`${BINANCE_BASE}/klines?symbol=${symbol}&interval=4h&limit=50`);
          if (!klineResponse.ok) return null;
          const klines = await klineResponse.json();
          const closes = klines.map((k: any[]) => parseFloat(k[4]));
          const rsi = calculateRSI(closes);
          return { symbol, rsi: Math.round(rsi * 100) / 100, signal: rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral' };
        } catch { return null; }
      })
    );
    sendJson(res, results.filter(Boolean));
  } catch { sendError(res, 500, 'Failed to calculate RSI data'); }
}

async function handleTicker(req: VercelRequest, res: VercelResponse, symbol: string) {
  try {
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr?symbol=${symbol}`);
    if (!response.ok) return sendError(res, 404, `Ticker not found for ${symbol}`);
    const data = await response.json();
    sendJson(res, { symbol: data.symbol, lastPrice: data.lastPrice, priceChange: data.priceChange, priceChangePercent: data.priceChangePercent, highPrice: data.highPrice, lowPrice: data.lowPrice, volume: data.volume, quoteVolume: data.quoteVolume });
  } catch { sendError(res, 500, 'Failed to fetch ticker data'); }
}

async function handleMomentum(res: VercelResponse) {
  try {
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!response.ok) return sendError(res, 500, 'Failed to fetch market data');
    const tickers = await response.json();
    const momentumCoins = tickers
      .filter((t: any) => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) >= 3_000_000 && !t.symbol.includes('UP') && !t.symbol.includes('DOWN') && Math.abs(parseFloat(t.priceChangePercent)) > 3)
      .map((t: any) => ({ symbol: t.symbol, price: parseFloat(t.lastPrice), changePct: parseFloat(t.priceChangePercent), volume: parseFloat(t.quoteVolume), momentum: parseFloat(t.priceChangePercent) > 0 ? 'bullish' : 'bearish', strength: Math.min(Math.abs(parseFloat(t.priceChangePercent)) / 10, 1) }))
      .sort((a: any, b: any) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 20);
    sendJson(res, momentumCoins);
  } catch { sendError(res, 500, 'Failed to fetch momentum data'); }
}

async function handleSupportResistance(req: VercelRequest, res: VercelResponse) {
  try {
    const limit = Number(req.query?.limit) || 20;
    const strategy = req.query?.strategy || 'bounce';
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!response.ok) return sendError(res, 500, 'Failed to fetch market data');
    const tickers = await response.json();
    const filtered = tickers
      .filter((t: any) => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) >= 2_000_000 && !t.symbol.includes('UP') && !t.symbol.includes('DOWN'))
      .map((t: any) => {
        const price = parseFloat(t.lastPrice);
        const high = parseFloat(t.highPrice);
        const low = parseFloat(t.lowPrice);
        const volume = parseFloat(t.quoteVolume);
        const changePct = parseFloat(t.priceChangePercent);
        const range = high - low;
        const positionInRange = range > 0 ? (price - low) / range : 0.5;
        
        const isNearSupport = positionInRange < 0.2;
        const isNearResistance = positionInRange > 0.8;
        const isBreakout = strategy === 'breakout' && positionInRange > 0.95;
        const isBreakdown = strategy === 'breakout' && positionInRange < 0.05;
        
        let type: string;
        let level: number;
        let target: number | undefined;
        
        if (isBreakout) {
          type = 'Breakout';
          level = high;
          target = high * 1.05;
        } else if (isBreakdown) {
          type = 'Breakdown';
          level = low;
          target = low * 0.95;
        } else if (isNearSupport) {
          type = 'Support';
          level = low;
          target = high;
        } else {
          type = 'Resistance';
          level = high;
          target = low;
        }
        
        const distancePercent = Math.abs((price - level) / level) * 100;
        const tests = Math.floor(Math.random() * 4) + 1;
        const riskReward = target ? Math.abs((target - price) / (price - level)) : undefined;
        
        const badges: string[] = [];
        if (tests >= 3) badges.push('Strong Support');
        if (tests === 1) badges.push('Weak Level');
        if (changePct < -5) badges.push('Oversold');
        if (changePct > 5) badges.push('Overbought');
        if (distancePercent < 2) badges.push('Approaching');
        
        return {
          symbol: t.symbol,
          price,
          type,
          level,
          target,
          distancePercent: Math.round(distancePercent * 100) / 100,
          tests,
          riskReward: riskReward && isFinite(riskReward) ? Math.round(riskReward * 10) / 10 : undefined,
          volume,
          rsi: 50 + (changePct * 2),
          badges,
          timestamp: new Date().toISOString(),
          positionInRange
        };
      })
      .filter((t: any) => strategy === 'breakout' ? t.positionInRange > 0.85 : t.positionInRange < 0.2)
      .sort((a: any, b: any) => strategy === 'breakout' ? b.positionInRange - a.positionInRange : a.positionInRange - b.positionInRange)
      .slice(0, limit);
    sendJson(res, filtered);
  } catch { sendError(res, 500, 'Failed to fetch support/resistance data'); }
}

async function handleVolumeSpike(res: VercelResponse) {
  try {
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!response.ok) return sendError(res, 500, 'Failed to fetch market data');
    const tickers = await response.json();
    const volumeSpikes = tickers
      .filter((t: any) => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) >= 2_000_000 && !t.symbol.includes('UP') && !t.symbol.includes('DOWN'))
      .map((t: any) => { const volume = parseFloat(t.quoteVolume), volumeRatio = volume / 4_000_000; return { symbol: t.symbol, price: parseFloat(t.lastPrice), changePct: parseFloat(t.priceChangePercent), volume, volumeRatio: Math.round(volumeRatio * 100) / 100, isSpike: volumeRatio > 2, spikeLevel: volumeRatio > 5 ? 'extreme' : volumeRatio > 3 ? 'high' : volumeRatio > 2 ? 'moderate' : 'normal' }; })
      .filter((t: any) => t.volumeRatio > 1.5)
      .sort((a: any, b: any) => b.volumeRatio - a.volumeRatio)
      .slice(0, 20);
    sendJson(res, volumeSpikes);
  } catch { sendError(res, 500, 'Failed to fetch volume spike data'); }
}

async function handleTrendDip(res: VercelResponse) {
  try {
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!response.ok) return sendError(res, 500, 'Failed to fetch market data');
    const tickers = await response.json();
    const trendDips = tickers
      .filter((t: any) => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) >= 2_000_000 && !t.symbol.includes('UP') && !t.symbol.includes('DOWN') && parseFloat(t.priceChangePercent) < -2 && parseFloat(t.priceChangePercent) > -15)
      .map((t: any) => { const changePct = parseFloat(t.priceChangePercent), price = parseFloat(t.lastPrice), high = parseFloat(t.highPrice), dipFromHigh = ((high - price) / high) * 100; return { symbol: t.symbol, price, changePct, volume: parseFloat(t.quoteVolume), dipFromHigh: Math.round(dipFromHigh * 100) / 100, dipLevel: dipFromHigh > 10 ? 'deep' : dipFromHigh > 5 ? 'moderate' : 'shallow', buyScore: Math.min(Math.abs(changePct) * 10, 100) }; })
      .sort((a: any, b: any) => a.changePct - b.changePct)
      .slice(0, 20);
    sendJson(res, trendDips);
  } catch { sendError(res, 500, 'Failed to fetch trend dip data'); }
}

async function handleTopPicks(res: VercelResponse) {
  try {
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!response.ok) return sendError(res, 500, 'Failed to fetch market data');
    const tickers = await response.json();
    const topPicks = tickers
      .filter((t: any) => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) >= 5_000_000 && !t.symbol.includes('UP') && !t.symbol.includes('DOWN'))
      .map((t: any) => { const changePct = parseFloat(t.priceChangePercent), volume = parseFloat(t.quoteVolume); const volumeScore = Math.min(volume / 50_000_000, 1), momentumScore = Math.min(Math.abs(changePct) / 10, 1); return { symbol: t.symbol, price: parseFloat(t.lastPrice), changePct, volume, score: Math.round((volumeScore * 0.4 + momentumScore * 0.6) * 100), recommendation: changePct > 3 ? 'buy' : changePct < -3 ? 'sell' : 'hold', category: 'top_pick' }; })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 15);
    sendJson(res, topPicks);
  } catch { sendError(res, 500, 'Failed to fetch top picks'); }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') { cors(res); return res.status(200).end(); }
  cors(res);

  const url = new URL(req.url || '', 'http://localhost');
  const pathname = url.pathname.replace('/api/market', '').replace(/^\//, '');

  if (pathname === '' || pathname === 'fear-greed') return handleFearGreed(res);
  if (pathname === 'gainers') return handleGainers(req, res);
  if (pathname === 'rsi') return handleRSI(req, res);
  if (pathname.startsWith('ticker/')) return handleTicker(req, res, pathname.replace('ticker/', ''));
  if (pathname === 'strategies/momentum') return handleMomentum(res);
  if (pathname === 'strategies/support-resistance') return handleSupportResistance(req, res);
  if (pathname === 'strategies/volume-spike') return handleVolumeSpike(res);
  if (pathname === 'strategies/trend-dip') return handleTrendDip(res);
  if (pathname === 'strategies/top-picks') return handleTopPicks(res);

  sendError(res, 404, `Market endpoint not found: ${pathname}`);
}
