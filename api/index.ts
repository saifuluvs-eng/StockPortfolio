import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.ts";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Canonical domain redirect middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      // Use console.log for Vercel's log drains
      console.log(logLine);
    }
  });

  next();
});

// Register all API routes. We assume this function modifies the `app` object.
registerRoutes(app);

// Global error handler for API routes
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({ message });
});

// Vercel will take this exported Express app and use it to handle requests.
export default app;
