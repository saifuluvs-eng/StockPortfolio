import type { Express, Request, Response } from "express";

const CACHE_TTL_MS = 5 * 60 * 1000;
type NewsKind = "news" | "media";
type NewsFilter = "latest" | "hot" | "rising" | "bullish" | "bearish" | "important";

const ALLOWED_KINDS: Set<NewsKind> = new Set(["news", "media"]);
const ALLOWED_FILTERS: Set<NewsFilter> = new Set([
  "latest",
  "hot",
  "rising",
  "bullish",
  "bearish",
  "important",
]);

interface CryptoPanicSource {
  title?: string;
  name?: string;
  domain?: string;
}

interface CryptoPanicCurrency {
  code?: string;
}

interface CryptoPanicVotes {
  positive?: number;
  negative?: number;
  important?: number;
  lol?: number;
  saved?: number;
  comments?: number;
}

interface CryptoPanicArticle {
  id?: string | number;
  title?: string;
  url?: string;
  domain?: string;
  source?: CryptoPanicSource;
  published_at?: string;
  created_at?: string;
  kind?: string;
  currencies?: CryptoPanicCurrency[];
  votes?: CryptoPanicVotes;
}

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: { name: string; domain: string };
  publishedAt: string;
  kind: NewsKind;
  currencies: string[];
  votes?: CryptoPanicVotes;
}

export interface NewsResponseBody {
  data: NewsArticle[];
  paging?: { next?: string; page?: number };
}

type CacheRecord = { at: number; payload: NewsResponseBody };

declare global {
  // eslint-disable-next-line no-var
  var __CRYPTOPANIC_CACHE__?: Map<string, CacheRecord>;
}

function getCache(): Map<string, CacheRecord> {
  if (!globalThis.__CRYPTOPANIC_CACHE__) {
    globalThis.__CRYPTOPANIC_CACHE__ = new Map();
  }
  return globalThis.__CRYPTOPANIC_CACHE__;
}

function ensureToken(): string | null {
  const token = process.env.CRYPTOPANIC_TOKEN;
  if (!token || !token.trim()) {
    return null;
  }
  return token;
}

function normalizeKind(input: unknown): NewsKind {
  if (typeof input === "string" && ALLOWED_KINDS.has(input as NewsKind)) {
    return input as NewsKind;
  }
  return "news";
}

function normalizeFilter(input: unknown): NewsFilter {
  if (typeof input !== "string") return "latest";
  const trimmed = input.trim().toLowerCase();
  if (ALLOWED_FILTERS.has(trimmed as NewsFilter)) {
    return trimmed as NewsFilter;
  }
  return "latest";
}

function normalizePage(input: unknown): number {
  const num = Number.parseInt(String(input ?? ""), 10);
  if (Number.isFinite(num) && num > 0) {
    return num;
  }
  return 1;
}

function normalizeUrl(article: CryptoPanicArticle): string {
  if (typeof article.url === "string" && article.url.trim()) {
    return article.url;
  }
  if (typeof article.domain === "string" && article.domain.trim()) {
    return `https://${article.domain}`;
  }
  return "#";
}

function normalizeSource(article: CryptoPanicArticle): { name: string; domain: string } {
  const source = article.source ?? {};
  const domain = String(source.domain ?? article.domain ?? "");
  const cleanedDomain = domain.trim();
  const nameCandidate = source.title ?? source.name ?? cleanedDomain;
  const name = String(nameCandidate || "Source");
  return {
    name,
    domain: cleanedDomain,
  };
}

function normalizePublishedAt(article: CryptoPanicArticle): string {
  if (typeof article.published_at === "string" && article.published_at.trim()) {
    return new Date(article.published_at).toISOString();
  }
  if (typeof article.created_at === "string" && article.created_at.trim()) {
    return new Date(article.created_at).toISOString();
  }
  return new Date().toISOString();
}

function normalizeCurrencies(article: CryptoPanicArticle): string[] {
  if (!Array.isArray(article.currencies)) return [];
  return article.currencies
    .map((currency) => (typeof currency?.code === "string" ? currency.code.toUpperCase() : ""))
    .filter((code) => Boolean(code));
}

function normalizeVotes(votes: CryptoPanicVotes | undefined): CryptoPanicVotes | undefined {
  if (!votes || typeof votes !== "object") return undefined;
  const entries = Object.entries(votes).filter(([, value]) => typeof value === "number" && Number.isFinite(value));
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries) as CryptoPanicVotes;
}

function normalizeArticle(article: CryptoPanicArticle): NewsArticle {
  return {
    id: String(article.id ?? ""),
    title: String(article.title ?? ""),
    url: normalizeUrl(article),
    source: normalizeSource(article),
    publishedAt: normalizePublishedAt(article),
    kind: article.kind === "media" ? "media" : "news",
    currencies: normalizeCurrencies(article),
    votes: normalizeVotes(article.votes),
  };
}

async function fetchFromCryptoPanic(params: URLSearchParams) {
  const response = await fetch(`https://cryptopanic.com/api/v1/posts/?${params.toString()}`);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const error = new Error(`CryptoPanic responded with ${response.status}`);
    (error as any).status = response.status;
    (error as any).detail = detail.slice(0, 300);
    throw error;
  }
  return response.json() as Promise<{ results?: CryptoPanicArticle[]; next?: string | null }>;
}

async function handleNewsRequest(req: Request, res: Response) {
  try {
    const token = ensureToken();
    if (!token) {
      res.status(500).json({ error: "CRYPTOPANIC_TOKEN missing" });
      return;
    }

    const kind = normalizeKind(req.query.kind);
    const filter = normalizeFilter(req.query.filter);
    const currenciesParam = typeof req.query.currencies === "string" ? req.query.currencies : "";
    const currencies = currenciesParam
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.toUpperCase())
      .join(",");
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const page = normalizePage(req.query.page);

    const cacheKey = JSON.stringify({ kind, filter, currencies, q, page });
    const now = Date.now();
    const cache = getCache();
    const hit = cache.get(cacheKey);
    if (hit && now - hit.at < CACHE_TTL_MS) {
      res.json(hit.payload);
      return;
    }

    const params = new URLSearchParams({
      auth_token: token,
      kind,
      page: String(page),
    });

    if (currencies) {
      params.set("currencies", currencies);
    }

    if (q) {
      params.set("q", q);
    }

    if (filter && filter !== "latest") {
      params.set("filter", filter);
    }

    const data = await fetchFromCryptoPanic(params);
    const articles = Array.isArray(data?.results) ? data.results.map(normalizeArticle) : [];
    const paging = {
      page,
      next: typeof data?.next === "string" && data.next.length > 0 ? data.next : undefined,
    };

    const payload: NewsResponseBody = {
      data: articles,
      paging,
    };

    cache.set(cacheKey, { at: now, payload });
    res.json(payload);
  } catch (error) {
    console.error("GET /api/news failed", error);
    if ((error as any)?.status) {
      res.status(502).json({
        error: "CryptoPanic error",
        status: (error as any).status,
        detail: (error as any).detail,
      });
      return;
    }
    res.status(500).json({ error: "Internal error" });
  }
}

export function registerNewsRoute(app: Express) {
  app.get("/api/news", handleNewsRequest);
}
