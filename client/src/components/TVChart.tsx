// client/src/components/TVChart.tsx
import React, { useEffect, useRef } from "react";

type TVChartProps = {
  // Defaults from parent are fine (BTCUSDT / 4h). Component will
  // also auto-update when it sees /api/metrics?symbol=...&tf=... fetches.
  symbol?: string;    // e.g. "BTCUSDT"
  timeframe?: string; // e.g. "4h"
};

declare global {
  interface Window {
    TradingView?: any;
    _tvScriptLoading?: boolean;
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

const normalizeSymbol = (raw: string) => {
  const v = (raw || "").toString().trim().toUpperCase();
  return (v.includes(":") ? v.split(":").pop()! : v).replace(/\s+/g, "");
};

export default function TVChart({
  symbol = "BTCUSDT",
  timeframe = "4h",
}: TVChartProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<{ s: string; i: string } | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const restoreFetchRef = useRef<(() => void) | null>(null);

  const setSymbolAndTf = (sym: string, tf: string) => {
    const s = `BINANCE:${normalizeSymbol(sym)}`;
    const i = mapInterval(tf);
    const w = widgetRef.current;

    if (!w || typeof w.activeChart !== "function") {
      pendingRef.current = { s, i };
      return;
    }
    if (readyRef.current) {
      try { w.activeChart().setSymbol(s, i); }
      catch {
        setTimeout(() => {
          try { widgetRef.current?.activeChart().setSymbol(s, i); } catch {}
        }, 200);
      }
    } else {
      pendingRef.current = { s, i };
    }
  };

  // Load script + create widget once
  useEffect(() => {
    let cancelled = false;

    const ensureScript = () =>
      new Promise<void>((resolve, reject) => {
        if (window.TradingView) return resolve();
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${TV_SRC}"]`);
        const poll = () => (window.TradingView ? resolve() : setTimeout(poll, 50));
        if (existing || window._tvScriptLoading) return poll();
        window._tvScriptLoading = true;
        const s = document.createElement("script");
        s.src = TV_SRC; s.async = true;
        s.onload = () => resolve();
        s.onerror = (e) => reject(e);
        document.body.appendChild(s);
      });

    const init = () => {
      if (cancelled || !hostRef.current || !window.TradingView) return;

      // Fallback height to avoid tiny chart
      const h = hostRef.current;
      const currentH = h.getBoundingClientRect().height;
      if (currentH < 300) {
        h.style.minHeight = "60vh";
        h.style.height = "100%";
      }

      // Clean & create container
      h.innerHTML = "";
      const div = document.createElement("div");
      div.id = "tv-chart";
      div.style.width = "100%";
      div.style.height = "100%";
      h.appendChild(div);

      readyRef.current = false;
      const w = new window.TradingView.widget({
        container_id: "tv-chart",
        symbol: `BINANCE:${normalizeSymbol(symbol)}`,
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
          try { w.activeChart().setSymbol(s, i); } catch {}
          pendingRef.current = null;
        }
      });

      // Keep widget sized with parent
      if ("ResizeObserver" in window) {
        roRef.current = new ResizeObserver(() => {
          try { widgetRef.current?.resize?.(); } catch {}
        });
        roRef.current.observe(h);
      }
    };

    ensureScript().then(init).catch((e) => console.error("[TVChart] load error", e));

    return () => {
      cancelled = true;
      try {
        roRef.current?.disconnect(); roRef.current = null;
        if (hostRef.current) hostRef.current.innerHTML = "";
      } catch {}
      widgetRef.current = null;
      readyRef.current = false;
      pendingRef.current = null;
    };
  }, []); // once

  // Intercept /api/metrics fetches so the chart updates instantly on Run Analysis
  useEffect(() => {
    if (restoreFetchRef.current) return; // already wrapped

    const origFetch = window.fetch.bind(window);
    window.fetch = async (...args: any[]) => {
      try {
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
        if (typeof url === "string" && url.includes("/api/metrics")) {
          // Parse symbol & tf from query params
          const u = new URL(url, window.location.origin);
          const sym = u.searchParams.get("symbol") || symbol;
          const tf = u.searchParams.get("tf") || timeframe;
          // Update chart immediately
          setSymbolAndTf(sym!, tf!);
        }
      } catch {}
      return origFetch(...(args as Parameters<typeof fetch>));
    };

    restoreFetchRef.current = () => { window.fetch = origFetch; };
    return () => { try { restoreFetchRef.current?.(); } catch {} restoreFetchRef.current = null; };
  }, [symbol, timeframe]);

  // React to prop changes too (first paint uses defaults)
  useEffect(() => { setSymbolAndTf(symbol, timeframe); }, [symbol, timeframe]);

  return <div ref={hostRef} className="w-full h-full" />;
}
