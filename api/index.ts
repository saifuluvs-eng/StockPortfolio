// api/index.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    message: "API is alive (root)",
    method: req.method,
    time: new Date().toISOString(),
  });
}
