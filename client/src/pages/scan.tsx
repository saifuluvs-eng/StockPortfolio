// client/src/pages/scan.tsx
import React, { useMemo, useState } from "react";

/**
 * Local lightweight wrappers so we don't depend on ../components/Layout.
 * (Keeps build green regardless of folder casing/paths.)
 */
function Page(props: React.PropsWithChildren) {
  return (
    <main
      style={{
        padding: 16,
        background: "#0f0f0f",
        color: "#e0e0e0",
        minHeight: "100vh",
        fontFamily:
          "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      {props.children}
    </main>
  );
}

function Toolbar(props: React.PropsWithChildren) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
        background: "#161616",
        border: "1px solid #2a2a2a",
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        maxWidth: 1200,
      }}
    >
      {props.children}
    </div>
  );
}

function Card(
  props: React.PropsWithChildren<{ inset?: boolean; style?: React.CSSProperties }>
) {
  return (
    <div
      style={{
        background: props.inset ? "#151515" : "#181818",
        border: `1px solid ${props.inset ? "#2a2a2a" : "#2e2e2e"}`,
        borderRadius: 10,
        padding: 12,
        ...(props.style || {}),
      }}
    >
      {props.children}
    </div>
  );
}

function StatGrid(props: React.PropsWithChildren) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
        gap: 12,
        maxWidth: 1200,
        marginBottom: 12,
      }}
    >
      {props.children}
    </div>
  );
}

function StatBox({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: React.ReactNode;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "#171717",
        border: "1px solid #2a2a2a",
        borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 16, ...(valueStyle || {}) }}>
        {value}
      </div>
    </div>
  );
}

/**
 * Scan Page
 * - Minimal, safe client-side scan that fetches Binance 24h stats for entered coins
 */

type Row = {
  base: string; // e.g., BTC
  pair: string; // e.g., BTCUSDT
  lastPrice: number;
  highPrice: number;
  lowPrice: number;
  priceChangePercent: number;
};

const TIMEFRAMES = [
  { label: "15min", value: "15" },
  { label: "30min", value: "30" },
  { label: "1Hr", value: "60" },
  { label: "4hr", value: "240" },
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
];

// Helpers
function sanitizeBaseTicker(input: string): string {
  const lettersOnly =
    (input || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, " ")
      .trim()
      .split(/\s+/)[0] || "";
  if (lettersOnly.endsWith("USDT")) return lettersOnly.slice(0, -4);
  return lettersOnly;
}

function toUsdtPair(baseOrPair: string): string {
  const up = (baseOrPair || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!up) return "BTCUSDT";
  return up.endsWith("USDT") ? up : `${up}USDT`;
}

