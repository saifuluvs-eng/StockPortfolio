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
    res.json = function json(bodyJson: unknown) {
        capturedJsonResponse = bodyJson as Record<string, unknown>;
        return originalResJson(bodyJson);
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

// Singleton initialization to prevent double-registration
let server: any = null;

const initializeServer = () => {
    if (!server) {


        // Log critical environment variables (masked)
        console.log("Environment Check:");
        console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? "Set" : "Missing"}`);
        console.log(`GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "Set" : "Missing"}`);
        console.log(`COINMARKETCAP_API_KEY: ${process.env.COINMARKETCAP_API_KEY ? "Set" : "Missing"}`);

        // Add basic health check route with Binance connectivity
        app.get('/api/health', async (req, res) => {
            console.log(`[API] /api/health called from ${req.ip}`);
            try {
                // Determine environment status
                const binanceStatus = await import("./services/binanceService").then(m => m.binanceService.checkHealth());

                res.json({
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    environment: process.env.VERCEL ? 'vercel' : 'local',
                    binance: binanceStatus
                });
            } catch (e) {
                console.error('[Health Check] Failed:', e);
                res.status(500).json({ status: 'error', message: 'Health Check Failed' });
            }
        });

        try {
            server = registerRoutes(app);
        } catch (err) {
            console.error("CRITICAL: Failed to register routes:", err);
            // Do NOT throw. Allow /api/health to work.
            app.get('*', (req, res) => {
                res.status(500).json({ error: 'Server Startup Failed', message: String(err) });
            });
        }

        // Global error handler
        app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
            const status = err.status || err.statusCode || 500;
            const message = err.message || "Internal Server Error";
            // Do not throw here, just log and respond
            console.error('[Global Error Handler]', err);
            if (!res.headersSent) {
                res.status(status).json({ message });
            }
        });
    }
    return server;
};

// Dev server startup (if not Vercel)
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    (async () => {
        const srv = initializeServer();
        if (app.get("env") === "development") {
            await setupVite(app, srv);
        } else {
            serveStatic(app);
        }

        // Start server
        const PORT = process.env.PORT || 5000;
        srv.listen(PORT, () => {
            log(`serving on port ${PORT}`);
        });
    })();
}

export default app;
// Export a ready promise for Vercel handler
export const ready = (async () => {
    return initializeServer();
})();
