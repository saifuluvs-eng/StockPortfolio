import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
    res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

    if (req.method === "OPTIONS") {
        res.status(200).end();
        return;
    }

    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        if (!process.env.CRYPTOPANIC_TOKEN) {
            console.error("CRYPTOPANIC_TOKEN missing");
            return res.status(500).json({ error: "Server configuration error: CRYPTOPANIC_TOKEN missing" });
        }

        const allowedFilters = new Set([
            "hot",
            "rising",
            "bullish",
            "bearish",
            "important",
        ]);

        const query = req.query || {};
        const kindValue = String(query.kind || "").toLowerCase();
        const kind = ["news", "media", "all"].includes(kindValue) ? kindValue : "all";
        const filterValue = String(query.filter || "").toLowerCase();
        const filter = filterValue === "latest" ? "latest" : allowedFilters.has(filterValue) ? filterValue : "latest";
        const page = Math.max(1, parseInt(String(query.page || "1"), 10) || 1);

        let currencies = String(query.currencies || "").trim().toUpperCase();
        if (!currencies || currencies === "ALL") {
            currencies = "";
        } else {
            currencies = currencies.replace(/[^A-Z,]/g, "");
        }

        const search = String(query.search || "").trim();

        // Cache key
        const key = JSON.stringify({ kind, filter, currencies, search, page });
        const now = Date.now();

        // Simple in-memory cache for serverless (might not persist across invocations but helps with bursts)
        // Note: In Vercel serverless, global state isn't guaranteed to persist, but often does for warm starts.
        (globalThis as any).__NEWS_CACHE ??= new Map();
        const cache = (globalThis as any).__NEWS_CACHE as Map<string, { at: number; data: any }>;
        const TTL = 5 * 60 * 1000;
        const hit = cache.get(key);
        if (hit && now - hit.at < TTL) {
            return res.json(hit.data);
        }

        const params = new URLSearchParams({
            auth_token: process.env.CRYPTOPANIC_TOKEN!,
            public: "true",
            kind: kind === "all" ? "news" : kind,
            page: String(page),
        });
        if (filter !== "latest") params.set("filter", filter);
        if (currencies) params.set("currencies", currencies);
        if (search) params.set("search", search);
        params.set("regions", "en");

        const url = `https://cryptopanic.com/api/developer/v2/posts/?${params.toString()}`;
        console.log(`Fetching news from: ${url.replace(process.env.CRYPTOPANIC_TOKEN!, "REDACTED")}`);

        const r = await fetch(url, { method: "GET" });
        if (!r.ok) {
            const txt = await r.text().catch(() => "");
            console.error(`CryptoPanic error: ${r.status} ${txt}`);
            const out = {
                error: "CryptoPanic error",
                status: r.status,
                detail: txt.slice(0, 300),
            };
            // Cache error briefly to avoid hammering API
            cache.set(key, { at: now, data: out });
            return res.status(r.status >= 400 ? r.status : 502).json(out);
        }

        const j = await r.json();

        const articles = (j?.results || []).map((it: any) => ({
            id: String(it?.id ?? ""),
            title: String(it?.title ?? ""),
            url: String(it?.original_url || it?.url || "#"),
            source: {
                name: it?.source?.title ?? "",
                domain: it?.source?.domain ?? "",
            },
            publishedAt: it?.published_at ?? it?.created_at ?? new Date().toISOString(),
            kind: typeof it?.kind === "string" ? it.kind : "news",
            currencies: Array.isArray(it?.instruments)
                ? it.instruments
                    .map((c: any) => String(c?.code || "").toUpperCase())
                    .filter(Boolean)
                : [],
            image: it?.image || null,
            votes: it?.votes || undefined,
        }));

        const out = {
            data: articles,
            paging: { next: j?.next || null, previous: j?.previous || null, page },
        };

        // Don't cache empty results to prevent stale cache issues
        if (articles.length > 0) {
            cache.set(key, { at: now, data: out });
        }

        // Add cache control headers
        res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
        return res.status(200).json(out);
    } catch (err: any) {
        console.error("GET /api/news failed:", err?.message || err, err?.stack);
        return res.status(500).json({ error: "Internal error", details: err?.message });
    }
}
