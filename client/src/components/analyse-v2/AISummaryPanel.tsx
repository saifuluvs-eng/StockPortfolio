import styles from "./AISummaryPanel.module.css";
import type { AIPayload } from "@/lib/analyseClient";
import { relativeTimeFrom } from "@/lib/time";

type AISummaryPanelProps = {
  symbol: string;
  tf: string;
  data: AIPayload | null;
  onRunAI: () => void;
  aiDisabled: boolean;
  aiTooltip: string;
  isLoading: boolean;
};

const confidenceLabel: Record<AIPayload["confidence"], string> = {
  low: "Low",
  med: "Medium",
  high: "High",
};

export function AISummaryPanel({
  symbol,
  tf,
  data,
  onRunAI,
  aiDisabled,
  aiTooltip,
  isLoading,
}: AISummaryPanelProps) {
  const lastRun = relativeTimeFrom(data?.generatedAt);

  if (!data) {
    return (
      <div className={`${styles.wrapper} ${styles.overlayWrapper}`}>
        <div className={styles.overlayCta}>
          <button
            type="button"
            className={styles.overlayButton}
            onClick={() => {
              void onRunAI();
            }}
            disabled={aiDisabled}
            title={aiTooltip}
          >
            {isLoading
              ? "Running…"
              : "Run Technical Analysis with AI (5 credits) for a deeper summary."}
          </button>
        </div>
      </div>
    );
  }

  const { summary, entry, target, stop, source, confidence } = data;

  return (
    <div className={styles.wrapper}>
      <div className={styles.badges}>
        <span className={styles.badge}>Source: {source}</span>
        <span className={styles.badge}>Confidence: {confidenceLabel[confidence]}</span>
        {lastRun && <span className={styles.badgeMuted}>Last analysed · {lastRun}</span>}
      </div>

      <div className={styles.summary}>{summary}</div>

      {(entry || target || stop) && (
        <div className={styles.planGrid}>
          <div className={styles.planCell}>
            <span className={styles.planLabel}>Entry</span>
            <span>{entry ?? "—"}</span>
          </div>
          <div className={styles.planCell}>
            <span className={styles.planLabel}>Target</span>
            <span>{target ?? "—"}</span>
          </div>
          <div className={styles.planCell}>
            <span className={styles.planLabel}>Stop</span>
            <span>{stop ?? "—"}</span>
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <span className={styles.planLabel}>{tf.toUpperCase()} focus</span>
        <span className={styles.symbol}>{symbol.toUpperCase()}</span>
      </div>
    </div>
  );
}

export default AISummaryPanel;
