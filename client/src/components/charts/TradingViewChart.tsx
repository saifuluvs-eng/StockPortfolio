// client/src/components/charts/TradingViewChart.tsx
import { useEffect, useRef } from "react";

type Props = {
  symbol: string;              // e.g. "BTCUSDT"
  timeframe: string;           // "15" | "60" | "240" | "D" | "W"
  theme?: "light" | "dark";
  height?: number;
  showIndicators?: boolean;
  onTimeframeChange?: (tf: string) => void; // not used here, passed through parent controls
};

declare global {
  interface Window {
    TradingView?: any;
  }
}

const TV_SCRIPT_ID = "tradingview-widget-script";

function loadTradingViewScriptOnce(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (window.TradingView) return resolve();

    // Existing script tag?
    const existing = document.getElementById(TV_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("TradingView script failed to load")));
      return;
    }

    // Create script
    const s = document.createElement("script");
    s.id = TV_SCRIPT_ID;
    s.src = "https://s3.tradingview.com/tv.js";
    s.type = "text/javascript";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("TradingView script failed to load"));
    document.head.appendChild(s);
  });
}

export default function TradingViewChart({
  symbol,
  timeframe,
  theme = "dark",
  height = 560,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);

  // Convert props to TradingView format
  const tvSymbol = `BINANCE:${(symbol || "BTCUSDT").toUpperCase()}`;
  const tvInterval = (timeframe || "240").toString(); // TradingView accepts "240","60","15","D","W"

  useEffect(() => {
    let cancelled = false;

    const mount = async () => {
      // Guard: container must exist
      if (!containerRef.current) return;

      try {
        await loadTradingViewScriptOnce();
        if (cancelled || !containerRef.current || !window.TradingView) return;

        // Clear previous widget to avoid duplicate mounts
        containerRef.current.innerHTML = "";
        widgetRef.current = new window.TradingView.widget({
          symbol: tvSymbol,
          interval: tvInterval,
          container_id: containerRef.current, // we can pass the element itself
          autosize: true,
          width: "100%",
          height,
          timezone: "Etc/UTC",
          theme: theme === "dark" ? "dark" : "light",
          style: "1", // Candles
          locale: "en",
          toolbar_bg: "transparent",
          hide_side_toolbar: false,
          hide_top_toolbar: false,
          withdateranges: true,
          details: true,
          hotlist: false,
          calendar: false,
          studies: [], // you can push indicators here if needed
          // IMPORTANT: keep library stable, don't re-inject script
          allow_symbol_change: false,
        });
      } catch (e) {
        // Soft fail so the page doesn’t crash
        // eslint-disable-next-line no-console
        console.error("[TradingView] init failed:", e);
      }
    };

    mount();

    // Cleanup on unmount
    return () => {
      cancelled = true;
      try {
        // TradingView widgets don’t expose a destroy API; clearing the container avoids ghost instances
        if (containerRef.current) containerRef.current.innerHTML = "";
        widgetRef.current = null;
      } catch {
        /* ignore */
      }
    };
    // Recreate widget whenever symbol/interval/theme/height changes
  }, [tvSymbol, tvInterval, theme, height]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height }}
      data-testid="tradingview-container"
    />
  );
}
