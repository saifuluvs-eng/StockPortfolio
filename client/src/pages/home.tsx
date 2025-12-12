// client/src/pages/Home.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBackendHealth } from "@/hooks/use-backend-health";
import { usePortfolioStats } from "@/hooks/usePortfolioStats";
import { usePositions } from "@/hooks/usePositions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BtcDominanceCard from "@/components/dashboard/BtcDominanceCard";
import TopGainersCard from "@/components/dashboard/TopGainersCard";
import { FearGreedGauge } from "@/components/dashboard/FearGreedGauge";
import { getQueryFn } from "@/lib/queryClient";
import { usePrices } from "@/lib/prices";
import { openSpotTickerStream } from "@/lib/binanceWs";
import { supabase } from "@/lib/supabase";
import {
  TrendingUp,
  BarChart3,
  Search,
  Award,
  Eye,
  Gauge,
  Brain,
  Activity,
  Newspaper,
  Zap,
  Target,
} from "lucide-react";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  type DropAnimation,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableCard } from "@/components/dashboard/SortableCard";


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
type FearGreedData = {
  value: number;
  classification: string;
  timestamp: string;
};

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
  const networkEnabled = backendStatus !== false; // Enable queries unless backend is explicitly down

  // Extract name from Supabase user (email or metadata)
  const displayName = user?.user_metadata?.full_name?.trim() || user?.email?.split("@")[0] || "Trader";
  const firstName = displayName.split(" ")[0] || displayName;

  const containerClass = "w-full max-w-full overflow-hidden px-2 sm:px-4 md:px-6 py-3 sm:py-4";

  // ---------- Lower “Market Overview” (WebSockets) ----------
  const { prices, setPrices } = usePrices();

  // ---------- Tiles (React Query; disabled on Vercel without API_BASE) ----------
  const { data: positionsData = [] } = usePositions({ enabled: networkEnabled && !!user });
  const { setPrices: updatePortfolioPrices } = usePrices();
  const { market: totalMarketValue, pnlPct: totalPnlPercent } = usePortfolioStats();

  useEffect(() => {
    // 1. Determine symbols to track
    // Always track BTC/ETH + any user positions
    // 1. Determine symbols to track
    // Only track user positions
    const trackSymbols = new Set<string>();
    if (Array.isArray(positionsData)) {
      positionsData.forEach((p) => {
        if (p.symbol) trackSymbols.add(p.symbol.toUpperCase());
      });
    }
    const symbolList = Array.from(trackSymbols);

    // 2. Open WebSocket stream
    if (symbolList.length === 0) return;

    const closeStream = openSpotTickerStream(symbolList, {
      onMessage: (ticker) => {
        const sym = ticker.symbol.toUpperCase();
        const price = parseFloat(ticker.lastPrice);

        // Update global price store
        setPrices({ [sym]: price });
      },
      onError: (err) => console.error("WS Error:", err),
    });

    return () => {
      closeStream();
    };
  }, [positionsData, setPrices]);

  const symbols = useMemo(
    () => {
      if (!Array.isArray(positionsData)) return [];
      return Array.from(new Set(positionsData.map((p) => p.symbol.trim().toUpperCase()).filter(Boolean)));
    },
    [positionsData],
  );
  const symbolsKey = symbols.join("|");

  // WebSocket is not implemented, relying on REST API ticker fetches instead

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

  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());

  const { data: fearGreed } = useQuery({
    queryKey: ["/api/market/fear-greed"],
    queryFn: async () => {
      const result = await getQueryFn<any>({ on401: "returnNull" })({
        queryKey: ["/api/market/fear-greed"],
      } as any);

      // Parse the nested API response structure
      if (result && result.data && Array.isArray(result.data) && result.data.length > 0) {
        const item = result.data[0];
        const val = parseInt(item.value, 10);
        if (!isNaN(val)) {
          setLastFetchTime(Date.now());
          return {
            value: val,
            classification: item.value_classification,
            timestamp: item.timestamp
          };
        }
      }

      // Fallback
      setLastFetchTime(Date.now());
      return { value: 50, classification: "Neutral", timestamp: String(Date.now()) };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minute cache
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
    enabled: networkEnabled,
  });

  // ---------- Local State for Mobile Detection ----------
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile(); // Initial check
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ---------- Displays ----------
  const portfolioValueDisplay = `$${nf2.format(safeTotalValue)}`;
  const portfolioPctDisplay = `${safeTotalPnlPercent >= 0 ? "+" : ""}${nf2.format(safeTotalPnlPercent)}%`;
  const pctColorClass = safeTotalPnlPercent >= 0 ? "text-emerald-500" : "text-red-500";

  const top3 = gain?.top ?? null;
  const gainersDisplay =
    !top3 || top3.length === 0
      ? "—"
      : top3.map((g) => `${g.symbol} ${g.pct >= 0 ? "+" : ""}${nf2.format(g.pct)}%`).join(" · ");
  const gainRefreshed = gain?.ts ? new Date(gain.ts).toLocaleTimeString() : "—";

  const watchDisplay = watchCount == null || Number.isNaN(watchCount) ? "—" : nf0.format(watchCount);
  const aiDisplay = aiCount == null || Number.isNaN(aiCount) ? "—" : nf0.format(aiCount);

  // ---------- Drag & Drop State ----------

  const defaultOrder = [
    "portfolio",
    "scanner",
    "top-gainers",
    "total-pnl",
    "fear-greed",
    "strategies", // Replaced ai-signals
    "momentum",   // Added
    "btc-dominance",
    "news",
  ];

  const [items, setItems] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("dashboard_order");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure all default items are present (in case of updates)
        const unique = Array.from(new Set([...parsed, ...defaultOrder]));
        return unique.filter(id => defaultOrder.includes(id));
      }
    } catch (e) {
      console.error("Failed to load dashboard order", e);
    }
    return defaultOrder;
  });

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts to prevent accidental drags on click
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem("dashboard_order", JSON.stringify(newOrder));
        return newOrder;
      });
    }
    setActiveId(null);
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  // ---------- Card Renderers ----------
  const renderCard = (id: string, isOverlay = false) => {
    const Wrapper = (isOverlay ? "div" : SortableCard) as any;
    const props = isOverlay ? { className: "h-full" } : { id, className: "h-full", disabled: isMobile };

    switch (id) {
      case "portfolio":
        return (
          <Wrapper {...(props as any)}>
            <Link to="/portfolio" className="block h-full">
              <Card className="dashboard-card neon-hover bg-gradient-to-br from-cyan-500/10 to-cyan-500/20 h-auto sm:h-full min-h-[160px] sm:min-h-[260px]" style={{ "--neon-glow": "hsl(190, 100%, 50%)" } as React.CSSProperties}>
                <CardContent className="p-3 sm:p-6 flex flex-col justify-start">
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
          </Wrapper>
        );
      case "scanner":
        return (
          <Wrapper {...props}>
            <Link to="/analyse/BTCUSDT" className="block h-full">
              <Card className="dashboard-card neon-hover bg-gradient-to-br from-blue-500/10 to-blue-500/20 h-auto sm:h-full min-h-[160px] sm:min-h-[260px]" style={{ "--neon-glow": "hsl(220, 100%, 50%)" } as React.CSSProperties}>
                <CardContent className="p-3 sm:p-6 flex flex-col justify-start">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground text-xs sm:text-sm mb-0.5">Scanner</h3>
                      <p className="text-xs text-muted-foreground truncate">Technical analysis</p>
                      <p className="text-sm sm:text-lg font-bold text-foreground mt-0.5">15+</p>
                      <p className="text-xs text-muted-foreground">Indicators</p>
                    </div>
                    <Search className="w-6 sm:w-8 h-6 sm:h-8 text-blue-500 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </Wrapper>
        );
      case "top-gainers":
        return (
          <Wrapper {...props}>
            <TopGainersCard />
          </Wrapper>
        );
      case "total-pnl":
        return (
          <Wrapper {...props}>
            <Link to="/portfolio" className="block h-full">
              <Card className="dashboard-card neon-hover bg-gradient-to-br from-yellow-500/10 to-yellow-500/20 h-auto sm:h-full min-h-[160px] sm:min-h-[260px]" style={{ "--neon-glow": "hsl(45, 100%, 50%)" } as React.CSSProperties}>
                <CardContent className="p-3 sm:p-6 flex flex-col justify-start">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground text-xs sm:text-sm mb-0.5">Total P&L</h3>
                      <p className={`text-base sm:text-lg md:text-2xl font-bold ${pctColorClass} truncate`} data-testid="text-total-pnl-percent">
                        {portfolioPctDisplay}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Overall performance</p>
                    </div>
                    <Activity className="w-6 sm:w-8 h-6 sm:h-8 text-yellow-500 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </Wrapper>
        );
      case "fear-greed":
        return (
          <Wrapper {...props}>
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-orange-500/10 to-orange-500/20 h-auto sm:h-full min-h-[160px] sm:min-h-[260px]" data-testid="card-fear-greed" style={{ "--neon-glow": "hsl(25, 100%, 55%)" } as React.CSSProperties}>
              <CardContent className="p-3 sm:p-6 flex flex-col justify-start">
                {fearGreed ? (
                  <>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-foreground text-xs sm:text-sm">Mkt Fear & Greed</h3>
                      <Gauge className="w-6 sm:w-8 h-6 sm:h-8 text-orange-500 flex-shrink-0" />
                    </div>
                    <FearGreedGauge value={fearGreed.value} classification={fearGreed.classification} />
                    <div className="mt-3 pt-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mt-1">
                        Updated: {new Date(lastFetchTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center w-full py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500/30 border-t-orange-500 mb-2"></div>
                    <p className="text-xs text-muted-foreground">Loading...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </Wrapper>
        );
      case "strategies":
        return (
          <Wrapper {...props}>
            <Link to="/strategies" className="block h-full">
              <Card className="dashboard-card neon-hover bg-gradient-to-br from-indigo-500/10 to-indigo-500/20 h-auto sm:h-full min-h-[160px] sm:min-h-[260px]" style={{ "--neon-glow": "hsl(260, 100%, 60%)" } as React.CSSProperties}>
                <CardContent className="p-3 sm:p-6 flex flex-col justify-start">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground text-xs sm:text-sm mb-0.5">Strategies</h3>
                      <p className="text-xs text-muted-foreground truncate">Automated setups</p>
                      <p className="text-sm sm:text-lg font-bold text-foreground mt-0.5">Active</p>
                      <p className="text-xs text-accent">View all</p>
                    </div>
                    <Target className="w-6 sm:w-8 h-6 sm:h-8 text-indigo-500 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </Wrapper>
        );
      case "momentum":
        return (
          <Wrapper {...props}>
            <Link to="/momentum" className="block h-full">
              <Card className="dashboard-card neon-hover bg-gradient-to-br from-fuchsia-500/10 to-fuchsia-500/20 h-auto sm:h-full min-h-[160px] sm:min-h-[260px]" style={{ "--neon-glow": "hsl(300, 100%, 60%)" } as React.CSSProperties}>
                <CardContent className="p-3 sm:p-6 flex flex-col justify-start">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground text-xs sm:text-sm mb-0.5">Momentum</h3>
                      <p className="text-xs text-muted-foreground truncate">Trend following</p>
                      <p className="text-sm sm:text-lg font-bold text-foreground mt-0.5">Top Moves</p>
                      <p className="text-xs text-accent">Analyze now</p>
                    </div>
                    <Zap className="w-6 sm:w-8 h-6 sm:h-8 text-fuchsia-500 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </Wrapper>
        );
      case "btc-dominance":
        return (
          <Wrapper {...props}>
            <BtcDominanceCard />
          </Wrapper>
        );
      case "news":
        return (
          <Wrapper {...props} className={`${props.className} col-span-2 xl:col-span-2`}>
            <Link to="/news" className="block h-full">
              <Card className="dashboard-card neon-hover bg-gradient-to-br from-rose-500/10 to-rose-500/20 h-auto sm:h-full min-h-[160px] sm:min-h-[260px]" style={{ "--neon-glow": "hsl(350, 100%, 60%)" } as React.CSSProperties}>
                <CardContent className="p-3 sm:p-6 flex flex-col justify-start space-y-1 sm:space-y-2 md:space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">News &amp; Insights</h3>
                      <p className="text-sm text-muted-foreground">
                        Curated market headlines and analyst takes.
                      </p>
                    </div>
                    <Newspaper className="w-6 sm:w-8 h-6 sm:h-8 text-primary" />
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
          </Wrapper>
        );
      default:
        return null;
    }
  };

  // ---------- Onboarding Tip ----------
  const [showTip, setShowTip] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dashboard_tip_dismissed") !== "true";
    }
    return true;
  });

  const dismissTip = () => {
    setShowTip(false);
    localStorage.setItem("dashboard_tip_dismissed", "true");
  };

  return (
    <div className="flex-1 overflow-hidden">
      <div className="p-3 sm:p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground break-words">
              Welcome back, <span className="text-primary">{firstName}</span>!
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">Your trading dashboard is ready. Let's make some profitable trades today.</p>
          </div>
        </div>

        {/* Onboarding Tip */}
        {showTip && (
          <div className="hidden md:flex mb-6 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 items-start gap-3 relative animate-in fade-in slide-in-from-top-2">
            <div className="p-1 bg-blue-500/20 rounded-full">
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1 mr-6">
              <h3 className="text-sm font-medium text-blue-100">Customize your layout</h3>
              <p className="text-xs text-blue-200/70 mt-1">
                Did you know? You can <strong>drag and drop</strong> any of the cards below to reorder your dashboard. Put your most important metrics first!
              </p>
            </div>
            <button
              onClick={dismissTip}
              className="absolute top-3 right-3 text-blue-200/50 hover:text-blue-100 transition-colors"
            >
              <span className="sr-only">Dismiss</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 18 18" /></svg>
            </button>
          </div>
        )}



        {/* Mobile Order Definition */}
        {(() => {
          const MOBILE_ORDER = [
            "top-gainers", "fear-greed",
            "portfolio", "total-pnl",
            "scanner", "btc-dominance",
            "strategies", "momentum",
            "news"
          ];
          const displayItems = isMobile ? MOBILE_ORDER : items;

          return (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={displayItems} strategy={rectSortingStrategy}>
                <div className="grid items-stretch grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 md:mb-8">
                  {displayItems.map((id) => renderCard(id))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={dropAnimation}>
                {activeId ? renderCard(activeId, true) : null}
              </DragOverlay>
            </DndContext>
          );
        })()}
      </div>
    </div>
  );
}

