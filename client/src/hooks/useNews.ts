import { useQuery, type UseQueryResult } from "@tanstack/react-query";

export type NewsFilter = "latest" | "hot" | "rising" | "bullish" | "bearish" | "important";

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: { name: string; domain: string };
  publishedAt: string;
  kind: "news" | "media";
  currencies: string[];
  votes?: {
    positive?: number;
    negative?: number;
    important?: number;
    lol?: number;
    saved?: number;
    comments?: number;
  };
}

export interface NewsResponse {
  data: NewsArticle[];
  paging?: { next?: string; page?: number };
}

interface UseNewsOptions {
  filter?: NewsFilter;
  kind?: "news" | "media";
  currencies?: string;
  q?: string;
  page?: number;
}

function resolveApiBase(): string {
  const fromVite = typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_BASE : undefined;
  const fromNext = typeof process !== "undefined" ? (process.env?.NEXT_PUBLIC_API_BASE as string | undefined) : undefined;
  const candidate = (fromVite ?? fromNext ?? "").trim();
  if (!candidate) return "";
  return candidate.replace(/\/+$/, "");
}

export function useNews({
  filter = "latest",
  kind = "news",
  currencies = "",
  q = "",
  page = 1,
}: UseNewsOptions = {}): UseQueryResult<NewsResponse, Error> {
  const upperCurrencies = currencies.trim().toUpperCase();
  const base = resolveApiBase();
  const qs = new URLSearchParams({ filter, kind, page: String(page) });

  if (upperCurrencies) {
    qs.set("currencies", upperCurrencies);
  }

  const trimmedQuery = q.trim();
  if (trimmedQuery) {
    qs.set("q", trimmedQuery);
  }

  const prefix = base ? `${base}` : "";
  const url = `${prefix}/api/news?${qs.toString()}`;

  return useQuery<NewsResponse, Error>({
    queryKey: ["news", { filter, kind, currencies: upperCurrencies, q: trimmedQuery, page }],
    queryFn: async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json() as Promise<NewsResponse>;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
