import {
  createSession, sessionCookieHeader,
  verify2FALoginCode, getPendingLogin, destroyPendingLogin,
} from "../../../lib/auth";

// Zelfde eenvoudige rate-limiting als bij het wachtwoord — een authenticator-
// code is maar 6 cijfers, dus ook hier willen we snelle geautomatiseerde
// pogingen afweren.
const attempts = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (now - entry.first > WINDOW_MS) { attempts.delete(ip); return false; }
  return entry.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.first > WINDOW_MS) attempts.set(ip, { count: 1, first: now });
  else entry.count += 1;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }

  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "onbekend";
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Te veel pogingen. Probeer het later opnieuw." });
  }

  try {
    const { pendingToken, code } = req.body || {};
    if (!pendingToken || !code) return res.status(400).json({ error: "Velden ontbreken" });

    const pending = await getPendingLogin(pendingToken);
    if (!pending) {
      return res.status(401).json({ error: "Deze inlogpoging is verlopen — begin opnieuw." });
    }

    const geldig = await verify2FALoginCode(code);
    if (!geldig) {
      recordAttempt(ip);
      return res.status(401).json({ error: "Onjuiste code" });
    }

    await destroyPendingLogin(pendingToken);
    const token = await createSession(pending.user);
    res.setHeader("Set-Cookie", sessionCookieHeader(token));
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Kon code niet verifiëren" });
  }
}
