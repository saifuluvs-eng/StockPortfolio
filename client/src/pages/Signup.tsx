import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate } from "react-router-dom";

import AuthButton from "@/components/auth/AuthButton";
import AuthCard from "@/components/auth/AuthCard";
import { supabase } from "@/lib/supabase";

const Schema = z
  .object({
    email: z.string().email(),
    password: z
      .string()
      .min(8, "Min 8 chars")
      .regex(/[0-9]/, "Include a number")
      .regex(/[^A-Za-z0-9]/, "Include a symbol"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

type FormValues = z.infer<typeof Schema>;

export default function Signup() {
  const nav = useNavigate();
  const loc = useLocation();
  const redirectTo = new URLSearchParams(loc.search).get("redirect") || "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
  });

  async function onSubmit(values: FormValues) {
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${location.origin}/#/account?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) return alert(error.message);
    alert("Check your email to verify your account.");
    nav("/account", { replace: true });
  }

  return (
    <AuthCard title="Create your account">
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
          <p className="text-[11px] text-white/50 mt-1">Min 8 chars, include a number & a symbol.</p>
        </div>
        <div>
          <label className="text-sm text-white/70">Confirm password</label>
          <input
            {...register("confirm")}
            type="password"
            className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-white/20"
          />
          {errors.confirm && <p className="text-xs text-red-400 mt-1">{errors.confirm.message}</p>}
        </div>

        <button
          disabled={isSubmitting}
          className="w-full rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 py-2"
        >
          {isSubmitting ? "Creating…" : "Sign up"}
        </button>

        <div className="text-sm">
          Already have an account? {" "}
          <AuthButton
            size="sm"
            className="inline-flex !bg-transparent !border-none !px-0 !py-0 text-blue-300/90 hover:underline"
          />
        </div>
      </form>
    </AuthCard>
  );
}
