import { useAuth } from "@/auth/AuthContext";
import { useLocation } from "wouter";
import { Menu } from "lucide-react";

export default function Header() {
  const { user } = useAuth();
  const [pathname] = useLocation();

  const getPageTitle = (path: string) => {
    const titles: Record<string, string> = {
      "/dashboard": "Dashboard",
      "/portfolio": "Portfolio",
      "/gainers": "Top Gainers",
      "/analyse": "Market Analysis",
      "/watchlist": "Watchlist",
      "/alerts": "Smart Alerts",
      "/account": "Account",
      "/ai-insights": "AI Insights",
      "/news": "News & Insights",
    };

    for (const [route, title] of Object.entries(titles)) {
      if (pathname.startsWith(route)) return title;
    }
    return "Trading Dashboard";
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
            {getPageTitle(pathname)}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {user && <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>}
        </div>
      </div>
    </header>
  );
}
