import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";

dotenv.config();

const PORT = Number.parseInt(process.env.PORT ?? "4000", 10);
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "*";

const app = express();

app.use(
  cors({
    origin:
      allowedOrigin === "*"
        ? "*"
        : allowedOrigin.split(",").map((origin) => origin.trim()).filter(Boolean),
  }),
);
app.use(express.json());

// Simple in-memory store for demo purposes; persists only for the process lifetime
const memory = globalThis.__MEM__ ?? { portfolio: [], scans: [] };
globalThis.__MEM__ = memory;

app.get("/", (_req, res) => {
  res.json({ message: "Stock Portfolio backend is running" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

function safeTicker(symbol, lastPrice = "0") {
  return {
    symbol,
    lastPrice,
    priceChangePercent: "0",
    highPrice: null,
    lowPrice: null,
    volume: null,
  };
}

async function handleTicker(req, res) {
  const symbol = String(req.params.symbol || "").toUpperCase();
  try {
    // 1) main: 24hr
    let r = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
    );
    if (r.ok) {
      const d = await r.json();
      res.set("cache-control", "no-store");
      return res.json(d);
    }
    // 2) fallback: price
    r = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`,
    );
    if (r.ok) {
      const p = await r.json();
      res.set("cache-control", "no-store");
      return res.json(safeTicker(p.symbol, p.price));
    }
  } catch (_) {}
  // 3) last resort: synthetic safe payload
  res.set("cache-control", "no-store");
  return res.json(safeTicker(symbol));
}

app.get("/api/market/ticker/:symbol", handleTicker);
app.get("/market/ticker/:symbol", handleTicker);

app.get("/api/time", (_req, res) => {
  res.json({ now: new Date().toISOString() });
});

app.post("/api/echo", (req, res) => {
  res.json({ echo: req.body ?? null });
});

app.get("/api/portfolio", (_req, res) => {
  res.json(memory.portfolio);
});

app.post("/api/portfolio", (req, res) => {
  const { symbol, qty = null, entry = null, createdAt = new Date().toISOString() } = req.body ?? {};

  const trimmedSymbol = typeof symbol === "string" ? symbol.trim().toUpperCase() : "";

  if (!trimmedSymbol) {
    res.status(400).json({ error: "invalid_symbol" });
    return;
  }

  const row = {
    id: randomUUID(),
    symbol: trimmedSymbol,
    qty,
    entry,
    createdAt,
  };

  memory.portfolio.push(row);

  res.status(201).json(row);
});

app.delete("/api/portfolio/:id", (req, res) => {
  const { id } = req.params;
  const index = memory.portfolio.findIndex((item) => item.id === id);

  if (index === -1) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const [removed] = memory.portfolio.splice(index, 1);
  res.json(removed);
});

app.get("/api/market/gainers", (_req, res) => {
  res.json({ gainers: [] });
});

app.get("/api/watchlist", (_req, res) => {
  res.json({ data: [] });
});

app.post("/api/watchlist", (req, res) => res.json({ data: [] }));

app.post("/api/scanner/scan", async (req, res) => {
  try {
    const body = req.body || {};
    const symbol = String(body.symbol || "BTCUSDT").toUpperCase();
    const timeframe = String(body.timeframe || "4h");

    const result = {
      id: randomUUID(),
      ts: Date.now(),
      symbol,
      timeframe,
      overallLabel: "neutral",
      overallScore: "0",
      checks: [
        { key: "RSI", value: "55.0", signal: "bullish", reason: "RSI > 50" },
        { key: "MACD", value: "0.00", signal: "neutral", reason: "Flat MACD" },
        { key: "Trend", value: "Mixed", signal: "neutral", reason: "MA cross pending" },
      ],
    };

    memory.scans.push(result);
    res.set("cache-control", "no-store");
    res.json({ data: [result] });
  } catch (e) {
    console.error("[scan] error:", e);
    res.json({ data: [] });
  }
});

// history should return the latest scans (newest first)
app.get("/api/scanner/history", (_req, res) => {
  res.set("cache-control", "no-store");
  res.json({ data: [...memory.scans].reverse() });
});
app.post("/api/scanner/history", (_req, res) => {
  res.set("cache-control", "no-store");
  res.json({ data: [...memory.scans].reverse() });
});

// high-potential can surface the last few scans for now
app.get("/api/scanner/high-potential", (_req, res) => {
  res.set("cache-control", "no-store");
  res.json({ data: memory.scans.slice(-5).reverse() });
});
app.post("/api/scanner/high-potential", (_req, res) => {
  res.set("cache-control", "no-store");
  res.json({ data: memory.scans.slice(-5).reverse() });
});

app.get("/api/ai/market-overview", (_req, res) => {
  res.json({ summary: "Market overview data not available" });
});

app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (socket) => {
  socket.on("message", (message) => {
    socket.send(message.toString());
  });
});

server.on("upgrade", (request, socket, head) => {
  if (request.url !== "/ws") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (websocket) => {
    wss.emit("connection", websocket, request);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
