import type { VercelRequest, VercelResponse } from "@vercel/node";
import { technicalIndicators } from "../services/technicalIndicators";
import { getStorage, getUserId, readJsonBody } from "../_lib/serverless";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const body = (await readJsonBody<Record<string, unknown>>(req)) ?? {};
  const rawSymbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
  const timeframe = typeof body.timeframe === "string" && body.timeframe.length > 0 ? body.timeframe : "1h";
  const rawFilters = body.filters && typeof body.filters === "object" && !Array.isArray(body.filters)
    ? (body.filters as Record<string, unknown>)
    : undefined;

  if (!rawSymbol) {
    return res.status(400).json({ message: "Symbol is required" });
  }

  try {
    const analysis = await technicalIndicators.analyzeSymbol(rawSymbol, timeframe);

    const storage = await getStorage();
    const userId = await getUserId(req);
    const filters = { symbol: rawSymbol, timeframe, ...(rawFilters ?? {}) };

    await storage.createScanHistory({
      userId,
      scanType: "custom",
      filters,
      results: analysis,
    });

    return res.status(200).json(analysis);
  } catch (error) {
    console.error("/api/scanner/scan error", error);
    return res.status(500).json({ message: "Failed to perform scan" });
  }
}
