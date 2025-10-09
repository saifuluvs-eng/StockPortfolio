import React, { useEffect, useRef } from "react";

declare global {
  interface Window {
    TradingView?: any;
    _tvScriptLoading?: boolean;
  }
}

const TV_SRC = "https://s3.tradingview.com/tv.js";

export default function TVChart() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const log = (...args: any[]) => console.log("[TVChart]", ...args);

    const waitForTV = () =>
      new Promise<void>((resolve, reject) => {
        if (window.TradingView) return resolve();

        const existing = document.querySelector<HTMLScriptElement>(
          `script[src="${TV_SRC}"]`
        );

        if (existing) {
          log("tv.js tag found, waiting for TradingView global…");
          const poll = () => {
            if (window.TradingView) resolve();
            else setTimeout(poll, 50);
          };
          return poll();
        }

        if (window._tvScriptLoading) {
          log("tv.js already loading, waiting…");
          const poll = () => {
            if (window.TradingView) resolve();
            else setTimeout(poll, 50);
          };
          return poll();
        }

        log("injecting tv.js");
        window._tvScriptLoading = true;
        const s = document.createElement("script");
        s.src = TV_SRC;
        s.async = true;
        s.onload = () => {
          log("tv.js loaded");
          resolve();
        };
        s.onerror = (e) => {
          console.error("[TVChart] tv.js failed to load", e);
          reject(e);
        };
        document.body.appendChild(s);
      });

    const initWidget = () => {
      if (cancelled) return;
      const el = containerRef.current;
      if (!el || !window.TradingView) return;

      // fresh container
      el.innerHTML = "";
      const inner = document.createElement("div");
      inner.id = "tv-chart";
      inner.style.width = "100%";
      inner.style.height = "100%";
      el.appendChild(inner);

      // Create the widget
      new window.TradingView.widget({
        container_id: "tv-chart",
        symbol: "BINANCE:BTCUSDT",
        interval: "240", // 4h
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
    };
  }, []);

  // Force a visible height for debugging so the widget can't be hidden by zero-height parents.
  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "560px", // debug height
        borderRadius: 12,
        overflow: "hidden",
      }}
    />
  );
}
