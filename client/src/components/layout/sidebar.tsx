import React from "react";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  BarChart3,
  Star,
  Award,
  Home,
  Brain,
  LineChart,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", hash: "#/dashboard", icon: Home },
  { name: "Portfolio", hash: "#/portfolio", icon: BarChart3 },
  { name: "SCAN", hash: "#/charts", icon: LineChart },
  { name: "High Potential", hash: "#/high-potential", icon: Star },
  { name: "Top Gainers", hash: "#/gainers", icon: Award },
  { name: "AI Insights", hash: "#/ai-insights", icon: Brain },
];

const getHash = () =>
  typeof window !== "undefined" && window.location
    ? window.location.hash || "#/"
    : "#/";

export function Sidebar() {
  const [currentHash, setCurrentHash] = React.useState<string>(getHash());

  React.useEffect(() => {
    const onHashChange = () => setCurrentHash(getHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <div className="w-64 bg-card border-r border-border flex-shrink-0 relative z-40 pointer-events-auto">
      <div className="p-6 relative z-40 pointer-events-auto">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">
            CryptoTrader Pro
          </span>
        </div>

        <nav className="space-y-2" data-testid="sidebar-navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentHash === item.hash ||
              (item.hash !== "#/" && currentHash.startsWith(item.hash));

            return (
              <a
                key={item.name}
                href={item.hash}
                className={cn(
                  "w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors relative z-50 pointer-events-auto",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                data-testid={`nav-link-${item.name
                  .toLowerCase()
                  .replace(/\s+/g, "-")}`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
