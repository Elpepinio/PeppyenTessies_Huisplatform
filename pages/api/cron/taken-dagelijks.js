// Dagelijkse taken-cron (vercel.json, elke ochtend).
//  • Met QStash: plant herinneringen in die nu binnen het 7-dagenvenster
//    vallen (QStash plant maximaal ~7 dagen vooruit).
//  • Zonder QStash: stuurt iedereen één ochtendmelding met wat er vandaag
//    op de planning staat — dan krijg je in elk geval íéts.
import { redis, leesWerkData } from "../../../lib/werk-opslag";
import { qstashActief, synchroniseerHerinneringen, stuurPush } from "../../../lib/herinneringen";
import { PERSONEN, persoonSlug, isInMijnDag, epochNaarLokaal } from "../../../lib/taken-logica";

async function thuisLijsten() {
  const raw = await redis.get("huishouden:lijsten");
  return ((raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {}).lists || []).filter(l => l.type === "todo");
}

export default async function handler(req, res) {
  const auth = req.headers.authorization;
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Niet geautoriseerd" });
  }
  const thuis = await thuisLijsten();
  const werkPer = {};
  for (const p of PERSONEN) werkPer[p] = (await leesWerkData(persoonSlug(p))).lists;

  if (qstashActief()) {
    const resultaat = { thuis: await synchroniseerHerinneringen({ ruimte: "thuis", lists: thuis, req }) };
    for (const p of PERSONEN) {
      resultaat[p] = await synchroniseerHerinneringen({ ruimte: "werk", slug: persoonSlug(p), eigenaar: p, lists: werkPer[p], req });
    }
    return res.status(200).json({ modus: "qstash", ...resultaat });
  }

  // Ochtendoverzicht per persoon (eigen werk + thuistaken die voor iedereen
  // of voor deze persoon zijn).
  const vandaag = epochNaarLokaal(Date.now()).slice(0, 10); // Nederlandse datum, ook al draait de server op UTC
  const resultaat = {};
  for (const p of PERSONEN) {
    const thuisTaken = thuis.flatMap(l => l.items || []).filter(i => isInMijnDag(i, vandaag) && (!i.assignedTo || i.assignedTo === p));
    const werkTaken = werkPer[p].flatMap(l => l.items || []).filter(i => isInMijnDag(i, vandaag));
    const alle = [...werkTaken, ...thuisTaken];
    if (!alle.length) { resultaat[p] = "niets vandaag"; continue; }
    const namen = alle.slice(0, 4).map(i => i.name).join(", ") + (alle.length > 4 ? ` en nog ${alle.length - 4}` : "");
    resultaat[p] = await stuurPush({ ruimte: "werk", eigenaar: p }, {
      title: `☀️ Vandaag: ${alle.length} ${alle.length === 1 ? "taak" : "taken"}`,
      body: namen, url: "/taken?weergave=mijndag", tag: `ochtend-${vandaag}`,
    });
  }
  return res.status(200).json({ modus: "ochtendoverzicht", resultaat });
}
