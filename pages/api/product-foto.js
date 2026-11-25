import { Redis } from "@upstash/redis";
import crypto from "crypto";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

// Productfoto's voor de boodschappenlijst. Los van de lijst-data bewaard
// (anders wordt elke lijst-opslag zwaar), en per id onveranderlijk: een
// nieuwe foto krijgt altijd een nieuw id. Daardoor kan de browser/service
// worker ze voor altijd cachen — ook handig in de winkel zonder bereik.
const redis = Redis.fromEnv();
const sleutel = (id) => `huishouden:foto:${id}`;
const MAX_BYTES = 700 * 1024; // na verkleinen in de app is een foto ±100–250 kB

export const config = { api: { bodyParser: { sizeLimit: "1.5mb" } } };

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!(await isValidSession(token))) return res.status(401).json({ error: "Niet ingelogd" });
  const id = String(req.query.id || "");
  const geldigId = /^[a-f0-9]{24}$/.test(id);

  if (req.method === "GET") {
    if (!geldigId) return res.status(400).json({ error: "Ongeldig id" });
    const data = await redis.get(sleutel(id));
    const m = typeof data === "string" && data.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!m) return res.status(404).json({ error: "Foto niet gevonden" });
    const buf = Buffer.from(m[2], "base64");
    res.setHeader("Content-Type", m[1]);
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    return res.status(200).send(buf);
  }

  if (req.method === "POST") {
    const data = String(req.body?.data || "");
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data)) return res.status(400).json({ error: "Geen geldige foto" });
    if (data.length * 0.75 > MAX_BYTES) return res.status(413).json({ error: "Foto is te groot" });
    const nieuwId = crypto.randomBytes(12).toString("hex");
    await redis.set(sleutel(nieuwId), data);
    return res.status(200).json({ id: nieuwId });
  }

  if (req.method === "DELETE") {
    if (!geldigId) return res.status(400).json({ error: "Ongeldig id" });
    await redis.del(sleutel(id));
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", ["GET", "POST", "DELETE"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
