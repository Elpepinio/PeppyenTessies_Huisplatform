import { Redis } from "@upstash/redis";
import webpush from "web-push";
import { Resend } from "resend";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:abonnementen";
const SUBS_KEY = "huishouden:push-subscriptions";
const MELD_EMAIL = "pepijnrobben@hotmail.com";

// Op hoeveel dagen vóór het opzegmoment je een melding krijgt — 14 dagen als
// ruime eerste waarschuwing, 3 dagen als laatste kans, 0 als allerlaatste
// herinnering op de dag zelf. Elke drempel wordt maar één keer gemeld per
// verlengcyclus (zie gemeldeDagen hieronder).
const MELD_DREMPELS = [14, 3, 0];

function berekenLaatsteOpzegmoment(volgendeVerlengdatum, opzegtermijnDagen) {
  if (!volgendeVerlengdatum || !opzegtermijnDagen) return null;
  const datum = new Date(volgendeVerlengdatum);
  datum.setDate(datum.getDate() - (+opzegtermijnDagen || 0));
  return datum;
}
function berekenDagenTot(datum, vandaag = new Date()) {
  if (!datum) return null;
  const diffMs = new Date(datum).setHours(0, 0, 0, 0) - new Date(vandaag).setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}
// De meest urgente drempel die nu bereikt is en nog niet eerder gemeld —
// puur en dus apart te testen, los van het versturen zelf.
function vindTeMeldenDrempel(dagenTot, gemeldeDagen) {
  if (dagenTot == null || dagenTot < 0) return null;
  const nietGemeld = MELD_DREMPELS.filter(d => dagenTot <= d && !(gemeldeDagen || []).includes(d));
  if (nietGemeld.length === 0) return null;
  return Math.min(...nietGemeld);
}

export default async function handler(req, res) {
  // Vercel voegt deze header zelf toe bij een cron-aanroep; CRON_SECRET is
  // een losse, eigen omgevingsvariabele als extra bescherming tegen iemand
  // die deze URL zelf zou proberen aan te roepen.
  const auth = req.headers.authorization;
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Niet geautoriseerd" });
  }

  // Push en e-mail staan los van elkaar aan/uit — ontbreekt de ene
  // configuratie, dan werkt de andere gewoon door, in plaats van dat de
  // hele controle vroegtijdig stopt.
  const pushGeconfigureerd = !!(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  if (pushGeconfigureerd) {
    webpush.setVapidDetails("mailto:huishouden@voorbeeld.nl", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  }
  const emailGeconfigureerd = !!process.env.RESEND_API_KEY;
  const resend = emailGeconfigureerd ? new Resend(process.env.RESEND_API_KEY) : null;

  const [abonnementenData, subsData] = await Promise.all([redis.get(DATA_KEY), redis.get(SUBS_KEY)]);
  const abonnementen = abonnementenData ? (typeof abonnementenData === "string" ? JSON.parse(abonnementenData) : abonnementenData).abonnementen || [] : [];
  const subscriptions = subsData ? (typeof subsData === "string" ? JSON.parse(subsData) : subsData) : [];

  const teMelden = [];
  const bijgewerkteAbonnementen = abonnementen.map(a => {
    if (a.actief === false || a.kanAltijdOpzeggen) return a;
    const opzegmoment = berekenLaatsteOpzegmoment(a.volgendeVerlengdatum, a.opzegtermijnDagen);
    const dagenTot = berekenDagenTot(opzegmoment);
    const drempel = vindTeMeldenDrempel(dagenTot, a.gemeldeDagen);
    if (drempel === null) return a;
    teMelden.push({ abonnement: a, drempel });
    return { ...a, gemeldeDagen: [...(a.gemeldeDagen || []), drempel] };
  });

  let pushVerstuurd = 0, emailVerstuurd = 0, ongeldigeSubscriptions = [];
  for (const { abonnement, drempel } of teMelden) {
    const titel = drempel === 0 ? `Vandaag opzeggen: ${abonnement.naam}` : `Nog ${drempel} dagen om ${abonnement.naam} op te zeggen`;
    const verlengdatumTekst = new Date(abonnement.volgendeVerlengdatum).toLocaleDateString("nl-NL");

    if (pushGeconfigureerd && subscriptions.length > 0) {
      const payload = JSON.stringify({
        title: titel,
        body: `${abonnement.naam} verlengt op ${verlengdatumTekst}.`,
        url: "/abonnementen",
        tag: `abonnement-${abonnement.id}-${drempel}`,
      });
      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(sub, payload);
          pushVerstuurd++;
        } catch (e) {
          // 404/410 = de browser-subscription bestaat niet meer (bv.
          // toestel uitgelogd of app verwijderd) — die ruimen we automatisch op.
          if (e.statusCode === 404 || e.statusCode === 410) ongeldigeSubscriptions.push(sub.endpoint);
        }
      }
    }

    if (emailGeconfigureerd) {
      try {
        await resend.emails.send({
          from: "Ons Huishouden <onboarding@resend.dev>",
          to: MELD_EMAIL,
          subject: titel,
          html: `<p>${abonnement.naam} verlengt op <strong>${verlengdatumTekst}</strong>.</p><p>${drempel === 0 ? "Dit is de allerlaatste dag om op te zeggen als je dat wilt." : `Je hebt nog ${drempel} dagen om op te zeggen.`}</p><p><a href="https://${req.headers.host}/abonnementen">Bekijk in Abonnementen</a></p>`,
        });
        emailVerstuurd++;
      } catch { /* een mislukte e-mail mag de rest van de controle niet blokkeren */ }
    }
  }

  await redis.set(DATA_KEY, JSON.stringify({ abonnementen: bijgewerkteAbonnementen }));
  if (ongeldigeSubscriptions.length > 0) {
    await redis.set(SUBS_KEY, JSON.stringify(subscriptions.filter(s => !ongeldigeSubscriptions.includes(s.endpoint))));
  }

  return res.status(200).json({
    gecontroleerd: abonnementen.length,
    meldingenTeVersturen: teMelden.length,
    pushVerstuurd, emailVerstuurd,
    pushGeconfigureerd, emailGeconfigureerd,
    opgeruimdeSubscriptions: ongeldigeSubscriptions.length,
  });
}
