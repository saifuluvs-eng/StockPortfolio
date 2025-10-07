import React, { useState } from "react";
import styles from "./AnalyseV2.module.css";
import { TechnicalPanel } from "@/components/analyse-v2/TechnicalPanel";
import { ChartPanel } from "@/components/analyse-v2/ChartPanel";
import { AISummaryPanel } from "@/components/analyse-v2/AISummaryPanel";
import LeftControlBox from "@/components/analyse-v2/LeftControlBox";
import { useCreditStore } from "@/stores/creditStore";

type Timeframe = "15m" | "1h" | "4h" | "1d";

export default function AnalyseV2() {
  const [symbol, setSymbol] = useState("INJUSDT");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");

  const { credits } = useCreditStore();

  return (
    <div className={styles.layout}>
      <section className={`${styles.panel} ${styles.panelTechnical} ${styles.dense}`}>
        <div className={styles.panelHeader}>Technical Breakdown</div>
        <div className={styles.panelBody}>
          <LeftControlBox
            symbol={symbol}
            timeframe={timeframe}
            onChangeSymbol={(next) => setSymbol(next)}
            onChangeTf={(nextTf) => setTimeframe(nextTf as Timeframe)}
            onAnalyse={() => Promise.resolve()}
          />
          <TechnicalPanel symbol={symbol} tf={timeframe} />
        </div>
      </section>

      <section className={`${styles.panel} ${styles.panelChart}`}>
        <div className={styles.panelHeader}>Chart</div>
        <div className={styles.panelBody}>
          <ChartPanel symbol={symbol} tf={timeframe} />
        </div>
      </section>

      <section className={`${styles.panel} ${styles.panelAI} ${styles.dense}`}>
        <div className={styles.panelHeader}>
          <span>AI Summary</span>
          <span style={{ opacity: 0.7 }}>Credits: {credits}</span>
        </div>
        <div className={styles.panelBody}>
          <AISummaryPanel symbol={symbol} tf={timeframe} />
        </div>
      </section>
    </div>
  );
}
