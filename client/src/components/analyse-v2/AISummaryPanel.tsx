import styles from "./AISummaryPanel.module.css";
import type { AIPayload, TechPayload } from "@/lib/analyseClient";
import { relativeTimeFrom } from "@/lib/time";

type AISummaryPanelProps = {
  symbol: string;
  tf: string;
  data: AIPayload | null;
  techData: TechPayload | null;
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
  techData,
  onRunAI,
  aiDisabled,
  aiTooltip,
  isLoading,
}: AISummaryPanelProps) {
  const lastRun = relativeTimeFrom(data?.generatedAt);
  const indicators = techData?.indicators;

  const formatNumber = (value: number | null | undefined, digits = 1) => {
    if (value == null || Number.isNaN(value)) return "—";
    return value.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  };

  const formatPercent = (value: number | null | undefined, digits = 1) => {
    const numeric = formatNumber(value, digits);
    return numeric === "—" ? "—" : `${numeric}%`;
  };

  if (!data) {
    return (
      <div className={`${styles.wrapper} ${styles.overlayWrapper}`}>
        {techData && (
          <div className={styles.overlayBackdrop} aria-hidden="true">
            <div className={styles.overlayBackdropHeader}>
              <span>{symbol.toUpperCase()}</span>
              <span>{tf.toUpperCase()} snapshot</span>
            </div>
            {techData.summary && (
              <p className={styles.overlaySummary}>{techData.summary}</p>
            )}
            {indicators && (
              <div className={styles.overlayMetrics}>
                <div className={styles.overlayMetric}>
                  <span className={styles.overlayMetricLabel}>RSI</span>
                  <span className={styles.overlayMetricValue}>
                    {formatNumber(indicators.rsi, 1)}
                  </span>
                </div>
                <div className={styles.overlayMetric}>
                  <span className={styles.overlayMetricLabel}>Trend</span>
                  <span className={styles.overlayMetricValue}>
                    {formatNumber(indicators.trendScore, 2)}
                  </span>
                </div>
                <div className={styles.overlayMetric}>
                  <span className={styles.overlayMetricLabel}>MACD</span>
                  <span className={styles.overlayMetricValue}>
                    {formatNumber(indicators.macd?.macd, 2)}
                  </span>
                </div>
                <div className={styles.overlayMetric}>
                  <span className={styles.overlayMetricLabel}>ATR %</span>
                  <span className={styles.overlayMetricValue}>
                    {formatPercent(indicators.atrPct, 1)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
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
              : "Run Technical Analysis with AI (5 credits)"}
          </button>
          <p className={styles.overlayHint}>
            Unlock an AI-crafted narrative with entry, target, and risk levels for more
            accurate decisions.
          </p>
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
