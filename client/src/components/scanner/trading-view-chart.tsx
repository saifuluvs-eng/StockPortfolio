import { useEffect, useRef, useState } from "react";
import { FallbackChart } from "./fallback-chart";

interface TradingViewChartProps {
  symbol: string;
  interval: string; // "15" | "60" | "240" | "D" | "W"
}

declare global {
  interface Window {
    TradingView?: any;
    __tvScriptLoading__?: Promise<void>;
  }
}

async function ensureTvScript(): Promise<void> {
  if (window.TradingView) return;
  if (window.__tvScriptLoading__) return window.__tvScriptLoading__;
  window.__tvScriptLoading__ = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "https://s3.tradingview.com/tv.js";
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Failed to load TradingView"));
    document.head.appendChild(el);
  });
  return window.__tvScriptLoading__;
}

export default function TradingViewChart({ symbol, interval }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<string>("tv_" + Math.random().toString(36).slice(2));
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      setUseFallback(false);
      if (import.meta.env.MODE === "development") {
        setUseFallback(true);
        return;
      }
      try {
        await ensureTvScript();
        if (cancelled) return;
        const el = containerRef.current;
        if (!el) throw new Error("Container missing");
        el.innerHTML = "";

        // TradingView expects a container id string that exists in the DOM
        new window.TradingView.widget({
          autosize: true,
          symbol: `BINANCE:${symbol}`,
          interval,
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          allow_symbol_change: true,
          container_id: idRef.current,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          backgroundColor: "rgba(0,0,0,0)",
          gridColor: "rgba(255,255,255,0.1)",
          hide_volume: false,
          studies: ["MASimple@tv-basicstudies", "RSI@tv-basicstudies", "MACD@tv-basicstudies"],
        });
      } catch (e) {
        console.warn("TradingView failed, using fallback", e);
        if (!cancelled) setUseFallback(true);
      }
    };

    start();
    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [symbol, interval]);

  if (useFallback) return <FallbackChart symbol={symbol} interval={interval} />;

  return (
    <div ref={containerRef} id={idRef.current} className="h-[400px] w-full rounded-b-xl" data-testid="tradingview-chart" />
  );
}
