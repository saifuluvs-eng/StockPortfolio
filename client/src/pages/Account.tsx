import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/AuthContext";
import { supabase } from "@/lib/supabase";

type Profile = { username: string | null; avatar_url: string | null };

export default function Account() {
  const { user, signOut, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const redirectParam = useMemo(() => new URLSearchParams(loc.search).get("redirect"), [loc.search]);
  const [profile, setProfile] = useState<Profile>({ username: null, avatar_url: null });
  const [saving, setSaving] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupMessage, setSignupMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!error && data) setProfile(data as Profile);
    }
    load();
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, username: profile.username, avatar_url: profile.avatar_url });
    setSaving(false);
    if (error) {
      console.error(error);
      return alert("Couldn’t save profile. " + error.message);
    }
    // small success hint (keep it quiet if you already use a toast lib)
    console.log("Profile saved");
  }

  if (loading) {
    return <div className="p-6 text-white/70">Loading…</div>;
  }

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoginLoading(false);
    if (error) {
      setLoginError(error.message);
      return;
    }
    if (redirectParam) {
      nav(redirectParam, { replace: true });
    }
  }

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSignupError(null);
    setSignupMessage(null);
    if (signupPassword !== signupConfirm) {
      setSignupError("Passwords do not match");
      return;
    }
    setSignupLoading(true);
    const redirectTarget = redirectParam ?? "/dashboard";
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/#/account${redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ""}`,
      },
    });
    setSignupLoading(false);
    if (error) {
      setSignupError(error.message);
      return;
    }
    setSignupMessage("Check your email to verify your account.");
    setSignupEmail("");
    setSignupPassword("");
    setSignupConfirm("");
    if (!redirectParam) {
      // stay on account page so they can sign in after verifying
      return;
    }
    // If they came from a protected route, hint what happens after verification
    console.log(`After verification you will be redirected to ${redirectTarget}`);
  }

  if (!user) {
    return (
      <div className="p-6 text-white">
        <div className="mx-auto max-w-5xl space-y-6">
          <div>
            <h1 className="text-3xl font-semibold text-white/90">Access your account</h1>
            <p className="mt-1 text-sm text-white/60">
              Sign in if you already have an account or create a new one to track your portfolio.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#151515]">
              <div className="px-4 py-3 border-b border-white/10 text-white/80">Sign in</div>
              <form className="p-4 space-y-4" onSubmit={handleLogin}>
                <div>
                  <label className="text-sm text-white/70">Email</label>
                  <input
                    required
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="text-sm text-white/70">Password</label>
                  <input
                    required
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20"
                  />
                </div>
                {loginError && <p className="text-xs text-red-400">{loginError}</p>}
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 py-2"
                >
                  {loginLoading ? "Signing in…" : "Sign in"}
                </button>
                <div className="flex items-center justify-between text-sm">
                  <Link className="text-blue-300/90 hover:underline" to="/reset-password">
                    Forgot password?
                  </Link>
                  <Link className="text-blue-300/90 hover:underline" to="/signup">
                    Need an account?
                  </Link>
                </div>
              </form>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#151515]">
              <div className="px-4 py-3 border-b border-white/10 text-white/80">Create account</div>
              <form className="p-4 space-y-4" onSubmit={handleSignup}>
                <div>
                  <label className="text-sm text-white/70">Email</label>
                  <input
                    required
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="text-sm text-white/70">Password</label>
                  <input
                    required
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20"
                  />
                  <p className="text-[11px] text-white/50 mt-1">Min 8 chars, include a number & a symbol.</p>
                </div>
                <div>
                  <label className="text-sm text-white/70">Confirm password</label>
                  <input
                    required
                    type="password"
                    value={signupConfirm}
                    onChange={(e) => setSignupConfirm(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20"
                  />
                </div>
                {signupError && <p className="text-xs text-red-400">{signupError}</p>}
                {signupMessage && <p className="text-xs text-green-400">{signupMessage}</p>}
                <button
                  type="submit"
                  disabled={signupLoading}
                  className="w-full rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 py-2"
                >
                  {signupLoading ? "Creating…" : "Sign up"}
                </button>
                <p className="text-xs text-white/60">
                  We'll email a confirmation link to finish setting up your account.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 text-white">
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center">
            <span className="text-lg">{user?.email?.[0]?.toUpperCase() || "U"}</span>
          </div>
          <div className="text-white/90 font-medium">{user?.email}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#151515]">
          <div className="px-4 py-3 border-b border-white/10 text-white/80">Profile</div>
          <div className="p-4 space-y-4">
            <div>
              <label className="text-sm text-white/70">Username</label>
              <input
                value={profile.username ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
                className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20"
              />
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-2"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#151515]">
          <div className="px-4 py-3 border-b border-white/10 text-white/80">Security</div>
          <div className="p-4 space-y-3 text-white/80">
            <a className="text-blue-300/90 hover:underline" href="/#/reset-password">
              Change/Reset password
            </a>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={signOut}
            className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
