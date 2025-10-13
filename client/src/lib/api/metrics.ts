export async function fetchBtcDominance(): Promise<number> {
  const res = await fetch("https://api.coingecko.com/api/v3/global", { method: "GET" });
  if (!res.ok) throw new Error(`CG ${res.status}`);
  const json = await res.json();
  const v = json?.data?.market_cap_percentage?.btc;
  if (typeof v !== "number") throw new Error("CG bad payload");
  return v;
}
