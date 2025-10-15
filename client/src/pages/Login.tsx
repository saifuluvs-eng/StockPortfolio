import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/AuthContext";
import AuthCard from "@/components/auth/AuthCard";
import { supabase } from "@/lib/supabase";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type FormValues = z.infer<typeof Schema>;

export default function Login() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const redirectTo = new URLSearchParams(loc.search).get("redirect") || "/dashboard";

  useEffect(() => {
    if (!loading && user) nav("/account", { replace: true });
  }, [user, loading, nav]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
  });

  async function onSubmit(values: FormValues) {
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      alert(error.message);
      return;
    }
    nav(redirectTo, { replace: true });
  }

  return (
    <AuthCard title="Welcome back">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="text-sm text-white/70">Email</label>
          <input
            {...register("email")}
            type="email"
            className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20"
          />
          {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="text-sm text-white/70">Password</label>
          <input
            {...register("password")}
            type="password"
            className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20"
          />
          {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
        </div>

        <button
          disabled={isSubmitting}
          className="w-full rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 py-2"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>

        <div className="flex items-center justify-between text-sm mt-1">
          <Link className="text-blue-300/90 hover:underline" to="/reset-password">
            Forgot password?
          </Link>
          <Link className="text-blue-300/90 hover:underline" to="/account">
            Create account
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
