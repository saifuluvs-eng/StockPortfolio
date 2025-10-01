import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getDefaultUserId,
  listScanHistory,
  recordScanHistory,
} from "../utils/demoStore";
import { ensureMethod, sendError } from "../utils/requestHelpers";
import { buildSampleAnalysis } from "../utils/sampleScannerData";

function ensureSeedHistory(userId: string) {
  const existing = listScanHistory(userId);
  if (existing.length > 0) return;
  const sample = buildSampleAnalysis("BTCUSDT");
  recordScanHistory({
    userId,
    scanType: "custom",
    filters: { symbol: sample.symbol, timeframe: "4h" },
    results: sample,
  });
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!ensureMethod(req, res, ["GET"])) return;

  try {
    const userId = getDefaultUserId();
    ensureSeedHistory(userId);
    const type = typeof req.query?.type === "string" ? req.query.type : undefined;
    const history = listScanHistory(userId, type);

    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
    res.status(200).json(history);
  } catch (error) {
    console.error("Error fetching scan history:", error);
    sendError(res, 500, "history_unavailable");
  }
}
