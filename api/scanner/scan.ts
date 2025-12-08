import { createHandler, sendJson, sendError } from '../lib/serverless';

const BINANCE_BASE = 'https://api.binance.com/api/v3';

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

function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  ema[0] = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }
  return ema;
}

export default createHandler(async (req, res) => {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const { symbol, timeframe = '4h' } = req.body || {};
    
    if (!symbol) {
      return sendError(res, 400, 'Symbol is required');
    }

    const klineResponse = await fetch(`${BINANCE_BASE}/klines?symbol=${symbol}&interval=${timeframe}&limit=100`);
    if (!klineResponse.ok) {
      return sendError(res, 404, `No data found for ${symbol}`);
    }

    const klines = await klineResponse.json();
    const closes = klines.map((k: any[]) => parseFloat(k[4]));
    const highs = klines.map((k: any[]) => parseFloat(k[2]));
    const lows = klines.map((k: any[]) => parseFloat(k[3]));
    const volumes = klines.map((k: any[]) => parseFloat(k[5]));
    
    const currentPrice = closes[closes.length - 1];
    const rsi = calculateRSI(closes);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    
    const ema20Current = ema20[ema20.length - 1];
    const ema50Current = ema50[ema50.length - 1];
    
    const priceChange = ((currentPrice - closes[0]) / closes[0]) * 100;
    const avgVolume = volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / avgVolume;

    let totalScore = 50;
    if (rsi < 30) totalScore += 15;
    else if (rsi > 70) totalScore -= 15;
    if (currentPrice > ema20Current) totalScore += 10;
    if (currentPrice > ema50Current) totalScore += 10;
    if (ema20Current > ema50Current) totalScore += 10;
    if (volumeRatio > 1.5) totalScore += 5;
    if (priceChange > 0) totalScore += Math.min(priceChange, 10);

    const recommendation = 
      totalScore >= 75 ? 'strong_buy' :
      totalScore >= 60 ? 'buy' :
      totalScore >= 40 ? 'hold' :
      totalScore >= 25 ? 'sell' : 'strong_sell';

    const candles = klines.slice(-50).map((k: any[]) => ({
      t: k[0],
      o: parseFloat(k[1]),
      h: parseFloat(k[2]),
      l: parseFloat(k[3]),
      c: parseFloat(k[4]),
      v: parseFloat(k[5])
    }));

    sendJson(res, {
      symbol,
      price: currentPrice,
      indicators: {
        rsi: { value: Math.round(rsi * 100) / 100, signal: rsi < 30 ? 'bullish' : rsi > 70 ? 'bearish' : 'neutral', score: rsi < 30 ? 15 : rsi > 70 ? -15 : 0, tier: 1, description: `RSI: ${Math.round(rsi)}` },
        ema20: { value: Math.round(ema20Current * 10000) / 10000, signal: currentPrice > ema20Current ? 'bullish' : 'bearish', score: currentPrice > ema20Current ? 10 : -10, tier: 1, description: `EMA20: ${ema20Current.toFixed(4)}` },
        ema50: { value: Math.round(ema50Current * 10000) / 10000, signal: currentPrice > ema50Current ? 'bullish' : 'bearish', score: currentPrice > ema50Current ? 10 : -10, tier: 2, description: `EMA50: ${ema50Current.toFixed(4)}` },
        volume: { value: volumeRatio, signal: volumeRatio > 1.5 ? 'bullish' : 'neutral', score: volumeRatio > 1.5 ? 5 : 0, tier: 2, description: `Volume ratio: ${volumeRatio.toFixed(2)}x` }
      },
      totalScore: Math.round(totalScore),
      recommendation,
      candles,
      calculationTimestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Scanner] Error:', error);
    sendError(res, 500, 'Failed to scan symbol');
  }
});
