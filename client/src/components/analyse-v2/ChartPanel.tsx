import { useMemo } from "react";
import TradingViewChart from "@/components/scanner/trading-view-chart";
import styles from "./ChartPanel.module.css";

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
      </div>
      <div className={styles.canvas}>
        <div className={styles.chartHeader}>
          <div className={styles.chartTitle}>
            {normalizedSymbol} · {tf.toUpperCase()}
          </div>
          <div className={styles.chartHint}>Powered by TradingView</div>
        </div>
        <div className={styles.chartBody}>
          <TradingViewChart symbol={normalizedSymbol} interval={activeInterval} />
        </div>
      </div>
    </div>
  );
}

export default ChartPanel;
