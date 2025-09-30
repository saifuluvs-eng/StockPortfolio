// client/src/pages/portfolio.tsx
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Activity, PlusCircle, Eye } from "lucide-react";

type PortfolioAPI = {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  positions: Array<{
    symbol: string;
    qty: number;
    avgPrice: number;
    livePrice: number;
    pnl: number;
  }>;
};

export default function Portfolio() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<PortfolioAPI>({
    queryKey: ["/api/portfolio"],
    enabled: !!user,
    refetchInterval: 15000,
  });

  const totalValue = data?.totalValue ?? 0;
  const totalPnL = data?.totalPnL ?? 0;
  const totalPnLPercent = data?.totalPnLPercent ?? 0;
  const positions = data?.positions ?? [];

  return (
    <div className="flex-1 overflow-hidden">
      <div className="p-6">
        {/* Header (same look/spacing as Dashboard) */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Your Portfolio</h1>
            <p className="text-muted-foreground mt-1">
              Positions, P&amp;L, and live performance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/charts">
              <Button variant="outline" size="sm" data-testid="btn-open-scanner">
                <Eye className="w-4 h-4 mr-2" /> Open Scanner
              </Button>
            </Link>
            <Button size="sm" data-testid="btn-add-position">
              <PlusCircle className="w-4 h-4 mr-2" /> Add Position
            </Button>
          </div>
        </div>

        {/* Stat cards — reuse Dashboard card styles */}
        <div className="grid items-stretch grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
          {/* Total Value */}
          <Card
            className="dashboard-card neon-hover bg-gradient-to-br from-primary/5 to-primary/10"
            style={{ "--neon-glow": "hsl(195, 100%, 60%)" } as React.CSSProperties}
          >
            <CardContent className="p-6 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Total Value</h3>
                  <p className="text-2xl font-bold text-foreground" data-testid="portfolio-total-value">
                    ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Total P&L */}
          <Card
            className="dashboard-card neon-hover bg-gradient-to-br from-emerald-500/5 to-emerald-500/10"
            style={{ "--neon-glow": "hsl(158, 100%, 50%)" } as React.CSSProperties}
          >
            <CardContent className="p-6 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Total P&amp;L</h3>
                  <p
                    className={`text-2xl font-bold ${totalPnL >= 0 ? "text-green-500" : "text-red-500"}`}
                    data-testid="portfolio-total-pnl"
                  >
                    {totalPnL >= 0 ? "+" : ""}${totalPnL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p
                    className={`text-xs ${totalPnLPercent >= 0 ? "text-green-500" : "text-red-500"}`}
                    data-testid="portfolio-total-pnl-percent"
                  >
                    {totalPnLPercent >= 0 ? "+" : ""}
                    {totalPnLPercent.toFixed(2)}%
                  </p>
                </div>
                <Activity className="w-8 h-8 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          {/* Positions count */}
          <Card
            className="dashboard-card neon-hover bg-gradient-to-br from-purple-500/5 to-purple-500/10"
            style={{ "--neon-glow": "hsl(280, 80%, 60%)" } as React.CSSProperties}
          >
            <CardContent className="p-6 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Positions</h3>
                  <p className="text-2xl font-bold text-foreground" data-testid="portfolio-positions-count">
                    {positions.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Active holdings</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table card */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading your portfolio…</p>
            ) : positions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <p className="text-foreground font-medium">No positions yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add your first position to start tracking P&amp;L.
                </p>
                <div className="mt-4">
                  <Button size="sm">
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Add Position
                  </Button>
                </div>
              </div>
            ) : (
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
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
