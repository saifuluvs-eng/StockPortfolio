// Super-lightweight toast (no deps). Call: toast("Message").
export function toast(message: string, ms = 2000) {
  // Create a single container once
  const id = "ctp-toast-container";
  let container = document.getElementById(id);
  if (!container) {
    container = document.createElement("div");
    container.id = id;
    Object.assign(container.style, {
      position: "fixed",
      left: "50%",
      bottom: "24px",
      transform: "translateX(-50%)",
      zIndex: "2147483647",
      display: "flex",
      gap: "8px",
      pointerEvents: "none",
    } as CSSStyleDeclaration);
    document.body.appendChild(container);
  }

  // Create the toast bubble
  const el = document.createElement("div");
  el.textContent = message;
  Object.assign(el.style, {
    background: "rgba(0,0,0,0.85)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "14px",
    lineHeight: "1",
    boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
    opacity: "0",
    transform: "translateY(8px)",
    transition: "opacity 120ms ease, transform 120ms ease",
    pointerEvents: "auto",
    userSelect: "none",
    whiteSpace: "nowrap",
  } as CSSStyleDeclaration);

  container.appendChild(el);

  // animate in
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });

  // remove after timeout
  const total = Math.max(1200, ms);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => {
      el.remove();
      if (container && container.childElementCount === 0) container.remove();
    }, 180);
  }, total);
}
