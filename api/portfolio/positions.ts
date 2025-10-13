import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getStorage, getUserId, readJsonBody } from "../_lib/serverless";
import type { PortfolioPosition } from "@shared/schema";

const upsertSchema = z.object({
  symbol: z.string().min(2, "Symbol is required"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  entryPrice: z.coerce.number().positive("Entry price must be positive"),
  notes: z
    .union([z.string().trim().max(1000, "Notes must be at most 1000 characters"), z.null()])
    .optional(),
});

function normalizeNotes(notes: string | null | undefined): string | null {
  if (notes === undefined || notes === null) return null;
  const trimmed = notes.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function serializePosition(position: PortfolioPosition) {
  const createdAt = position.createdAt instanceof Date ? position.createdAt : new Date(position.createdAt);
  const updatedAt = position.updatedAt instanceof Date ? position.updatedAt : new Date(position.updatedAt);

  return {
    id: position.id,
    symbol: position.symbol,
    quantity: Number(position.quantity),
    entryPrice: Number(position.entryPrice),
    notes: position.notes ?? null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("cache-control", "no-store");

  const storage = await getStorage();
  const userId = await getUserId(req);

  try {
    if (req.method === "GET") {
      const positions = await storage.getPortfolioPositions(userId);
      res.status(200).json({ data: positions.map(serializePosition) });
      return;
    }

    if (req.method === "POST") {
      const body = (await readJsonBody(req)) ?? {};
      const parsed = upsertSchema.parse(body);
      const saved = await storage.upsertPortfolioPosition(userId, {
        symbol: parsed.symbol.trim().toUpperCase(),
        quantity: parsed.quantity,
        entryPrice: parsed.entryPrice,
        notes: normalizeNotes(parsed.notes ?? null),
      });
      res.status(200).json({ data: serializePosition(saved) });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid payload", details: error.flatten() });
      return;
    }

    console.error("[api] portfolio positions error", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export type { PortfolioPosition };
