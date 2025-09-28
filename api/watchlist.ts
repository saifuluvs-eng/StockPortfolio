// api/watchlist.ts
export default function handler(_req: any, res: any) {
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
  res.status(200).json({
    ok: true,
    items: [],
    time: new Date().toISOString(),
  });
}
