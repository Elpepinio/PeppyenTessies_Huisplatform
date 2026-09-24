import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:declaraties";
const EMPTY = { items: [], favorieten: [] };
const BON_KEY = (itemId) => `huishouden:declaraties:bon:${itemId}`;

// Bonnetje-foto's kunnen groter zijn dan Vercel's standaardlimiet van 4,5MB.
export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  // Eén specifieke bon-foto ophalen — lazy, pas als je 'm daadwerkelijk wilt
  // bekijken of het declaratieformulier vult, niet standaard meegestuurd
  // met de rest van het overzicht (zelfde aanpak als media in Schetsboek).
  if (req.method === "GET" && req.query.bon) {
    try {
      const foto = await redis.get(BON_KEY(req.query.bon));
      if (!foto) return res.status(404).json({ error: "Bon niet gevonden" });
      return res.status(200).json({ foto });
    } catch (e) {
      return res.status(500).json({ error: "Kon bon niet laden" });
    }
  }

  if (req.method === "GET") {
    const data = await redis.get(DATA_KEY);
    if (!data) return res.status(200).json(EMPTY);
    return res.status(200).json(typeof data === "string" ? JSON.parse(data) : data);
  }

  if (req.method === "POST") {
    const { actie } = req.body;

    if (actie === "bonOpslaan") {
      try {
        const { itemId, foto } = req.body;
        await redis.set(BON_KEY(itemId), foto);
        return res.status(200).json({ ok: true });
      } catch (e) {
        return res.status(500).json({ error: "Opslaan van de bon mislukt" });
      }
    }

    if (actie === "bonVerwijderen") {
      try {
        await redis.del(BON_KEY(req.body.itemId));
        return res.status(200).json({ ok: true });
      } catch (e) {
        return res.status(500).json({ error: "Verwijderen van de bon mislukt" });
      }
    }

    // Geen actie meegegeven: het bestaande, volledige items+favorieten-blok opslaan.
    try {
      await redis.set(DATA_KEY, JSON.stringify(req.body));
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Opslaan mislukt" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
