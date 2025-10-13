import { useEffect, useMemo } from "react";

import { usePositions } from "@/hooks/usePositions";
import { usePrices } from "@/lib/prices";

function uniqueSymbols(symbols: string[]): string[] {
  return Array.from(new Set(symbols.map((sym) => sym.trim().toUpperCase()).filter(Boolean)));
}

async function fetchPrices(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};

  const url =
    "https://api.binance.com/api/v3/ticker/price?symbols=" +
    encodeURIComponent(JSON.stringify(symbols));

  try {
    const response = await fetch(url);
    if (!response.ok) return {};
    const rows: Array<{ symbol: string; price: string }> = await response.json();
    const updates: Record<string, number> = {};
    for (const row of rows) {
      const symbol = row?.symbol?.toUpperCase?.();
      const price = Number(row?.price);
      if (symbol && Number.isFinite(price)) {
        updates[symbol] = price;
      }
    }
    return updates;
  } catch {
    return {};
  }
}

export function usePortfolioStats() {
  const { data: positions = [] } = usePositions();
  const { prices, setPrices, getPrice } = usePrices();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!positions.length) return;

    const symbols = uniqueSymbols(positions.map((p) => p.symbol));
    if (symbols.length === 0) return;

    let cancelled = false;

    async function sync() {
      const updates = await fetchPrices(symbols);
      if (!cancelled && Object.keys(updates).length > 0) {
        setPrices(updates);
      }
    }

    sync();
    const id = window.setInterval(sync, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [positions, setPrices]);

  return useMemo(() => {
    let count = positions.length;
    let cost = 0;
    let market = 0;

    for (const position of positions) {
      const qty = Number(position.quantity) || 0;
      const entry = Number(position.entryPrice) || 0;
      const upper = position.symbol.toUpperCase();
      const fromMap = prices[upper];
      const latest = Number.isFinite(fromMap) ? fromMap : getPrice(position.symbol);
      const price = typeof latest === "number" && Number.isFinite(latest) ? latest : entry;
      cost += qty * entry;
      market += qty * price;
    }

    const pnl = market - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

    return { count, cost, market, pnl, pnlPct };
  }, [positions, prices, getPrice]);
}
