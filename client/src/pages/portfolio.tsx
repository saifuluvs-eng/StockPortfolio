// client/src/pages/portfolio.tsx
import { useAuth } from "@/hooks/useAuth";
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
} from "lucide-react";
import LiveSummary from "@/components/home/LiveSummary";
import { useEffect, useMemo, useState } from "react";
import { useBackendHealth } from "@/hooks/use-backend-health";
import { api } from "@/lib/api";
import {
  deletePosition as deleteRemotePosition,
  getPositions as fetchPositions,
  readCachedPositions,
  upsertPosition as saveRemotePosition,
  writeCachedPositions,
  type PortfolioPosition as StoredPosition,
} from "@/lib/api/portfolio";

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
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const backendStatus = useBackendHealth();
  const networkEnabled = backendStatus === true;

  const resolvedUserId = user?.uid ?? "demo-user";
  const portfolioQueryKey = useMemo(
    () => ["portfolio", "positions", resolvedUserId] as const,
    [resolvedUserId],
  );

  const initialPositions = useMemo(() => readCachedPositions(resolvedUserId) ?? undefined, [resolvedUserId]);

  const {
    data: storedPositions,
    isLoading: loadingPositions,
    isError: positionsError,
    error: positionsErrorValue,
  } = useQuery<StoredPosition[]>({
    queryKey: portfolioQueryKey,
    enabled: networkEnabled,
    queryFn: () => fetchPositions(user?.uid ?? null),
    initialData: initialPositions,
    placeholderData: initialPositions,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    onSuccess: (positions) => {
      writeCachedPositions(resolvedUserId, positions);
    },
  });

  const portfolioPositions = storedPositions ?? initialPositions ?? [];
  const positions = useMemo<Position[]>(
    () =>
      portfolioPositions.map((pos) => ({
        id: pos.id,
        symbol: pos.symbol,
        qty: Number(pos.quantity),
        avgPrice: Number(pos.entryPrice),
        livePrice: Number(pos.entryPrice),
        pnl: 0,
      })),
    [portfolioPositions],
  );

  const baseTotals = useMemo(() => {
    let invested = 0;
    positions.forEach((pos) => {
      invested += pos.avgPrice * pos.qty;
    });
    return {
      totalValue: invested,
      totalPnL: 0,
      totalPnLPercent: 0,
    };
  }, [positions]);

  const serverTotalValue = baseTotals.totalValue;
  const serverTotalPnL = baseTotals.totalPnL;
  const serverTotalPnLPercent = baseTotals.totalPnLPercent;
  const isLoading = loadingPositions && positions.length === 0;
  const loadError = positionsError && positions.length === 0;
  const loadErrorMessage =
    positionsErrorValue instanceof Error
      ? positionsErrorValue.message
      : "Failed to load portfolio positions";
  const showCachedWarning = positions.length > 0 && (!networkEnabled || positionsError);

  useEffect(() => {
    if (positionsError && positionsErrorValue) {
      console.error("Failed to load portfolio positions", positionsErrorValue);
    }
  }, [positionsError, positionsErrorValue]);

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
  // Source A: your /ws (if it emits these symbols)
  const [liveWS, setLiveWS] = useState<Record<string, number>>({});
  const positionsKey = useMemo(
    () => positions.map((p) => p.symbol).sort().join(","),
    [positions],
  );

  useEffect(() => {
    if (positions.length === 0) return;
    if (!networkEnabled) return;
    if (typeof window === "undefined") return;

    const apiBase = import.meta.env.VITE_API_BASE || window.location.origin;
    const wsUrl = apiBase.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      const symbols = Array.from(new Set(positions.map((p) => p.symbol.trim().toUpperCase())));
      symbols.forEach((s) => ws.send(JSON.stringify({ type: "subscribe", symbol: s })));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type === "price_update" && msg?.data && typeof msg.data === "object") {
          setLiveWS((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const [sym, price] of Object.entries(msg.data)) {
              const s = sym.toUpperCase();
              const p = Number(price as any);
              if (Number.isFinite(p) && next[s] !== p) {
                next[s] = p;
                changed = true;
              }
            }
            return changed ? next : prev;
          });
        }
      } catch {}
    };

    return () => {
      try { ws.close(); } catch {}
    };
  }, [networkEnabled, positionsKey]);

  // Source B: Binance REST polling (covers all symbols reliably)
  const [liveHTTP, setLiveHTTP] = useState<Record<string, number>>({});
  useEffect(() => {
    if (positions.length === 0) return;

    const symbols = Array.from(new Set(positions.map((p) => p.symbol.trim().toUpperCase())));
    if (symbols.length === 0) return;

    let cancelled = false;

    async function fetchPrices() {
      try {
        // batch endpoint: /api/v3/ticker/price?symbols=["BTCUSDT","ETHUSDT"]
        const url =
          "https://api.binance.com/api/v3/ticker/price?symbols=" +
          encodeURIComponent(JSON.stringify(symbols));
        const res = await fetch(url);
        if (!res.ok) return;
        const arr: Array<{ symbol: string; price: string }> = await res.json();
        if (cancelled) return;

        setLiveHTTP((prev) => {
          const next = { ...prev };
          for (const row of arr) {
            const p = Number(row.price);
            if (Number.isFinite(p)) next[row.symbol.toUpperCase()] = p;
          }
          return next;
        });
      } catch {
        // ignore network hiccups
      }
    }

    fetchPrices();
    const id = setInterval(fetchPrices, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [positionsKey]);

  // unified getter for a symbol’s latest price
  function currentPriceFor(sym: string, fallback: number) {
    const S = sym.toUpperCase();
    if (Number.isFinite(liveWS[S])) return liveWS[S];
    if (Number.isFinite(liveHTTP[S])) return liveHTTP[S];
    return fallback;
  }

  const { totalValue, totalPnL, totalPnLPercent } = useMemo(() => {
    if (positions.length === 0) {
      return {
        totalValue: serverTotalValue,
        totalPnL: serverTotalPnL,
        totalPnLPercent: serverTotalPnLPercent,
      };
    }

    let invested = 0;
    let currentWorth = 0;
    for (const pos of positions) {
      const symbol = pos.symbol.toUpperCase();
      const latestPrice = currentPriceFor(symbol, pos.livePrice ?? pos.avgPrice);
      invested += pos.avgPrice * pos.qty;
      currentWorth += latestPrice * pos.qty;
    }

    const pnlValue = currentWorth - invested;
    const pnlPercent = invested > 0 ? (pnlValue / invested) * 100 : 0;

    return {
      totalValue: currentWorth,
      totalPnL: pnlValue,
      totalPnLPercent: pnlPercent,
    };
  }, [
    positions,
    liveHTTP,
    liveWS,
    serverTotalPnL,
    serverTotalPnLPercent,
    serverTotalValue,
  ]);

  // ---------- Add / Delete ----------
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ symbol: "", qty: "", avgPrice: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const formValid = useMemo(() => {
    const s = form.symbol.trim().toUpperCase();
    const q = Number(form.qty);
    const a = Number(form.avgPrice);
    return s.length >= 2 && Number.isFinite(q) && q > 0 && Number.isFinite(a) && a > 0;
  }, [form]);

  // open modal with cleared fields each time
  const openAdd = () => {
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
    if (!formValid || saving || !user) return;
    setSaving(true);
    setFormError(null);

    const symbol = form.symbol.trim().toUpperCase();
    const quantity = Number(form.qty);
    const entryPrice = Number(form.avgPrice);
    const nowIso = new Date().toISOString();
    const optimistic: StoredPosition = {
      id: `temp-${Date.now()}`,
      symbol,
      quantity,
      entryPrice,
      notes: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const previous = qc.getQueryData<StoredPosition[]>(portfolioQueryKey);
    qc.setQueryData<StoredPosition[]>(portfolioQueryKey, (old) => {
      const base = old ?? [];
      const filtered = base.filter((pos) => pos.symbol !== optimistic.symbol);
      return [optimistic, ...filtered];
    });

    try {
      const saved = await saveRemotePosition(user.uid, { symbol, quantity, entryPrice });
      qc.setQueryData<StoredPosition[]>(portfolioQueryKey, (old) => {
        const base = old ?? [];
        const filtered = base.filter((pos) => pos.id !== saved.id && pos.symbol !== saved.symbol);
        return [saved, ...filtered];
      });
      const latest = qc.getQueryData<StoredPosition[]>(portfolioQueryKey) ?? [];
      writeCachedPositions(resolvedUserId, latest);
      setOpen(false);
      setFormError(null);
      setForm({ symbol: "", qty: "", avgPrice: "" });
    } catch (err) {
      console.error("Add position failed:", err);
      qc.setQueryData(portfolioQueryKey, previous);
      writeCachedPositions(resolvedUserId, previous ?? null);
      const message = err instanceof Error ? err.message : "Failed to add position";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(position: Position) {
    if (!user) return;
    const previous = qc.getQueryData<StoredPosition[]>(portfolioQueryKey);

    qc.setQueryData<StoredPosition[]>(portfolioQueryKey, (old) =>
      (old ?? []).filter((entry) => entry.id !== position.id),
    );

    try {
      await deleteRemotePosition(user.uid, position.id);
      const latest = qc.getQueryData<StoredPosition[]>(portfolioQueryKey) ?? [];
      writeCachedPositions(resolvedUserId, latest);
    } catch (e) {
      console.error("Delete failed:", e);
      qc.setQueryData(portfolioQueryKey, previous);
      writeCachedPositions(resolvedUserId, previous ?? null);
      const message = e instanceof Error ? e.message : "Failed to delete position";
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
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Your Portfolio</h1>
            <p className="text-muted-foreground mt-1">Positions, P&amp;L, and live performance.</p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/analyse/BTCUSDT">
              <Button variant="outline" size="sm">
                <Eye className="w-4 h-4 mr-2" /> Open Scanner
              </Button>
            </Link>
            {user && (
              <Button size="sm" onClick={openAdd}>
                <PlusCircle className="w-4 h-4 mr-2" /> Add Position
              </Button>
            )}
          </div>
        </div>

        {showCachedWarning && (
          <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            You&apos;re viewing cached positions. Changes will sync once the connection is restored.
          </div>
        )}

        {/* Live market strip */}
        <div className="mb-6">
          <LiveSummary symbols={["BTCUSDT", "ETHUSDT"]} />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4 mb-6">
          <Card className={`${cardClampClass} bg-gradient-to-br from-primary/5 to-primary/10`} style={cardClampStyle}>
            <CardContent className={rowContentClass}>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-foreground">Total Value</div>
                  <div className="text-base font-bold text-foreground">
                    ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  <div className={`text-base font-bold ${totalPnL >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {totalPnL >= 0 ? "+" : ""}${totalPnL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={`text-[11px] ${totalPnLPercent >= 0 ? "text-green-500" : "text-red-500"}`}>
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Holdings</CardTitle>
            <div className="flex items-center gap-2">
              <Link href="/analyse/BTCUSDT">
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-2" /> Scan Market
                </Button>
              </Link>
              {user && (
                <Button size="sm" onClick={openAdd}>
                  <PlusCircle className="w-4 h-4 mr-2" /> Add Position
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <div className="w-full overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-2 pr-4">COIN</th>
                    <th className="text-right py-2 pr-4">QTY</th>
                    <th className="text-right py-2 pr-4">ENTRY PRICE</th>
                    <th className="text-right py-2 pr-4">CURRENT PRICE</th>
                    <th className="text-right py-2 pr-4">P&amp;L (USDT)</th>
                    <th className="text-right py-2 pr-4">P&amp;L %</th>
                    <th className="text-right py-2">ACTIONS</th>
                  </tr>
                </thead>

                {isLoading ? (
                  <tbody>
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-muted-foreground">
                        Loading your portfolio…
                      </td>
                    </tr>
                  </tbody>
                ) : loadError ? (
                  <tbody>
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-red-400">
                        {loadErrorMessage}
                      </td>
                    </tr>
                  </tbody>
                ) : positions.length === 0 ? (
                  <tbody>
                    <tr>
                      <td colSpan={7} className="py-6 text-center">
                        <div className="inline-flex flex-col items-center">
                          <p className="text-foreground font-medium">No positions yet</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Add your first position to start tracking P&amp;L.
                          </p>
                          {user && (
                            <Button size="sm" className="mt-3" onClick={openAdd}>
                              <PlusCircle className="w-4 h-4 mr-2" />
                              Add Position
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                ) : (
                  <tbody>
                    {positions.map((p) => {
                      const sym = p.symbol.toUpperCase();
                      const current = currentPriceFor(sym, p.livePrice ?? p.avgPrice);
                      const pnlValue = (current - p.avgPrice) * p.qty;
                      const pnlPct = p.avgPrice > 0 ? ((current - p.avgPrice) / p.avgPrice) * 100 : 0;
                      const pnlColor = pnlValue >= 0 ? "text-green-500" : "text-red-500";

                      return (
                        <tr key={p.id} className="border-b border-border/50">
                          <td className="py-3 pr-4 font-medium text-foreground">{sym}</td>
                          <td className="py-3 pr-4 text-right">{p.qty}</td>
                          <td className="py-3 pr-4 text-right">
                            ${p.avgPrice.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            ${current.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                          </td>
                          <td className={`py-3 pr-4 text-right ${pnlColor}`}>
                            {pnlValue >= 0 ? "+" : "-"}$
                            {Math.abs(pnlValue).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                          </td>
                          <td className={`py-3 pr-4 text-right ${pnlColor}`}>
                            {pnlPct >= 0 ? "+" : "-"}
                            {Math.abs(pnlPct).toFixed(2)}%
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => goScan(sym)} title="Scan">
                                <Search className="w-4 h-4 mr-1" /> Scan
                              </Button>
                              {user && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDelete(p)}
                                  title="Delete"
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
      </div>

      {/* ---- Add Position Modal ---- */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" onClick={closeAddModal} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1526] shadow-2xl">
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
