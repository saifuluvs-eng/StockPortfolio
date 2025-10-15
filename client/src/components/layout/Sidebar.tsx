import { useEffect, useRef, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import {
  Home,
  Briefcase,
  Activity,
  BarChart2,
  Bell,
  User2,
  ListChecks,
  Newspaper,
  PanelLeft,
} from "lucide-react";
import HoverTooltip from "../ui/HoverTooltip";

type Item = { label: string; to: string; icon: JSX.Element };

const items: Item[] = [
  { label: "Dashboard", to: "/dashboard", icon: <Home size={20} /> },
  { label: "Portfolio", to: "/portfolio", icon: <Briefcase size={20} /> },
  { label: "Gainers", to: "/gainers", icon: <Activity size={20} /> },
  { label: "Analyse", to: "/analyse", icon: <BarChart2 size={20} /> },
  { label: "Watchlist", to: "/watchlist", icon: <ListChecks size={20} /> },
  { label: "Alerts", to: "/alerts", icon: <Bell size={20} /> },
  { label: "AI Insights", to: "/ai-insights", icon: <BarChart2 size={20} /> },
  { label: "News", to: "/news", icon: <Newspaper size={20} /> },
  { label: "Account", to: "/account", icon: <User2 size={20} /> },
];

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandOnHover, setExpandOnHover] = useState(true);
  const [hoverRef, setHoverRef] = useState<HTMLElement | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string>("");
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const dlgRef = useRef<HTMLDialogElement | null>(null);
  const showStrictCollapsed = isCollapsed && !expandOnHover;
  const labelClass = !isCollapsed
    ? "whitespace-nowrap transition-all opacity-100 w-auto"
    : expandOnHover
    ? "whitespace-nowrap transition-all opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto"
    : "whitespace-nowrap transition-all opacity-0 w-0";

  function openSidebarDialog() {
    const btn = btnRef.current;
    const dlg = dlgRef.current;
    if (!btn || !dlg) return;

    if (!dlg.open) dlg.showModal();

    const r = btn.getBoundingClientRect();
    const left = Math.min(Math.max(r.left + r.width / 2, 16), window.innerWidth - 16);
    const top = r.top - 12;

    dlg.style.position = "fixed";
    dlg.style.left = `${left}px`;
    dlg.style.top = `${top}px`;
    dlg.style.transform = "translate(-50%, -100%)";
  }

  function closeSidebarDialog() {
    const dlg = dlgRef.current;
    if (dlg?.open) dlg.close();
  }

  useEffect(() => {
    function sync() {
      if (dlgRef.current?.open) openSidebarDialog();
    }

    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, { passive: true });
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync);
    };
  }, []);

  return (
    <aside
      className={[
        "group relative h-screen bg-[#121212] border-r border-white/5 transition-all duration-200",
        isCollapsed ? "w-14" : "w-60",
        expandOnHover && isCollapsed ? "hover:w-60" : "",
      ].join(" ")}
    >
      {/* Brand */}
      <div className="h-14 flex items-center px-3">
        <Link
          to="/dashboard"
          className="text-white/90 font-semibold tracking-wide whitespace-nowrap overflow-hidden"
        >
          {showStrictCollapsed ? "" : "CryptoTrader Pro"}
        </Link>
      </div>

      {/* Nav */}
      <nav className="mt-2 space-y-1 px-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                "relative group/item flex items-center gap-3 rounded-xl px-3 py-2 text-[15px]",
                "text-white/80 hover:text-white hover:bg-white/5",
                isActive ? "bg-white/[0.07] text-white" : "",
              ].join(" ")
            }
            onMouseEnter={(event) => {
              if (showStrictCollapsed) {
                setHoverLabel(item.label);
                setHoverRef(event.currentTarget as HTMLElement);
              }
            }}
            onMouseLeave={() => {
              setHoverRef(null);
            }}
          >
            <div className="shrink-0">{item.icon}</div>
            <span className={labelClass}>
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom-left floating control button */}
      <div className="absolute bottom-3 left-2">
        <button
          ref={btnRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (dlgRef.current?.open) {
              closeSidebarDialog();
            } else {
              openSidebarDialog();
            }
          }}
          aria-label="Sidebar control"
          className="w-10 h-10 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 shadow-md flex items-center justify-center"
        >
          <PanelLeft size={18} className="text-white/90" />
        </button>
      </div>

      {/* Top-layer dialog */}
      <dialog
        ref={dlgRef}
        style={{
          zIndex: 2147483647,
          margin: 0,
          padding: 0,
          width: "20rem",
          borderRadius: "1rem",
          border: "1px solid rgba(255,255,255,0.10)",
          background: "#1a1a1a",
          color: "white",
          overflow: "hidden",
          isolation: "isolate",
        }}
        onCancel={(e) => {
          e.preventDefault();
          closeSidebarDialog();
        }}
        onClick={(e) => {
          const dlg = dlgRef.current;
          if (!dlg) return;
          const rect = dlg.getBoundingClientRect();
          const within =
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom;
          if (!within) closeSidebarDialog();
        }}
      >
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.8)", fontSize: 15 }}>
          Sidebar control
        </div>

        <div style={{ padding: 16, fontSize: 15 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, color: "rgba(255,255,255,0.9)" }}>
            <input
              type="radio"
              name="sb"
              className="accent-[#7ea1ff]"
              checked={!isCollapsed && !expandOnHover}
              onChange={() => {
                setIsCollapsed(false);
                setExpandOnHover(false);
                closeSidebarDialog();
              }}
            />
            <span>Expanded</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, color: "rgba(255,255,255,0.9)" }}>
            <input
              type="radio"
              name="sb"
              className="accent-[#7ea1ff]"
              checked={isCollapsed && !expandOnHover}
              onChange={() => {
                setIsCollapsed(true);
                setExpandOnHover(false);
                closeSidebarDialog();
              }}
            />
            <span>Collapsed</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 12, color: "rgba(255,255,255,0.9)" }}>
            <input
              type="radio"
              name="sb"
              className="accent-[#7ea1ff]"
              checked={isCollapsed && expandOnHover}
              onChange={() => {
                setIsCollapsed(true);
                setExpandOnHover(true);
                closeSidebarDialog();
              }}
            />
            <span>Expand on hover</span>
          </label>
        </div>
      </dialog>

      <HoverTooltip anchor={hoverRef} label={hoverLabel} show={!!hoverRef && showStrictCollapsed} />
    </aside>
  );
}
