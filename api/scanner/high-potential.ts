import type { VercelRequest, VercelResponse } from "@vercel/node";
import { technicalIndicators } from "../services/technicalIndicators";
import { getStorage, getUserId, readJsonBody } from "../_lib/serverless";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const body = (await readJsonBody<Record<string, unknown>>(req)) ?? {};
    const filters = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

    const results = await technicalIndicators.scanHighPotential(filters as any);

    const storage = await getStorage();
    const userId = await getUserId(req);

    await storage.createScanHistory({
      userId,
      scanType: "high_potential",
      filters,
      results,
    });

    return res.status(200).json(results);
  } catch (error) {
    console.error("/api/scanner/high-potential error", error);
    return res.status(500).json({ message: "Failed to scan high potential symbols" });
  }
}
