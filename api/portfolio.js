// api/portfolio.js
// Per-user, in-memory storage (demo). Keys by uid.
// On Hobby plan we keep a single route to stay under the 12-functions limit.

const db = globalThis.__PORTFOLIO_DB__ || { users: {} };
globalThis.__PORTFOLIO_DB__ = db;

function getUser(uid) {
  if (!uid) return null;
  if (!db.users[uid]) db.users[uid] = { positions: [] };
  return db.users[uid];
}

function computeTotals(positions) {
  const totalValue = positions.reduce((acc, p) => acc + p.livePrice * p.qty, 0);
  const invested = positions.reduce((acc, p) => acc + p.avgPrice * p.qty, 0);
  const totalPnL = totalValue - invested;
  const totalPnLPercent = invested > 0 ? (totalPnL / invested) * 100 : 0;
  return { totalValue, totalPnL, totalPnLPercent };
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  // uid can come from query (?uid=...) or body.uid
  const uidFromQuery = req.query?.uid;
  const body = typeof req.body === "string" ? safeJSON(req.body) : (req.body || {});
  const uid = body.uid || uidFromQuery;

  if (!uid) {
    return res.status(400).end(JSON.stringify({ error: "Missing uid" }));
  }

  const user = getUser(uid);

  // GET — return this user's portfolio
  if (req.method === "GET") {
    const totals = computeTotals(user.positions);
    return res.status(200).end(JSON.stringify({ ...totals, positions: user.positions }));
  }

  // POST actions
  if (req.method === "POST") {
    const action = body.action;

    if (action === "add" && body.position) {
      const sym = String(body.position.symbol || "").trim().toUpperCase();
      const qty = Number(body.position.qty);
      const avg = Number(body.position.avgPrice);
      if (!sym || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(avg) || avg <= 0) {
        return res.status(400).end(JSON.stringify({ error: "Invalid position payload" }));
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
          livePrice: avg, // start = avg; frontend/feeds can update later
          pnl: 0,
        });
      }

      const totals = computeTotals(user.positions);
      return res.status(200).end(JSON.stringify({ ok: true, ...totals, positions: user.positions }));
    }

    if (action === "delete" && body.symbol) {
      const sym = String(body.symbol || "").trim().toUpperCase();
      const before = user.positions.length;
      user.positions = user.positions.filter((p) => p.symbol !== sym);
      const after = user.positions.length;
      const totals = computeTotals(user.positions);
      return res
        .status(before === after ? 404 : 200)
        .end(JSON.stringify({ ok: before !== after, ...totals, positions: user.positions }));
    }

    return res.status(400).end(JSON.stringify({ error: "Unsupported action" }));
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).end(JSON.stringify({ error: "Method Not Allowed" }));
}

function safeJSON(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
