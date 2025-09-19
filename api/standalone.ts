import { createServer } from "http";
import { createApp } from "./server";
import { log } from "./vite";

const app = await createApp();
const existingServer = app.get("httpServer");
const server = existingServer ?? createServer(app);

const port = parseInt(process.env.PORT || "5000", 10);

server.listen(
  {
    port,
    host: "0.0.0.0",
    reusePort: true,
  },
  () => {
    log(`serving on port ${port}`);
  },
);