export default function Scan() {
  // UI filters
  const [coinsInput, setCoinsInput] = useState<string>("BTC, ETH, AVAX");
  const [timeframe, setTimeframe] = useState<string>("60"); // 1Hr default
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  // Quick summary for stat boxes
  const summary = useMemo(() => {
    if (!rows.length) {
      return {
        coins: 0,
        advancers: 0,
        decliners: 0,
        avgChange: 0,
      };
    }
    let adv = 0,
      dec = 0,
      sum = 0;
    for (const r of rows) {
      if (r.priceChangePercent > 0) adv++;
      else if (r.priceChangePercent < 0) dec++;
      sum += r.priceChangePercent;
    }
    return {
      coins: rows.length,
      advancers: adv,
      decliners: dec,
      avgChange: sum / rows.length,
    };
  }, [rows]);

  async function runScan() {
    try {
      setLoading(true);
      setError(null);
      setRows([]);

      // Parse coins list
      const bases = coinsInput
        .split(/[,\n]/g)
        .map((s) => sanitizeBaseTicker(s.trim()))
        .filter(Boolean);

      if (!bases.length) {
        setError("Please enter at least one coin name (e.g., BTC, ETH).");
        setLoading(false);
        return;
      }

      // Fetch Binance 24h stats for each coin (USDT pairs)
      const results = await Promise.allSettled(
        bases.map(async (b) => {
          const pair = toUsdtPair(b);
          const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(
            pair
          )}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${pair} error: ${res.status}`);
          const j = await res.json();
          const row: Row = {
            base: b,
            pair,
            lastPrice: parseFloat(j.lastPrice),
            highPrice: parseFloat(j.highPrice),
            lowPrice: parseFloat(j.lowPrice),
            priceChangePercent: parseFloat(j.priceChangePercent),
          };
          return row;
        })
      );

      const ok: Row[] = [];
      const errs: string[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") ok.push(r.value);
        else errs.push((r.reason as Error)?.message || "Unknown error");
      }

      // Sort by % change desc
      ok.sort((a, b) => b.priceChangePercent - a.priceChangePercent);

      setRows(ok);
      if (errs.length) setError(errs.join(" • "));
    } catch (e: any) {
      setError(e?.message || "Scan failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page>
      <h1 style={{ marginTop: 0 }}>Scan</h1>

      {/* Filters / Toolbar */}
      <Toolbar>
        {/* Coins input */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, opacity: 0.75 }}>Coin Names</label>
          <textarea
            value={coinsInput}
            onChange={(e) => setCoinsInput(e.target.value)}
            placeholder="BTC, ETH, AVAX"
            rows={2}
            style={{
              background: "#0e0e0e",
              color: "#e0e0e0",
              border: "1px solid #333",
              borderRadius: 8,
              padding: "8px 10px",
              outline: "none",
              minWidth: 260,
              resize: "vertical",
            }}
          />
        </div>

        {/* Timeframe (visual parity with Charts) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, opacity: 0.75 }}>Timeframe</label>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            style={{
              background: "#0e0e0e",
              color: "#e0e0e0",
              border: "1px solid #333",
              borderRadius: 8,
              padding: "8px 10px",
              outline: "none",
              minWidth: 180,
            }}
          >
            {TIMEFRAMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Run button */}
        <div style={{ alignSelf: "end" }}>
          <button
            onClick={runScan}
            disabled={loading}
            style={{
              background: "#232323",
              color: "#e0e0e0",
              border: "1px solid #333",
              borderRadius: 8,
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            {loading ? "Scanning…" : "Run Scan"}
          </button>
        </div>
      </Toolbar>

      {/* Stats row */}
      <StatGrid>
        <StatBox label="Coins" value={summary.coins} />
        <StatBox label="Advancers" value={summary.advancers} />
        <StatBox label="Decliners" value={summary.decliners} />
        <StatBox
          label="Avg 24h %"
          value={rows.length ? `${summary.avgChange.toFixed(2)}%` : "—"}
          valueStyle={{
            color:
              rows.length && summary.avgChange >= 0
                ? "#9ef7bb"
                : rows.length
                ? "#ffb3b3"
                : undefined,
          }}
        />
      </StatGrid>

      {/* Results Table */}
      <Card inset>
        {error ? (
          <div
            style={{
              background: "#2a1717",
              border: "1px solid #5a2a2a",
              color: "#ffb3b3",
              padding: "8px 12px",
              borderRadius: 8,
              marginBottom: 10,
            }}
          >
            {error}
          </div>
        ) : null}

        {!rows.length && !loading ? (
          <div style={{ opacity: 0.8 }}>
            No results yet. Enter coin names and click <b>Run Scan</b>.
          </div>
        ) : null}

        {rows.length ? (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
                minWidth: 680,
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>Coin</th>
                  <th style={thStyle}>Pair</th>
                  <th style={thStyleRight}>Last Price</th>
                  <th style={thStyleRight}>24h High</th>
                  <th style={thStyleRight}>24h Low</th>
                  <th style={thStyleRight}>24h %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.pair}>
                    <td style={tdStyle}>{r.base}</td>
                    <td style={tdStyleMono}>{r.pair}</td>
                    <td style={tdStyleRight}>{r.lastPrice.toFixed(6)}</td>
                    <td style={tdStyleRight}>{r.highPrice.toFixed(6)}</td>
                    <td style={tdStyleRight}>{r.lowPrice.toFixed(6)}</td>
                    <td
                      style={{
                        ...tdStyleRight,
                        color:
                          r.priceChangePercent >= 0 ? "#9ef7bb" : "#ffb3b3",
                        fontWeight: 600,
                      }}
                    >
                      {r.priceChangePercent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </Page>
  );
}

/* table cell styles */
const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  opacity: 0.75,
  padding: "10px 10px",
  borderBottom: "1px solid #2a2a2a",
};

const thStyleRight: React.CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 10px",
  borderBottom: "1px solid #2a2a2a",
  fontSize: 13,
};

const tdStyleRight: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const tdStyleMono: React.CSSProperties = {
  ...tdStyle,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};
