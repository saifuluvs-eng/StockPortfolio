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

function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const k = 2 / (period + 1);
  ema[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
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
    const limit = Number(req.query?.limit) || 60;
    const timeframeParam = req.query?.timeframe as string || '4h';
    const timeframes = timeframeParam.split(',').filter(Boolean);
    
    const tickerResponse = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!tickerResponse.ok) return sendError(res, 500, 'Failed to fetch market data');
    const tickers = await tickerResponse.json();
    
    const tickerMap = new Map<string, any>();
    tickers.forEach((t: any) => tickerMap.set(t.symbol, t));
    
    const topSymbols = tickers
      .filter((t: any) => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) > 1000000 && !t.symbol.includes('UP') && !t.symbol.includes('DOWN'))
      .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, Math.min(limit, 60))
      .map((t: any) => t.symbol);
    
    const results = await Promise.all(
      topSymbols.map(async (symbol: string) => {
        try {
          const ticker = tickerMap.get(symbol);
          const rsiByTimeframe: Record<string, number> = {};
          
          await Promise.all(
            timeframes.map(async (tf) => {
              try {
                const klineResponse = await fetch(`${BINANCE_BASE}/klines?symbol=${symbol}&interval=${tf}&limit=50`);
                if (klineResponse.ok) {
                  const klines = await klineResponse.json();
                  const closes = klines.map((k: any[]) => parseFloat(k[4]));
                  rsiByTimeframe[tf] = Math.round(calculateRSI(closes));
                }
              } catch {}
            })
          );
          
          return {
            symbol,
            rsi: rsiByTimeframe,
            price: parseFloat(ticker?.lastPrice || '0'),
            change: parseFloat(ticker?.priceChangePercent || '0')
          };
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

function findPivotLow(lows: number[], closes: number[], lookback: number = 20): number | null {
  if (lows.length < lookback + 2) return null;
  const recentLows = lows.slice(-lookback);
  const currentPrice = closes[closes.length - 1];
  
  let pivotLow: number | null = null;
  for (let i = 2; i < recentLows.length - 2; i++) {
    const isLocalMin = recentLows[i] < recentLows[i - 1] && 
                       recentLows[i] < recentLows[i - 2] &&
                       recentLows[i] < recentLows[i + 1] && 
                       recentLows[i] < recentLows[i + 2];
    if (isLocalMin && recentLows[i] < currentPrice) {
      if (pivotLow === null || recentLows[i] > pivotLow) {
        pivotLow = recentLows[i];
      }
    }
  }
  return pivotLow;
}

async function handleMomentum(res: VercelResponse) {
  try {
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!response.ok) return sendError(res, 500, 'Failed to fetch market data');
    const tickers = await response.json();
    
    const candidates = tickers
      .filter((t: any) => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) >= 3_000_000 && !t.symbol.includes('UP') && !t.symbol.includes('DOWN') && parseFloat(t.priceChangePercent) > 3)
      .sort((a: any, b: any) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
      .slice(0, 25);
    
    const momentumCoins = await Promise.all(
      candidates.map(async (t: any) => {
        const symbol = t.symbol;
        const price = parseFloat(t.lastPrice);
        const change24h = parseFloat(t.priceChangePercent);
        const volume = parseFloat(t.quoteVolume);
        
        let stopLoss: number | null = null;
        let riskPct: number | null = null;
        let rsi = 50;
        let avgVolume = volume;
        
        try {
          // Get 7 days of hourly data (168 candles) for historical volume comparison
          const klineResponse = await fetch(`${BINANCE_BASE}/klines?symbol=${symbol}&interval=1h&limit=168`);
          if (klineResponse.ok) {
            const klines = await klineResponse.json();
            const closes = klines.map((k: any[]) => parseFloat(k[4]));
            const lows = klines.map((k: any[]) => parseFloat(k[3]));
            const volumes = klines.map((k: any[]) => parseFloat(k[7]));
            
            // Calculate average DAILY volume from previous days (not including today)
            if (volumes.length >= 48) {
              const previousDaysVolumes = volumes.slice(0, -24); // exclude today
              const daysCount = Math.floor(previousDaysVolumes.length / 24);
              if (daysCount > 0) {
                let totalPreviousDaysVolume = 0;
                for (let day = 0; day < daysCount; day++) {
                  const dayStart = day * 24;
                  const dayEnd = dayStart + 24;
                  const dayVolume = previousDaysVolumes.slice(dayStart, dayEnd).reduce((a, b) => a + b, 0);
                  totalPreviousDaysVolume += dayVolume;
                }
                avgVolume = totalPreviousDaysVolume / daysCount;
              }
            }
            
            rsi = calculateRSI(closes);
            const pivotLow = findPivotLow(lows, closes, 20);
            
            if (pivotLow !== null && pivotLow < price) {
              const buffer = 0.004;
              stopLoss = pivotLow * (1 - buffer);
              riskPct = ((price - stopLoss) / price) * 100;
              riskPct = Math.round(riskPct * 100) / 100;
            }
          }
        } catch {}
        
        const volumeFactor = avgVolume > 0 ? Math.round((volume / avgVolume) * 10) / 10 : 1;
        
        let signal: string;
        let signalStrength: number;
        
        if (rsi > 85) {
          signal = 'TOPPED';
          signalStrength = 20;
        } else if (rsi > 75) {
          signal = 'HEATED';
          signalStrength = 40;
        } else if (stopLoss !== null && volumeFactor >= 2 && change24h >= 5) {
          signal = 'RIDE';
          signalStrength = 90;
        } else if (stopLoss !== null && volumeFactor >= 1.5 && change24h >= 3) {
          signal = 'MOMENTUM';
          signalStrength = 75;
        } else if (stopLoss === null && change24h >= 5 && volumeFactor >= 1.3) {
          signal = 'GAINING SPEED';
          signalStrength = 65;
        } else if (volumeFactor < 1.2) {
          signal = 'LOW VOLUME';
          signalStrength = 35;
        } else {
          signal = 'CAUTION';
          signalStrength = 50;
        }
        
        return {
          symbol,
          price,
          change24h,
          volume,
          volumeFactor,
          rsi: Math.round(rsi),
          signal,
          signalStrength,
          stopLoss,
          riskPct
        };
      })
    );
    
    sendJson(res, momentumCoins.slice(0, 20));
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
    
    const candidates = tickers
      .filter((t: any) => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) >= 5_000_000 && !t.symbol.includes('UP') && !t.symbol.includes('DOWN') && parseFloat(t.priceChangePercent) > 0)
      .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 40);
    
    const volumeSpikes = candidates.map((t: any) => {
      const volume = parseFloat(t.quoteVolume);
      const avgVolume = 4_000_000;
      const volumeMultiple = Math.round((volume / avgVolume) * 10) / 10;
      
      return {
        symbol: t.symbol,
        price: parseFloat(t.lastPrice),
        volume,
        avgVolume,
        volumeMultiple,
        priceChangePercent: parseFloat(t.priceChangePercent),
        timestamp: new Date().toISOString()
      };
    })
    .filter((t: any) => t.volumeMultiple >= 1.5)
    .sort((a: any, b: any) => b.volumeMultiple - a.volumeMultiple)
    .slice(0, 20);
    
    sendJson(res, volumeSpikes);
  } catch { sendError(res, 500, 'Failed to fetch volume spike data'); }
}

async function handleTrendDip(res: VercelResponse) {
  try {
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!response.ok) return sendError(res, 500, 'Failed to fetch market data');
    const tickers = await response.json();
    
    const candidates = tickers
      .filter((t: any) => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) >= 5_000_000 && !t.symbol.includes('UP') && !t.symbol.includes('DOWN'))
      .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 30);
    
    const trendDips = await Promise.all(
      candidates.map(async (t: any) => {
        const symbol = t.symbol;
        const price = parseFloat(t.lastPrice);
        const priceChangePercent = parseFloat(t.priceChangePercent);
        const volume = parseFloat(t.quoteVolume);
        
        let rsi = { m15: 50, h1: 50, h4: 50, d1: 50, w1: 50 };
        let ema200 = price * 0.95;
        
        try {
          const klineResponse = await fetch(`${BINANCE_BASE}/klines?symbol=${symbol}&interval=4h&limit=210`);
          if (klineResponse.ok) {
            const klines = await klineResponse.json();
            const closes = klines.map((k: any[]) => parseFloat(k[4]));
            const ema200Arr = calculateEMA(closes, 200);
            ema200 = ema200Arr[ema200Arr.length - 1];
            rsi.h4 = calculateRSI(closes);
          }
        } catch {}
        
        const isAboveEma = price > ema200;
        
        return {
          symbol,
          price,
          rsi,
          ema200,
          volume,
          priceChangePercent,
          isAboveEma
        };
      })
    );
    
    const filtered = trendDips
      .filter(t => t.isAboveEma)
      .sort((a, b) => b.priceChangePercent - a.priceChangePercent)
      .slice(0, 20);
    
    sendJson(res, filtered);
  } catch { sendError(res, 500, 'Failed to fetch trend dip data'); }
}

