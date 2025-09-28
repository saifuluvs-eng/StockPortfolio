// Vercel build stub: we don't run a custom Express server here.
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, msg: 'Standalone server is disabled on Vercel.' });
}

// api/standalone.ts
// Local-only launcher for the old Express app.
import { createServer } from 'http';
import { createApp } from './server.local';

async function main() {
  const app = await createApp({});
  const httpServer = createServer(app as any);
  (app as any).set('httpServer', httpServer);

  const port = Number(process.env.PORT || 5173);
  httpServer.listen(port, () => {
    console.log(`[local] API server listening on http://localhost:${port}`);
  });
}

// Avoid running on Vercel lambdas
if (!process.env.VERCEL) {
  main().catch((e) => {
    console.error('[local] failed to start', e);
    process.exit(1);
  });
}

