import type { VercelRequest, VercelResponse } from "@vercel/node";

// Technical indicator calculations
function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(Math.max(diff, 0));
    losses.push(Math.max(-diff, 0));
  }
  
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  
  return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
}

function calculateEMA(data: number[], period: number): number[] {
  if (data.length < period) return [];
  const ema: number[] = [];
  const k = 2 / (period + 1);
  
  let sma = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  ema.push(sma);
  
  for (let i = period; i < data.length; i++) {
    sma = data[i] * k + sma * (1 - k);
    ema.push(sma);
  }
  
  return ema;
}

function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  
  if (ema12.length === 0 || ema26.length === 0) {
    return { macd: 0, signal: 0, histogram: 0 };
  }
  
  const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
  const signalLine = (macdLine + (ema12[ema12.length - 2] || 0) - (ema26[ema26.length - 2] || 0)) / 2;
  
  return { macd: macdLine, signal: signalLine, histogram: macdLine - signalLine };
}

function calculateBollingerBands(closes: number[], period = 20): { upper: number; middle: number; lower: number } {
  if (closes.length < period) {
    const val = closes[closes.length - 1];
    return { upper: val, middle: val, lower: val };
  }
  
  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, v) => a + Math.pow(v - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  
  return {
    upper: sma + 2 * stdDev,
    middle: sma,
    lower: sma - 2 * stdDev,
  };
}

async function fetchKlines(symbol: string, interval: string): Promise<number[][]> {
  try {
    const sym = String(symbol).trim().toUpperCase();
    if (!sym) return [];
    
    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(interval)}&limit=100`;
    const response = await fetch(url, { cache: "no-store" });
    
    if (!response.ok) {
      console.error(`Binance error for ${sym}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    if (!Array.isArray(data) || data.length < 10) {
      console.error(`Insufficient data for ${sym}: got ${data?.length || 0} candles`);
      return [];
    }
    
    return data.map((k: any[]) => [
      parseFloat(k[1]),
      parseFloat(k[2]),
      parseFloat(k[3]),
      parseFloat(k[4]),
      parseFloat(k[7]),
    ]);
  } catch (error) {
    console.error("Binance fetch error:", error);
    return [];
  }
}

export default async (req: VercelRequest, res: VercelResponse) => {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");
  
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const symbol = String(body.symbol || "").trim().toUpperCase();
    const timeframe = String(body.timeframe || "4h").toLowerCase();

    if (!symbol) {
      return res.status(400).json({ error: "Missing symbol field" });
    }

    // Map timeframe to interval
    let interval = "4h";
    if (timeframe === "1h" || timeframe === "1") interval = "1h";
    else if (timeframe === "15m" || timeframe === "15") interval = "15m";
    else if (timeframe === "1d" || timeframe === "1day") interval = "1d";
    
    // Fetch real market data from Binance
    const klines = await fetchKlines(symbol, interval);
    
    if (klines.length < 10) {
      console.warn(`Not enough data for ${symbol}: got ${klines.length} candles`);
      return res.status(400).json({ error: `Insufficient data for ${symbol}. Got ${klines.length} candles, need at least 10.` });
    }

    const closes = klines.map(k => k[3]);
    const highLow = klines.map(k => [k[1], k[2]]);
    
    const currentClose = closes[closes.length - 1];
    const recentHighs = highLow.slice(-10).map(h => h[0]);
    const recentLows = highLow.slice(-10).map(h => h[1]);
    const currentHigh = Math.max(...recentHighs);
    const currentLow = Math.min(...recentLows);

    // Calculate indicators
    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);
    const bb = calculateBollingerBands(closes);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    
    const emaSignal =
      ema20.length > 0 && ema50.length > 0 && ema20[ema20.length - 1] > ema50[ema50.length - 1]
        ? "bullish"
        : "bearish";

    // Calculate scores
    let totalScore = 50; 
    
    if (rsi < 30) totalScore -= 15;
    else if (rsi > 70) totalScore -= 10;
    else if (rsi > 50) totalScore += 5;
    
    if (macd.histogram > 0) totalScore += 10;
    else totalScore -= 5;
    
    if (currentClose > bb.upper) totalScore -= 5;
    else if (currentClose < bb.lower) totalScore += 5;
    
    if (emaSignal === "bullish") totalScore += 10;
    else totalScore -= 10;

    const recommendation = totalScore > 65 ? "strong_buy" : totalScore > 55 ? "buy" : totalScore < 35 ? "strong_sell" : totalScore < 45 ? "sell" : "hold";

    const analysis = {
      symbol,
      price: currentClose,
      timeframe,
      indicators: {
        rsi: {
          value: Math.round(rsi * 100) / 100,
          signal: rsi < 30 ? "oversold" : rsi > 70 ? "overbought" : "neutral",
          score: rsi < 30 ? 2 : rsi > 70 ? -2 : 0,
          description: `RSI: ${Math.round(rsi)} - ${rsi < 30 ? "Oversold" : rsi > 70 ? "Overbought" : "Normal"}`,
        },
        macd: {
          value: Math.round(macd.histogram * 100) / 100,
          signal: macd.histogram > 0 ? "bullish" : "bearish",
          score: macd.histogram > 0 ? 2 : -2,
          description: `MACD Histogram: ${Math.round(macd.histogram * 100) / 100}`,
        },
        ema_crossover: {
          value: emaSignal === "bullish" ? 1 : -1,
          signal: emaSignal,
          score: emaSignal === "bullish" ? 3 : -3,
          description: `EMA20 ${emaSignal === "bullish" ? ">" : "<"} EMA50`,
        },
        bb_bands: {
          value: currentClose > bb.upper ? 1 : currentClose < bb.lower ? -1 : 0,
          signal: currentClose > bb.upper ? "overbought" : currentClose < bb.lower ? "oversold" : "neutral",
          score: currentClose > bb.upper ? -1 : currentClose < bb.lower ? 1 : 0,
          description: `Price at BB: ${(((currentClose - bb.lower) / (bb.upper - bb.lower)) * 100).toFixed(1)}%`,
        },
        price_action: {
          value: currentHigh > currentLow ? (((currentClose - currentLow) / (currentHigh - currentLow)) * 100) : 50,
          signal: currentClose > (currentLow + currentHigh) / 2 ? "bullish" : "bearish",
          score: currentClose > (currentLow + currentHigh) / 2 ? 1 : -1,
          description: `Price Position: ${(((currentClose - currentLow) / (currentHigh - currentLow)) * 100).toFixed(1)}%`,
        },
        volatility: {
          value: currentClose > 0 ? ((currentHigh - currentLow) / currentClose * 100) : 0,
          signal: "neutral",
          score: 0,
          description: `Volatility: ${(currentClose > 0 ? ((currentHigh - currentLow) / currentClose * 100) : 0).toFixed(2)}%`,
        },
      },
      totalScore: Math.max(0, Math.min(100, totalScore)),
      recommendation,
      calculationTimestamp: new Date().toISOString(),
      latestDataTime: new Date().toISOString(),
    };

    res.setHeader("Cache-Control", "private, max-age=30");
    return res.status(200).json(analysis);
  } catch (error: any) {
    console.error("POST /api/scanner/scan failed", error?.message || error);
    return res.status(500).json({
      error: "server_error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
