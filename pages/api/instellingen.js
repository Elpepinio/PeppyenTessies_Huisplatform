import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:instellingen";

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "GET") {
    try {
      const data = await redis.get(DATA_KEY);
      if (!data) return res.status(200).json({});
      return res.status(200).json(typeof data === "string" ? JSON.parse(data) : data);
    } catch { return res.status(500).json({ error: "Laden mislukt" }); }
  }

  if (req.method === "POST") {
    try {
      // Merge met bestaande instellingen zodat we niets overschrijven
      const bestaand = await redis.get(DATA_KEY);
      const huidig = bestaand ? (typeof bestaand === "string" ? JSON.parse(bestaand) : bestaand) : {};
      await redis.set(DATA_KEY, JSON.stringify({ ...huidig, ...req.body }));
      return res.status(200).json({ ok: true });
    } catch { return res.status(500).json({ error: "Opslaan mislukt" }); }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
