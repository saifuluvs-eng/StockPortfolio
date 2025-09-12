import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar } from "@/components/layout/sidebar";
import { TrendingUp, BarChart3, Search, Star, Award, Eye, Bell, Brain, Activity, DollarSign, Target } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

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
  const portfolioArray = Array.isArray(portfolio) ? portfolio : [];
  const portfolioValue = portfolioArray.reduce((total: number, position: any) => total + (position.currentValue || 0), 0);
  const portfolioPnL = portfolioArray.reduce((total: number, position: any) => total + (position.pnl || 0), 0);
  const portfolioPnLPercent = portfolioValue > 0 ? (portfolioPnL / (portfolioValue - portfolioPnL)) * 100 : 0;
  const activePositions = portfolioArray.length;

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

          {/* Dynamic Dashboard Cards - Varying Sizes */}
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8 auto-rows-min">
            
            {/* BIG CARD: Portfolio - spans 2 columns and 2 rows */}
            <Link href="/portfolio">
              <Card className="md:col-span-2 md:row-span-2 cursor-pointer hover:shadow-xl transition-all duration-300 border-border bg-gradient-to-br from-primary/5 to-primary/15 hover:from-primary/10 hover:to-primary/20">
                <CardContent className="p-8 h-full flex flex-col justify-center">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center">
                        <BarChart3 className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">Portfolio</h3>
                        <p className="text-sm text-muted-foreground">Manage your positions</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-foreground" data-testid="text-portfolio-value">
                        ${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <TrendingUp className={`w-4 h-4 ${portfolioPnLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                        <span className={`text-sm font-medium ${portfolioPnLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="text-portfolio-change">
                          {portfolioPnLPercent >= 0 ? '+' : ''}{portfolioPnLPercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* MEDIUM CARD: Scanner - spans 2 columns */}
            <Link href="/scanner">
              <Card className="md:col-span-2 cursor-pointer hover:shadow-lg transition-shadow border-border bg-gradient-to-br from-accent/5 to-accent/10">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 bg-accent/20 rounded-lg flex items-center justify-center">
                        <Search className="w-7 h-7 text-accent" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">Technical Scanner</h3>
                        <p className="text-sm text-muted-foreground">Advanced market analysis</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">15+</p>
                      <p className="text-xs text-muted-foreground">Indicators</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* SMALL CARDS: High Potential and Top Gainers */}
            <Link href="/high-potential">
              <Card className="md:col-span-1 cursor-pointer hover:shadow-lg transition-shadow border-border bg-gradient-to-br from-red-500/5 to-red-500/10">
                <CardContent className="p-5">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Star className="w-6 h-6 text-red-500" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">High Potential</h3>
                    <p className="text-xs text-muted-foreground">Top opportunities</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/gainers">
              <Card className="md:col-span-1 cursor-pointer hover:shadow-lg transition-shadow border-border bg-gradient-to-br from-green-500/5 to-green-500/10">
                <CardContent className="p-5">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Award className="w-6 h-6 text-green-500" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">Top Gainers</h3>
                    <p className="text-xs text-muted-foreground">Market leaders</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* MEDIUM CARD: Total P&L - spans 2 columns */}
            <Card className="md:col-span-2 border-border bg-gradient-to-br from-emerald-500/5 to-emerald-500/15">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Total P&L</p>
                    <p className={`text-3xl font-bold ${portfolioPnL >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="text-daily-pnl">
                      {portfolioPnL >= 0 ? '+' : ''}${portfolioPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Last 24h performance</p>
                  </div>
                  <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <Activity className="w-8 h-8 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SMALL CARDS: Watchlist and Smart Alerts */}
            <Card className="md:col-span-1 cursor-pointer hover:shadow-lg transition-shadow border-border bg-gradient-to-br from-blue-500/5 to-blue-500/10" data-testid="card-watchlist">
              <CardContent className="p-5">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Eye className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Watchlist</h3>
                  <p className="text-xs text-muted-foreground">Track favorites</p>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-1 cursor-pointer hover:shadow-lg transition-shadow border-border bg-gradient-to-br from-orange-500/5 to-orange-500/10" data-testid="card-alerts">
              <CardContent className="p-5">
                <div className="text-center">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-6 h-6 text-orange-500" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Smart Alerts</h3>
                  <p className="text-xs text-muted-foreground">Price notifications</p>
                </div>
              </CardContent>
            </Card>

            {/* SMALL CARD: Active Positions */}
            <Card className="md:col-span-1 border-border bg-gradient-to-br from-purple-500/5 to-purple-500/10">
              <CardContent className="p-5">
                <div className="text-center">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Target className="w-6 h-6 text-purple-500" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Positions</h3>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-active-positions">{activePositions}</p>
                  <p className="text-xs text-muted-foreground">Active holdings</p>
                </div>
              </CardContent>
            </Card>

            {/* SMALL CARD: AI Signals */}
            <Card className="md:col-span-1 border-border bg-gradient-to-br from-indigo-500/5 to-indigo-500/10">
              <CardContent className="p-5">
                <div className="text-center">
                  <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Brain className="w-6 h-6 text-indigo-500" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">AI Signals</h3>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-ai-signals">0</p>
                  <p className="text-xs text-green-500">Active</p>
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
