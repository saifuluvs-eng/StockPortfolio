import { useEffect, useMemo, useState } from "react";
import styles from "./AnalyseV2.module.css";
import { TechnicalPanel } from "@/components/analyse-v2/TechnicalPanel";
import { ChartPanel } from "@/components/analyse-v2/ChartPanel";
import { AISummaryPanel } from "@/components/analyse-v2/AISummaryPanel";
import LeftControlBox from "@/components/analyse-v2/LeftControlBox";
import { useCredits } from "@/stores/creditStore";
import { getCached, kAI, kTech, setCached } from "@/lib/cache";
import { COST, spendGuard } from "@/lib/credits";
import {
  computeAI,
  computeTechnicalAll,
  type AIPayload,
  type TechPayload,
} from "@/lib/analyseClient";
import { relativeTimeFrom } from "@/lib/time";

type Timeframe = "15m" | "1h" | "4h" | "1d";

export default function AnalyseV2() {
  const [symbol, setSymbol] = useState("INJUSDT");
  const [tfAnalysis, setTfAnalysis] = useState<Timeframe>("1h");
  const [tfChart, setTfChart] = useState<Timeframe>("1h");
  const [techState, setTechState] = useState<TechPayload | null>(null);
  const [aiState, setAiState] = useState<AIPayload | null>(null);
  const [loading, setLoading] = useState<"tech" | "ai" | null>(null);

  const { credits, canSpend, spend, refund, ready } = useCredits();

  useEffect(() => {
    setTechState(null);
    setAiState(null);
    const tech = getCached<TechPayload>(kTech(symbol, tfAnalysis));
    setTechState(tech ?? null);
    const ai = getCached<AIPayload>(kAI(symbol, tfAnalysis));
    setAiState(ai ?? null);
  }, [symbol, tfAnalysis]);

  const keyTech = useMemo(() => kTech(symbol, tfAnalysis), [symbol, tfAnalysis]);
  const keyAI = useMemo(() => kAI(symbol, tfAnalysis), [symbol, tfAnalysis]);

  const hasTechCache = Boolean(getCached<TechPayload>(keyTech));
  const hasAiCache = Boolean(getCached<AIPayload>(keyAI));

  const canAffordTech = ready && canSpend(COST.TECH);
  const canAffordAI = ready && canSpend(COST.AI);

  const handleRunTech = async () => {
    if (loading) return;
    const cached = getCached<TechPayload>(keyTech);
    if (cached) {
      setTechState(cached);
      return;
    }
    if (!ready || !canSpend(COST.TECH)) return;
    setLoading("tech");
    try {
      await spendGuard(
        canSpend,
        spend,
        refund,
        COST.TECH,
        "tech",
        async () => {
          const tech = await computeTechnicalAll(symbol, tfAnalysis);
          setCached(keyTech, tech);
          setTechState(tech);
          return tech;
        },
        { symbol, tf: tfAnalysis },
      );
    } finally {
      setLoading(null);
    }
  };

  const handleRunAI = async () => {
    if (loading) return;
    const cachedAI = getCached<AIPayload>(keyAI);
    if (cachedAI) {
      setAiState(cachedAI);
      const cachedTech = getCached<TechPayload>(keyTech);
      if (cachedTech) {
        setTechState(cachedTech);
      }
      return;
    }
    if (!ready || !canSpend(COST.AI)) return;
    setLoading("ai");
    try {
      await spendGuard(
        canSpend,
        spend,
        refund,
        COST.AI,
        "ai",
        async () => {
          const tech = await (async () => {
            const cachedTech = getCached<TechPayload>(keyTech);
            if (cachedTech) return cachedTech;
            const computed = await computeTechnicalAll(symbol, tfAnalysis);
            setCached(keyTech, computed);
            return computed;
          })();
          setTechState(tech);
          const ai = await computeAI(symbol, tfAnalysis, tech);
          setCached(keyAI, ai);
          setAiState(ai);
          return ai;
        },
        { symbol, tf: tfAnalysis },
      );
    } finally {
      setLoading(null);
    }
  };

  const techDisabled =
    loading === "ai" || (!canAffordTech && !hasTechCache && !techState);
  const aiDisabled =
    loading === "tech" || (!canAffordAI && !hasAiCache && !aiState);

  const techTooltip = !ready
    ? "Loading credits…"
    : !canAffordTech && !hasTechCache && !techState
    ? "Not enough credits. Buy more to continue."
    : "Runs all indicators (RSI, MACD, ADX, EMAs, ATR, volume stats, SR proximity) for the selected timeframe. Uses 2 credits per timeframe. Cached ~10 min.";

  const aiTooltip = !ready
    ? "Loading credits…"
    : !canAffordAI && !hasAiCache && !aiState
    ? "Not enough credits. Buy more to continue."
    : "Computes technicals and generates an AI summary with entry/target/invalidation for the selected timeframe. Uses 5 credits per timeframe. Cached ~10 min.";

  const aiLastRun = relativeTimeFrom(aiState?.generatedAt);

  return (
    <div className={styles.layout}>
      <section className={`${styles.panel} ${styles.panelTechnical} ${styles.dense}`}>
        <div className={styles.leftBody}>
          <LeftControlBox
            symbol={symbol}
            tfAnalysis={tfAnalysis}
            onChangeSymbol={(next) => setSymbol(next)}
            onChangeTimeframe={(nextTf) => {
              setTfAnalysis(nextTf);
              setTfChart(nextTf);
            }}
            credits={credits}
            creditsReady={ready}
            loading={loading}
            onRunTech={handleRunTech}
            onRunAI={handleRunAI}
            techDisabled={techDisabled}
            aiDisabled={aiDisabled}
            techTooltip={techTooltip}
            aiTooltip={aiTooltip}
          />
          <TechnicalPanel symbol={symbol} tf={tfAnalysis} data={techState} />
        </div>
      </section>

      <section className={`${styles.panel} ${styles.panelChart}`}>
        <div className={styles.panelHeader}>Chart @ {tfChart}</div>
        <div className={styles.panelBody}>
          <ChartPanel
            symbol={symbol}
            tf={tfChart}
            onChangeChartTf={(next) => setTfChart(next)}
          />
        </div>
      </section>

      <section className={`${styles.panel} ${styles.panelAI} ${styles.dense}`}>
        <div className={styles.panelHeader}>
          <span>AI Summary</span>
          <div className={styles.panelHeaderMeta}>
            <span className={styles.panelHeaderCredits}>
              Credits: {ready ? credits : "…"}
            </span>
            {aiState && (
              <>
                <span className={styles.panelHeaderCaption}>Analysed @ {tfAnalysis}</span>
                {aiLastRun && (
                  <span className={styles.panelHeaderSub}>Last analysed · {aiLastRun}</span>
                )}
              </>
            )}
          </div>
        </div>
        <div className={styles.panelBody}>
          <AISummaryPanel
            symbol={symbol}
            tf={tfAnalysis}
            data={aiState}
            onRunAI={handleRunAI}
            aiDisabled={aiDisabled}
            aiTooltip={aiTooltip}
            isLoading={loading === "ai"}
          />
        </div>
      </section>
    </div>
  );
}
