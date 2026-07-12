import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }

  const { url } = req.body || {};
  if (!url || typeof url !== "string") return res.status(400).json({ error: "Geen URL opgegeven" });

  try {
    // Verkorte Maps-links (maps.app.goo.gl, goo.gl/maps) geven pas bij het
    // volgen van de redirect de echte URL met coördinaten prijs. We volgen
    // die hier server-side (voorkomt CORS-problemen in de browser).
    const response = await fetch(url, { method: "GET", redirect: "follow" });
    return res.status(200).json({ resolvedUrl: response.url });
  } catch (e) {
    return res.status(500).json({ error: "Kon link niet herleiden" });
  }
}
