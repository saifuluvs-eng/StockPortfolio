import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar } from "@/components/layout/sidebar";
import { TrendingUp, BarChart3, Search, Star, Award } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user } = useAuth();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Welcome back, {user?.firstName || "Trader"}!
              </h1>
              <p className="text-muted-foreground mt-1">
                Your trading dashboard is ready. Let's make some profitable trades today.
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout} data-testid="button-logout">
              Sign Out
            </Button>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Link href="/portfolio">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow border-border">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Portfolio</h3>
                      <p className="text-sm text-muted-foreground">Manage positions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/scanner">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow border-border">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                      <Search className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Scanner</h3>
                      <p className="text-sm text-muted-foreground">Technical analysis</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/high-potential">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow border-border">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                      <Star className="w-6 h-6 text-destructive" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">High Potential</h3>
                      <p className="text-sm text-muted-foreground">Top opportunities</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/gainers">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow border-border">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                      <Award className="w-6 h-6 text-secondary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Top Gainers</h3>
                      <p className="text-sm text-muted-foreground">Market leaders</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Dashboard Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <span>Market Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Get started by exploring your portfolio or scanning the markets for new opportunities.
                  Our advanced technical analysis tools will help you make informed trading decisions.
                </p>
                <div className="mt-4 flex space-x-2">
                  <Link href="/portfolio">
                    <Button size="sm" data-testid="button-view-portfolio">View Portfolio</Button>
                  </Link>
                  <Link href="/scanner">
                    <Button size="sm" variant="outline" data-testid="button-start-scanning">Start Scanning</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle>Trading Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-accent rounded-full"></div>
                  <span className="text-sm text-foreground">Real-time market data from Binance</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-sm text-foreground">Advanced technical indicators</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-destructive rounded-full"></div>
                  <span className="text-sm text-foreground">Portfolio P&L tracking</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-secondary rounded-full"></div>
                  <span className="text-sm text-foreground">High-potential coin scanner</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
