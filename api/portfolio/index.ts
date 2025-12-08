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
    if (req.method === 'GET') {
      return sendJson(res, { positions: [], totalValue: 0, totalCost: 0, totalPnl: 0, totalPnlPercent: 0 });
    } else if (req.method === 'POST') {
      return sendJson(res, { success: true, id: 'temp-' + Date.now() });
    }
    return sendError(res, 405, 'Method not allowed');
  }

  if (path === 'positions') {
    if (req.method === 'GET') return sendJson(res, []);
    if (req.method === 'POST') return sendJson(res, { success: true, id: 'temp-' + Date.now(), message: 'Position saved' });
    return sendError(res, 405, 'Method not allowed');
  }

  if (path.startsWith('positions/')) {
    const id = path.replace('positions/', '');
    if (req.method === 'GET') return sendJson(res, { id, symbol: '', quantity: 0, entryPrice: 0, currentPrice: 0, pnl: 0 });
    if (req.method === 'PUT') return sendJson(res, { success: true, id, message: 'Position updated' });
    if (req.method === 'DELETE') return sendJson(res, { success: true, message: 'Position deleted' });
    return sendError(res, 405, 'Method not allowed');
  }

  if (path === 'stats') {
    return sendJson(res, { totalPositions: 0, totalValue: 0, totalPnl: 0, winRate: 0, avgReturn: 0 });
  }

  if (path === 'allocation') {
    return sendJson(res, []);
  }

  if (path === 'transactions') {
    if (req.method === 'GET') return sendJson(res, []);
    if (req.method === 'POST') return sendJson(res, { success: true, id: 'tx-' + Date.now() });
    return sendError(res, 405, 'Method not allowed');
  }

  if (path === 'net-worth') {
    return sendJson(res, { totalValue: 0, change24h: 0, change7d: 0 });
  }

  if (path === 'performance') {
    return sendJson(res, { totalReturn: 0, dailyReturns: [], weeklyReturns: [] });
  }

  if (path === 'performance/summary') {
    return sendJson(res, { totalReturn: 0, bestDay: null, worstDay: null, avgDailyReturn: 0 });
  }

  sendError(res, 404, `Portfolio endpoint not found: /api/portfolio/${path}`);
}
