import type { VercelRequest, VercelResponse } from "@vercel/node";
import { technicalIndicators } from "../services/technicalIndicators";
import {
  getDefaultUserId,
  recordScanHistory,
  type ScanResultLike,
} from "../utils/demoStore";
import {
  ensureMethod,
  parseJsonBody,
  sendError,
} from "../utils/requestHelpers";
import { buildSampleHighPotential } from "../utils/sampleScannerData";

interface HighPotentialRequest {
  timeframe?: string;
  minScore?: number;
  minVolume?: string | number;
  excludeStablecoins?: boolean;
  limit?: number;
}

const DEFAULT_FILTERS: Required<Pick<HighPotentialRequest, "timeframe" | "minScore" | "excludeStablecoins" | "limit">> = {
  timeframe: "4h",
  minScore: 16,
  excludeStablecoins: true,
  limit: 8,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!ensureMethod(req, res, ["POST"])) return;

  try {
    const body = parseJsonBody<HighPotentialRequest>(req);
    const filters = {
      ...DEFAULT_FILTERS,
      ...body,
    };

    let results: ScanResultLike[];
    try {
      const scanResults = await technicalIndicators.scanHighPotential(filters);
      results = Array.isArray(scanResults) ? scanResults : [];
    } catch (error) {
      console.error("Falling back to sample high potential payload:", error);
      results = buildSampleHighPotential();
    }

    if (filters.limit && Number.isFinite(filters.limit)) {
      results = results.slice(0, Number(filters.limit));
    }

    recordScanHistory({
      userId: getDefaultUserId(),
      scanType: "high_potential",
      filters,
      results,
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    res.status(200).json(results);
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_json") {
      sendError(res, 400, "invalid_json");
      return;
    }
    console.error("Error scanning for high potential symbols:", error);
    sendError(res, 500, "high_potential_unavailable");
  }
}
