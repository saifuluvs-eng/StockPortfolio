// client/src/pages/analyse.tsx
import { FormEvent, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEFAULT_SYMBOL = "BTCUSDT";
const DEFAULT_TIMEFRAME = "240"; // 4h

const TIMEFRAMES = [
  { value: "15", label: "15 minutes", short: "15m" },
  { value: "60", label: "1 hour", short: "1h" },
  { value: "240", label: "4 hours", short: "4h" },
  { value: "D", label: "1 day", short: "1D" },
  { value: "W", label: "1 week", short: "1W" }
];

const CHECKLIST = [
  {
    title: "Symbol and timeframe controls",
    status: "complete" as const,
    summary: "Search input, timeframe selector, and deep-link friendly routing.",
  },
  {
    title: "TradingView chart embed",
    status: "next" as const,
    summary: "Wire up the interactive chart without triggering websocket failures when the service is offline.",
  },
  {
    title: "Technical indicator breakdown",
    status: "next" as const,
    summary: "Port the scanner insights panel with defensive fallbacks for missing API responses.",
  },
  {
    title: "Watchlist & recent scans",
    status: "later" as const,
    summary: "Reconnect saved markets and history browsing once authentication flow is stable on the new page.",
  },
];

type ChecklistStatus = (typeof CHECKLIST)[number]["status"];

const statusCopy: Record<ChecklistStatus, { label: string; tone: "default" | "secondary" | "outline" }> = {
  complete: { label: "Complete", tone: "secondary" },
  next: { label: "In progress", tone: "default" },
  later: { label: "Planned", tone: "outline" },
};

function toUsdtSymbol(input: string) {
  const coin = (input || "").trim().toUpperCase();
  if (!coin) return DEFAULT_SYMBOL;
  return coin.endsWith("USDT") ? coin : `${coin}USDT`;
}

function toDisplaySymbol(symbol: string) {
  const base = (symbol || DEFAULT_SYMBOL).toUpperCase();
  if (!base.endsWith("USDT")) return base || DEFAULT_SYMBOL;
  return `${base.slice(0, -4)}/USDT`;
}

export default function Analyse() {
  const [symbolInput, setSymbolInput] = useState("BTC");
  const [activeSymbol, setActiveSymbol] = useState(DEFAULT_SYMBOL);
  const [timeframe, setTimeframe] = useState(DEFAULT_TIMEFRAME);

  const displaySymbol = useMemo(() => toDisplaySymbol(activeSymbol), [activeSymbol]);
  const timeframeCopy = useMemo(
    () => TIMEFRAMES.find((tf) => tf.value === timeframe)?.label ?? "Custom",
    [timeframe],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = toUsdtSymbol(symbolInput);
    setActiveSymbol(next);
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 24,
        padding: 24,
      }}
    >
      <header style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600 }}>Analyse</h1>
            <p style={{ color: "#9ca3af", marginTop: 4 }}>
              Stage the new research workspace here, then migrate modules from Charts once they&apos;re verified.
            </p>
          </div>
          <Badge variant="outline">Staged rollout</Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Symbol controls</CardTitle>
          <CardDescription>
            Use this section to confirm the search and timeframe plumbing before layering real market data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div style={{ display: "grid", gap: 6, minWidth: 220 }}>
              <label htmlFor="analyse-symbol" style={{ fontSize: 14, color: "#d1d5db" }}>
                Symbol
              </label>
              <Input
                id="analyse-symbol"
                placeholder="Enter symbol (e.g. BTC)"
                value={symbolInput}
                onChange={(event) => setSymbolInput(event.target.value)}
              />
            </div>
            <div style={{ display: "grid", gap: 6, minWidth: 180 }}>
              <label htmlFor="analyse-timeframe" style={{ fontSize: 14, color: "#d1d5db" }}>
                Timeframe
              </label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger id="analyse-timeframe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAMES.map((tf) => (
                    <SelectItem key={tf.value} value={tf.value}>
                      {tf.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" style={{ alignSelf: "flex-end" }}>
              Update selection
            </Button>
          </form>

          <div
            style={{
              marginTop: 24,
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
              color: "#d1d5db",
            }}
          >
            <div style={{ minWidth: 180 }}>
              <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Active symbol</p>
              <p style={{ fontSize: 24, fontWeight: 600 }}>{displaySymbol}</p>
            </div>
            <div style={{ minWidth: 160 }}>
              <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Timeframe</p>
              <p style={{ fontSize: 24, fontWeight: 600 }}>{timeframeCopy}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div
        style={{
          display: "grid",
          gap: 24,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        <Card style={{ minHeight: 260 }}>
          <CardHeader>
            <CardTitle>Chart placeholder</CardTitle>
            <CardDescription>
              Embed the TradingView widget here once websocket dependencies are confirmed for the new route.
            </CardDescription>
          </CardHeader>
          <CardContent style={{ display: "grid", placeItems: "center", height: "100%" }}>
            <div
              style={{
                border: "1px dashed #4b5563",
                borderRadius: 12,
                padding: 24,
                textAlign: "center",
                width: "100%",
                color: "#9ca3af",
              }}
            >
              TradingView module pending
            </div>
          </CardContent>
        </Card>

        <Card style={{ minHeight: 260 }}>
          <CardHeader>
            <CardTitle>Technical breakdown</CardTitle>
            <CardDescription>
              Move the scanner summary cards here once the API handlers are ready for staged roll-out.
            </CardDescription>
          </CardHeader>
          <CardContent style={{ display: "grid", gap: 12, color: "#9ca3af" }}>
            <p>
              Use this space for the indicators table and recommendation badges. Keep the component API compatible
              with the existing Charts implementation so a single source of truth can power both routes during
              migration.
            </p>
            <div
              style={{
                borderRadius: 12,
                background: "rgba(59,130,246,0.08)",
                border: "1px dashed rgba(59,130,246,0.4)",
                padding: 16,
              }}
            >
              <strong style={{ color: "#bfdbfe" }}>Next step:</strong> reconnect the indicator hook and render the
              neutral state before enabling auto-scans.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Migration checklist</CardTitle>
          <CardDescription>
            Track progress as functionality graduates from Charts to Analyse. Update statuses as features stabilize.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ display: "grid", gap: 16 }}>
            {CHECKLIST.map((item) => {
              const badge = statusCopy[item.status];
              return (
                <div
                  key={item.title}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: 16,
                    borderRadius: 12,
                    border: "1px solid #1f2937",
                    background: "#111827",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: 18, fontWeight: 600 }}>{item.title}</h3>
                    <Badge variant={badge.tone}>{badge.label}</Badge>
                  </div>
                  <p style={{ color: "#9ca3af" }}>{item.summary}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
