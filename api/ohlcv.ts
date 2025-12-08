import { VercelRequest, VercelResponse } from '@vercel/node';

const BINANCE_BASE = 'https://api.binance.com/api/v3';

function cors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'public, max-age=60');
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
    const { symbol = 'BTCUSDT', tf = '4h', limit = '100' } = req.query;
    const symbolStr = Array.isArray(symbol) ? symbol[0] : symbol;
    const tfStr = Array.isArray(tf) ? tf[0] : tf;
    const limitNum = Math.min(Number(limit) || 100, 500);

    const klineResponse = await fetch(
      `${BINANCE_BASE}/klines?symbol=${symbolStr}&interval=${tfStr}&limit=${limitNum}`
    );
    
    if (!klineResponse.ok) {
      return sendError(res, 500, 'Failed to fetch OHLCV data from Binance');
    }

    const klines = await klineResponse.json();
    
    const ohlcv = klines.map((k: any[]) => ({
      time: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));

    return sendJson(res, {
      symbol: symbolStr,
      timeframe: tfStr,
      data: ohlcv
    });
  } catch (e) {
    console.error('OHLCV error:', e);
    return sendError(res, 500, 'Failed to fetch OHLCV data');
  }
}
