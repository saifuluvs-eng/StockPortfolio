import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import styles from "./Sidebar.module.css";
import { NAV, type NavItem } from "./navConfig";
import { useUI } from "@/stores/uiStore";

function isMatch(location: string, item: NavItem) {
  const candidates = item.match ?? [item.to];
  return candidates.some((candidate) => {
    if (typeof candidate === "string") {
      if (candidate === "/") return location === "/";
      return location === candidate || location.startsWith(`${candidate}/`);
    }
    try {
      return candidate.test(location);
    } catch (error) {
      console.warn("Invalid sidebar nav match", error);
      return false;
    }
  });
}

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUI();
  const [mobileOpen, setMobileOpen] = useState(true);
  const [location] = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 900px)");
    const handler = () => {
      setMobileOpen(false);
    };
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 900px)");
    if (mq.matches) {
      setMobileOpen(false);
    }
  }, [location]);

  const collapsedClass = sidebarCollapsed ? styles.collapsed : "";
  const iconOnlyClass = sidebarCollapsed ? styles.iconOnly : "";

  const asideClassName = useMemo(() => {
    const classes = [styles.root, collapsedClass];
    if (!mobileOpen) classes.push(styles.hiddenMobile);
    return classes.filter(Boolean).join(" ");
  }, [collapsedClass, mobileOpen]);

  const navClassName = useMemo(() => {
    const classes = [styles.nav, iconOnlyClass];
    return classes.filter(Boolean).join(" ");
  }, [iconOnlyClass]);

  return (
    <aside className={asideClassName} aria-label="Primary" aria-expanded={!sidebarCollapsed}>
      <div className={styles.header}>
        {!sidebarCollapsed && <div className={styles.brand}>Crypto Dashboard</div>}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className={styles.toggle}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => toggleSidebar()}
            title={sidebarCollapsed ? "Expand" : "Collapse"}
            type="button"
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button
            className={styles.toggle}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
            title="Menu"
            type="button"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      <nav className={navClassName}>
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isMatch(location, item);
          const className = [styles.item, active ? styles.active : ""].filter(Boolean).join(" ");
          const handleClick = () => {
            if (typeof window !== "undefined") {
              const mq = window.matchMedia("(max-width: 900px)");
              if (mq.matches) {
                setMobileOpen(false);
              }
            }
          };
          return (
            <Link key={item.to} to={item.to} className={className} title={item.label} onClick={handleClick}>
              <span className={styles.iconWrap}>
                <Icon size={18} />
              </span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {!sidebarCollapsed && (
        <div className={styles.footer}>v2 beta • {new Date().getFullYear()}</div>
      )}
    </aside>
  );
}
