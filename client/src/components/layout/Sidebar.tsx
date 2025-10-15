import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Settings, Home, Briefcase, BarChart2, Activity } from "lucide-react";

type NavItem = {
  label: string;
  to: string;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: <Home size={20} /> },
  { label: "Portfolio", to: "/portfolio", icon: <Briefcase size={20} /> },
  { label: "Gainers", to: "/gainers", icon: <Activity size={20} /> },
  { label: "Analyse", to: "/analyse", icon: <BarChart2 size={20} /> },
];

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandOnHover, setExpandOnHover] = useState(true);

  const baseAsideClasses = [
    "relative h-screen bg-[#121212] border-r border-white/5 transition-all duration-200 group",
    isCollapsed ? "w-14" : "w-60",
    expandOnHover && isCollapsed ? "hover:w-60" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const labelClasses = (collapsedState: boolean, hoverState: boolean) => {
    if (!collapsedState) return "opacity-100 w-auto";
    if (hoverState) {
      return "opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto";
    }
    return "opacity-0 w-0";
  };

  return (
    <aside className={baseAsideClasses}>
      <div className="h-14 flex items-center px-3">
        <Link
          to="/dashboard"
          className={[
            "text-white/90 font-semibold tracking-wide whitespace-nowrap overflow-hidden transition-all",
            isCollapsed && !expandOnHover ? "opacity-0" : "opacity-100",
          ].join(" ")}
        >
          {isCollapsed && !expandOnHover ? "" : "CryptoTrader Pro"}
        </Link>
      </div>

      <nav className="mt-2 space-y-1 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                "group group/nav relative flex items-center gap-3 rounded-xl px-3 py-2 text-[15px]",
                "text-white/80 hover:text-white hover:bg-white/5",
                isActive ? "bg-white/[0.07] text-white" : "",
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            <div className="shrink-0">{item.icon}</div>
            <span
              className={[
                "whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-200",
                labelClasses(isCollapsed, expandOnHover),
              ].join(" ")}
            >
              {item.label}
            </span>
            {isCollapsed && !expandOnHover && (
              <div
                className="tooltip"
                style={{
                  left: "100%",
                  marginLeft: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  position: "absolute",
                }}
              >
                {item.label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="absolute bottom-3 left-0 right-0 px-2">
        <div className="relative">
          <details className="group">
            <summary
              className={[
                "list-none flex items-center gap-3 rounded-xl px-3 py-2 cursor-pointer select-none",
                "text-white/80 hover:text-white hover:bg-white/5",
              ].join(" ")}
            >
              <Settings size={20} className="shrink-0" />
              <span
                className={[
                  "transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis",
                  labelClasses(isCollapsed, expandOnHover),
                ].join(" ")}
              >
                Project Settings
              </span>
            </summary>

            <div
              className={[
                "absolute z-50 rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-xl text-sm w-64",
                isCollapsed && !expandOnHover ? "left-full ml-2" : "left-2 right-2",
              ].join(" ")}
            >
              <div className="px-4 py-3 border-b border-white/10 text-white/80">
                Sidebar control
              </div>
              <div className="p-3 space-y-2 text-white/80">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="sidebar-mode"
                    checked={!isCollapsed && !expandOnHover}
                    onChange={() => {
                      setIsCollapsed(false);
                      setExpandOnHover(false);
                    }}
                  />
                  <span>Expanded</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="sidebar-mode"
                    checked={isCollapsed && !expandOnHover}
                    onChange={() => {
                      setIsCollapsed(true);
                      setExpandOnHover(false);
                    }}
                  />
                  <span>Collapsed</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="sidebar-mode"
                    checked={isCollapsed && expandOnHover}
                    onChange={() => {
                      setIsCollapsed(true);
                      setExpandOnHover(true);
                    }}
                  />
                  <span>Expand on hover</span>
                </label>
              </div>
            </div>
          </details>
        </div>
      </div>
    </aside>
  );
}
