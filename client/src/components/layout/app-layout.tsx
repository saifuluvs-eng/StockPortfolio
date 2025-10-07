// client/src/components/layout/app-layout.tsx
import React from "react";
import Sidebar from "@/components/layout/Sidebar";
import { useUI } from "@/stores/uiStore";
import "./AppShell.css";

/**
 * Inline theme tokens so we don't rely on an external tokens.css file.
 * This avoids path/case issues during Vercel builds.
 */
const TOKENS_CSS = `
:root {
  --bg: #0f0f0f;
  --panel: #151515;
  --card: #181818;
  --toolbar: #161616;

  --border: #2a2a2a;
  --border-soft: #2e2e2e;

  --text: #e0e0e0;
  --muted: rgba(224,224,224,0.75);
  --muted-2: rgba(224,224,224,0.6);

  --accent: #232323;

  --radius-xl: 12px;
  --radius-lg: 10px;
  --radius-pill: 999px;

  --font: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}

html, body, #root {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
}
`;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUI();

  return (
    <>
      {/* Inline tokens once at the app shell */}
      <style>{TOKENS_CSS}</style>

      <div className={`app-shell ${sidebarCollapsed ? "is-collapsed" : ""}`}>
        <Sidebar />
        <div className="app-content">{children}</div>
      </div>
    </>
  );
}
