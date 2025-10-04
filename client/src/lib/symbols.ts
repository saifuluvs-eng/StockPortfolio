export function toBinance(symbol: string | null | undefined): string {
  let sym = (symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!sym) return "BTCUSDT";
  if (sym.endsWith("USD") && !sym.endsWith("USDT")) sym = sym.slice(0, -3) + "USDT";
  if (!/(USDT|BTC|BUSD|FDUSD|TUSD|USDC)$/.test(sym)) sym += "USDT";
  return sym;
}
