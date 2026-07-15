import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq, getSessionUser } from "../../lib/auth";
import { logFout } from "../../lib/error-log";

const redis = Redis.fromEnv();
const LOG_KEY = "huishouden:foutlog";

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "POST") {
    try {
      const { bron, bericht, stack, url } = req.body || {};
      const gebruiker = await getSessionUser(token);
      await logFout({ bron: bron || "client", bericht, stack, url, gebruiker });
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: "Loggen mislukt" }); }
  }

  if (req.method === "GET") {
    try {
      const data = await redis.get(LOG_KEY);
      const log = data ? (typeof data === "string" ? JSON.parse(data) : data) : [];
      return res.status(200).json({ log: [...log].reverse() });
    } catch (e) { return res.status(500).json({ error: "Laden mislukt" }); }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