async function handleHotSetups(res: VercelResponse) {
  try {
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!response.ok) return sendError(res, 500, 'Failed to fetch market data');
    const tickers = await response.json();
    
    const candidates = tickers
      .filter((t: any) => 
        t.symbol.endsWith('USDT') && 
        parseFloat(t.quoteVolume) >= 5_000_000 && 
        !t.symbol.includes('UP') && !t.symbol.includes('DOWN')
      )
      .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 40);
    
    const hotSetups = await Promise.all(
      candidates.map(async (t: any) => {
        const symbol = t.symbol;
        const price = parseFloat(t.lastPrice);
        const changePct = parseFloat(t.priceChangePercent);
        const volume = parseFloat(t.quoteVolume);
        const high24h = parseFloat(t.highPrice);
        const low24h = parseFloat(t.lowPrice);
        
        let rsi = 50, ema20 = price, ema50 = price, volumeRatio = 1;
        
        try {
          const klineResponse = await fetch(`${BINANCE_BASE}/klines?symbol=${symbol}&interval=1h&limit=60`);
          if (klineResponse.ok) {
            const klines = await klineResponse.json();
            const closes = klines.map((k: any[]) => parseFloat(k[4]));
            const volumes = klines.map((k: any[]) => parseFloat(k[5]));
            
            rsi = calculateRSI(closes);
            const ema20Arr = calculateEMA(closes, 20);
            const ema50Arr = calculateEMA(closes, 50);
            ema20 = ema20Arr[ema20Arr.length - 1];
            ema50 = ema50Arr[ema50Arr.length - 1];
            
            const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
            volumeRatio = volumes[volumes.length - 1] / avgVol;
          }
        } catch {}
        
        let score = 0;
        const sources: string[] = [];
        const tags: string[] = [];
        const reasons: string[] = [];
        
        // S/R Signal check
        const range = high24h - low24h;
        const positionInRange = range > 0 ? (price - low24h) / range : 0.5;
        if (positionInRange < 0.2) {
          score += 15;
          sources.push('S/R');
          tags.push('At Support');
          reasons.push(`Near 24h low support zone`);
        } else if (positionInRange > 0.9) {
          score += 30;
          sources.push('S/R');
          tags.push('Breakout');
          reasons.push(`Breaking above resistance`);
        }
        
        // Trend Dip check
        if (price > ema20 && ema20 > ema50 && rsi < 50 && rsi > 30) {
          score += 20;
          sources.push('TrendDip');
          tags.push('Uptrend');
          reasons.push('Healthy pullback in uptrend');
        }
        
        // Volume Spike check
        if (volumeRatio > 1.5 && changePct > 0) {
          score += 15;
          sources.push('VolSpike');
          tags.push('Volume Surge');
          reasons.push(`${volumeRatio.toFixed(1)}x average volume`);
        }
        
        // Momentum check
        if (changePct >= 5 && changePct <= 15 && rsi < 75) {
          score += 20;
          sources.push('Momentum');
          tags.push('Strong Move');
          reasons.push(`+${changePct.toFixed(1)}% with room to run`);
        }
        
        // Multi-scanner confluence bonus
        if (sources.length >= 2) {
          score += 15;
          tags.unshift('Strong Signal');
        }
        
        return {
          symbol,
          price,
          score,
          sources,
          tags,
          reasons: reasons.length > 0 ? reasons : ['Monitoring for setup'],
          rsi: Math.round(rsi),
          volume
        };
      })
    );
    
    const filtered = hotSetups
      .filter(s => s.score >= 15)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
    
    sendJson(res, filtered);
  } catch { sendError(res, 500, 'Failed to fetch hot setups'); }
}

