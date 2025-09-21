// Vercel build stub: we don't run a custom Express server here.
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, msg: 'Standalone server is disabled on Vercel.' });
}
