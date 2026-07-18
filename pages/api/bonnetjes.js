import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:bonnetjes";
const FOTO_KEY = (id) => `huishouden:bonnetjes:foto:${id}`;

// Zonder deze instelling gebruikt Next.js de standaardlimiet van 1MB per
// request. Elke opslag stuurt alle bonnetjes (incl. foto's) in één keer mee,
// dus dat loopt snel vol — zelfde patroon als eerder gefixt bij Places en Planten.
export const config = { api: { bodyParser: { sizeLimit: "20mb" } } };

const EMPTY = { bonnetjes: [] };

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "GET") {
    try {
      const data = await redis.get(DATA_KEY);
      if (!data) return res.status(200).json(EMPTY);
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      const bonnetjes = parsed.bonnetjes || [];

      // Laad foto's parallel terug uit hun eigen Redis-key, zodat het
      // hoofd-record altijd klein blijft.
      const bonnetjesMetFotos = await Promise.all(
        bonnetjes.map(async b => {
          if (!b.heeftFoto) return b;
          try {
            const foto = await redis.get(FOTO_KEY(b.id));
            return foto ? { ...b, foto } : b;
          } catch { return b; }
        })
      );

      return res.status(200).json({ ...EMPTY, ...parsed, bonnetjes: bonnetjesMetFotos });
    } catch (e) { return res.status(500).json({ error: "Laden mislukt" }); }
  }

  if (req.method === "POST") {
    try {
      const bonnetjes = req.body.bonnetjes || [];

      // Sla foto's apart op, bewaar in het hoofd-record alleen een vlaggetje.
      const bonnetjesMeta = await Promise.all(
        bonnetjes.map(async b => {
          const { foto, ...rest } = b;
          if (foto) {
            await redis.set(FOTO_KEY(b.id), foto);
            return { ...rest, heeftFoto: true };
          } else {
            try { await redis.del(FOTO_KEY(b.id)); } catch {}
            return { ...rest, heeftFoto: false };
          }
        })
      );

      await redis.set(DATA_KEY, JSON.stringify({ ...req.body, bonnetjes: bonnetjesMeta }));
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: "Opslaan mislukt: " + e.message }); }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
