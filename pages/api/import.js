import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();

export const config = { api: { bodyParser: { sizeLimit: "25mb" } } };

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }

  try {
    const { data } = req.body || {};
    if (!data || typeof data !== "object") return res.status(400).json({ error: "Ongeldig back-upbestand" });

    let hersteld = 0;
    const fouten = [];

    await Promise.all(Object.entries(data).map(async ([key, waarde]) => {
      // huishouden:account bewust NOOIT terugzetten: een export bevat dat
      // record altijd zonder wachtwoord/2FA-velden (met opzet, zie export.js),
      // dus terugschrijven zou het huidige, werkende account kapotmaken.
      // Inloggegevens horen sowieso niet bij een data-herstel thuis.
      if (key === "huishouden:account") return;
      if (!key.startsWith("huishouden:")) return; // veiligheidsgrendel: nooit buiten onze eigen sleutels schrijven

      try {
        const opTeSlaan = typeof waarde === "string" ? waarde : JSON.stringify(waarde);
        await redis.set(key, opTeSlaan);
        hersteld++;
      } catch (e) {
        fouten.push(key);
      }
    }));

    return res.status(200).json({ ok: true, hersteld, fouten });
  } catch (e) {
    return res.status(500).json({ error: "Herstellen mislukt: " + e.message });
  }
}
