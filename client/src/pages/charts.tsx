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

/** Convert user text to a clean base ticker (letters only, uppercase) */
function sanitizeBaseTicker(input: string): string {
  // Keep only A–Z letters; users may paste "btc/usdt", "btc usdt", etc.
  const lettersOnly = (input || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, " ") // non-letters → spaces
    .trim()
    .split(/\s+/)[0] || ""; // take first token
  // If user typed a full pair like BTCUSDT, strip trailing USDT to get base
  if (lettersOnly.endsWith("USDT")) return lettersOnly.slice(0, -4);
  return lettersOnly;
}

/** Build a USDT pair from base; if already ends with USDT, keep it */
function toUsdtPair(baseOrPair: string): string {
  const up = (baseOrPair || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!up) return "BTCUSDT";
  return up.endsWith("USDT") ? up : `${up}USDT`;
}

/**
 * Minimal, robust chart using TradingView’s public widget (iframe).
 * - Enforces base-ticker input and auto-uses USDT pairs.
 * - Adds safe toggles for EMA, RSI, MACD using TradingView built-ins.
 */
export default function Charts() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = useMemo(() => new URLSearchParams(search), [search]);

  // Read pair from URL (?s=), default to BTCUSDT
  const rawPair = params.get("s");
  const pair = toUsdtPair(safeString(rawPair, "BTCUSDT")); // ensure USDT
  const pairNoSlash = safeReplace(pair, "/", ""); // safety (shouldn’t contain '/')
  const base = safeReplace(pairNoSlash, /USDT$/, ""); // base only (e.g., BTC)

  // Resolution / timeframe from URL (?res=)
  const rawRes = params.get("res");
  const resolution = mapResolution(safeString(rawRes, "60"));

  // Indicator toggles from URL (?ind=comma,list) so they persist/share
  const rawInd = safeString(params.get("ind"), "");
  const initialSet = new Set(
    rawInd
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  const [emaOn, setEmaOn] = useState<boolean>(initialSet.has("ema"));
  const [rsiOn, setRsiOn] = useState<boolean>(initialSet.has("rsi"));
  const [macdOn, setMacdOn] = useState<boolean>(initialSet.has("macd"));

  // UI state (input only accepts base tickers like BTC, ETH, AVAX)
  const [baseInput, setBaseInput] = useState<string>(base);
  const [resSelect, setResSelect] = useState<string>(resolution);
  const [inputError, setInputError] = useState<string>("");

  // Build TradingView symbol (BINANCE:BTCUSDT)
  const exchange = "BINANCE";
  const tvSymbol = `${exchange}:${pairNoSlash}`;

  // Build studies list for TradingView widget
  // IDs are TradingView's built-in study identifiers.
  // (We keep defaults to avoid fragile overrides.)
  const studies = useMemo(() => {
    const arr: string[] = [];
    if (emaOn) arr.push("MAExp@tv-basicstudies"); // Exponential Moving Average
    if (rsiOn) arr.push("RSI@tv-basicstudies");   // Relative Strength Index
    if (macdOn) arr.push("MACD@tv-basicstudies"); // MACD
    return arr;
  }, [emaOn, rsiOn, macdOn]);

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
    // studies: comma-separated list of study IDs (leave empty if none)
    u.searchParams.set("studies", studies.join(","));
    return u.toString();
  }, [tvSymbol, resSelect, resolution, studies]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Ensure iframe updates whenever iframeSrc changes
  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeSrc;
    }
  }, [iframeSrc]);

  // Sync indicators to URL (?ind=ema,rsi,macd) for shareable links
  useEffect(() => {
    const enabled: string[] = [];
    if (emaOn) enabled.push("ema");
    if (rsiOn) enabled.push("rsi");
    if (macdOn) enabled.push("macd");
    updateUrlQuery({ ind: enabled.join(",") || undefined });
  }, [emaOn, rsiOn, macdOn]);

  // Handlers
  function applyBaseTicker() {
    const cleanedBase = sanitizeBaseTicker(baseInput);
    if (!cleanedBase) {
      setInputError("Enter a base ticker like BTC, ETH, AVAX.");
      return;
    }
    setInputError("");
    const nextPair = toUsdtPair(cleanedBase); // e.g., BTC → BTCUSDT
    // reflect in URL
    updateUrlQuery({ s: nextPair });
    // refresh iframe immediately
    const u = new URL(iframeSrc);
    u.searchParams.set("symbol", `${exchange}:${nextPair}`);
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

  function onBaseChange(e: React.ChangeEvent<HTMLInputElement>) {
    // live-restrict to letters only, uppercase
    const next = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
    setBaseInput(next);
    if (inputError && next) setInputError("");
  }

  function onBaseKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      applyBaseTicker();
    }
  }

  function toggleIndicator(kind: "ema" | "rsi" | "macd") {
    if (kind === "ema") setEmaOn((v) => !v);
    if (kind === "rsi") setRsiOn((v) => !v);
    if (kind === "macd") setMacdOn((v) => !v);
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
          {/* Base ticker input (auto-USDT) */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>
              Base ticker (auto-USDT)
            </label>
            <input
              value={baseInput}
              onChange={onBaseChange}
              onKeyDown={onBaseKeyDown}
              placeholder="BTC, ETH, AVAX"
              maxLength={10}
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
              onClick={applyBaseTicker}
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

          {/* Resolution */}
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

          {/* Indicator toggles */}
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              background: "#131313",
              border: "1px dashed #333",
              borderRadius: 10,
              padding: "8px 12px",
            }}
          >
            <span style={{ fontSize: 12, opacity: 0.75 }}>Indicators:</span>

            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={emaOn}
                onChange={() => toggleIndicator("ema")}
              />
              <span style={{ fontSize: 13 }}>EMA</span>
            </label>

            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={rsiOn}
                onChange={() => toggleIndicator("rsi")}
              />
              <span style={{ fontSize: 13 }}>RSI</span>
            </label>

            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={macdOn}
                onChange={() => toggleIndicator("macd")}
              />
              <span style={{ fontSize: 13 }}>MACD</span>
            </label>
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
              Pair:&nbsp;<code style={{ fontSize: 13 }}>{pairNoSlash}</code>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Base:&nbsp;<code style={{ fontSize: 13 }}>{base || "(empty)"} </code>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Res:&nbsp;<code style={{ fontSize: 13 }}>{resSelect}</code>
            </div>
          </div>
        </div>

        {/* Inline validation message */}
        {inputError ? (
          <div
            style={{
              background: "#2a1717",
              border: "1px solid #5a2a2a",
              color: "#ffb3b3",
              padding: "8px 12px",
              borderRadius: 8,
              margin: "0 0 12px 0",
              maxWidth: 1200,
            }}
          >
            {inputError}
          </div>
        ) : null}

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
            // keep sandbox permissive enough for TV to run
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-downloads"
          />
        </div>

        <p style={{ marginTop: 16, opacity: 0.85 }}>
          Type a base ticker like <code>BTC</code>, <code>ETH</code>, or{" "}
          <code>AVAX</code>. We auto-use the <code>USDT</code> pair. Toggle{" "}
          <code>EMA</code>, <code>RSI</code>, <code>MACD</code> as needed. Next
          step, we can add preset EMA pairs (e.g., 20/50) and keep everything
          just as safe.
        </p>
      </main>
    </ErrorBoundary>
  );
}
