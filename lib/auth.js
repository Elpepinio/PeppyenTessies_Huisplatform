import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export const SESSION_COOKIE = "huis_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dagen — daarna gewoon opnieuw inloggen

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

// ════════════════════════════════════════════════════════
// TWEESTAPSVERIFICATIE (TOTP — RFC 6238), zelfde standaard als
// Google Authenticator / Authy / 1Password gebruiken. Bewust zonder externe
// TOTP-bibliotheek geïmplementeerd (alleen Node's ingebouwde crypto), zodat
// deze gevoelige verificatielogica niet van een derde partij afhangt.
// ════════════════════════════════════════════════════════

const BASE32_ALFABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALFABET[parseInt(bits.substr(i, 5), 2)];
  }
  if (bits.length % 5 !== 0) {
    const rest = bits.slice(-(bits.length % 5)).padEnd(5, "0");
    output += BASE32_ALFABET[parseInt(rest, 2)];
  }
  return output;
}

function base32Decode(base32) {
  const schoon = base32.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = "";
  for (const char of schoon) {
    const val = BASE32_ALFABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.substr(i, 8), 2));
  return Buffer.from(bytes);
}

function hotp(secretBuffer, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secretBuffer).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

// Geeft true bij een geldige 6-cijferige code, met een marge van 1 tijdstap
// (30 seconden) vóór/na om kleine klokverschillen tussen telefoon en server
// op te vangen.
function verifyTotpCode(base32Secret, code) {
  if (!/^\d{6}$/.test(String(code || "").trim())) return false;
  const secretBuffer = base32Decode(base32Secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let venster = -1; venster <= 1; venster++) {
    if (hotp(secretBuffer, counter + venster) === String(code).trim()) return true;
  }
  return false;
}

function totpAuthUrl(secret, accountName) {
  const issuer = "Ons Huishouden";
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

async function getHousehold() {
  const raw = await redis.get(householdKey());
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

async function saveHousehold(account) {
  await redis.set(householdKey(), JSON.stringify(account));
}

export async function is2FAEnabled() {
  const account = await getHousehold();
  return !!account?.twoFactorSecret;
}

// Start het instellen van 2FA: genereert een nieuw geheim, bewaart het als
// "pending" (nog niet actief) totdat het bevestigd is met een geldige code.
export async function start2FASetup(accountName = "Huishouden") {
  const account = await getHousehold();
  if (!account) throw new Error("Geen huishouden gevonden");
  const secretBuffer = crypto.randomBytes(20);
  const secret = base32Encode(secretBuffer);
  await saveHousehold({ ...account, twoFactorSecretPending: secret });
  return { secret, otpauthUrl: totpAuthUrl(secret, accountName) };
}

// Bevestigt het instellen: pas als de gebruiker een geldige code van hun
// authenticator-app invult, wordt 2FA daadwerkelijk actief. Genereert
// meteen een set eenmalige herstelcodes voor als de authenticator-app ooit
// niet meer beschikbaar is (bv. bij een kapotte/kwijtgeraakte telefoon).
export async function confirm2FASetup(code) {
  const account = await getHousehold();
  if (!account?.twoFactorSecretPending) return null;
  const geldig = verifyTotpCode(account.twoFactorSecretPending, code);
  if (!geldig) return null;
  const { twoFactorSecretPending, ...rest } = account;
  const { plainCodes, hashedCodes } = generateRecoveryCodes();
  await saveHousehold({ ...rest, twoFactorSecret: twoFactorSecretPending, recoveryCodes: hashedCodes });
  return plainCodes;
}

export async function disable2FA() {
  const account = await getHousehold();
  if (!account) return;
  const { twoFactorSecret, twoFactorSecretPending, recoveryCodes, ...rest } = account;
  await saveHousehold(rest);
}

export async function verify2FALoginCode(code) {
  const account = await getHousehold();
  if (!account?.twoFactorSecret) return false;
  return verifyTotpCode(account.twoFactorSecret, code);
}

// ── Herstelcodes: eenmalig te gebruiken als de authenticator-app niet meer
// beschikbaar is (kapotte/kwijtgeraakte telefoon, opnieuw ingesteld toestel). ──
function hashRecoveryCode(code) {
  return crypto.createHash("sha256").update(code.toUpperCase().trim()).digest("hex");
}

function generateRecoveryCodes(aantal = 8) {
  const plainCodes = [];
  for (let i = 0; i < aantal; i++) {
    const ruw = crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 hex-tekens
    plainCodes.push(`${ruw.slice(0, 5)}-${ruw.slice(5)}`);
  }
  const hashedCodes = plainCodes.map(hashRecoveryCode);
  return { plainCodes, hashedCodes };
}

// Maakt een geheel nieuwe set herstelcodes aan (de oude worden ongeldig) —
// bijvoorbeeld als je bijna door je herstelcodes heen bent.
export async function regenerateRecoveryCodes() {
  const account = await getHousehold();
  if (!account?.twoFactorSecret) return null; // alleen zinvol als 2FA actief is
  const { plainCodes, hashedCodes } = generateRecoveryCodes();
  await saveHousehold({ ...account, recoveryCodes: hashedCodes });
  return plainCodes;
}

export async function getRecoveryCodesRemaining() {
  const account = await getHousehold();
  return account?.recoveryCodes?.length ?? 0;
}

// Verifieert een herstelcode en maakt 'm meteen onbruikbaar voor een
// volgende keer (eenmalig gebruik, net als bij de meeste grote diensten).
export async function verifyAndConsumeRecoveryCode(code) {
  const account = await getHousehold();
  if (!account?.recoveryCodes?.length || !code) return false;
  const hash = hashRecoveryCode(code);
  const idx = account.recoveryCodes.indexOf(hash);
  if (idx === -1) return false;
  const overgebleven = [...account.recoveryCodes];
  overgebleven.splice(idx, 1);
  await saveHousehold({ ...account, recoveryCodes: overgebleven });
  return true;
}

// ── Tijdelijke "pending login"-status tussen wachtwoord-stap en 2FA-stap ──
function pending2FAKey(token) {
  return `pending2fa:${token}`;
}

export async function createPendingLogin(user) {
  const token = crypto.randomBytes(24).toString("hex");
  await redis.set(pending2FAKey(token), JSON.stringify({ user: user || null }), { ex: 5 * 60 });
  return token;
}

export async function getPendingLogin(token) {
  if (!token) return null;
  const raw = await redis.get(pending2FAKey(token));
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function destroyPendingLogin(token) {
  if (!token) return;
  await redis.del(pending2FAKey(token));
}
