// client/src/pages/Home.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBackendHealth } from "@/hooks/use-backend-health";
import { usePortfolioStats } from "@/hooks/usePortfolioStats";
import { usePositions } from "@/hooks/usePositions";
import AuthButton from "@/components/auth/AuthButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BtcDominanceCard from "@/components/dashboard/BtcDominanceCard";
import { getQueryFn } from "@/lib/queryClient";
import { usePrices } from "@/lib/prices";
import {
  TrendingUp,
  BarChart3,
  Search,
  Award,
  Eye,
  Bell,
  Brain,
  Activity,
  Newspaper,
} from "lucide-react";

/**
 * NOTE FOR VERCEL:
 * - This app’s frontend is deployed on Vercel, but the "/api/**" routes it tries to call
 *   are NOT present there (hence your 404s). You need a separate backend URL.
 * - Set env var VITE_API_BASE to your backend (e.g. https://api.example.com).
 * - If VITE_API_BASE is NOT set on Vercel, this page will render but skip network calls
 *   (tiles show "—/0" placeholders instead of error spam).
 * - WebSocket /ws is blocked on Vercel in your setup; we fall back to REST polling.
 */

// ---------- Types (defensive) ----------
type GainerItem = {
  symbol?: string; pair?: string; ticker?: string;
  change24h?: number | string; priceChangePercent?: number | string;
};
type AiOverviewData = {
  overallSentiment?: string;
  keyInsights?: unknown;
  tradingRecommendations?: unknown;
  riskAssessment?: string;
};
type TickerResponse = {
  price?: string | number;
  priceChangePercent?: string | number;
} & Record<string, unknown>;

