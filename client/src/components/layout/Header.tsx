import { useAuth } from "@/auth/AuthContext";
import { useLocation } from "wouter";
import { Menu } from "lucide-react";
import AccountDropdown from "@/components/auth/AccountDropdown";

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [pathname] = useLocation();

  const getPageTitle = (path: string) => {
    const titles: Record<string, string> = {
      "/dashboard": "Dashboard",
      "/portfolio": "Portfolio",
      "/gainers": "Top Gainers",
      "/analyse": "Analysis",
      "/watchlist": "Watchlist",
      "/alerts": "Alerts",
      "/account": "Account",
      "/ai-insights": "AI",
      "/news": "News",
    };

    for (const [route, title] of Object.entries(titles)) {
      if (pathname.startsWith(route)) return title;
    }
    return "Dashboard";
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14 md:h-16">
      <div className="flex h-full items-center justify-between px-3 sm:px-4 md:px-6 gap-2">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 hover:bg-foreground/10 rounded-lg transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} className="text-foreground" />
        </button>
        
        <h1 className="text-base font-semibold tracking-tight text-foreground truncate flex-1 md:flex-none md:text-lg">
          {getPageTitle(pathname)}
        </h1>
        <AccountDropdown />
      </div>
    </header>
  );
}
