// client/src/pages/portfolio.tsx
import { useAuth } from "@/hooks/useAuth";
import { usePositions } from "@/hooks/usePositions";
import { usePortfolioStats } from "@/hooks/usePortfolioStats";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  Activity,
  PlusCircle,
  Eye,
  X,
  Brain,
  Search,
  Trash2,
  RefreshCw,
  Coins,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBackendHealth } from "@/hooks/use-backend-health";
import { api } from "@/lib/api";
import { useDeletePosition, useUpsertPosition } from "@/lib/api/portfolio-mutations";
import { portfolioPositionsQueryKey } from "@/lib/api/portfolio-keys";
import { usePrices } from "@/lib/prices";
import { fmt } from "@/lib/utils";
import {
  addOrReplacePosition as addSupabasePosition,
  deletePosition as deleteSupabasePosition,
  listPositions as listSupabasePositions,
  type PositionRow,
} from "@/services/positionsService";
import { useAuth as useSupabaseAuth } from "@/auth/AuthContext";
import { useLoginGate } from "@/auth/useLoginGate";
import type { PortfolioPosition } from "@/lib/api/portfolio";
import { openSpotTickerStream } from "@/lib/binanceWs";
import { AssetAllocationChart } from "@/components/portfolio/AssetAllocationChart";
import { PerformanceComparisonCard } from "@/components/portfolio/PerformanceComparisonCard";

type Position = {
  id: string;
  symbol: string;
  qty: number;
  avgPrice: number;
  livePrice: number; // server fallback only
  pnl: number;
};

type AiOverviewData = {
  signals: any[];
};

