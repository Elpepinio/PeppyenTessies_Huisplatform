import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";
import { logFout } from "../../lib/error-log";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:maaltijden";
const FOTO_KEY = (id, veld) => `huishouden:maaltijden:foto:${id}:${veld}`;

// Zonder deze instelling gebruikt Next.js de standaardlimiet van 1MB per
// request — veel te weinig zodra er een paar recepten met foto's bijkomen,
// want elke opslag stuurt de volledige receptenlijst (incl. alle foto's) in
// één keer mee. Zelfde aanpak als bij Places, waar dit al langer goed staat.
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

      // Sla fotovelden apart op, bewaar in het hoofd-record alleen een vlaggetje.
      const receptenMeta = await Promise.all(
        recepten.map(async r => {
          const rest = { ...r };
          const vlaggen = {};
          for (const veld of FOTO_VELDEN) {
            const waarde = rest[veld];
            delete rest[veld];
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
