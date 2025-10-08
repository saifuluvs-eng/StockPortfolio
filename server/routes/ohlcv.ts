import type { Express, Request, Response } from "express";
import { fetchKlines, type Kline } from "../lib/exchange/binance";

const mapTF: Record<string, string> = { "15m": "15m", "1h": "1h", "4h": "4h", "1d": "1d" };

type OhlcvResponse = {
  symbol: string;
  tf: string;
  generatedAt: string;
  candles: Kline[];
};

async function handleOhlcv(req: Request, res: Response) {
  try {
    const rawSymbol = (req.query.symbol as string) ?? "";
    const symbol = rawSymbol.trim().toUpperCase();
    const tf = (req.query.tf as string) ?? "";
    const mappedTf = mapTF[tf];

    if (!symbol || !mappedTf) {
      res.status(400).json({ error: "bad_params" });
      return;
    }

    const candles = await fetchKlines(symbol, mappedTf, 500);
    const payload: OhlcvResponse = {
      symbol,
      tf,
      generatedAt: new Date().toISOString(),
      candles,
    };
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=30");
    res.json(payload);
  } catch (error) {
    res.status(502).json({
      error: "upstream",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function registerOhlcvRoute(app: Express) {
  app.get("/api/ohlcv", handleOhlcv);
}

