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

const LAYOUT_KEY = "tv_layout_v1";

function safeGetLayout() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    if (obj.charts && !Array.isArray(obj.charts)) return null;
    return obj;
  } catch {
    return null;
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
        const layout = safeGetLayout();
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
          try {
            if (layout) widgetRef.current?.load?.(layout);
          } catch (e) {
            console.warn("Ignoring invalid TradingView layout, clearing key", e);
            try {
              window.localStorage.removeItem(LAYOUT_KEY);
            } catch {
              /* ignore */
            }
          }

          widgetRef.current?.save?.((state: any) => {
            try {
              window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(state));
            } catch {
              /* ignore */
            }
          });
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
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      widgetRef.current = null;
    };
  }, [normalizedSymbol, normalizedInterval]);

  if (useFallback) {
    return <FallbackChart symbol={normalizedSymbol} interval={normalizedInterval} />;
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
export { TradingViewChart };
