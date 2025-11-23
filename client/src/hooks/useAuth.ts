import { useAuth as useSupabaseAuth } from "@/auth/AuthContext";

export function useAuth() {
  const { user, loading, session, signOut } = useSupabaseAuth();
  return {
    user,
    session,
    signOut,
    isLoading: loading,
    authReady: !loading,
    isAuthenticated: !!user,
    idToken: session?.access_token ?? null,
    getIdToken: async () => session?.access_token ?? null,
    signInWithGoogle: async () => {
      // Supabase OAuth handled in AuthPage
    },
  };
}
