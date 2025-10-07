// client/src/components/layout/sidebar.tsx
import React from "react";
import { Link, useLocation } from "wouter";

const baseLink: React.CSSProperties = {
  display: "block",
  padding: "12px 16px",
  borderRadius: 12,
  textDecoration: "none",
  color: "#e0e0e0",
  fontSize: 16,
  lineHeight: 1.2,
};

const active: React.CSSProperties = {
  background: "#1b1b1b",
  border: "1px solid #2a2a2a",
};

function isActivePath(current: string, target: string | RegExp) {
  if (typeof target === "string") return current === target;
  return target.test(current);
}

function SidebarItem({
  to,
  activeWhen,
  children,
  style,
}: {
  to: string;
  activeWhen?: string | RegExp;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const [location] = useLocation();
  const activeMatch =
    activeWhen !== undefined ? isActivePath(location, activeWhen) : location === to;

  return (
    <Link
      to={to}
      style={
        activeMatch
          ? { ...baseLink, ...style, ...active }
          : { ...baseLink, ...style }
      }
    >
      {children}
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside
      style={{
        width: 260,
        background: "#151515",
        borderRight: "1px solid #2a2a2a",
        padding: 16,
        height: "100vh",
        boxSizing: "border-box",
        position: "sticky",
        top: 0,
      }}
    >
      <nav style={{ display: "grid", gap: 8 }}>
        {/* Dashboard */}
        <SidebarItem to="/dashboard">Dashboard</SidebarItem>

        {/* Analyse (single menu item, active for /charts or /analyse) */}
        <SidebarItem to="/analyse" activeWhen={/^\/(charts|analyse)(\/|$)/}>
          Analyse
        </SidebarItem>
        <SidebarItem
          to="/analyse-v2"
          activeWhen={/^\/analyse-v2(\/|$)/}
          style={{ marginLeft: 12, fontSize: 14 }}
        >
          Analyse v2 (beta)
        </SidebarItem>

        {/* Gainers */}
        <SidebarItem to="/gainers">Gainers</SidebarItem>

        {/* Portfolio (added) */}
        <SidebarItem to="/portfolio">Portfolio</SidebarItem>

        {/* AI Insights */}
        <SidebarItem to="/ai-insights">AI Insights</SidebarItem>
      </nav>
    </aside>
  );
}

export default Sidebar;
