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
  const [open, setOpen] = useState(false);
  const gearRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const showStrictCollapsed = isCollapsed && !expandOnHover;
  const labelClass = !isCollapsed
    ? "whitespace-nowrap transition-all opacity-100 w-auto"
    : expandOnHover
    ? "whitespace-nowrap transition-all opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto"
    : "whitespace-nowrap transition-all opacity-0 w-0";

  function computeAbovePosition(btn: HTMLButtonElement) {
    const r = btn.getBoundingClientRect();
    const left = Math.min(Math.max(r.left + r.width / 2, 16), window.innerWidth - 16);
    const top = r.top - 10;
    setPos({ left, top });
  }

  useEffect(() => {
    if (!open) return;
    const btn = gearRef.current;
    if (btn) computeAbovePosition(btn);

    const onReflow = () => {
      if (gearRef.current) computeAbovePosition(gearRef.current);
    };
    const onOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (gearRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);

    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, { passive: true });
    document.addEventListener("click", onOutside);
    document.addEventListener("keydown", onEsc);

    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow);
      document.removeEventListener("click", onOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

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

      {/* Bottom-left floating control */}
      <div className="absolute bottom-3 left-2">
        <button
          ref={gearRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!open && gearRef.current) computeAbovePosition(gearRef.current);
            setOpen((v) => !v);
          }}
          aria-label="Sidebar control"
          className="w-10 h-10 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 shadow-md flex items-center justify-center"
        >
          <PanelLeft size={18} className="text-white/90" />
        </button>
      </div>

      {open && pos &&
        createPortal(
          <div
            className="fixed z-[9999] w-80 rounded-2xl border border-white/10 bg-[#1a1a1a] text-white/90 shadow-2xl overflow-hidden animate-[sbPop_120ms_ease-out]"
            style={{
              left: pos.left,
              top: pos.top,
              transform: "translate(-50%, -100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="fixed w-3 h-3 bg-[#1a1a1a] border-l border-t border-white/10 rotate-45"
              style={{
                left: pos.left,
                top: pos.top,
                transform: "translate(-50%, -50%)",
              }}
            />
            <div className="px-4 py-3 border-b border-white/10 text-[15px]">Sidebar control</div>
            <div className="p-4 text-[15px] space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="sb"
                  checked={!isCollapsed && !expandOnHover}
                  onChange={() => {
                    setIsCollapsed(false);
                    setExpandOnHover(false);
                    setOpen(false);
                  }}
                />
                <span>Expanded</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="sb"
                  checked={isCollapsed && !expandOnHover}
                  onChange={() => {
                    setIsCollapsed(true);
                    setExpandOnHover(false);
                    setOpen(false);
                  }}
                />
                <span>Collapsed</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="sb"
                  checked={isCollapsed && expandOnHover}
                  onChange={() => {
                    setIsCollapsed(true);
                    setExpandOnHover(true);
                    setOpen(false);
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
