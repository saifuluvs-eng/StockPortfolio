import { create } from "zustand";

type UIState = {
  sidebarCollapsed: boolean;
  setCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
};

const initial =
  typeof window !== "undefined" &&
  window.localStorage.getItem("sidebar:collapsed") === "1";

export const useUI = create<UIState>((set) => ({
  sidebarCollapsed: !!initial,
  setCollapsed: (v) =>
    set(() => {
      if (typeof window !== "undefined")
        localStorage.setItem("sidebar:collapsed", v ? "1" : "0");
      return { sidebarCollapsed: v };
    }),
  toggleSidebar: () =>
    set((s) => {
      const v = !s.sidebarCollapsed;
      if (typeof window !== "undefined")
        localStorage.setItem("sidebar:collapsed", v ? "1" : "0");
      return { sidebarCollapsed: v };
    }),
}));
