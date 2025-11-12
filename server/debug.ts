// api/debug.ts

type Meta = Record<string, unknown>;

function serialize(meta?: Meta): string {
  if (!meta) return "";
  try {
    return JSON.stringify(meta);
  } catch {
    return "[unserializable-meta]";
  }
}

async function appendLocal(line: string) {
  // Only used in local dev; Vercel's FS is read-only/ephemeral.
  try {
    const { appendFile } = await import("node:fs/promises");
    await appendFile("debug.log", line, "utf8");
  } catch {
    // ignore if FS isn't available (edge) or path isn't writable
  }
}

export function debugLog(message: string, meta?: Meta): void {
  const line = `${new Date().toISOString()} - ${message}${meta ? " " + serialize(meta) : ""}\n`;

  // On Vercel (serverless/edge), prefer console.* (safe & visible in logs)
  if (process.env.VERCEL || process.env.NOW_REGION || process.env.NEXT_RUNTIME) {
    console.log("[DEBUG]", line.trim());
    return;
  }

  // Local dev: write to file (fire-and-forget) and mirror to console
  void appendLocal(line);
  console.log("[DEBUG]", line.trim());
}

export function debugError(err: unknown, meta?: Meta): void {
  const base =
    err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { error: err };
  debugLog("ERROR", { ...base, ...(meta || {}) });
}
