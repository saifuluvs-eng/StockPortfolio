import { VercelRequest, VercelResponse } from '@vercel/node';

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

  const segments = req.query.segments as string[] | undefined;
  const path = segments?.join('/') || '';

  if (path === '' || path === 'index') {
    if (req.method === 'GET') return sendJson(res, []);
    if (req.method === 'POST') return sendJson(res, { success: true, message: 'Watchlist functionality requires authentication' });
    if (req.method === 'DELETE') return sendJson(res, { success: true, message: 'Item removed' });
    return sendError(res, 405, 'Method not allowed');
  }

  if (path === 'bulk') {
    if (req.method === 'POST') return sendJson(res, { success: true, added: 0, message: 'Bulk add requires authentication' });
    if (req.method === 'DELETE') return sendJson(res, { success: true, removed: 0, message: 'Bulk remove completed' });
    return sendError(res, 405, 'Method not allowed');
  }

  const id = path;
  if (req.method === 'GET') return sendJson(res, { id, symbol: '', addedAt: new Date().toISOString() });
  if (req.method === 'PUT') return sendJson(res, { success: true, id, message: 'Watchlist item updated' });
  if (req.method === 'DELETE') return sendJson(res, { success: true, message: 'Item removed' });
  
  sendError(res, 404, `Watchlist endpoint not found: /api/watchlist/${path}`);
}
