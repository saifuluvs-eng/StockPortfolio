export function safeClosePopup(win: Window | null | undefined) {
  if (!win) return;
  try {
    if (win.closed) return;
  } catch {
    // Accessing win.closed can throw in cross-origin isolated contexts.
    return;
  }

  try {
    const opener = win.opener;
    if (!opener || opener === null) return;
    win.close();
  } catch {
    // Ignore failures caused by COOP/COEP isolation or cross-origin restrictions.
  }
}

export function postAuthSuccessMessage(payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    const data = { type: "auth:success", ...payload };
    window.opener?.postMessage(data, "*");
  } catch {
    // ignore message errors
  }
}
