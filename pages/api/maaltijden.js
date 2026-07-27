import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";
import { logFout } from "../../lib/error-log";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:maaltijden";
const FOTO_KEY = (id, veld) => `huishouden:maaltijden:foto:${id}:${veld}`;

// Next.js' eigen bodyParser-limiet ruim gezet — maar let op: dit beschermt
// NIET tegen Vercel's eigen, harde limiet van 4,5MB per serverless-functie-
// aanvraag (die kun je met deze instelling niet omzeilen). De clientkant is
// er daarom op ingericht om nooit de hele fotobibliotheek in één aanvraag
// mee te sturen — alleen foto's die daadwerkelijk gewijzigd zijn.
export const config = { api: { bodyParser: { sizeLimit: "20mb" } } };

const EMPTY = { recepten: [], weekmenu: {}, boodschappenlijst: [] };
// Fotovelden die apart van het hoofd-record opgeslagen worden, om de 1MB-
// limiet per Redis-waarde nooit te raken naarmate er meer recepten met foto's bijkomen.
const FOTO_VELDEN = ["foto", "aiGerechtFoto"];

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "GET") {
    try {
      const data = await redis.get(DATA_KEY);
      if (!data) return res.status(200).json(EMPTY);
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      const recepten = parsed.recepten || [];

      // Laad foto's parallel per recept terug uit hun eigen Redis-key.
      const receptenMetFotos = await Promise.all(
        recepten.map(async r => {
          const aanvullingen = {};
          for (const veld of FOTO_VELDEN) {
            if (!r[`heeft_${veld}`]) continue;
            try {
              const foto = await redis.get(FOTO_KEY(r.id, veld));
              if (foto) aanvullingen[veld] = foto;
            } catch { /* foto niet gevonden, sla over */ }
          }
          return { ...r, ...aanvullingen };
        })
      );

      return res.status(200).json({ ...EMPTY, ...parsed, recepten: receptenMetFotos });
    } catch (e) { logFout({ bron: "api-maaltijden-get", bericht: e.message, stack: e.stack }); return res.status(500).json({ error: "Laden mislukt" }); }
  }

  if (req.method === "POST") {
    try {
      const recepten = req.body.recepten || [];

      // Voor het correct behouden van foto's die deze keer niet zijn
      // meegestuurd, moeten we weten wat er al lag opgeslagen.
      const huidig = await redis.get(DATA_KEY);
      const huidigParsed = huidig ? (typeof huidig === "string" ? JSON.parse(huidig) : huidig) : EMPTY;
      const huidigeReceptenById = Object.fromEntries((huidigParsed.recepten || []).map(r => [r.id, r]));

      // Sla fotovelden apart op, bewaar in het hoofd-record alleen een vlaggetje.
      // BELANGRIJK: als een fotoveld helemaal NIET is meegestuurd (de tool
      // stuurt tegenwoordig alleen gewijzigde foto's mee, niet meer de hele
      // fotobibliotheek bij elke opslag), betekent dat "ongewijzigd laten" —
      // niet "verwijderen". Alleen een expliciet meegestuurde lege waarde
      // (bv. de gebruiker heeft de foto zelf verwijderd) verwijdert 'm echt.
      const receptenMeta = await Promise.all(
        recepten.map(async r => {
          const rest = { ...r };
          const bestaand = huidigeReceptenById[r.id];
          const vlaggen = {};
          for (const veld of FOTO_VELDEN) {
            const veldMeegestuurd = Object.prototype.hasOwnProperty.call(rest, veld);
            const waarde = rest[veld];
            delete rest[veld];
            if (!veldMeegestuurd) {
              if (bestaand?.[`heeft_${veld}`]) vlaggen[`heeft_${veld}`] = true;
              continue;
            }
            if (waarde) {
              await redis.set(FOTO_KEY(r.id, veld), waarde);
              vlaggen[`heeft_${veld}`] = true;
            } else {
              try { await redis.del(FOTO_KEY(r.id, veld)); } catch {}
              vlaggen[`heeft_${veld}`] = false;
            }
          }
          return { ...rest, ...vlaggen };
        })
      );

      await redis.set(DATA_KEY, JSON.stringify({ ...req.body, recepten: receptenMeta }));
      return res.status(200).json({ ok: true });
    } catch (e) { logFout({ bron: "api-maaltijden-post", bericht: e.message, stack: e.stack }); return res.status(500).json({ error: "Opslaan mislukt: " + e.message }); }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
