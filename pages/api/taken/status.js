// Welke onderdelen zijn op deze deployment ingericht? De Taken-pagina toont
// daarmee een duidelijke uitleg i.p.v. stilletjes niets te doen.
import { werkContext, leesMailDomein } from "../../../lib/werk-opslag";
import { qstashActief, pushActief } from "../../../lib/herinneringen";

export default async function handler(req, res) {
  const ctx = await werkContext(req);
  if (!ctx.ingelogd) return res.status(401).json({ error: "Niet ingelogd" });
  return res.status(200).json({
    user: ctx.user,
    werk: { pinIngesteld: !!ctx.pinIngesteld, ontgrendeld: !!ctx.ontgrendeld },
    herinneringenOpTijd: qstashActief(),
    push: pushActief(),
    mail: {
      webhookIngericht: !!(process.env.RESEND_WEBHOOK_SECRET && process.env.RESEND_API_KEY),
      domein: await leesMailDomein(),
    },
  });
}
