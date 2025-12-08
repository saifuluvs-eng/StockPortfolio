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

const AI_UNAVAILABLE_MSG = 'AI features are temporarily unavailable. Technical analysis indicators are still accessible for your trading decisions.';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') { cors(res); return res.status(200).end(); }
  cors(res);

  const segments = req.query.segments as string[] | undefined;
  const path = segments?.join('/') || '';

  if (path === 'summary' || path === '') {
    return sendJson(res, { data: AI_UNAVAILABLE_MSG });
  }

  if (path === 'market-overview') {
    return sendJson(res, { data: AI_UNAVAILABLE_MSG });
  }

  if (path === 'chart-decode') {
    return sendJson(res, { data: AI_UNAVAILABLE_MSG });
  }

  if (path === 'insights') {
    return sendJson(res, { data: AI_UNAVAILABLE_MSG });
  }

  if (path === 'portfolio-strategy') {
    return sendJson(res, { data: AI_UNAVAILABLE_MSG });
  }

  sendJson(res, { data: AI_UNAVAILABLE_MSG });
}
