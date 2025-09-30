// client/src/pages/portfolio.tsx
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  Activity,
  PlusCircle,
  Eye,
  EyeIcon,
  Bell,
  X,
  Brain,
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

  const { data, isLoading } = useQuery<PortfolioAPI>({
    queryKey: ["/api/portfolio"],
    enabled: !!user,
    refetchInterval: 15000,
  });

  // (for card count) – optional, mirrors Dashboard
  const { data: aiOverview } = useQuery<AiOverviewData>({
    queryKey: ["/api/ai/market-overview"],
    refetchInterval: 120000,
  });

  const totalValue = data?.totalValue ?? 0;
  const totalPnL = data?.totalPnL ?? 0;
  const totalPnLPercent = data?.totalPnLPercent ?? 0;
  const positions = Array.isArray(data?.positions) ? data!.positions : [];

  // ---- Add Position Modal state (unchanged) ----
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ symbol: "", qty: "", avgPrice: "" });
  const formValid = useMemo(() => {
    const s = form.symbol.trim().toUpperCase();
    const q = Number(form.qty);
    const a = Number(form.avgPrice);
    return s.length >= 2 && Number.isFinite(q) && q > 0 && Number.isFinite(a) && a > 0;
  }, [form]);

  // prevent body scroll when modal open
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
    if (!formValid || saving) return;
    setSaving(true);

    const newPos: Position = {
      symbol: form.symbol.trim().toUpperCase(),
      qty: Number(form.qty),
      avgPrice: Number(form.avgPrice),
      livePrice: Number(form.avgPrice),
      pnl: 0,
    };

    // optimistic update
    const key = ["/api/portfolio"];
    const prev = qc.getQueryData<PortfolioAPI>(key);
    qc.setQueryData<PortfolioAPI>(key, (old) => {
      const base = old ?? { totalValue: 0, totalPnL: 0, totalPnLPercent: 0, positions: [] };
      return { ...base, positions: [newPos, ...base.positions] };
    });

    try {
      const res = await apiRequest("POST", "/api/portfolio", {
        action: "add",
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
      alert("Could not add position. If your API is different, tell me and I’ll align it.");
    } finally {
      setSaving(false);
    }
  }

  // helper: shared compact height for all four cards
  const compactCard = "p-4 h-[110px] flex flex-col justify-between";

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
              <Button variant="outline" size="sm" data-testid="btn-open-scanner">
                <Eye className="w-4 h-4 mr-2" /> Open Scanner
              </Button>
            </Link>
            <Button size="sm" data-testid="btn-add-position" onClick={() => setOpen(true)}>
              <PlusCircle className="w-4 h-4 mr-2" /> Add Position
            </Button>
          </div>
        </div>

        {/* Live market strip */}
        <div className="mb-6">
          <LiveSummary symbols={["BTCUSDT", "ETHUSDT"]} />
        </div>

        {/* Stat cards — RECTANGULAR + rename Watchlist -> AI Insights */}
        <div className="grid items-stretch grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4 mb-8">
          {/* Total Value */}
          <Card
            className="dashboard-card neon-hover bg-gradient-to-br from-primary/5 to-primary/10"
            style={{ "--neon-glow": "hsl(195, 100%, 60%)" } as React.CSSProperties}
          >
            <CardContent className={compactCard}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Total Value</h3>
                  <p className="text-xl font-bold text-foreground" data-testid="portfolio-total-value">
                    ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <TrendingUp className="w-7 h-7 text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Total P&L */}
          <Card
            className="dashboard-card neon-hover bg-gradient-to-br from-emerald-500/5 to-emerald-500/10"
            style={{ "--neon-glow": "hsl(158, 100%, 50%)" } as React.CSSProperties}
          >
            <CardContent className={compactCard}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Total P&amp;L</h3>
                <p className={`text-xl font-bold ${totalPnL >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="portfolio-total-pnl">
                    {totalPnL >= 0 ? "+" : ""}${totalPnL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className={`text-xs ${totalPnLPercent >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="portfolio-total-pnl-percent">
                    {totalPnLPercent >= 0 ? "+" : ""}{totalPnLPercent.toFixed(2)}%
                  </p>
                </div>
                <Activity className="w-7 h-7 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          {/* Positions count */}
          <Card
            className="dashboard-card neon-hover bg-gradient-to-br from-purple-500/5 to-purple-500/10"
            style={{ "--neon-glow": "hsl(280, 80%, 60%)" } as React.CSSProperties}
          >
            <CardContent className={compactCard}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Positions</h3>
                  <p className="text-xl font-bold text-foreground" data-testid="portfolio-positions-count">
                    {positions.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Active holdings</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Insights (renamed from Watchlist) */}
          <Link href="/ai-insights" className="block">
            <Card
              className="dashboard-card neon-hover bg-gradient-to-br from-indigo-500/5 to-indigo-500/10 cursor-pointer"
              style={{ "--neon-glow": "hsl(240, 100%, 70%)" } as React.CSSProperties}
            >
              <CardContent className={compactCard}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">AI Insights</h3>
                    <p className="text-xl font-bold text-foreground">
                      {aiOverview?.signals?.length ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Active insights</p>
                  </div>
                  <Brain className="w-7 h-7 text-indigo-500" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Holdings table (no structural changes yet; coming in Step 2) */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Holdings</CardTitle>
            <div className="flex items-center gap-2">
              <Link href="/charts">
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-2" /> Scan Market
                </Button>
              </Link>
              <Button size="sm" onClick={() => setOpen(true)}>
                <PlusCircle className="w-4 h-4 mr-2" /> Add Position
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="w-full overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-2 pr-4">Coin</th>
                    <th className="text-right py-2 pr-4">Qty</th>
                    <th className="text-right py-2 pr-4">Entry</th>
                    <th className="text-right py-2 pr-4">Live</th>
                    <th className="text-right py-2">P&amp;L</th>
                  </tr>
                </thead>

                {isLoading ? (
                  <tbody>
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">
                        Loading your portfolio…
                      </td>
                    </tr>
                  </tbody>
                ) : positions.length === 0 ? (
                  <tbody>
                    <tr>
                      <td colSpan={5} className="py-6 text-center">
                        <div className="inline-flex flex-col items-center">
                          <p className="text-foreground font-medium">No positions yet</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Add your first position to start tracking P&amp;L.
                          </p>
                          <Button size="sm" className="mt-3" onClick={() => setOpen(true)}>
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
                      const pnlColor = p.pnl >= 0 ? "text-green-500" : "text-red-500";
                      return (
                        <tr key={p.symbol} className="border-b border-border/50">
                          <td className="py-3 pr-4 font-medium text-foreground">{p.symbol}</td>
                          <td className="py-3 pr-4 text-right">{p.qty}</td>
                          <td className="py-3 pr-4 text-right">
                            ${p.avgPrice.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            ${p.livePrice.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                          </td>
                          <td className={`py-3 text-right ${pnlColor}`}>
                            {p.pnl >= 0 ? "+" : "-"}${Math.abs(p.pnl).toLocaleString("en-US", { maximumFractionDigits: 2 })}
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

      {/* ---- Add Position Modal (solid) ---- */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => (!saving ? setOpen(false) : null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1526] shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Add Position</h3>
              <button
                className="p-1 rounded-md hover:bg-white/5"
                onClick={() => (!saving ? setOpen(false) : null)}
                aria-label="Close"
              >
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

              <label className="text-sm text-muted-foreground mt-4 block">
                Average Entry Price (USDT)
              </label>
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
