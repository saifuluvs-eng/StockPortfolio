import express from 'express';
import { createServer } from 'http';
import { setupAuth } from "./auth";
import { registerRoutes } from "./routes";
import { setupVite } from "./vite";

async function main() {
  console.log('[Replit] Starting server...');
  
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  setupAuth(app);
  registerRoutes(app);

  const httpServer = createServer(app);
  (app as any).set('httpServer', httpServer);

  await setupVite(app, httpServer);

  const port = Number(process.env.PORT || 5000);
  const host = '0.0.0.0';
  
  httpServer.listen(port, host, () => {
    console.log(`[Replit] Server listening on http://${host}:${port}`);
  });
}

main().catch((e) => {
  console.error('[server] failed to start', e);
  process.exit(1);
});

