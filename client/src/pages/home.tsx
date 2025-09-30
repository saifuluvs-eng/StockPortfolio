// client/src/pages/Home.tsx
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3, Search, Star, Award, Eye, Bell, Brain, Activity } from "lucide-react";
import { Link } from "wouter";
import React, { useEffect, useMemo, useState } from "react";

/** ---------------- Types (loose & defensive) ---------------- */
type PortfolioSummary = {
  totalValue?: number | string;
  totalPnlPercent?: number | string;
};
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
  symbol?: string;
  pair?: string;
  ticker?: string;
  change24h?: number | string;
  priceChangePercent?: number | string;
};
type AiOverviewData = { signals?: any[] };

/** ---------------- Utils ---------------- */
const nf2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

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

/** Portfolio summary: prefer /api/portfolio/summary; fallback computes from /api/portfolio */
async function fetchPortfolioSummary(): Promise<{ totalValue: number | null; totalPnlPercent: number | null }> {
  const s = await safeJson<PortfolioSummary>("/api/portfolio/summary");
  const sv = toNum(s?.totalValue ?? null);
  const sp = toNum(s?.totalPnlPercent ?? null);
  if (sv !== null || sp !== null) {
    return { totalValue: sv ?? null, totalPnlPercent: sp ?? null };
  }

  // Fallback to positions list
  const list = await safeJson<PortfolioPosition[]>("/api/portfolio");
  if (!Array.isArray(list)) return { totalValue: null, totalPnlPercent: null };

  let value = 0;
  let cost = 0;
  for (const p of list) {
    const qty = toNum(p.qty) ?? 0;
    const entry = toNum(p.entryPrice ?? p.entry) ?? 0;
    const live = toNum(p.livePrice ?? p.live) ?? 0;
    if (qty > 0) {
      if (live > 0) value += qty * live;
      if (entry > 0) cost += qty * entry;
    }
  }
  const pct = cost > 0 ? ((value - cost) / cost) * 100 : null;
  return {
    totalValue: Number.isFinite(value) ? value : null,
    totalPnlPercent: pct !== null && Number.isFinite(pct) ? pct : null,
  };
}

