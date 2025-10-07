import styles from "./TechnicalPanel.module.css";
import type { TechPayload } from "@/lib/analyseClient";
import { relativeTimeFrom } from "@/lib/time";

type TechnicalPanelProps = {
  symbol: string;
  tf: string;
  data: TechPayload | null;
};

const numberFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  const formatted = formatNumber(value, digits);
  return formatted === "—" ? formatted : `${formatted}%`;
}

export function TechnicalPanel({ symbol, tf, data }: TechnicalPanelProps) {
  const lastRun = relativeTimeFrom(data?.generatedAt);
  const indicators = data?.indicators;

  const rows = indicators
    ? [
        {
          label: "Close",
          value:
            indicators.close == null
              ? "—"
              : numberFormatter.format(indicators.close),
        },
        {
          label: "RSI",
          value: formatNumber(indicators.rsi, 1),
        },
        {
          label: "MACD",
          value:
            indicators.macd == null
              ? "—"
              : [
                  formatNumber(indicators.macd.macd, 2),
                  formatNumber(indicators.macd.signal, 2),
                  formatNumber(indicators.macd.histogram, 2),
                ].join(" / "),
        },
        {
          label: "ADX",
          value: formatNumber(indicators.adx, 1),
        },
        {
          label: "EMA (20/50/200)",
          value: [indicators.ema?.e20, indicators.ema?.e50, indicators.ema?.e200]
            .map((value) =>
              value == null ? "—" : numberFormatter.format(value),
            )
            .join(" / "),
        },
        {
          label: "ATR %",
          value: formatPercent(indicators.atrPct, 1),
        },
        {
          label: "Volume",
          value: indicators.vol
            ? `Last ${numberFormatter.format(indicators.vol.last)} · z ${formatNumber(indicators.vol.zScore, 2)} · 50 avg ${numberFormatter.format(indicators.vol.xAvg50)}`
            : "—",
        },
        {
          label: "SR proximity",
          value: formatPercent(indicators.srProximityPct, 1),
        },
        {
          label: "Trend score",
          value: formatNumber(indicators.trendScore, 2),
        },
      ]
    : [];

  return (
    <div className={styles.card} role="region" aria-label="Technical breakdown">
      <div className={styles.header}>
        <span>Technical Breakdown</span>
        {data && (
          <span className={styles.headerMeta}>
            <span className={styles.headerCaption}>Analysed @ {tf}</span>
            {lastRun && (
              <span className={styles.timestamp}>Last analysed · {lastRun}</span>
            )}
          </span>
        )}
      </div>
      <div className={styles.body}>
        <div className={styles.subtle}>
          {symbol.toUpperCase()} · {tf.toUpperCase()} snapshot
        </div>
        {data ? (
          <>
            {data.summary && <div className={styles.summary}>{data.summary}</div>}
            <div className={styles.list}>
              {rows.length === 0 ? (
                <div className={styles.emptyRow}>No indicator data.</div>
              ) : (
                rows.map(({ label, value }) => (
                  <div key={label} className={styles.row}>
                    <span className={styles.label}>{label}</span>
                    <span className={styles.value}>{value}</span>
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
