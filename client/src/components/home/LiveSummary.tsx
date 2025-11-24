import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Volume, Target } from "lucide-react";

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

// Cache ticker data in localStorage to avoid excessive Binance requests
function getCachedTicker(symbol: string): Ticker | null {
  try {
    const key = `ticker_${symbol}`;
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    // Use cache if less than 30 seconds old
    if (Date.now() - timestamp < 30000) {
      return data;
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

function setCachedTicker(symbol: string, ticker: Ticker): void {
  try {
    const key = `ticker_${symbol}`;
    localStorage.setItem(key, JSON.stringify({ data: ticker, timestamp: Date.now() }));
  } catch {
    // Ignore cache errors
  }
}

async function fetchTickerData(symbol: string): Promise<Ticker | null> {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`);
    if (!response.ok) return null;
    const data = await response.json();
    const ticker = {
      symbol: data.symbol,
      lastPrice: data.lastPrice,
      priceChange: data.priceChange,
      priceChangePercent: data.priceChangePercent,
      highPrice: data.highPrice,
      lowPrice: data.lowPrice,
      volume: data.volume,
      quoteVolume: data.quoteVolume,
    };
    setCachedTicker(symbol, ticker);
    return ticker;
  } catch {
    return null;
  }
}

export default function LiveSummary({ symbols = ["BTCUSDT", "ETHUSDT"] }: Props) {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});

  useEffect(() => {
    let cancelled = false;

    // Load cached data immediately on mount
    const cachedData: Record<string, Ticker> = {};
    for (const symbol of symbols) {
      const cached = getCachedTicker(symbol);
      if (cached) {
        cachedData[symbol] = cached;
      }
    }
    if (Object.keys(cachedData).length > 0) {
      setTickers(cachedData);
    }

    async function fetchAll() {
      const results: Record<string, Ticker> = {};
      for (const symbol of symbols) {
        const ticker = await fetchTickerData(symbol);
        if (ticker && !cancelled) {
          results[symbol] = ticker;
        }
      }
      if (!cancelled && Object.keys(results).length > 0) {
        setTickers(results);
      }
    }

    // Fetch fresh data
    fetchAll();
    // Refetch every 15 seconds (instead of 5) to avoid Binance rate limits
    const id = setInterval(fetchAll, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
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
                  <span className={`text-lg font-bold ${isPos ? "text-accent" : "text-destructive"}`}>
                    {`${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`}
                  </span>
                  {isPos ? <TrendingUp className="w-5 h-5 text-accent" /> : <TrendingDown className="w-5 h-5 text-destructive" />}
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
