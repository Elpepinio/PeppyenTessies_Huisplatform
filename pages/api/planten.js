import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:planten";
const FOTO_KEY = (id) => `huishouden:planten:foto:${id}`;

// Zonder deze instelling gebruikt Next.js de standaardlimiet van 1MB per
// request. Elke opslag stuurt alle planten (incl. foto's) in één keer mee,
// dus dat loopt snel vol zodra er een paar planten met foto's bijkomen —
// zelfde patroon als eerder gefixt bij Places en Maaltijden.
export const config = { api: { bodyParser: { sizeLimit: "20mb" } } };

const EMPTY = { planten: [], onderhoudLog: [] };

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "GET") {
    try {
      const data = await redis.get(DATA_KEY);
      if (!data) return res.status(200).json(EMPTY);
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      const planten = parsed.planten || [];

      // Laad plantfoto's parallel terug uit hun eigen Redis-key, zodat het
      // hoofd-record (met alle planten + onderhoudslog) altijd klein blijft.
      const plantenMetFotos = await Promise.all(
        planten.map(async p => {
          if (!p.heeftFoto) return p;
          try {
            const foto = await redis.get(FOTO_KEY(p.id));
            return foto ? { ...p, foto } : p;
          } catch { return p; }
        })
      );

      return res.status(200).json({ ...EMPTY, ...parsed, planten: plantenMetFotos });
    } catch (e) { return res.status(500).json({ error: "Laden mislukt" }); }
  }

  if (req.method === "POST") {
    try {
      const planten = req.body.planten || [];

      // Sla foto's apart op, bewaar in het hoofd-record alleen een vlaggetje.
      const plantenMeta = await Promise.all(
        planten.map(async p => {
          const { foto, ...rest } = p;
          if (foto) {
            await redis.set(FOTO_KEY(p.id), foto);
            return { ...rest, heeftFoto: true };
          } else {
            try { await redis.del(FOTO_KEY(p.id)); } catch {}
            return { ...rest, heeftFoto: false };
          }
        })
      );

      await redis.set(DATA_KEY, JSON.stringify({ ...req.body, planten: plantenMeta }));
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: "Opslaan mislukt: " + e.message }); }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
