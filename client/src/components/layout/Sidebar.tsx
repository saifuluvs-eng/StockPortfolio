
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Briefcase,
  Brain,
  User,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Settings,
  LogOut,
  ListChecks,
  Newspaper,
  PanelLeft,
  Flame,
  Home,
  Activity,
  BarChart2,
  Bell,
  PieChart,
  TrendingUp,
  Zap,
  Target,
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
  // { label: "High Potential", to: "/high-potential", icon: <Flame size={20} /> },
  { label: "Top Picks", to: "/top-picks", icon: <Target size={20} /> },
  { label: "Chart Decode", to: "/chart-decode", icon: <Brain size={20} /> },
  { label: "Analyse", to: "/analyse", icon: <BarChart2 size={20} /> },
  { label: "Data", to: "/data", icon: <PieChart size={20} /> },
  { label: "Strategies", to: "/strategies", icon: <TrendingUp size={20} /> },
  { label: "Momentum", to: "/momentum", icon: <Zap size={20} /> },
  { label: "News", to: "/news", icon: <Newspaper size={20} /> },
  // { label: "AI Insights", to: "/ai-insights", icon: <Brain size={20} /> },
  // { label: "Watchlist", to: "/watchlist", icon: <ListChecks size={20} />, visible: (user) => !!user },
  // { label: "Alerts", to: "/alerts", icon: <Bell size={20} />, visible: (user) => !!user },
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

  // Position calculation for the floating menu
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

  // Determine width classes based on desktop collapse state
  const desktopWidthClass = isCollapsed
    ? (expandOnHover ? "md:w-14 hover:md:w-64" : "md:w-14")
    : "md:w-64";

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-30 transition-opacity duration-200 md:hidden ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-[60] bg-sidebar border-r border-sidebar-border shadow-2xl md:shadow-none transition-all duration-300 ease-in-out flex flex-col overflow-hidden",
          // Mobile: Toggle transform
          "w-64",
          isOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: Always visible, relative positioning, variable width
          "md:relative md:translate-x-0 md:h-screen",
          desktopWidthClass
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
          {isOpen && (
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
              const isActive = item.to === "/analyse"
                ? currentPath.startsWith("/analyse")
                : currentPath === item.to;
              const handleClick = () => {
                if (window.innerWidth < 768 && isOpen) {
                  onClose?.();
                }
              };
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={handleClick}
                  className="relative group/item block"
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
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-white/[0.07] rounded-xl"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <div className={`relative flex items-center gap-3 px-3 py-2 text-[15px] transition-colors ${isActive ? "text-white" : "text-foreground hover:text-white"}`}>
                    <div className={`shrink-0 ${isActive ? "text-[#f7931a]" : ""}`}>{item.icon}</div>
                    <span className={labelClass}>
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}
        </nav>

        {/* Bottom-left floating control button */}
        <div className="absolute bottom-3 left-2 hidden md:block">
          <button
            ref={sbBtnRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSbOpen((v) => !v);
            }}
            aria-label="Sidebar control"
            className="w-10 h-10 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-primary shadow-md flex items-center justify-center"
          >
            <PanelLeft size={18} className="text-white/90" />
          </button>
        </div>

        {sbOpen &&
          createPortal(
            <div
              ref={sbCardRef}
              className="fixed z-[2147483647] w-80 rounded-2xl border border-primary/40 bg-background/95 backdrop-blur text-foreground shadow-2xl overflow-hidden"
              style={{
                left: sbPos?.left ?? 0,
                top: sbPos?.top ?? -9999,
                transform: "translate(-50%, -100%)",
                visibility: sbPos ? "visible" : "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-primary/20 text-[15px] font-semibold text-primary">Sidebar control</div>
              <div className="p-4 text-[15px] space-y-3">
                <label className="flex items-center gap-3 cursor-pointer hover:text-white transition-colors">
                  <input
                    type="radio"
                    name="sb"
                    className="accent-primary"
                    checked={!isCollapsed && !expandOnHover}
                    onChange={() => {
                      setIsCollapsed(false);
                      setExpandOnHover(false);
                      setSbOpen(false);
                    }}
                  />
                  <span>Expanded</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer hover:text-white transition-colors">
                  <input
                    type="radio"
                    name="sb"
                    className="accent-primary"
                    checked={isCollapsed && !expandOnHover}
                    onChange={() => {
                      setIsCollapsed(true);
                      setExpandOnHover(false);
                      setSbOpen(false);
                    }}
                  />
                  <span>Collapsed</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer hover:text-white transition-colors">
                  <input
                    type="radio"
                    name="sb"
                    className="accent-primary"
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
