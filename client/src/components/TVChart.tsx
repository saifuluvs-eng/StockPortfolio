import React, { useEffect, useRef } from "react";

type TVChartProps = {
  symbol: string; // e.g. "BTCUSDT"
  timeframe: string; // e.g. "4h"
};

declare global {
  interface Window {
    TradingView?: any;
    _tvScriptLoading?: boolean;
  }
}

const TV_SRC = "https://s3.tradingview.com/tv.js";

// Map our timeframe to TradingView interval codes
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
    "1m": "M",
  };
  if (t === "1d" || t === "1day") return "D";
  if (t === "1w") return "W";
  if (t === "1m") return "M";
  return m[t] ?? "240";
};

export default function TVChart({ symbol, timeframe }: TVChartProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<{ s: string; i: string } | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  // load tv.js once and create widget
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
      if (cancelled || !hostRef.current || !window.TradingView) return;

      // Clean + container
      hostRef.current.innerHTML = "";
      const div = document.createElement("div");
      div.id = "tv-chart";
      div.style.width = "100%";
      div.style.height = "100%";
      hostRef.current.appendChild(div);

      readyRef.current = false;

      const w = new window.TradingView.widget({
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

      widgetRef.current = w;

      // Ensure updates work even if props change before widget ready
      w.onChartReady?.(() => {
        readyRef.current = true;
        if (pendingRef.current) {
          const { s, i } = pendingRef.current;
          w.activeChart().setSymbol(s, i);
          pendingRef.current = null;
        }
      });

      // Keep widget sized with parent using ResizeObserver
      if ("ResizeObserver" in window && hostRef.current) {
        roRef.current = new ResizeObserver(() => {
          try {
            widgetRef.current?.resize?.();
          } catch {}
        });
        roRef.current.observe(hostRef.current);
      }
    };

    waitForTV().then(init).catch((e) => console.error("[TVChart] load error", e));

    return () => {
      cancelled = true;
      roRef.current?.disconnect();
      roRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
      widgetRef.current = null;
      readyRef.current = false;
      pendingRef.current = null;
    };
  }, []); // mount once

  // React to prop changes immediately; if not ready, queue them
  useEffect(() => {
    const w = widgetRef.current;
    const s = `BINANCE:${symbol}`;
    const i = mapInterval(timeframe);

    if (!w || !w.activeChart) {
      pendingRef.current = { s, i };
      return;
    }

    if (readyRef.current) {
      try {
        w.activeChart().setSymbol(s, i);
      } catch (e) {
        // Retry once if chart not fully settled
        setTimeout(() => {
          try {
            widgetRef.current?.activeChart().setSymbol(s, i);
          } catch (err) {
            console.error("[TVChart] setSymbol failed", err);
          }
        }, 200);
      }
    } else {
      pendingRef.current = { s, i };
    }
  }, [symbol, timeframe]);

  // IMPORTANT: Parent must give us height; we fill it.
  return <div ref={hostRef} className="w-full h-full" />;
}
