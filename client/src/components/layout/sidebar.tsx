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

function SidebarLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  const [location] = useLocation();
  const isActive = location === to;
  return (
    <Link href={to}>
      <a style={isActive ? { ...baseLink, ...active } : baseLink}>{children}</a>
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
        <SidebarLink to="/home">Home</SidebarLink>
        <SidebarLink to="/charts">Charts</SidebarLink>
        <SidebarLink to="/scan">Scan</SidebarLink>
        <SidebarLink to="/gainers">Gainers</SidebarLink>
        <SidebarLink to="/high-potential">High Potential</SidebarLink>
        <SidebarLink to="/portfolio">Portfolio</SidebarLink>
        <SidebarLink to="/ai-insights">AI Insights</SidebarLink>
        <SidebarLink to="/landing">Landing</SidebarLink>
      </nav>
    </aside>
  );
}

export default Sidebar;
