import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { useNews, type NewsFilter, type NewsArticle } from "@/hooks/useNews";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const FILTERS: { value: NewsFilter; label: string }[] = [
  { value: "latest", label: "Latest" },
  { value: "hot", label: "Hot" },
  { value: "rising", label: "Rising" },
  { value: "bullish", label: "Bullish" },
  { value: "bearish", label: "Bearish" },
  { value: "important", label: "Important" },
];

const SYMBOLS = ["", "BTC", "ETH", "SOL", "XRP", "DASH"];

function ArticleCard({ article }: { article: NewsArticle }) {
  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true });
    } catch {
      return "recently";
    }
  }, [article.publishedAt]);

  return (
    <a
      href={article.url.replace(/\/+$/, "")}
      target="_blank"
      rel="noreferrer"
      className="block rounded-xl border border-border bg-card p-4 transition hover:border-primary/50 hover:bg-card/80"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="default" className="bg-muted text-foreground">
          {article.source.name}
        </Badge>
        {article.source.domain && <span className="truncate text-muted-foreground/80">{article.source.domain}</span>}
        <span aria-hidden="true">•</span>
        <span>{timeAgo}</span>
        {article.currencies.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2">
            {article.currencies.map((currency) => (
              <Badge key={currency} variant="outline" className="text-foreground">
                {currency}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-start gap-3">
        <h3 className="flex-1 text-base font-semibold leading-6 text-foreground">{article.title}</h3>
        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
    </a>
  );
}

export default function NewsPage() {
  const [filter, setFilter] = useState<NewsFilter>("latest");
  const [kind, setKind] = useState<"news" | "media">("news");
  const [symbol, setSymbol] = useState<string>("");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      setPage(1);
      setQ(searchInput.trim());
    }, 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const { data: newsData, isLoading, isFetching, isError, error } = useNews({
    filter,
    kind,
    currencies: symbol,
    q,
    page,
  });
  const queryClient = useQueryClient();

  const articles: NewsArticle[] = newsData?.data ?? [];
  const hasNext = Boolean(newsData?.paging?.next);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["news"] });
  };

  const errorMessage = isError && error instanceof Error ? error.message : null;

  return (
    <div className="flex-1 overflow-hidden">
      <div className="p-3 sm:p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">News &amp; Insights</h1>
            <p className="text-sm text-muted-foreground">
              Stay ahead with curated headlines and sentiment straight from CryptoPanic.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={isFetching} className="min-h-[44px]">
            <RefreshCw className={cn("w-4 h-4 sm:mr-2", isFetching && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>

        <div className="space-y-3">
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search headlines…"
            className="w-full text-sm"
          />
        </div>

        <div className="grid gap-3">
          {isLoading && <div className="text-sm text-muted-foreground">Loading news…</div>}
          {isError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Failed to load news{errorMessage ? `: ${errorMessage}` : "."}
            </div>
          )}
          {!isLoading && !isFetching && !isError && articles.length === 0 && (
            <div className="rounded-md border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
              No articles found for the current filters.
            </div>
          )}
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
          {isFetching && !isLoading && (
            <div className="text-xs text-muted-foreground">Refreshing…</div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
          <span>Source: CryptoPanic</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!hasNext}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
