import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";


// Force restart for strategies update V2
const app = express();

// Security Headers for TradingView
app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s3.tradingview.com https://*.tradingview.com; " +
        "style-src 'self' 'unsafe-inline'; " +
        "frame-src 'self' https://s3.tradingview.com https://*.tradingview.com; " +
        "connect-src 'self' https://*.tradingview.com wss://*.tradingview.com wss://widgetdata.tradingview.com;"
    );
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined;

    const originalResJson = res.json.bind(res);
    res.json = function json(bodyJson: unknown, ...args: unknown[]) {
        capturedJsonResponse = bodyJson as Record<string, unknown>;
        return originalResJson(bodyJson, ...args);
    };

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

(async () => {
    const server = registerRoutes(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
        throw err;
    });

    // Setup Vite or static serving
    if (app.get("env") === "development") {
        await setupVite(app, server);
    } else {
        serveStatic(app);
    }

    // Start server only if run directly (not imported)
    if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
        const PORT = process.env.PORT || 5000;
        server.listen(PORT, () => {
            log(`serving on port ${PORT}`);
        });
    }
})();

export default app;
