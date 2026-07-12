import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const META_KEY  = "huishouden:places:meta";   // alles behalve foto's
const FOTO_KEY  = (id) => `huishouden:places:fotos:${id}`;

export const config = { api: { bodyParser: { sizeLimit: "20mb" } } };

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "GET") {
    try {
      const meta = await redis.get(META_KEY);
      if (!meta) return res.status(200).json({ places: [] });
      const parsed = typeof meta === "string" ? JSON.parse(meta) : meta;
      const places = parsed.places || [];

      // Laad foto's parallel per place
      const placesMetFotos = await Promise.all(
        places.map(async p => {
          if (!p.heeftFotos) return { ...p, fotos: [] };
          try {
            const fotos = await redis.get(FOTO_KEY(p.id));
            return { ...p, fotos: fotos ? (typeof fotos === "string" ? JSON.parse(fotos) : fotos) : [] };
          } catch { return { ...p, fotos: [] }; }
        })
      );

      return res.status(200).json({ places: placesMetFotos });
    } catch (e) { return res.status(500).json({ error: "Laden mislukt" }); }
  }

  if (req.method === "POST") {
    try {
      const { places = [] } = req.body;

      // Sla foto's apart op, bewaar metadata zonder foto-data
      const placesMeta = await Promise.all(
        places.map(async p => {
          const { fotos = [], ...rest } = p;
          if (fotos.length > 0) {
            await redis.set(FOTO_KEY(p.id), JSON.stringify(fotos));
            return { ...rest, heeftFotos: true };
          } else {
            // Verwijder foto-key als er geen foto's meer zijn
            try { await redis.del(FOTO_KEY(p.id)); } catch {}
            return { ...rest, heeftFotos: false };
          }
        })
      );

      await redis.set(META_KEY, JSON.stringify({ places: placesMeta }));
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: "Opslaan mislukt: " + e.message }); }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
