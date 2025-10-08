// client/src/components/scanner/trading-view-chart.tsx
import { useEffect, useRef, useState } from "react";

import { buildTvConfig } from "@/lib/tradingview";

import { FallbackChart } from "./fallback-chart";

interface TradingViewChartProps {
  symbol: string;        // e.g. "BTCUSDT"
  interval: string;      // e.g. "15", "60", "240", "D", "W"
}

declare global {
  interface Window {
    TradingView?: any;
  }
}

function TradingViewChart({ symbol, interval }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Stable id for the widget’s container (prevents widget from “losing” its node between renders)
  const idRef = useRef<string>(`tradingview-${Math.random().toString(36).slice(2)}`);
  const widgetRef = useRef<any>(null);
  const [useFallback, setUseFallback] = useState(false);
  const normalizedSymbol = (symbol || "").toString().trim().toUpperCase() || "BTCUSDT";
  const normalizedInterval = (interval || "4h").toString();

  useEffect(() => {
    setUseFallback(false);

    const createWidget = () => {
      if (!containerRef.current || !window.TradingView) return;

      // Ensure the DOM node has the expected id and is clean
      containerRef.current.id = idRef.current;
      containerRef.current.innerHTML = "";

      try {
        const cfg = buildTvConfig({
          symbol: `BINANCE:${normalizedSymbol}`,
          timeframe: normalizedInterval,
          containerId: idRef.current,
          theme: "dark",
          locale: "en",
        });

        Object.assign(cfg, {
          timezone: "Etc/UTC",
          style: "1",
          allow_symbol_change: true,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          backgroundColor: "rgba(0,0,0,0)",
          hide_volume: false,
          studies: [
            "MASimple@tv-basicstudies",
            "RSI@tv-basicstudies",
            "MACD@tv-basicstudies",
          ],
        });

        widgetRef.current = new (window as any).TradingView.widget(cfg);

        widgetRef.current?.onChartReady?.(() => {
          // no-op; we intentionally skip layout persistence until schema mismatches are resolved
        });
      } catch (e) {
        console.warn("TradingView widget init failed, using fallback chart", e);
        setUseFallback(true);
      }
    };

    if (!window.TradingView) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = createWidget;
      script.onerror = () => {
        console.warn("Failed to load TradingView script, using fallback.");
        setUseFallback(true);
      };
      document.head.appendChild(script);
      return () => {
        // no special cleanup needed for the script tag
      };
    } else {
      createWidget();
    }

    return () => {
      try {
        widgetRef.current?.remove?.();
      } catch (error) {
        console.warn("TradingView widget removal failed", error);
      } finally {
        widgetRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [normalizedSymbol, normalizedInterval]);

  if (useFallback) {
    return <FallbackChart symbol={normalizedSymbol} interval={normalizedInterval} />;
  }

  return (
    <div
      ref={containerRef}
      id={idRef.current}
      className="h-[400px] w-full rounded-b-xl md:h-[520px] lg:h-[620px]"
      data-testid="tradingview-chart"
    />
  );
}

export default TradingViewChart;
export { TradingViewChart };
