import React from "react";
import styles from "./ChartPanel.module.css";

type ChartPanelProps = {
  symbol: string;
  tf: string;
};

export function ChartPanel({ symbol, tf }: ChartPanelProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs}>
        <span className={`${styles.tab} ${styles.tabActive}`}>Chart</span>
        <span className={styles.tab}>Info</span>
        <span className={styles.tab}>Depth</span>
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
