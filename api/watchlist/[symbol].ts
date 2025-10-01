import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getStorage, getUserId } from "../_lib/serverless";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const symbolParam = req.query?.symbol;
  const symbol = Array.isArray(symbolParam) ? symbolParam[0] : symbolParam;
  const normalized = typeof symbol === "string" ? symbol.trim().toUpperCase() : "";

  if (!normalized) {
    return res.status(400).json({ message: "Symbol is required" });
  }

  try {
    const storage = await getStorage();
    const userId = await getUserId(req);
    const success = await storage.removeFromWatchlist(userId, normalized);
    return res.status(200).json({ success });
  } catch (error) {
    console.error("/api/watchlist/[symbol] DELETE error", error);
    return res.status(500).json({ message: "Failed to update watchlist" });
  }
}
