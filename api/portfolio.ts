// api/portfolio.ts
// Vercel serverless function that returns a PortfolioSummary-shaped payload

export default async function handler(_req: any, res: any) {
  // Demo portfolio with a few positions so the UI renders nicely.
  // You can replace this with your real storage later.
  const positions = [
    {
      id: "pos_btc",
      symbol: "BTCUSDT",
      quantity: "0.05",
      entryPrice: "60000",
      currentPrice: 62000,
    },
    {
      id: "pos_eth",
      symbol: "ETHUSDT",
      quantity: "0.80",
      entryPrice: "2900",
      currentPrice: 3000,
    },
    {
      id: "pos_sol",
      symbol: "SOLUSDT",
      quantity: "10",
      entryPrice: "140",
      currentPrice: 150,
    },
  ].map((p) => {
    const qty = Number(p.quantity) || 0;
    const entry = Number(p.entryPrice) || 0;
    const cur = Number(p.currentPrice) || 0;

    const marketValue = cur * qty;
    const costBasis = entry * qty;
    const unrealizedPnL = marketValue - costBasis;
    const unrealizedPnLPercent = costBasis ? (unrealizedPnL / costBasis) * 100 : 0;

    // simple day change heuristics for demo purposes
    const dayChangePercent =
      p.symbol === "BTCUSDT" ? 1.2 : p.symbol === "ETHUSDT" ? -0.5 : 2.0;
    const dayChange = (marketValue * dayChangePercent) / 100;

    // treat totalReturn ~ unrealized PnL for demo
    const totalReturn = unrealizedPnL;
    const totalReturnPercent = unrealizedPnLPercent;

    return {
      id: p.id,
      symbol: p.symbol,
      quantity: p.quantity,
      entryPrice: p.entryPrice,
      currentPrice: cur,
      marketValue,
      unrealizedPnL,
      unrealizedPnLPercent,
      allocation: 0, // fill after we know total
      dayChange,
      dayChangePercent,
      totalReturn,
      totalReturnPercent,
    };
  });

  const totalValue = positions.reduce((a, b) => a + b.marketValue, 0);
  const totalPnL = positions.reduce((a, b) => a + b.unrealizedPnL, 0);
  const dayChange = positions.reduce((a, b) => a + b.dayChange, 0);
  const totalPnLPercent = totalValue ? (totalPnL / totalValue) * 100 : 0;
  const dayChangePercent = totalValue ? (dayChange / totalValue) * 100 : 0;

  // finalize allocations
  const finalized = positions.map((p) => ({
    ...p,
    allocation: totalValue ? (p.marketValue / totalValue) * 100 : 0,
  }));

  const payload = {
    totalValue,
    totalPnL,
    totalPnLPercent,
    dayChange,
    dayChangePercent,
    positions: finalized,
  };

  // Cache for 30s on the edge, allow 60s stale while revalidating
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
  res.status(200).json(payload);
}
