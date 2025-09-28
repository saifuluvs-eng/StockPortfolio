import type { Express, RequestHandler } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { verifyIdToken } from './firebaseAdmin';

export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  displayName?: string | null;
  picture?: string | null;
  claims: DecodedIdToken;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      authToken?: string;
      authError?: Error;
    }
  }
}

export const authenticateFirebaseRequest: RequestHandler = async (req, _res, next) => {
  const authorization = req.headers.authorization;
  req.user = undefined;
  req.authToken = undefined;
  req.authError = undefined;

  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    return next();
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    return next();
  }

  try {
    const decodedToken = await verifyIdToken(token);
    req.user = {
      id: decodedToken.uid,
      email: decodedToken.email ?? null,
      displayName: decodedToken.name ?? null,
      picture: decodedToken.picture ?? null,
      claims: decodedToken,
    };
    req.authToken = token;
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Failed to verify Firebase ID token');
    req.authError = err;
    console.warn('Failed to verify Firebase ID token', err);
  }
  next();
};

export function setupAuth(app: Express) {
  app.use(authenticateFirebaseRequest);
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.user) {
    return next();
  }

  if (req.authError) {
    return res.status(401).json({ message: 'Invalid or expired authentication token' });
  }

  return res.status(401).json({ message: 'Unauthorized' });
};
