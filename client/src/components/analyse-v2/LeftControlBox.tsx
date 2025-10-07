import { useState } from "react";
import styles from "./LeftControlBox.module.css";
import { useCredits } from "@/stores/creditStore";
import { COST, spendGuard } from "@/lib/credits";
import { getCached, kAI, kTech, setCached } from "@/lib/cache";
import {
  AIPayload,
  TechPayload,
  computeAI,
  computeTechnicalAll,
} from "@/lib/analyseClient";

type Timeframe = "15m" | "1h" | "4h" | "1d";

type Props = {
  symbol: string;
  tfAnalysis: Timeframe;
  onChangeSymbol: (s: string) => void;
  onChangeTimeframe: (tf: Timeframe) => void;
  setTechState: (payload: TechPayload | null) => void;
  setAIState: (payload: AIPayload | null) => void;
};

const TFS: Timeframe[] = ["15m", "1h", "4h", "1d"];

export default function LeftControlBox({
  symbol,
  tfAnalysis,
  onChangeSymbol,
  onChangeTimeframe,
  setTechState,
  setAIState,
}: Props) {
  const { credits, canSpend, spend, refund } = useCredits();
  const [loading, setLoading] = useState<"tech" | "ai" | null>(null);

  const techCached = getCached<TechPayload>(kTech(symbol, tfAnalysis));
  const aiCached = getCached<AIPayload>(kAI(symbol, tfAnalysis));
  const hasTechCache = Boolean(techCached);
  const hasAiCache = Boolean(aiCached);

  const handleSelectTf = (tf: Timeframe) => {
    if (tf === tfAnalysis) return;
    onChangeTimeframe(tf);
  };

  const handleTech = async () => {
    if (loading) return;
    const key = kTech(symbol, tfAnalysis);
    const cached = getCached<TechPayload>(key);
    if (cached) {
      setTechState(cached);
      return;
    }
    if (!canSpend(COST.TECH)) return;
    setLoading("tech");
    try {
      const result = await spendGuard(
        canSpend,
        spend,
        refund,
        COST.TECH,
        "tech",
        async () => {
          const tech = await computeTechnicalAll(symbol, tfAnalysis);
          setCached(key, tech);
          setTechState(tech);
          return tech;
        },
        { symbol, tf: tfAnalysis },
      );
      return result;
    } finally {
      setLoading(null);
    }
  };

  const handleAI = async () => {
    if (loading) return;
    const techKey = kTech(symbol, tfAnalysis);
    const aiKey = kAI(symbol, tfAnalysis);

    const cachedAI = getCached<AIPayload>(aiKey);
    if (cachedAI) {
      setAIState(cachedAI);
      const cachedTech = getCached<TechPayload>(techKey);
      if (cachedTech) {
        setTechState(cachedTech);
      }
      return;
    }

    if (!canSpend(COST.AI)) return;
    setLoading("ai");
    try {
      await spendGuard(
        canSpend,
        spend,
        refund,
        COST.AI,
        "ai",
        async () => {
          let tech = getCached<TechPayload>(techKey);
          if (!tech) {
            tech = await computeTechnicalAll(symbol, tfAnalysis);
            setCached(techKey, tech);
            setTechState(tech);
          } else {
            setTechState(tech);
          }

          const ai = await computeAI(symbol, tfAnalysis, tech);
          setCached(aiKey, ai);
          setAIState(ai);
          return ai;
        },
        { symbol, tf: tfAnalysis },
      );
    } finally {
      setLoading(null);
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
        <span className={styles.creditsChip}>Credits: {credits}</span>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionButton}
          disabled={loading === "ai" || (!canSpend(COST.TECH) && !hasTechCache)}
          onClick={handleTech}
          title="Runs all indicators (RSI, MACD, ADX, EMAs, ATR, volume stats, SR proximity) for the selected timeframe. Uses 2 credits per timeframe. Cached ~10 min."
        >
          {loading === "tech" ? "Running…" : "Technical Analysis"}
          <span className={styles.costBadge}>(2 credits)</span>
        </button>
        <button
          type="button"
          className={styles.actionButton}
          disabled={loading === "tech" || (!canSpend(COST.AI) && !hasAiCache)}
          onClick={handleAI}
          title="Computes technicals and generates an AI summary with entry/target/invalidations for the selected timeframe. Uses 5 credits per timeframe. Cached ~10 min."
        >
          {loading === "ai" ? "Running…" : "Technical Analysis With AI report"}
          <span className={styles.costBadge}>(5 credits)</span>
        </button>
      </div>

      <div className={styles.rowInfo}>
        <div className={styles.nowViewing}>
          Currently viewing <b>{symbol}</b>
        </div>
      </div>
    </div>
  );
}
