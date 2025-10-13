import { useCallback } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

type PriceStore = {
  prices: Record<string, number>;
  setPrice: (symbol: string, price: number) => void;
  setPrices: (updates: Record<string, number>) => void;
  getPrice: (symbol: string) => number | undefined;
  reset: () => void;
};

function normalizeSymbol(symbol: string | null | undefined): string | null {
  if (!symbol) return null;
  const trimmed = symbol.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

export const usePriceStore = create<PriceStore>((set, get) => ({
  prices: {},
  setPrice: (symbol, price) => {
    const key = normalizeSymbol(symbol);
    const numeric = Number(price);
    if (!key || !Number.isFinite(numeric)) return;

    set((state) => {
      if (state.prices[key] === numeric) {
        return state;
      }
      return { prices: { ...state.prices, [key]: numeric } };
    });
  },
  setPrices: (updates) => {
    const entries = Object.entries(updates);
    if (entries.length === 0) return;

    set((state) => {
      let changed = false;
      const next = { ...state.prices };
      for (const [rawSymbol, rawValue] of entries) {
        const key = normalizeSymbol(rawSymbol);
        const numeric = Number(rawValue);
        if (!key || !Number.isFinite(numeric)) continue;
        if (next[key] !== numeric) {
          next[key] = numeric;
          changed = true;
        }
      }
      if (!changed) return state;
      return { prices: next };
    });
  },
  getPrice: (symbol) => {
    const key = normalizeSymbol(symbol);
    if (!key) return undefined;
    return get().prices[key];
  },
  reset: () => {
    set({ prices: {} });
  },
}));

export function usePrices() {
  const store = usePriceStore(
    useShallow((state) => ({
      prices: state.prices,
      setPrice: state.setPrice,
      setPrices: state.setPrices,
      reset: state.reset,
    })),
  );

  const getPrice = useCallback((symbol: string) => usePriceStore.getState().getPrice(symbol), []);

  return {
    ...store,
    getPrice,
  };
}
