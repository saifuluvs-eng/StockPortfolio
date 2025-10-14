import express from "express";
import type { Express } from "express";

export const news = express.Router();

news.get("/", async (req, res) => {
  try {
    if (!process.env.CRYPTOPANIC_TOKEN) {
      return res.status(500).json({ error: "CRYPTOPANIC_TOKEN missing" });
    }

    const allowedFilters = new Set([
      "latest",
      "hot",
      "rising",
      "bullish",
      "bearish",
      "important",
    ]);
    const kind = String(req.query.kind || "").toLowerCase() === "media" ? "media" : "news";
    const filterValue = String(req.query.filter || "").toLowerCase();
    const filter = allowedFilters.has(filterValue) ? filterValue : "latest";
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);

    let currencies = String(req.query.currencies || "").trim().toUpperCase();
    if (!currencies || currencies === "ALL") {
      currencies = "";
    } else {
      currencies = currencies.replace(/[^A-Z,]/g, "");
    }

    const q = String(req.query.q || "").trim();

    const key = JSON.stringify({ kind, filter, currencies, q, page });
    const now = Date.now();
    (globalThis as any).__NEWS_CACHE ??= new Map();
    const cache = (globalThis as any).__NEWS_CACHE as Map<string, { at: number; data: any }>;
    const TTL = 5 * 60 * 1000;
    const hit = cache.get(key);
    if (hit && now - hit.at < TTL) {
      return res.json(hit.data);
    }

    const params = new URLSearchParams({
      auth_token: process.env.CRYPTOPANIC_TOKEN!,
      kind,
      page: String(page),
    });
    if (filter !== "latest") params.set("filter", filter);
    if (currencies) params.set("currencies", currencies);
    if (q) params.set("q", q);

    const url = `https://cryptopanic.com/api/v1/posts/?${params.toString()}`;
    const r = await fetch(url, { method: "GET" });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      const out = {
        error: "CryptoPanic error",
        status: r.status,
        detail: txt.slice(0, 300),
      };
      cache.set(key, { at: now, data: out });
      return res.status(502).json(out);
    }
    const j = await r.json();

    const articles = (j?.results || []).map((it: any) => ({
      id: String(it?.id ?? ""),
      title: String(it?.title ?? ""),
      url: String(it?.url ?? it?.domain ?? "#"),
      source: {
        name: it?.source?.title ?? it?.source?.name ?? it?.domain ?? "Source",
        domain: it?.domain ?? it?.source?.domain ?? "",
      },
      publishedAt: it?.published_at ?? it?.created_at ?? new Date().toISOString(),
      kind: it?.kind === "media" ? "media" : "news",
      currencies: Array.isArray(it?.currencies)
        ? it.currencies.map((c: any) => String(c?.code || "").toUpperCase()).filter(Boolean)
        : [],
      votes: it?.votes || undefined,
    }));

    const out = { data: articles, paging: { next: j?.next || null, page } };
    cache.set(key, { at: now, data: out });
    return res.json(out);
  } catch (err: any) {
    console.error("GET /api/news failed", err?.message || err);
    return res.status(500).json({ error: "Internal error" });
  }
});

export function registerNewsRoute(app: Express) {
  app.use("/api/news", news);
}
