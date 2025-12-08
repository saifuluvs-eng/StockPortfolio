import { createHandler, sendJson, sendError } from '../lib/serverless';

const BINANCE_BASE = 'https://api.binance.com/api/v3';

function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
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
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export default createHandler(async (req, res) => {
  try {
    const limit = Number(req.query?.limit) || 100;
    
    const tickerResponse = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!tickerResponse.ok) {
      return sendError(res, 500, 'Failed to fetch market data');
    }

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
          
          return {
            symbol,
            rsi: Math.round(rsi * 100) / 100,
            signal: rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral'
          };
        } catch {
          return null;
        }
      })
    );

    sendJson(res, results.filter(Boolean));
  } catch (error) {
    console.error('[RSI] Error:', error);
    sendError(res, 500, 'Failed to calculate RSI data');
  }
});
