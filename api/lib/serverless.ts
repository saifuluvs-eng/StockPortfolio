import { VercelRequest, VercelResponse } from '@vercel/node';

export function cors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    cors(res);
    res.status(200).end();
    return true;
  }
  return false;
}

export function sendError(res: VercelResponse, status: number, message: string): void {
  cors(res);
  res.status(status).json({ error: message });
}

export function sendJson(res: VercelResponse, data: unknown): void {
  cors(res);
  res.status(200).json(data);
}

export type ApiHandler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

export function createHandler(handler: ApiHandler): ApiHandler {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      if (handleOptions(req, res)) return;
      cors(res);
      await handler(req, res);
    } catch (error) {
      console.error('[API Error]', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      if (!res.writableEnded) {
        sendError(res, 500, message);
      }
    }
  };
}
