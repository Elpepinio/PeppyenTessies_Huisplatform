import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

// Zoekt podcasts via de gratis, publieke iTunes Search API van Apple
// (dezelfde catalogus als de Apple Podcasts-app). Geen API-key nodig.
//   GET ?q=zoekterm     -> lijst met resultaten
//   GET ?link=<url>     -> één podcast uit een gedeelde Apple Podcasts-link

// Haalt het podcast-id uit een Apple Podcasts-link, bv.
// https://podcasts.apple.com/nl/podcast/de-podcast/id1234567890?i=1000
function podcastIdUitLink(link) {
  if (typeof link !== "string") return null;
  if (!/^https?:\/\/(podcasts|itunes)\.apple\.com\//i.test(link.trim())) return null;
  const m = link.match(/\/id(\d{3,})/);
  return m ? m[1] : null;
}

function mapPodcast(r) {
  if (!r || !r.collectionName) return null;
  const url = r.collectionViewUrl ? String(r.collectionViewUrl).split("?")[0] : null;
  return {
    id: r.collectionId ? String(r.collectionId) : null,
    titel: r.collectionName,
    maker: r.artistName || "",
    genre: r.primaryGenreName || "",
    poster: r.artworkUrl600 || r.artworkUrl100 || "",
    podcastUrl: url,
    aantalAfleveringen: r.trackCount || null,
  };
}

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }

  const { q, link } = req.query;
  let url;
  if (link) {
    const id = podcastIdUitLink(link);
    if (!id) return res.status(400).json({ error: "Dit is geen Apple Podcasts-link" });
    url = `https://itunes.apple.com/lookup?id=${id}&country=NL`;
  } else if (typeof q === "string" && q.trim()) {
    url = `https://itunes.apple.com/search?media=podcast&entity=podcast&country=NL&limit=8&term=${encodeURIComponent(q.trim())}`;
  } else {
    return res.status(400).json({ error: "Geen zoekterm opgegeven" });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(502).json({ error: "Apple Podcasts reageert niet" });
    const data = await response.json();
    const resultaten = (data.results || []).map(mapPodcast).filter(Boolean);
    return res.status(200).json({ resultaten });
  } catch (e) {
    return res.status(500).json({ error: "Podcast zoeken mislukt" });
  }
}
