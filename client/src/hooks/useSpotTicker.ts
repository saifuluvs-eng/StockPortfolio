import { useEffect, useState } from "react";
import { openSpotTickerStream } from "@/lib/binanceWs";

export interface SpotTickerData {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
}

export function useSpotTicker(symbol: string) {
  const [ticker, setTicker] = useState<SpotTickerData | null>(null);

  useEffect(() => {
    setTicker(null);
    let active = true;
    const unsubscribe = openSpotTickerStream([symbol], (next) => {
      if (!active) return;
      if ((next.symbol || "").toUpperCase() !== symbol.toUpperCase()) return;
      setTicker({
        symbol: next.symbol,
        lastPrice: next.lastPrice,
        priceChange: next.priceChange,
        priceChangePercent: next.priceChangePercent,
        highPrice: next.highPrice,
        lowPrice: next.lowPrice,
        volume: next.volume,
        quoteVolume: next.quoteVolume,
      });
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [symbol]);

  return ticker;
}
