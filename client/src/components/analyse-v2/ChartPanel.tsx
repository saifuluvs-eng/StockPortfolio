import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import styles from "./ChartPanel.module.css";
import { fetchOhlcv, type OhlcvResult } from "@/lib/analyseClient";
import TradingViewChart from "@/components/scanner/trading-view-chart";

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
  const {
    data,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useQuery<OhlcvResult>({
    queryKey: ["ohlcv", normalizedSymbol, tf],
    queryFn: () => fetchOhlcv(normalizedSymbol, tf),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
  const loading = isLoading || isFetching;
  const candles = data?.candles;
  const isSynthetic = data?.source === "synthetic";
  const statusMessage = error
    ? "Failed to load live chart data. Showing fallback visuals."
    : isSynthetic
    ? "Live OHLC service unavailable. Displaying generated fallback candles."
    : null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs} role="tablist" aria-label="Chart views">
        <span className={`${styles.tab} ${styles.tabActive}`} role="tab" aria-selected="true">
          Chart
        </span>
        <span
          className={`${styles.tab} ${styles.tabDisabled}`}
          role="tab"
          aria-selected="false"
          aria-disabled="true"
        >
          Info
        </span>
        <span
          className={`${styles.tab} ${styles.tabDisabled}`}
          role="tab"
          aria-selected="false"
          aria-disabled="true"
        >
          Depth
        </span>
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
          {statusMessage && (
            <div className={styles.chartStatus} role="status">
              {statusMessage}
            </div>
          )}
          <TradingViewChart
            key={`${normalizedSymbol}-${activeInterval}`}
            symbol={normalizedSymbol}
            interval={activeInterval}
            candles={candles}
            isLoadingFallback={loading}
          />
        </div>
      </div>
    </div>
  );
}

export default ChartPanel;
