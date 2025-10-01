// client/src/pages/Home.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3, Search, Star, Award, Eye, Bell, Brain, Activity } from "lucide-react";

/* ---------------- Types (defensive) ---------------- */
type PortfolioSummary = { totalValue?: number | string; totalPnlPercent?: number | string };
type PortfolioPosition = {
  symbol?: string;
  qty?: number | string;
  entryPrice?: number | string;
  entry?: number | string;
  livePrice?: number | string;
  live?: number | string;
  [k: string]: any;
};
type GainerItem = {
  symbol?: string; pair?: string; ticker?: string;
  change24h?: number | string; priceChangePercent?: number | string;
};
type AiOverviewData = { signals?: any[] };

const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/* ---------------- Helpers ---------------- */
function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
async function safeJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* ---- Query FNs (use the same data sources pages use, with fallbacks) ---- */
async function qPortfolioSummary(): Promise<{ totalValue: number | null; totalPnlPercent: number | null }> {
  // Prefer summary endpoint
  const s = await safeJson<PortfolioSummary>("/api/portfolio/summary");
  const sv = toNum(s?.totalValue ?? null);
  const sp = toNum(s?.totalPnlPercent ?? null);
  if (sv !== null || sp !== null) return { totalValue: sv ?? null, totalPnlPercent: sp ?? null };

  // Fallback: compute from positions
  const list = await safeJson<PortfolioPosition[]>("/api/portfolio");
  if (!Array.isArray(list)) return { totalValue: null, totalPnlPercent: null };

  let totalValue = 0;
  let totalCost = 0;
  for (const p of list) {
    const qty = toNum(p.qty) ?? 0;
    const entry = toNum(p.entryPrice ?? p.entry) ?? 0;
    const live = toNum(p.livePrice ?? p.live) ?? 0;
    if (qty > 0) {
      if (live > 0) totalValue += qty * live;
      if (entry > 0) totalCost += qty * entry;
    }
  }
  const pct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : null;
  return {
    totalValue: Number.isFinite(totalValue) ? totalValue : null,
    totalPnlPercent: pct !== null && Number.isFinite(pct) ? pct : null,
  };
}

