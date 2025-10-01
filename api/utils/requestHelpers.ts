import type { VercelRequest, VercelResponse } from "@vercel/node";

export function ensureMethod(
  req: VercelRequest,
  res: VercelResponse,
  allowed: string[],
): boolean {
  if (!allowed.includes(req.method ?? "")) {
    res.setHeader("Allow", allowed.join(", "));
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return false;
  }
  return true;
}

export function parseJsonBody<T = Record<string, unknown>>(req: VercelRequest): T {
  const body = req.body;
  if (!body) {
    return {} as T;
  }
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as T;
    } catch (error) {
      throw new Error("invalid_json");
    }
  }
  return body as T;
}

export function getSymbolFromRequest(raw: unknown, fallback = "BTCUSDT"): string {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed) {
      const upper = trimmed.toUpperCase();
      return upper.endsWith("USDT") ? upper : `${upper}USDT`;
    }
  }
  return fallback;
}

export function sendError(res: VercelResponse, status: number, error: string, detail?: unknown) {
  res.status(status).json({ ok: false, error, detail });
}
