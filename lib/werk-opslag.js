// ════════════════════════════════════════════════════════════════════
// Werkruimte — afgeschermde opslag per persoon + pincode.
//
// Waarom een eigen pincode? Iedereen in huis logt in met hetzelfde
// huishoudwachtwoord en kiest daarna z'n naam. Voor thuislijsten prima,
// maar zakelijke taken van Pepijn horen niet zichtbaar te zijn voor Tessa
// (en andersom). De werkruimte gaat daarom pas open met een eigen pincode,
// en de data staat onder een eigen sleutel (`werk:<persoon>:…`, dus NIET
// onder `huishouden:*`) — zo komt hij ook niet in de gedeelde back-up.
//
// Eén keer ontgrendelen per toestel: de ontgrendeling hangt aan de sessie
// (30 dagen). Wijzigt de pincode, dan vervallen alle ontgrendelingen.
// ════════════════════════════════════════════════════════════════════
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Redis } from "@upstash/redis";
import { getSessionTokenFromReq, getSessionUser, isValidSession } from "./auth";
import { persoonSlug, isGeldigePin } from "./taken-logica";

export const redis = Redis.fromEnv();

const ONTGRENDEL_TTL = 60 * 60 * 24 * 30; // gelijk aan de sessieduur
const MAX_POGINGEN = 5;
const BLOKKADE_SEC = 15 * 60;

export const sleutels = {
  data: (slug) => `werk:${slug}:data`,
  pin: (slug) => `werk:${slug}:pin`,
  pogingen: (slug) => `werk:${slug}:pogingen`,
  ontgrendeld: (token) => `werk-ontgrendeld:${token}`,
  herinneringen: (ruimte, slug) => (ruimte === "werk" ? `taken:herinneringen:werk:${slug}` : "taken:herinneringen:thuis"),
  mailToken: (token) => `taken:mailtoken:${token}`,
  mailDomein: () => "taken:mail-domein",
  // Automatische dagelijkse momentopname (vervalt na BEWAAR_DAGEN).
  momentopname: (slug, datum) => `werk:${slug}:momentopname:${datum}`,
  voorHerstel: (slug) => `werk:${slug}:voor-herstel`,
};
export const BEWAAR_DAGEN = 14;

function parse(waarde, standaard) {
  if (waarde === null || waarde === undefined) return standaard;
  if (typeof waarde !== "string") return waarde;
  try { return JSON.parse(waarde); } catch { return standaard; }
}

export function legeWerkData() {
  return { lists: [], klanten: [], instellingen: { toegestaneAfzenders: [] } };
}

export async function leesWerkData(slug) {
  const d = parse(await redis.get(sleutels.data(slug)), null);
  const leeg = legeWerkData();
  if (!d) return leeg;
  return { ...leeg, ...d, instellingen: { ...leeg.instellingen, ...(d.instellingen || {}) } };
}

export async function schrijfWerkData(slug, data) {
  // Automatische back-up: vóór de eerste wijziging van de dag wordt de
  // stand van dat moment (= hoe je de vorige dag afsloot) bewaard, 14 dagen
  // lang. Zo draai je een vergissing van vandaag altijd terug. Mislukt dit,
  // dan gaat het opslaan zelf gewoon door.
  try {
    const datum = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10); // ~Nederlandse datum
    const sleutel = sleutels.momentopname(slug, datum);
    if (!(await redis.exists(sleutel))) {
      const vorige = await redis.get(sleutels.data(slug));
      if (vorige != null) await redis.set(sleutel, typeof vorige === "string" ? vorige : JSON.stringify(vorige), { nx: true, ex: BEWAAR_DAGEN * 86400 });
    }
  } catch { /* back-up is best effort */ }
  await redis.set(sleutels.data(slug), JSON.stringify(data));
}

// Welke momentopnames zijn er (nieuwste eerst), met grootte in bytes.
export async function lijstMomentopnames(slug) {
  const uit = [];
  for (let i = 0; i <= BEWAAR_DAGEN; i++) {
    const datum = new Date(Date.now() + 60 * 60 * 1000 - i * 86400000).toISOString().slice(0, 10);
    uit.push(datum);
  }
  const groottes = await Promise.all(uit.map(d => redis.strlen(sleutels.momentopname(slug, d)).catch(() => 0)));
  return uit.map((datum, i) => ({ datum, bytes: groottes[i] || 0 })).filter(x => x.bytes > 0);
}

// ── Pincode ────────────────────────────────────────────────────────
async function leesPin(slug) {
  return parse(await redis.get(sleutels.pin(slug)), null);
}

