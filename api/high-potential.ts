import { VercelRequest, VercelResponse } from '@vercel/node';

const BINANCE_BASE = 'https://api.binance.com/api/v3';
const MIN_USD_VOL = 5_000_000;

function cors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res: VercelResponse, data: unknown): void {
  cors(res);
  res.status(200).json(data);
}

function sendError(res: VercelResponse, status: number, message: string): void {
  cors(res);
  res.status(status).json({ error: message });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') { cors(res); return res.status(200).end(); }
  cors(res);

  try {
    const limit = Number(req.query?.limit) || 10;
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    
    if (!response.ok) {
      return sendError(res, 500, 'Failed to fetch market data');
    }

    const tickers = await response.json();
    
    const highPotential = tickers
      .filter((t: any) => 
        t.symbol.endsWith('USDT') && 
        parseFloat(t.quoteVolume) >= MIN_USD_VOL &&
        !t.symbol.includes('UP') && 
        !t.symbol.includes('DOWN') &&
        !t.symbol.includes('BULL') &&
        !t.symbol.includes('BEAR')
      )
      .map((t: any) => {
        const changePct = parseFloat(t.priceChangePercent);
        const volume = parseFloat(t.quoteVolume);
        const price = parseFloat(t.lastPrice);
        const high = parseFloat(t.highPrice);
        const low = parseFloat(t.lowPrice);
        
        const volumeScore = Math.min(volume / 100_000_000, 1) * 30;
        const momentumScore = Math.min(Math.abs(changePct) / 15, 1) * 40;
        const volatilityScore = high > low ? Math.min((high - low) / low / 0.1, 1) * 30 : 0;
        const totalScore = volumeScore + momentumScore + volatilityScore;
        
        return {
          symbol: t.symbol,
          price,
          changePct,
          volume,
          high,
          low,
          score: Math.round(totalScore),
          potential: totalScore > 70 ? 'high' : totalScore > 50 ? 'medium' : 'low',
          direction: changePct > 0 ? 'bullish' : 'bearish'
        };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, limit);

    sendJson(res, highPotential);
  } catch (error) {
    console.error('[High Potential] Error:', error);
    sendError(res, 500, 'Failed to fetch high potential coins');
  }
}
