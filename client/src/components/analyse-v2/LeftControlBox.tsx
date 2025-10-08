import styles from "./LeftControlBox.module.css";
import { toBinance } from "@/lib/symbols";

type Timeframe = "15m" | "1h" | "4h" | "1d";

type Props = {
  symbol: string;
  normalizedSymbol?: string;
  tfAnalysis: Timeframe;
  onChangeSymbol: (s: string) => void;
  onChangeTimeframe: (tf: Timeframe) => void;
  credits: number;
  creditsReady: boolean;
  loading: "tech" | "ai" | null;
  onRunTech: () => void;
  onRunAI: () => void;
  techDisabled: boolean;
  aiDisabled: boolean;
  techTooltip: string;
  aiTooltip: string;
};

const TFS: Timeframe[] = ["15m", "1h", "4h", "1d"];

export default function LeftControlBox({
  symbol,
  normalizedSymbol,
  tfAnalysis,
  onChangeSymbol,
  onChangeTimeframe,
  credits,
  creditsReady,
  loading,
  onRunTech,
  onRunAI,
  techDisabled,
  aiDisabled,
  techTooltip,
  aiTooltip,
}: Props) {
  const displaySymbol = normalizedSymbol ?? toBinance(symbol);

  const handleSelectTf = (tf: Timeframe) => {
    if (tf === tfAnalysis) return;
    onChangeTimeframe(tf);
  };

  return (
    <div className={styles.card} role="region" aria-label="Analyse controls">
      <div className={styles.rowTop}>
        <div className={styles.symbolWrap}>
          <label className={styles.label}>Symbol</label>
          <input
            className={styles.input}
            value={symbol}
            onChange={(e) => onChangeSymbol(e.target.value.toUpperCase())}
            placeholder="e.g., INJUSDT"
            spellCheck={false}
          />
        </div>

        <div className={styles.tfWrap}>
          <label className={styles.label}>Analysis timeframe</label>
          <div className={styles.segment}>
            {TFS.map((tf) => (
              <button
                key={tf}
                type="button"
                className={`${styles.segBtn} ${tfAnalysis === tf ? styles.segActive : ""}`}
                onClick={() => handleSelectTf(tf)}
                aria-pressed={tfAnalysis === tf}
                title={`Set analysis to ${tf}`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.creditsRow}>
        <span className={styles.creditsChip}>
          Credits: {creditsReady ? credits : "…"}
        </span>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionButton}
          disabled={techDisabled}
          onClick={() => {
            void onRunTech();
          }}
          title={techTooltip}
        >
          {loading === "tech" ? "Running…" : "Technical Analysis"}
          <span className={styles.costBadge}>(2 credits)</span>
        </button>
        <button
          type="button"
          className={styles.actionButton}
          disabled={aiDisabled}
          onClick={() => {
            void onRunAI();
          }}
          title={aiTooltip}
        >
          {loading === "ai" ? "Running…" : "Technical Analysis With AI report"}
          <span className={styles.costBadge}>(5 credits)</span>
        </button>
      </div>

      <div className={styles.rowInfo}>
        <div className={styles.nowViewing}>
          Currently viewing <b>{displaySymbol}</b>
        </div>
      </div>
    </div>
  );
}
