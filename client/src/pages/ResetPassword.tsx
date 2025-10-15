import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";

import AuthCard from "@/components/auth/AuthCard";
import { supabase } from "@/lib/supabase";

const Schema = z.object({ email: z.string().email() });

type FormValues = z.infer<typeof Schema>;

export default function ResetPassword() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(Schema) });

  async function onSubmit(values: FormValues) {
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${location.origin}/#/account`,
    });
    if (error) return alert(error.message);
    alert("If that email exists, we sent a reset link.");
  }

  return (
    <AuthCard title="Reset password">
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

        <button
          disabled={isSubmitting}
          className="w-full rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 py-2"
        >
          {isSubmitting ? "Sending…" : "Send reset link"}
        </button>

        <div className="text-sm">
          <Link className="text-blue-300/90 hover:underline" to="/account">
            Back to account
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
