import styles from "./TechnicalPanel.module.css";
import type { TechPayload } from "@/lib/analyseClient";
import { relativeTimeFrom } from "@/lib/time";

type TechnicalPanelProps = {
  symbol: string;
  tf: string;
  data: TechPayload | null;
};

function formatValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function TechnicalPanel({ symbol, tf, data }: TechnicalPanelProps) {
  const lastRun = relativeTimeFrom(data?.generatedAt);
  const entries = data ? Object.entries(data.indicators ?? {}) : [];

  return (
    <div className={styles.card} role="region" aria-label="Technical breakdown">
      <div className={styles.header}>
        <span>Technical Breakdown</span>
        <span className={styles.headerMeta}>
          <span className={styles.headerCaption}>Analysed @ {tf}</span>
          {lastRun && <span className={styles.timestamp}>Last analysed · {lastRun}</span>}
        </span>
      </div>
      <div className={styles.body}>
        <div className={styles.subtle}>
          {symbol.toUpperCase()} · {tf.toUpperCase()} snapshot
        </div>
        {data ? (
          <>
            <div className={styles.summary}>{data.summary}</div>
            <div className={styles.list}>
              {entries.length === 0 ? (
                <div className={styles.emptyRow}>No indicator data.</div>
              ) : (
                entries.map(([label, value]) => (
                  <div key={label} className={styles.row}>
                    <span className={styles.label}>{label}</span>
                    <span className={styles.value}>{formatValue(value)}</span>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>Run Technical Analysis</div>
            <div className={styles.emptySub}>Execute the technical scan to populate this section.</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TechnicalPanel;
