import React, { useEffect, useRef } from "react";

type TVChartProps = {
  symbol: string;      // e.g. "BTCUSDT", "INJUSDT"
  timeframe: string;   // e.g. "4h", "1h", "1d"
};

declare global {
  interface Window {
    TradingView?: any;
    _tvScriptLoading?: boolean;
  }
}

const TV_SRC = "https://s3.tradingview.com/tv.js";

// Map our timeframe → TradingView interval
const mapInterval = (tf: string): string => {
  const t = (tf || "").toLowerCase();
  const m: Record<string, string> = {
    "15m": "15",
    "30m": "30",
    "1h": "60",
    "2h": "120",
    "3h": "180",
    "4h": "240",
    "6h": "360",
    "8h": "480",
    "12h": "720",
    "1d": "D",
    "1day": "D",
    "1w": "W",
    "1m": "M", // 1 month
  };
  if (t === "1d" || t === "1day") return "D";
  if (t === "1w") return "W";
  if (t === "1m") return "M";
  return m[t] ?? "240"; // default 4h
};

export default function TVChart({ symbol, timeframe }: TVChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);

  // Load tv.js once and create the widget
  useEffect(() => {
    let cancelled = false;

    const waitForTV = () =>
      new Promise<void>((resolve, reject) => {
        if (window.TradingView) return resolve();
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${TV_SRC}"]`);
        const poll = () => (window.TradingView ? resolve() : setTimeout(poll, 50));
        if (existing || window._tvScriptLoading) return poll();
        window._tvScriptLoading = true;
        const s = document.createElement("script");
        s.src = TV_SRC;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = (e) => reject(e);
        document.body.appendChild(s);
      });

    const init = () => {
      if (cancelled || !containerRef.current || !window.TradingView) return;

      // avoid double-rendered widget in strict/dev
      if (containerRef.current.querySelector("#tv-chart")) return;

      containerRef.current.innerHTML = "";
      const inner = document.createElement("div");
      inner.id = "tv-chart";
      inner.style.width = "100%";
      inner.style.height = "100%";
      containerRef.current.appendChild(inner);

      widgetRef.current = new window.TradingView.widget({
        container_id: "tv-chart",
        symbol: `BINANCE:${symbol}`,
        interval: mapInterval(timeframe),
        theme: "dark",
        autosize: true,
        timezone: "Etc/UTC",
        hide_side_toolbar: false,
        hide_top_toolbar: false,
        withdateranges: true,
        details: false,
        allow_symbol_change: true,
        studies: ["RSI@tv-basicstudies"],
      });
    };

    waitForTV().then(init).catch((e) => console.error("[TVChart] load error", e));

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
      widgetRef.current = null;
    };
  }, []); // create once

  // React to symbol/timeframe changes after mount
  useEffect(() => {
    const w = widgetRef.current;
    if (!w || typeof w.activeChart !== "function") return;
    const tvInterval = mapInterval(timeframe);
    try {
      w.activeChart().setSymbol(`BINANCE:${symbol}`, tvInterval);
    } catch (e) {
      // Retry once in case widget isn't fully ready
      setTimeout(() => {
        try {
          widgetRef.current?.activeChart().setSymbol(`BINANCE:${symbol}`, tvInterval);
        } catch (err) {
          console.error("[TVChart] setSymbol failed", err);
        }
      }, 250);
    }
  }, [symbol, timeframe]);

  return <div ref={containerRef} className="h-full w-full" />;
}
