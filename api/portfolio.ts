import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getStorage, getUserId, readJsonBody } from "./_lib/serverless";
import type { PortfolioPosition } from "@shared/schema";

function toLegacyPosition(position: PortfolioPosition) {
  return {
    symbol: position.symbol,
    qty: Number(position.quantity),
    avgPrice: Number(position.entryPrice),
    livePrice: Number(position.entryPrice),
    pnl: 0,
  };
}

function computeTotals(positions: PortfolioPosition[]) {
  let invested = 0;
  let currentValue = 0;

  for (const pos of positions) {
    const qty = Number(pos.quantity);
    const entry = Number(pos.entryPrice);
    invested += entry * qty;
    currentValue += entry * qty;
  }

  const totalPnL = currentValue - invested;
  const totalPnLPercent = invested > 0 ? (totalPnL / invested) * 100 : 0;

  return { totalValue: currentValue, totalPnL, totalPnLPercent };
}

function getQueryParam(req: VercelRequest, key: string): string | null {
  if (req.query && typeof req.query === "object") {
    const value = (req.query as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }

  try {
    const url = new URL(req.url ?? "", "http://localhost");
    const value = url.searchParams.get(key);
    return value;
  } catch {
    return null;
  }
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("cache-control", "no-store");

  const storage = await getStorage();
  const userId = await getUserId(req);

  if (req.method === "GET") {
    const positions = await storage.getPortfolioPositions(userId);
    const totals = computeTotals(positions);

    res.status(200).json({
      ...totals,
      positions: positions.map(toLegacyPosition),
    });
    return;
  }

  if (req.method === "POST") {
    // Backwards compatibility for legacy clients still using the action-based API
    const body = (await readJsonBody(req)) ?? {};
    const action = typeof body?.action === "string" ? body.action.toLowerCase() : "";

    if (action === "add" && body?.position) {
      const symbol = String(body.position.symbol ?? "").trim().toUpperCase();
      const qty = toFiniteNumber(body.position.qty);
      const entry = toFiniteNumber(body.position.avgPrice);

      if (!symbol || qty === null || qty <= 0 || entry === null || entry <= 0) {
        res.status(400).json({ error: "Invalid position payload" });
        return;
      }

      await storage.upsertPortfolioPosition(userId, {
        symbol,
        quantity: qty,
        entryPrice: entry,
        notes: null,
      });

      const positions = await storage.getPortfolioPositions(userId);
      const totals = computeTotals(positions);
      res.status(200).json({ ok: true, ...totals, positions: positions.map(toLegacyPosition) });
      return;
    }

    if (action === "delete") {
      const symbol = String(body.symbol ?? getQueryParam(req, "symbol") ?? "").trim().toUpperCase();
      if (!symbol) {
        res.status(400).json({ error: "Missing symbol" });
        return;
      }

      const positions = await storage.getPortfolioPositions(userId);
      const target = positions.find((pos) => pos.symbol === symbol);
      if (target) {
        await storage.deletePortfolioPosition(target.id, userId);
      }

      const refreshed = await storage.getPortfolioPositions(userId);
      const totals = computeTotals(refreshed);
      res.status(200).json({ ok: true, ...totals, positions: refreshed.map(toLegacyPosition) });
      return;
    }

    res.status(400).json({ error: "Unsupported action" });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method Not Allowed" });
}
