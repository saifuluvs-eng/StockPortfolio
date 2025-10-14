import { useCallback, useEffect, useState } from "react";

import { supabase } from "../lib/supabaseClient";
import { useSession } from "./AuthProvider";

let useNavigateHook:
  | (() => (path: string, options?: { replace?: boolean }) => void)
  | null = null;
try {
  // @ts-ignore - require may not be defined in ESM environments during type check, but Vite handles it
  const mod = require("react-router-dom");
  useNavigateHook = typeof mod.useNavigate === "function" ? mod.useNavigate : null;
} catch {
  useNavigateHook = null;
}

export default function AuthPage() {
  const { user } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const navigate = typeof useNavigateHook === "function" ? useNavigateHook() : null;

  const goAnalyse = useCallback(() => {
    const target = "/analyse/BTCUSDT";
    if (navigate) {
      navigate(target, { replace: true });
    } else {
      if (typeof window !== "undefined") {
        window.location.assign(target);
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (user && typeof window !== "undefined" && window.location.pathname === "/account") {
      goAnalyse();
    }
  }, [goAnalyse, user]);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setErr(error.message);
    else setInfo("Check your email (if confirmations enabled) or try signing in.");
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error.message);
    else goAnalyse();
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div style={{ padding: 16, maxWidth: 420, margin: "0 auto" }}>
      <h2>Account</h2>
      {user ? (
        <>
          <p>
            Signed in as <code>{user.email}</code>
          </p>
          <button onClick={signOut} style={{ padding: "8px 12px", borderRadius: 8 }}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <form onSubmit={signIn} style={{ display: "grid", gap: 8 }}>
            <input
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              placeholder="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" style={{ padding: "8px 12px", borderRadius: 8 }}>
                Sign in
              </button>
              <button
                type="button"
                onClick={signUp}
                style={{ padding: "8px 12px", borderRadius: 8 }}
              >
                Sign up
              </button>
            </div>
          </form>
          {err && <div style={{ color: "crimson", marginTop: 8 }}>{err}</div>}
          {info && <div style={{ opacity: 0.8, marginTop: 8 }}>{info}</div>}
        </>
      )}
    </div>
  );
}