function maakHerstelcode() {
  const tekens = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // geen 0/O/1/I — makkelijker overtypen
  const bytes = crypto.randomBytes(12);
  const s = [...bytes].map(b => tekens[b % tekens.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

export async function pinIngesteld(slug) {
  return !!(await leesPin(slug));
}

// Eerste keer instellen. Geeft een eenmalige herstelcode terug.
export async function stelPinIn(slug, pin) {
  if (!isGeldigePin(pin)) throw new Error("Pincode moet 6 tot 8 cijfers zijn");
  if (await leesPin(slug)) throw new Error("Er is al een pincode ingesteld");
  const herstelcode = maakHerstelcode();
  await redis.set(sleutels.pin(slug), JSON.stringify({
    hash: await bcrypt.hash(String(pin), 10),
    herstelHash: await bcrypt.hash(herstelcode, 10),
    versie: 1,
    ingesteldOp: Date.now(),
  }));
  return { herstelcode, versie: 1 };
}

async function geblokkeerd(slug) {
  const n = Number(await redis.get(sleutels.pogingen(slug))) || 0;
  return n >= MAX_POGINGEN;
}
async function telMislukt(slug) {
  const n = await redis.incr(sleutels.pogingen(slug));
  if (n === 1) await redis.expire(sleutels.pogingen(slug), BLOKKADE_SEC);
  return n;
}

// { ok, versie } | { ok:false, fout, geblokkeerd }
export async function controleerPin(slug, pin) {
  const p = await leesPin(slug);
  if (!p) return { ok: false, fout: "Nog geen pincode ingesteld" };
  if (await geblokkeerd(slug)) return { ok: false, geblokkeerd: true, fout: "Te veel foute pogingen. Probeer het over 15 minuten opnieuw." };
  if (await bcrypt.compare(String(pin || ""), p.hash)) {
    await redis.del(sleutels.pogingen(slug));
    return { ok: true, versie: p.versie };
  }
  const n = await telMislukt(slug);
  const over = Math.max(0, MAX_POGINGEN - n);
  return { ok: false, fout: over ? `Onjuiste pincode — nog ${over} ${over === 1 ? "poging" : "pogingen"}` : "Te veel foute pogingen. Probeer het over 15 minuten opnieuw.", geblokkeerd: !over };
}

async function zetNieuwePin(slug, oud, nieuwePin) {
  const herstelcode = maakHerstelcode();
  const versie = (oud?.versie || 0) + 1;
  await redis.set(sleutels.pin(slug), JSON.stringify({
    hash: await bcrypt.hash(String(nieuwePin), 10),
    herstelHash: await bcrypt.hash(herstelcode, 10),
    versie, ingesteldOp: Date.now(),
  }));
  await redis.del(sleutels.pogingen(slug));
  return { herstelcode, versie };
}

export async function wijzigPin(slug, oudePin, nieuwePin) {
  if (!isGeldigePin(nieuwePin)) throw new Error("Nieuwe pincode moet 6 tot 8 cijfers zijn");
  const check = await controleerPin(slug, oudePin);
  if (!check.ok) throw new Error(check.fout);
  return zetNieuwePin(slug, await leesPin(slug), nieuwePin);
}

// Pincode vergeten → met de herstelcode (kreeg je bij het instellen).
export async function herstelPin(slug, herstelcode, nieuwePin) {
  if (!isGeldigePin(nieuwePin)) throw new Error("Nieuwe pincode moet 6 tot 8 cijfers zijn");
  const p = await leesPin(slug);
  if (!p) throw new Error("Nog geen pincode ingesteld");
  if (await geblokkeerd(slug)) throw new Error("Te veel foute pogingen. Probeer het over 15 minuten opnieuw.");
  const code = String(herstelcode || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{4})(.{4})(.{4})$/, "$1-$2-$3");
  if (!(await bcrypt.compare(code, p.herstelHash))) {
    await telMislukt(slug);
    throw new Error("Herstelcode klopt niet");
  }
  return zetNieuwePin(slug, p, nieuwePin);
}

// ── Ontgrendeling per sessie ───────────────────────────────────────
export async function markeerOntgrendeld(token, user, versie) {
  await redis.set(sleutels.ontgrendeld(token), JSON.stringify({ user, versie }), { ex: ONTGRENDEL_TTL });
}
export async function vergrendel(token) {
  if (token) await redis.del(sleutels.ontgrendeld(token));
}

// Alles wat een werk-API nodig heeft: wie is dit, en mag die erin?
export async function werkContext(req) {
  const token = getSessionTokenFromReq(req);
  if (!token || !(await isValidSession(token))) return { ingelogd: false };
  const user = await getSessionUser(token);
  const slug = persoonSlug(user);
  if (!slug) return { ingelogd: true, token, user: null, slug: null, ontgrendeld: false };
  const [o, p] = await Promise.all([redis.get(sleutels.ontgrendeld(token)), leesPin(slug)]);
  const ont = parse(o, null);
  const ontgrendeld = !!(p && ont && ont.user === user && ont.versie === p.versie);
  return { ingelogd: true, token, user, slug, ontgrendeld, pinIngesteld: !!p };
}

// ── Taak via e-mail: persoonlijk adres ─────────────────────────────
export async function leesMailDomein() {
  return (process.env.RESEND_INBOUND_DOMEIN || (await redis.get(sleutels.mailDomein())) || "").toString().trim().toLowerCase() || null;
}

export async function zorgVoorMailToken(slug, user, data) {
  if (data.instellingen?.mailToken) return data.instellingen.mailToken;
  const token = crypto.randomBytes(8).toString("hex"); // 16 tekens, niet te raden
  await redis.set(sleutels.mailToken(token), user);
  data.instellingen = { ...(data.instellingen || {}), mailToken: token };
  await schrijfWerkData(slug, data);
  return token;
}

export async function vernieuwMailToken(slug, user, data) {
  const oud = data.instellingen?.mailToken;
  if (oud) await redis.del(sleutels.mailToken(oud));
  data.instellingen = { ...(data.instellingen || {}), mailToken: null };
  return zorgVoorMailToken(slug, user, data);
}

export async function persoonVoorMailToken(token) {
  return token ? (await redis.get(sleutels.mailToken(token))) || null : null;
}
