import { useEffect, useMemo, useRef, useState } from 'react';
import { getSidebarMode, setSidebarMode, SidebarMode } from '../lib/sidebarState';
import { IcHome, IcPortfolio, IcTrending, IcChart, IcRadar, IcSidebar } from './icons';

type Item = { label: string; path: string; icon: JSX.Element; };

const NAV: Item[] = [
  { label: 'Dashboard', path: '#/',              icon: <IcHome/> },
  { label: 'Portfolio', path: '#/portfolio',     icon: <IcPortfolio/> },
  { label: 'Gainers',   path: '#/gainers',       icon: <IcTrending/> },
  { label: 'Analyse',   path: '#/analyse/BTCUSDT', icon: <IcChart/> },
  { label: 'Scan',      path: '#/scan',          icon: <IcRadar/> },
];

function baseWidth(mode: SidebarMode) {
  return mode === 'expanded' ? 208 : 64; // collapsed + hover rail width
}

export default function Sidebar() {
  const [mode, setMode] = useState<SidebarMode>(() => getSidebarMode());
  const [hovering, setHovering] = useState(false);
  const [controlOpen, setControlOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Effective width: in "hover" mode expand to full width when hovering
  const wBase = baseWidth(mode);
  const effectiveW = (mode === 'hover' && hovering) ? 208 : wBase;

  // Visibility of labels (fade after width transition)
  const labelsVisible = mode === 'expanded' || (mode === 'hover' && hovering);

  // Close popover when clicking outside
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!controlOpen) return;
      const el = sidebarRef.current;
      if (el && !el.contains(e.target as Node)) setControlOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [controlOpen]);

  // Push CSS var for content offset
  useEffect(() => {
    document.body.style.setProperty('--sidebar-offset', `${effectiveW}px`);
  }, [effectiveW]);

  function choose(m: SidebarMode) {
    setMode(m);
    setSidebarMode(m);
    setControlOpen(false);
  }

  const css = useMemo(() => ({
    wrap: {
      position: 'fixed' as const,
      inset: '0 auto 0 0',
      width: effectiveW,
      transition: 'width 160ms ease',
      background: 'rgba(255,255,255,0.03)',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      flexDirection: 'column' as const,
      zIndex: 40,
      overflow: 'hidden', // prevents label showing before expansion
    },
    header: {
      padding: '14px 16px',
      fontWeight: 700,
      fontSize: 18,
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden' as const,
      textOverflow: 'ellipsis' as const,
    },
    navItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 12px',
      cursor: 'pointer',
      borderRadius: 10,
      margin: '4px 8px',
      whiteSpace: 'nowrap' as const,
    },
    iconBox: { width: 22, textAlign: 'center' as const, opacity: 0.9 },
    label: {
      opacity: labelsVisible ? 1 : 0,
      transform: labelsVisible ? 'translateX(0)' : 'translateX(-6px)',
      transition: 'opacity 120ms ease 120ms, transform 120ms ease 120ms', // delay after width
      pointerEvents: labelsVisible ? 'auto' : 'none',
      fontSize: 15,
    },
    bottom: {
      marginTop: 'auto',
      padding: 8,
      position: 'relative' as const,
    },
    controlBtn: {
      width: 36, height: 28,
      display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      cursor: 'pointer',
    },
    popover: {
      position: 'absolute' as const,
      left: 8,
      right: 8,
      bottom: 44,
      background: 'rgba(18,18,18,0.98)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: 12,
      boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
      maxWidth: '100%',
      fontSize: 14,
    },
    popTitle: {
      fontSize: 12, opacity: 0.8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 8
    },
    popRow: {
      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', cursor: 'pointer',
    },
    checkDot: (ok: boolean) => ({
      width: 8, height: 8, borderRadius: 9999,
      background: ok ? 'white' : 'transparent',
      outline: '1px solid rgba(255,255,255,0.5)',
    }),
  }), [effectiveW, labelsVisible]);

  return (
    <aside
      ref={sidebarRef}
      style={css.wrap}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setControlOpen(false); }}
    >
      <div style={css.header}>
        {labelsVisible ? 'CryptoTrader Pro' : '☰'}
      </div>

      <nav>
        {NAV.map((it) => (
          <a key={it.path} href={it.path} title={it.label} style={css.navItem}>
            <span style={css.iconBox}>{it.icon}</span>
            <span style={css.label}>{it.label}</span>
          </a>
        ))}
      </nav>

      <div style={css.bottom}>
        {/* Bottom icon button that toggles the popover */}
        <button type="button" aria-label="Sidebar control" style={css.controlBtn} onClick={() => setControlOpen(v => !v)}>
          <IcSidebar />
        </button>

        {controlOpen && (
          <div style={css.popover}>
            <div style={css.popTitle}>Sidebar control</div>
            <div style={css.popRow} onClick={() => choose('expanded')}>
              <div style={css.checkDot(mode === 'expanded')} />
              <span>Expanded</span>
            </div>
            <div style={css.popRow} onClick={() => choose('collapsed')}>
              <div style={css.checkDot(mode === 'collapsed')} />
              <span>Collapsed</span>
            </div>
            <div style={css.popRow} onClick={() => choose('hover')}>
              <div style={css.checkDot(mode === 'hover')} />
              <span>Expand on hover</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
