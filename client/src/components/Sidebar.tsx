import { useEffect, useMemo, useState } from 'react';
import { getSidebarMode, setSidebarMode, SidebarMode } from '../lib/sidebarState';

type Item = { label: string; path: string; icon?: JSX.Element; };

const NAV: Item[] = [
  { label: 'Dashboard', path: '#/' },
  { label: 'Portfolio', path: '#/portfolio' },
  { label: 'Gainers', path: '#/gainers' },
  { label: 'Analyse', path: '#/analyse/BTCUSDT' },
  { label: 'Scan', path: '#/scan' },
];

function widthFor(mode: SidebarMode) {
  return mode === 'expanded' ? 240 : 64; // collapsed + hover rail width
}

export default function Sidebar() {
  const [mode, setMode] = useState<SidebarMode>(() => getSidebarMode());
  const w = widthFor(mode);

  // When "hover", expand while mouse is over the sidebar
  const [hovering, setHovering] = useState(false);
  const effectiveW = mode === 'hover' && hovering ? 240 : w;
  const showLabels = mode === 'expanded' || (mode === 'hover' && hovering);

  // Push a CSS var so the content container can offset
  useEffect(() => {
    const px = `${effectiveW}px`;
    document.body.style.setProperty('--sidebar-offset', px);
  }, [effectiveW]);

  function choose(m: SidebarMode) {
    setMode(m);
    setSidebarMode(m);
  }

  const classes = useMemo(() => ({
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
    },
    header: {
      padding: '14px 12px',
      fontWeight: 700,
      fontSize: 16,
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
    bottom: {
      marginTop: 'auto',
      padding: 8,
    },
    pill: {
      display: 'inline-flex',
      gap: 8,
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      padding: '6px 8px',
    }
  }), [effectiveW]);

  return (
    <aside
      style={classes.wrap}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div style={classes.header}>
        {showLabels ? 'CryptoTrader Pro' : '☰'}
      </div>

      <nav>
        {NAV.map((it) => (
          <a
            key={it.path}
            href={it.path}
            title={it.label}
            style={classes.navItem}
          >
            <span style={{ width: 22, textAlign: 'center' }}>•</span>
            {showLabels && <span>{it.label}</span>}
          </a>
        ))}
      </nav>

      <div style={classes.bottom}>
        {/* Sidebar control */}
        <div style={classes.pill}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="radio"
              name="sb-mode"
              checked={mode === 'expanded'}
              onChange={() => choose('expanded')}
            />
            {showLabels && <span>Expanded</span>}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="radio"
              name="sb-mode"
              checked={mode === 'collapsed'}
              onChange={() => choose('collapsed')}
            />
            {showLabels && <span>Collapsed</span>}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="radio"
              name="sb-mode"
              checked={mode === 'hover'}
              onChange={() => choose('hover')}
            />
            {showLabels && <span>Expand on hover</span>}
          </label>
        </div>
      </div>
    </aside>
  );
}
