import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:afvalkalender";
const EMPTY = { locatie: "", postcode: "", huisnummer: "", huisnummerToevoeging: "" };

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "GET") {
    // Live ophalen bij de externe bron (trashapi.azurewebsites.net — de
    // gedeelde databron achter o.a. het 21burgerportaal/AfvalThuis dat veel
    // Nederlandse afvaldiensten gebruiken). Deze bron heeft in het verleden
    // wel eens tijdelijk gehaperd voor specifieke gemeenten — dat is dan een
    // probleem bij de bron zelf, niet in deze tool, dus geven we dat ook
    // duidelijk als zodanig terug i.p.v. een onbegrijpelijke crash.
    if (req.query.actie === "ophalen") {
      const config = await redis.get(DATA_KEY);
      const parsed = config ? (typeof config === "string" ? JSON.parse(config) : config) : EMPTY;
      const { locatie, postcode, huisnummer, huisnummerToevoeging } = parsed;
      if (!locatie || !postcode || !huisnummer) {
        return res.status(400).json({ error: "Nog geen adres ingesteld — vul eerst je locatie, postcode en huisnummer in." });
      }
      try {
        const url = `https://trashapi.azurewebsites.net/trash?Location=${encodeURIComponent(locatie)}&ZipCode=${encodeURIComponent(postcode)}&HouseNumber=${encodeURIComponent(huisnummer)}&HouseNumberSuffix=${encodeURIComponent(huisnummerToevoeging || "")}`;
        const extRes = await fetch(url);
        if (!extRes.ok) {
          return res.status(502).json({ error: `De afvaldienst zelf gaf een foutmelding (status ${extRes.status}). Dit ligt aan de bron, niet aan deze tool — probeer het later nog eens.` });
        }
        const data = await extRes.json();
        if (!Array.isArray(data)) {
          return res.status(502).json({ error: "Onverwacht antwoord van de afvaldienst — mogelijk klopt de locatienaam niet voor jouw gemeente." });
        }
        return res.status(200).json({ ophalingen: data });
      } catch (e) {
        return res.status(500).json({ error: "Kon de afvalkalender niet ophalen: " + e.message });
      }
    }

    // Gewone GET: opgeslagen adresinstellingen teruggeven.
    const data = await redis.get(DATA_KEY);
    if (!data) return res.status(200).json(EMPTY);
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
