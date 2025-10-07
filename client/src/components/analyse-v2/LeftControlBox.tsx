import { useState } from "react";
import styles from "./LeftControlBox.module.css";
import { useCredits } from "@/stores/creditStore";

type Props = {
  symbol: string;
  timeframe: string;
  onChangeSymbol: (s: string) => void;
  onChangeTf: (tf: string) => void;
  onAnalyse: () => Promise<void> | void;
};

const TFS = ["15m", "1h", "4h", "1d"];

export default function LeftControlBox({
  symbol,
  timeframe,
  onChangeSymbol,
  onChangeTf,
  onAnalyse,
}: Props) {
  const { credits, canSpend, consume } = useCredits();
  const [pending, setPending] = useState(false);

  const handleAnalyse = async () => {
    if (!canSpend(2) || pending) return;
    consume(2);
    setPending(true);
    try {
      await onAnalyse();
    } finally {
      setPending(false);
    }
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
          <label className={styles.label}>Timeframe</label>
          <div className={styles.segment}>
            {TFS.map((tf) => (
              <button
                key={tf}
                type="button"
                className={`${styles.segBtn} ${timeframe === tf ? styles.segActive : ""}`}
                onClick={() => onChangeTf(tf)}
                aria-pressed={timeframe === tf}
                title={tf}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.rowMid}>
        <button
          type="button"
          className={styles.analyseBtn}
          disabled={!canSpend(2) || pending}
          onClick={handleAnalyse}
          title="Uses 2 credits"
        >
          {pending ? "Analysing…" : "Analyse (2 credits)"}
        </button>

        <div className={styles.credits} title="Available credits">
          Credits: <b>{credits}</b>
        </div>
      </div>

      <div className={styles.rowInfo}>
        <div className={styles.nowViewing}>
          Currently viewing <b>{symbol}</b>
        </div>
        <div className={styles.affordance} aria-hidden>
          ▾
        </div>
      </div>
    </div>
  );
}
