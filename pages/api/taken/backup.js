// Back-up van je werkruimte (alleen je eigen, alleen na ontgrendelen).
//  GET                      → lijst automatische momentopnames (14 dagen)
//  GET ?download=nu         → huidige werkdata als JSON-bestand
//  GET ?download=<datum>    → momentopname van die dag als JSON-bestand
//  POST { herstel: datum }  → zet die momentopname terug (de huidige stand
//                              wordt eerst apart bewaard, zodat ook dat
//                              terug te draaien is)
//  POST { importeer: data } → zet een eerder gedownload bestand terug
import { werkContext, leesWerkData, redis, sleutels, lijstMomentopnames, BEWAAR_DAGEN } from "../../../lib/werk-opslag";

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };

const geldigeDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
const parse = (w) => (w == null ? null : typeof w === "string" ? JSON.parse(w) : w);
function isWerkData(d) {
  return d && typeof d === "object" && Array.isArray(d.lists);
}

export default async function handler(req, res) {
  const ctx = await werkContext(req);
  if (!ctx.ingelogd) return res.status(401).json({ error: "Niet ingelogd" });
  if (!ctx.slug) return res.status(403).json({ error: "Kies eerst je naam" });
  if (!ctx.ontgrendeld) return res.status(423).json({ error: "Werkruimte is vergrendeld", vergrendeld: true });

  try {
    if (req.method === "GET") {
      const { download } = req.query;
      if (!download) {
        const lijst = await lijstMomentopnames(ctx.slug);
        const voor = await redis.strlen(sleutels.voorHerstel(ctx.slug)).catch(() => 0);
        return res.status(200).json({ momentopnames: lijst, bewaarDagen: BEWAAR_DAGEN, voorHerstel: voor > 0 });
      }
      let data;
      if (download === "nu") data = await leesWerkData(ctx.slug);
      else if (download === "voor-herstel") data = parse(await redis.get(sleutels.voorHerstel(ctx.slug)));
      else if (geldigeDatum(download)) data = parse(await redis.get(sleutels.momentopname(ctx.slug, download)));
      if (!data) return res.status(404).json({ error: "Deze back-up bestaat niet (meer)" });
      const naam = `werkruimte-${ctx.slug}-${download === "nu" ? new Date().toISOString().slice(0, 10) : download}.json`;
      res.setHeader("Content-Disposition", `attachment; filename="${naam}"`);
      return res.status(200).json({ soort: "werkruimte-backup", versie: 1, persoon: ctx.user, gemaaktOp: new Date().toISOString(), bron: download, data });
    }

    if (req.method === "POST") {
      const { herstel, importeer } = req.body || {};
      let nieuw = null;
      if (herstel === "voor-herstel") nieuw = parse(await redis.get(sleutels.voorHerstel(ctx.slug)));
      else if (geldigeDatum(herstel)) nieuw = parse(await redis.get(sleutels.momentopname(ctx.slug, herstel)));
      else if (importeer) nieuw = importeer.soort === "werkruimte-backup" ? importeer.data : importeer;
      if (!isWerkData(nieuw)) return res.status(400).json({ error: "Geen geldige back-up van een werkruimte" });
      // Huidige stand eerst veilig apart zetten (30 dagen), dan terugzetten.
      const huidig = await leesWerkData(ctx.slug);
      await redis.set(sleutels.voorHerstel(ctx.slug), JSON.stringify(huidig), { ex: 30 * 86400 });
      // Instellingen (mail-adres) van nu houden: die horen bij de koppelingen.
      const terug = { ...nieuw, instellingen: { ...(nieuw.instellingen || {}), ...(huidig.instellingen || {}) } };
      await redis.set(sleutels.data(ctx.slug), JSON.stringify(terug));
      return res.status(200).json({ ok: true, lijsten: terug.lists.length });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  } catch (e) {
    console.error("backup", e);
    return res.status(500).json({ error: "Er ging iets mis met de back-up" });
  }
}
