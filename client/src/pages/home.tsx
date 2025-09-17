import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar } from "@/components/layout/sidebar";
import { TrendingUp, BarChart3, Search, Star, Award, Eye, Bell, Brain, Activity, DollarSign, Target } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

interface HighPotentialData {
  results: any[];
}

interface AiOverviewData {
  signals: any[];
}

export default function Home() {
  const { user } = useAuth();
  const [prices, setPrices] = useState<{BTCUSDT?: number, ETHUSDT?: number}>({});
  const [btcChange, setBtcChange] = useState<{priceChangePercent?: string}>({});
  const [ethChange, setEthChange] = useState<{priceChangePercent?: string}>({});
  
  // Fetch BTC ticker data
  const { data: btcTicker } = useQuery({
    queryKey: ['/api/market/ticker/BTCUSDT'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });
  
  // Fetch ETH ticker data
  const { data: ethTicker } = useQuery({
    queryKey: ['/api/market/ticker/ETHUSDT'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });
  
  // Fetch portfolio data for performance metrics
  const { data: portfolio } = useQuery({
    queryKey: ['/api/portfolio'],
    refetchInterval: 15000, // Refresh every 15 seconds
    enabled: !!user,
  });
  
  // Fetch market gainers data
  const { data: gainers } = useQuery<any[]>({
    queryKey: ['/api/market/gainers'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  // Fetch watchlist data
  const { data: watchlist } = useQuery({
    queryKey: ['/api/watchlist'],
    refetchInterval: 30000,
    enabled: !!user,
  });
  
  // Fetch AI market overview
  const { data: aiOverview } = useQuery<AiOverviewData>({
    queryKey: ['/api/ai/market-overview'],
    refetchInterval: 120000, // Refresh every 2 minutes
  });
  
  // Fetch high potential signals (using POST request)
  const { data: highPotentialData } = useQuery<HighPotentialData>({
    queryKey: ['/api/scanner/high-potential'],
    queryFn: async () => {
      const response = await fetch('/api/scanner/high-potential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Empty filters for default scan
      });
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
    enabled: !!user,
  });
  
  // WebSocket connection for real-time prices
  useEffect(() => {
    const ws = new WebSocket(`wss://${window.location.host}/ws`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'price_update') {
          setPrices(data.data);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', symbol: 'BTCUSDT' }));
      ws.send(JSON.stringify({ type: 'subscribe', symbol: 'ETHUSDT' }));
    };
    
    return () => ws.close();
  }, []);
  
  // Update ticker data when received
  useEffect(() => {
    if (btcTicker) {
      setBtcChange(btcTicker);
    }
  }, [btcTicker]);
  
  useEffect(() => {
    if (ethTicker) {
      setEthChange(ethTicker);
    }
  }, [ethTicker]);
  
  // Calculate portfolio metrics
  const portfolioData = portfolio as any;
  const portfolioValue = portfolioData?.totalValue || 0;
  const portfolioPnL = portfolioData?.totalPnL || 0;
  const portfolioPnLPercent = portfolioData?.totalPnLPercent || 0;
  const activePositions = portfolioData?.positions?.length || 0;

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
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
            {user ? (
              <Button variant="outline" onClick={handleLogout} data-testid="button-logout">
                Sign Out
              </Button>
            ) : (
              <Button variant="outline" onClick={() => window.location.href = "/api/auth/google"} data-testid="button-login">
                Sign In
              </Button>
            )}
          </div>

          {/* Dashboard Cards - Clean Grid Layout */}
          <div className="grid items-stretch grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
            
            {/* Row 1: B-A-B-A-B Pattern */}
            
            {/* Portfolio Card */}
            <Link href="/portfolio" className="block h-full">
              <Card className="dashboard-card neon-hover bg-gradient-to-br from-primary/5 to-primary/10" style={{'--neon-glow': 'hsl(195, 100%, 60%)'} as React.CSSProperties}>
                <CardContent className="p-6 h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Portfolio</h3>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-portfolio-value">
                        ${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <div className="flex items-center space-x-1 mt-1">
                        <TrendingUp className={`w-3 h-3 ${portfolioPnLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                        <span className={`text-xs ${portfolioPnLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="text-portfolio-change">
                          {portfolioPnLPercent >= 0 ? '+' : ''}{portfolioPnLPercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <BarChart3 className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Scanner Card */}
            <Link href="/charts" className="block h-full">
              <Card className="dashboard-card neon-hover bg-gradient-to-br from-accent/5 to-accent/10" style={{'--neon-glow': 'hsl(158, 100%, 50%)'} as React.CSSProperties}>
                <CardContent className="p-6 h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Scanner</h3>
                      <p className="text-sm text-muted-foreground">Technical analysis</p>
                      <p className="text-lg font-bold text-foreground mt-2">15+</p>
                      <p className="text-xs text-muted-foreground">Indicators</p>
                    </div>
                    <Search className="w-8 h-8 text-accent" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* High Potential Card */}
            <Link href="/high-potential" className="block h-full">
              <Card className="dashboard-card neon-hover bg-gradient-to-br from-red-500/5 to-red-500/10" style={{'--neon-glow': 'hsl(0, 80%, 60%)'} as React.CSSProperties}>
                <CardContent className="p-6 h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">High Potential</h3>
                      <p className="text-sm text-muted-foreground">Top opportunities</p>
                      <p className="text-lg font-bold text-foreground mt-2">{highPotentialData?.results?.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Active signals</p>
                    </div>
                    <Star className="w-8 h-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Top Gainers Card */}
            <Link href="/gainers" className="block h-full">
              <Card className="dashboard-card neon-hover bg-gradient-to-br from-green-500/5 to-green-500/10" style={{'--neon-glow': 'hsl(142, 70%, 50%)'} as React.CSSProperties}>
                <CardContent className="p-6 h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Top Gainers</h3>
                      <p className="text-sm text-muted-foreground">Market leaders</p>
                      <p className="text-lg font-bold text-foreground mt-2">{Array.isArray(gainers) ? gainers.length : 0}</p>
                      <p className="text-xs text-muted-foreground">Coins tracked</p>
                    </div>
                    <Award className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Total P&L Card */}
            <Link href="/portfolio" className="block h-full">
              <Card className="dashboard-card neon-hover bg-gradient-to-br from-emerald-500/5 to-emerald-500/10" style={{'--neon-glow': 'hsl(158, 100%, 50%)'} as React.CSSProperties}>
                <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Total P&L</h3>
                    <p className={`text-2xl font-bold ${portfolioPnL >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="text-daily-pnl">
                      {portfolioPnL >= 0 ? '+' : ''}${portfolioPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">24h performance</p>
                  </div>
                  <Activity className="w-8 h-8 text-emerald-600" />
                </div>
              </CardContent>
            </Card>
            </Link>

            {/* Watchlist Card */}
            <Link href="/portfolio" className="block h-full">
              <Card className="dashboard-card neon-hover bg-gradient-to-br from-blue-500/5 to-blue-500/10" data-testid="card-watchlist" style={{'--neon-glow': 'hsl(220, 100%, 60%)'} as React.CSSProperties}>
                <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Watchlist</h3>
                    <p className="text-sm text-muted-foreground">Track favorites</p>
                    <p className="text-lg font-bold text-foreground mt-2">{Array.isArray(watchlist) ? watchlist.length : 0}</p>
                    <p className="text-xs text-muted-foreground">Coins tracked</p>
                  </div>
                  <Eye className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            </Link>

            {/* Smart Alerts Card */}
            <Link href="/portfolio" className="block h-full">
              <Card className="dashboard-card neon-hover bg-gradient-to-br from-orange-500/5 to-orange-500/10" data-testid="card-alerts" style={{'--neon-glow': 'hsl(25, 100%, 55%)'} as React.CSSProperties}>
                <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Smart Alerts</h3>
                    <p className="text-sm text-muted-foreground">Price notifications</p>
                    <p className="text-lg font-bold text-foreground mt-2">{watchlist ? Math.min(Array.isArray(watchlist) ? watchlist.length : 0, 3) : 0}</p>
                    <p className="text-xs text-muted-foreground">Active alerts</p>
                  </div>
                  <Bell className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            </Link>

            {/* Active Positions Card */}
            <Link href="/portfolio" className="block h-full">
              <Card className="dashboard-card neon-hover bg-gradient-to-br from-purple-500/5 to-purple-500/10" style={{'--neon-glow': 'hsl(280, 80%, 60%)'} as React.CSSProperties}>
                <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Positions</h3>
                    <p className="text-sm text-muted-foreground">Active holdings</p>
                    <p className="text-lg font-bold text-foreground mt-2" data-testid="text-active-positions">{activePositions}</p>
                    <p className="text-xs text-muted-foreground">Holdings</p>
                  </div>
                  <Target className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            </Link>

            {/* AI Signals Card */}
            <Link href="/ai-insights" className="block h-full">
              <Card className="dashboard-card neon-hover bg-gradient-to-br from-indigo-500/5 to-indigo-500/10" style={{'--neon-glow': 'hsl(240, 100%, 70%)'} as React.CSSProperties}>
                <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">AI Signals</h3>
                    <p className="text-sm text-muted-foreground">Market analysis</p>
                    <p className="text-lg font-bold text-foreground mt-2" data-testid="text-ai-signals">{aiOverview?.signals?.length || 0}</p>
                    <p className="text-xs text-green-500">Active insights</p>
                  </div>
                  <Brain className="w-8 h-8 text-indigo-500" />
                </div>
              </CardContent>
            </Card>
            </Link>

            {/* Market Status Card */}
            <Link href="/gainers" className="block h-full">
              <Card className="dashboard-card neon-hover bg-gradient-to-br from-slate-500/5 to-slate-500/10" style={{'--neon-glow': 'hsl(210, 20%, 70%)'} as React.CSSProperties}>
                <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Market Status</h3>
                    <p className="text-sm text-muted-foreground">Current state</p>
                    <p className="text-lg font-bold text-green-500 mt-2">Open</p>
                    <p className="text-xs text-muted-foreground">24/7 crypto markets</p>
                  </div>
                  <Activity className="w-8 h-8 text-slate-500" />
                </div>
              </CardContent>
            </Card>
            </Link>
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
                    <p className="font-semibold" data-testid="text-btc-price">
                      ${(prices.BTCUSDT || parseFloat((btcTicker as any)?.price || '0')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className={`text-sm ${parseFloat((btcChange as any).priceChangePercent || '0') >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="text-btc-change">
                      {parseFloat((btcChange as any).priceChangePercent || '0') >= 0 ? '+' : ''}{parseFloat((btcChange as any).priceChangePercent || '0').toFixed(2)}%
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">ETH/USDT</span>
                  <div className="text-right">
                    <p className="font-semibold" data-testid="text-eth-price">
                      ${(prices.ETHUSDT || parseFloat((ethTicker as any)?.price || '0')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className={`text-sm ${parseFloat((ethChange as any).priceChangePercent || '0') >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="text-eth-change">
                      {parseFloat((ethChange as any).priceChangePercent || '0') >= 0 ? '+' : ''}{parseFloat((ethChange as any).priceChangePercent || '0').toFixed(2)}%
                    </p>
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
