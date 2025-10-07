import React from "react";
import styles from "./TechnicalPanel.module.css";

type TechnicalPanelProps = {
  symbol: string;
  tf: string;
};

type Metric = {
  label: string;
  value: string;
  status: "bullish" | "neutral" | "bearish";
};

const statusColor: Record<Metric["status"], string> = {
  bullish: "#3fb950",
  neutral: "#f2c744",
  bearish: "#f85149",
};

const mockMetrics: Metric[] = [
  { label: "RSI (14)", value: "48 · Neutral", status: "neutral" },
  { label: "MACD", value: "Signal +0.6", status: "bullish" },
  { label: "ADX", value: "24 · Trend Weak", status: "neutral" },
  { label: "EMA Stack", value: "50 > 100 > 200", status: "bullish" },
  { label: "EMA Distance", value: "+2.8%", status: "bullish" },
  { label: "ATR %", value: "3.1%", status: "neutral" },
  { label: "Vol. Z-Score", value: "+1.8", status: "bullish" },
  { label: "SR Proximity", value: "-1.3% from R", status: "bearish" },
  { label: "Trend Score", value: "62 / 100", status: "bullish" },
  { label: "Momentum", value: "Cooling", status: "bearish" },
  { label: "Liquidity", value: "Healthy", status: "bullish" },
  { label: "Funding", value: "0.013%", status: "neutral" },
  { label: "OI Drift", value: "+4%", status: "bullish" },
  { label: "Volatility", value: "Contracting", status: "bearish" },
];

export function TechnicalPanel({ symbol, tf }: TechnicalPanelProps) {
  return (
    <div>
      <ul className={styles.list}>
        <li className={styles.meta}>{symbol.toUpperCase()} · {tf.toUpperCase()} snapshot</li>
        {mockMetrics.map((metric) => (
          <li key={metric.label} className={styles.row}>
            <span className={styles.labelWrap}>
              <span
                className={styles.dot}
                style={{ backgroundColor: statusColor[metric.status] }}
              />
              <span className={styles.label}>{metric.label}</span>
            </span>
            <span className={styles.value}>{metric.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TechnicalPanel;
