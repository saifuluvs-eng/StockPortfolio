import styles from "./ChartPanel.module.css";

type Timeframe = "15m" | "1h" | "4h" | "1d";

type ChartPanelProps = {
  symbol: string;
  tf: Timeframe;
  onChangeDisplayTf?: (tf: Timeframe) => void;
};

const TFS: Timeframe[] = ["15m", "1h", "4h", "1d"];

export function ChartPanel({ symbol, tf, onChangeDisplayTf }: ChartPanelProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs}>
        <span className={`${styles.tab} ${styles.tabActive}`}>Chart</span>
        <span className={styles.tab}>Info</span>
        <span className={styles.tab}>Depth</span>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.tfGroup}>
          {TFS.map((option) => (
            <button
              key={option}
              type="button"
              className={`${styles.tfBtn} ${tf === option ? styles.tfActive : ""}`}
              onClick={() => onChangeDisplayTf?.(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.canvas}>
        <div>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>
            {symbol.toUpperCase()} · {tf.toUpperCase()}
          </div>
          <div style={{ marginTop: 8, fontSize: 16 }}>Chart goes here</div>
        </div>
      </div>
    </div>
  );
}

export default ChartPanel;
