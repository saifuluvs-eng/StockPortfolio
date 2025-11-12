import type { ReactNode } from "react";
import { Redirect, useLocation } from "wouter";

import { useAuth } from "./AuthContext";

type RequireAuthProps = {
  children: ReactNode;
};

export default function RequireAuth({ children }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const [currentPath] = useLocation();

  if (loading) return <div className="p-6 text-white/70">Loading…</div>;
  if (!user) {
    const redirect = encodeURIComponent(currentPath);
    return <Redirect to={`/account?redirect=${redirect}`} replace />;
  }
  return <>{children}</>;
}
