// api/portfolio.js
// Minimal, self-contained API to make "Add Position" work on the Hobby plan.
// Uses in-memory storage per function instance (OK for demo; not permanent).

/** @type {{ positions: Array<{symbol:string, qty:number, avgPrice:number, livePrice:number, pnl:number}> }} */
const store = globalThis.__PORTFOLIO_STORE__ || { positions: [] };
globalThis.__PORTFOLIO_STORE__ = store;

function computeTotals() {
  const totalValue = store.positions.reduce((acc, p) => acc + p.livePrice * p.qty, 0);
  const invested = store.positions.reduce((acc, p) => acc + p.avgPrice * p.qty, 0);
  const totalPnL = totalValue - invested;
  const totalPnLPercent = invested > 0 ? (totalPnL / invested) * 100 : 0;
  return { totalValue, totalPnL, totalPnLPercent };
}

export default async function handler(req, res) {
  // Allow only same-origin calls (you can extend with CORS if you move domains)
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET") {
    const totals = computeTotals();
    return res.status(200).end(JSON.stringify({ ...totals, positions: store.positions }));
  }

  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      if (body?.action === "add" && body?.position) {
        const sym = String(body.position.symbol || "").trim().toUpperCase();
        const qty = Number(body.position.qty);
        const avg = Number(body.position.avgPrice);

        if (!sym || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(avg) || avg <= 0) {
          return res.status(400).end(JSON.stringify({ error: "Invalid position payload" }));
        }

        // If symbol exists, merge quantities using a weighted average
        const existing = store.positions.find((p) => p.symbol === sym);
        if (existing) {
          const newQty = existing.qty + qty;
          const newAvg = (existing.avgPrice * existing.qty + avg * qty) / newQty;
          existing.qty = newQty;
          existing.avgPrice = newAvg;
          // Keep livePrice for now; real app would refresh from market feed
          existing.pnl = existing.livePrice * existing.qty - existing.avgPrice * existing.qty;
        } else {
          store.positions.unshift({
            symbol: sym,
            qty,
            avgPrice: avg,
            livePrice: avg, // start equal to avg; your frontend ticker can update this later
            pnl: 0,
          });
        }

        const totals = computeTotals();
        return res.status(200).end(JSON.stringify({ ok: true, ...totals, positions: store.positions }));
      }

      return res.status(400).end(JSON.stringify({ error: "Unsupported action" }));
    } catch (e) {
      console.error("portfolio POST error:", e);
      return res.status(500).end(JSON.stringify({ error: "Server error" }));
    }
  }

  // Method not allowed
  res.setHeader("Allow", "GET, POST");
  return res.status(405).end(JSON.stringify({ error: "Method Not Allowed" }));
}
