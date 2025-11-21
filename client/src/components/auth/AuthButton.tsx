import { useLocation } from "wouter";
import { useAuth } from "@/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/main";

export default function AuthButton({
  size = "md",
  className = "",
}: { size?: "sm" | "md"; className?: string }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const base =
    size === "sm"
      ? "px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 active:bg-primary/80 transition-colors"
      : "px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 active:bg-primary/80 transition-colors";

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
      <button className={`${base} ${className}`} onClick={() => navigate("/account")}>
        Sign in
      </button>
    );
  }
  return (
    <button
      className={`${base} ${className}`}
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
