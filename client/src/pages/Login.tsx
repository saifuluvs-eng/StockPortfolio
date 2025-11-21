import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation } from "wouter";

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
  const [currentPath, navigate] = useLocation();
  const searchParams = currentPath.includes("?") ? new URLSearchParams(currentPath.split("?")[1]) : new URLSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  useEffect(() => {
    if (!loading && user) navigate("/account");
  }, [user, loading, navigate]);

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
    navigate(redirectTo);
  }

  return (
    <AuthCard title="Welcome back">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-white/70">Email</label>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            inputMode="email"
            className="mt-1 w-full text-base rounded-xl bg-card border border-white/10 px-4 py-3 outline-none focus:border-white/20 min-h-[48px]"
          />
          {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-white/70">Password</label>
          <input
            {...register("password")}
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full text-base rounded-xl bg-card border border-white/10 px-4 py-3 outline-none focus:border-white/20 min-h-[48px]"
          />
          {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
        </div>

        <button
          disabled={isSubmitting}
          className="w-full rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 border border-white/15 py-3 min-h-[48px] text-base font-medium"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm mt-2">
          <Link className="text-primary/90 hover:underline min-h-[44px] flex items-center" to="/reset-password">
            Forgot password?
          </Link>
          <Link className="text-primary/90 hover:underline min-h-[44px] flex items-center" to="/account">
            Create account
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
