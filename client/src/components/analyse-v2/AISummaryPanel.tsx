import React, { useState } from "react";
import styles from "./AISummaryPanel.module.css";
import { useToast } from "@/hooks/use-toast";
import { useCreditStore } from "@/stores/creditStore";

type AISummaryPanelProps = {
  symbol: string;
  tf: string;
};

type Action = {
  key: string;
  label: string;
  cost: number;
};

const actions: Action[] = [
  { key: "analyse", label: "Analyse", cost: 2 },
  { key: "summary", label: "AI Summary", cost: 5 },
  { key: "multitf", label: "Multi-TF", cost: 15 },
];

export function AISummaryPanel({ symbol, tf }: AISummaryPanelProps) {
  const { canSpend, consume } = useCreditStore();
  const { toast } = useToast();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const handleAction = (action: Action) => {
    if (loadingKey) return;

    if (!canSpend(action.cost)) {
      toast({
        title: "Not enough credits",
        description: "Top up credits to continue running AI actions.",
      });
      return;
    }

    consume(action.cost);
    setLoadingKey(action.key);
    setTimeout(() => {
      setLoadingKey(null);
    }, 600);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.badges}>
        <span className={styles.badge}>Source: Heuristic</span>
        <span className={styles.badge}>Confidence: Med</span>
      </div>

      <div className={styles.summary}>
        Momentum is stabilising after a corrective pullback. Watch for bids to
        hold the 1h mid-range before continuation. Macro structure remains
        constructive while spot demand stays elevated.
      </div>

      <div className={styles.planGrid}>
        <div className={styles.planCell}>
          <span className={styles.planLabel}>Entry</span>
          <span>{symbol.toUpperCase()} @ 29.40</span>
        </div>
        <div className={styles.planCell}>
          <span className={styles.planLabel}>Target</span>
          <span>31.80 (R2)</span>
        </div>
        <div className={styles.planCell}>
          <span className={styles.planLabel}>Stop</span>
          <span>28.60 swing low</span>
        </div>
      </div>

      <div>
        <div className={styles.planLabel}>Risks</div>
        <ul className={styles.list}>
          <li>High timeframe trendline overhead near 32.10.</li>
          <li>Funding turning positive may invite late longs.</li>
          <li>Liquidity pockets below 28.80 remain untested.</li>
        </ul>
      </div>

      <div className={styles.actions}>
        {actions.map((action) => {
          const disabled = loadingKey !== null && loadingKey !== action.key;
          return (
            <button
              key={action.key}
              className={`${styles.actionButton} ${disabled ? styles.disabled : ""}`}
              onClick={() => handleAction(action)}
              disabled={disabled}
            >
              {loadingKey === action.key ? <span className={styles.spinner} /> : action.label}
              {loadingKey !== action.key && <span>({action.cost} credits)</span>}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11, opacity: 0.65, textTransform: "uppercase" }}>
        {tf.toUpperCase()} focus · Mock output for preview only
      </div>
    </div>
  );
}

export default AISummaryPanel;
