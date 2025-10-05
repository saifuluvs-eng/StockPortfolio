import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  highPotentialScanner,
  normalizeHighPotentialFilters,
  InvalidHighPotentialFiltersError,
} from "../../server/highPotential/scanner";
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

function normalizeParam<T>(value: T | T[] | undefined): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function extractFilters(req: VercelRequest): HighPotentialFilters {
  const partial: Partial<HighPotentialFilters> = {};

  const bodySource = req.method === "POST" ? req.body : undefined;
  const body = typeof bodySource === "string"
    ? (JSON.parse(bodySource) as Record<string, unknown>)
    : (bodySource as Record<string, unknown> | undefined);

  if (body && typeof body === "object") {
    if (Object.prototype.hasOwnProperty.call(body, "timeframe")) {
      throw new InvalidHighPotentialFiltersError(
        "The `timeframe` parameter is no longer supported. Use `tf` instead.",
      );
    }
    if (typeof body.tf === "string") {
      partial.timeframe = body.tf as HighPotentialFilters["timeframe"];
    }
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

  const rawQuery = req.query ?? {};
  const query = rawQuery as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(query, "timeframe")) {
    throw new InvalidHighPotentialFiltersError(
      "The `timeframe` query parameter is no longer supported. Use `tf` instead.",
    );
  }
  if (Object.prototype.hasOwnProperty.call(query, "tf")) {
    const tfValue = normalizeParam(query.tf as string | string[] | undefined);
    partial.timeframe = String(tfValue ?? "") as HighPotentialFilters["timeframe"];
  }
  const queryMinVol = toNumber(normalizeParam(query.minVolUSD as string | string[] | undefined));
  if (queryMinVol !== undefined) partial.minVolUSD = queryMinVol;
  const queryExclude = toBoolean(normalizeParam(query.excludeLeveraged as string | string[] | undefined));
  if (queryExclude !== undefined) partial.excludeLeveraged = queryExclude;
  const capMin = toNumber(normalizeParam(query.capMin as string | string[] | undefined));
  const capMax = toNumber(normalizeParam(query.capMax as string | string[] | undefined));
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
    console.log("[HP]", req.method, req.url ?? req.originalUrl ?? "/api/scanner/high-potential");
    const filters = extractFilters(req);
    const rawDebug = normalizeParam((req.query as Record<string, unknown> | undefined)?.debug);
    const debugMode = toBoolean(rawDebug) ?? false;
    const data = await highPotentialScanner.getScan(filters, { debug: debugMode });
    return res.status(200).json(data);
  } catch (error) {
    if (error instanceof InvalidHighPotentialFiltersError) {
      console.warn("Rejected Vercel high potential request", error);
      const message = error.message.includes("timeframe") ? "Invalid tf" : error.message;
      return res.status(400).json({ error: message });
    }
    console.error("/api/scanner/high-potential error", error);
    return res.status(500).json({ error: "Failed to load high potential data" });
  }
}
