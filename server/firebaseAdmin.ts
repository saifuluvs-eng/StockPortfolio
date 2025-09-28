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

function loadServiceAccount(): ServiceAccountLike {
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

  throw new Error(
    'Firebase Admin credentials are not configured. Provide FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.'
  );
}

function initializeFirebaseAdmin(): App {
  const existingApp = getApps()[0];
  if (existingApp) {
    return existingApp;
  }

  const serviceAccount = loadServiceAccount();
  const projectId = process.env.FIREBASE_PROJECT_ID ?? serviceAccount.projectId;

  const credentials: ServiceAccount = {
    projectId: serviceAccount.projectId ?? projectId,
    clientEmail: serviceAccount.clientEmail,
    privateKey: serviceAccount.privateKey,
  };

  if (!credentials.clientEmail || !credentials.privateKey) {
    throw new Error(
      'Firebase Admin credentials are missing a client email or private key. Check your environment variables.'
    );
  }

  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID must be provided for Firebase Admin initialization.');
  }

  return initializeApp({
    credential: cert(credentials),
    projectId,
  });
}

export const firebaseApp = initializeFirebaseAdmin();
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);

export const verifyIdToken = (token: string) => firebaseAuth.verifyIdToken(token);
