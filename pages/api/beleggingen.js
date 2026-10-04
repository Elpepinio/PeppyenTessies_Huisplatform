import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:beleggingen";

// Geeft bij een nieuwe/lege opslag een VOLLEDIGE standaardstructuur terug,
// nooit een kaal object — dat liet eerder bij Financieel overzicht meerdere
// tabbladen crashen zodra een verwacht veld ontbrak.
const LEGE_STRUCTUUR = {
  profiel: { fireDoelEur: "900000", dividenddoelEurPerJaar: "1200" },
  vermogen: { zakelijkEur: "" },
  dividendGerealiseerdPerJaar: "",
  posities: [],
  watchlist: [],
  cryptoPosities: [],
  laatstBijgewerkt: null,
};

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "GET") {
    const data = await redis.get(DATA_KEY);
    if (!data) return res.status(200).json(LEGE_STRUCTUUR);
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return res.status(200).json({ ...LEGE_STRUCTUUR, ...parsed });
  }

  if (req.method === "POST") {
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
