import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart } from "lucide-react";

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

interface PortfolioAllocationProps {
  positions: PortfolioPosition[];
}

export function PortfolioAllocation({ positions }: PortfolioAllocationProps) {
  if (!positions || positions.length === 0) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PieChart className="w-5 h-5 text-primary" />
            <span>Portfolio Allocation</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">No positions to display allocation</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
  
  // Calculate allocation percentages and prepare data
  const allocationData = positions
    .map(position => {
      const percentage = totalValue > 0 ? (position.currentValue / totalValue) * 100 : 0;
      const baseAsset = position.symbol.replace('USDT', '');
      
      return {
        symbol: baseAsset,
        fullSymbol: position.symbol,
        value: position.currentValue,
        percentage,
        pnl: position.pnl,
        color: getColorForAsset(baseAsset), // Generate a color for the asset
      };
    })
    .sort((a, b) => b.percentage - a.percentage); // Sort by percentage desc

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <PieChart className="w-5 h-5 text-primary" />
          <span>Portfolio Allocation</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Simple Bar Chart Representation */}
          <div className="space-y-3">
            {allocationData.map((item, index) => (
              <div key={item.fullSymbol} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                      data-testid={`allocation-color-${item.symbol.toLowerCase()}`}
                    />
                    <span className="font-medium text-foreground">{item.symbol}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-muted-foreground">
                      {item.percentage.toFixed(1)}%
                    </span>
                    <span className="font-medium text-foreground">
                      ${item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    }}
                    data-testid={`allocation-bar-${item.symbol.toLowerCase()}`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Summary Stats */}
          <div className="border-t border-border pt-4 mt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Assets</p>
                <p className="font-medium text-foreground" data-testid="text-total-assets">
                  {positions.length}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Largest Position</p>
                <p className="font-medium text-foreground" data-testid="text-largest-position">
                  {allocationData.length > 0 ? `${allocationData[0].symbol} (${allocationData[0].percentage.toFixed(1)}%)` : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to generate consistent colors for assets
function getColorForAsset(symbol: string): string {
  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Emerald  
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#EC4899', // Pink
    '#6366F1', // Indigo
  ];
  
  // Simple hash function to consistently assign colors based on symbol
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}