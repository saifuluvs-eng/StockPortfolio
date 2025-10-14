import { createContext, useContext, useEffect, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabaseClient";

type Ctx = { session: Session | null; user: User | null; loading: boolean };
const AuthCtx = createContext<Ctx>({ session: null, user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(session ?? null);
      setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, nextSession) => {
        setSession(nextSession ?? null);
      },
    );
    return () => {
      sub.subscription.unsubscribe();
      mounted = false;
    };
  }, []);

  return (
    <AuthCtx.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useSession() {
  return useContext(AuthCtx);
}
