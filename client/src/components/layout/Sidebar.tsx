import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [sbOpen, setSbOpen] = useState(false);
  const sbBtnRef = useRef<HTMLButtonElement | null>(null);
  const [sbPos, setSbPos] = useState<{ left: number; top: number } | null>(null);
  const showStrictCollapsed = isCollapsed && !expandOnHover;
  const labelClass = !isCollapsed
    ? "whitespace-nowrap transition-all opacity-100 w-auto"
    : expandOnHover
    ? "whitespace-nowrap transition-all opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto"
    : "whitespace-nowrap transition-all opacity-0 w-0";

  function sbComputeAbove(btn: HTMLButtonElement) {
    const r = btn.getBoundingClientRect();
    const left = Math.min(Math.max(r.left + r.width / 2, 16), window.innerWidth - 16);
    const top = r.top - 12;
    setSbPos({ left, top });
  }

  useEffect(() => {
    if (!sbOpen) return;
    const btn = sbBtnRef.current;
    if (btn) sbComputeAbove(btn);

    const sync = () => {
      const b = sbBtnRef.current;
      if (b) sbComputeAbove(b);
    };
    const outside = (e: MouseEvent) => {
      if (sbBtnRef.current?.contains(e.target as Node)) return;
      setSbOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setSbOpen(false);

    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, { passive: true });
    document.addEventListener("click", outside);
    document.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync);
      document.removeEventListener("click", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [sbOpen]);

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
          ref={sbBtnRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!sbOpen && sbBtnRef.current) sbComputeAbove(sbBtnRef.current);
            setSbOpen((v) => !v);
          }}
          aria-label="Sidebar control"
          className="w-10 h-10 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 shadow-md flex items-center justify-center"
        >
          <PanelLeft size={18} className="text-white/90" />
        </button>
      </div>

      {/* Top-layer card via portal */}
      {sbOpen && sbPos &&
        createPortal(
          <div
            className="sb-toplayer sb-card"
            style={{
              left: sbPos.left,
              top: sbPos.top,
              transform: "translate(-50%, -100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sb-card__header">Sidebar control</div>

            <div className="sb-card__body">
              <label className="sb-row">
                <input
                  type="radio"
                  name="sb"
                  className="sb-radio"
                  checked={!isCollapsed && !expandOnHover}
                  onChange={() => {
                    setIsCollapsed(false);
                    setExpandOnHover(false);
                    setSbOpen(false);
                  }}
                />
                <span>Expanded</span>
              </label>

              <label className="sb-row">
                <input
                  type="radio"
                  name="sb"
                  className="sb-radio"
                  checked={isCollapsed && !expandOnHover}
                  onChange={() => {
                    setIsCollapsed(true);
                    setExpandOnHover(false);
                    setSbOpen(false);
                  }}
                />
                <span>Collapsed</span>
              </label>

              <label className="sb-row">
                <input
                  type="radio"
                  name="sb"
                  className="sb-radio"
                  checked={isCollapsed && expandOnHover}
                  onChange={() => {
                    setIsCollapsed(true);
                    setExpandOnHover(true);
                    setSbOpen(false);
                  }}
                />
                <span>Expand on hover</span>
              </label>
            </div>
          </div>,
          document.body
        )}

      <HoverTooltip anchor={hoverRef} label={hoverLabel} show={!!hoverRef && showStrictCollapsed} />
    </aside>
  );
}