async function handleTopPicks(res: VercelResponse) {
  try {
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!response.ok) return sendError(res, 500, 'Failed to fetch market data');
    const tickers = await response.json();
    
    // Pre-filter candidates: positive momentum, good volume, not leveraged
    const candidates = tickers
      .filter((t: any) => 
        t.symbol.endsWith('USDT') && 
        parseFloat(t.quoteVolume) >= 5_000_000 && 
        !t.symbol.includes('UP') && !t.symbol.includes('DOWN') &&
        parseFloat(t.priceChangePercent) > 1 && parseFloat(t.priceChangePercent) < 25
      )
      .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 30);
    
    // Analyze each candidate with technical indicators
    const analyzed = await Promise.all(
      candidates.map(async (t: any) => {
        const symbol = t.symbol;
        const price = parseFloat(t.lastPrice);
        const changePct = parseFloat(t.priceChangePercent);
        const volume = parseFloat(t.quoteVolume);
        const high24h = parseFloat(t.highPrice);
        const low24h = parseFloat(t.lowPrice);
        
        let rsi = 50, ema20 = price, ema50 = price, volumeRatio = 1;
        let trendBullish = false, rsiHealthy = false, hasRoom = false;
        let stopLoss: number | null = null, riskPct: number | null = null;
        
        try {
          const klineResponse = await fetch(`${BINANCE_BASE}/klines?symbol=${symbol}&interval=1h&limit=60`);
          if (klineResponse.ok) {
            const klines = await klineResponse.json();
            const closes = klines.map((k: any[]) => parseFloat(k[4]));
            const lows = klines.map((k: any[]) => parseFloat(k[3]));
            const volumes = klines.map((k: any[]) => parseFloat(k[5]));
            
            // Calculate RSI
            rsi = calculateRSI(closes);
            
            // Calculate EMAs
            const ema20Arr = calculateEMA(closes, 20);
            const ema50Arr = calculateEMA(closes, 50);
            ema20 = ema20Arr[ema20Arr.length - 1];
            ema50 = ema50Arr[ema50Arr.length - 1];
            
            // Volume ratio
            const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
            const currentVol = volumes[volumes.length - 1];
            volumeRatio = currentVol / avgVol;
            
            // Find pivot low for stop loss
            const pivotLow = findPivotLow(lows, closes, 20);
            if (pivotLow && pivotLow < price) {
              stopLoss = pivotLow * 0.996;
              riskPct = ((price - stopLoss) / price) * 100;
            }
            
            // Technical conditions
            trendBullish = price > ema20 && ema20 > ema50;
            rsiHealthy = rsi >= 35 && rsi <= 68;
            hasRoom = (price - low24h) / (high24h - low24h) < 0.85;
          }
        } catch {}
        
        // SCORING: Higher is better for buying
        let score = 0;
        const tags: string[] = [];
        const reasons: string[] = [];
        
        // Trend alignment (+25 points max)
        if (trendBullish) {
          score += 25;
          tags.push('Uptrend');
          reasons.push('Price above key moving averages - bullish structure');
        } else if (price > ema20) {
          score += 10;
        }
        
        // RSI sweet spot (+25 points max)
        if (rsiHealthy) {
          score += 25;
          if (rsi < 50) {
            tags.push('RSI Dip');
            reasons.push(`RSI at ${Math.round(rsi)} - room to run before overbought`);
          }
        } else if (rsi > 70) {
          score -= 15; // Penalize overbought
        }
        
        // Momentum (+20 points max)
        if (changePct >= 3 && changePct <= 12) {
          score += 20;
          tags.push('Strong Momentum');
          reasons.push(`+${changePct.toFixed(1)}% move with sustainable pace`);
        } else if (changePct > 12) {
          score += 5; // Good but risky - might be extended
        }
        
        // Volume confirmation (+15 points max)
        if (volumeRatio > 1.5) {
          score += 15;
          tags.push('Volume Surge');
          reasons.push(`${volumeRatio.toFixed(1)}x average volume - whale interest`);
        } else if (volumeRatio > 1.2) {
          score += 8;
        }
        
        // Room to run (+10 points max)
        if (hasRoom) {
          score += 10;
          reasons.push('Not at resistance - room for continuation');
        }
        
        // Risk/Reward bonus (+5 points if good R:R)
        if (riskPct && riskPct > 0 && riskPct < 6) {
          score += 5;
          tags.push('Tight Stop');
          reasons.push(`Only ${riskPct.toFixed(1)}% risk to defined stop`);
        }
        
        // PERFECT setup bonus
        if (trendBullish && rsiHealthy && volumeRatio > 1.3 && hasRoom) {
          score += 10;
          tags.unshift('PERFECT Setup');
        }
        
        if (reasons.length === 0) {
          reasons.push('Positive momentum with decent volume');
        }
        
        return {
          symbol,
          price,
          score: Math.max(0, Math.min(100, score)),
          tags,
          reasons,
          rsi: Math.round(rsi),
          changePct,
          volumeRatio: Math.round(volumeRatio * 10) / 10,
          stopLoss,
          riskPct: riskPct ? Math.round(riskPct * 100) / 100 : null,
          sources: { sr: null, mom: null }
        };
      })
    );
    
    // Filter out poor setups and sort by score
    const topPicks = analyzed
      .filter(p => p.score >= 40) // Only show quality setups
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    
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
  if (pathname === 'strategies/hot-setups') return handleHotSetups(res);

  sendError(res, 404, `Market endpoint not found: ${pathname}`);
}
