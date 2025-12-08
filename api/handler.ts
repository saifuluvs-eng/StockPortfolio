import app, { ready } from '../server/index';

export default async function handler(req: any, res: any) {
  try {
    await ready;
    // Pass the request to the Express app
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Handler] Startup Error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message, stack: err.stack });
  }
}
