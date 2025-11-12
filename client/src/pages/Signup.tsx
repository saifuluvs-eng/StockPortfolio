import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";

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
  const [currentPath, navigate] = useLocation();
  const searchParams = currentPath.includes("?") ? new URLSearchParams(currentPath.split("?")[1]) : new URLSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

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
        emailRedirectTo: `${window.location.origin}/#/account?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) return alert(error.message);
    alert("Check your email to verify your account.");
    navigate("/account");
  }

  return (
    <AuthCard title="Create your account">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-white/70">Email</label>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            inputMode="email"
            className="mt-1 w-full text-base rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/20 min-h-[48px]"
          />
          {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-white/70">Password</label>
          <input
            {...register("password")}
            type="password"
            autoComplete="new-password"
            className="mt-1 w-full text-base rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/20 min-h-[48px]"
          />
          {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
          <p className="text-xs text-white/50 mt-1">Min 8 chars, include a number & a symbol.</p>
        </div>
        <div>
          <label className="text-sm font-medium text-white/70">Confirm password</label>
          <input
            {...register("confirm")}
            type="password"
            autoComplete="new-password"
            className="mt-1 w-full text-base rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-white/20 min-h-[48px]"
          />
          {errors.confirm && <p className="text-xs text-red-400 mt-1">{errors.confirm.message}</p>}
        </div>

        <button
          disabled={isSubmitting}
          className="w-full rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 border border-white/15 py-3 min-h-[48px] text-base font-medium"
        >
          {isSubmitting ? "Creating…" : "Sign up"}
        </button>

        <div className="text-sm min-h-[44px] flex items-center">
          Already have an account? {" "}
          <AuthButton
            size="sm"
            className="inline-flex !bg-transparent !border-none !px-2 !py-0 text-blue-300/90 hover:underline"
          />
        </div>
      </form>
    </AuthCard>
  );
}
