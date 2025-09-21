import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Volume, Target } from "lucide-react";
import { openSpotTickerStream } from "@/lib/binanceWs";

type Ticker = {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
};

type Props = {
  symbols?: string[]; // default ['BTCUSDT','ETHUSDT']
};

function formatPrice(price: string | undefined) {
  const num = parseFloat(price || "0");
  if (Number.isNaN(num)) return "$0.00";
  if (num >= 1000) return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (num >= 1) return `$${num.toFixed(4)}`;
  return `$${num.toFixed(8)}`;
}

function formatVolume(volume: string | undefined) {
  const num = parseFloat(volume || "0");
  if (Number.isNaN(num)) return "$0.00";
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

export default function LiveSummary({ symbols = ["BTCUSDT", "ETHUSDT"] }: Props) {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});

  useEffect(() => {
    const unsubscribe = openSpotTickerStream(symbols, (t) => {
      setTickers((prev) => ({ ...prev, [t.symbol]: t }));
    });
    return unsubscribe;
  }, [symbols.join("|")]); // stable enough for this simple case

  const cards = useMemo(() => {
    return symbols.map((sym) => {
      const t = tickers[sym];
      const pct = parseFloat(t?.priceChangePercent ?? "0");
      const isPos = pct > 0;
      return (
        <Card key={sym}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm text-muted-foreground">{sym.replace("USDT", "/USDT")}</div>
              <Badge className={isPos ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
                {isPos ? "BULLISH" : "BEARISH"}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Price</p>
                <p className="text-lg font-bold text-foreground">{formatPrice(t?.lastPrice)}</p>
              </div>
              <DollarSign className="w-5 h-5 text-primary" />
            </div>

            <div className="flex items-center justify-between mt-2">
              <div>
                <p className="text-sm text-muted-foreground">24h Change</p>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${isPos ? "text-green-500" : "text-red-500"}`}>
                    {`${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`}
                  </span>
                  {isPos ? <TrendingUp className="w-5 h-5 text-green-500" /> : <TrendingDown className="w-5 h-5 text-red-500" />}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">24h Volume</span>
                <span className="text-sm font-medium text-foreground">{formatVolume(t?.quoteVolume)}</span>
                <Volume className="w-4 h-4 text-secondary ml-2" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">High / Low</span>
                <span className="text-xs font-medium text-foreground">
                  {formatPrice(t?.highPrice)} / {formatPrice(t?.lowPrice)}
                </span>
                <Target className="w-4 h-4 text-accent ml-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      );
    });
  }, [symbols, tickers]);

  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{cards}</div>;
}
