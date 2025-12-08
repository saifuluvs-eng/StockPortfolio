import { VercelRequest, VercelResponse } from '@vercel/node';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') { cors(res); return res.status(200).end(); }
  cors(res);

  const url = new URL(req.url || '', 'http://localhost');
  const pathname = url.pathname.replace('/api/ai', '').replace(/^\//, '');

  if (pathname === 'insight' || pathname === 'summary') {
    return sendJson(res, {
      success: false,
      message: 'AI features are temporarily unavailable for maintenance.',
      insight: null,
      summary: null
    });
  }
  
  if (pathname === 'market-overview') {
    return sendJson(res, {
      marketSentiment: 'neutral',
      topMovers: [],
      summary: 'AI market analysis temporarily unavailable.',
      lastUpdated: new Date().toISOString()
    });
  }

  sendJson(res, {
    success: false,
    message: 'AI features are temporarily unavailable.',
    data: null
  });
}
