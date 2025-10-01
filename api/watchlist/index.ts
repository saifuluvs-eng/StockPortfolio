import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getDefaultUserId,
  listWatchlist,
  upsertWatchlistSymbol,
} from "../utils/demoStore";
import { ensureMethod, parseJsonBody, sendError } from "../utils/requestHelpers";

interface WatchlistBody {
  symbol?: string;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    try {
      const items = listWatchlist(getDefaultUserId());
      res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
      res.status(200).json(items);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      sendError(res, 500, "watchlist_unavailable");
    }
    return;
  }

  if (!ensureMethod(req, res, ["POST"])) return;

  try {
    const body = parseJsonBody<WatchlistBody>(req);
    const symbol = body.symbol;
    if (!symbol || typeof symbol !== "string" || !symbol.trim()) {
      sendError(res, 400, "invalid_symbol");
      return;
    }
    const entry = upsertWatchlistSymbol(symbol, getDefaultUserId());
    res.status(200).json(entry);
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_json") {
      sendError(res, 400, "invalid_json");
      return;
    }
    console.error("Error updating watchlist:", error);
    sendError(res, 500, "watchlist_update_failed");
  }
}