// ---------- Utils ----------
const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export default function Home() {
  // SINGLE useAuth() — no duplicate signOut
  const { user } = useAuth();
  const backendStatus = useBackendHealth();
  const networkEnabled = backendStatus === true;
  const displayName = (user?.displayName?.trim() ?? user?.email ?? "Trader");
  const firstName = displayName.split(" ")[0] || displayName;

  const containerClass = "w-full max-w-full overflow-hidden px-3 sm:px-4 md:px-6 py-4";

  // ---------- Lower “Market Overview” (REST polling; WS disabled on Vercel) ----------
  const [prices, setPrices] = useState<{ BTCUSDT?: number; ETHUSDT?: number }>({});
  const [btcChange, setBtcChange] = useState<{ priceChangePercent?: string | number }>({});
  const [ethChange, setEthChange] = useState<{ priceChangePercent?: string | number }>({});

  const { data: btcTicker } = useQuery({
    queryKey: ["/api/market/ticker/BTCUSDT"],
    queryFn: getQueryFn<TickerResponse>({ on401: "throw" }),
    refetchInterval: 10_000,
    enabled: networkEnabled,
  });

  const { data: ethTicker } = useQuery({
    queryKey: ["/api/market/ticker/ETHUSDT"],
    queryFn: getQueryFn<TickerResponse>({ on401: "throw" }),
    refetchInterval: 10_000,
    enabled: networkEnabled,
  });

  useEffect(() => {
    if (btcTicker?.priceChangePercent != null) {
      setBtcChange({ priceChangePercent: btcTicker.priceChangePercent });
    }
    if (btcTicker?.price != null) setPrices((p) => ({ ...p, BTCUSDT: Number(btcTicker.price) || p.BTCUSDT }));
  }, [btcTicker]);

  useEffect(() => {
    if (ethTicker?.priceChangePercent != null) {
      setEthChange({ priceChangePercent: ethTicker.priceChangePercent });
    }
    if (ethTicker?.price != null) setPrices((p) => ({ ...p, ETHUSDT: Number(ethTicker.price) || p.ETHUSDT }));
  }, [ethTicker]);

  useEffect(() => {
    if (!networkEnabled) return;
    if (typeof window === "undefined") return;
    const apiBase = import.meta.env.VITE_API_BASE || window.location.origin;
    const wsUrl = apiBase.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "price_update") setPrices(data.data);
      } catch {}
    };
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", symbol: "BTCUSDT" }));
      ws.send(JSON.stringify({ type: "subscribe", symbol: "ETHUSDT" }));
    };
    return () => ws.close();
  }, [networkEnabled]);

  // ---------- Tiles (React Query; disabled on Vercel without API_BASE) ----------
  const { data: positionsData = [] } = usePositions({ enabled: networkEnabled && !!user });
  const { setPrices: updatePortfolioPrices } = usePrices();
  const { market: totalMarketValue, pnlPct: totalPnlPercent } = usePortfolioStats();

  const symbols = useMemo(
    () => Array.from(new Set(positionsData.map((p) => p.symbol.trim().toUpperCase()).filter(Boolean))),
    [positionsData],
  );
  const symbolsKey = symbols.join("|");

  useEffect(() => {
    if (!symbols.length) return;
    if (!networkEnabled) return;
    if (typeof window === "undefined") return;

    const apiBase = import.meta.env.VITE_API_BASE || window.location.origin;
    const wsUrl = apiBase.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);
    } catch {
      return;
    }

    ws.onopen = () => {
      symbols.forEach((symbol) => {
        try {
          ws?.send(JSON.stringify({ type: "subscribe", symbol }));
        } catch {
          // ignore send failures
        }
      });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type === "price_update" && msg?.data && typeof msg.data === "object") {
          const updates: Record<string, number> = {};
          for (const [rawSymbol, rawPrice] of Object.entries(msg.data)) {
            const numeric = Number(rawPrice);
            if (Number.isFinite(numeric)) {
              updates[String(rawSymbol).toUpperCase()] = numeric;
            }
          }
          if (Object.keys(updates).length > 0) {
            updatePortfolioPrices(updates);
          }
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        try {
          ws.close();
        } catch {
          // ignore close errors
        }
      }
    };
  }, [networkEnabled, updatePortfolioPrices, symbols, symbolsKey]);

  const safeTotalValue = Number.isFinite(totalMarketValue) ? totalMarketValue : 0;
  const safeTotalPnlPercent = Number.isFinite(totalPnlPercent) ? totalPnlPercent : 0;

  const { data: gain } = useQuery({
    queryKey: ["/api/market/gainers"],
    queryFn: getQueryFn<GainerItem[] | null>({ on401: "returnNull" }),
    select: (arr) => {
      if (!Array.isArray(arr)) return { top: null, ts: Date.now() };

      const mapped = arr
        .map((g) => {
          const sym = (g.symbol || g.pair || g.ticker || "").toString().toUpperCase();
          const pct = toNum(g.change24h) ?? toNum(g.priceChangePercent);
          if (!sym || pct === null) return null;
          return { symbol: sym, pct };
        })
        .filter(Boolean) as { symbol: string; pct: number }[];

      mapped.sort((a, b) => b.pct - a.pct);
      return { top: mapped.slice(0, 3), ts: Date.now() };
    },
    refetchInterval: 300_000,
    enabled: networkEnabled,
  });

  const { data: watchCount } = useQuery({
    queryKey: ["/api/watchlist", !!user],
    queryFn: getQueryFn<unknown>({ on401: "returnNull" }),
    select: (wl) => {
      if (Array.isArray(wl)) return wl.length;
      return null;
    },
    refetchInterval: 300_000,
    enabled: networkEnabled && !!user,
  });

  const { data: aiCount } = useQuery({
    queryKey: ["/api/ai/market-overview"],
    queryFn: getQueryFn<AiOverviewData | null>({ on401: "returnNull" }),
    select: (ai) => {
      if (!ai) return null;

      const keyInsights = Array.isArray(ai.keyInsights)
        ? ai.keyInsights.filter((insight) => typeof insight === "string" && insight.trim() !== "")
        : null;
      if (keyInsights && keyInsights.length > 0) return keyInsights.length;

      const recs = Array.isArray(ai.tradingRecommendations)
        ? ai.tradingRecommendations.filter((rec) => typeof rec === "string" && rec.trim() !== "")
        : null;
      if (recs && recs.length > 0) return recs.length;

      return null;
    },
    refetchInterval: 120_000,
    enabled: networkEnabled,
  });

  // ---------- Displays ----------
  const portfolioValueDisplay = `$${nf2.format(safeTotalValue)}`;
  const portfolioPctDisplay = `${safeTotalPnlPercent >= 0 ? "+" : ""}${nf2.format(safeTotalPnlPercent)}%`;
  const pctColorClass = safeTotalPnlPercent >= 0 ? "text-green-500" : "text-red-500";

  const top3 = gain?.top ?? null;
  const gainersDisplay =
    !top3 || top3.length === 0
      ? "—"
      : top3.map((g) => `${g.symbol} ${g.pct >= 0 ? "+" : ""}${nf2.format(g.pct)}%`).join(" · ");
  const gainRefreshed = gain?.ts ? new Date(gain.ts).toLocaleTimeString() : "—";

  const watchDisplay = watchCount == null || Number.isNaN(watchCount) ? "—" : nf0.format(watchCount);
  const aiDisplay = aiCount == null || Number.isNaN(aiCount) ? "—" : nf0.format(aiCount);

  return (
    <div className="flex-1 overflow-hidden">
      <div className="p-3 sm:p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground break-words">
              Welcome back, {firstName}!
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">Your trading dashboard is ready. Let's make some profitable trades today.</p>
          </div>
          <div className="flex-shrink-0">
            <AuthButton size="sm" />
          </div>
        </div>

        {/* 8 Tiles */}
        <div className="grid items-stretch grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 md:mb-8">
          {/* 1) Portfolio */}
          <Link to="/portfolio" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-primary/5 to-primary/10" style={{ "--neon-glow": "hsl(195, 100%, 60%)" } as React.CSSProperties}>
              <CardContent className="p-3 sm:p-4 md:p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground text-xs sm:text-sm mb-0.5">Portfolio</h3>
                    <p className="text-base sm:text-lg md:text-2xl font-bold text-foreground truncate" data-testid="text-portfolio-value">{portfolioValueDisplay}</p>
                    <div className="flex items-center space-x-1 mt-0.5">
                      <TrendingUp className={`w-3 h-3 ${pctColorClass}`} />
                      <span className={`text-xs ${pctColorClass}`} data-testid="text-portfolio-change">
                        {portfolioPctDisplay}
                      </span>
                    </div>
                  </div>
                  <BarChart3 className="w-6 sm:w-8 h-6 sm:h-8 text-primary flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* 2) Scanner */}
          <Link to="/analyse/BTCUSDT" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-accent/5 to-accent/10" style={{ "--neon-glow": "hsl(158, 100%, 50%)" } as React.CSSProperties}>
              <CardContent className="p-3 sm:p-4 md:p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground text-xs sm:text-sm mb-0.5">Scanner</h3>
                    <p className="text-xs text-muted-foreground truncate">Technical analysis</p>
                    <p className="text-sm sm:text-lg font-bold text-foreground mt-0.5">15+</p>
                    <p className="text-xs text-muted-foreground">Indicators</p>
                  </div>
                  <Search className="w-6 sm:w-8 h-6 sm:h-8 text-accent flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* 3) Gainers */}
          <Link to="/gainers" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-green-500/5 to-green-500/10" style={{ "--neon-glow": "hsl(142, 70%, 50%)" } as React.CSSProperties}>
              <CardContent className="p-3 sm:p-4 md:p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground text-xs sm:text-sm mb-0.5">Top Gainers</h3>
                    <p className="text-xs text-muted-foreground truncate">Market leaders</p>
                    <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{gainersDisplay}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">24h change</p>
                    <p className="text-[8px] text-muted-foreground mt-0.5 truncate">Last updated {gainRefreshed}</p>
                  </div>
                  <Award className="w-6 sm:w-8 h-6 sm:h-8 text-green-500 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* 4) Total P&L */}
          <Link to="/portfolio" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-emerald-500/5 to-emerald-500/10" style={{ "--neon-glow": "hsl(158, 100%, 50%)" } as React.CSSProperties}>
              <CardContent className="p-3 sm:p-4 md:p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground text-xs sm:text-sm mb-0.5">Total P&L</h3>
                    <p className={`text-base sm:text-lg md:text-2xl font-bold ${pctColorClass} truncate`} data-testid="text-total-pnl-percent">
                      {portfolioPctDisplay}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Overall performance</p>
                  </div>
                  <Activity className="w-6 sm:w-8 h-6 sm:h-8 text-emerald-600 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* 5) Watchlist */}
          <Link to="/watchlist" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-blue-500/5 to-blue-500/10" data-testid="card-watchlist" style={{ "--neon-glow": "hsl(220, 100%, 60%)" } as React.CSSProperties}>
              <CardContent className="p-3 sm:p-4 md:p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground text-xs sm:text-sm mb-0.5">Watchlist</h3>
                    <p className="text-xs text-muted-foreground truncate">Track favorites</p>
                    <p className="text-sm sm:text-lg font-bold text-foreground mt-0.5">{watchDisplay}</p>
                    <p className="text-xs text-muted-foreground">Coins tracked</p>
                  </div>
                  <Eye className="w-6 sm:w-8 h-6 sm:h-8 text-blue-500 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* 6) Smart Alerts */}
          <Link to="/alerts" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-orange-500/5 to-orange-500/10" data-testid="card-alerts" style={{ "--neon-glow": "hsl(25, 100%, 55%)" } as React.CSSProperties}>
              <CardContent className="p-3 sm:p-4 md:p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground text-xs sm:text-sm mb-0.5">Smart Alerts</h3>
                    <p className="text-xs text-muted-foreground truncate">Price notifications</p>
                    <p className="text-sm sm:text-lg font-bold text-foreground mt-0.5">{watchCount ? Math.min(watchCount, 3) : 0}</p>
                    <p className="text-xs text-muted-foreground">Active alerts</p>
                  </div>
                  <Bell className="w-6 sm:w-8 h-6 sm:h-8 text-orange-500 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>

        {/* 7) AI Signals */}
        <Link to="/ai-insights" className="block h-full">
          <Card className="dashboard-card neon-hover bg-gradient-to-br from-indigo-500/5 to-indigo-500/10" style={{ "--neon-glow": "hsl(240, 100%, 70%)" } as React.CSSProperties}>
            <CardContent className="p-3 sm:p-4 md:p-6 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground text-xs sm:text-sm mb-0.5">AI Signals</h3>
                  <p className="text-xs text-muted-foreground truncate">Market analysis</p>
                  <p className="text-sm sm:text-lg font-bold text-foreground mt-0.5" data-testid="text-ai-signals">{aiDisplay}</p>
                  <p className="text-xs text-green-500">Active insights</p>
                </div>
                <Brain className="w-6 sm:w-8 h-6 sm:h-8 text-indigo-500 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <BtcDominanceCard />

        {/* 8) News & Insights */}
        <Link to="/news" className="block h-full xl:col-span-2">
          <Card className="dashboard-card neon-hover" style={{ "--neon-glow": "hsl(195, 100%, 60%)" } as React.CSSProperties}>
            <CardContent className="p-3 sm:p-4 md:p-6 h-full flex flex-col justify-between space-y-2 sm:space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">News &amp; Insights</h3>
                  <p className="text-sm text-muted-foreground">
                    Curated market headlines and analyst takes to keep you ahead of the next move.
                  </p>
                </div>
                <Newspaper className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center justify-between text-foreground">
                  <span className="font-medium">Morning Brief</span>
                  <span className="text-xs text-muted-foreground">Updated 10 min ago</span>
                </p>
                <p>US equities rally as inflation cools; crypto follows with strong altcoin bids.</p>
                <p className="text-xs text-primary mt-2 font-medium">Click to read latest →</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        </div>

        {/* The 3 big boxes below */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:gap-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex min-w-0 items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Market Overview</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">BTC/USDT</span>
                <div className="text-right">
                  <p className="font-semibold" data-testid="text-btc-price">
                    ${nf2.format(prices.BTCUSDT ?? parseFloat((btcTicker as any)?.price || "0"))}
                  </p>
                  <p className={`text-sm ${parseFloat((btcChange as any)?.priceChangePercent || "0") >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-btc-change">
                    {parseFloat((btcChange as any)?.priceChangePercent || "0") >= 0 ? "+" : ""}
                    {nf2.format(parseFloat((btcChange as any)?.priceChangePercent || "0"))}%
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">ETH/USDT</span>
                <div className="text-right">
                  <p className="font-semibold" data-testid="text-eth-price">
                    ${nf2.format(prices.ETHUSDT ?? parseFloat((ethTicker as any)?.price || "0"))}
                  </p>
                  <p className={`text-sm ${parseFloat((ethChange as any)?.priceChangePercent || "0") >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-eth-change">
                    {parseFloat((ethChange as any)?.priceChangePercent || "0") >= 0 ? "+" : ""}
                    {nf2.format(parseFloat((ethChange as any)?.priceChangePercent || "0"))}%
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Market Fear &amp; Greed</span>
                <div className="text-right">
                  <p className="font-semibold" data-testid="text-fear-greed">--</p>
                  <p className="text-sm text-muted-foreground">Index</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <Button asChild size="sm" className="min-h-[44px]" data-testid="button-view-portfolio">
                  <Link to="/portfolio">View Portfolio</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="min-h-[44px]" data-testid="button-start-scanning">
                  <Link to="/analyse/BTCUSDT">Start Scanning</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex min-w-0 items-center space-x-2">
                <Brain className="w-5 h-5 text-purple-500" />
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">AI Trading Assistant</span>
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
            <CardHeader><CardTitle>Trading Features</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3"><div className="w-2 h-2 bg-accent rounded-full"></div><span className="text-sm text-foreground">Real-time market data from Binance</span></div>
              <div className="flex items-center space-x-3"><div className="w-2 h-2 bg-primary rounded-full"></div><span className="text-sm text-foreground">15+ Technical indicators</span></div>
              <div className="flex items-center space-x-3"><div className="w-2 h-2 bg-purple-500 rounded-full"></div><span className="text-sm text-foreground">AI-powered analysis</span></div>
              <div className="flex items-center space-x-3"><div className="w-2 h-2 bg-green-500 rounded-full"></div><span className="text-sm text-foreground">Smart alert system</span></div>
              <div className="flex items-center space-x-3"><div className="w-2 h-2 bg-blue-500 rounded-full"></div><span className="text-sm text-foreground">Portfolio P&L tracking</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
