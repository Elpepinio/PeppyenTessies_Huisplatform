import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export const SESSION_COOKIE = "huis_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 jaar — "ingelogd blijven tot uitloggen"

function householdKey() {
  // Eén huishouden per gedeployde app: alle gebruikers van deze ene Vercel-app
  // delen hetzelfde wachtwoord en dezelfde data.
  return "huishouden:account";
}

function sessionKey(token) {
  return `sessie:${token}`;
}

export async function hasHousehold() {
  const account = await redis.get(householdKey());
  return !!account;
}

export async function createHousehold(name, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  await redis.set(householdKey(), JSON.stringify({ name, passwordHash }));
}

export async function verifyPassword(password) {
  const raw = await redis.get(householdKey());
  if (!raw) return false;
  const account = typeof raw === "string" ? JSON.parse(raw) : raw;
  return bcrypt.compare(password, account.passwordHash);
}

export async function createSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  // We slaan op wie er is ingelogd (bijv. "Pepijn" of "Tessa") zodat tools
  // kunnen laten zien wie welke wijziging heeft gemaakt ("wie heeft wat gedaan").
  const value = user ? JSON.stringify({ user }) : "geldig";
  await redis.set(sessionKey(token), value, { ex: SESSION_TTL_SECONDS });
  return token;
}

export async function isValidSession(token) {
  if (!token) return false;
  const result = await redis.get(sessionKey(token));
  return !!result;
}

export async function getSessionUser(token) {
  if (!token) return null;
  const result = await redis.get(sessionKey(token));
  if (!result) return null;
  try {
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    return parsed?.user || null;
  } catch {
    // Oude sessies hadden simpelweg de waarde "geldig" i.p.v. JSON.
    return null;
  }
}

export async function destroySession(token) {
  if (!token) return;
  await redis.del(sessionKey(token));
}

export function sessionCookieHeader(token, { clear = false } = {}) {
  const parts = [
    `${SESSION_COOKIE}=${clear ? "" : token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
  ];
  if (clear) {
    parts.push("Max-Age=0");
  } else {
    parts.push(`Max-Age=${SESSION_TTL_SECONDS}`);
  }
  return parts.join("; ");
}

export function getSessionTokenFromReq(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}
