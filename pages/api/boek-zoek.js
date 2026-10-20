import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

// Zoekt boeken (ook voor luisterboeken: dezelfde titels) via de gratis Google
// Books-API, zonder API-key. Valt terug op Open Library als Google niet
// antwoordt (bv. bij een tijdelijke limiet).
//   GET ?q=titel of auteur

function veiligeUrl(u) {
  return typeof u === "string" ? u.replace(/^http:\/\//i, "https://") : "";
}

function mapBoek(item) {
  const v = item?.volumeInfo;
  if (!v || !v.title) return null;
  const jaar = typeof v.publishedDate === "string" ? v.publishedDate.slice(0, 4) : "";
  return {
    id: item.id || null,
    titel: v.subtitle ? `${v.title}: ${v.subtitle}` : v.title,
    maker: Array.isArray(v.authors) ? v.authors.join(", ") : "",
    genre: Array.isArray(v.categories) && v.categories.length ? String(v.categories[0]).split("/")[0].trim() : "",
    poster: veiligeUrl(v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail),
    link: veiligeUrl(v.infoLink),
    jaar: /^\d{4}$/.test(jaar) ? jaar : "",
  };
}

function mapOpenLibrary(d) {
  if (!d || !d.title) return null;
  return {
    id: d.key || null,
    titel: d.title,
    maker: Array.isArray(d.author_name) ? d.author_name.slice(0, 3).join(", ") : "",
    genre: Array.isArray(d.subject) && d.subject.length ? String(d.subject[0]) : "",
    poster: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : "",
    link: d.key ? `https://openlibrary.org${d.key}` : "",
    jaar: d.first_publish_year ? String(d.first_publish_year) : "",
  };
}

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }
  const { q } = req.query;
  if (typeof q !== "string" || !q.trim()) return res.status(400).json({ error: "Geen zoekterm opgegeven" });
  const term = encodeURIComponent(q.trim());

  try {
    const g = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${term}&maxResults=8&printType=books`);
    if (g.ok) {
      const data = await g.json();
      const resultaten = (data.items || []).map(mapBoek).filter(Boolean);
      if (resultaten.length) return res.status(200).json({ resultaten });
    }
  } catch { /* val terug op Open Library */ }

  try {
    const o = await fetch(`https://openlibrary.org/search.json?q=${term}&limit=8&fields=key,title,author_name,first_publish_year,cover_i,subject`);
    if (!o.ok) return res.status(502).json({ error: "Boeken zoeken lukt nu niet" });
    const data = await o.json();
    return res.status(200).json({ resultaten: (data.docs || []).map(mapOpenLibrary).filter(Boolean) });
  } catch (e) {
    return res.status(500).json({ error: "Boeken zoeken mislukt" });
  }
}
