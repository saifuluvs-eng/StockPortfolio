import { useState } from "react";

import { supabase } from "../lib/supabaseClient";
import { useSession } from "./AuthProvider";

export default function AuthPage() {
  const { user } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
