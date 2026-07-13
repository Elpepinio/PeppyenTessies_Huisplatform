import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

// Haalt filmgegevens op door een gedeelde IMDb-link server-side te bezoeken en
// de ingebouwde structured data (JSON-LD) van de pagina uit te lezen.
// Vereist GEEN API-key — werkt met elke gewone imdb.com/title/... link,
// bijvoorbeeld gedeeld vanuit de IMDb-app.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }

  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  const { url } = req.body || {};
  if (!url || typeof url !== "string") return res.status(400).json({ error: "Geen link opgegeven" });

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes("imdb.com")) {
      return res.status(400).json({ error: "Dit lijkt geen IMDb-link te zijn" });
    }
  } catch {
    return res.status(400).json({ error: "Ongeldige link" });
  }

  // IMDb-links delen via de app zijn vaak verkort (bv. imdb.com/r/...) — de
  // fetch hieronder volgt automatisch redirects naar de echte titelpagina.
  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HuishoudenBot/1.0)",
        "Accept-Language": "nl,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return res.status(400).json({ error: `Kon IMDb-pagina niet ophalen (${response.status})` });
    }

    const html = await response.text();

    // IMDb-titelpagina's bevatten een <script type="application/ld+json">-blok
    // met gestructureerde filmdata — dat lezen we uit, zonder verdere API.
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!match) {
      return res.status(400).json({ error: "Kon geen filmgegevens vinden op deze pagina" });
    }

    let jsonLd;
    try {
      jsonLd = JSON.parse(match[1]);
    } catch {
      return res.status(400).json({ error: "Kon filmgegevens niet lezen" });
    }

    const jaarMatch = (jsonLd.datePublished || "").match(/^\d{4}/);
    const genres = Array.isArray(jsonLd.genre) ? jsonLd.genre.join(", ") : jsonLd.genre || null;
    const regisseurs = Array.isArray(jsonLd.director) ? jsonLd.director.map(d => d.name).filter(Boolean).join(", ") : jsonLd.director?.name || null;
    const acteurs = Array.isArray(jsonLd.actor) ? jsonLd.actor.slice(0, 4).map(a => a.name).filter(Boolean).join(", ") : jsonLd.actor?.name || null;

    return res.status(200).json({
      gevonden: true,
      titel: jsonLd.name || null,
      jaar: jaarMatch ? jaarMatch[0] : null,
      type: jsonLd["@type"] === "TVSeries" ? "serie" : "film",
      imdbRating: jsonLd.aggregateRating?.ratingValue ? parseFloat(jsonLd.aggregateRating.ratingValue) : null,
      genre: genres,
      regisseur: regisseurs,
      acteurs: acteurs,
      poster: jsonLd.image || null,
    });
  } catch (e) {
    if (e.name === "TimeoutError") {
      return res.status(400).json({ error: "IMDb-pagina duurde te lang om te laden" });
    }
    return res.status(500).json({ error: "Kon link niet verwerken: " + e.message });
  }
}
