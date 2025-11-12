import 'dotenv/config';
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import type { Server } from "http";
import { setupAuth } from "./auth";
import { debugLog } from "./debug";
import { registerRoutes, type RegisterRoutesOptions } from "./routes";
import { log, serveStatic, setupVite } from "./vite";

export interface CreateAppOptions extends RegisterRoutesOptions {
  enableVite?: boolean;
  serveStatic?: boolean;
}

export interface AppWithServer extends Express {
  get(name: "httpServer"): Server | undefined;
  set(name: "httpServer", value: Server): this;
}

export async function createApp(
  options: CreateAppOptions = {},
): Promise<AppWithServer> {
  const {
    enableWebSockets = true,
    enableVite,
    serveStatic: serveStaticOption,
  } = options;

  debugLog("Server script started.");

  const app = express() as AppWithServer;

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  setupAuth(app);

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined;

    const originalResJson = res.json.bind(res);
    res.json = function json(bodyJson: unknown, ...args: unknown[]) {
      capturedJsonResponse = bodyJson as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return originalResJson(bodyJson, ...args);
    } as typeof res.json;

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = `${logLine.slice(0, 79)}…`;
        }

        log(logLine);
      }
    });

    next();
  });

  registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  const shouldSetupVite = enableVite ?? app.get("env") === "development";
  const shouldServeStatic = serveStaticOption ?? app.get("env") !== "development";
  const httpServer = app.get("httpServer");

  if (shouldSetupVite) {
    if (!httpServer) {
      throw new Error("Vite development server requires an HTTP server instance");
    }
    await setupVite(app, httpServer);
  } else if (shouldServeStatic) {
    serveStatic(app);
  }

  return app;
}
