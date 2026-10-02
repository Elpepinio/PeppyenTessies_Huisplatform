import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:financieel";

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "GET") {
    const data = await redis.get(DATA_KEY);
    // Een kale {} liet eerdere versies van de pagina crashen zodra een
    // tabblad (Hypotheek/Toeslagen/BV) een geneste eigenschap verwachtte
    // die er dan niet was — vandaar nu een volledige standaardstructuur,
    // ook al beschermt elk tabblad zich inmiddels zelf ook defensief.
    if (!data) {
      return res.status(200).json({
        hypotheek: { delen: [{ id: "deel-1", naam: "Hypotheekdeel 1", type: "annuitair", schuld: "", rente: "", resterendeJaren: "" }], extraDeelIdx: 0, extraBedrag: "", verwachtRendement: "6", wozWaarde: "" },
        kot: { aantalKinderen: 1, urenPerMaandKind1: "", typeKind1: "dagopvang", urenPerMaandKind2: "", typeKind2: "dagopvang" },
        bv: { verwachteWinstPerJaar: "", dividendplan: "" },
        vangnet: { heeftAov: null, zzpRegeltZelfPensioen: null, pensioenEigenInlegPerJaar: "", maandelijkseVasteLasten: "", heeftSamenlevingscontract: null, heeftTestament: null, heeftOrvGekoppeldAanHypotheek: null },
      });
    }
    return res.status(200).json(typeof data === "string" ? JSON.parse(data) : data);
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
