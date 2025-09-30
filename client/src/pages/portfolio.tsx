// client/src/pages/portfolio.tsx
import React, { useEffect, useMemo, useState } from "react";

/* ------------------------------ helpers ------------------------------ */
type Holding = {
  id: string;
  coin: string;   // BTC
  pair: string;   // BTCUSDT
  qty: number;    // 0.5
  avgCost: number;// 42000
};

type Ticker = {
  pair: string;
  price: number;
  changePct24h: number;
};

const LS_KEY = "portfolio.v1";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36).slice(2);
}
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
function fmt(n: number, digits = 2) {
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/* ------------------------------ component ---------------------------- */
export default function Portfolio() {
  const [holdings, setHoldings] = useState<Holding[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? (JSON.parse(raw) as Holding[]) : [];
    } catch {
      return [];
    }
  });

  // form state
  const [coin, setCoin] = useState("");
  const [qty, setQty] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(false);

  // search/sort
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<
    "coin" | "value" | "pnl$" | "pnl%" | "qty" | "price" | "chg24"
  >("value");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // Persist on change
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(holdings));
  }, [holdings]);

  // Fetch live prices
  const pairs = useMemo(
    () => Array.from(new Set(holdings.map((h) => h.pair))).sort(),
    [holdings]
  );
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!pairs.length) {
        setTickers({});
        return;
      }
      try {
        setLoadingPrices(true);
        const results = await Promise.allSettled(
          pairs.map(async (pair) => {
            const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(
              pair
            )}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`${pair} ${res.status}`);
            const j = await res.json();
            const t: Ticker = {
              pair,
              price: parseFloat(j.lastPrice),
              changePct24h: parseFloat(j.priceChangePercent),
            };
            return t;
          })
        );
        if (cancelled) return;
        const dict: Record<string, Ticker> = {};
        for (const r of results) {
          if (r.status === "fulfilled") dict[r.value.pair] = r.value;
        }
        setTickers(dict);
      } catch {
        if (!cancelled) setTickers({});
      } finally {
        if (!cancelled) setLoadingPrices(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [pairs.join("|")]);

  // Derived rows
  type Row = Holding & {
    price: number;
    value: number;
    pnl$: number;
    pnlPct: number;
    chg24: number;
  };

  const allRows: Row[] = useMemo(() => {
    return holdings.map((h) => {
      const t = tickers[h.pair];
      const price = t?.price ?? NaN;
      const value = isFinite(price) ? price * h.qty : NaN;
      const pnl$ = isFinite(price) ? (price - h.avgCost) * h.qty : NaN;
      const pnlPct =
        isFinite(price) && h.avgCost > 0 ? ((price - h.avgCost) / h.avgCost) * 100 : NaN;
      const chg24 = t?.changePct24h ?? NaN;
      return { ...h, price, value, pnl$, pnlPct, chg24 };
    });
  }, [holdings, tickers]);

  const filteredRows = useMemo(() => {
    const term = q.trim().toUpperCase();
    const base = term ? allRows.filter((r) => r.coin.includes(term) || r.pair.includes(term)) : allRows.slice();
    const sorted = base.sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "coin": return mul * a.coin.localeCompare(b.coin);
        case "qty": return mul * ((a.qty || 0) - (b.qty || 0));
        case "price": return mul * ((a.price || 0) - (b.price || 0));
        case "value": return mul * ((a.value || 0) - (b.value || 0));
        case "pnl$": return mul * ((a.pnl$ || 0) - (b.pnl$ || 0));
        case "pnl%": return mul * ((a.pnlPct || 0) - (b.pnlPct || 0));
        case "chg24": return mul * ((a.chg24 || 0) - (b.chg24 || 0));
      }
    });
    return sorted;
  }, [allRows, q, sortKey, sortDir]);

  // Totals
  const totals = useMemo(() => {
    let value = 0;
    let cost = 0;
    for (const r of allRows) {
      if (isFinite(r.value)) value += r.value;
      cost += r.avgCost * r.qty;
    }
    const pnl$ = value - cost;
    const pnlPct = cost > 0 ? (pnl$ / cost) * 100 : 0;
    let weightedChange = 0;
    if (value > 0) {
      for (const r of allRows) {
        if (!isFinite(r.value) || !isFinite(r.chg24)) continue;
        weightedChange += (r.value / value) * r.chg24;
      }
    }
    return { value, pnl$, pnlPct, chg24: weightedChange };
  }, [allRows]);

  // CRUD
  function addHolding(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const c = sanitizeBaseTicker(coin);
    const qn = parseFloat(qty);
    const an = parseFloat(avgCost);
    if (!c) return setErr("Enter a coin (e.g., BTC, ETH).");
    if (!isFinite(qn) || qn <= 0) return setErr("Enter a valid quantity (> 0).");
    if (!isFinite(an) || an <= 0) return setErr("Enter a valid average cost (> 0).");
    const pair = toUsdtPair(c);
    setHoldings((prev) => [...prev, { id: uid(), coin: c, pair, qty: qn, avgCost: an }]);
    setCoin(""); setQty(""); setAvgCost("");
  }
  function removeHolding(id: string) {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  }
  function editHolding(h: Holding) {
    const coinNew = prompt("Coin (letters only):", h.coin) ?? h.coin;
    const qtyNew = parseFloat(prompt("Quantity:", String(h.qty)) ?? String(h.qty));
    const costNew = parseFloat(
      prompt("Average Cost (USDT):", String(h.avgCost)) ?? String(h.avgCost)
    );
    const c = sanitizeBaseTicker(coinNew);
    if (!c || !isFinite(qtyNew) || qtyNew <= 0 || !isFinite(costNew) || costNew <= 0) {
      alert("Invalid inputs. Edit cancelled.");
      return;
    }
    const pair = toUsdtPair(c);
    setHoldings((prev) =>
      prev.map((x) => (x.id === h.id ? { ...x, coin: c, pair, qty: qtyNew, avgCost: costNew } : x))
    );
  }

  /* ------------------------------ render ------------------------------ */
  return (
    <main
      style={{
        padding: 16,
        color: "var(--text, #e0e0e0)",
        background: "transparent",
        fontFamily:
          "var(--font, Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif)",
      }}
    >
      <h1 style={{ marginTop: 0 }}>Portfolio</h1>

      {/* Summary + allocation */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(240px, 1fr) minmax(240px, 1fr) minmax(260px, 1fr)",
          gap: 12,
          maxWidth: 1200,
          marginBottom: 12,
        }}
      >
        <Card title="Total Value">
          <strong>${fmt(totals.value, 2)}</strong>
        </Card>
        <Card title="P&L">
          <span
            style={{
              color: totals.pnl$ >= 0 ? "#9ef7bb" : "#ffb3b3",
              fontWeight: 700,
            }}
          >
            ${fmt(totals.pnl$, 2)}
          </span>
          <span style={{ opacity: 0.8, marginLeft: 8 }}>({fmt(totals.pnlPct, 2)}%)</span>
        </Card>
        <Card title="24h % (Value-weighted)">
          <span
            style={{
              color:
                isFinite(totals.chg24) && totals.chg24 >= 0 ? "#9ef7bb" : "#ffb3b3",
              fontWeight: 700,
            }}
          >
            {isFinite(totals.chg24) ? `${fmt(totals.chg24, 2)}%` : "—"}
          </span>
        </Card>
      </div>

      {/* Add + search */}
      <section
        style={{
          background: "var(--panel, #151515)",
          border: "1px solid var(--border, #2a2a2a)",
          borderRadius: 12,
          padding: 16,
          maxWidth: 1200,
          marginBottom: 12,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Manage Positions</h3>
        {err ? (
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
            {err}
          </div>
        ) : null}

        <form
          onSubmit={addHolding}
          style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}
        >
          <Field label="Coin (auto-USDT)">
            <input
              value={coin}
              onChange={(e) => setCoin(e.target.value.toUpperCase())}
              placeholder="BTC, ETH, AVAX"
              maxLength={10}
              style={input}
            />
          </Field>

          <Field label="Quantity">
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="decimal"
              placeholder="0.5"
              style={input}
            />
          </Field>

          <Field label="Avg Cost (USDT)">
            <input
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              inputMode="decimal"
              placeholder="42000"
              style={input}
            />
          </Field>

          <button type="submit" style={btn}>Add</button>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "end" }}>
            <Field label="Search">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="BTC, ETH…"
                style={{ ...input, minWidth: 180 }}
              />
            </Field>

            <Field label="Sort">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as any)}
                style={{ ...input, minWidth: 160 }}
              >
                <option value="value">Value</option>
                <option value="pnl$">P&L $</option>
                <option value="pnl%">P&L %</option>
                <option value="price">Price</option>
                <option value="qty">Qty</option>
                <option value="chg24">24h %</option>
                <option value="coin">Coin</option>
              </select>
            </Field>

            <Field label=" ">
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                style={btn}
                title="Toggle sort direction"
              >
                {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
              </button>
            </Field>
          </div>
        </form>
      </section>

      {/* Allocation donut */}
      <section
        style={{
          background: "var(--panel, #151515)",
          border: "1px solid var(--border, #2a2a2a)",
          borderRadius: 12,
          padding: 16,
          maxWidth: 1200,
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0 }}>Allocation</h3>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <Donut rows={allRows} />
          <div style={{ display: "grid", gap: 6 }}>
            {allRows
              .sort((a, b) => (b.value || 0) - (a.value || 0))
              .slice(0, 10)
              .map((r, idx) => {
                const pct = totals.value > 0 && isFinite(r.value) ? (r.value / totals.value) * 100 : 0;
                const color = palette[idx % palette.length];
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: color, display: "inline-block" }} />
                    <span style={{ width: 60, opacity: 0.85 }}>{r.coin}</span>
                    <span style={{ opacity: 0.7 }}>{fmt(pct, 2)}%</span>
                  </div>
                );
              })}
            {allRows.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No data yet. Add a position above.</div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Holdings table */}
      <section
        style={{
          background: "var(--panel, #151515)",
          border: "1px solid var(--border, #2a2a2a)",
          borderRadius: 12,
          padding: 16,
          maxWidth: 1200,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Holdings</h3>
          {loadingPrices ? (
            <span style={{ fontSize: 12, opacity: 0.7 }}>(loading prices…)</span>
          ) : null}
        </div>

        {filteredRows.length === 0 ? (
          <div
            style={{
              marginTop: 10,
              background: "var(--card, #181818)",
              border: "1px solid var(--border-soft, #2e2e2e)",
              borderRadius: 10,
              padding: 14,
            }}
          >
            <div style={{ opacity: 0.85 }}>
              {q ? "No results match your search." : "No holdings yet. Add a position above to get started."}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
                minWidth: 980,
              }}
            >
              <thead>
                <tr>
                  <th style={th}>Coin</th>
                  <th style={th}>Pair</th>
                  <th style={thRight}>Qty</th>
                  <th style={thRight}>Avg Cost</th>
                  <th style={thRight}>Price</th>
                  <th style={thRight}>Value</th>
                  <th style={thRight}>Unreal. P&L $</th>
                  <th style={thRight}>Unreal. P&L %</th>
                  <th style={thRight}>24h %</th>
                  <th style={thRight}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td style={td}>{r.coin}</td>
                    <td style={tdMono}>{r.pair}</td>
                    <td style={tdRight}>{fmt(r.qty, 6)}</td>
                    <td style={tdRight}>${fmt(r.avgCost, 2)}</td>
                    <td style={tdRight}>${isFinite(r.price) ? fmt(r.price, 6) : "—"}</td>
                    <td style={tdRight}>
                      ${isFinite(r.value) ? fmt(r.value, 2) : "—"}
                    </td>
                    <td
                      style={{
                        ...tdRight,
                        color: isFinite(r.pnl$) ? (r.pnl$ >= 0 ? "#9ef7bb" : "#ffb3b3") : undefined,
                        fontWeight: 600,
                      }}
                    >
                      {isFinite(r.pnl$) ? `$${fmt(r.pnl$, 2)}` : "—"}
                    </td>
                    <td
                      style={{
                        ...tdRight,
                        color: isFinite(r.pnlPct) ? (r.pnlPct >= 0 ? "#9ef7bb" : "#ffb3b3") : undefined,
                        fontWeight: 600,
                      }}
                    >
                      {isFinite(r.pnlPct) ? `${fmt(r.pnlPct, 2)}%` : "—"}
                    </td>
                    <td
                      style={{
                        ...tdRight,
                        color: isFinite(r.chg24) ? (r.chg24 >= 0 ? "#9ef7bb" : "#ffb3b3") : undefined,
                        fontWeight: 600,
                      }}
                    >
                      {isFinite(r.chg24) ? `${fmt(r.chg24, 2)}%` : "—"}
                    </td>
                    <td style={{ ...tdRight }}>
                      <button
                        onClick={() => editHolding(r)}
                        style={{ ...iconBtn, borderColor: "#3a3a3a" }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => removeHolding(r.id)}
                        style={{
                          ...iconBtn,
                          borderColor: "#5a2a2a",
                          background: "#2a1717",
                          color: "#ffb3b3",
                          marginLeft: 6,
                        }}
                        title="Delete"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* totals row */}
              <tfoot>
                <tr>
                  <td style={{ ...td, fontWeight: 700 }} colSpan={5}>Totals</td>
                  <td style={{ ...tdRight, fontWeight: 700 }}>
                    ${fmt(totals.value, 2)}
                  </td>
                  <td style={{ ...tdRight, fontWeight: 700, color: totals.pnl$ >= 0 ? "#9ef7bb" : "#ffb3b3" }}>
                    ${fmt(totals.pnl$, 2)}
                  </td>
                  <td style={{ ...tdRight, fontWeight: 700, color: totals.pnlPct >= 0 ? "#9ef7bb" : "#ffb3b3" }}>
                    {fmt(totals.pnlPct, 2)}%
                  </td>
                  <td style={{ ...tdRight, fontWeight: 700, color: totals.chg24 >= 0 ? "#9ef7bb" : "#ffb3b3" }}>
                    {isFinite(totals.chg24) ? `${fmt(totals.chg24, 2)}%` : "—"}
                  </td>
                  <td style={tdRight}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

/* ------------------------------ small UI bits ------------------------------ */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--panel, #151515)",
        border: "1px solid var(--border, #2a2a2a)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 18 }}>{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.75 }}>{label}</span>
      {children}
    </label>
  );
}

