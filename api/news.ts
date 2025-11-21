import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.CRYPTOPANIC_TOKEN) {
      return res.status(500).json({ error: "CRYPTOPANIC_TOKEN missing" });
    }

    const allowedFilters = new Set([
      "hot",
      "rising",
      "bullish",
      "bearish",
      "important",
    ]);
    const kindValue = String(req.query.kind || "").toLowerCase();
    const kind = ["news", "media", "all"].includes(kindValue) ? kindValue : "all";
    const filterValue = String(req.query.filter || "").toLowerCase();
    const filter = filterValue === "latest" ? "latest" : allowedFilters.has(filterValue) ? filterValue : "latest";
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);

    let currencies = String(req.query.currencies || "").trim().toUpperCase();
    if (!currencies || currencies === "ALL") {
      currencies = "";
    } else {
      currencies = currencies.replace(/[^A-Z,]/g, "");
    }

    const search = String(req.query.search || "").trim();

    const params = new URLSearchParams({
      auth_token: process.env.CRYPTOPANIC_TOKEN!,
      public: "true",
      kind,
      page: String(page),
    });
    if (filter !== "latest") params.set("filter", filter);
    if (currencies) params.set("currencies", currencies);
    if (search) params.set("search", search);
    params.set("regions", "en");

    const url = `https://cryptopanic.com/api/developer/v2/posts/?${params.toString()}`;
    const r = await fetch(url, { method: "GET" });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      const out = {
        error: "CryptoPanic error",
        status: r.status,
        detail: txt.slice(0, 300),
      };
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

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.json(out);
  } catch (err: any) {
    console.error("GET /api/news failed", err?.message || err);
    return res.status(500).json({ error: "Internal error" });
  }
};
