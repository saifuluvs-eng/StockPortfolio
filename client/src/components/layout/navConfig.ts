import { Home, LineChart, TrendingUp, Wallet, Bot, Newspaper } from "lucide-react";
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
    to: "/analyse",
    icon: LineChart,
    match: [/^\/(analyse|charts)(\/|$)/],
  },
  { label: "Gainers", to: "/gainers", icon: TrendingUp },
  { label: "News", to: "/news", icon: Newspaper },
  { label: "Portfolio", to: "/portfolio", icon: Wallet },
  { label: "AI Insights", to: "/ai-insights", icon: Bot },
];
