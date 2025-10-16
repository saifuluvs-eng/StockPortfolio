import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/main";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let initialized = false;

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      // onAuthStateChange now fires an INITIAL_SESSION event once
      if (event === "INITIAL_SESSION") {
        setSession(s ?? null);
        setLoading(false);
        initialized = true;
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setSession(s ?? null);
      }

      if (event === "SIGNED_OUT") {
        setSession(null);
        // Clear caches and app-local storage
        queryClient.clear();
        try {
          localStorage.removeItem("ctp_watchlist");
          localStorage.removeItem("ctp_filters");
        } catch {}
        // Hard redirect to avoid stale UI
        window.location.replace("/#/account");
      }
    });

    // Fallback bootstrap (older SDKs)
    supabase.auth.getSession().then(({ data }) => {
      if (initialized) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
        // Remaining work (clear + redirect) is handled in SIGNED_OUT above
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
