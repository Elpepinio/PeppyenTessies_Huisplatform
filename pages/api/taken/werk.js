// Werkruimte-data (lijsten, klanten, instellingen) van de INGELOGDE persoon.
// Alleen bereikbaar na ontgrendelen met de eigen pincode; de persoon komt
// altijd uit de sessie, nooit uit het verzoek — zo kan niemand andermans
// werkruimte opvragen door een naam mee te sturen.
import { werkContext, leesWerkData, schrijfWerkData } from "../../../lib/werk-opslag";
import { voegLijstenSamen } from "../../../lib/taken-logica";
import { synchroniseerHerinneringen } from "../../../lib/herinneringen";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default async function handler(req, res) {
  const ctx = await werkContext(req);
  if (!ctx.ingelogd) return res.status(401).json({ error: "Niet ingelogd" });
  if (!ctx.slug) return res.status(403).json({ error: "Log opnieuw in en kies je naam om je werkruimte te gebruiken" });
  if (!ctx.ontgrendeld) return res.status(423).json({ error: "Werkruimte is vergrendeld", vergrendeld: true, pinIngesteld: ctx.pinIngesteld });

  try {
    if (req.method === "GET") {
      const data = await leesWerkData(ctx.slug);
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const inkomend = req.body || {};
      const huidig = await leesWerkData(ctx.slug);
      const volgend = { ...huidig };
      if (Array.isArray(inkomend.lists)) {
        volgend.lists = voegLijstenSamen(huidig.lists, inkomend.lists, inkomend.deletedListIds || []);
      }
      if (Array.isArray(inkomend.klanten)) {
        volgend.klanten = inkomend.klanten
          .filter(k => k && k.id && String(k.naam || "").trim())
          .map(k => ({ id: String(k.id), naam: String(k.naam).trim().slice(0, 60), kleur: k.kleur || null, gearchiveerd: !!k.gearchiveerd }));
      }
      await schrijfWerkData(ctx.slug, volgend);
      try {
        await synchroniseerHerinneringen({ ruimte: "werk", slug: ctx.slug, eigenaar: ctx.user, lists: volgend.lists, req });
      } catch (e) { console.error("Herinneringen werk:", e?.message); }
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  } catch (e) {
    return res.status(500).json({ error: "Werkruimte kon niet worden geladen of opgeslagen" });
  }
}
