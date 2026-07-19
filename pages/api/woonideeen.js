import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:woonideeen";
const FOTO_KEY = (id) => `huishouden:woonideeen:foto:${id}`;

export const config = { api: { bodyParser: { sizeLimit: "20mb" } } };

const EMPTY = { ideeen: [] };

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "GET") {
    try {
      const data = await redis.get(DATA_KEY);
      if (!data) return res.status(200).json(EMPTY);
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      const ideeen = parsed.ideeen || [];

      const ideeenMetFotos = await Promise.all(
        ideeen.map(async i => {
          if (!i.heeftFoto) return i;
          try {
            const foto = await redis.get(FOTO_KEY(i.id));
            return foto ? { ...i, foto } : i;
          } catch { return i; }
        })
      );

      return res.status(200).json({ ...EMPTY, ...parsed, ideeen: ideeenMetFotos });
    } catch (e) { return res.status(500).json({ error: "Laden mislukt" }); }
  }

  if (req.method === "POST") {
    try {
      const ideeen = req.body.ideeen || [];

      const ideeenMeta = await Promise.all(
        ideeen.map(async i => {
          const { foto, ...rest } = i;
          if (foto) {
            await redis.set(FOTO_KEY(i.id), foto);
            return { ...rest, heeftFoto: true };
          } else {
            try { await redis.del(FOTO_KEY(i.id)); } catch {}
            return { ...rest, heeftFoto: false };
          }
        })
      );

      await redis.set(DATA_KEY, JSON.stringify({ ...req.body, ideeen: ideeenMeta }));
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: "Opslaan mislukt: " + e.message }); }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
