import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "./AuthContext";

type RequireAuthProps = {
  children: ReactNode;
};

export default function RequireAuth({ children }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <div className="p-6 text-white/70">Loading…</div>;
  if (!user) {
    const redirect = encodeURIComponent(`${loc.pathname}${loc.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  return <>{children}</>;
}
