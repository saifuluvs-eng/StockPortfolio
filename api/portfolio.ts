import type { VercelRequest, VercelResponse } from "@vercel/node";

type PortfolioPosition = {
  symbol: string;
  qty: number;
  avgPrice: number;
  livePrice: number;
  pnl: number;
};

type PortfolioUser = {
  positions: PortfolioPosition[];
};

type PortfolioDB = {
  users: Record<string, PortfolioUser>;
};

type GlobalWithPortfolioDb = typeof globalThis & { __PORTFOLIO_DB__?: PortfolioDB };

const globalWithPortfolioDb = globalThis as GlobalWithPortfolioDb;
const db: PortfolioDB = globalWithPortfolioDb.__PORTFOLIO_DB__ ?? { users: {} };
globalWithPortfolioDb.__PORTFOLIO_DB__ = db;

function getQueryParam(req: VercelRequest, key: string): string | null {
  try {
    const url = new URL(req.url ?? "", "http://localhost");
    return url.searchParams.get(key);
  } catch {
    return null;
  }
}

function getUser(uid: string | null): PortfolioUser | null {
  if (!uid) return null;
  if (!db.users[uid]) db.users[uid] = { positions: [] };
  return db.users[uid];
}

function computeTotals(positions: PortfolioPosition[]) {
  const totalValue = positions.reduce((acc, p) => acc + p.livePrice * p.qty, 0);
  const invested = positions.reduce((acc, p) => acc + p.avgPrice * p.qty, 0);
  const totalPnL = totalValue - invested;
  const totalPnLPercent = invested > 0 ? (totalPnL / invested) * 100 : 0;
  return { totalValue, totalPnL, totalPnLPercent };
}

type PortfolioRequestBody = {
  uid?: string;
  action?: string;
  position?: Partial<PortfolioPosition> & {
    qty?: unknown;
    avgPrice?: unknown;
  };
  symbol?: string;
} & Record<string, unknown>;

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");

  const rawBody = req.body ?? {};
  const body: PortfolioRequestBody =
    typeof rawBody === "string" ? safeJSON<PortfolioRequestBody>(rawBody) : (rawBody as PortfolioRequestBody);

  const uid = body.uid ?? getQueryParam(req, "uid");

  if (!uid) {
    return res.status(400).json({ error: "Missing uid" });
  }

  const user = getUser(uid);
  if (!user) {
    return res.status(500).json({ error: "Failed to load user" });
  }

  if (req.method === "GET") {
    const totals = computeTotals(user.positions);
    return res.status(200).json({ ...totals, positions: user.positions });
  }

  if (req.method === "POST") {
    const action = body.action;

    if (action === "add" && body.position) {
      const sym = String(body.position.symbol ?? "").trim().toUpperCase();
      const qty = toFiniteNumber(body.position.qty);
      const avg = toFiniteNumber(body.position.avgPrice);

      if (!sym || qty === null || qty <= 0 || avg === null || avg <= 0) {
        return res.status(400).json({ error: "Invalid position payload" });
      }

      const existing = user.positions.find((p) => p.symbol === sym);
      if (existing) {
        const newQty = existing.qty + qty;
        const newAvg = (existing.avgPrice * existing.qty + avg * qty) / newQty;
        existing.qty = newQty;
        existing.avgPrice = newAvg;
        existing.pnl = existing.livePrice * existing.qty - existing.avgPrice * existing.qty;
      } else {
        user.positions.unshift({
          symbol: sym,
          qty,
          avgPrice: avg,
          livePrice: avg,
          pnl: 0,
        });
      }

      const totals = computeTotals(user.positions);
      return res.status(200).json({ ok: true, ...totals, positions: user.positions });
    }

    if (action === "delete") {
      const sym = String(body.symbol ?? getQueryParam(req, "symbol") ?? "").trim().toUpperCase();
      const before = user.positions.length;
      user.positions = user.positions.filter((p) => p.symbol !== sym);
      const totals = computeTotals(user.positions);
      return res.status(200).json({ ok: before !== user.positions.length, ...totals, positions: user.positions });
    }

    return res.status(400).json({ error: "Unsupported action" });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method Not Allowed" });
}

function safeJSON<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return {} as T;
  }
}
