// Pincode van de werkruimte: status, instellen, ontgrendelen, vergrendelen,
// wijzigen en herstellen met de herstelcode. Werkt altijd voor de persoon
// uit de sessie.
import {
  werkContext, stelPinIn, controleerPin, markeerOntgrendeld, vergrendel, wijzigPin, herstelPin,
} from "../../../lib/werk-opslag";

export default async function handler(req, res) {
  const ctx = await werkContext(req);
  if (!ctx.ingelogd) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "GET") {
    return res.status(200).json({ user: ctx.user, pinIngesteld: !!ctx.pinIngesteld, ontgrendeld: !!ctx.ontgrendeld });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }
  if (!ctx.slug) return res.status(403).json({ error: "Log opnieuw in en kies je naam om je werkruimte te gebruiken" });

  const { actie, pin, nieuwePin, herstelcode } = req.body || {};
  try {
    if (actie === "instellen") {
      const r = await stelPinIn(ctx.slug, pin);
      await markeerOntgrendeld(ctx.token, ctx.user, r.versie);
      return res.status(200).json({ ok: true, herstelcode: r.herstelcode });
    }
    if (actie === "ontgrendel") {
      const r = await controleerPin(ctx.slug, pin);
      if (!r.ok) return res.status(r.geblokkeerd ? 429 : 401).json({ error: r.fout });
      await markeerOntgrendeld(ctx.token, ctx.user, r.versie);
      return res.status(200).json({ ok: true });
    }
    if (actie === "vergrendel") {
      await vergrendel(ctx.token);
      return res.status(200).json({ ok: true });
    }
    if (actie === "wijzig") {
      const r = await wijzigPin(ctx.slug, pin, nieuwePin);
      await markeerOntgrendeld(ctx.token, ctx.user, r.versie);
      return res.status(200).json({ ok: true, herstelcode: r.herstelcode });
    }
    if (actie === "herstel") {
      const r = await herstelPin(ctx.slug, herstelcode, nieuwePin);
      await markeerOntgrendeld(ctx.token, ctx.user, r.versie);
      return res.status(200).json({ ok: true, herstelcode: r.herstelcode });
    }
    return res.status(400).json({ error: "Onbekende actie" });
  } catch (e) {
    return res.status(400).json({ error: e.message || "Dat lukte niet" });
  }
}
