// client/src/pages/charts.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Inline Error Boundary so the page never goes fully black.
 */
class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { hasError: boolean; msg?: string }
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, msg: undefined };
  }

  static getDerivedStateFromError(err: unknown) {
    return {
      hasError: true,
      msg: err instanceof Error ? err.message : String(err),
    };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("Charts ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ padding: 16 }}>
          <h2 style={{ margin: 0 }}>Something went wrong on this page.</h2>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#222",
              color: "#eee",
              padding: 12,
              borderRadius: 8,
            }}
          >
{this.state.msg}
          </pre>
        </main>
      );
    }
    return this.props.children;
  }
}

/** Safe helpers */
function safeString(val: unknown, fallback = ""): string {
  return typeof val === "string" ? val : fallback;
}
function safeReplace(
  val: unknown,
  pattern: string | RegExp,
  replacement: string
): string {
  return safeString(val).replace(pattern as any, replacement);
}

/** Map our numeric/letter res to TradingView’s interval strings */
function mapResolution(res: string): string {
  switch (res) {
    case "1":
    case "3":
    case "5":
    case "15":
    case "30":
    case "60":
    case "120":
    case "240":
    case "480":
      return res; // minutes
    case "D":
    case "1D":
      return "1D";
    case "W":
    case "1W":
      return "1W";
    case "M":
    case "1M":
      return "1M";
    default:
      return "60";
  }
}

/** Update the current URL’s query params without reloading */
function updateUrlQuery(next: Record<string, string | undefined>) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined || v === null || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  window.history.replaceState({}, "", url.toString());
}

/**
 * Minimal, robust chart using TradingView’s public widget (iframe).
 * Now includes a toolbar to change symbol + resolution safely.
 */
export default function Charts() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = useMemo(() => new URLSearchParams(search), [search]);

  // Pair can be "BTCUSDT" or "BTC/USDT" from URL (?s=)
  const rawPair = params.get("s");
  const pair = safeString(rawPair, "BTCUSDT");
  const pairNoSlash = safeReplace(pair, "/", ""); // "BTC/USDT" -> "BTCUSDT"
  const base = safeReplace(pairNoSlash, /USDT$/, ""); // "BTC"

  // Resolution / timeframe from URL (?res=)
  const rawRes = params.get("res");
  const resolution = mapResolution(safeString(rawRes, "60"));

  // UI state for input/select (initialised from URL)
  const [symbolInput, setSymbolInput] = useState<string>(pairNoSlash);
  const [resSelect, setResSelect] = useState<string>(resolution);

  // Build TradingView symbol (BINANCE:BTCUSDT)
  const exchange = "BINANCE";
  const tvSymbol = `${exchange}:${pairNoSlash}`;

  // Build iframe URL
  const iframeSrc = useMemo(() => {
    const u = new URL("https://s.tradingview.com/widgetembed/");
    u.searchParams.set("symbol", tvSymbol);
    u.searchParams.set("interval", resSelect || resolution);
    u.searchParams.set("theme", "dark");
    u.searchParams.set("style", "1"); // standard candles
    u.searchParams.set("timezone", "Etc/UTC");
    u.searchParams.set("withdateranges", "1");
    u.searchParams.set("hide_side_toolbar", "0");
    u.searchParams.set("allow_symbol_change", "1");
    u.searchParams.set("save_image", "0");
    // keep studies empty for now; we’ll add them in the next step
    u.searchParams.set("studies", "");
    return u.toString();
  }, [tvSymbol, resSelect, resolution]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Ensure iframe updates whenever iframeSrc changes
  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeSrc;
    }
  }, [iframeSrc]);

  // Handlers
  function applySymbol() {
    // Accepts "BTCUSDT" or "BTC/USDT" in the input
    const cleaned = safeReplace(symbolInput, "/", "").toUpperCase();
    const next = cleaned || "BTCUSDT";
    updateUrlQuery({ s: next });
    setSymbolInput(next);
    // when URL changes, pairNoSlash will update on next render; we also refresh iframe immediately:
    const u = new URL(iframeSrc);
    u.searchParams.set("symbol", `${exchange}:${next}`);
    if (iframeRef.current) iframeRef.current.src = u.toString();
  }

  function applyResolution(nextRes: string) {
    const mapped = mapResolution(nextRes);
    setResSelect(mapped);
    updateUrlQuery({ res: mapped });
    const u = new URL(iframeSrc);
    u.searchParams.set("interval", mapped);
    if (iframeRef.current) iframeRef.current.src = u.toString();
  }

  function onSymbolKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      applySymbol();
    }
  }

  return (
    <ErrorBoundary>
      <main
        style={{
          padding: 16,
          color: "#e0e0e0",
          background: "#0f0f0f",
          minHeight: "100vh",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Charts</h1>

        {/* Toolbar */}
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
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>Symbol</label>
            <input
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              onKeyDown={onSymbolKeyDown}
              placeholder="BTCUSDT or BTC/USDT"
              style={{
                background: "#0e0e0e",
                color: "#e0e0e0",
                border: "1px solid #333",
                borderRadius: 8,
                padding: "8px 10px",
                minWidth: 180,
                outline: "none",
              }}
            />
            <button
              onClick={applySymbol}
              style={{
                background: "#232323",
                color: "#e0e0e0",
                border: "1px solid #333",
                borderRadius: 8,
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Apply
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>Resolution</label>
            <select
              value={resSelect}
              onChange={(e) => applyResolution(e.target.value)}
              style={{
                background: "#0e0e0e",
                color: "#e0e0e0",
                border: "1px solid #333",
                borderRadius: 8,
                padding: "8px 10px",
                outline: "none",
              }}
            >
              <option value="1">1</option>
              <option value="3">3</option>
              <option value="5">5</option>
              <option value="15">15</option>
              <option value="30">30</option>
              <option value="60">60</option>
              <option value="120">120</option>
              <option value="240">240</option>
              <option value="480">480</option>
              <option value="1D">1D</option>
              <option value="1W">1W</option>
              <option value="1M">1M</option>
            </select>
          </div>

          {/* Quick read-only info */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Pair:&nbsp;
              <code style={{ fontSize: 13 }}>{pairNoSlash}</code>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Base:&nbsp;
              <code style={{ fontSize: 13 }}>{base || "(empty)"} </code>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Res:&nbsp;<code style={{ fontSize: 13 }}>{resSelect}</code>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div
          style={{
            width: "100%",
            maxWidth: 1200,
            height: 600,
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid #2a2a2a",
            background: "#0b0b0b",
          }}
        >
          <iframe
            ref={iframeRef}
            title="TradingView Chart"
            src={iframeSrc}
            style={{ width: "100%", height: "100%", border: "0" }}
            allow="clipboard-write; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-downloads"
          />
        </div>

        <p style={{ marginTop: 16, opacity: 0.85 }}>
          Use the toolbar to change the symbol (e.g., <code>ETHUSDT</code>) or
          resolution. Next, we’ll add indicator toggles (EMA, RSI, MACD)
          safely—still keeping this page uncrashable.
        </p>
      </main>
    </ErrorBoundary>
  );
}
