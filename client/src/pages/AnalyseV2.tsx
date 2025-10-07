import React, { useState } from "react";
import styles from "./AnalyseV2.module.css";
import { TechnicalPanel } from "@/components/analyse-v2/TechnicalPanel";
import { ChartPanel } from "@/components/analyse-v2/ChartPanel";
import { AISummaryPanel } from "@/components/analyse-v2/AISummaryPanel";
import { useCreditStore } from "@/stores/creditStore";

type Timeframe = "1h" | "4h" | "1d";

const timeframeOptions: Timeframe[] = ["1h", "4h", "1d"];

export default function AnalyseV2() {
  const [symbol, setSymbol] = useState("INJUSDT");
  const [inputValue, setInputValue] = useState("INJUSDT");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { credits } = useCreditStore();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextSymbol = inputValue.trim();
    if (!nextSymbol) return;
    setSymbol(nextSymbol.toUpperCase());
  };

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setLastRefreshed(new Date());
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <div>
      <div className={styles.toolbar}>
        <form className={styles.toolbarForm} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value.toUpperCase())}
            placeholder="Symbol"
            aria-label="Symbol"
          />
          <button type="submit" className={styles.button}>
            Search
          </button>
        </form>

        <select
          className={styles.select}
          value={timeframe}
          onChange={(event) => setTimeframe(event.target.value as Timeframe)}
          aria-label="Timeframe"
        >
          {timeframeOptions.map((option) => (
            <option key={option} value={option}>
              {option.toUpperCase()}
            </option>
          ))}
        </select>

        <button type="button" className={styles.button} onClick={handleRefresh}>
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>

        <div className={styles.chip}>Credits: {credits}</div>
        {lastRefreshed && (
          <div style={{ fontSize: 11, opacity: 0.6 }}>
            Synced {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>

      <div className={styles.layout}>
        <section className={`${styles.panel} ${styles.panelTechnical} ${styles.dense}`}>
          <div className={styles.panelHeader}>Technical Breakdown</div>
          <div className={styles.panelBody}>
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
    </div>
  );
}