async function qHighPotentialCount(): Promise<{ count: number | null; ts: number }> {
  // Try POST (like your page action)
  const post = await safeJson<any>("/api/scanner/high-potential", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (post && Array.isArray(post.results)) return { count: post.results.length, ts: Date.now() };

  // Fallback GET array
  const arr = await safeJson<any[]>("/api/scanner/high-potential");
  if (Array.isArray(arr)) return { count: arr.length, ts: Date.now() };

  // Fallback GET object with results
  const obj = await safeJson<any>("/api/scanner/high-potential");
  if (obj && Array.isArray(obj.results)) return { count: obj.results.length, ts: Date.now() };

  return { count: null, ts: Date.now() };
}

async function qGainersTop3(): Promise<{ top: { symbol: string; pct: number }[] | null; ts: number }> {
  const arr = await safeJson<GainerItem[]>("/api/market/gainers");
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
}

async function qWatchlistCount(): Promise<number | null> {
  const wl = await safeJson<any[]>("/api/watchlist");
  if (Array.isArray(wl)) return wl.length;
  return null;
}

async function qAiSignals(): Promise<number | null> {
  const ai = await safeJson<AiOverviewData>("/api/ai/market-overview");
  if (ai && Array.isArray(ai.signals)) return ai.signals.length;
  return null;
}

export default function Home() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const displayName = (user?.displayName?.trim() ?? user?.email ?? "Trader");
  const firstName = displayName.split(" ")[0] || displayName;

  /* --------- Lower “Market Overview” live tickers (unchanged) --------- */
  const [prices, setPrices] = useState<{ BTCUSDT?: number; ETHUSDT?: number }>({});
  const [btcChange, setBtcChange] = useState<{ priceChangePercent?: string }>({});
  const [ethChange, setEthChange] = useState<{ priceChangePercent?: string }>({});

  const { data: btcTicker } = useQuery({ queryKey: ["/api/market/ticker/BTCUSDT"], refetchInterval: 10_000 });
  const { data: ethTicker } = useQuery({ queryKey: ["/api/market/ticker/ETHUSDT"], refetchInterval: 10_000 });

  useEffect(() => { if (btcTicker) setBtcChange(btcTicker as any); }, [btcTicker]);
  useEffect(() => { if (ethTicker) setEthChange(ethTicker as any); }, [ethTicker]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "price_update") setPrices(data.data);
      } catch (_) {}
    };
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", symbol: "BTCUSDT" }));
      ws.send(JSON.stringify({ type: "subscribe", symbol: "ETHUSDT" }));
    };
    return () => ws.close();
  }, []);

  /* --------- Tiles’ data (React Query with robust queryFns) --------- */
  const { data: port, refetch: refetchPortfolio } = useQuery({
    queryKey: ["portfolio-summary"],
    queryFn: qPortfolioSummary,
    refetchInterval: 120_000, // 2 min
  });

  const { data: hp, refetch: refetchHP } = useQuery({
    queryKey: ["high-potential-count"],
    queryFn: qHighPotentialCount,
    refetchInterval: 30 * 60 * 1000, // 30 min
    enabled: !!user,
  });

  const { data: gain, refetch: refetchGainers } = useQuery({
    queryKey: ["gainers-top3"],
    queryFn: qGainersTop3,
    refetchInterval: 300_000, // 5 min
  });

  const { data: watchCount, refetch: refetchWatch } = useQuery({
    queryKey: ["watchlist-count"],
    queryFn: qWatchlistCount,
    refetchInterval: 300_000, // 5 min
    enabled: !!user,
  });

  const { data: aiCount, refetch: refetchAi } = useQuery({
    queryKey: ["ai-signals-count"],
    queryFn: qAiSignals,
    refetchInterval: 120_000, // 2 min
  });

  // Displays
  const portfolioValueDisplay = port?.totalValue == null ? "$0.00" : `$${nf2.format(port?.totalValue ?? 0)}`;
  const portfolioPctDisplay =
    port?.totalPnlPercent == null ? "+0.00%" : `${(port?.totalPnlPercent ?? 0) >= 0 ? "+" : ""}${nf2.format(port?.totalPnlPercent ?? 0)}%`;

  const hpDisplay = hp?.count == null ? "—" : nf0.format(hp.count);
  const hpRefreshed = hp?.ts ? new Date(hp.ts).toLocaleTimeString() : "";

  const top3 = gain?.top ?? null;
  const gainersDisplay = !top3 || top3.length === 0
    ? "—"
    : top3.map((g) => `${g.symbol} ${g.pct >= 0 ? "+" : ""}${nf2.format(g.pct)}%`).join(" · ");
  const gainRefreshed = gain?.ts ? new Date(gain.ts).toLocaleTimeString() : "";

  const watchDisplay = watchCount == null ? "—" : nf0.format(watchCount);
  const aiDisplay = aiCount == null ? "—" : nf0.format(aiCount);

  const handleLogin = async () => { try { await signInWithGoogle(); } catch (e) { console.error(e); } };
  const handleLogout = async () => { try { await signOut(); } catch (e) { console.error(e); } };

  return (
    <div className="flex-1 overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Welcome back, {firstName}!</h1>
            <p className="text-muted-foreground mt-1">Your trading dashboard is ready. Let's make some profitable trades today.</p>
          </div>
          {user ? (
            <Button variant="outline" onClick={handleLogout} data-testid="button-logout">Sign Out</Button>
          ) : (
            <Button variant="outline" onClick={handleLogin} data-testid="button-login">Sign In</Button>
          )}
        </div>

        {/* 8 Tiles */}
        <div className="grid items-stretch grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
          {/* 1) Portfolio */}
          <Link href="/portfolio" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-primary/5 to-primary/10" style={{ "--neon-glow": "hsl(195, 100%, 60%)" } as React.CSSProperties}>
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Portfolio</h3>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-portfolio-value">{portfolioValueDisplay}</p>
                    <div className="flex items-center space-x-1 mt-1">
                      <TrendingUp className={`w-3 h-3 ${(port?.totalPnlPercent ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`} />
                      <span className={`text-xs ${(port?.totalPnlPercent ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-portfolio-change">
                        {portfolioPctDisplay}
                      </span>
                    </div>
                  </div>
                  <BarChart3 className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* 2) Scanner */}
          <Link href="/charts" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-accent/5 to-accent/10" style={{ "--neon-glow": "hsl(158, 100%, 50%)" } as React.CSSProperties}>
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

          {/* 3) High Potential */}
          <Link href="/high-potential" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-red-500/5 to-red-500/10" style={{ "--neon-glow": "hsl(0, 80%, 60%)" } as React.CSSProperties}>
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">High Potential</h3>
                    <p className="text-sm text-muted-foreground">Top opportunities</p>
                    <p className="text-lg font-bold text-foreground mt-2">{hpDisplay}</p>
                    <p className="text-xs text-muted-foreground">Active signals</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Last updated {hpRefreshed || "—"}</p>
                  </div>
                  <Star className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* 4) Gainers */}
          <Link href="/gainers" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-green-500/5 to-green-500/10" style={{ "--neon-glow": "hsl(142, 70%, 50%)" } as React.CSSProperties}>
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Top Gainers</h3>
                    <p className="text-sm text-muted-foreground">Market leaders</p>
                    <p className="text-sm font-semibold text-foreground mt-2">{gainersDisplay}</p>
                    <p className="text-xs text-muted-foreground mt-1">24h change</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Last updated {gainRefreshed || "—"}</p>
                  </div>
                  <Award className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* 5) Total P&L */}
          <Link href="/portfolio" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-emerald-500/5 to-emerald-500/10" style={{ "--neon-glow": "hsl(158, 100%, 50%)" } as React.CSSProperties}>
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Total P&L</h3>
                    <p className={`text-2xl font-bold ${(port?.totalPnlPercent ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-total-pnl-percent">
                      {portfolioPctDisplay}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Overall performance</p>
                  </div>
                  <Activity className="w-8 h-8 text-emerald-600" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* 6) Watchlist */}
          <Link href="/watchlist" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-blue-500/5 to-blue-500/10" data-testid="card-watchlist" style={{ "--neon-glow": "hsl(220, 100%, 60%)" } as React.CSSProperties}>
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Watchlist</h3>
                    <p className="text-sm text-muted-foreground">Track favorites</p>
                    <p className="text-lg font-bold text-foreground mt-2">{watchDisplay}</p>
                    <p className="text-xs text-muted-foreground">Coins tracked</p>
                  </div>
                  <Eye className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* 7) Smart Alerts */}
          <Link href="/alerts" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-orange-500/5 to-orange-500/10" data-testid="card-alerts" style={{ "--neon-glow": "hsl(25, 100%, 55%)" } as React.CSSProperties}>
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Smart Alerts</h3>
                    <p className="text-sm text-muted-foreground">Price notifications</p>
                    <p className="text-lg font-bold text-foreground mt-2">{watchCount ? Math.min(watchCount, 3) : 0}</p>
                    <p className="text-xs text-muted-foreground">Active alerts</p>
                  </div>
                  <Bell className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* 8) AI Signals */}
          <Link href="/ai-insights" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-indigo-500/5 to-indigo-500/10" style={{ "--neon-glow": "hsl(240, 100%, 70%)" } as React.CSSProperties}>
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">AI Signals</h3>
                    <p className="text-sm text-muted-foreground">Market analysis</p>
                    <p className="text-lg font-bold text-foreground mt-2" data-testid="text-ai-signals">{aiDisplay}</p>
                    <p className="text-xs text-green-500">Active insights</p>
                  </div>
                  <Brain className="w-8 h-8 text-indigo-500" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Three big boxes below (restored) */}
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
                    ${nf2.format(prices.BTCUSDT ?? parseFloat((btcTicker as any)?.price || "0"))}
                  </p>
                  <p className={`text-sm ${parseFloat((btcChange as any).priceChangePercent || "0") >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-btc-change">
                    {parseFloat((btcChange as any).priceChangePercent || "0") >= 0 ? "+" : ""}
                    {nf2.format(parseFloat((btcChange as any).priceChangePercent || "0"))}%
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">ETH/USDT</span>
                <div className="text-right">
                  <p className="font-semibold" data-testid="text-eth-price">
                    ${nf2.format(prices.ETHUSDT ?? parseFloat((ethTicker as any)?.price || "0"))}
                  </p>
                  <p className={`text-sm ${parseFloat((ethChange as any).priceChangePercent || "0") >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-eth-change">
                    {parseFloat((ethChange as any).priceChangePercent || "0") >= 0 ? "+" : ""}
                    {nf2.format(parseFloat((ethChange as any).priceChangePercent || "0"))}%
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
              <div className="mt-4 flex space-x-2">
                <Link href="/portfolio"><Button size="sm" data-testid="button-view-portfolio">View Portfolio</Button></Link>
                <Link href="/charts"><Button size="sm" variant="outline" data-testid="button-start-scanning">Start Scanning</Button></Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader><CardTitle className="flex items-center space-x-2"><Brain className="w-5 h-5 text-purple-500" /><span>AI Trading Assistant</span></CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3"><div className="w-2 h-2 bg-green-500 rounded-full"></div><span className="text-sm text-foreground">Market sentiment: Bullish</span></div>
              <div className="flex items-center space-x-3"><div className="w-2 h-2 bg-blue-500 rounded-full"></div><span className="text-sm text-foreground">Technical signals detected</span></div>
              <div className="flex items-center space-x-3"><div className="w-2 h-2 bg-orange-500 rounded-full"></div><span className="text-sm text-foreground">Risk level: Moderate</span></div>
              <div className="bg-muted/50 rounded-lg p-3 mt-4">
                <p className="text-sm text-muted-foreground italic">"Bitcoin showing strong support at $40k level. Consider DCA strategy for next 24h."</p>
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
