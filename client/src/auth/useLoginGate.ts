import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { toast } from "@/utils/toast";

/**
 * requireLogin(redirectTo?): if logged-out -> toast + navigate to /account and return true
 *                            if logged-in  -> return false (caller should proceed)
 */
export function useLoginGate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function requireLogin(redirectTo?: string) {
    if (!user) {
      toast("Sign in to unlock this feature");
      const back = redirectTo || `${location.pathname}${location.search}`;
      const q = back ? `?redirect=${encodeURIComponent(back)}` : "";
      // instant client nav
      navigate(`/account${q}`, { replace: false });
      return true;
    }
    return false;
  }

  return { requireLogin, user };
}
