import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const SUBS_KEY = "huishouden:push-subscriptions";

// Eén gedeelde lijst van subscriptions voor het hele huishouden — ieders
// toestel dat "Zet meldingen aan" heeft gebruikt, krijgt de meldingen.
// Subscriptions worden op hun endpoint-URL gededupliceerd (elk toestel/
// browllerprofiel heeft een uniek endpoint), zodat opnieuw aanmelden geen
// dubbele meldingen oplevert.
export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "POST") {
    const { subscription } = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ error: "Ongeldige subscription" });
    const data = await redis.get(SUBS_KEY);
    const lijst = data ? (typeof data === "string" ? JSON.parse(data) : data) : [];
    const zonderDeze = lijst.filter(s => s.endpoint !== subscription.endpoint);
    await redis.set(SUBS_KEY, JSON.stringify([...zonderDeze, subscription]));
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { endpoint } = req.body;
    const data = await redis.get(SUBS_KEY);
    const lijst = data ? (typeof data === "string" ? JSON.parse(data) : data) : [];
    await redis.set(SUBS_KEY, JSON.stringify(lijst.filter(s => s.endpoint !== endpoint)));
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", ["POST", "DELETE"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
