import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChartIcon, TrendingUp, Wallet } from "lucide-react";

interface AssetAllocationData {
  symbol: string;
  coin: string;
  value: number;
  percentage: number;
  quantity: number;
  color: string;
}

interface AssetAllocationChartProps {
  data: AssetAllocationData[];
  isLoading?: boolean;
  showTable?: boolean;
}

export function AssetAllocationChart({ data, isLoading, showTable }: AssetAllocationChartProps) {
  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-2">
            <PieChartIcon className="w-5 h-5" />
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Asset Allocation</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <div className="text-muted-foreground">Loading allocation data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-2">
            <PieChartIcon className="w-5 h-5" />
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Asset Allocation</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <div className="text-center space-y-2">
              <Wallet className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">No positions to display</p>
              <p className="text-sm text-muted-foreground">Add your first transaction to see allocation</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: data.color }}
            ></div>
            <p className="font-medium">{data.coin}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Value: ${data.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-muted-foreground">
            Allocation: {data.percentage.toFixed(1)}%
          </p>
          <p className="text-sm text-muted-foreground">
            Quantity: {data.quantity.toFixed(8)}
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        {payload?.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            ></div>
            <span className="text-sm font-medium">
              {entry.payload.coin} ({entry.payload.percentage.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-2">
            <PieChartIcon className="w-5 h-5" />
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Asset Allocation</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="percentage"
                  nameKey="coin"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  innerRadius={60}
                  paddingAngle={2}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">
                {data.length}
              </p>
              <p className="text-sm text-muted-foreground">Assets</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">
                ${data.reduce((sum, item) => sum + item.value, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-muted-foreground">Total Value</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-accent">
                {data.length > 0 ? data.reduce((max, item) => item.percentage > max.percentage ? item : max).coin : 'N/A'}
              </p>
              <p className="text-sm text-muted-foreground">Largest</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-muted-foreground">
                {data.length > 0 ? (100 / data.length).toFixed(1) : '0.0'}%
              </p>
              <p className="text-sm text-muted-foreground">Avg. Weight</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {showTable && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex min-w-0 items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Allocation Breakdown</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 text-muted-foreground font-medium">Asset</th>
                    <th className="text-right p-4 text-muted-foreground font-medium">Quantity</th>
                    <th className="text-right p-4 text-muted-foreground font-medium">Value</th>
                    <th className="text-right p-4 text-muted-foreground font-medium">Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {data
                    .sort((a, b) => b.percentage - a.percentage)
                    .map((item) => (
                      <tr key={item.symbol} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: item.color }}
                            ></div>
                            <div>
                              <p className="font-medium text-foreground">{item.coin}</p>
                              <p className="text-sm text-muted-foreground">{item.symbol}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right text-foreground">
                          {item.quantity.toFixed(8)}
                        </td>
                        <td className="p-4 text-right text-foreground">
                          ${item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Badge variant="default">
                              {item.percentage.toFixed(1)}%
                            </Badge>
                            <div className="w-16 h-2 bg-muted rounded-full">
                              <div 
                                className="h-full rounded-full"
                                style={{ 
                                  width: `${item.percentage}%`,
                                  backgroundColor: item.color 
                                }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}