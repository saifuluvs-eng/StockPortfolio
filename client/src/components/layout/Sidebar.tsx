import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
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
import { useAuth } from "@/auth/AuthContext";

type NavItem = {
  label: string;
  to: string;
  icon: JSX.Element;
  visible?: (user: any) => boolean;
};

const items: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: <Home size={20} /> },
  { label: "Portfolio", to: "/portfolio", icon: <Briefcase size={20} /> },
  { label: "Gainers", to: "/gainers", icon: <Activity size={20} /> },
  { label: "Analyse", to: "/analyse", icon: <BarChart2 size={20} /> },
  { label: "Watchlist", to: "/watchlist", icon: <ListChecks size={20} />, visible: (user) => !!user },
  { label: "Alerts", to: "/alerts", icon: <Bell size={20} />, visible: (user) => !!user },
  { label: "AI Insights", to: "/ai-insights", icon: <BarChart2 size={20} /> },
  { label: "News", to: "/news", icon: <Newspaper size={20} /> },
  { label: "Account", to: "/account", icon: <User2 size={20} /> },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { user, loading } = useAuth();
  const [currentPath] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandOnHover, setExpandOnHover] = useState(true);
  const [hoverRef, setHoverRef] = useState<HTMLElement | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string>("");
  const [sbOpen, setSbOpen] = useState(false);
  const sbBtnRef = useRef<HTMLButtonElement | null>(null);
  const sbCardRef = useRef<HTMLDivElement | null>(null);
  const [sbPos, setSbPos] = useState<{ left: number; top: number } | null>(null);
  const showStrictCollapsed = isCollapsed && !expandOnHover;
  const labelClass = !isCollapsed
    ? "whitespace-nowrap transition-all opacity-100 w-auto"
    : expandOnHover
    ? "whitespace-nowrap transition-all opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto"
    : "whitespace-nowrap transition-all opacity-0 w-0";

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  function positionAboveClamped() {
    const btn = sbBtnRef.current;
    const card = sbCardRef.current;
    if (!btn || !card) return;

    const r = btn.getBoundingClientRect();
    const w = card.offsetWidth || 320;
    const margin = 12;
    const half = w / 2;

    const left = Math.min(
      Math.max(r.left + r.width / 2, margin + half),
      window.innerWidth - margin - half
    );

    const top = Math.max(r.top - 12, margin + 8);
    setSbPos({ left, top });
  }

  useEffect(() => {
    if (!sbOpen) return;

    requestAnimationFrame(() => {
      positionAboveClamped();
      requestAnimationFrame(positionAboveClamped);
    });

    const onReflow = () => positionAboveClamped();
    const onOutside = (e: MouseEvent) => {
      if (sbBtnRef.current?.contains(e.target as Node)) return;
      setSbOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setSbOpen(false);

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
  }, [sbOpen]);

  return (
    <>
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={[
          "group relative h-screen bg-[#121212] border-r border-white/5 transition-all duration-200",
          "hidden md:flex md:flex-col",
          isCollapsed ? "w-14" : "w-60",
          expandOnHover && isCollapsed ? "hover:w-60" : "",
          isMobile && isOpen ? "fixed left-0 top-0 z-40 flex flex-col" : "",
        ].join(" ")}
      >
      {/* Brand */}
      <div className="h-14 flex items-center justify-between px-3">
        <Link
          to="/dashboard"
          className="text-white/90 font-semibold tracking-wide whitespace-nowrap overflow-hidden"
          onClick={onClose}
        >
          {showStrictCollapsed ? "" : "CryptoTrader Pro"}
        </Link>
        {isMobile && isOpen && (
          <button
            onClick={onClose}
            className="md:hidden text-white/60 hover:text-white"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="mt-2 space-y-1 px-2 flex-1 overflow-y-auto">
        {items
          .filter((item) => (loading ? true : item.visible ? item.visible(user) : true))
          .map((item) => {
            const isActive = currentPath === item.to;
            const handleClick = () => {
              if (isMobile && isOpen) {
                onClose?.();
              }
            };
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={handleClick}
                className={[
                  "relative group/item flex items-center gap-3 rounded-xl px-3 py-2 text-[15px]",
                  "text-white/80 hover:text-white hover:bg-white/5",
                  isActive ? "bg-white/[0.07] text-white" : "",
                ].join(" ")}
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
              </Link>
            );
          })}
      </nav>

      {/* Bottom-left floating control button */}
      <div className="absolute bottom-3 left-2">
        <button
          ref={sbBtnRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSbOpen((v) => !v);
          }}
          aria-label="Sidebar control"
          className="w-10 h-10 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 shadow-md flex items-center justify-center"
        >
          <PanelLeft size={18} className="text-white/90" />
        </button>
      </div>

      {sbOpen &&
        createPortal(
          <div
            ref={sbCardRef}
            className="fixed z-[2147483647] w-80 rounded-2xl border border-white/10 bg-[#1a1a1a] text-white/90 shadow-2xl overflow-hidden"
            style={{
              left: sbPos?.left ?? 0,
              top: sbPos?.top ?? -9999,
              transform: "translate(-50%, -100%)",
              visibility: sbPos ? "visible" : "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-white/10 text-[15px]">Sidebar control</div>
            <div className="p-4 text-[15px] space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="sb"
                  className="accent-[#7ea1ff]"
                  checked={!isCollapsed && !expandOnHover}
                  onChange={() => {
                    setIsCollapsed(false);
                    setExpandOnHover(false);
                    setSbOpen(false);
                  }}
                />
                <span>Expanded</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="sb"
                  className="accent-[#7ea1ff]"
                  checked={isCollapsed && !expandOnHover}
                  onChange={() => {
                    setIsCollapsed(true);
                    setExpandOnHover(false);
                    setSbOpen(false);
                  }}
                />
                <span>Collapsed</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="sb"
                  className="accent-[#7ea1ff]"
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
    </>
  );
}
