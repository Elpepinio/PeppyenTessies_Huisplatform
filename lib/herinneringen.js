// ════════════════════════════════════════════════════════════════════
// Herinneringen — inplannen via Upstash QStash en versturen als
// pushmelding.
//
// Waarom QStash? Vercel-cronjobs draaien op het gratis plan maar één keer
// per dag; een herinnering "morgen 09:00" moet echter óp 09:00 komen.
// QStash (van Upstash, dezelfde aanbieder als de database) roept op het
// afgesproken moment /api/taken/herinnering aan. Zonder QStash-sleutels
// werkt alles gewoon door; dan komt er alleen een dagelijkse
// ochtendmelding (zie /api/cron/taken-dagelijks).
// ════════════════════════════════════════════════════════════════════
import webpush from "web-push";
import { Client } from "@upstash/qstash";
import { redis, sleutels } from "./werk-opslag";
import { berekenHerinneringWijzigingen, kiesOntvangers } from "./taken-logica";

const SUBS_KEY = "huishouden:push-subscriptions";

export function qstashActief() {
  return !!process.env.QSTASH_TOKEN;
}
export function pushActief() {
  return !!(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

// Het adres waarop QStash ons later moet aanroepen. Liefst het vaste
// productie-adres (Vercel zet die variabele zelf), zodat een preview-
// deployment geen herinneringen naar zichzelf plant.
export function basisUrl(req) {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return `https://${req?.headers?.host}`;
}

function parse(w, s) {
  if (w === null || w === undefined) return s;
  if (typeof w !== "string") return w;
  try { return JSON.parse(w); } catch { return s; }
}

// Zorgt dat precies de juiste herinneringen bij QStash klaarstaan voor deze
// ruimte. Best effort: een storing hier mag het opslaan nooit blokkeren.
export async function synchroniseerHerinneringen({ ruimte, slug = null, eigenaar = null, lists, req }) {
  if (!qstashActief()) return { overgeslagen: true };
  const key = sleutels.herinneringen(ruimte, slug);
  const bestaand = parse(await redis.get(key), {}) || {};
  const { plannen, annuleren } = berekenHerinneringWijzigingen(lists, bestaand, Date.now());
  if (!plannen.length && !annuleren.length) return { gepland: 0, geannuleerd: 0 };

  const client = new Client({ token: process.env.QSTASH_TOKEN, ...(process.env.QSTASH_URL ? { baseUrl: process.env.QSTASH_URL } : {}) });
  const nieuw = { ...bestaand };
  for (const a of annuleren) {
    try { if (a.messageId) await client.messages.delete(a.messageId); } catch { /* al afgeleverd of verlopen */ }
    delete nieuw[a.itemId];
  }
  const doel = `${basisUrl(req)}/api/taken/herinnering`;
  for (const p of plannen) {
    try {
      const r = await client.publishJSON({
        url: doel,
        body: { ruimte, eigenaar, listId: p.listId, itemId: p.itemId, tijd: p.tijd },
        notBefore: Math.floor(p.epoch / 1000),
        retries: 2,
      });
      nieuw[p.itemId] = { tijd: p.tijd, messageId: r.messageId };
    } catch (e) {
      console.error("Herinnering inplannen mislukt:", e?.message);
    }
  }
  await redis.set(key, JSON.stringify(nieuw));
  return { gepland: plannen.length, geannuleerd: annuleren.length };
}

export async function verwijderGeplandeHerinnering(ruimte, slug, itemId) {
  const key = sleutels.herinneringen(ruimte, slug);
  const bestaand = parse(await redis.get(key), {}) || {};
  if (bestaand[itemId]) {
    delete bestaand[itemId];
    await redis.set(key, JSON.stringify(bestaand));
  }
}

// Stuurt één pushmelding naar de juiste toestellen en ruimt verlopen
// abonnementen (toestel weg, app verwijderd) meteen op.
export async function stuurPush({ ruimte, eigenaar = null, toegewezenAan = null }, payload) {
  if (!pushActief()) return { verstuurd: 0, reden: "push niet geconfigureerd" };
  webpush.setVapidDetails("mailto:huishouden@voorbeeld.nl", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const subs = parse(await redis.get(SUBS_KEY), []) || [];
  const ontvangers = kiesOntvangers(subs, { ruimte, eigenaar, toegewezenAan });
  let verstuurd = 0;
  const ongeldig = [];
  for (const sub of ontvangers) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      verstuurd++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) ongeldig.push(sub.endpoint);
    }
  }
  if (ongeldig.length) {
    await redis.set(SUBS_KEY, JSON.stringify(subs.filter(s => !ongeldig.includes(s.endpoint))));
  }
  return { verstuurd, ontvangers: ontvangers.length };
}
