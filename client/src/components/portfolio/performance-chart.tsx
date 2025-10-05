import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Target, DollarSign, Activity, BarChart3 } from "lucide-react";

interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgWinPercent: number;
  avgLossPercent: number;
  bestTrade: number;
  worstTrade: number;
}

interface PortfolioSummary {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

interface PerformanceChartProps {
  metrics?: PerformanceMetrics;
  summary?: PortfolioSummary;
  isLoading?: boolean;
}

export function PerformanceChart({ metrics, summary, isLoading }: PerformanceChartProps) {
  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              Performance Analytics
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <div className="text-muted-foreground">Loading performance data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mock chart data for demonstration
  const performanceData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    portfolioValue: 10000 + Math.random() * 2000 + (summary?.totalValue || 0) * (i / 30),
    pnl: (Math.random() - 0.5) * 1000,
  }));

  const tradeData = [
    { type: 'Winning Trades', count: metrics ? Math.round((metrics.winRate / 100) * 20) : 12, color: '#10b981' },
    { type: 'Losing Trades', count: metrics ? Math.round(((100 - metrics.winRate) / 100) * 20) : 8, color: '#ef4444' },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey === 'portfolioValue' ? 'Portfolio Value: ' : 'P&L: '}
              ${entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Performance Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-gradient-to-br from-accent/5 to-accent/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Return</p>
                <p className={`text-xl font-bold ${(summary?.totalPnL || 0) >= 0 ? 'text-accent' : 'text-destructive'}`}>
                  {summary?.totalPnL ? 
                    `${summary.totalPnL >= 0 ? '+' : ''}$${summary.totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                    '$0.00'
                  }
                </p>
                <p className={`text-xs ${(summary?.totalPnLPercent || 0) >= 0 ? 'text-accent' : 'text-destructive'}`}>
                  {summary?.totalPnLPercent ? 
                    `${summary.totalPnLPercent >= 0 ? '+' : ''}${summary.totalPnLPercent.toFixed(2)}%` : 
                    '0.00%'
                  }
                </p>
              </div>
              <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-gradient-to-br from-blue-500/5 to-blue-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
                <p className="text-xl font-bold text-foreground">
                  {metrics ? metrics.winRate.toFixed(1) : '0.0'}%
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg Win: {metrics ? metrics.avgWinPercent.toFixed(1) : '0.0'}%
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-gradient-to-br from-purple-500/5 to-purple-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Best Trade</p>
                <p className="text-xl font-bold text-accent">
                  ${metrics ? metrics.bestTrade.toFixed(2) : '0.00'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Single transaction
                </p>
              </div>
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-gradient-to-br from-orange-500/5 to-orange-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Worst Trade</p>
                <p className="text-xl font-bold text-destructive">
                  ${metrics ? metrics.worstTrade.toFixed(2) : '0.00'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Single transaction
                </p>
              </div>
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Charts */}
      <Tabs defaultValue="portfolio" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="portfolio">Portfolio Performance</TabsTrigger>
          <TabsTrigger value="trades">Trading Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex min-w-0 items-center gap-2">
                <Activity className="w-5 h-5" />
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                  Portfolio Value Over Time
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="portfolioValue"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: "#8b5cf6" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trades" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex min-w-0 items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Win/Loss Analysis</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tradeData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="type" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value) => [`${value} trades`, 'Count']}
                      labelStyle={{ color: 'var(--foreground)' }}
                      contentStyle={{ 
                        backgroundColor: 'var(--background)', 
                        border: '1px solid var(--border)',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="#8884d8"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Additional Trade Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
                <div className="text-center">
                  <p className="text-lg font-bold text-accent">
                    {metrics ? metrics.avgWinPercent.toFixed(1) : '0.0'}%
                  </p>
                  <p className="text-sm text-muted-foreground">Avg Win %</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-destructive">
                    {metrics ? metrics.avgLossPercent.toFixed(1) : '0.0'}%
                  </p>
                  <p className="text-sm text-muted-foreground">Avg Loss %</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">
                    {metrics ? metrics.sharpeRatio.toFixed(2) : '0.00'}
                  </p>
                  <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">
                    {metrics ? metrics.maxDrawdown.toFixed(1) : '0.0'}%
                  </p>
                  <p className="text-sm text-muted-foreground">Max Drawdown</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}