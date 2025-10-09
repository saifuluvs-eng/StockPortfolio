import React, { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

type TVChartProps = {
  symbol: string;    // default passed by parent (e.g., "BTCUSDT")
  timeframe: string; // default passed by parent (e.g., "4h")
};

export type TVChartHandle = {
  setSymbolAndTf: (sym: string, tf: string) => void;
};

declare global {
  interface Window {
    TradingView?: any;
    _tvScriptLoading?: boolean;
    __updateTVChart?: (sym: string, tf: string) => void; // global fallback
  }
}

const TV_SRC = "https://s3.tradingview.com/tv.js";
const mapInterval = (tf: string): string => {
  const t = (tf || "").toLowerCase();
  const m: Record<string, string> = {
    "15m": "15", "30m": "30", "1h": "60", "2h": "120", "3h": "180", "4h": "240",
    "6h": "360", "8h": "480", "12h": "720", "1d": "D", "1day": "D", "1w": "W", "1m": "M",
  };
  if (t === "1d" || t === "1day") return "D";
  if (t === "1w") return "W";
  if (t === "1m") return "M";
  return m[t] ?? "240";
};

const TVChart = forwardRef<TVChartHandle, TVChartProps>(({ symbol, timeframe }, ref) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<{ s: string; i: string } | null>(null);

  // expose imperative method
  const setSymbolAndTf = (sym: string, tf: string) => {
    const s = `BINANCE:${sym}`;
    const i = mapInterval(tf);
    const w = widgetRef.current;

    if (!w || typeof w.activeChart !== "function") {
      pendingRef.current = { s, i };
      return;
    }
    if (readyRef.current) {
      try { w.activeChart().setSymbol(s, i); }
      catch { setTimeout(() => w?.activeChart?.().setSymbol(s, i), 200); }
    } else {
      pendingRef.current = { s, i };
    }
  };

  useImperativeHandle(ref, () => ({ setSymbolAndTf }), []);

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

      w.onChartReady?.(() => {
        readyRef.current = true;
        if (pendingRef.current) {
          const { s, i } = pendingRef.current;
          w.activeChart().setSymbol(s, i);
          pendingRef.current = null;
        }
      });

      // global fallback so any code can update without importing refs
      window.__updateTVChart = (sym, tf) => setSymbolAndTf(sym, tf);
    };

    waitForTV().then(init).catch((e) => console.error("[TVChart] load error", e));
    return () => {
      cancelled = true;
      if (widgetRef.current?.remove) widgetRef.current.remove();
      widgetRef.current = null;
      readyRef.current = false;
      pendingRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
      window.__updateTVChart = undefined;
    };
  }, []); // mount once

  return <div ref={hostRef} className="w-full h-full" />;
});

export default TVChart;
