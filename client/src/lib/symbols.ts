// client/src/lib/symbols.ts
// Shared helpers for working with crypto trading pairs where USDT is the
// default quote currency used throughout the app.

export const DEFAULT_SPOT_SYMBOL = "BTCUSDT" as const;

/**
 * Normalise arbitrary user input ("btc", "BTCUSDT", etc.) into a fully
 * qualified Binance spot symbol that ends with the USDT quote currency.
 */
export function ensureUsdtSymbol(
  raw: string | undefined | null,
  fallback: string = DEFAULT_SPOT_SYMBOL,
): string {
  const trimmed = (raw ?? "").trim().toUpperCase();
  if (!trimmed) return fallback;
  return trimmed.endsWith("USDT") ? trimmed : `${trimmed}USDT`;
}

/**
 * Strip the trailing USDT quote to display the base asset in input fields.
 */
export function baseAssetFromUsdt(symbol: string | undefined | null): string {
  const value = (symbol ?? "").trim().toUpperCase();
  if (!value) return "";
  return value.endsWith("USDT") ? value.slice(0, -4) : value;
}

/**
 * Format a pair for presentation (e.g. BTC/USDT) while defaulting to BTCUSDT
 * when the provided symbol is empty.
 */
export function displayPairFromSymbol(
  symbol: string | undefined | null,
  quote: string = "USDT",
): string {
  const safeSymbol = ensureUsdtSymbol(symbol);
  const base = baseAssetFromUsdt(safeSymbol);
  return `${base}/${quote}`;
}
