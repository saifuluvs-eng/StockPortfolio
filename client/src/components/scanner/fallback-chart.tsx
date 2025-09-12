import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface FallbackChartProps {
  symbol: string;
  interval: string;
}

interface ChartData {
  time: string;
  price: number;
  volume: number;
}

export function FallbackChart({ symbol, interval }: FallbackChartProps) {
  const [chartData, setChartData] = useState<ChartData[]>([]);

  useEffect(() => {
    generateFallbackData();
  }, [symbol, interval]);

  const generateFallbackData = () => {
    // Generate realistic chart data for demonstration
    const basePrice = symbol.includes('BTC') ? 45000 : 
                     symbol.includes('ETH') ? 3000 : 
                     symbol.includes('BNB') ? 400 : 
                     symbol.includes('ADA') ? 0.5 : 
                     symbol.includes('SOL') ? 100 : 50;

    const data: ChartData[] = [];
    const pointsCount = interval === '15m' ? 96 : interval === '1h' ? 24 : interval === '4h' ? 6 : 30;
    
    for (let i = 0; i < pointsCount; i++) {
      const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
      const trendFactor = 0.05 * (i / pointsCount); // Slight upward trend
      const price = basePrice * (1 + variation + trendFactor);
      
      const now = new Date();
      const intervalMs = interval === '15m' ? 15 * 60 * 1000 : 
                        interval === '1h' ? 60 * 60 * 1000 :
                        interval === '4h' ? 4 * 60 * 60 * 1000 :
                        24 * 60 * 60 * 1000;
      
      const time = new Date(now.getTime() - (pointsCount - i) * intervalMs);
      
      data.push({
        time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        price: parseFloat(price.toFixed(symbol.includes('BTC') || symbol.includes('ETH') ? 2 : 4)),
        volume: Math.random() * 1000000 + 100000
      });
    }
    
    setChartData(data);
  };

  return (
    <div className="h-[400px] w-full rounded-b-xl bg-card p-4" data-testid="fallback-chart">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">{symbol}</h3>
        <p className="text-sm text-muted-foreground">
          Demo Chart - {interval} timeframe
        </p>
      </div>
      
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            domain={['dataMin * 0.99', 'dataMax * 1.01']}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              color: 'hsl(var(--foreground))'
            }}
            formatter={(value: number) => [`$${value.toFixed(4)}`, 'Price']}
          />
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
          />
        </LineChart>
      </ResponsiveContainer>
      
      <div className="mt-2 text-xs text-muted-foreground text-center">
        Fallback chart - Real TradingView integration available in production
      </div>
    </div>
  );
}