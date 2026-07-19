import { isValidSession, getSessionTokenFromReq, getSessionUser } from "../../lib/auth";
import { logAiGebruik } from "../../lib/ai-usage";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

// Begrenst hoeveel losse zoekopdrachten Claude per prijsvergelijking mag
// doen — elke zoekopdracht kost apart geld ($0,01), los van de tokenkosten.
// 3 zoekopdrachten is genoeg om een paar bekende NL-webshops te proberen
// zonder dat één klik op "ververs" onnodig duur wordt.
const MAX_ZOEKOPDRACHTEN = 3;

// Checkt de HUIDIGE prijs op de eigen, al opgeslagen link — dit is geen
// websearch (geen extra $0,01-kosten per stuk), gewoon de pagina zelf
// direct ophalen en de prijs eruit laten lezen, zoals bij de link-import.
// Faalt een site (bv. blokkeert bots), dan geven we gewoon null terug en
// gaat de rest van de vergelijking door.
async function checkEigenPrijs(url, apiKey) {
  try {
    const pageRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HuishoudenBot/1.0)", "Accept": "text/html" },
      signal: AbortSignal.timeout(8000),
    });
    if (!pageRes.ok) return { prijs: null, tokens: { input: 0, output: 0 } };
    const html = await pageRes.text();
    const tekst = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 6000);

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 200,
        messages: [{ role: "user", content: `Wat is de huidige prijs van het hoofdproduct op deze pagina? Geef ALLEEN JSON: {"prijs": getal zonder €-teken, of null als onduidelijk}\n\n${tekst}` }],
      }),
    });
    const aiData = await aiRes.json();
    const aiTekst = (aiData.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    const parsed = JSON.parse(aiTekst.replace(/```json|```/g, "").trim());
    return { prijs: parsed.prijs ?? null, tokens: { input: aiData.usage?.input_tokens || 0, output: aiData.usage?.output_tokens || 0 } };
  } catch {
    return { prijs: null, tokens: { input: 0, output: 0 } };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Methode niet toegestaan" });

  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY niet ingesteld" });

  const { titel, categorie, huidigePrijs, huidigeWinkel, link } = req.body || {};
  if (!titel || !titel.trim()) return res.status(400).json({ error: "Geen producttitel opgegeven" });

  try {
    // Stap 1: eigen link opnieuw checken op prijswijziging (geen websearch-kosten).
    let eigenPrijs = null;
    let eigenTokens = { input: 0, output: 0 };
    if (link) {
      const r = await checkEigenPrijs(link, apiKey);
      eigenPrijs = r.prijs;
      eigenTokens = r.tokens;
    }

    // Stap 2: vergelijken met andere aanbieders via web-search.
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_ZOEKOPDRACHTEN }],
        messages: [{
          role: "user",
          content: `Zoek op het web naar de beste actuele prijs voor dit woonproduct bij Nederlandse webshops: "${titel}"${categorie ? ` (categorie: ${categorie})` : ""}.` +
            (huidigeWinkel ? ` Het staat momenteel bij "${huidigeWinkel}" voor ${huidigePrijs ? `€${huidigePrijs}` : "een onbekende prijs"} — zoek naar hetzelfde of een zeer vergelijkbaar product bij ANDERE aanbieders.` : "") +
            ` Kijk bijvoorbeeld bij bekende Nederlandse woonwinkels (Fonq, Wehkamp, Bol.com, IKEA, Kwantum, Leen Bakker, Karwei, Praxis, HEMA, JYSK — wat relevant is voor dit type product).

Geef ALLEEN geldige JSON terug na je zoekopdrachten, geen uitleg of markdown, in dit exacte formaat:
{"resultaten": [{"winkel": "naam van de winkel", "prijs": prijs als getal zonder €-teken (null als onduidelijk), "link": "directe URL naar het product of de zoekresultaten"}]}

Geef maximaal 4 resultaten, gesorteerd van goedkoop naar duur. Als je niets vergelijkbaars kunt vinden: {"resultaten": [], "opmerking": "korte uitleg waarom niet"}`
        }],
      }),
    });

    const aiData = await aiRes.json();
    if (aiData.error) return res.status(500).json({ error: aiData.error.message || "AI-fout" });

    // Alleen de tekst-blokken bevatten het uiteindelijke antwoord — tool-
    // gebruik/tool-resultaat-blokken (de losse zoekopdrachten) worden
    // genegeerd, we willen alleen de samenvattende JSON die Claude er zelf
    // van maakt.
    const aiTekst = (aiData.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");
    const clean = aiTekst.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    const aantalZoekopdrachten = (aiData.content || []).filter(b => b.type === "server_tool_use" && b.name === "web_search").length;

    if (aiData.usage) {
      const gebruiker = await getSessionUser(token);
      logAiGebruik({
        bron: "woonideeen-prijsvergelijk",
        inputTokens: (aiData.usage.input_tokens || 0) + eigenTokens.input,
        outputTokens: (aiData.usage.output_tokens || 0) + eigenTokens.output,
        webSearches: aantalZoekopdrachten,
        gebruiker,
      });
    }

    return res.status(200).json({
      resultaten: Array.isArray(parsed.resultaten) ? parsed.resultaten : [],
      opmerking: parsed.opmerking || null,
      eigenPrijs,
    });
  } catch (e) {
    return res.status(500).json({ error: "Kon niet naar de beste prijs zoeken: " + e.message });
  }
}
