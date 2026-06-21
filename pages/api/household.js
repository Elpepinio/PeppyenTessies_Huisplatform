import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:data";

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  const loggedIn = await isValidSession(token);
  if (!loggedIn) {
    return res.status(401).json({ error: "Niet ingelogd" });
  }

  if (req.method === "GET") {
    try {
      const data = await redis.get(DATA_KEY);
      if (!data) {
        return res.status(200).json({ items: [], history: {}, favorites: [] });
      }
      // Upstash kan het object al geparsed teruggeven, of als string
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return res.status(200).json({
        items: parsed.items || [],
        history: parsed.history || {},
        favorites: parsed.favorites || [],
      });
    } catch (e) {
      return res.status(500).json({ error: "Kon data niet laden" });
    }
  }

  if (req.method === "POST") {
    try {
      const { items, history, favorites } = req.body;
      await redis.set(
        DATA_KEY,
        JSON.stringify({
          items: items || [],
          history: history || {},
          favorites: favorites || [],
        })
      );
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Kon data niet opslaan" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
