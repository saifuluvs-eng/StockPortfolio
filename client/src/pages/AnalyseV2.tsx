import { useEffect, useState } from "react";
import styles from "./AnalyseV2.module.css";
import { TechnicalPanel } from "@/components/analyse-v2/TechnicalPanel";
import { ChartPanel } from "@/components/analyse-v2/ChartPanel";
import { AISummaryPanel } from "@/components/analyse-v2/AISummaryPanel";
import LeftControlBox from "@/components/analyse-v2/LeftControlBox";
import { useCredits } from "@/stores/creditStore";
import { getCached, kAI, kTech } from "@/lib/cache";
import type { AIPayload, TechPayload } from "@/lib/analyseClient";

type Timeframe = "15m" | "1h" | "4h" | "1d";

export default function AnalyseV2() {
  const [symbol, setSymbol] = useState("INJUSDT");
  const [tfDisplay, setTfDisplay] = useState<Timeframe>("1h");
  const [tfAnalysis, setTfAnalysis] = useState<Timeframe>("1h");
  const [techState, setTechState] = useState<TechPayload | null>(null);
  const [aiState, setAiState] = useState<AIPayload | null>(null);

  const { credits } = useCredits();

  useEffect(() => {
    const tech = getCached<TechPayload>(kTech(symbol, tfAnalysis));
    setTechState(tech ?? null);
    const ai = getCached<AIPayload>(kAI(symbol, tfAnalysis));
    setAiState(ai ?? null);
  }, [symbol, tfAnalysis]);

  const handleSync = () => {
    setTfAnalysis(tfDisplay);
  };

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
              setTfDisplay(nextTf);
            }}
            setTechState={setTechState}
            setAIState={setAiState}
          />
          <TechnicalPanel symbol={symbol} tf={tfAnalysis} data={techState} />
        </div>
      </section>

      <section className={`${styles.panel} ${styles.panelChart}`}>
        <div className={styles.panelHeader}>Chart</div>
        <div className={styles.panelBody}>
          <ChartPanel
            symbol={symbol}
            tf={tfDisplay}
            onChangeDisplayTf={(next) => setTfDisplay(next)}
          />
        </div>
      </section>

      <section className={`${styles.panel} ${styles.panelAI} ${styles.dense}`}>
        <div className={styles.panelHeader}>
          <span>AI Summary</span>
          <span style={{ opacity: 0.7 }}>Credits: {credits}</span>
        </div>
        {tfDisplay !== tfAnalysis && (
          <div className={styles.syncBanner}>
            Chart: {tfDisplay} · Analysis: {tfAnalysis}
            <button type="button" onClick={handleSync} className={styles.syncButton}>
              Sync
            </button>
          </div>
        )}
        <div className={styles.panelBody}>
          <AISummaryPanel symbol={symbol} tf={tfAnalysis} data={aiState} />
        </div>
      </section>
    </div>
  );
}
