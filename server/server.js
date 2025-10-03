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

app.get("/api/time", (_req, res) => {
  res.json({ now: new Date().toISOString() });
});

app.post("/api/echo", (req, res) => {
  res.json({ echo: req.body ?? null });
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
