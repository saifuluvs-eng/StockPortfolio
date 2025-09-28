// api/index.ts — single Function kept in deploy (others are ignored by .vercelignore)
// Self-contained (no imports from ./api/*) so it always builds on Hobby plan

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Basic router (you can expand this later)
  const url = req.url || "/";
  const method = req.method || "GET";

  if (url === "/" || url === "/api" || url.startsWith("/api/health")) {
    return res.status(200).json({
      ok: true,
      message: "API is alive (single function)",
      method,
      url,
      time: new Date().toISOString(),
    });
  }

  return res.status(404).json({ ok: false, message: "Not Found", url });
}
