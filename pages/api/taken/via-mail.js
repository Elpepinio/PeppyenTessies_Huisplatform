// Webhook van Resend: een e-mail naar iemands persoonlijke taken-adres
// wordt een taak in diens werkruimte (lijst "Uit e-mail").
//
// Beveiliging, drie lagen:
//  1. de handtekening van Resend moet kloppen (RESEND_WEBHOOK_SECRET);
//  2. het adres bevat een lang, willekeurig token (niet te raden);
//  3. alleen afzenders die je zelf hebt opgegeven worden geaccepteerd, en
//     als Resend aangeeft dat SPF én DKIM falen (vervalste afzender), dan
//     wordt de mail geweigerd.
import { Resend } from "resend";
import { redis, leesWerkData, schrijfWerkData, persoonVoorMailToken } from "../../../lib/werk-opslag";
import { stuurPush, synchroniseerHerinneringen } from "../../../lib/herinneringen";
import {
  persoonSlug, mailTokenUitAdressen, afzenderToegestaan, emailUitAfzender, onderwerpNaarTitel,
  ontleedSnelleInvoer, voegLijstenSamen, nieuweTaak,
} from "../../../lib/taken-logica";
import * as chrono from "chrono-node";

export const config = { api: { bodyParser: false } };

function leesRuweBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", c => { data += c; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function log(slug, regel) {
  if (!slug) return;
  const key = `taken:mail-log:${slug}`;
  await redis.lpush(key, JSON.stringify({ ...regel, op: Date.now() }));
  await redis.ltrim(key, 0, 19);
}

function schoneTekst(t) {
  return String(t || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1500);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }
  if (!process.env.RESEND_WEBHOOK_SECRET || !process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: "Taak via e-mail is nog niet ingericht" });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const ruw = await leesRuweBody(req);
  let event;
  try {
    event = resend.webhooks.verify({
      payload: ruw,
      headers: { id: req.headers["svix-id"], timestamp: req.headers["svix-timestamp"], signature: req.headers["svix-signature"] },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
    });
  } catch {
    return res.status(401).json({ error: "Ongeldige handtekening" });
  }
  if (event?.type !== "email.received") return res.status(200).json({ genegeerd: event?.type || "onbekend" });

  const d = event.data || {};
  const token = mailTokenUitAdressen([...(d.to || []), ...(d.received_for || [])]);
  const user = await persoonVoorMailToken(token);
  const slug = persoonSlug(user);
  if (!slug) return res.status(200).json({ genegeerd: "onbekend adres" });

  const werk = await leesWerkData(slug);
  const van = emailUitAfzender(d.from);
  if (!afzenderToegestaan(d.from, werk.instellingen?.toegestaneAfzenders)) {
    await log(slug, { status: "geweigerd", reden: "afzender niet toegestaan", van, onderwerp: d.subject || "" });
    return res.status(200).json({ genegeerd: "afzender niet toegestaan" });
  }

  // Volledige inhoud + echtheidscontrole ophalen.
  let detail = {};
  try {
    const r = await resend.emails.receiving.get(d.email_id);
    detail = r?.data || {};
  } catch { /* zonder inhoud gaan we door met alleen het onderwerp */ }
  const auth = detail.authentication;
  if (auth && auth.spf && auth.dkim && auth.spf !== "pass" && auth.dkim !== "pass") {
    await log(slug, { status: "geweigerd", reden: "afzender niet echt (SPF/DKIM)", van, onderwerp: d.subject || "" });
    return res.status(200).json({ genegeerd: "authenticatie mislukt" });
  }

  const onderwerp = onderwerpNaarTitel(d.subject);
  const slim = ontleedSnelleInvoer(onderwerp, chrono.nl, new Date());
  const tekst = schoneTekst(detail.text);
  const taak = nieuweTaak({
    name: slim.titel || onderwerp,
    dueDate: slim.dueDate, herinnering: slim.herinnering, herhaling: slim.herhaling, belangrijk: slim.belangrijk,
    note: `✉️ Van ${van}${tekst ? `\n\n${tekst}` : ""}`,
    bron: "mail",
  }, { wie: user });

  let inbox = werk.lists.find(l => l.mailInbox);
  if (!inbox) {
    inbox = { id: `mail-${Date.now()}`, name: "Uit e-mail", icon: "📥", type: "todo", mailInbox: true, categories: [{ id: "taken", label: "Taken", icon: "📌" }], items: [], history: {}, favorites: [], createdAt: Date.now() };
  }
  const bijgewerkt = { ...inbox, items: [...(inbox.items || []), { ...taak, category: inbox.categories?.[0]?.id || null }] };
  werk.lists = voegLijstenSamen(werk.lists, [bijgewerkt], []);
  await schrijfWerkData(slug, werk);
  await log(slug, { status: "taak", van, onderwerp: d.subject || "", taak: taak.name });

  try { await synchroniseerHerinneringen({ ruimte: "werk", slug, eigenaar: user, lists: werk.lists, req }); } catch { /* best effort */ }
  try {
    await stuurPush({ ruimte: "werk", eigenaar: user }, { title: "📥 Nieuwe taak uit e-mail", body: taak.name, url: `/taken?lijst=${bijgewerkt.id}&ruimte=werk`, tag: `mail-${taak.id}` });
  } catch { /* best effort */ }

  return res.status(200).json({ ok: true });
}
