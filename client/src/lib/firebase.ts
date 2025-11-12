import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

function getFirebaseConfig(): FirebaseConfig | null {
  const config: FirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const missingKeys = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    console.warn(
      `[Firebase] Missing Firebase configuration. Using Supabase for authentication instead.`
    );
    return null;
  }

  return config;
}

const config = getFirebaseConfig();
let firebaseApp: FirebaseApp | null = null;
let auth: Auth | null = null;

if (config) {
  firebaseApp = initializeApp(config);
  auth = getAuth(firebaseApp);
}

export { auth };

export async function getFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  if (!auth) {
    return null;
  }
  
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }

  try {
    return await currentUser.getIdToken(forceRefresh);
  } catch (error) {
    console.error("Failed to retrieve Firebase ID token", error);
    return null;
  }
}
