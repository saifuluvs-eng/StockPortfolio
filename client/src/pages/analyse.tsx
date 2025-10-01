import { FormEvent, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import TradingViewChart from "@/components/scanner/trading-view-chart";
import TechnicalIndicators from "@/components/scanner/technical-indicators";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  DEFAULT_SPOT_SYMBOL,
  displayPairFromSymbol,
  ensureUsdtSymbol,
} from "@/lib/symbols";
import {
  DEFAULT_TIMEFRAME,
  SCANNER_TIMEFRAMES,
  toFrontendTimeframe,
} from "@/lib/timeframes";
import {
  formatPrice,
  formatVolume,
  getRecommendationColor,
  getScoreColor,
  formatRelativeTime,
} from "@/lib/scan-format";
import { useSpotTicker } from "@/hooks/useSpotTicker";
import { useSymbolTimeframeWorkspace } from "@/hooks/useSymbolTimeframeWorkspace";
import { useScannerAnalysis } from "@/hooks/useScannerAnalysis";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Activity,
  BarChart3,
  Clock3,
  DollarSign,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  History,
  Star,
} from "lucide-react";
import type { ScanHistoryItem, WatchlistItem } from "@/types/scanner";

const DEFAULT_SYMBOL = DEFAULT_SPOT_SYMBOL;

function buildAnalysePath(symbol: string, timeframe: string) {
  const cleanSymbol = ensureUsdtSymbol(symbol, DEFAULT_SYMBOL);
  const pathSymbol = cleanSymbol === DEFAULT_SYMBOL ? "" : `/${cleanSymbol}`;
  const normalizedTimeframe = toFrontendTimeframe(timeframe || DEFAULT_TIMEFRAME);
  const params = new URLSearchParams();
  if (normalizedTimeframe !== DEFAULT_TIMEFRAME) {
    params.set("tf", normalizedTimeframe);
  }
  const search = params.toString();
  return `/analyse${pathSymbol}${search ? `?${search}` : ""}`;
}

