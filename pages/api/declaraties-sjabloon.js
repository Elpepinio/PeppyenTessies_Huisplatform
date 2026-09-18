import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:declaraties-sjablonen";
// { Pepijn: { bestandsnaam, volledigeNaam, base64 }, Tessa: { ... } }
const EMPTY = {};

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "GET") {
    const data = await redis.get(DATA_KEY);
    if (!data) return res.status(200).json(EMPTY);
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    // De base64-inhoud zelf hoeft de client niet te zien voor een gewone
    // lijst-weergave — alleen of er een sjabloon is en onder welke naam.
    // (Bij het daadwerkelijk vullen wordt-ie server-side gelezen.)
    const overzicht = {};
    for (const persoon of Object.keys(parsed)) {
      overzicht[persoon] = { bestandsnaam: parsed[persoon].bestandsnaam, volledigeNaam: parsed[persoon].volledigeNaam };
    }
    return res.status(200).json(overzicht);
  }

  if (req.method === "POST") {
    try {
      const { persoon, bestandsnaam, volledigeNaam, base64 } = req.body;
      if (!persoon) return res.status(400).json({ error: "Geen persoon opgegeven" });
      const data = await redis.get(DATA_KEY);
      const parsed = data ? (typeof data === "string" ? JSON.parse(data) : data) : {};
      if (base64) {
        parsed[persoon] = { bestandsnaam, volledigeNaam, base64 };
      } else if (parsed[persoon]) {
        // Alleen de volledige naam wijzigen, zonder het bestand opnieuw te uploaden.
        parsed[persoon].volledigeNaam = volledigeNaam;
      }
      await redis.set(DATA_KEY, JSON.stringify(parsed));
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Opslaan mislukt: " + e.message });
    }
  }

  if (req.method === "DELETE") {
    try {
      const { persoon } = req.body;
      const data = await redis.get(DATA_KEY);
      const parsed = data ? (typeof data === "string" ? JSON.parse(data) : data) : {};
      delete parsed[persoon];
      await redis.set(DATA_KEY, JSON.stringify(parsed));
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Verwijderen mislukt" });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "DELETE"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
