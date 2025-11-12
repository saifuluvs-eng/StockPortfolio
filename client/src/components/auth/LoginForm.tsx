import { useEffect } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation, Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthContext";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
type FormValues = z.infer<typeof Schema>;

export default function LoginForm({ onSwitchToSignup }: { onSwitchToSignup: () => void }) {
  const [currentPath, navigate] = useLocation();
  const hashPart = currentPath.includes('?') ? currentPath.split('?')[1] : '';
  const redirectTo = new URLSearchParams(hashPart).get("redirect") || "/dashboard";
  const { user, loading } = useAuth();

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
    if (error) return alert(error.message);
    navigate(redirectTo);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Email */}
      <div>
        <label className="text-sm text-white/70">Email</label>
        <input
          {...register("email")}
          type="email"
          className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20"
        />
        {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
      </div>

      {/* Password */}
      <div>
        <label className="text-sm text-white/70">Password</label>
        <input
          {...register("password")}
          type="password"
          className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20"
        />
        {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
      </div>

      {/* Forgot password ABOVE the button */}
      <div className="text-sm -mt-1">
        <Link className="text-blue-300/90 hover:underline" to="/reset-password">
          Forgot password?
        </Link>
      </div>

      {/* Sign in button */}
      <button
        disabled={isSubmitting}
        className="w-full rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 py-2"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>

      {/* Switch to signup BELOW the button */}
      <div className="text-sm text-white/80">
        Don’t have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToSignup}
          className="text-blue-300/90 hover:underline"
        >
          Sign Up Now
        </button>
      </div>
    </form>
  );
}
