import {
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { auth, getFirebaseIdToken } from "@/lib/firebase";
import { queryClient } from "@/lib/queryClient";
import { writeCachedPositions } from "@/lib/api/portfolio";
import { portfolioPositionsQueryKey } from "@/lib/api/portfolio-keys";
import { usePriceStore } from "@/lib/prices";
import { clearDemoUserId, ensureDemoUserId } from "@/lib/demo-user";

interface FirebaseAuthContextValue {
  user: User | null;
  loading: boolean;
  idToken: string | null;
  getIdToken: (options?: { forceRefresh?: boolean }) => Promise<string | null>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | undefined>(undefined);

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [idToken, setIdToken] = useState<string | null>(null);
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setIdToken(null);
      setLoading(false);
      return;
    }
    
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          setIdToken(token);
        } catch (error) {
          console.error("Failed to refresh Firebase ID token", error);
          setIdToken(null);
        }
      } else {
        setIdToken(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const getIdToken = useCallback(
    async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}) => {
      const token = await getFirebaseIdToken(forceRefresh);
      setIdToken(token);
      return token;
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    if (!auth) {
      console.warn('[Firebase] Auth not initialized');
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) {
      console.warn('[Firebase] Auth not initialized');
      return;
    }
    await firebaseSignOut(auth);
    queryClient.clear();
    usePriceStore.getState().reset();
    if (import.meta.env.DEV) {
      ensureDemoUserId("demo-saif");
    }
    setIdToken(null);
  }, []);

  useEffect(() => {
    const currentUserId = user?.uid ?? null;
    const previousUserId = previousUserIdRef.current;

    if (currentUserId && currentUserId !== previousUserId) {
      const key = portfolioPositionsQueryKey(currentUserId);
      clearDemoUserId();
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.refetchQueries({ queryKey: key });
    }

    if (previousUserId && previousUserId !== currentUserId) {
      writeCachedPositions(previousUserId, null);
      queryClient.clear();
      usePriceStore.getState().reset();
      if (import.meta.env.DEV) {
        ensureDemoUserId("demo-saif");
      }
    }

    previousUserIdRef.current = currentUserId;
  }, [user]);

  useEffect(() => {
    if (user?.uid) {
      clearDemoUserId();
    } else if (import.meta.env.DEV) {
      ensureDemoUserId("demo-saif");
    }
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      idToken,
      getIdToken,
      signInWithGoogle,
      signOut,
    }),
    [user, loading, idToken, getIdToken, signInWithGoogle, signOut],
  );

  return <FirebaseAuthContext.Provider value={value}>{children}</FirebaseAuthContext.Provider>;
}

export function useFirebaseAuth() {
  const context = useContext(FirebaseAuthContext);
  if (!context) {
    throw new Error("useFirebaseAuth must be used within a FirebaseAuthProvider");
  }

  return context;
}
