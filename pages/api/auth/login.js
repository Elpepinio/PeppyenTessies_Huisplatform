import { verifyPassword, createSession, sessionCookieHeader, is2FAEnabled, createPendingLogin } from "../../../lib/auth";

// Eenvoudige rate-limiting in het geheugen van de serverless functie:
// niet waterdicht over meerdere instanties, maar weert snelle geautomatiseerde pogingen af.
const attempts = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (now - entry.first > WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now });
  } else {
    entry.count += 1;
  }
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
    const { password, user } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: "Vul een wachtwoord in" });
    }

    const valid = await verifyPassword(password);
    if (!valid) {
      recordAttempt(ip);
      return res.status(401).json({ error: "Wachtwoord onjuist" });
    }

    // Als tweestapsverificatie actief is, nog geen sessie aanmaken — eerst
    // moet de authenticator-code kloppen. De client krijgt een tijdelijk
    // token (5 min geldig) mee om die tweede stap aan te koppelen.
    if (await is2FAEnabled()) {
      const pendingToken = await createPendingLogin(user);
      return res.status(200).json({ needs2FA: true, pendingToken });
    }

    const token = await createSession(user);
    res.setHeader("Set-Cookie", sessionCookieHeader(token));
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Kon niet inloggen" });
  }
}
