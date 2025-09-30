// client/src/pages/charts.tsx
import React, { useEffect, useMemo, useRef } from "react";

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

/** Map our numeric res to TradingView’s interval strings */
function mapResolution(res: string): string {
  // Common TV intervals: 1,3,5,15,30,60,120,240,480,1D,1W,1M
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

/**
 * Minimal, robust chart using TradingView’s public widget (iframe).
 * - No dependency on tv.js or custom components.
 * - Symbol defaults to BINANCE:BTCUSDT.
 */
export default function Charts() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = useMemo(() => new URLSearchParams(search), [search]);

  // Pair can be "BTCUSDT" or "BTC/USDT"
  const rawPair = params.get("s");
  const pair = safeString(rawPair, "BTCUSDT");
  const pairNoSlash = safeReplace(pair, "/", ""); // "BTC/USDT" -> "BTCUSDT"
  const base = safeReplace(pairNoSlash, /USDT$/, ""); // "BTC"

  // Resolution / timeframe
  const rawRes = params.get("res");
  const resolution = mapResolution(safeString(rawRes, "60"));

  // Build TradingView symbol (BINANCE:BTCUSDT)
  const exchange = "BINANCE";
  const tvSymbol = `${exchange}:${pairNoSlash}`;

  // Build iframe URL
  // Docs: https://www.tradingview.com/widget/advanced-chart/
  // We only set the essentials to keep it stable.
  const iframeSrc = useMemo(() => {
    const u = new URL("https://s.tradingview.com/widgetembed/");
    u.searchParams.set("symbol", tvSymbol);
    u.searchParams.set("interval", resolution);
    u.searchParams.set("theme", "dark");
    u.searchParams.set("style", "1"); // standard candles
    u.searchParams.set("timezone", "Etc/UTC");
    u.searchParams.set("withdateranges", "1");
    u.searchParams.set("hide_side_toolbar", "0");
    u.searchParams.set("allow_symbol_change", "1");
    u.searchParams.set("save_image", "0");
    u.searchParams.set("studies", ""); // keep empty for now
    return u.toString();
  }, [tvSymbol, resolution]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Ensure iframe updates when params change
  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeSrc;
    }
  }, [iframeSrc]);

  return (
    <ErrorBoundary>
      <main
        style={{
          padding: 16,
          color: "#e0e0e0",
          background: "#0f0f0f",
          minHeight: "100vh",
          fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Charts</h1>

        {/* Quick info card (safe diagnostics kept) */}
        <div
          style={{
            display: "grid",
            gap: 10,
            maxWidth: 720,
            background: "#161616",
            border: "1px solid #2a2a2a",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Pair</div>
            <code style={{ fontSize: 14 }}>{pairNoSlash}</code>
          </div>
          <div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Base</div>
            <code style={{ fontSize: 14 }}>{base || "(empty)"}</code>
          </div>
          <div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Resolution</div>
            <code style={{ fontSize: 14 }}>{resolution}</code>
          </div>
        </div>

        {/* The actual chart */}
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
            // sandbox keeps it safe; allow-same-origin is needed so TV scripts work inside
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-downloads"
          />
        </div>

        <p style={{ marginTop: 16, opacity: 0.85 }}>
          This is a minimal, stable chart. Next step, we’ll layer in your own
          indicators and UI, bit by bit—keeping the safety guards so this page
          can’t crash from a missing value.
        </p>
      </main>
    </ErrorBoundary>
  );
}
