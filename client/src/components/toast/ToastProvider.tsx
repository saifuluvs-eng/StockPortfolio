import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastVariant = "success" | "error" | "info";
type Toast = { id: number; message: string; variant: ToastVariant; duration: number };

type ToastAPI = {
  show: (msg: string, opts?: { variant?: ToastVariant; duration?: number }) => number;
  success: (msg: string, duration?: number) => number;
  error: (msg: string, duration?: number) => number;
  info: (msg: string, duration?: number) => number;
  dismiss: (id: number) => void;
};

const ToastCtx = createContext<ToastAPI | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (message: string, opts?: { variant?: ToastVariant; duration?: number }) => {
      const id = idRef.current++;
      const variant = opts?.variant ?? "info";
      const duration = Math.max(1200, opts?.duration ?? 2200);
      const toast: Toast = { id, message, variant, duration };
      setToasts((t) => [...t, toast]);
      // auto-dismiss
      window.setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastAPI>(
    () => ({
      show,
      success: (msg, d) => show(msg, { variant: "success", duration: d }),
      error: (msg, d) => show(msg, { variant: "error", duration: d }),
      info: (msg, d) => show(msg, { variant: "info", duration: d }),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {/* Bottom-right stack */}
      <div className="fixed bottom-4 right-4 z-[2147483647] flex flex-col items-end gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "pointer-events-auto select-none rounded-xl border px-3 py-2 text-sm shadow-2xl",
              "transition-all duration-150 will-change-transform",
              t.variant === "success" ? "bg-emerald-500 text-black border-emerald-400" : "",
              t.variant === "error" ? "bg-red-500 text-black border-red-400" : "",
              t.variant === "info" ? "bg-[#1a1a1a] text-white border-white/15" : "",
            ].join(" ")}
            role="status"
            aria-live="polite"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
