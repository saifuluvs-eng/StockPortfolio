// api/ping.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, message: "pong", time: new Date().toISOString() });
}
