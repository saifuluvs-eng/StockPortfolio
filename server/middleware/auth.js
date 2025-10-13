const isProduction = process.env.NODE_ENV === "production";

function parseBearerToken(header) {
  if (typeof header !== "string") return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice(7).trim();
  return token || null;
}

function decodeJwtUserId(token) {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const candidates = [payload?.uid, payload?.user_id, payload?.sub];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  } catch (error) {
    console.warn("Failed to decode Firebase ID token payload", error);
  }
  return null;
}

export async function portfolioAuth(req, res, next) {
  try {
    if (req.method && req.method.toUpperCase() === "OPTIONS") {
      return next();
    }

    const authHeader = req.headers?.authorization;
    const demoHeader = req.headers?.["x-demo-user-id"];

    let userId = null;
    const token = parseBearerToken(authHeader);

    if (token) {
      userId = decodeJwtUserId(token) ?? "firebase-user";
      req.authToken = token;
    } else if (typeof demoHeader === "string" && demoHeader.trim()) {
      if (!isProduction) {
        userId = demoHeader.trim();
      }
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    req.user = { ...(req.user ?? {}), id: userId };
    return next();
  } catch (error) {
    console.error("portfolioAuth error", error);
    return res.status(401).json({ error: "Unauthenticated" });
  }
}

export default portfolioAuth;
