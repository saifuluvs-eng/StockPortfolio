import { VercelRequest, VercelResponse } from '@vercel/node';

function cors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Demo-User-Id');
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
  const pathname = url.pathname.replace('/api/watchlist', '').replace(/^\//, '');

  if (pathname === '') {
    if (req.method === 'GET') return sendJson(res, []);
    if (req.method === 'POST') return sendJson(res, { success: true, message: 'Added to watchlist (stub)' });
  }
  if (pathname.match(/^\d+$/)) {
    if (req.method === 'DELETE') return sendJson(res, { success: true, message: 'Removed from watchlist (stub)' });
  }

  sendError(res, 404, `Watchlist endpoint not found: ${pathname}`);
}
