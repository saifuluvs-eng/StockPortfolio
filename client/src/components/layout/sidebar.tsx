import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  TrendingUp, 
  BarChart3, 
  Search, 
  Star, 
  Award,
  Home,
  Brain,
  LineChart
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Portfolio", href: "/portfolio", icon: BarChart3 },
  { name: "Advanced Charts", href: "/charts", icon: LineChart },
  { name: "Custom Scanner", href: "/scanner", icon: Search },
  { name: "High Potential", href: "/high-potential", icon: Star },
  { name: "Top Gainers", href: "/gainers", icon: Award },
  { name: "AI Insights", href: "/ai-insights", icon: Brain },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-card border-r border-border flex-shrink-0">
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">CryptoTrader Pro</span>
        </div>
        
        <nav className="space-y-2" data-testid="sidebar-navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={cn(
                  "w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
