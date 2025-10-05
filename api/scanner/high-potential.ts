import type { VercelRequest, VercelResponse } from "@vercel/node";
import { highPotentialScanner, normalizeHighPotentialFilters } from "../../server/highPotential/scanner";
import type { HighPotentialFilters } from "@shared/high-potential/types";

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.trim().length === 0) return undefined;
    return !["0", "false", "no"].includes(value.toLowerCase());
  }
  if (typeof value === "number") return value !== 0;
  return undefined;
}

function extractFilters(req: VercelRequest): HighPotentialFilters {
  const partial: Partial<HighPotentialFilters> = {};

  const bodySource = req.method === "POST" ? req.body : undefined;
  const body = typeof bodySource === "string"
    ? (JSON.parse(bodySource) as Record<string, unknown>)
    : (bodySource as Record<string, unknown> | undefined);

  if (body && typeof body === "object") {
    if (typeof body.timeframe === "string") partial.timeframe = body.timeframe as HighPotentialFilters["timeframe"];
    const bodyMinVol = toNumber(body.minVolUSD);
    if (bodyMinVol !== undefined) partial.minVolUSD = bodyMinVol;
    const bodyExclude = toBoolean(body.excludeLeveraged);
    if (bodyExclude !== undefined) partial.excludeLeveraged = bodyExclude;
    if (Array.isArray(body.capRange)) {
      const [min, max] = body.capRange;
      const capMin = toNumber(min);
      const capMax = toNumber(max);
      if (capMin !== undefined || capMax !== undefined) {
        partial.capRange = [capMin ?? 0, capMax ?? capMin ?? 0];
      }
    }
  }

  const query = req.query ?? {};
  if (typeof query.timeframe === "string") {
    partial.timeframe = query.timeframe as HighPotentialFilters["timeframe"];
  }
  const queryMinVol = toNumber(query.minVolUSD);
  if (queryMinVol !== undefined) partial.minVolUSD = queryMinVol;
  const queryExclude = toBoolean(query.excludeLeveraged);
  if (queryExclude !== undefined) partial.excludeLeveraged = queryExclude;
  const capMin = toNumber(query.capMin);
  const capMax = toNumber(query.capMax);
  if (capMin !== undefined || capMax !== undefined) {
    const existing = partial.capRange ?? [capMin ?? 0, capMax ?? 0];
    partial.capRange = [capMin ?? existing[0], capMax ?? existing[1]];
  }

  return normalizeHighPotentialFilters(partial);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const filters = extractFilters(req);
    const data = await highPotentialScanner.getScan(filters);
    return res.status(200).json(data);
  } catch (error) {
    console.error("/api/scanner/high-potential error", error);
    return res.status(500).json({ message: "Failed to load high potential data" });
  }
}
