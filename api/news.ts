export default async function handler(req: any, res: any) {
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

        // REMOVED SERVER-SIDE CACHE to fix "Refresh" button
        // The client (React Query) handles caching. Vercel functions should be stateless for this use case
        // to ensure the user always gets fresh data when they ask for it.

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
            return res.status(r.status >= 400 ? r.status : 502).json(out);
        }

        const j = await r.json();

        const articles = (j?.results || []).map((it: any) => {
            // Fix URL: Prefer original, then deep link, then construct from ID
            let articleUrl = it?.original_url || it?.url;
            if (!articleUrl && it?.id) {
                articleUrl = `https://cryptopanic.com/news/${it.id}/`;
            }
            if (!articleUrl) articleUrl = "#";

            return {
                id: String(it?.id ?? ""),
                title: String(it?.title ?? ""),
                url: String(articleUrl),
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
            };
        });

        // Debug logging for "1 day ago" issue
        if (articles.length > 0) {
            console.log(`[News] First article: ${articles[0].title} | ${articles[0].publishedAt} | ${articles[0].url}`);
        }

        const out = {
            data: articles,
            paging: { next: j?.next || null, previous: j?.previous || null, page },
        };

        // Add cache control headers - short max-age for browser
        res.setHeader("Cache-Control", "public, max-age=60, must-revalidate");
        return res.status(200).json(out);
    } catch (err: any) {
        console.error("GET /api/news failed:", err?.message || err, err?.stack);
        return res.status(500).json({ error: "Internal error", details: err?.message });
    }
}
