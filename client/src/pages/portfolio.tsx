import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AddTransactionModal } from "@/components/portfolio/add-transaction-modal";
import { AssetAllocationChart } from "@/components/portfolio/asset-allocation-chart";
import { PerformanceChart } from "@/components/portfolio/performance-chart";
import { TransactionHistory } from "@/components/portfolio/transaction-history";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Wallet, TrendingUp, BarChart3, Activity, Target, Clock, ArrowUpRight, ArrowDownRight, DollarSign, Search, X, ExternalLink } from "lucide-react";
import { Link } from "wouter";

interface Transaction {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: string;
  price: string;
  fee?: string;
  feeAsset?: string;
  tradeId?: string;
  executedAt: string;
  notes?: string;
  createdAt: string;
}

interface EnrichedPosition {
  id: string;
  symbol: string;
  quantity: string;
  entryPrice: string;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  allocation: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
}

interface PortfolioSummary {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  positions: EnrichedPosition[];
}

interface AssetAllocation {
  symbol: string;
  coin: string;
  value: number;
  percentage: number;
  quantity: number;
  color: string;
}

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

export default function Portfolio() {
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState("overview");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading } = useAuth();

  // Show sign-in UI if not authenticated (no auto-redirect)
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Wallet className="w-6 h-6" />
                Portfolio Access
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Please sign in to access your portfolio and track your crypto investments.
              </p>
              <Button 
                onClick={() => window.location.href = "/api/login"}
                className="w-full"
                data-testid="button-sign-in"
              >
                Sign In with Replit
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Fetch enhanced portfolio data
  const { data: portfolioSummary, isLoading: portfolioLoading } = useQuery<PortfolioSummary>({
    queryKey: ['/api/portfolio'],
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
    retry: false,
  });

  const { data: assetAllocation = [], isLoading: allocationLoading } = useQuery<AssetAllocation[]>({
    queryKey: ['/api/portfolio/allocation'],
    refetchInterval: 10000,
    retry: false,
  });

  const { data: performanceMetrics, isLoading: performanceLoading } = useQuery<PerformanceMetrics>({
    queryKey: ['/api/portfolio/performance'],
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false,
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ['/api/portfolio/transactions'],
    refetchInterval: 30000,
    retry: false,
  });

  // Delete position mutation
  const deletePositionMutation = useMutation({
    mutationFn: async (positionId: string) => {
      await apiRequest('DELETE', `/api/portfolio/${positionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/allocation'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/performance'] });
      toast({
        title: "Position Deleted",
        description: "The position has been removed from your portfolio",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete position. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeletePosition = (positionId: string) => {
    if (window.confirm("Are you sure you want to delete this position? This action cannot be undone.")) {
      deletePositionMutation.mutate(positionId);
    }
  };

  // Removed redundant null return - sign-in UI is already handled above

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
              <p className="text-muted-foreground">Real-time P&L tracking and analytics</p>
            </div>
            <Button 
              onClick={() => setShowAddTransactionModal(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-add-transaction"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Coin
            </Button>
          </div>

          {/* Enhanced Portfolio Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="border-border bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Total Value</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-total-value">
                      ${portfolioSummary ? portfolioSummary.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </p>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      <Activity className="w-3 h-3 mr-1" />
                      Live
                    </Badge>
                  </div>
                  <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-gradient-to-br from-accent/5 to-accent/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Total P&L</p>
                    <p className={`text-2xl font-bold ${(portfolioSummary?.totalPnL || 0) >= 0 ? 'text-accent' : 'text-destructive'}`} data-testid="text-total-pnl">
                      {(portfolioSummary?.totalPnL || 0) >= 0 ? '+' : ''}${(portfolioSummary?.totalPnL || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className={`text-sm ${(portfolioSummary?.totalPnLPercent || 0) >= 0 ? 'text-accent' : 'text-destructive'}`}>
                      {(portfolioSummary?.totalPnLPercent || 0) >= 0 ? '+' : ''}{(portfolioSummary?.totalPnLPercent || 0).toFixed(2)}%
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-gradient-to-br from-blue-500/5 to-blue-500/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">24h Change</p>
                    <p className={`text-2xl font-bold ${(portfolioSummary?.dayChange || 0) >= 0 ? 'text-accent' : 'text-destructive'}`} data-testid="text-day-change">
                      {(portfolioSummary?.dayChange || 0) >= 0 ? '+' : ''}${(portfolioSummary?.dayChange || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className={`text-sm ${(portfolioSummary?.dayChangePercent || 0) >= 0 ? 'text-accent' : 'text-destructive'}`}>
                      {(portfolioSummary?.dayChangePercent || 0) >= 0 ? '+' : ''}{(portfolioSummary?.dayChangePercent || 0).toFixed(2)}%
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Clock className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-gradient-to-br from-purple-500/5 to-purple-500/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">Win Rate</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-win-rate">
                      {performanceMetrics ? performanceMetrics.winRate.toFixed(1) : '0.0'}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Avg: {performanceMetrics ? performanceMetrics.avgWinPercent.toFixed(1) : '0.0'}%
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Target className="w-6 h-6 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Portfolio Analytics */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="allocation">Allocation</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Current Holdings - moved to main section */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    Current Holdings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {portfolioLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-muted-foreground">Loading positions...</div>
                    </div>
                  ) : (!portfolioSummary?.positions || portfolioSummary.positions.length === 0) ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">No positions found</p>
                      <Button onClick={() => setShowAddTransactionModal(true)} data-testid="button-add-first-transaction">
                        Add Your First Coin
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-4 text-muted-foreground font-medium">Asset</th>
                            <th className="text-right p-4 text-muted-foreground font-medium">Allocation</th>
                            <th className="text-right p-4 text-muted-foreground font-medium">Quantity</th>
                            <th className="text-right p-4 text-muted-foreground font-medium">Value</th>
                            <th className="text-right p-4 text-muted-foreground font-medium">P&L</th>
                            <th className="text-right p-4 text-muted-foreground font-medium">24h Change</th>
                            <th className="text-center p-4 text-muted-foreground font-medium">Analyse</th>
                            <th className="text-center p-4 text-muted-foreground font-medium">Close</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(portfolioSummary?.positions ?? [])
                            .slice()
                            .sort((a, b) => b.marketValue - a.marketValue)
                            .map((position) => {
                              const baseAsset = position.symbol.replace('USDT', '');
                              
                              return (
                                <tr key={position.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                                  <td className="p-4">
                                    <div className="flex items-center space-x-3">
                                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                                        <span className="text-xs font-bold text-primary-foreground">
                                          {baseAsset.slice(0, 3)}
                                        </span>
                                      </div>
                                      <div>
                                        <p className="font-medium text-foreground">{baseAsset}</p>
                                        <p className="text-sm text-muted-foreground">${position.currentPrice.toFixed(2)}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4 text-right">
                                    <div className="flex flex-col items-end">
                                      <span className="font-medium">{position.allocation.toFixed(1)}%</span>
                                      <div className="w-16 h-2 bg-muted rounded-full mt-1">
                                        <div 
                                          className="h-full bg-primary rounded-full"
                                          style={{ width: `${position.allocation}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4 text-right text-foreground" data-testid={`text-quantity-${position.id}`}>
                                    {parseFloat(position.quantity).toFixed(8)}
                                  </td>
                                  <td className="p-4 text-right text-foreground">
                                    ${position.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-4 text-right">
                                    <div className={position.unrealizedPnL >= 0 ? 'text-accent' : 'text-destructive'}>
                                      <div className="font-medium" data-testid={`text-pnl-${position.id}`}>
                                        {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </div>
                                      <div className="text-sm">
                                        {position.unrealizedPnL >= 0 ? '+' : ''}{position.unrealizedPnLPercent.toFixed(2)}%
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4 text-right">
                                    <div className={position.dayChangePercent >= 0 ? 'text-accent' : 'text-destructive'}>
                                      <div className="font-medium">
                                        {position.dayChangePercent >= 0 ? '+' : ''}{position.dayChangePercent.toFixed(2)}%
                                      </div>
                                      <div className="text-sm">
                                        {position.dayChangePercent >= 0 ? '+' : ''}${position.dayChange.toFixed(2)}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4 text-center">
                                    <Link 
                                      href={`/charts?symbol=${position.symbol}&scan=true`}
                                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
                                      data-testid={`button-analyse-${position.id}`}
                                    >
                                      <Search className="w-3 h-3" />
                                      Scan
                                    </Link>
                                  </td>
                                  <td className="p-4 text-center">
                                    <button
                                      onClick={() => handleDeletePosition(position.id)}
                                      className="inline-flex items-center justify-center w-8 h-8 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                      data-testid={`button-close-${position.id}`}
                                      title="Delete position"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
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
              
              {/* Quick Stats and Top Performers - moved below Current Holdings */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quick Stats Card */}
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Quick Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Best Performer</span>
                        <div className="flex items-center gap-1">
                          <ArrowUpRight className="w-4 h-4 text-accent" />
                          <span className="font-medium text-accent">
                            {portfolioSummary?.positions?.length ? 
                              portfolioSummary.positions
                                .reduce((best, pos) => pos.unrealizedPnLPercent > best.unrealizedPnLPercent ? pos : best)
                                .symbol.replace('USDT', '')
                              : 'N/A'
                            }
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Worst Performer</span>
                        <div className="flex items-center gap-1">
                          <ArrowDownRight className="w-4 h-4 text-destructive" />
                          <span className="font-medium text-destructive">
                            {portfolioSummary?.positions?.length ? 
                              portfolioSummary.positions
                                .reduce((worst, pos) => pos.unrealizedPnLPercent < worst.unrealizedPnLPercent ? pos : worst)
                                .symbol.replace('USDT', '')
                              : 'N/A'
                            }
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total Positions</span>
                        <span className="font-medium">
                          {portfolioSummary?.positions?.length || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Avg. Allocation</span>
                        <span className="font-medium">
                          {portfolioSummary?.positions?.length ? 
                            (100 / portfolioSummary.positions.length).toFixed(1) + '%'
                            : 'N/A'
                          }
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Performers Card */}
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Top Performers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(portfolioSummary?.positions ?? [])
                        .slice()
                        .sort((a, b) => b.unrealizedPnLPercent - a.unrealizedPnLPercent)
                        .slice(0, 3)
                        .map((position) => (
                          <div key={position.id} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                                <span className="text-xs font-bold text-primary-foreground">
                                  {position.symbol.replace('USDT', '').slice(0, 2)}
                                </span>
                              </div>
                              <span className="font-medium">
                                {position.symbol.replace('USDT', '')}
                              </span>
                            </div>
                            <div className={`text-sm font-medium ${position.unrealizedPnLPercent >= 0 ? 'text-accent' : 'text-destructive'}`}>
                              {position.unrealizedPnLPercent >= 0 ? '+' : ''}{position.unrealizedPnLPercent.toFixed(2)}%
                            </div>
                          </div>
                        )) || []
                      }
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="allocation" className="space-y-6">
              <AssetAllocationChart data={assetAllocation} isLoading={allocationLoading} showTable />
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              <PerformanceChart 
                metrics={performanceMetrics} 
                isLoading={performanceLoading}
                summary={portfolioSummary}
              />
            </TabsContent>

            <TabsContent value="transactions" className="space-y-6">
              <TransactionHistory 
                transactions={transactions} 
                isLoading={transactionsLoading}
                onAddTransaction={() => setShowAddTransactionModal(true)}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <AddTransactionModal
        open={showAddTransactionModal}
        onOpenChange={setShowAddTransactionModal}
      />
    </div>
  );
}
