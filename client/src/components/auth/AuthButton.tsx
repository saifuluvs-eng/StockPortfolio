import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/main";

export default function AuthButton({
  size = "md",
  className = "",
}: { size?: "sm" | "md"; className?: string }) {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const base =
    size === "sm"
      ? "px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-white/90"
      : "px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white/90";

  // While auth is bootstrapping, don't show the wrong action
  if (loading) {
    return (
      <button className={`${base} ${className}`} disabled>
        …
      </button>
    );
  }

  if (!user) {
    return (
      <button className={`${base} ${className} hover:bg-white/10`} onClick={() => nav("/account")}>
        Sign in
      </button>
    );
  }
  return (
    <button
      className={`${base} ${className} hover:bg-white/10`}
      onClick={async () => {
        await supabase.auth.signOut();
        queryClient.clear();
        try {
          localStorage.removeItem("ctp_watchlist");
          localStorage.removeItem("ctp_filters");
        } catch {}
        window.location.replace("/#/account");
      }}
    >
      Sign out
    </button>
  );
}
