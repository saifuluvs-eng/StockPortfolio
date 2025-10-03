import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";

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

app.get("/", (_req, res) => {
  res.json({ message: "Stock Portfolio backend is running" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const marketTickerHandler = async (req, res) => {
  const symbol = req.params.symbol?.toUpperCase();

  if (!symbol) {
    res.status(400).json({ error: "invalid_symbol" });
    return;
  }

  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      res.status(502).json({ error: "upstream_error", status: response.status });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: "ticker_error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

app.get("/market/ticker/:symbol", marketTickerHandler);
app.get("/api/market/ticker/:symbol", marketTickerHandler);

app.get("/api/time", (_req, res) => {
  res.json({ now: new Date().toISOString() });
});

app.post("/api/echo", (req, res) => {
  res.json({ echo: req.body ?? null });
});

app.get("/api/market/gainers", (_req, res) => {
  res.json({ gainers: [] });
});

app.get("/api/watchlist", (_req, res) => {
  res.json({ items: [] });
});

app.get("/api/scanner/high-potential", (_req, res) => {
  // Expected shape: { data: [{ symbol: string; score: number; reason: string }] }
  res.json({ data: [] });
});

app.post("/api/scanner/high-potential", (_req, res) => {
  // Expected shape: { data: [{ symbol: string; score: number; reason: string }] }
  res.json({ data: [] });
});

app.get("/api/scanner/history", (_req, res) => {
  // Expected shape: { data: [{ date: string; symbol: string; score: number }] }
  res.json({ data: [] });
});

app.post("/api/scanner/history", (_req, res) => {
  // Expected shape: { data: [{ date: string; symbol: string; score: number }] }
  res.json({ data: [] });
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
