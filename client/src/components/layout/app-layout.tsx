// client/src/components/layout/app-layout.tsx
import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import "@/styles/tokens.css";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: "var(--font)",
      }}
    >
      <Sidebar />
      <div
        style={{
          padding: 16,
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
    </div>
  );
}
