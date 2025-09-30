// client/src/pages/portfolio.tsx
import React from "react";

export default function Portfolio() {
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

      <section
        style={{
          background: "var(--panel, #151515)",
          border: "1px solid var(--border, #2a2a2a)",
          borderRadius: 12,
          padding: 16,
          maxWidth: 1200,
        }}
      >
        <p style={{ margin: 0, opacity: 0.9 }}>
          Your portfolio page is loading with the new layout. If you haven’t
          added any positions yet, you’ll see this placeholder.
        </p>

        <div
          style={{
            marginTop: 12,
            background: "var(--card, #181818)",
            border: "1px solid var(--border-soft, #2e2e2e)",
            borderRadius: 10,
            padding: 14,
          }}
        >
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            No holdings to display.
          </div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
            This is a placeholder component to ensure the page renders while we
            wire the data back in.
          </div>
        </div>
      </section>
    </main>
  );
}
