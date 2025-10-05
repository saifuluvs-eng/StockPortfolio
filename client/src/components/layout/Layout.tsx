import React from "react";
import "../styles/tokens.css";

export function Page(props: React.PropsWithChildren) {
  return (
    <main
      style={{
        padding: 16,
        background: "var(--bg)",
        color: "var(--text)",
        minHeight: "100vh",
        fontFamily: "var(--font)",
      }}
    >
      {props.children}
    </main>
  );
}

export function Toolbar(props: React.PropsWithChildren) {
  return <div className="app-toolbar">{props.children}</div>;
}

export function Card(
  props: React.PropsWithChildren<{ inset?: boolean; style?: React.CSSProperties }>
) {
  const cls = props.inset ? "app-card app-card--inset" : "app-card";
  return (
    <div className={cls} style={props.style}>
      {props.children}
    </div>
  );
}

/** 4-up stat grid and box, identical look across pages */
export function StatGrid(props: React.PropsWithChildren) {
  return <div className="stat-grid">{props.children}</div>;
}
export function StatBox({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: React.ReactNode;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <div className="stat-box">
      <div className="stat-box__label">{label}</div>
      <div className="stat-box__value" style={valueStyle}>
        {value}
      </div>
    </div>
  );
}
