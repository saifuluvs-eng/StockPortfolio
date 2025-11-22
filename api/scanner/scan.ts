import type { VercelRequest, VercelResponse } from "@vercel/node";

// ============= TECHNICAL INDICATOR CALCULATIONS =============

function calculateSMA(prices: number[], period: number): number {
  const slice = prices.slice(-period);
  return slice.reduce((sum, price) => sum + price, 0) / slice.length;
}

function calculateEMA(prices: number[], period: number): number {
  const multiplier = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
  }
  return ema;
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;
  const signal = macd * 0.9;
  const histogram = macd - signal;
  return { macd, signal, histogram };
}

function calculateBollingerBands(prices: number[], period: number = 20): { upper: number; middle: number; lower: number; squeeze: boolean } {
  const sma = calculateSMA(prices, period);
  const slice = prices.slice(-period);
  
  const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  
  const upper = sma + (2 * stdDev);
  const lower = sma - (2 * stdDev);
  const squeeze = (upper - lower) / sma < 0.1;

  return { upper, middle: sma, lower, squeeze };
}

function calculateVWAP(closes: number[], volumes: number[]): number {
  if (closes.length < 2) return closes[0];
  const slice = closes.slice(-20);
  const volSlice = volumes.slice(-20);
  
  let cumPV = 0;
  let cumV = 0;
  for (let i = 0; i < slice.length; i++) {
    cumPV += slice[i] * volSlice[i];
    cumV += volSlice[i];
  }
  return cumV === 0 ? closes[0] : cumPV / cumV;
}

function calculateADX(highs: number[], lows: number[], closes: number[]): { adx: number; plusDI: number; minusDI: number } {
  const period = 14;
  if (highs.length < period + 1) return { adx: 25, plusDI: 0, minusDI: 0 };

  let plusDM = 0, minusDM = 0;
  for (let i = 1; i < highs.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    
    if (upMove > downMove && upMove > 0) plusDM += upMove;
    else if (downMove > upMove && downMove > 0) minusDM += downMove;
  }

  const trueRange = calculateATR(highs, lows, closes);
  const plusDI = (plusDM / trueRange) * 100;
  const minusDI = (minusDM / trueRange) * 100;
  const adx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100 || 25;

  return { adx: Math.min(100, adx), plusDI, minusDI };
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  if (highs.length < period) return 0;
  
  let sumTR = 0;
  for (let i = 0; i < Math.min(period, highs.length); i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1] || closes[i]),
      Math.abs(lows[i] - closes[i - 1] || closes[i])
    );
    sumTR += tr;
  }
  return sumTR / period;
}

function calculateStochastic(highs: number[], lows: number[], closes: number[], period: number = 14): { k: number; d: number } {
  if (highs.length < period) return { k: 50, d: 50 };
  
  const slice = { highs: highs.slice(-period), lows: lows.slice(-period), closes: closes.slice(-period) };
  const highest = Math.max(...slice.highs);
  const lowest = Math.min(...slice.lows);
  
  const k = ((closes[closes.length - 1] - lowest) / (highest - lowest)) * 100 || 50;
  return { k: Math.min(100, Math.max(0, k)), d: k };
}

function calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  if (highs.length < period) return -50;
  
  const slice = { highs: highs.slice(-period), lows: lows.slice(-period) };
  const highest = Math.max(...slice.highs);
  const lowest = Math.min(...slice.lows);
  
  return ((closes[closes.length - 1] - highest) / (highest - lowest)) * -100 || -50;
}

function calculateCCI(highs: number[], lows: number[], closes: number[], period: number = 20): number {
  if (highs.length < period) return 0;
  
  const typicalPrices = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const sma = calculateSMA(typicalPrices, period);
  const slice = typicalPrices.slice(-period);
  
  const meanDev = slice.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;
  return meanDev === 0 ? 0 : (typicalPrices[typicalPrices.length - 1] - sma) / (0.015 * meanDev);
}

function calculateMFI(highs: number[], lows: number[], closes: number[], volumes: number[], period: number = 14): number {
  if (highs.length < period) return 50;
  
  let positiveMF = 0, negativeMF = 0;
  for (let i = 1; i < Math.min(period + 1, highs.length); i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    const prevTp = (highs[i - 1] + lows[i - 1] + closes[i - 1]) / 3;
    const mf = tp * volumes[i];
    
    if (tp > prevTp) positiveMF += mf;
    else if (tp < prevTp) negativeMF += mf;
  }
  
  if (negativeMF === 0) return 100;
  const mr = positiveMF / negativeMF;
  return 100 - (100 / (1 + mr));
}

