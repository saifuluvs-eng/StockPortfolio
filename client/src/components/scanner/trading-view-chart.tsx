// client/src/components/scanner/trading-view-chart.tsx
import { useEffect, useRef, useState } from "react";
import { FallbackChart } from "./fallback-chart";

interface TradingViewChartProps {
  symbol: string;   // e.g. "BTCUSDT"
  interval: string; // "15" | "60" | "240" | "D" | "W"
}

declare global {
  interface Window {
    TradingView?: any;
  }
}

const TV_SCRIPT_ID = "tradingview-widget-script";

function loadTradingViewScriptOnce(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TradingView) return resolve();

    const existing = document.getElementById(TV_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("TradingView script failed")));
      return;
    }

    const s = document.createElement("script");
    s.id = TV_SCRIPT_ID;
    s.src = "https://s3.tradingview.com/tv.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("TradingView script failed"));
    document.head.appendChild(s);
  });
}

export function TradingViewChart({ symbol, interval }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef<string>(() => `tv-${Math.random().toString(36).slice(2)}` as unknown as string);
  // ^ useRef initializer trick to keep a stable id across re-renders
  if (typeof idRef.current !== "string") {
    idRef.current = `tv-${Math.random().toString(36).slice(2)}`;
  }

  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // reset fallback each change
    setUseFallback(false);

    const mount = async () => {
      // guard: container must exist
      if (!containerRef.current) return;

      try {
        await loadTradingViewScriptOnce();
        if (cancelled || !containerRef.current || !window.TradingView) return;

        const tvSymbol = `BINANCE:${(symbol || "BTCUSDT").toUpperCase()}`;
        const tvInterval = (interval || "240").toString();

        // clear any previous widget DOM
        containerRef.current.innerHTML = "";

        // TradingView expects an element id string here
        window.TradingView.widget({
          container_id: idRef.current,
          symbol: tvSymbol,
          interval: tvInterval,
          autosize: true,
          width: "100%",
          height: 400,
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "transparent",
          hide_side_toolbar: false,
          hide_top_toolbar: false,
          withdateranges: true,
          details: true,
          hotlist: false,
          calendar: false,
          studies: [
            "MASimple@tv-basicstudies",
            "RSI@tv-basicstudies",
            "MACD@tv-basicstudies",
          ],
          allow_symbol_change: false,
        });
      } catch (err) {
        console.warn("[TradingView] falling back:", err);
        if (!cancelled) setUseFallback(true);
      }
    };

    mount();

    return () => {
      cancelled = true;
      try {
        if (containerRef.current) containerRef.current.innerHTML = "";
      } catch {/* ignore */}
    };
  }, [symbol, interval]);

  if (useFallback) {
    return <FallbackChart symbol={symbol} interval={interval} />;
  }

  return (
    <div
      ref={containerRef}
      id={idRef.current}
      className="h-[400px] w-full rounded-b-xl"
      data-testid="tradingview-chart"
    />
  );
}

export default TradingViewChart;
