import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import { setupAuth } from '../server/auth';
import { registerRoutes } from '../server/routes';

// Create Express app once
let app: express.Express | null = null;

function createApp(): express.Express {
  const newApp = express();
  
  // Middleware
  newApp.use(express.json({ limit: '50mb' }));
  newApp.use(express.urlencoded({ limit: '50mb', extended: false }));
  
  // Enable CORS for Vercel
  newApp.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
  
  // Setup auth and routes
  setupAuth(newApp);
  registerRoutes(newApp);
  
  return newApp;
}

export default async (req: VercelRequest, res: VercelResponse) => {
  // Initialize app on first request
  if (!app) {
    app = createApp();
  }
  
  // Handle request through Express
  return new Promise<void>((resolve) => {
    app!(req as any, res as any, () => {
      // If Express didn't handle it, send 404
      if (!res.writableEnded) {
        res.status(404).json({ error: 'Not Found' });
      }
      resolve();
    });
  });
};
