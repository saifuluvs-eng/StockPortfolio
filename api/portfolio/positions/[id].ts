import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getStorage, getUserId, readJsonBody } from "../../_lib/serverless";
import type { PortfolioPosition } from "../../../shared/schema";

const patchSchema = z
  .object({
    symbol: z.string().min(2, "Symbol is required").optional(),
    quantity: z.coerce.number().positive("Quantity must be positive").optional(),
    entryPrice: z.coerce.number().positive("Entry price must be positive").optional(),
    notes: z
      .union([z.string().trim().max(1000, "Notes must be at most 1000 characters"), z.null()])
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

function normalizeNotes(notes: string | null | undefined): string | null | undefined {
  if (notes === undefined) return undefined;
  if (notes === null) return null;
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
  const id = req.query.id;
  const resolvedId = Array.isArray(id) ? id[0] : id;

  if (!resolvedId) {
    res.status(400).json({ error: "Missing position id" });
    return;
  }

  try {
    if (req.method === "PATCH") {
      const body = (await readJsonBody(req)) ?? {};
      const parsed = patchSchema.parse(body);
      const updatePayload: Record<string, unknown> = {};

      if (parsed.symbol !== undefined) {
        updatePayload.symbol = parsed.symbol.trim().toUpperCase();
      }
      if (parsed.quantity !== undefined) {
        updatePayload.quantity = parsed.quantity;
      }
      if (parsed.entryPrice !== undefined) {
        updatePayload.entryPrice = parsed.entryPrice;
      }
      if (parsed.notes !== undefined) {
        updatePayload.notes = normalizeNotes(parsed.notes);
      }

      const updated = await storage.updatePortfolioPosition(resolvedId, userId, updatePayload);
      if (!updated) {
        res.status(404).json({ error: "Position not found" });
        return;
      }

      res.status(200).json({ data: serializePosition(updated) });
      return;
    }

    if (req.method === "DELETE") {
      const deleted = await storage.deletePortfolioPosition(resolvedId, userId);
      if (!deleted) {
        res.status(404).json({ error: "Position not found" });
        return;
      }

      res.status(200).json({ data: { id: resolvedId } });
      return;
    }

    res.setHeader("Allow", "PATCH, DELETE");
    res.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid payload", details: error.flatten() });
      return;
    }

    console.error("[api] portfolio position mutation error", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
