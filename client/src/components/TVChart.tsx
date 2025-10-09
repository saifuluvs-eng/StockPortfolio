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

// helper: map our timeframe strings to TradingView interval codes
const mapInterval = (tf: string): string => {
  const t = (tf || "").toLowerCase();
  const lookup: Record<string, string> = {
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

  return lookup[t] ?? "240"; // default to 4h
};

export default function TVChart({ symbol, timeframe }: TVChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    const log = (...args: any[]) => console.log("[TVChart]", ...args);

    const waitForTV = () =>
      new Promise<void>((resolve, reject) => {
        if (window.TradingView) return resolve();

        const existing = document.querySelector<HTMLScriptElement>(
          `script[src="${TV_SRC}"]`,
        );

        const poll = () => {
          if (window.TradingView) resolve();
          else setTimeout(poll, 50);
        };

        if (existing) {
          log("tv.js tag found, waiting for TradingView global…");
          return poll();
        }

        if (window._tvScriptLoading) {
          log("tv.js already loading, waiting…");
          return poll();
        }

        log("injecting tv.js");
        window._tvScriptLoading = true;
        const script = document.createElement("script");
        script.src = TV_SRC;
        script.async = true;
        script.onload = () => {
          log("tv.js loaded");
          resolve();
        };
        script.onerror = (e) => {
          console.error("[TVChart] tv.js failed to load", e);
          reject(e);
        };
        document.body.appendChild(script);
      });

    const initWidget = () => {
      if (cancelled) return;
      const el = containerRef.current;
      if (!el || !window.TradingView) return;

      el.innerHTML = "";
      const inner = document.createElement("div");
      inner.id = "tv-chart";
      inner.style.width = "100%";
      inner.style.height = "100%";
      el.appendChild(inner);

      const interval = mapInterval(timeframe);
      widgetRef.current = new window.TradingView.widget({
        container_id: "tv-chart",
        symbol: `BINANCE:${symbol}`,
        interval,
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

      log("widget created");
    };

    waitForTV()
      .then(initWidget)
      .catch((e) => console.error("[TVChart] init error", e));

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
      widgetRef.current = null;
    };
  }, []);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget || typeof widget.activeChart !== "function") return;

    const interval = mapInterval(timeframe);
    try {
      widget.activeChart().setSymbol(`BINANCE:${symbol}`, interval);
    } catch (error) {
      console.warn("[TVChart] setSymbol failed, retrying shortly…", error);
      setTimeout(() => {
        try {
          widgetRef.current?.activeChart().setSymbol(`BINANCE:${symbol}`, interval);
        } catch (err) {
          console.error("[TVChart] setSymbol retry failed", err);
        }
      }, 250);
    }
  }, [symbol, timeframe]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "560px",
        borderRadius: 12,
        overflow: "hidden",
      }}
    />
  );
}
