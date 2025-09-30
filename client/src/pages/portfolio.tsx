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
import { apiRequest } from "@/lib/queryClient";
import { useEffect, useMemo, useState } from "react";

type Position = {
  symbol: string;
  qty: number;
  avgPrice: number;
  livePrice: number;
  pnl: number;
};

type PortfolioAPI = {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  positions: Position[];
};

type AiOverviewData = {
  signals: any[];
};

export default function Portfolio() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  // Fetch portfolio FOR THIS USER (uid in query string)
  const { data, isLoading } = useQuery<PortfolioAPI>({
    queryKey: ["/api/portfolio", user?.uid],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const res = await fetch(`/api/portfolio?uid=${encodeURIComponent(user!.uid)}`);
      if (!res.ok) throw new Error("Failed to load portfolio");
      return res.json();
    },
  });

  const { data: aiOverview } = useQuery<AiOverviewData>({
    queryKey: ["/api/ai/market-overview"],
    refetchInterval: 120000,
  });

  const totalValue = data?.totalValue ?? 0;
  const totalPnL = data?.totalPnL ?? 0;
  const totalPnLPercent = data?.totalPnLPercent ?? 0;
  const positions = Array.isArray(data?.positions) ? data!.positions : [];

  // ---- Add Position Modal state ----
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ symbol: "", qty: "", avgPrice: "" });
  const formValid = useMemo(() => {
    const s = form.symbol.trim().toUpperCase();
    const q = Number(form.qty);
    const a = Number(form.avgPrice);
    return s.length >= 2 && Number.isFinite(q) && q > 0 && Number.isFinite(a) && a > 0;
  }, [form]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  async function handleCreate() {
    if (!formValid || saving || !user) return;
    setSaving(true);

    const newPos: Position = {
      symbol: form.symbol.trim().toUpperCase(),
      qty: Number(form.qty),
      avgPrice: Number(form.avgPrice),
      livePrice: Number(form.avgPrice),
      pnl: 0,
    };

    const key = ["/api/portfolio", user.uid];
    const prev = qc.getQueryData<PortfolioAPI>(key);
    qc.setQueryData<PortfolioAPI>(key, (old) => {
      const base = old ?? { totalValue: 0, totalPnL: 0, totalPnLPercent: 0, positions: [] };
      return { ...base, positions: [newPos, ...(base.positions || [])] };
    });

    try {
      const res = await apiRequest("POST", "/api/portfolio", {
        action: "add",
        uid: user.uid,
        position: { symbol: newPos.symbol, qty: newPos.qty, avgPrice: newPos.avgPrice },
      });
      if (!res.ok) {
        qc.setQueryData(key, prev);
        const msg = await res.text().catch(() => "Request failed");
        throw new Error(msg || `HTTP ${res.status}`);
      }
      await qc.invalidateQueries({ queryKey: key });
      setOpen(false);
      setForm({ symbol: "", qty: "", avgPrice: "" });
    } catch (err) {
      console.error("Add position failed:", err);
      alert("Could not add position.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(symbol: string) {
    if (!user) return;
    const key = ["/api/portfolio", user.uid];
    const prev = qc.getQueryData<PortfolioAPI>(key);
    // optimistic remove
    qc.setQueryData<PortfolioAPI>(key, (old) =>
      old ? { ...old, positions: old.positions.filter((p) => p.symbol !== symbol) } : old
    );
    try {
      const res = await apiRequest("POST", "/api/portfolio", {
        action: "delete",
        uid: user.uid,
        symbol,
      });
      if (!res.ok) {
        qc.setQueryData(key, prev);
        const msg = await res.text().catch(() => "Request failed");
        throw new Error(msg || `HTTP ${res.status}`);
      }
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Could not delete the position.");
      qc.setQueryData(key, prev);
    }
  }

  function goScan(symbol: string) {
    // Deep-link to /scan/:symbol (Scan page will read the param and prefill)
    setLocation(`/scan/${encodeURIComponent(symbol)}`);
  }

  // Short stat cards
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
            <Link href="/charts">
              <Button variant="outline" size="sm">
                <Eye className="w-4 h-4 mr-2" /> Open Scanner
              </Button>
            </Link>
            {user && (
              <Button size="sm" onClick={() => setOpen(true)}>
                <PlusCircle className="w-4 h-4 mr-2" /> Add Position
              </Button>
            )}
          </div>
        </div>

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

        {/* Holdings table — NEW columns + Scan/Delete */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Holdings</CardTitle>
            <div className="flex items-center gap-2">
              <Link href="/charts">
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-2" /> Scan Market
                </Button>
              </Link>
              {user && (
                <Button size="sm" onClick={() => setOpen(true)}>
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
                    <th className="text-right py-2 pr-4">P&L (USDT)</th>
                    <th className="text-right py-2 pr-4">P&L %</th>
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
                            <Button size="sm" className="mt-3" onClick={() => setOpen(true)}>
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
                      const pnlValue = (p.livePrice - p.avgPrice) * p.qty;
                      const pnlPct = p.avgPrice > 0 ? (p.livePrice - p.avgPrice) / p.avgPrice * 100 : 0;
                      const pnlColor = pnlValue >= 0 ? "text-green-500" : "text-red-500";

                      return (
                        <tr key={p.symbol} className="border-b border-border/50">
                          <td className="py-3 pr-4 font-medium text-foreground">{p.symbol}</td>
                          <td className="py-3 pr-4 text-right">{p.qty}</td>
                          <td className="py-3 pr-4 text-right">${p.avgPrice.toLocaleString("en-US", { maximumFractionDigits: 4 })}</td>
                          <td className="py-3 pr-4 text-right">${p.livePrice.toLocaleString("en-US", { maximumFractionDigits: 4 })}</td>
                          <td className={`py-3 pr-4 text-right ${pnlColor}`}>
                            {pnlValue >= 0 ? "+" : "-"}${Math.abs(pnlValue).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                          </td>
                          <td className={`py-3 pr-4 text-right ${pnlColor}`}>
                            {pnlPct >= 0 ? "+" : "-"}{Math.abs(pnlPct).toFixed(2)}%
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => goScan(p.symbol)} title="Scan">
                                <Search className="w-4 h-4 mr-1" /> Scan
                              </Button>
                              {user && (
                                <Button size="sm" variant="destructive" onClick={() => handleDelete(p.symbol)} title="Delete">
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
          <div className="absolute inset-0 bg-black/80" onClick={() => (!saving ? setOpen(false) : null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1526] shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Add Position</h3>
              <button className="p-1 rounded-md hover:bg-white/5" onClick={() => (!saving ? setOpen(false) : null)} aria-label="Close">
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
              />

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!formValid || saving}>
                  {saving ? "Saving…" : "Add Position"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                Tip: Use Binance spot symbols like <span className="font-mono">BTCUSDT</span>, <span className="font-mono">ETHUSDT</span>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
