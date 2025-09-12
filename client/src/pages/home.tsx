import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar } from "@/components/layout/sidebar";
import { TrendingUp, BarChart3, Search, Star, Award, Eye, Bell, Brain, Activity, DollarSign, Target } from "lucide-react";
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
                Welcome back, {(user as any)?.firstName || "Trader"}!
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
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
                    <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                      <Award className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Top Gainers</h3>
                      <p className="text-sm text-muted-foreground">Market leaders</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-border" data-testid="card-watchlist">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <Eye className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Watchlist</h3>
                    <p className="text-sm text-muted-foreground">Track favorites</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-border" data-testid="card-alerts">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
                    <Bell className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Smart Alerts</h3>
                    <p className="text-sm text-muted-foreground">Price notifications</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Portfolio Performance */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Portfolio</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-portfolio-value">$0.00</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-primary" />
                </div>
                <div className="mt-2 flex items-center space-x-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-500" data-testid="text-portfolio-change">+0.00%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today's P&L</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-daily-pnl">$0.00</p>
                  </div>
                  <Activity className="w-8 h-8 text-accent" />
                </div>
                <div className="mt-2 flex items-center space-x-1">
                  <span className="text-sm text-muted-foreground">Last 24h</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Positions</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-active-positions">0</p>
                  </div>
                  <Target className="w-8 h-8 text-secondary" />
                </div>
                <div className="mt-2 flex items-center space-x-1">
                  <span className="text-sm text-muted-foreground">Holdings</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">AI Signals</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-ai-signals">0</p>
                  </div>
                  <Brain className="w-8 h-8 text-purple-500" />
                </div>
                <div className="mt-2 flex items-center space-x-1">
                  <span className="text-sm text-green-500">Active</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Dashboard Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <span>Market Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">BTC/USDT</span>
                  <div className="text-right">
                    <p className="font-semibold" data-testid="text-btc-price">$0.00</p>
                    <p className="text-sm text-green-500" data-testid="text-btc-change">+0.00%</p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">ETH/USDT</span>
                  <div className="text-right">
                    <p className="font-semibold" data-testid="text-eth-price">$0.00</p>
                    <p className="text-sm text-red-500" data-testid="text-eth-change">+0.00%</p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Market Fear & Greed</span>
                  <div className="text-right">
                    <p className="font-semibold" data-testid="text-fear-greed">--</p>
                    <p className="text-sm text-muted-foreground">Index</p>
                  </div>
                </div>
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
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="w-5 h-5 text-purple-500" />
                  <span>AI Trading Assistant</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-foreground">Market sentiment: Bullish</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-foreground">Technical signals detected</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-sm text-foreground">Risk level: Moderate</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 mt-4">
                  <p className="text-sm text-muted-foreground italic">
                    "Bitcoin showing strong support at $40k level. Consider DCA strategy for next 24h."
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">AI Insight • 2 min ago</p>
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
                  <span className="text-sm text-foreground">15+ Technical indicators</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-sm text-foreground">AI-powered analysis</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-foreground">Smart alert system</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-foreground">Portfolio P&L tracking</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
