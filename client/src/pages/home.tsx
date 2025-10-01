// client/src/pages/Home.tsx
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  BarChart3,
  Search,
  Star,
  Award,
  Eye,
  Bell,
  Brain,
  Activity,
} from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

// ---- Types (loose/defensive) ----
type PortfolioApi = {
  totalValue?: number;
  totalPnL?: number;
  totalPnLPercent?: number;
  positions?: any[];
};

type HighPotentialData = { results: any[] };
type AiOverviewData = { signals: any[] };

type GainerItem = {
  symbol?: string;
  pair?: string;
  ticker?: string;
  change24h?: number | string;
  priceChangePercent?: number | string;
};

// number formatters
const nf2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function Home() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const displayName = (user?.displayName?.trim() ?? user?.email ?? "Trader");
  const firstName = displayName.split(" ")[0] || displayName;

  // ---------- Live tickers for lower "Market Overview" box ----------
  const [prices, setPrices] = useState<{ BTCUSDT?: number; ETHUSDT?: number }>(
    {}
  );
  const [btcChange, setBtcChange] = useState<{ priceChangePercent?: string }>(
    {}
  );
  const [ethChange, setEthChange] = useState<{ priceChangePercent?: string }>(
    {}
  );

  // REST tickers (10s)
  const { data: btcTicker } = useQuery({
    queryKey: ["/api/market/ticker/BTCUSDT"],
    refetchInterval: 10_000,
  });
  const { data: ethTicker } = useQuery({
    queryKey: ["/api/market/ticker/ETHUSDT"],
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (btcTicker) setBtcChange(btcTicker as any);
  }, [btcTicker]);
  useEffect(() => {
    if (ethTicker) setEthChange(ethTicker as any);
  }, [ethTicker]);

  // WebSocket (for the numbers in Market Overview box)
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "price_update") setPrices(data.data);
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", symbol: "BTCUSDT" }));
      ws.send(JSON.stringify({ type: "subscribe", symbol: "ETHUSDT" }));
    };

    return () => ws.close();
  }, []);

  // ---------- Data used by tiles (from same APIs your pages use) ----------
  // Portfolio (15s)
  const { data: portfolio } = useQuery<PortfolioApi>({
    queryKey: ["/api/portfolio"],
    refetchInterval: 15_000,
    enabled: !!user, // same as your original
  });
  const portfolioValue = portfolio?.totalValue ?? 0;
  const portfolioPnLPercent = portfolio?.totalPnLPercent ?? 0;

  // Gainers (30s)
  const { data: gainers } = useQuery<GainerItem[]>({
    queryKey: ["/api/market/gainers"],
    refetchInterval: 30_000,
  });

  // Watchlist (30s)
  const { data: watchlist } = useQuery<any[]>({
    queryKey: ["/api/watchlist"],
    refetchInterval: 30_000,
    enabled: !!user,
  });

  // AI overview (2m)
  const { data: aiOverview } = useQuery<AiOverviewData>({
    queryKey: ["/api/ai/market-overview"],
    refetchInterval: 120_000,
  });

  // High Potential → POST (30m) as requested
  const { data: highPotentialData } = useQuery<HighPotentialData>({
    queryKey: ["/api/scanner/high-potential"],
    queryFn: async () => {
      const response = await apiRequest(
        "POST",
        "/api/scanner/high-potential",
        {}
      );
      return response.json();
    },
    refetchInterval: 30 * 60 * 1000,
    enabled: !!user,
  });

  // ---------- Computed displays ----------
  const top3Gainers = useMemo(() => {
    if (!Array.isArray(gainers)) return [];
    const items = gainers
      .map((g) => {
        const raw = g.symbol || g.pair || g.ticker || "";
        const symbol = String(raw).toUpperCase();
        const pctRaw =
          (typeof g.change24h === "number"
            ? g.change24h
            : Number(g.change24h)) ||
          (typeof g.priceChangePercent === "number"
            ? g.priceChangePercent
            : Number(g.priceChangePercent));
        if (!symbol || !Number.isFinite(pctRaw)) return null;
        return { symbol, pct: Number(pctRaw) };
      })
      .filter(Boolean) as { symbol: string; pct: number }[];

    items.sort((a, b) => b.pct - a.pct);
    return items.slice(0, 3);
  }, [gainers]);

  const gainersDisplay =
    top3Gainers.length === 0
      ? "—"
      : top3Gainers
          .map(
            (g) => `${g.symbol} ${g.pct >= 0 ? "+" : ""}${nf2.format(g.pct)}%`
          )
          .join(" · ");

  // Auth actions
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Failed to sign in", error);
    }
  };
  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Failed to sign out", error);
    }
  };

  return (
    <div className="flex-1 overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome back, {firstName}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Your trading dashboard is ready. Let's make some profitable trades
              today.
            </p>
          </div>
          {user ? (
            <Button
              variant="outline"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              Sign Out
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleLogin}
              data-testid="button-login"
            >
              Sign In
            </Button>
          )}
        </div>

        {/* 8 Tiles */}
        <div className="grid items-stretch grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
          {/* Portfolio */}
          <Link href="/portfolio" className="block h-full">
            <Card
              className="dashboard-card neon-hover bg-gradient-to-br from-primary/5 to-primary/10"
              style={
                { "--neon-glow": "hsl(195, 100%, 60%)" } as React.CSSProperties
              }
            >
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      Portfolio
                    </h3>
                    <p
                      className="text-2xl font-bold text-foreground"
                      data-testid="text-portfolio-value"
                    >
                      ${nf2.format(portfolioValue)}
                    </p>
                    <div className="flex items-center space-x-1 mt-1">
                      <TrendingUp
                        className={`w-3 h-3 ${
                          (portfolioPnLPercent ?? 0) >= 0
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      />
                      <span
                        className={`text-xs ${
                          (portfolioPnLPercent ?? 0) >= 0
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                        data-testid="text-portfolio-change"
                      >
                        {(portfolioPnLPercent ?? 0) >= 0 ? "+" : ""}
                        {nf2.format(portfolioPnLPercent ?? 0)}%
                      </span>
                    </div>
                  </div>
                  <BarChart3 className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Scanner */}
          <Link href="/charts" className="block h-full">
            <Card
              className="dashboard-card neon-hover bg-gradient-to-br from-accent/5 to-accent/10"
              style={
                { "--neon-glow": "hsl(158, 100%, 50%)" } as React.CSSProperties
              }
            >
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      Scanner
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Technical analysis
                    </p>
                    <p className="text-lg font-bold text-foreground mt-2">
                      15+
                    </p>
                    <p className="text-xs text-muted-foreground">Indicators</p>
                  </div>
                  <Search className="w-8 h-8 text-accent" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* High Potential (30m refresh via POST) */}
          <Link href="/high-potential" className="block h-full">
            <Card
              className="dashboard-card neon-hover bg-gradient-to-br from-red-500/5 to-red-500/10"
              style={
                { "--neon-glow": "hsl(0, 80%, 60%)" } as React.CSSProperties
              }
            >
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      High Potential
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Top opportunities
                    </p>
                    <p className="text-lg font-bold text-foreground mt-2">
                      {highPotentialData?.results?.length ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Active signals
                    </p>
                  </div>
                  <Star className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Gainers (Top 3 + 24h%) */}
          <Link href="/gainers" className="block h-full">
            <Card
              className="dashboard-card neon-hover bg-gradient-to-br from-green-500/5 to-green-500/10"
              style={
                { "--neon-glow": "hsl(142, 70%, 50%)" } as React.CSSProperties
              }
            >
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      Top Gainers
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Market leaders
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-2">
                      {gainersDisplay}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      24h change
                    </p>
                  </div>
                  <Award className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Total P&L (% overall from portfolio) */}
          <Link href="/portfolio" className="block h-full">
            <Card
              className="dashboard-card neon-hover bg-gradient-to-br from-emerald-500/5 to-emerald-500/10"
              style={
                { "--neon-glow": "hsl(158, 100%, 50%)" } as React.CSSProperties
              }
            >
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      Total P&L
                    </h3>
                    <p
                      className={`text-2xl font-bold ${
                        (portfolioPnLPercent ?? 0) >= 0
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                      data-testid="text-total-pnl-percent"
                    >
                      {(portfolioPnLPercent ?? 0) >= 0 ? "+" : ""}
                      {nf2.format(portfolioPnLPercent ?? 0)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Overall performance
                    </p>
                  </div>
                  <Activity className="w-8 h-8 text-emerald-600" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Watchlist */}
          <Link href="/watchlist" className="block h-full">
            <Card
              className="dashboard-card neon-hover bg-gradient-to-br from-blue-500/5 to-blue-500/10"
              data-testid="card-watchlist"
              style={
                { "--neon-glow": "hsl(220, 100%, 60%)" } as React.CSSProperties
              }
            >
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      Watchlist
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Track favorites
                    </p>
                    <p className="text-lg font-bold text-foreground mt-2">
                      {Array.isArray(watchlist) ? watchlist.length : 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Coins tracked
                    </p>
                  </div>
                  <Eye className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Smart Alerts */}
          <Link href="/alerts" className="block h-full">
            <Card
              className="dashboard-card neon-hover bg-gradient-to-br from-orange-500/5 to-orange-500/10"
              data-testid="card-alerts"
              style={
                { "--neon-glow": "hsl(25, 100%, 55%)" } as React.CSSProperties
              }
            >
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      Smart Alerts
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Price notifications
                    </p>
                    <p className="text-lg font-bold text-foreground mt-2">
                      {watchlist
                        ? Math.min(Array.isArray(watchlist) ? watchlist.length : 0, 3)
                        : 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Active alerts</p>
                  </div>
                  <Bell className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* AI Signals */}
          <Link href="/ai-insights" className="block h-full">
            <Card
              className="dashboard-card neon-hover bg-gradient-to-br from-indigo-500/5 to-indigo-500/10"
              style={
                { "--neon-glow": "hsl(240, 100%, 70%)" } as React.CSSProperties
              }
            >
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      AI Signals
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Market analysis
                    </p>
                    <p
                      className="text-lg font-bold text-foreground mt-2"
                      data-testid="text-ai-signals"
                    >
                      {aiOverview?.signals?.length ?? 0}
                    </p>
                    <p className="text-xs text-green-500">Active insights</p>
                  </div>
                  <Brain className="w-8 h-8 text-indigo-500" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* ---------- The 3 big boxes below (restored) ---------- */}
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
                    $
                    {nf2.format(
                      prices.BTCUSDT ??
                        parseFloat((btcTicker as any)?.price || "0")
                    )}
                  </p>
                  <p
                    className={`text-sm ${
                      parseFloat(
                        (btcChange as any).priceChangePercent || "0"
                      ) >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                    data-testid="text-btc-change"
                  >
                    {parseFloat(
                      (btcChange as any).priceChangePercent || "0"
                    ) >= 0
                      ? "+"
                      : ""}
                    {nf2.format(
                      parseFloat(
                        (btcChange as any).priceChangePercent || "0"
                      )
                    )}
                    %
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">ETH/USDT</span>
                <div className="text-right">
                  <p className="font-semibold" data-testid="text-eth-price">
                    $
                    {nf2.format(
                      prices.ETHUSDT ??
                        parseFloat((ethTicker as any)?.price || "0")
                    )}
                  </p>
                  <p
                    className={`text-sm ${
                      parseFloat(
                        (ethChange as any).priceChangePercent || "0"
                      ) >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                    data-testid="text-eth-change"
                  >
                    {parseFloat(
                      (ethChange as any).priceChangePercent || "0"
                    ) >= 0
                      ? "+"
                      : ""}
                    {nf2.format(
                      parseFloat(
                        (ethChange as any).priceChangePercent || "0"
                      )
                    )}
                    %
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Market Fear &amp; Greed
                </span>
                <div className="text-right">
                  <p className="font-semibold" data-testid="text-fear-greed">
                    --
                  </p>
                  <p className="text-sm text-muted-foreground">Index</p>
                </div>
              </div>
              <div className="mt-4 flex space-x-2">
                <Link href="/portfolio">
                  <Button size="sm" data-testid="button-view-portfolio">
                    View Portfolio
                  </Button>
                </Link>
                <Link href="/charts">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="button-start-scanning"
                  >
                    Start Scanning
                  </Button>
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
                <span className="text-sm text-foreground">
                  Market sentiment: Bullish
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-foreground">
                  Technical signals detected
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span className="text-sm text-foreground">
                  Risk level: Moderate
                </span>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 mt-4">
                <p className="text-sm text-muted-foreground italic">
                  "Bitcoin showing strong support at $40k level. Consider DCA
                  strategy for next 24h."
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  AI Insight • 2 min ago
                </p>
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
                <span className="text-sm text-foreground">
                  Real-time market data from Binance
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-sm text-foreground">
                  15+ Technical indicators
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-sm text-foreground">
                  AI-powered analysis
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-foreground">
                  Smart alert system
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-foreground">
                  Portfolio P&L tracking
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