function calculateOBV(closes: number[], volumes: number[]): number {
  let obv = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
  }
  return obv;
}

function calculateParabolicSAR(highs: number[], lows: number[], closes: number[]): { sar: number; trend: 'bullish' | 'bearish' } {
  if (highs.length < 3) return { sar: closes[closes.length - 1], trend: 'bullish' };
  
  const trend = closes[closes.length - 1] > closes[closes.length - 2] ? 'bullish' : 'bearish';
  const extreme = trend === 'bullish' ? Math.max(...highs.slice(-5)) : Math.min(...lows.slice(-5));
  
  let sar = trend === 'bullish' ? Math.min(...lows.slice(-3)) : Math.max(...highs.slice(-3));
  sar = sar + 0.02 * (extreme - sar);
  
  return { sar: Math.max(0, sar), trend };
}

function calculateVolumeOscillator(volumes: number[]): number {
  if (volumes.length < 20) return 0;
  
  const short = calculateSMA(volumes, 12);
  const long = calculateSMA(volumes, 26);
  return long === 0 ? 0 : ((short - long) / long) * 100;
}

// ============= API HANDLER =============

async function fetchKlines(symbol: string, interval: string): Promise<any[]> {
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
    
    return data.map((k: any[]) => ({
      time: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[7]),
    }));
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

    // Map timeframe to Binance interval
    let interval = "4h";
    if (timeframe === "1h" || timeframe === "1") interval = "1h";
    else if (timeframe === "15m" || timeframe === "15") interval = "15m";
    else if (timeframe === "1d" || timeframe === "1day" || timeframe === "d") interval = "1d";
    else if (timeframe === "15min") interval = "15m";
    
    // Fetch real market data from Binance
    const klines = await fetchKlines(symbol, interval);
    
    if (klines.length < 10) {
      console.warn(`Not enough data for ${symbol}: got ${klines.length} candles`);
      return res.status(400).json({ error: `Insufficient data for ${symbol}. Try another symbol.` });
    }

    const opens = klines.map(k => k.open);
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);
    const closes = klines.map(k => k.close);
    const volumes = klines.map(k => k.volume);
    
    const currentPrice = closes[closes.length - 1];

    // Calculate ALL 15 indicators
    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const bb = calculateBollingerBands(closes);
    const vwap = calculateVWAP(closes, volumes);
    const adx = calculateADX(highs, lows, closes);
    const stoch = calculateStochastic(highs, lows, closes);
    const williamsR = calculateWilliamsR(highs, lows, closes);
    const cci = calculateCCI(highs, lows, closes);
    const mfi = calculateMFI(highs, lows, closes, volumes);
    const obv = calculateOBV(closes, volumes);
    const atr = calculateATR(highs, lows, closes);
    const psar = calculateParabolicSAR(highs, lows, closes);
    const volOsc = calculateVolumeOscillator(volumes);

    // Calculate scores
    let totalScore = 0;

    const indicators = {
      vwap: {
        value: vwap,
        signal: currentPrice > vwap ? 'bullish' : 'bearish',
        score: currentPrice > vwap ? 1 : -1,
        tier: 3,
        description: `Price ${currentPrice > vwap ? 'above' : 'below'} VWAP (${vwap.toFixed(2)})`
      },
      rsi: {
        value: rsi,
        signal: rsi > 30 && rsi < 70 ? 'neutral' : rsi >= 70 ? 'bearish' : 'bullish',
        score: rsi > 30 && rsi < 70 ? 0 : rsi >= 70 ? -2 : 2,
        tier: 2,
        description: `RSI: ${rsi.toFixed(1)} - ${rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Normal'}`
      },
      macd: {
        value: macd.macd,
        signal: macd.macd > macd.signal ? 'bullish' : 'bearish',
        score: macd.macd > macd.signal ? 9 : -9,
        tier: 1,
        description: `MACD ${macd.macd > macd.signal ? 'above' : 'below'} signal line`
      },
      ema_crossover: {
        value: ema20 - ema50,
        signal: ema20 > ema50 ? 'bullish' : 'bearish',
        score: ema20 > ema50 ? 9 : -9,
        tier: 1,
        description: `EMA20 ${ema20 > ema50 ? 'above' : 'below'} EMA50`
      },
      bb_squeeze: {
        value: bb.squeeze ? 1 : 0,
        signal: bb.squeeze ? 'bullish' : 'neutral',
        score: bb.squeeze ? 1 : 0,
        tier: 2,
        description: `Bollinger Bands ${bb.squeeze ? 'in squeeze' : 'normal'}`
      },
      adx: {
        value: adx.adx,
        signal: adx.adx > 25 ? 'bullish' : 'neutral',
        score: adx.adx > 25 ? 3 : 0,
        tier: 1,
        description: `ADX: ${adx.adx.toFixed(1)} - ${adx.adx > 25 ? 'Strong trend' : 'Weak trend'}`
      },
      plus_di: {
        value: adx.plusDI,
        signal: adx.plusDI > adx.minusDI ? 'bullish' : 'bearish',
        score: adx.plusDI > adx.minusDI ? 2 : -2,
        tier: 2,
        description: `+DI (${adx.plusDI.toFixed(1)}) vs -DI (${adx.minusDI.toFixed(1)})`
      },
      stochastic: {
        value: stoch.k,
        signal: stoch.k > 80 ? 'bearish' : stoch.k < 20 ? 'bullish' : 'neutral',
        score: stoch.k > 80 ? -1 : stoch.k < 20 ? 2 : 0,
        tier: 2,
        description: `Stochastic %K: ${stoch.k.toFixed(1)} - ${stoch.k > 80 ? 'Overbought' : stoch.k < 20 ? 'Oversold' : 'Normal'}`
      },
      williams_r: {
        value: williamsR,
        signal: williamsR > -20 ? 'bearish' : williamsR < -80 ? 'bullish' : 'neutral',
        score: williamsR > -20 ? -1 : williamsR < -80 ? 2 : 0,
        tier: 2,
        description: `Williams %R: ${williamsR.toFixed(1)} - ${williamsR > -20 ? 'Overbought' : williamsR < -80 ? 'Oversold' : 'Normal'}`
      },
      cci: {
        value: cci,
        signal: cci > 100 ? 'bearish' : cci < -100 ? 'bullish' : 'neutral',
        score: cci > 100 ? -2 : cci < -100 ? 3 : 0,
        tier: 2,
        description: `CCI: ${cci.toFixed(1)} - ${cci > 100 ? 'Overbought' : cci < -100 ? 'Oversold' : 'Normal'}`
      },
      mfi: {
        value: mfi,
        signal: mfi > 80 ? 'bearish' : mfi < 20 ? 'bullish' : 'neutral',
        score: mfi > 80 ? -2 : mfi < 20 ? 3 : 0,
        tier: 1,
        description: `MFI: ${mfi.toFixed(1)} - ${mfi > 80 ? 'Overbought' : mfi < 20 ? 'Oversold' : 'Normal'}`
      },
      obv: {
        value: obv,
        signal: obv > 0 ? 'bullish' : 'bearish',
        score: obv > 0 ? 1 : -1,
        tier: 3,
        description: `OBV: ${obv.toFixed(0)} - Volume ${obv > 0 ? 'supporting uptrend' : 'supporting downtrend'}`
      },
      atr: {
        value: atr,
        signal: 'neutral' as const,
        score: 0,
        tier: 3,
        description: `ATR: ${atr.toFixed(4)} - Market volatility indicator`
      },
      parabolic_sar: {
        value: psar.sar,
        signal: psar.trend,
        score: psar.trend === 'bullish' ? 2 : -2,
        tier: 2,
        description: `PSAR: ${psar.sar.toFixed(2)} - ${psar.trend === 'bullish' ? 'Uptrend' : 'Downtrend'} signal`
      },
      volume_oscillator: {
        value: volOsc,
        signal: volOsc > 0 ? 'bullish' : 'bearish',
        score: volOsc > 5 ? 1 : volOsc < -5 ? -1 : 0,
        tier: 3,
        description: `Volume Osc: ${volOsc.toFixed(2)}% - ${volOsc > 0 ? 'Above' : 'Below'} average volume`
      }
    };

    // Calculate total score
    totalScore = Object.values(indicators).reduce((sum, ind) => sum + ind.score, 0);

    // Determine recommendation
    let recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    if (totalScore >= 15) recommendation = 'strong_buy';
    else if (totalScore >= 5) recommendation = 'buy';
    else if (totalScore <= -15) recommendation = 'strong_sell';
    else if (totalScore <= -5) recommendation = 'sell';
    else recommendation = 'hold';

    const analysis = {
      symbol,
      price: currentPrice,
      timeframe,
      indicators,
      totalScore,
      recommendation,
      calculationTimestamp: new Date().toISOString(),
      latestDataTime: new Date(klines[klines.length - 1].time).toISOString(),
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
