import type { VercelRequest, VercelResponse } from "@vercel/node";
import { insertWatchlistItemSchema } from "@shared/schema";
import { ZodError } from "zod";
import { getStorage, getUserId, readJsonBody } from "./_lib/serverless";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    try {
      const storage = await getStorage();
      const userId = await getUserId(req);
      const items = await storage.getWatchlist(userId);
      return res.status(200).json(items);
    } catch (error) {
      console.error("/api/watchlist GET error", error);
      return res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  }

  if (req.method === "POST") {
    try {
      const body = (await readJsonBody<Record<string, unknown>>(req)) ?? {};
      const rawSymbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : "";

      if (!rawSymbol) {
        return res.status(400).json({ message: "Symbol is required" });
      }

      const storage = await getStorage();
      const userId = await getUserId(req);
      const payload = insertWatchlistItemSchema.parse({
        userId,
        symbol: rawSymbol,
      });

      const item = await storage.addToWatchlist(payload);
      return res.status(200).json(item);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid watchlist payload", errors: error.errors });
      }
      console.error("/api/watchlist POST error", error);
      return res.status(500).json({ message: "Failed to update watchlist" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ message: "Method Not Allowed" });
}
