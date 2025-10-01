import { FormEvent, useEffect, useMemo, useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation, useRoute } from "wouter";
import {
  DEFAULT_SPOT_SYMBOL,
  baseAssetFromUsdt,
  displayPairFromSymbol,
  ensureUsdtSymbol,
} from "@/lib/symbols";

const DEFAULT_TIMEFRAME = "240"; // 4h
const DEFAULT_SYMBOL = DEFAULT_SPOT_SYMBOL;

const TIMEFRAMES = [
  { value: "15", label: "15 minutes", display: "15m" },
  { value: "60", label: "1 hour", display: "1h" },
  { value: "240", label: "4 hours", display: "4h" },
  { value: "D", label: "1 Day", display: "1D" },
  { value: "W", label: "1 Week", display: "1W" },
] as const;

type TimeframeValue = (typeof TIMEFRAMES)[number]["value"];

function toFrontendTimeframe(value: string | undefined | null): TimeframeValue {
  if (!value) return DEFAULT_TIMEFRAME;
  const match = TIMEFRAMES.find((tf) => tf.value === value);
  return (match?.value ?? DEFAULT_TIMEFRAME) as TimeframeValue;
}

function buildAnalysePath(symbol: string, timeframe: TimeframeValue) {
  const cleanSymbol = ensureUsdtSymbol(symbol, DEFAULT_SYMBOL);
  const pathSymbol = cleanSymbol === DEFAULT_SYMBOL ? "" : `/${cleanSymbol}`;
  const searchParams = new URLSearchParams();
  if (timeframe && timeframe !== DEFAULT_TIMEFRAME) {
    searchParams.set("tf", timeframe);
  }
  const search = searchParams.toString();
  return `/analyse${pathSymbol}${search ? `?${search}` : ""}`;
}

export default function Analyse() {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/analyse/:symbol?");

  const [selectedSymbol, setSelectedSymbol] = useState<string>(() =>
    ensureUsdtSymbol(params?.symbol, DEFAULT_SYMBOL),
  );
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeValue>(
    () => {
      if (typeof window === "undefined") return DEFAULT_TIMEFRAME;
      const search = new URLSearchParams(window.location.search);
      return toFrontendTimeframe(search.get("tf"));
    },
  );
  const [searchInput, setSearchInput] = useState<string>(() =>
    baseAssetFromUsdt(selectedSymbol) || "BTC",
  );

  useEffect(() => {
    if (!match) return;
    const nextSymbol = ensureUsdtSymbol(params?.symbol, DEFAULT_SYMBOL);
    const queryTimeframe = (() => {
      if (typeof window === "undefined") return DEFAULT_TIMEFRAME;
      const search = new URLSearchParams(window.location.search);
      return toFrontendTimeframe(search.get("tf"));
    })();

    setSelectedSymbol(nextSymbol);
    setSelectedTimeframe(queryTimeframe);
    setSearchInput(baseAssetFromUsdt(nextSymbol) || "BTC");
  }, [location, match, params?.symbol]);

  const formattedPair = useMemo(() => {
    return displayPairFromSymbol(selectedSymbol);
  }, [selectedSymbol]);

  const handleApply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextSymbol = ensureUsdtSymbol(searchInput, DEFAULT_SYMBOL);
    setSelectedSymbol(nextSymbol);
    const nextPath = buildAnalysePath(searchInput, selectedTimeframe);
    setLocation(nextPath);
  };

  return (
    <div className="space-y-6 pb-10">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-3xl font-semibold">Analyse</CardTitle>
            <Badge variant="outline">alpha</Badge>
          </div>
          <CardDescription>
            A fresh workspace where we will rebuild the Charts experience piece
            by piece. We&apos;re starting with symbol &amp; timeframe controls so we
            can validate each integration before enabling it here.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <form
            onSubmit={handleApply}
            className="grid gap-4 rounded-lg border border-border/60 bg-background/60 p-4 md:grid-cols-[1fr_auto_auto] md:items-end"
          >
            <div className="grid gap-2">
              <label htmlFor="analyse-symbol" className="text-sm font-medium">
                Symbol
              </label>
              <Input
                id="analyse-symbol"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="e.g. BTC"
                autoCapitalize="characters"
              />
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium">Timeframe</span>
              <Select
                value={selectedTimeframe}
                onValueChange={(value) =>
                  setSelectedTimeframe(value as TimeframeValue)
                }
              >
                <SelectTrigger className="min-w-[160px]">
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAMES.map((tf) => (
                    <SelectItem key={tf.value} value={tf.value}>
                      {tf.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="h-10 md:h-12">
              Apply settings
            </Button>
          </form>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Workspace status</CardTitle>
                <CardDescription>
                  Active selection that we&apos;ll wire into each module as it lands
                  on this page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  <span className="text-muted-foreground">Pair</span>
                  <span className="font-medium">{formattedPair}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  <span className="text-muted-foreground">Timeframe</span>
                  <span className="font-medium">
                    {
                      TIMEFRAMES.find((tf) => tf.value === selectedTimeframe)
                        ?.display ?? selectedTimeframe
                    }
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Upcoming modules</CardTitle>
                <CardDescription>
                  We&apos;ll migrate the Charts widgets one by one so we can isolate
                  the regressions we&apos;ve been seeing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    Search &amp; timeframe controls (ready)
                  </li>
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <span className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/50" />
                    TradingView chart embedding
                  </li>
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <span className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/50" />
                    Technical indicators + summary tiles
                  </li>
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <span className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/50" />
                    Watchlist, history &amp; AI scanner blocks
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Chart placeholder</CardTitle>
          <CardDescription>
            The TradingView widget lives here next. Keeping an empty slot avoids
            loading it until we&apos;ve confirmed the controls behave correctly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
            <Skeleton className="h-6 w-[200px]" />
            <Skeleton className="h-[220px] w-full" />
            <p>
              Once we wire the chart, it will subscribe to {formattedPair} on
              the {selectedTimeframe} timeframe.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Notes</CardTitle>
          <CardDescription>
            Keep this page open while you copy features across. Each block can
            be toggled on independently as soon as its API calls are stable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-40 rounded-md border border-border/60 bg-muted/5 p-4 text-sm text-muted-foreground">
            <p className="mb-3">
              1. Reuse the existing hooks/utilities from the Charts page instead
              of duplicating logic.
            </p>
            <p className="mb-3">
              2. Ship features in the order listed above. Leave cards in a
              disabled state until the connected API behaves locally.
            </p>
            <p>
              3. When Analyse covers every widget, we&apos;ll flip the navigation to
              point here and retire the legacy Charts route.
            </p>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
