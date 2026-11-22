// Wordt op het afgesproken moment door Upstash QStash aangeroepen (niet door
// de app zelf). Controleert de QStash-handtekening, kijkt of de taak nog
// bestaat, nog open is en de herinnering niet intussen is verzet, en stuurt
// dan de pushmelding naar de juiste toestellen.
import { Receiver } from "@upstash/qstash";
import { redis, leesWerkData } from "../../../lib/werk-opslag";
import { stuurPush, verwijderGeplandeHerinnering } from "../../../lib/herinneringen";
import { persoonSlug, herinneringTekst, dagenTussen, epochNaarLokaal } from "../../../lib/taken-logica";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }
  if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
    return res.status(503).json({ error: "QStash-ondertekening niet ingericht" });
  }
  const ruw = await leesRuweBody(req);
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
  });
  try {
    const geldig = await receiver.verify({ signature: req.headers["upstash-signature"], body: ruw });
    if (!geldig) throw new Error("ongeldig");
  } catch {
    return res.status(401).json({ error: "Ongeldige handtekening" });
  }

  let bericht;
  try { bericht = JSON.parse(ruw); } catch { return res.status(400).json({ error: "Ongeldige inhoud" }); }
  const { ruimte, eigenaar, listId, itemId, tijd } = bericht || {};
  const slug = ruimte === "werk" ? persoonSlug(eigenaar) : null;
  if (ruimte === "werk" && !slug) return res.status(200).json({ genegeerd: "onbekende eigenaar" });

  let lijsten = [];
  if (ruimte === "werk") {
    lijsten = (await leesWerkData(slug)).lists;
  } else {
    const raw = await redis.get("huishouden:lijsten");
    lijsten = (raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {}).lists || [];
  }
  const lijst = lijsten.find(l => l.id === listId);
  const item = lijst?.items?.find(i => i.id === itemId);
  await verwijderGeplandeHerinnering(ruimte, slug, itemId);
  if (!item || item.checked || item.herinnering !== tijd) return res.status(200).json({ genegeerd: "taak gewijzigd of klaar" });

  // Wekelijkse offerte-navraag: als vraag formuleren, met hoe lang geleden.
  const offerte = item.offerteNavraag ? lijst.project?.offerte : null;
  const dagen = offerte?.verstuurdOp ? dagenTussen(offerte.verstuurdOp, epochNaarLokaal(Date.now()).slice(0, 10)) : null;
  const r = await stuurPush(
    { ruimte, eigenaar, toegewezenAan: ruimte === "thuis" ? item.assignedTo : null },
    {
      title: offerte ? `📨 Al iets gehoord over "${lijst.name}"?` : `🔔 ${item.name}`,
      body: offerte
        ? `Offerte ${dagen != null ? `${dagen} dagen geleden ` : ""}verstuurd${offerte.bedrag ? ` (€ ${Number(offerte.bedrag).toLocaleString("nl-NL")})` : ""}. Vraag even na — tik op Akkoord, Nagevraagd of Afgewezen.`
        : `${lijst.icon || ""} ${lijst.name} · ${herinneringTekst(item)}`.trim(),
      url: `/taken?lijst=${encodeURIComponent(listId)}&taak=${encodeURIComponent(itemId)}&ruimte=${ruimte}`,
      tag: `taak-${itemId}`,
    }
  );
  return res.status(200).json({ ok: true, ...r });
}