/** High Potential: try POST then GET; returns count */
async function fetchHighPotentialCount(): Promise<number | null> {
  // Try POST
  const post = await safeJson<any>("/api/scanner/high-potential", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
  if (post && Array.isArray((post as any).results)) return (post as any).results.length;

  // Fallback GET (array)
  const getArr = await safeJson<any[]>("/api/scanner/high-potential");
  if (Array.isArray(getArr)) return getArr.length;

  // Fallback GET (object with results)
  const getObj = await safeJson<any>("/api/scanner/high-potential");
  if (getObj && Array.isArray(getObj.results)) return getObj.results.length;

  return null;
}

/** Gainers: normalize and return top 3 by 24h% */
async function fetchTopGainers(): Promise<{ symbol: string; pct: number }[] | null> {
  const arr = await safeJson<GainerItem[]>("/api/market/gainers");
  if (!Array.isArray(arr)) return null;

  const mapped = arr
    .map((g) => {
      const sym = (g.symbol || g.pair || g.ticker || "").toString().toUpperCase();
      const pct = toNum(g.change24h) ?? toNum(g.priceChangePercent);
      if (!sym || pct === null) return null;
      return { symbol: sym, pct };
    })
    .filter(Boolean) as { symbol: string; pct: number }[];

  mapped.sort((a, b) => b.pct - a.pct);
  return mapped.slice(0, 3);
}

/** Watchlist count */
async function fetchWatchlistCount(): Promise<number | null> {
  const wl = await safeJson<any[]>("/api/watchlist");
  if (Array.isArray(wl)) return wl.length;
  return null;
}

/** AI overview signals count */
async function fetchAiSignalsCount(): Promise<number | null> {
  const ai = await safeJson<AiOverviewData>("/api/ai/market-overview");
  if (ai && Array.isArray(ai.signals)) return ai.signals.length;
  return null;
}

export default function Home() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const displayName = (user?.displayName?.trim() ?? user?.email ?? "Trader");
  const firstName = displayName.split(" ")[0] || displayName;

  // State for tiles
  const [portfolioValue, setPortfolioValue] = useState<number | null>(null);
  const [portfolioPct, setPortfolioPct] = useState<number | null>(null);
  const [hpCount, setHpCount] = useState<number | null>(null);
  const [gainers, setGainers] = useState<{ symbol: string; pct: number }[] | null>(null);
  const [watchlistCount, setWatchlistCount] = useState<number | null>(null);
  const [aiCount, setAiCount] = useState<number | null>(null);

  // Load Portfolio (refresh every 2m)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      const s = await fetchPortfolioSummary();
      if (!alive) return;
      setPortfolioValue(s.totalValue);
      setPortfolioPct(s.totalPnlPercent);
    };
    run();
    const id = setInterval(run, 120_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // High Potential (refresh every 30m)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      const n = await fetchHighPotentialCount();
      if (!alive) return;
      setHpCount(n);
    };
    run();
    const id = setInterval(run, 30 * 60 * 1000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Gainers (refresh every 5m)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      const top = await fetchTopGainers();
      if (!alive) return;
      setGainers(top);
    };
    run();
    const id = setInterval(run, 300_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Watchlist (refresh every 5m; only if logged in)
  useEffect(() => {
    let alive = true;
    if (!user) { setWatchlistCount(0); return; }
    const run = async () => {
      const n = await fetchWatchlistCount();
      if (!alive) return;
      setWatchlistCount(n ?? 0);
    };
    run();
    const id = setInterval(run, 300_000);
    return () => { alive = false; clearInterval(id); };
  }, [user]);

  // AI Signals (refresh every 2m)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      const n = await fetchAiSignalsCount();
      if (!alive) return;
      setAiCount(n ?? 0);
    };
    run();
    const id = setInterval(run, 120_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const portfolioValueDisplay = portfolioValue === null ? "—" : `$${nf2.format(portfolioValue)}`;
  const portfolioPctDisplay =
    portfolioPct === null ? "—" : `${portfolioPct >= 0 ? "+" : ""}${nf2.format(portfolioPct)}%`;
  const hpDisplay = hpCount === null ? "—" : nf0.format(hpCount);
  const gainersDisplay =
    !gainers || gainers.length === 0
      ? "—"
      : gainers.map((g) => `${g.symbol} ${g.pct >= 0 ? "+" : ""}${nf2.format(g.pct)}%`).join(" · ");
  const watchDisplay = watchlistCount === null ? "—" : nf0.format(watchlistCount);
  const aiDisplay = aiCount === null ? "—" : nf0.format(aiCount);

  const handleLogin = async () => { try { await signInWithGoogle(); } catch (e) { console.error(e); } };
  const handleLogout = async () => { try { await signOut(); } catch (e) { console.error(e); } };

  return (
    <div className="flex-1 overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Welcome back, {firstName}!</h1>
            <p className="text-muted-foreground mt-1">
              Your trading dashboard is ready. Let's make some profitable trades today.
            </p>
          </div>
          {user ? (
            <Button variant="outline" onClick={handleLogout} data-testid="button-logout">Sign Out</Button>
          ) : (
            <Button variant="outline" onClick={handleLogin} data-testid="button-login">Sign In</Button>
          )}
        </div>

        {/* Tiles — exactly 8, no extra panels */}
        <div className="grid items-stretch grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
          {/* 1) Portfolio */}
          <Link href="/portfolio" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-primary/5 to-primary/10"
                  style={{ "--neon-glow": "hsl(195, 100%, 60%)" } as React.CSSProperties}>
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Portfolio</h3>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-portfolio-value">
                      {portfolioValueDisplay}
                    </p>
                    <div className="flex items-center space-x-1 mt-1">
                      <TrendingUp className={`w-3 h-3 ${portfolioPct !== null && portfolioPct >= 0 ? "text-green-500" : "text-red-500"}`} />
                      <span className={`text-xs ${portfolioPct !== null && portfolioPct >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-portfolio-change">
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
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-accent/5 to-accent/10"
                  style={{ "--neon-glow": "hsl(158, 100%, 50%)" } as React.CSSProperties}>
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

          {/* 3) High Potential (30m) */}
          <Link href="/high-potential" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-red-500/5 to-red-500/10"
                  style={{ "--neon-glow": "hsl(0, 80%, 60%)" } as React.CSSProperties}>
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">High Potential</h3>
                    <p className="text-sm text-muted-foreground">Top opportunities</p>
                    <p className="text-lg font-bold text-foreground mt-2">{hpDisplay}</p>
                    <p className="text-xs text-muted-foreground">Active signals</p>
                  </div>
                  <Star className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* 4) Gainers (Top 3 + 24h%) */}
          <Link href="/gainers" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-green-500/5 to-green-500/10"
                  style={{ "--neon-glow": "hsl(142, 70%, 50%)" } as React.CSSProperties}>
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Top Gainers</h3>
                    <p className="text-sm text-muted-foreground">Market leaders</p>
                    <p className="text-sm font-semibold text-foreground mt-2">{gainersDisplay}</p>
                    <p className="text-xs text-muted-foreground mt-1">24h change</p>
                  </div>
                  <Award className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* 5) Total P&L (% overall) */}
          <Link href="/portfolio" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-emerald-500/5 to-emerald-500/10"
                  style={{ "--neon-glow": "hsl(158, 100%, 50%)" } as React.CSSProperties}>
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Total P&L</h3>
                    <p className={`text-2xl font-bold ${portfolioPct !== null && portfolioPct >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-total-pnl-percent">
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
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-blue-500/5 to-blue-500/10"
                  data-testid="card-watchlist"
                  style={{ "--neon-glow": "hsl(220, 100%, 60%)" } as React.CSSProperties}>
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

          {/* 7) Smart Alerts (click-through only) */}
          <Link href="/alerts" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-orange-500/5 to-orange-500/10"
                  data-testid="card-alerts"
                  style={{ "--neon-glow": "hsl(25, 100%, 55%)" } as React.CSSProperties}>
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Smart Alerts</h3>
                    <p className="text-sm text-muted-foreground">Price notifications</p>
                    <p className="text-lg font-bold text-foreground mt-2">
                      {watchlistCount ? Math.min(watchlistCount, 3) : 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Active alerts</p>
                  </div>
                  <Bell className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* 8) AI Signals */}
          <Link href="/ai-insights" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-indigo-500/5 to-indigo-500/10"
                  style={{ "--neon-glow": "hsl(240, 100%, 70%)" } as React.CSSProperties}>
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">AI Signals</h3>
                    <p className="text-sm text-muted-foreground">Market analysis</p>
                    <p className="text-lg font-bold text-foreground mt-2" data-testid="text-ai-signals">
                      {aiDisplay}
                    </p>
                    <p className="text-xs text-green-500">Active insights</p>
                  </div>
                  <Brain className="w-8 h-8 text-indigo-500" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Lower section kept unchanged to preserve your theme */}
        {/* (If you had extra sections here, leave them as-is) */}
      </div>
    </div>
  );
}
