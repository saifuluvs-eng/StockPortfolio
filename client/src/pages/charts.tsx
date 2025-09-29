// client/src/pages/charts.tsx
import React, { useMemo } from "react";

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
    // Keep this console for debugging
    console.error("Charts ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ padding: 16 }}>
          <h2 style={{ margin: 0 }}>Something went wrong on this page.</h2>
          <p style={{ opacity: 0.8 }}>
            We’ve caught the error so the app doesn’t go blank. Share the
            message below if it appears again.
          </p>
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

/**
 * Safe helpers — no crashes if inputs are missing.
 */
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

/**
 * Diagnostic Charts page.
 * - Reads ?s= and ?res= from the URL safely.
 * - Uses defaults if missing.
 * - No external components; just renders text so we can confirm the crash source.
 */
export default function Charts() {
  const search = typeof window !== "undefined" ? window.location.search : "";

  const params = useMemo(() => new URLSearchParams(search), [search]);

  // Symbol/pair, e.g. "BTCUSDT" or "BTC/USDT"
  const rawPair = params.get("s");
  const pair = safeString(rawPair, "BTCUSDT");
  const pairNoSlash = safeReplace(pair, "/", ""); // "BTC/USDT" -> "BTCUSDT"
  const base = safeReplace(pairNoSlash, /USDT$/, ""); // "BTC"

  // Resolution / timeframe
  const rawRes = params.get("res");
  const resolution = safeString(rawRes, "60"); // default 60 minutes

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
        <h1 style={{ marginTop: 0 }}>Charts (diagnostic)</h1>

        <div
          style={{
            display: "grid",
            gap: 10,
            maxWidth: 640,
            background: "#161616",
            border: "1px solid #2a2a2a",
            borderRadius: 12,
            padding: 16,
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

        <p style={{ marginTop: 16, opacity: 0.85 }}>
          If this page renders without turning black and the console no longer
          shows <code>TypeError: Cannot read properties of undefined (reading 'replace')</code>,
          it means the crash was in the previous charts component logic. We’ll
          re-introduce the chart piece by piece in the next step.
        </p>
      </main>
    </ErrorBoundary>
  );
}
