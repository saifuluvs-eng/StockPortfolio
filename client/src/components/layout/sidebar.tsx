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
}: {
  to: string;
  activeWhen?: string | RegExp; // optional custom matcher
  children: React.ReactNode;
}) {
  const [location] = useLocation();
  const activeMatch =
    activeWhen !== undefined ? isActivePath(location, activeWhen) : location === to;

  return (
    <Link to={to} style={activeMatch ? { ...baseLink, ...active } : baseLink}>
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
      <div style={{ fontWeight: 800, marginBottom: 16, fontSize: 20, color: "#e0e0e0" }}>
        Dashboard
      </div>

      <nav style={{ display: "grid", gap: 8 }}>
        {/* 1) Dashboard */}
        <SidebarItem to="/dashboard">Dashboard</SidebarItem>

        {/* 2) Charts/Scan (single menu item) */}
        {/* Active when path starts with /charts OR /scan */}
        <SidebarItem to="/charts" activeWhen={/^\/(charts|scan)(\/|$)/}>
          Charts / Scan
        </SidebarItem>

        {/* 3) Gainers */}
        <SidebarItem to="/gainers">Gainers</SidebarItem>

        {/* 4) High Potential */}
        <SidebarItem to="/high-potential">High Potential</SidebarItem>

        {/* 5) AI Insights */}
        <SidebarItem to="/ai-insights">AI Insights</SidebarItem>
      </nav>
    </aside>
  );
}

export default Sidebar;
