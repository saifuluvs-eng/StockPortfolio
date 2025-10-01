import type { VercelRequest, VercelResponse } from "@vercel/node";
import { technicalIndicators } from "../services/technicalIndicators";
import {
  getDefaultUserId,
  recordScanHistory,
  type ScanResultLike,
} from "../utils/demoStore";
import {
  ensureMethod,
  getSymbolFromRequest,
  parseJsonBody,
  sendError,
} from "../utils/requestHelpers";
import { buildSampleAnalysis } from "../utils/sampleScannerData";

interface ScanRequestBody {
  symbol?: string;
  timeframe?: string;
  filters?: Record<string, unknown>;
}

const DEFAULT_TIMEFRAME = "4h";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!ensureMethod(req, res, ["POST"])) return;

  try {
    const body = parseJsonBody<ScanRequestBody>(req);
    const symbol = getSymbolFromRequest(body.symbol);
    const timeframe = typeof body.timeframe === "string" && body.timeframe.trim()
      ? body.timeframe.trim()
      : DEFAULT_TIMEFRAME;

    let analysis: ScanResultLike;
    try {
      analysis = await technicalIndicators.analyzeSymbol(symbol, timeframe);
    } catch (error) {
      console.error(`Falling back to sample scan for ${symbol}:`, error);
      analysis = buildSampleAnalysis(symbol);
    }

    recordScanHistory({
      userId: getDefaultUserId(),
      scanType: "custom",
      filters: { symbol, timeframe, ...(body.filters ?? {}) },
      results: analysis,
    });

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(analysis);
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_json") {
      sendError(res, 400, "invalid_json");
      return;
    }
    console.error("Error performing scan:", error);
    sendError(res, 500, "scan_failed");
  }
}
