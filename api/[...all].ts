// api/[...all].ts — single catch-all function (handles /api and all subpaths)

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || "/";
  const method = req.method || "GET";

  // normalize to just the path (strip querystring)
  const path = url.split("?")[0];

  if (path === "/api" || path === "/api/") {
    return res.status(200).json({
      ok: true,
      message: "API is alive (root)",
      method,
      path,
      time: new Date().toISOString(),
    });
  }

  if (path === "/api/health") {
    return res.status(200).json({
      ok: true,
      message: "healthy",
      time: new Date().toISOString(),
    });
  }

  // add more routes here, e.g. /api/scan, /api/ai, etc.

  return res.status(404).json({ ok: false, message: "Not Found", path });
}
