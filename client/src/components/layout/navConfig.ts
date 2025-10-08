import { Home, LineChart, TrendingUp, Wallet, Bot } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  match?: (string | RegExp)[];
};

export const NAV: NavItem[] = [
  { label: "Dashboard", to: "/", icon: Home },
  {
    label: "Analyse",
    to: "/analyse-v2",
    icon: LineChart,
    match: [/^\/(analyse-v2|charts)(\/|$)/],
  },
  { label: "Gainers", to: "/gainers", icon: TrendingUp },
  { label: "Portfolio", to: "/portfolio", icon: Wallet },
  { label: "AI Insights", to: "/ai-insights", icon: Bot },
];