export default function Portfolio() {
  const { user } = useAuth();
  const { user: sessionUser, loading: sessionLoading } = useSupabaseAuth();
  const { requireLogin } = useLoginGate();
  const [, setLocation] = useLocation();
  const backendStatus = useBackendHealth();
  const networkEnabled = backendStatus === true;

  const pageClass = "w-full max-w-full overflow-x-hidden space-y-4 px-3 sm:px-4 md:px-6 py-4";

  const queryClient = useQueryClient();
  const userId = user?.uid ?? null;
  const supabaseUserId = sessionUser?.id ?? null;
  const queryKeyUserId = supabaseUserId ?? userId;
  const positionsQueryKey = useMemo(
    () => portfolioPositionsQueryKey(queryKeyUserId ?? null),
    [queryKeyUserId],
  );

  const {
    data: storedPositions = [],
    isLoading: loadingPositions,
    isFetching: fetchingPositions,
    isError: positionsError,
    error: positionsErrorValue,
  } = usePositions({ enabled: networkEnabled && (!!sessionUser || !!user) });

  const { prices, setPrices, getPrice, reset: resetPrices } = usePrices();
  const {
    market: totalValue,
    pnl: totalPnL,
    pnlPct: totalPnLPercent,
    cost: totalCost,
  } = usePortfolioStats();

  const [btcChange, setBtcChange] = useState<number>(0);

  const positions = useMemo<Position[]>(
    () =>
      storedPositions.map((pos) => ({
        id: pos.id,
        symbol: pos.symbol,
        qty: Number(pos.quantity),
        avgPrice: Number(pos.entryPrice),
        livePrice: Number(pos.entryPrice),
        pnl: 0,
      })),
    [storedPositions],
  );

  const isLoading = (loadingPositions || fetchingPositions) && positions.length === 0;
  const loadError = positionsError && positions.length === 0;
  const loadErrorMessage =
    positionsErrorValue instanceof Error
      ? positionsErrorValue.message
      : "Failed to load portfolio positions";

  useEffect(() => {
    if (positionsError && positionsErrorValue) {
      console.error("Failed to load portfolio positions", positionsErrorValue);
    }
  }, [positionsError, positionsErrorValue]);

  const refreshPositions = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: positionsQueryKey });
  }, [positionsQueryKey, queryClient]);

  const supabaseRowToPortfolioPosition = useCallback(
    (row: PositionRow): PortfolioPosition => {
      const quantity = Number(row.qty);
      const entryPrice = Number(row.entry_price);

      return {
        id: row.id,
        symbol: row.symbol?.toUpperCase?.() ?? "",
        quantity: Number.isFinite(quantity) ? quantity : 0,
        entryPrice: Number.isFinite(entryPrice) ? entryPrice : 0,
        notes: row.note ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at ?? row.created_at,
      };
    },
    [],
  );

  const syncSupabasePositions = useCallback(async () => {
    if (!supabaseUserId) return;
    try {
      const rows = await listSupabasePositions();
      const mapped = rows.map(supabaseRowToPortfolioPosition);
      queryClient.setQueryData(positionsQueryKey, mapped);
    } catch (error) {
      console.error("Failed to reload Supabase positions", error);
      await refreshPositions();
    }
  }, [supabaseRowToPortfolioPosition, supabaseUserId, queryClient, positionsQueryKey, refreshPositions]);

  const handleRefresh = useCallback(async () => {
    resetPrices();
    await Promise.all([
      refreshPositions(),
      queryClient.invalidateQueries({ queryKey: ["prices"] }),
    ]);
  }, [queryClient, refreshPositions, resetPrices]);

  const symbols = useMemo(
    () => Array.from(new Set(positions.map((p) => p.symbol.trim().toUpperCase()).filter(Boolean))),
    [positions],
  );
  const symbolsKey = symbols.join("|");

  // WebSocket subscription for portfolio symbols
  useEffect(() => {
    // 1. Determine symbols to track
    // Always track BTC/ETH + any user positions
    const trackSymbols = new Set(["BTCUSDT", "ETHUSDT"]);
    if (Array.isArray(positions)) {
      positions.forEach((p) => {
        if (p.symbol) trackSymbols.add(p.symbol.toUpperCase());
      });
    }
    const symbolList = Array.from(trackSymbols);

    // 2. Open WebSocket stream
    const closeStream = openSpotTickerStream(symbolList, {
      onMessage: (ticker) => {
        const sym = ticker.symbol.toUpperCase();
        const price = parseFloat(ticker.lastPrice);

        // Update global price store
        if (!Number.isNaN(price)) {
          setPrices({ [sym]: price });
        }

        // Capture BTC change for analytics
        const change = parseFloat(ticker.priceChangePercent);
        if (sym === "BTCUSDT" && !Number.isNaN(change)) {
          setBtcChange(change);
        }
      },
      onError: (err) => console.error("WS Error:", err),
    });

    return () => {
      closeStream();
    };
  }, [positions, setPrices]);

  const currentPriceFor = useCallback(
    (sym: string, fallback: number) => {
      const upper = sym.toUpperCase();
      const mapPrice = prices[upper];
      if (Number.isFinite(mapPrice)) {
        return mapPrice as number;
      }
      const latest = getPrice(sym);
      return typeof latest === "number" && Number.isFinite(latest) ? latest : fallback;
    },
    [getPrice, prices],
  );

  const { data: aiOverview } = useQuery<AiOverviewData>({
    queryKey: ["/api/ai/market-overview"],
    refetchInterval: 120000,
    queryFn: async () => {
      const res = await api("/api/ai/market-overview");
      if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load AI overview"));
      return res.json();
    },
    enabled: networkEnabled,
  });

  // ---------- LIVE PRICES ----------

  // ---------- Add / Delete ----------
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ symbol: "", qty: "", avgPrice: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const formValid = useMemo(() => {
    const s = form.symbol.trim().toUpperCase();
    const q = Number(form.qty);
    const a = Number(form.avgPrice);
    return s.length >= 2 && Number.isFinite(q) && q > 0 && Number.isFinite(a) && a > 0;
  }, [form]);

  const upsertPositionMutation = useUpsertPosition();
  const deletePositionMutation = useDeletePosition();
  const [saving, setSaving] = useState(false);

  // open modal with cleared fields each time
  const openAdd = () => {
    if (requireLogin("/portfolio")) return;
    setForm({ symbol: "", qty: "", avgPrice: "" });
    setFormError(null);
    setOpen(true);
  };

  const closeAddModal = () => {
    if (saving) return;
    setOpen(false);
    setFormError(null);
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  async function handleCreate() {
    if (!formValid || saving) return;
    if (!sessionUser) {
      setFormError("Please sign in to add a position.");
      return;
    }

    setFormError(null);

    const symbol = form.symbol.trim().toUpperCase();
    const quantity = Number(form.qty);
    const entryPrice = Number(form.avgPrice);

    setSaving(true);

    let successSource: "supabase" | "fallback" | null = null;
    let lastError: unknown = null;

    try {
      await addSupabasePosition(sessionUser.id, symbol, quantity, entryPrice);
      await syncSupabasePositions();
      successSource = "supabase";
    } catch (err) {
      lastError = err;
      console.error("Add position via Supabase failed:", err);
      try {
        await upsertPositionMutation.mutateAsync({ symbol, quantity, entryPrice });
        successSource = "fallback";
      } catch (fallbackError) {
        lastError = fallbackError;
        console.error("Fallback add position failed:", fallbackError);
      }
    }

    if (successSource) {
      await refreshPositions();
      setOpen(false);
      setForm({ symbol: "", qty: "", avgPrice: "" });
      setFormError(null);
    } else {
      const message = lastError instanceof Error ? lastError.message : "Failed to add position";
      setFormError(message);
    }

    setSaving(false);
  }

  async function handleDelete(position: Position) {
    if (!sessionUser) return;

    let lastError: unknown = null;
    try {
      await deleteSupabasePosition(position.id);
      await syncSupabasePositions();
      return;
    } catch (error) {
      lastError = error;
      console.error("Delete via Supabase failed:", error);
    }

    try {
      await deletePositionMutation.mutateAsync(position.id);
    } catch (error) {
      console.error("Fallback delete failed:", error);
      const message =
        error instanceof Error
          ? error.message
          : lastError instanceof Error
            ? lastError.message
            : "Failed to delete position";
      alert(message);
    }
  }

  function goScan(symbol: string) {
    setLocation(`/analyse/${encodeURIComponent(symbol)}`);
  }

  // short stat cards
  const cardClampClass = "dashboard-card neon-hover !min-h-[64px]";
  const cardClampStyle: React.CSSProperties = { minHeight: 64 };
  const rowContentClass = "!p-2 h-[64px] min-h-0 flex items-center justify-between";

  return (
    <div className="flex-1 overflow-hidden">
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground break-words">Your Portfolio</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">Positions, P&amp;L, and live performance.</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={handleRefresh} className="min-h-[44px]">
              <RefreshCw className={`w-4 h-4 sm:mr-2 ${fetchingPositions ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button size="sm" onClick={openAdd} className="min-h-[44px]">
              <PlusCircle className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Position</span>
            </Button>
          </div>
        </div>

        {!sessionLoading && !sessionUser && (
          <div className="mb-4 text-sm text-muted-foreground">Please sign in at /account</div>
        )}

        {/* Live market strip - hidden on mobile */}



        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <Card className={`${cardClampClass} bg-gradient-to-br from-cyan-500/10 to-cyan-500/20`} style={cardClampStyle}>
            <CardContent className={rowContentClass}>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-500" />
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-foreground">Current Value</div>
                  <div className="text-base font-bold text-foreground">
                    ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`${cardClampClass} bg-gradient-to-br from-blue-500/5 to-blue-500/10`} style={cardClampStyle}>
            <CardContent className={rowContentClass}>
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-blue-500" />
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-foreground">Position Value</div>
                  <div className="text-base font-bold text-foreground">
                    ${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`${cardClampClass} bg-gradient-to-br from-emerald-500/5 to-emerald-500/10`} style={cardClampStyle}>
            <CardContent className={rowContentClass}>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-foreground">Total P&amp;L</div>
                  <div className={`text-base font-bold ${totalPnL >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {totalPnL >= 0 ? "+" : ""}${totalPnL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={`text-[11px] ${totalPnLPercent >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {totalPnLPercent >= 0 ? "+" : ""}
                    {totalPnLPercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`${cardClampClass} bg-gradient-to-br from-purple-500/5 to-purple-500/10`} style={cardClampStyle}>
            <CardContent className={rowContentClass}>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">Positions</div>
                <div className="text-base font-bold text-foreground">{positions.length}</div>
              </div>
            </CardContent>
          </Card>

          <Link href="/ai-insights" className="block">
            <Card className={`${cardClampClass} bg-gradient-to-br from-indigo-500/5 to-indigo-500/10 cursor-pointer`} style={cardClampStyle}>
              <CardContent className={rowContentClass}>
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-indigo-500" />
                  <div className="leading-tight">
                    <div className="text-sm font-semibold text-foreground">AI Insights</div>
                    <div className="text-base font-bold text-foreground">{aiOverview?.signals?.length ?? 0}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Holdings table */}
        <Card className="border-border">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-6">
            <CardTitle>Holdings</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Link href="/analyse/BTCUSDT">
                <Button variant="outline" size="sm" className="min-h-[44px]">
                  <Eye className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Scan Market</span>
                </Button>
              </Link>
              <Button size="sm" onClick={openAdd} className="min-h-[44px]">
                <PlusCircle className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Position</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-full sm:min-w-[800px]">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-3 px-2 sm:px-4 whitespace-nowrap">COIN</th>
                    <th className="text-right py-3 px-2 sm:px-4 whitespace-nowrap">QTY</th>
                    <th className="text-right py-3 px-2 sm:px-4 whitespace-nowrap">ENTRY</th>
                    <th className="text-right py-3 px-2 sm:px-4 whitespace-nowrap">CURRENT</th>
                    <th className="text-right py-3 px-2 sm:px-4 whitespace-nowrap">ORDER</th>
                    <th className="text-right py-3 px-2 sm:px-4 whitespace-nowrap">P&amp;L</th>
                    <th className="text-right py-3 px-2 sm:px-4 whitespace-nowrap">%</th>
                    <th className="text-right py-3 px-2 sm:px-4 whitespace-nowrap">ACTIONS</th>
                  </tr>
                </thead>

                {isLoading ? (
                  <tbody>
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-muted-foreground">
                        Loading your portfolio…
                      </td>
                    </tr>
                  </tbody>
                ) : loadError ? (
                  <tbody>
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-red-400">
                        {loadErrorMessage}
                      </td>
                    </tr>
                  </tbody>
                ) : positions.length === 0 ? (
                  <tbody>
                    <tr>
                      <td colSpan={8} className="py-6 text-center">
                        <div className="inline-flex flex-col items-center">
                          <p className="text-foreground font-medium">No positions yet</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Add your first position to start tracking P&amp;L.
                          </p>
                          <Button size="sm" className="mt-3" onClick={openAdd}>
                            <PlusCircle className="w-4 h-4 mr-2" />
                            Add Position
                          </Button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                ) : (
                  <tbody>
                    {positions.map((p) => {
                      const sym = p.symbol.toUpperCase();
                      const current = currentPriceFor(sym, p.livePrice ?? p.avgPrice);
                      const quantity = Number(p.qty) || 0;
                      const entryPrice = Number(p.avgPrice) || 0;
                      const currentPrice = Number.isFinite(current) ? current : entryPrice;
                      const orderValue = quantity * entryPrice;
                      const positionValue = quantity * currentPrice;
                      const pnlValue = positionValue - orderValue;
                      const pnlPct = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
                      const pnlColor = pnlValue >= 0 ? "text-emerald-500" : "text-red-500";

                      return (
                        <tr key={p.id} className="border-b border-border/50">
                          <td className="py-3 px-2 sm:px-4 font-medium text-foreground whitespace-nowrap">{sym}</td>
                          <td className="py-3 px-2 sm:px-4 text-right whitespace-nowrap text-xs sm:text-sm">{p.qty}</td>
                          <td className="py-3 px-2 sm:px-4 text-right whitespace-nowrap text-xs sm:text-sm">
                            ${p.avgPrice.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-right whitespace-nowrap text-xs sm:text-sm">
                            ${current.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-right whitespace-nowrap text-xs sm:text-sm">{fmt(orderValue)}</td>
                          <td className={`py-3 px-2 sm:px-4 text-right whitespace-nowrap text-xs sm:text-sm ${pnlColor}`}>
                            {pnlValue >= 0 ? "+" : "-"}$
                            {Math.abs(pnlValue).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                          </td>
                          <td className={`py-3 px-2 sm:px-4 text-right whitespace-nowrap text-xs sm:text-sm ${pnlColor}`}>
                            {pnlPct >= 0 ? "+" : "-"}
                            {Math.abs(pnlPct).toFixed(2)}%
                          </td>
                          <td className="py-3 px-2 sm:px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 sm:gap-2">
                              <Button size="sm" variant="outline" onClick={() => goScan(sym)} title="Scan" className="hidden sm:inline-flex">
                                <Search className="w-4 h-4 mr-1" /> Scan
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => goScan(sym)} title="Scan" className="inline-flex sm:hidden min-h-[36px]">
                                <Search className="w-4 h-4" />
                              </Button>
                              {sessionUser && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDelete(p)}
                                  title="Delete"
                                  className="min-h-[36px]"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                )}
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 h-[500px]">
          <div className="lg:col-span-2 h-full">
            <AssetAllocationChart positions={positions} prices={prices} />
          </div>
          <div className="h-full">
            <PerformanceComparisonCard btcChange={btcChange} totalPnlPct={totalPnLPercent} />
          </div>
        </div>
      </div>

      {/* ---- Add Position Modal ---- */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80" onClick={closeAddModal} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1526] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Add Position</h3>
              <button className="p-1 rounded-md hover:bg-white/5" onClick={closeAddModal} aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              <label className="text-sm text-muted-foreground">Symbol (e.g., BTCUSDT)</label>
              <input
                className="mt-1 w-full rounded-md bg-[#12182a] border border-white/10 px-3 py-2 text-foreground outline-none"
                placeholder="BTCUSDT"
                value={form.symbol}
                onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
                autoComplete="off"
              />

              <label className="text-sm text-muted-foreground mt-4 block">Quantity</label>
              <input
                type="number"
                min="0"
                step="any"
                className="mt-1 w-full rounded-md bg-[#12182a] border border-white/10 px-3 py-2 text-foreground outline-none"
                placeholder="e.g., 0.5"
                value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                autoComplete="off"
              />

              <label className="text-sm text-muted-foreground mt-4 block">Average Entry Price (USDT)</label>
              <input
                type="number"
                min="0"
                step="any"
                className="mt-1 w-full rounded-md bg-[#12182a] border border-white/10 px-3 py-2 text-foreground outline-none"
                placeholder="e.g., 42000"
                value={form.avgPrice}
                onChange={(e) => setForm((f) => ({ ...f, avgPrice: e.target.value }))}
                autoComplete="off"
              />

              {formError && (
                <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={closeAddModal} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!formValid || saving}>
                  {saving ? "Saving…" : "Add Position"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                Tip: Use Binance spot symbols like <span className="font-mono">BTCUSDT</span>,{" "}
                <span className="font-mono">ETHUSDT</span>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
