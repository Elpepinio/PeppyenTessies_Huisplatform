// Instellingen voor "taak via e-mail" van de ingelogde persoon: het eigen
// adres (altijd terug te vinden), welke afzenders taken mogen aanmaken, het
// ontvangstdomein van Resend en het laatste ontvangstlogboek.
import {
  werkContext, leesWerkData, schrijfWerkData, leesMailDomein, zorgVoorMailToken, vernieuwMailToken, redis, sleutels,
} from "../../../lib/werk-opslag";
import { mailAdres, isGeldigDomein, emailUitAfzender } from "../../../lib/taken-logica";

async function antwoord(ctx, data) {
  const token = await zorgVoorMailToken(ctx.slug, ctx.user, data);
  const domein = await leesMailDomein();
  const log = await redis.lrange(`taken:mail-log:${ctx.slug}`, 0, 9);
  return {
    adres: mailAdres(token, domein),
    domein,
    domeinVastInVercel: !!process.env.RESEND_INBOUND_DOMEIN,
    toegestaneAfzenders: data.instellingen?.toegestaneAfzenders || [],
    webhookIngericht: !!(process.env.RESEND_WEBHOOK_SECRET && process.env.RESEND_API_KEY),
    log: (log || []).map(r => (typeof r === "string" ? JSON.parse(r) : r)),
  };
}

export default async function handler(req, res) {
  const ctx = await werkContext(req);
  if (!ctx.ingelogd) return res.status(401).json({ error: "Niet ingelogd" });
  if (!ctx.slug) return res.status(403).json({ error: "Kies eerst je naam bij het inloggen" });
  if (!ctx.ontgrendeld) return res.status(423).json({ error: "Werkruimte is vergrendeld", vergrendeld: true });

  try {
    const data = await leesWerkData(ctx.slug);
    if (req.method === "GET") return res.status(200).json(await antwoord(ctx, data));

    if (req.method === "POST") {
      const { toegestaneAfzenders, domein, vernieuw } = req.body || {};
      if (Array.isArray(toegestaneAfzenders)) {
        const schoon = [...new Set(toegestaneAfzenders.map(emailUitAfzender).filter(a => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)))].slice(0, 10);
        data.instellingen = { ...(data.instellingen || {}), toegestaneAfzenders: schoon };
        await schrijfWerkData(ctx.slug, data);
      }
      if (typeof domein === "string" && !process.env.RESEND_INBOUND_DOMEIN) {
        const d = domein.replace(/^@/, "").trim().toLowerCase();
        if (d && !isGeldigDomein(d)) return res.status(400).json({ error: "Dat lijkt geen geldig domein (bijv. abc123.resend.app)" });
        if (d) await redis.set(sleutels.mailDomein(), d); else await redis.del(sleutels.mailDomein());
      }
      if (vernieuw) await vernieuwMailToken(ctx.slug, ctx.user, data);
      return res.status(200).json(await antwoord(ctx, await leesWerkData(ctx.slug)));
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  } catch (e) {
    return res.status(500).json({ error: "Kon e-mailinstellingen niet laden" });
  }
}
