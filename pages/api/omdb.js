import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

// Haalt filmdata (incl. officiële IMDb-rating) op via de gratis OMDb-API
// (omdbapi.com, spiegelt IMDb-data legitiem voor API-gebruik).
// Vereist een gratis API-key: http://www.omdbapi.com/apikey.aspx
// Zet deze in Vercel als environment variable: OMDB_API_KEY

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }

  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ gevonden: false, reden: "geen_api_key" });
  }

  const { titel } = req.query;
  if (!titel || typeof titel !== "string") return res.status(400).json({ error: "Geen titel opgegeven" });

  try {
    const url = `https://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(titel)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.Response === "False") {
      return res.status(200).json({ gevonden: false, reden: "niet_gevonden" });
    }

    return res.status(200).json({
      gevonden: true,
      titel: data.Title,
      jaar: data.Year,
      type: data.Type === "series" ? "serie" : "film",
      imdbRating: data.imdbRating !== "N/A" ? parseFloat(data.imdbRating) : null,
      genre: data.Genre !== "N/A" ? data.Genre : null,
      regisseur: data.Director !== "N/A" ? data.Director : null,
      acteurs: data.Actors !== "N/A" ? data.Actors : null,
      poster: data.Poster !== "N/A" ? data.Poster : null,
      plot: data.Plot !== "N/A" ? data.Plot : null,
    });
  } catch (e) {
    return res.status(500).json({ error: "OMDb-opzoeken mislukt" });
  }
}
