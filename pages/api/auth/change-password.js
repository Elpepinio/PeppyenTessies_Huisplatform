import { verifyPassword, createHousehold, hasHousehold, getSessionTokenFromReq, isValidSession } from "../../../lib/auth";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }

  // Moet ingelogd zijn
  const token = getSessionTokenFromReq(req);
  const loggedIn = await isValidSession(token);
  if (!loggedIn) return res.status(401).json({ error: "Niet ingelogd" });

  const { huidigPw, nieuwPw } = req.body || {};
  if (!huidigPw || !nieuwPw) return res.status(400).json({ error: "Velden ontbreken" });
  if (nieuwPw.length < 6) return res.status(400).json({ error: "Nieuw wachtwoord moet minstens 6 tekens zijn" });

  try {
    // Verifieer huidig wachtwoord
    const geldig = await verifyPassword(huidigPw);
    if (!geldig) return res.status(401).json({ error: "Huidig wachtwoord is onjuist" });

    // Haal huidige naam op
    const raw = await redis.get("huishouden:account");
    const account = typeof raw === "string" ? JSON.parse(raw) : raw;
    const naam = account?.name || "Huishouden";

    // Sla nieuw wachtwoord op (createHousehold overschrijft bestaand account)
    await createHousehold(naam, nieuwPw);

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Kon wachtwoord niet wijzigen" });
  }
}