/* ------------------------------ donut chart ------------------------------ */
const palette = [
  "#8ab4f8", "#f28b82", "#fdd663", "#81c995", "#c58af9",
  "#78d9ec", "#f2a2b9", "#b0bec5", "#ffd6a5", "#a7f3d0",
];

function Donut({ rows }: { rows: Array<{ coin: string; value: number }> }) {
  const size = 160; // px
  const stroke = 24;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  const total = rows.reduce((acc, r) => (isFinite(r.value) ? acc + r.value : acc), 0);
  let acc = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2a2a2a" strokeWidth={stroke} />
      {rows
        .filter((r) => isFinite(r.value) && r.value > 0)
        .sort((a, b) => (b.value || 0) - (a.value || 0))
        .slice(0, 10)
        .map((slice, i) => {
          const pct = total > 0 ? slice.value / total : 0;
          const len = pct * circumference;
          const dashArray = `${len} ${circumference - len}`;
          const dashOffset = circumference * (1 - acc);
          acc += pct;
          return (
            <circle
              key={slice.coin}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={palette[i % palette.length]}
              strokeWidth={stroke}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
        })}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14"
        fill="#e0e0e0"
      >
        Allocation
      </text>
    </svg>
  );
}

/* ------------------------------ styles ------------------------------ */
const input: React.CSSProperties = {
  background: "#0e0e0e",
  color: "#e0e0e0",
  border: "1px solid #333",
  borderRadius: 8,
  padding: "8px 10px",
  outline: "none",
  minWidth: 160,
};
const btn: React.CSSProperties = {
  background: "#232323",
  color: "#e0e0e0",
  border: "1px solid #333",
  borderRadius: 8,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 600,
};
const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  opacity: 0.75,
  padding: "10px 10px",
  borderBottom: "1px solid var(--border, #2a2a2a)",
};
const thRight: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = {
  padding: "10px 10px",
  borderBottom: "1px solid var(--border, #2a2a2a)",
  fontSize: 13,
};
const tdRight: React.CSSProperties = {
  ...td,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};
const tdMono: React.CSSProperties = {
  ...td,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};
const iconBtn: React.CSSProperties = {
  background: "#181818",
  color: "#e0e0e0",
  border: "1px solid #333",
  borderRadius: 8,
  padding: "6px 8px",
  cursor: "pointer",
};
