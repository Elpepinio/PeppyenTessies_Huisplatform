import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:gezondheid";
const FOTO_KEY = (id) => `huishouden:gezondheid:foto:${id}`;

export const config = { api: { bodyParser: { sizeLimit: "20mb" } } };

const EMPTY = { klachten: [], medicatie: [], afspraken: [], contacten: [], allergieen: [], persoonProfielen: {} };

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "GET") {
    try {
      const data = await redis.get(DATA_KEY);
      if (!data) return res.status(200).json(EMPTY);
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      const klachten = parsed.klachten || [];

      const klachtenMetFotos = await Promise.all(
        klachten.map(async k => {
          if (!k.heeftFoto) return k;
          try {
            const foto = await redis.get(FOTO_KEY(k.id));
            return foto ? { ...k, foto } : k;
          } catch { return k; }
        })
      );

      return res.status(200).json({ ...EMPTY, ...parsed, klachten: klachtenMetFotos });
    } catch (e) { return res.status(500).json({ error: "Laden mislukt" }); }
  }

  if (req.method === "POST") {
    try {
      const klachten = req.body.klachten || [];

      const huidig = await redis.get(DATA_KEY);
      const huidigParsed = huidig ? (typeof huidig === "string" ? JSON.parse(huidig) : huidig) : EMPTY;
      const huidigeKlachtenById = Object.fromEntries((huidigParsed.klachten || []).map(k => [k.id, k]));

      // Zelfde patroon als bij Maaltijden: een niet-meegestuurd fotoveld
      // betekent "ongewijzigd laten", nooit stilzwijgend verwijderen — en de
      // tool stuurt bewust alleen gewijzigde foto's mee (niet de hele
      // geschiedenis bij elke opslag), om nooit tegen Vercel's aanvraaglimiet
      // aan te lopen naarmate het logboek groeit.
      const klachtenMeta = await Promise.all(
        klachten.map(async k => {
          const rest = { ...k };
          const bestaand = huidigeKlachtenById[k.id];
          const veldMeegestuurd = Object.prototype.hasOwnProperty.call(rest, "foto");
          const waarde = rest.foto;
          delete rest.foto;
          if (!veldMeegestuurd) {
            return bestaand?.heeftFoto ? { ...rest, heeftFoto: true } : rest;
          }
          if (waarde) {
            await redis.set(FOTO_KEY(k.id), waarde);
            return { ...rest, heeftFoto: true };
          } else {
            try { await redis.del(FOTO_KEY(k.id)); } catch {}
            return { ...rest, heeftFoto: false };
          }
        })
      );

      await redis.set(DATA_KEY, JSON.stringify({ ...req.body, klachten: klachtenMeta }));
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: "Opslaan mislukt: " + e.message }); }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
