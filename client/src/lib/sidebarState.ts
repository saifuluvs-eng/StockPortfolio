export type SidebarMode = 'expanded' | 'collapsed' | 'hover';

const KEY = 'sidebarMode';

export function getSidebarMode(): SidebarMode {
  const v = localStorage.getItem(KEY);
  if (v === 'expanded' || v === 'collapsed' || v === 'hover') return v;
  // Default for everyone: Expand on hover
  return 'hover';
}

export function setSidebarMode(mode: SidebarMode) {
  localStorage.setItem(KEY, mode);
}
