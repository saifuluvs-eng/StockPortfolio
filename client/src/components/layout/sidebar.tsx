// client/src/components/layout/sidebar.tsx
import React from "react";
import { Link, useLocation } from "wouter";

const baseLink: React.CSSProperties = {
  display: "block",
  padding: "10px 12px",
  borderRadius: 10,
  textDecoration: "none",
  color: "#e0e0e0",
  fontSize: 14,
};

const active: React.CSSProperties = {
  background: "#1b1b1b",
  border: "1px solid #2a2a2a",
};

function SidebarItem({ to, children }: { to: string; children: React.ReactNode }) {
  const [location] = useLocation();
  const isActive = location === to;
  // Wouter's <Link> renders an <a>, so pass styles directly to Link
  return (
    <Link to={to} style={isActive ? { ...baseLink, ...active } : baseLink}>
      {children}
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside
      style={{
        width: 240,
        background: "#151515",
        borderRight: "1px solid #2a2a2a",
        padding: 12,
        height: "100vh",
        boxSizing: "border-box",
        position: "sticky",
        top: 0,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 16, color: "#e0e0e0" }}>
        Dashboard
      </div>

      <nav style={{ display: "grid", gap: 6 }}>
        <SidebarItem to="/home">Home</SidebarItem>
        <SidebarItem to="/charts">Charts</SidebarItem>
        <SidebarItem to="/scan">Scan</SidebarItem>
        <SidebarItem to="/gainers">Gainers</SidebarItem>
        <SidebarItem to="/high-potential">High Potential</SidebarItem>
        <SidebarItem to="/portfolio">Portfolio</SidebarItem>
        <SidebarItem to="/ai-insights">AI Insights</SidebarItem>
        <SidebarItem to="/landing">Landing</SidebarItem>
      </nav>
    </aside>
  );
}

export default Sidebar;
