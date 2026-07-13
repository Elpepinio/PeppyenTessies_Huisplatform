import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const LOG_KEY = "huishouden:ai-gebruik";

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }

  try {
    const data = await redis.get(LOG_KEY);
    const log = data ? (typeof data === "string" ? JSON.parse(data) : data) : [];
    return res.status(200).json({ log });
  } catch (e) {
    return res.status(500).json({ error: "Laden mislukt" });
  }
}
