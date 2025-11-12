import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import type { ServiceAccount } from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

interface ServiceAccountLike {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
}

function normalizeServiceAccount(raw: Record<string, any>): ServiceAccountLike {
  const projectId = raw.projectId ?? raw.project_id;
  const clientEmail = raw.clientEmail ?? raw.client_email;
  const privateKeyValue = raw.privateKey ?? raw.private_key;

  return {
    projectId: typeof projectId === 'string' ? projectId : undefined,
    clientEmail: typeof clientEmail === 'string' ? clientEmail : undefined,
    privateKey: typeof privateKeyValue === 'string' ? privateKeyValue.replace(/\\n/g, '\n') : undefined,
  };
}

function loadServiceAccount(): ServiceAccountLike | null {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    return normalizeServiceAccount(JSON.parse(serviceAccountJson));
  }

  if (serviceAccountPath) {
    const resolvedPath = resolve(serviceAccountPath);
    const fileContents = readFileSync(resolvedPath, 'utf-8');
    return normalizeServiceAccount(JSON.parse(fileContents));
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  console.warn('[Firebase] Firebase Admin credentials not configured. Firebase auth will be disabled.');
  return null;
}

function initializeFirebaseAdmin(): App | null {
  const existingApp = getApps()[0];
  if (existingApp) {
    return existingApp;
  }

  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) {
    return null;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID ?? serviceAccount.projectId;

  const credentials: ServiceAccount = {
    projectId: serviceAccount.projectId ?? projectId,
    clientEmail: serviceAccount.clientEmail,
    privateKey: serviceAccount.privateKey,
  };

  if (!credentials.clientEmail || !credentials.privateKey) {
    console.warn('[Firebase] Missing client email or private key. Firebase auth disabled.');
    return null;
  }

  if (!projectId) {
    console.warn('[Firebase] Missing project ID. Firebase auth disabled.');
    return null;
  }

  return initializeApp({
    credential: cert(credentials),
    projectId,
  });
}

export const firebaseApp = initializeFirebaseAdmin();
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const firestore = firebaseApp ? getFirestore(firebaseApp) : null;

export const verifyIdToken = (token: string) => {
  if (!firebaseAuth) {
    throw new Error('Firebase auth is not initialized');
  }
  return firebaseAuth.verifyIdToken(token);
};
