import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getStorage, getUserId } from "../_lib/serverless";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const storage = await getStorage();
    const userId = await getUserId(req);
    const typeParam = req.query?.type;
    const scanType = typeof typeParam === "string" && typeParam.length > 0 ? typeParam : undefined;
    const history = await storage.getScanHistory(userId, scanType);
    return res.status(200).json(history);
  } catch (error) {
    console.error("/api/scanner/history error", error);
    return res.status(500).json({ message: "Failed to fetch scan history" });
  }
}
