import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import styles from "./ChartPanel.module.css";
import { fetchOhlcv } from "@/lib/analyseClient";
import TradingViewWidget from "@/components/charts/TradingViewWidget";
import { FallbackChart } from "@/components/scanner/fallback-chart";

type Timeframe = "15m" | "1h" | "4h" | "1d";

type ChartPanelProps = {
  symbol: string;
  tf: Timeframe;
  onChangeChartTf?: (tf: Timeframe) => void;
};

const TFS: Timeframe[] = ["15m", "1h", "4h", "1d"];
const TF_TO_INTERVAL: Record<Timeframe, string> = {
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "D",
};

export function ChartPanel({ symbol, tf, onChangeChartTf }: ChartPanelProps) {
  const activeInterval = useMemo(() => TF_TO_INTERVAL[tf] ?? "240", [tf]);
  const normalizedSymbol = useMemo(
    () => (symbol || "BTCUSDT").trim().toUpperCase(),
    [symbol],
  );
  const [widgetFailed, setWidgetFailed] = useState(false);

  useEffect(() => {
    setWidgetFailed(false);
  }, [normalizedSymbol, activeInterval]);
  const handleWidgetError = useCallback(() => {
    setWidgetFailed(true);
  }, []);
  const {
    data: candles,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ["ohlcv", normalizedSymbol, tf],
    queryFn: () => fetchOhlcv(normalizedSymbol, tf),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
  const loading = isLoading || isFetching;

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs}>
        <span className={`${styles.tab} ${styles.tabActive}`}>Chart</span>
        <span className={`${styles.tab} ${styles.tabMuted}`}>Info</span>
        <span className={`${styles.tab} ${styles.tabMuted}`}>Depth</span>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.tfGroup}>
          {TFS.map((option) => (
            <button
              key={option}
              type="button"
              className={`${styles.tfBtn} ${tf === option ? styles.tfActive : ""}`}
              onClick={() => {
                if (option !== tf) onChangeChartTf?.(option);
              }}
              aria-pressed={tf === option}
            >
              {option}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => {
            void refetch();
          }}
          disabled={loading}
          title="Refresh chart data"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className={styles.canvas}>
        <div className={styles.chartHeader}>
          <div className={styles.chartTitle}>
            {normalizedSymbol} · {tf.toUpperCase()}
          </div>
          <div className={styles.chartHint}>Powered by TradingView</div>
        </div>
        <div className={styles.chartBody}>
          {error && (
            <div className={styles.chartError} role="status">
              Failed to load live chart data. Showing fallback visuals.
            </div>
          )}
          {widgetFailed ? (
            <FallbackChart
              symbol={normalizedSymbol}
              interval={activeInterval}
              candles={candles}
              isLoading={loading}
            />
          ) : (
            <TradingViewWidget
              symbol={normalizedSymbol}
              interval={activeInterval}
              onError={handleWidgetError}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default ChartPanel;
