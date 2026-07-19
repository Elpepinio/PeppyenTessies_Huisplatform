import { isValidSession, getSessionTokenFromReq, getSessionUser } from "../../lib/auth";
import { logAiGebruik } from "../../lib/ai-usage";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

// Zelfde grens als bij de andere web-search-functies — elke zoekopdracht
// kost apart geld ($0,01), dus begrensd op een paar pogingen per keer.
const MAX_ZOEKOPDRACHTEN = 3;
// Hoeveel van de gevonden links we daarna nog proberen te voorzien van een
// voorbeeldfoto (og:image) — begrensd om de aanvraag niet te traag te maken.
const MAX_FOTO_POGINGEN = 4;

async function haalOgImage(url) {
  try {
    const pageRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HuishoudenBot/1.0)", "Accept": "text/html" },
      signal: AbortSignal.timeout(6000),
    });
    if (!pageRes.ok) return null;
    const html = await pageRes.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (!match) return null;
    return new URL(match[1], url).toString();
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Methode niet toegestaan" });

  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY niet ingesteld" });

  const { kleurNaam, fabrikant, kleurcode, toepassing } = req.body || {};
  if (!kleurNaam || !kleurNaam.trim()) return res.status(400).json({ error: "Geen kleurnaam opgegeven" });

  try {
    const zoekterm = [kleurNaam, fabrikant, kleurcode].filter(Boolean).join(" ");
    const toepassingTekst = toepassing?.trim() || "keuken, wand of gevel";

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_ZOEKOPDRACHTEN }],
        messages: [{
          role: "user",
          content: `Zoek op het web naar echte, gefotografeerde voorbeelden waarbij de kleur "${zoekterm}" is toegepast op een GROOT oppervlak — denk aan ${toepassingTekst} — dus NIET een klein staaltje of verfblikje, maar een compleet gerealiseerd resultaat. ` +
            `Dit is om in te kunnen schatten hoe de kleur oogt op grote schaal, wat vaak anders overkomt dan op een klein staaltje.

Geef ALLEEN geldige JSON terug na je zoekopdrachten, geen uitleg of markdown, in dit exacte formaat:
{"resultaten": [{"omschrijving": "korte omschrijving van wat er te zien is, 1 zin", "link": "directe URL naar de pagina/afbeelding"}]}

Geef maximaal 4 resultaten. Vind je niets bruikbaars: {"resultaten": [], "opmerking": "korte uitleg waarom niet"}`
        }],
      }),
    });

    const aiData = await aiRes.json();
    if (aiData.error) return res.status(500).json({ error: aiData.error.message || "AI-fout" });

    const aiTekst = (aiData.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    const clean = aiTekst.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    const resultaten = Array.isArray(parsed.resultaten) ? parsed.resultaten.slice(0, 4) : [];

    // Voor elk resultaat een voorbeeldfoto proberen te vinden (og:image) —
    // mislukt dat voor een link, dan blijft die gewoon zonder foto staan.
    const metFotos = await Promise.all(
      resultaten.slice(0, MAX_FOTO_POGINGEN).map(async r => ({ ...r, foto: await haalOgImage(r.link) }))
    );

    const aantalZoekopdrachten = (aiData.content || []).filter(b => b.type === "server_tool_use" && b.name === "web_search").length;

    if (aiData.usage) {
      const gebruiker = await getSessionUser(token);
      logAiGebruik({
        bron: "moodboard-voorbeelden",
        inputTokens: aiData.usage.input_tokens || 0,
        outputTokens: aiData.usage.output_tokens || 0,
        webSearches: aantalZoekopdrachten,
        gebruiker,
      });
    }

    return res.status(200).json({ resultaten: metFotos, opmerking: parsed.opmerking || null });
  } catch (e) {
    return res.status(500).json({ error: "Kon geen voorbeelden vinden: " + e.message });
  }
}
