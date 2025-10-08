// client/src/components/scanner/trading-view-chart.tsx
import { useEffect, useRef, useState } from "react";

import { buildTvConfig } from "@/lib/tradingview";

import { FallbackChart } from "./fallback-chart";
import type { OhlcvCandle } from "@/lib/analyseClient";

interface TradingViewChartProps {
  symbol: string; // e.g. "BTCUSDT"
  interval: string; // e.g. "15", "60", "240", "D", "W"
  candles?: OhlcvCandle[] | undefined;
  isLoadingFallback?: boolean;
}

declare global {
  interface Window {
    TradingView?: any;
  }
}

const TV_SCRIPT_ID = "tradingview-widget-script";
const TV_SCRIPT_SRC = "https://s3.tradingview.com/tv.js";
const LEGACY_LAYOUT_KEYS = ["tv_layout_v1"];
const TRADINGVIEW_STORAGE_PREFIXES = [
  "tradingview.chart",
  "tradingview.widget",
  "chartproperties",
  "chartprefs",
  "study_templates",
  "drawing_templates",
  "chartfavorites",
];
const TV_DISABLED_FEATURES = [
  "use_localstorage_for_settings",
  "save_chart_properties_to_local_storage",
  "save_chart_properties_to_local_storage_sync",
  "study_templates_auto_save",
] as const;

function purgeLegacyLayoutArtifacts() {
  if (typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    for (const key of LEGACY_LAYOUT_KEYS) {
      storage.removeItem(key);
    }

    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i);
      if (!key) continue;
      if (TRADINGVIEW_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        storage.removeItem(key);
      }
    }
  } catch {
    // ignore storage access issues
  }
}

function loadTradingViewScriptOnce(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Window is not available"));
      return;
    }

    if (window.TradingView) {
      resolve();
      return;
    }

    const existing = document.getElementById(TV_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("TradingView script failed to load")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = TV_SCRIPT_ID;
    script.src = TV_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("TradingView script failed to load"));
    document.head.appendChild(script);
  });
}

function TradingViewChart({
  symbol,
  interval,
  candles,
  isLoadingFallback,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Stable id for the widget’s container (prevents widget from “losing” its node between renders)
  const idRef = useRef<string>(`tradingview-${Math.random().toString(36).slice(2)}`);
  const widgetRef = useRef<any>(null);
  const [useFallback, setUseFallback] = useState(false);
  const normalizedSymbol = (symbol || "").toString().trim().toUpperCase() || "BTCUSDT";
  const normalizedInterval = (interval || "4h").toString();

  useEffect(() => {
    setUseFallback(false);

    let cancelled = false;

    const mountWidget = async () => {
      try {
        await loadTradingViewScriptOnce();
        if (cancelled || !containerRef.current || !window.TradingView) return;

        purgeLegacyLayoutArtifacts();

        // Ensure the DOM node has the expected id and is clean
        containerRef.current.id = idRef.current;
        containerRef.current.innerHTML = "";

        const cfg = buildTvConfig({
          symbol: `BINANCE:${normalizedSymbol}`,
          timeframe: normalizedInterval,
          containerId: idRef.current,
          theme: "dark",
          locale: "en",
        });

        Object.assign(cfg, {
          timezone: "Etc/UTC",
          style: 1,
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
          load_last_chart: false,
          save_last_chart: false,
          disabled_features: [...TV_DISABLED_FEATURES],
          autosave: false,
        });

        const instantiate = () => {
          if (cancelled || !containerRef.current) return;
          try {
            widgetRef.current = new (window as any).TradingView.widget(cfg);
            widgetRef.current?.onChartReady?.(() => {
              // widget ready; we intentionally skip layout persistence to avoid schema mismatches
            });
          } catch (error) {
            console.warn("TradingView widget init failed, using fallback chart", error);
            setUseFallback(true);
          }
        };

        if (typeof window.TradingView.onready === "function") {
          window.TradingView.onready(instantiate);
        } else {
          instantiate();
        }
      } catch (e) {
        console.warn("TradingView widget init failed, using fallback chart", e);
        setUseFallback(true);
      }
    };

    mountWidget();

    return () => {
      cancelled = true;
      try {
        widgetRef.current?.remove?.();
        widgetRef.current?.destroy?.();
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
    return (
      <FallbackChart
        symbol={normalizedSymbol}
        interval={normalizedInterval}
        candles={candles}
        isLoading={Boolean(isLoadingFallback)}
      />
    );
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
