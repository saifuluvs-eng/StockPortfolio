import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchKlines } from "../server/lib/exchange/binance";

const MAP_TF: Record<string, string> = {
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

function getParam(queryValue: string | string[] | undefined): string {
  if (Array.isArray(queryValue)) {
    return queryValue[0] ?? "";
  }
  return queryValue ?? "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const rawSymbol = getParam(req.query?.symbol as any).trim().toUpperCase();
  const rawTf = getParam(req.query?.tf as any);
  const mappedTf = MAP_TF[rawTf];

  if (!rawSymbol || !mappedTf) {
    return res.status(400).json({ error: "bad_params" });
  }

  try {
    const candles = await fetchKlines(rawSymbol, mappedTf, 500);
    const payload = {
      symbol: rawSymbol,
      tf: rawTf,
      generatedAt: new Date().toISOString(),
      candles,
    };

    res.setHeader("Cache-Control", "public, max-age=20, s-maxage=20");
    return res.status(200).json(payload);
  } catch (error) {
    console.error("/api/ohlcv error", error);
    return res.status(502).json({ error: "upstream", message: error instanceof Error ? error.message : String(error) });
  }
}

