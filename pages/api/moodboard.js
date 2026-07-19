import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:moodboard";
const FOTO_KEY = (id) => `huishouden:moodboard:foto:${id}`;

export const config = { api: { bodyParser: { sizeLimit: "20mb" } } };

const EMPTY = { stalen: [] };

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "GET") {
    try {
      const data = await redis.get(DATA_KEY);
      if (!data) return res.status(200).json(EMPTY);
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      const stalen = parsed.stalen || [];

      const stalenMetFotos = await Promise.all(
        stalen.map(async s => {
          if (!s.heeftFoto) return s;
          try {
            const foto = await redis.get(FOTO_KEY(s.id));
            return foto ? { ...s, foto } : s;
          } catch { return s; }
        })
      );

      return res.status(200).json({ ...EMPTY, ...parsed, stalen: stalenMetFotos });
    } catch (e) { return res.status(500).json({ error: "Laden mislukt" }); }
  }

  if (req.method === "POST") {
    try {
      const stalen = req.body.stalen || [];

      const stalenMeta = await Promise.all(
        stalen.map(async s => {
          const { foto, ...rest } = s;
          if (foto) {
            await redis.set(FOTO_KEY(s.id), foto);
            return { ...rest, heeftFoto: true };
          } else {
            try { await redis.del(FOTO_KEY(s.id)); } catch {}
            return { ...rest, heeftFoto: false };
          }
        })
      );

      await redis.set(DATA_KEY, JSON.stringify({ ...req.body, stalen: stalenMeta }));
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: "Opslaan mislukt: " + e.message }); }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
