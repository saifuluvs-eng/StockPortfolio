import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { supabase } from "@/lib/supabase";

export default function AuthButton({ size = "md", className = "" }: { size?: "sm" | "md"; className?: string; }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const base =
    size === "sm"
      ? "px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/90"
      : "px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/90";

  if (!user) {
    return (
      <button className={`${base} ${className}`} onClick={() => nav("/account")}>
        Sign in
      </button>
    );
  }
  return (
    <button className={`${base} ${className}`} onClick={() => supabase.auth.signOut()}>
      Sign out
    </button>
  );
}
