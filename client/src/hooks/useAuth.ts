import { useFirebaseAuth } from "./useFirebaseAuth";

export function useAuth() {
    const { user, loading, idToken, getIdToken, signInWithGoogle, signOut } = useFirebaseAuth();
  return {
    user,
    idToken,
    getIdToken,
    signInWithGoogle,
    signOut,
    isLoading: loading,
    isAuthenticated: !!user,
  };
}
