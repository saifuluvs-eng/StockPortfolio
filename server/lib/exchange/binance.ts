export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export async function fetchKlines(symbol: string, interval: string, limit = 500): Promise<Kline[]> {
  const u = new URL("https://api.binance.com/api/v3/klines");
  u.searchParams.set("symbol", symbol.toUpperCase());
  u.searchParams.set("interval", interval);
  u.searchParams.set("limit", String(limit));
  const r = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`binance ${r.status}`);
  const raw = (await r.json()) as any[];
  const o = raw.map((k) => ({
    openTime: k[0],
    open: +k[1],
    high: +k[2],
    low: +k[3],
    close: +k[4],
    volume: +k[5],
    closeTime: k[6],
  }));
  return o;
}
