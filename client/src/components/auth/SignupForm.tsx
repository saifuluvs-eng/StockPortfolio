import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
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
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" });

type FormValues = z.infer<typeof Schema>;

export default function SignupForm({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const [currentPath] = useLocation();
  const hashPart = currentPath.includes('?') ? currentPath.split('?')[1] : '';
  const redirectTo = new URLSearchParams(hashPart).get("redirect") || "/dashboard";

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
        emailRedirectTo: `${location.origin}/#/login?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) return alert(error.message);
    alert("Check your email to verify your account.");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Email */}
      <div>
        <label className="text-sm text-muted-foreground">Email</label>
        <input
          {...register("email")}
          type="email"
          className="mt-1 w-full rounded-xl bg-input border border-border px-3 py-2 outline-none focus:border-ring text-foreground"
        />
        {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
      </div>

      {/* Password */}
      <div>
        <label className="text-sm text-muted-foreground">Password</label>
        <input
          {...register("password")}
          type="password"
          className="mt-1 w-full rounded-xl bg-input border border-border px-3 py-2 outline-none focus:border-ring text-foreground"
        />
        {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
        <p className="text-[11px] text-muted-foreground/60 mt-1">Min 8 chars, include a number & a symbol.</p>
      </div>

      {/* Confirm */}
      <div>
        <label className="text-sm text-muted-foreground">Confirm password</label>
        <input
          {...register("confirm")}
          type="password"
          className="mt-1 w-full rounded-xl bg-input border border-border px-3 py-2 outline-none focus:border-ring text-foreground"
        />
        {errors.confirm && <p className="text-xs text-destructive mt-1">{errors.confirm.message}</p>}
      </div>

      {/* Sign up button */}
      <button
        disabled={isSubmitting}
        className="w-full rounded-xl bg-muted hover:bg-muted/80 border border-border py-2 text-foreground"
      >
        {isSubmitting ? "Creating…" : "Sign up"}
      </button>

      {/* Switch back to login UNDER the button (nice-to-have) */}
      <div className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <button type="button" onClick={onSwitchToLogin} className="text-primary/90 hover:underline">
          Sign in
        </button>
      </div>

      <p className="text-[11px] text-white/50">
        We’ll email a confirmation link to finish setting up your account.
      </p>
    </form>
  );
}