export default function Analyse() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, signInWithGoogle } = useAuth();

  const {
    selectedSymbol,
    selectedTimeframe,
    searchInput,
    setSearchInput,
    setSymbol,
    setTimeframe,
    applySearchSymbol,
  } = useSymbolTimeframeWorkspace({
    routePattern: "/analyse/:symbol?",
    buildPath: buildAnalysePath,
    defaultSymbol: DEFAULT_SYMBOL,
    defaultTimeframe: DEFAULT_TIMEFRAME,
    parseSymbol: (value) => ensureUsdtSymbol(value, DEFAULT_SYMBOL),
    parseTimeframe: (value) => toFrontendTimeframe(value),
  });

  const priceData = useSpotTicker(selectedSymbol);
  const { scanResult, setScanResult, runScan, isScanning } = useScannerAnalysis({
    selectedSymbol,
    selectedTimeframe,
  });

  const watchlistQuery = useQuery({
    queryKey: ["watchlist"],
    enabled: isAuthenticated,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/watchlist");
      return (await res.json()) as WatchlistItem[];
    },
  });

  const historyQuery = useQuery({
    queryKey: ["scan-history"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/scanner/history");
      return (await res.json()) as ScanHistoryItem[];
    },
  });

  const addToWatchlist = useMutation({
    mutationFn: async (symbol: string) => {
      const res = await apiRequest("POST", "/api/watchlist", { symbol });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Added to watchlist",
        description: `${displayPairFromSymbol(selectedSymbol)} is now on your radar.`,
      });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (error: unknown) => {
      if (error instanceof Error && isUnauthorizedError(error)) {
        toast({
          title: "Sign in required",
          description: "Please sign in to manage your watchlist.",
          variant: "destructive",
        });
        signInWithGoogle().catch((authError) => {
          console.error("Failed to sign in after unauthorized error", authError);
        });
        return;
      }
      toast({
        title: "Could not add symbol",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const removeFromWatchlist = useMutation({
    mutationFn: async (symbol: string) => {
      const res = await apiRequest("DELETE", `/api/watchlist/${symbol}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Removed from watchlist",
        description: `${displayPairFromSymbol(selectedSymbol)} was removed from your list.`,
      });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (error: unknown) => {
      if (error instanceof Error && isUnauthorizedError(error)) {
        toast({
          title: "Sign in required",
          description: "Please sign in to manage your watchlist.",
          variant: "destructive",
        });
        signInWithGoogle().catch((authError) => {
          console.error("Failed to sign in after unauthorized error", authError);
        });
        return;
      }
      toast({
        title: "Could not update watchlist",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const watchlistSymbols = (watchlistQuery.data || []).map((item) =>
    (item.symbol || "").toUpperCase(),
  );
  const symbolInWatchlist = watchlistSymbols.includes(selectedSymbol.toUpperCase());

  const formattedPair = useMemo(
    () => displayPairFromSymbol(selectedSymbol),
    [selectedSymbol],
  );
  const timeframeDisplay = useMemo(
    () =>
      SCANNER_TIMEFRAMES.find((tf) => tf.value === selectedTimeframe)?.display ||
      selectedTimeframe,
    [selectedTimeframe],
  );

  const showLoadingState = !priceData;
  const priceChange = showLoadingState
    ? 0
    : parseFloat(priceData?.priceChangePercent || "0");
  const isPositive = priceChange > 0;
  const loadingMessage = showLoadingState ? "Loading..." : "...";

  const handleApply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = (searchInput || "").trim();
    if (!raw) {
      toast({
        title: "Invalid input",
        description: "Enter a coin symbol (e.g., BTC, ETH, SOL)",
        variant: "destructive",
      });
      return;
    }
    const updated = applySearchSymbol(raw.toUpperCase());
    toast({
      title: "Selection updated",
      description: `Now tracking ${displayPairFromSymbol(updated)} on Analyse`,
    });
  };

  const handleRunAnalysis = () => {
    const raw = (searchInput || "").trim().toUpperCase();
    if (raw) {
      const fullSymbol = ensureUsdtSymbol(raw, DEFAULT_SYMBOL);
      if (fullSymbol !== selectedSymbol) {
        setSymbol(fullSymbol);
        setSearchInput("");
        toast({
          title: "Symbol updated",
          description: `Analyzing ${displayPairFromSymbol(fullSymbol)}`,
        });
        setTimeout(() => runScan({ symbol: fullSymbol }), 100);
        return;
      }
    }
    if (!selectedSymbol) {
      toast({
        title: "Invalid symbol",
        description: "Select a valid market before running the scan.",
        variant: "destructive",
      });
      return;
    }
    runScan();
  };

  const handleToggleWatchlist = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Log in to manage your watchlist and save scans.",
        variant: "destructive",
      });
      return;
    }
    if (symbolInWatchlist) {
      removeFromWatchlist.mutate(selectedSymbol);
    } else {
      addToWatchlist.mutate(selectedSymbol);
    }
  };

  const handleLoadFromHistory = (item: ScanHistoryItem) => {
    if (!isAuthenticated) return;
    const filters = item.filters || {};
    const result = item.results;
    const symbol = ensureUsdtSymbol(
      result?.symbol || filters.symbol || selectedSymbol,
      DEFAULT_SYMBOL,
    );
    const frontendTimeframe = toFrontendTimeframe(filters.timeframe);
    setSymbol(symbol);
    if (frontendTimeframe) {
      setTimeframe(frontendTimeframe);
    }
    if (result) {
      setScanResult(result);
    }
    setSearchInput(symbol.replace(/USDT$/i, ""));
    toast({
      title: "Scan loaded",
      description: `Restored ${displayPairFromSymbol(symbol)} (${frontendTimeframe})`,
    });
  };

  const handleSelectWatchlist = (item: WatchlistItem) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please log in to manage your watchlist.",
        variant: "destructive",
      });
      return;
    }
    const normalized = ensureUsdtSymbol(item.symbol, DEFAULT_SYMBOL);
    setSymbol(normalized);
    setSearchInput(normalized.replace(/USDT$/i, ""));
    toast({
      title: "Symbol loaded",
      description: `Loaded ${displayPairFromSymbol(normalized)} from watchlist`,
    });
  };

  const priceSummary = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Price</p>
              <p className="text-lg font-bold text-foreground">
                {showLoadingState ? loadingMessage : formatPrice(priceData?.lastPrice)}
              </p>
            </div>
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">24h Change</p>
              <p className={`text-lg font-bold ${isPositive ? "text-green-500" : "text-red-500"}`}>
                {showLoadingState ? loadingMessage : `${priceChange > 0 ? "+" : ""}${priceChange.toFixed(2)}%`}
              </p>
            </div>
            {isPositive ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">24h Volume</p>
              <p className="text-lg font-bold text-foreground">
                {showLoadingState ? loadingMessage : formatVolume(priceData?.quoteVolume)}
              </p>
            </div>
            <Sparkles className="h-5 w-5 text-secondary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Today&apos;s Range</p>
              <p className="text-sm font-medium text-foreground">
                {showLoadingState ? (
                  loadingMessage
                ) : (
                  <>
                    {formatPrice(priceData?.lowPrice)} - {formatPrice(priceData?.highPrice)}
                  </>
                )}
              </p>
            </div>
            <Clock3 className="h-5 w-5 text-accent" />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-3xl font-semibold">Analyse</CardTitle>
            <Badge variant="outline">alpha</Badge>
          </div>
          <CardDescription>
            A focused lab where we migrate the legacy Charts experience feature by feature. Each block below wires into the
            shared scanner stack so we can isolate regressions before flipping traffic over.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            onSubmit={handleApply}
            className="grid gap-4 rounded-lg border border-border/60 bg-background/60 p-4 md:grid-cols-[1fr_auto_auto] md:items-end"
          >
            <div className="grid gap-2">
              <label htmlFor="analyse-symbol" className="text-sm font-medium">
                Symbol
              </label>
              <div className="relative">
                <Input
                  id="analyse-symbol"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="e.g. BTC"
                  autoCapitalize="characters"
                  className="pl-9"
                />
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium">Timeframe</span>
              <Select value={selectedTimeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="min-w-[160px]">
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  {SCANNER_TIMEFRAMES.map((tf) => (
                    <SelectItem key={tf.value} value={tf.value}>
                      {tf.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="outline" className="h-10 md:h-12">
                Apply selection
              </Button>
              <Button
                type="button"
                onClick={handleRunAnalysis}
                className="h-10 md:h-12"
                disabled={isScanning}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isScanning ? "animate-spin" : ""}`} />
                {isScanning ? "Scanning..." : "Run analysis"}
              </Button>
              <Button
                type="button"
                onClick={handleToggleWatchlist}
                variant={symbolInWatchlist ? "secondary" : "outline"}
                className="h-10 md:h-12"
                disabled={
                  addToWatchlist.isPending || removeFromWatchlist.isPending || isScanning
                }
              >
                <Star
                  className={`mr-2 h-4 w-4 ${
                    symbolInWatchlist ? "fill-yellow-400 text-yellow-400" : ""
                  }`}
                />
                {symbolInWatchlist ? "Watching" : "Add to watchlist"}
              </Button>
            </div>
          </form>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-3 w-3" />
            Currently reviewing
            <span className="font-medium text-foreground">{formattedPair}</span>
            <span>({timeframeDisplay})</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Workspace status</CardTitle>
                <CardDescription>
                  Selection propagated to every module below. Tweak the inputs and watch each card light up once the
                  dependencies are stable.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  <span className="text-muted-foreground">Pair</span>
                  <span className="font-medium">{formattedPair}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  <span className="text-muted-foreground">Timeframe</span>
                  <span className="font-medium">{timeframeDisplay}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Market snapshot</CardTitle>
                <CardDescription>
                  Real-time Binance ticker feed mirrored from Charts so we can compare behaviour side-by-side.
                </CardDescription>
              </CardHeader>
              <CardContent>{priceSummary}</CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/70">
        <CardHeader className="flex flex-col gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5 text-primary" />
            TradingView chart
          </CardTitle>
          <CardDescription>
            Embedded widget wired to the same symbol + timeframe inputs as Charts. Use this to confirm loading errors or
            websocket edge cases before rollout.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <TradingViewChart
            key={`${selectedSymbol}-${selectedTimeframe}`}
            symbol={selectedSymbol}
            interval={selectedTimeframe}
          />
        </CardContent>
      </Card>

      {scanResult ? (
        <Card className="border-border/70 bg-card/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Overall analysis</CardTitle>
            <CardDescription>
              Score + recommendation direct from the scanner API. Compare against the Charts page to spot divergence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-bold ${getScoreColor(scanResult.totalScore)}`}>
                {scanResult.totalScore > 0 ? "+" : ""}
                {scanResult.totalScore}
              </span>
              <Badge className={getRecommendationColor(scanResult.recommendation)}>
                {scanResult.recommendation.replace(/_/g, " ").toUpperCase()}
              </Badge>
            </div>
            <div>
              <Progress
                value={Math.max(0, Math.min(100, ((scanResult.totalScore + 30) / 60) * 100))}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">Range: -30 to +30</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="h-[560px] border-border/70 bg-card/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5 text-primary" />
              Technical breakdown
            </CardTitle>
            <CardDescription>
              Mirrors the Technical Indicators panel from Charts. Once scans succeed here, we&apos;ll port the remaining
              sidebar widgets.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-full overflow-hidden p-0">
            <ScrollArea className="h-full px-4 pb-4">
              {scanResult ? (
                <TechnicalIndicators analysis={scanResult} />
              ) : isScanning ? (
                <div className="space-y-3 py-12">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <Search className="mx-auto mb-4 h-12 w-12 opacity-40" />
                  <h3 className="text-lg font-medium">No analysis yet</h3>
                  <p className="mx-auto mt-1 max-w-xs text-sm">
                    Run a scan to populate the indicator stack and validate the API responses against Charts.
                  </p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="border-border/70 bg-card/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <History className="h-5 w-5 text-primary" />
                Recent scans
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!isAuthenticated ? (
                <p className="text-sm text-muted-foreground">
                  Sign in to keep a searchable log of every analysis you run.
                </p>
              ) : historyQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : historyQuery.error ? (
                <p className="text-sm text-red-400">Could not load scan history right now.</p>
              ) : (historyQuery.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Run your first scan to start building your decision history.
                </p>
              ) : (
                <div className="space-y-3">
                  {historyQuery.data!.slice(0, 6).map((item) => {
                    const filters = item.filters || {};
                    const result = item.results;
                    const symbol = ensureUsdtSymbol(
                      result?.symbol || filters.symbol || selectedSymbol,
                      DEFAULT_SYMBOL,
                    );
                    const frontendTimeframe = toFrontendTimeframe(filters.timeframe);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 p-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {displayPairFromSymbol(symbol)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {frontendTimeframe} • {formatRelativeTime(item.createdAt)}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleLoadFromHistory(item)}>
                          Load
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Star className="h-5 w-5 text-primary" />
                Watchlist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!isAuthenticated ? (
                <p className="text-sm text-muted-foreground">
                  Sign in to curate a personalized watchlist and jump back into symbols instantly.
                </p>
              ) : watchlistQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-10 rounded-xl" />
                  ))}
                </div>
              ) : watchlistQuery.error ? (
                <p className="text-sm text-red-400">Unable to load watchlist right now.</p>
              ) : (watchlistQuery.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No symbols yet. Tap "Add to watchlist" above to build your list.
                </p>
              ) : (
                <div className="space-y-2">
                  {watchlistQuery.data!.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectWatchlist(item)}
                      className={`flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/60 px-4 py-2 text-left transition hover:border-primary/60 hover:bg-primary/5 ${
                        item.symbol.toUpperCase() === selectedSymbol.toUpperCase()
                          ? "border-primary/60"
                          : ""
                      }`}
                    >
                      <span className="text-sm font-medium text-foreground">
                        {displayPairFromSymbol(item.symbol)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Upcoming migrations</CardTitle>
              <CardDescription>
                Track progress as we lift features from Charts &amp; Scan into this consolidated workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  Search, timeframe sync &amp; TradingView embed
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  Watchlist + history panels
                </li>
                <li className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/50" />
                  High potential ideas &amp; intraday scanner module
                </li>
                <li className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/50" />
                  Final QA + redirect from legacy Charts
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Notes &amp; troubleshooting</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-40 rounded-md border border-border/60 bg-muted/5 p-4 text-sm text-muted-foreground">
                <p className="mb-3">
                  • Compare API responses between Analyse and Charts. Any mismatch here highlights the regression we need to
                  fix before deprecating the legacy page.
                </p>
                <p className="mb-3">
                  • Keep an eye on websocket behaviour—this page shares the same ticker stream and should mirror price updates
                  in lockstep.
                </p>
                <p>
                  • Once the ideas feed and intraday scanner blocks land, we&apos;ll schedule the cutover and remove `/charts`.
                </p>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
