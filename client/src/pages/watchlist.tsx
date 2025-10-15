import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatDistanceToNowStrict } from "date-fns";
import { Bookmark, ExternalLink, LineChart, RefreshCcw } from "lucide-react";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { go } from "@/lib/nav";
import { apiRequest } from "@/lib/queryClient";
import { asArray } from "@/lib/utils";
import type { WatchlistItem } from "@shared/schema";

function toDisplayPair(symbol: string) {
  const value = (symbol || "").toUpperCase();
  if (!value) return "BTC/USDT";
  return value.endsWith("USDT") ? `${value.slice(0, -4)}/USDT` : value;
}

function formatRelativeTime(input?: number | string | Date | null) {
  if (!input && input !== 0) return null;
  const date = input instanceof Date ? input : typeof input === "number" ? new Date(input * 1000) : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

export default function WatchlistPage() {
  const { isAuthenticated, isLoading } = useAuth();

  const watchlistQuery = useQuery<WatchlistItem[]>({
    queryKey: ["watchlist-page", isAuthenticated],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/watchlist");
      const json = await res.json();
      return asArray<WatchlistItem>(json);
    },
    enabled: isAuthenticated,
  });

  const watchlistItems = useMemo(
    () => (watchlistQuery.data ? asArray<WatchlistItem>(watchlistQuery.data) : []),
    [watchlistQuery.data],
  );

  const handleSignIn = () => {
    go("#/account");
  };

  const emptyState = (
    <div className="rounded-xl border border-dashed border-border/60 bg-background/40 p-6 text-center">
      <Bookmark className="mx-auto mb-3 h-10 w-10 text-primary" />
      <h3 className="text-lg font-semibold text-foreground">Build your first watchlist</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Add any market from the Analyse workspace to begin tracking live performance.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href="/analyse/BTCUSDT">
          <Button variant="secondary" className="w-full sm:w-auto">
            <LineChart className="mr-2 h-4 w-4" />
            Browse analysis
          </Button>
        </Link>
        <Link href="/analyse/BTCUSDT">
          <Button className="w-full sm:w-auto">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open scanner
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Watchlist</h1>
          <p className="text-muted-foreground">
            Keep your high-priority markets close and jump straight into analysis with a single tap.
          </p>
        </div>
        {isAuthenticated ? (
          <Button
            variant="outline"
            onClick={() => watchlistQuery.refetch()}
            disabled={watchlistQuery.isLoading || watchlistQuery.isRefetching}
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        ) : null}
      </div>

      <Card className="border-border/70 bg-card/70">
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-foreground">Saved markets</CardTitle>
            <p className="text-sm text-muted-foreground">
              Markets you have marked from the Analyse workspace.
            </p>
          </div>
          {watchlistItems.length > 0 ? (
            <Badge variant="secondary" className="w-fit">
              {watchlistItems.length} {watchlistItems.length === 1 ? "symbol" : "symbols"}
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAuthenticated ? (
            <div className="rounded-xl border border-border/60 bg-card/60 p-6 text-center">
              <h3 className="text-lg font-semibold text-foreground">Sign in to sync your watchlist</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Log in to securely store markets across devices and unlock instant access from the dashboard.
              </p>
              <Button onClick={handleSignIn} className="mt-4" disabled={isLoading}>
                Start with Google
              </Button>
            </div>
          ) : watchlistQuery.isLoading || watchlistQuery.isRefetching ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : watchlistQuery.error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center">
              <p className="text-sm font-medium text-destructive">Unable to load watchlist right now.</p>
              <p className="mt-2 text-xs text-destructive/80">
                Please retry in a moment. If the problem persists, verify your network connection.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => watchlistQuery.refetch()}
                disabled={watchlistQuery.isRefetching}
              >
                Try again
              </Button>
            </div>
          ) : watchlistItems.length === 0 ? (
            emptyState
          ) : (
            <div className="space-y-3">
              {watchlistItems.map((item) => {
                const addedAgo = formatRelativeTime(item.createdAt);
                const symbol = toDisplayPair(item.symbol);
                const pathSymbol = (item.symbol || "").toUpperCase();
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/60 p-4 transition hover:border-primary/60 hover:bg-primary/5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-base font-semibold text-foreground">{symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        {addedAgo ? `Added ${addedAgo}` : "Saved market"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Link href={`/analyse/${pathSymbol}`} className="w-full sm:w-auto">
                        <Button className="w-full">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open in Analyse
                        </Button>
                      </Link>
                      <Link href={`/charts/${pathSymbol}`} className="w-full sm:w-auto">
                        <Button variant="outline" className="w-full">
                          <LineChart className="mr-2 h-4 w-4" />
                          View chart
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
