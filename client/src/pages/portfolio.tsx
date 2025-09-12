import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddPositionModal } from "@/components/portfolio/add-position-modal";
import { EditPositionModal } from "@/components/portfolio/edit-position-modal";
import { PortfolioAllocation } from "@/components/portfolio/portfolio-allocation";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Wallet, TrendingUp, BarChart3, Edit, Trash2 } from "lucide-react";

interface PortfolioPosition {
  id: string;
  symbol: string;
  quantity: string;
  entryPrice: string;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

export default function Portfolio() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<PortfolioPosition | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: positions = [], isLoading: positionsLoading } = useQuery<PortfolioPosition[]>({
    queryKey: ['/api/portfolio'],
    refetchInterval: 10000, // Refresh every 10 seconds for real-time updates
    retry: false,
  });

  const deletePositionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/portfolio/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
      toast({
        title: "Success",
        description: "Position deleted successfully",
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
        description: "Failed to delete position",
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated && !isLoading) {
    return null;
  }

  // Calculate portfolio summary
  const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const totalEntryValue = positions.reduce((sum, pos) => sum + (parseFloat(pos.entryPrice) * parseFloat(pos.quantity)), 0);
  const totalPnLPercent = totalEntryValue > 0 ? (totalPnL / totalEntryValue) * 100 : 0;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
            <Button 
              onClick={() => setShowAddModal(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-add-position"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Position
            </Button>
          </div>

          {/* Portfolio Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Total Value</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-total-value">
                      ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Total P&L</p>
                    <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-accent' : 'text-destructive'}`} data-testid="text-total-pnl">
                      {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">P&L %</p>
                    <p className={`text-2xl font-bold ${totalPnLPercent >= 0 ? 'text-accent' : 'text-destructive'}`} data-testid="text-total-pnl-percent">
                      {totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Portfolio Allocation */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <PortfolioAllocation positions={positions} />
            </div>
            <div className="space-y-6">
              {/* Quick Stats Card */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Best Performer</span>
                      <span className="font-medium text-accent">
                        {positions.length > 0 ? 
                          positions.reduce((best, pos) => pos.pnlPercent > best.pnlPercent ? pos : best)
                            .symbol.replace('USDT', '')
                          : 'N/A'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Worst Performer</span>
                      <span className="font-medium text-destructive">
                        {positions.length > 0 ? 
                          positions.reduce((worst, pos) => pos.pnlPercent < worst.pnlPercent ? pos : worst)
                            .symbol.replace('USDT', '')
                          : 'N/A'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg. P&L%</span>
                      <span className="font-medium">
                        {positions.length > 0 ? 
                          (positions.reduce((sum, pos) => sum + pos.pnlPercent, 0) / positions.length).toFixed(2) + '%'
                          : 'N/A'
                        }
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Holdings Table */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              {positionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading positions...</div>
                </div>
              ) : positions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No positions found</p>
                  <Button onClick={() => setShowAddModal(true)} data-testid="button-add-first-position">
                    Add Your First Position
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-4 text-muted-foreground font-medium">Asset</th>
                        <th className="text-right p-4 text-muted-foreground font-medium">Quantity</th>
                        <th className="text-right p-4 text-muted-foreground font-medium">Entry Price</th>
                        <th className="text-right p-4 text-muted-foreground font-medium">Current Price</th>
                        <th className="text-right p-4 text-muted-foreground font-medium">P&L</th>
                        <th className="text-right p-4 text-muted-foreground font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((position) => {
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
                                  <p className="text-sm text-muted-foreground">{position.symbol}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-right text-foreground" data-testid={`text-quantity-${position.id}`}>
                              {parseFloat(position.quantity).toFixed(8)}
                            </td>
                            <td className="p-4 text-right text-foreground">
                              ${parseFloat(position.entryPrice).toFixed(2)}
                            </td>
                            <td className="p-4 text-right text-foreground" data-testid={`text-current-price-${position.id}`}>
                              ${position.currentPrice.toFixed(2)}
                            </td>
                            <td className="p-4 text-right">
                              <div className={position.pnl >= 0 ? 'text-accent' : 'text-destructive'}>
                                <div className="font-medium" data-testid={`text-pnl-${position.id}`}>
                                  {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                                </div>
                                <div className="text-sm">
                                  ({position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    setSelectedPosition(position);
                                    setShowEditModal(true);
                                  }}
                                  data-testid={`button-edit-${position.id}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => deletePositionMutation.mutate(position.id)}
                                  disabled={deletePositionMutation.isPending}
                                  data-testid={`button-delete-${position.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
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

      <AddPositionModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
      />
      
      <EditPositionModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        position={selectedPosition}
      />
    </div>
  );
}
