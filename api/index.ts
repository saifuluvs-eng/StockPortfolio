// api/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  // Root of the API — keeps the function alive and debuggable
  res.status(200).json({ ok: true, service: 'StockPortfolio API', time: new Date().toISOString() });
}
