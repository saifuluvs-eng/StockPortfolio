import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDefaultUserId, removeWatchlistSymbol } from "../utils/demoStore";
import { ensureMethod, sendError } from "../utils/requestHelpers";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!ensureMethod(req, res, ["DELETE"])) return;

  try {
    const symbolParam = req.query?.symbol;
    const symbol = Array.isArray(symbolParam) ? symbolParam[0] : symbolParam;
    if (!symbol || typeof symbol !== "string" || !symbol.trim()) {
      sendError(res, 400, "invalid_symbol");
      return;
    }

    const removed = removeWatchlistSymbol(symbol, getDefaultUserId());
    res.status(200).json({ success: removed });
  } catch (error) {
    console.error("Error removing from watchlist:", error);
    sendError(res, 500, "watchlist_remove_failed");
  }
}
