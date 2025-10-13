export const fmtPct = (n: number) =>
  Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";
