import type { ReactNode } from "react";

export default function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card text-white shadow-2xl">
        <div className="px-5 sm:px-6 py-4 border-b border-border text-lg sm:text-xl font-medium text-foreground">{title}</div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
