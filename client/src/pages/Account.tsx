import { useEffect, useState } from "react";

import { useAuth } from "@/auth/AuthContext";
import { supabase } from "@/lib/supabase";

type Profile = { username: string | null; avatar_url: string | null };

export default function Account() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile>({ username: null, avatar_url: null });
  const [saving, setSaving] = useState(false);

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
