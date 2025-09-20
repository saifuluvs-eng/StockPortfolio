import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  TrendingUp, 
  BarChart3, 
  Star, 
  Award,
  Home,
  Brain,
  LineChart,
  LogOut,
  LogIn
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Portfolio", href: "/portfolio", icon: BarChart3 },
  { name: "SCAN", href: "/charts", icon: LineChart },
  { name: "High Potential", href: "/high-potential", icon: Star },
  { name: "Top Gainers", href: "/gainers", icon: Award },
  { name: "AI Insights", href: "/ai-insights", icon: Brain },
];

function AuthButton() {
  const { isAuthenticated, signInWithGoogle, signOut, user } = useAuth();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Error signing in with Google: ", error);
    }
  };

  return isAuthenticated ? (
    <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={signOut}>
      <LogOut className="w-5 h-5 mr-3" />
      <span className="truncate">{user?.displayName ?? user?.email}</span>
      <span className="ml-auto text-xs">Logout</span>
    </Button>
  ) : (
    <Button variant="ghost" className="w-full justify-start" onClick={handleSignIn}>
      <LogIn className="w-5 h-5 mr-3" />
      Login/Sign up
    </Button>
  );
}

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-card border-r border-border flex-shrink-0 flex flex-col">
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
      <div className="mt-auto p-6">
          <AuthButton />
      </div>
    </div>
  );
}
