import { isValidSession, getSessionTokenFromReq, getSessionUser } from "../../lib/auth";
import { logAiGebruik } from "../../lib/ai-usage";

export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Methode niet toegestaan" });

  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY niet ingesteld" });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "Geen URL opgegeven" });

  // Valideer URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Ongeldig protocol");
  } catch {
    return res.status(400).json({ error: "Ongeldige URL" });
  }

  try {
    // Haal de webpagina op
    const pageRes = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HuishoudenBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "nl,en;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!pageRes.ok) {
      return res.status(400).json({ error: `Kon pagina niet ophalen (${pageRes.status})` });
    }

    const html = await pageRes.text();

    // Probeer een goede voorbeeldfoto van de pagina te vinden — meestal staat
    // die netjes klaar in de og:image meta-tag (gebruikt door de meeste
    // receptensites voor social-media-previews).
    let afbeelding = null;
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogImageMatch) {
      try { afbeelding = new URL(ogImageMatch[1], url).toString(); } catch { /* ongeldige URL, negeren */ }
    }

    // Strip HTML tags voor de AI — houd structuur maar verwijder scripts/styles.
    // Ruimer dan bij een los recept: sommige pagina's ("10x beste pastarecepten")
    // bevatten meerdere recepten, dus er is meer tekst nodig om ze allemaal te vinden.
    const tekst = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 14000);

    // AI extractie — vraagt expliciet of er één of meerdere recepten op de
    // pagina staan (bv. een "10 beste pastagerechten"-overzichtspagina) en
    // geeft in beide gevallen een array terug, zodat de client hetzelfde
    // afhandelt ongeacht of het er één of meerdere zijn.
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `Bekijk deze webpagina-tekst. Er kan één recept op staan, of de pagina kan een overzicht/lijstje zijn met MEERDERE losse recepten (bv. "10 beste pastarecepten" of een blogpost met 3 varianten).

Geef ALLEEN geldige JSON terug, geen uitleg of markdown, in dit exacte formaat — altijd een array, ook als het er maar één is:
{
  "recepten": [
    {
      "naam": "naam van het recept",
      "keuken": "type keuken (Nederlands/Italiaans/etc)",
      "gangtype": "Voorgerecht, Hoofdgerecht, Nagerecht, Soep, Stoofpotje of Salade",
      "bereidingstijd": 30,
      "porties": 4,
      "kcal": 0,
      "beschrijving": "korte beschrijving",
      "ingredienten": [{"naam": "ingrediënt", "hoeveelheid": "100", "eenheid": "g"}],
      "stappen": [{"tekst": "stap zonder wachttijd"}, {"tekst": "stap met wachttijd, bv. koken/bakken/rusten", "timerStart": "het fysieke/visuele moment waarop je pas moet beginnen te timen, bv. 'zodra het water kookt' of 'als de boter bruint en begint te schuimen' — WEGLATEN als de stap geen timer nodig heeft of het startmoment vanzelfsprekend is (gewoon meteen beginnen)"}]
    }
  ]
}

Paginatekst:
${tekst}

Als er helemaal geen recept op de pagina staat: {"fout": "Geen recept gevonden op deze pagina"}`
        }],
      }),
    });

    const aiData = await aiRes.json();
    const aiTekst = aiData.content?.find(b => b.type === "text")?.text || "";
    const clean = aiTekst.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    if (aiData.usage) {
      const gebruiker = await getSessionUser(token);
      logAiGebruik({
        bron: "maaltijden-link-import",
        inputTokens: aiData.usage.input_tokens || 0,
        outputTokens: aiData.usage.output_tokens || 0,
        gebruiker,
      });
    }

    if (parsed.fout || !Array.isArray(parsed.recepten) || parsed.recepten.length === 0) {
      return res.status(400).json({ error: parsed.fout || "Geen recept gevonden op deze pagina" });
    }

    // De og:image alleen meegeven als er precies één recept is gevonden —
    // bij meerdere recepten op één pagina zou diezelfde ene afbeelding
    // misleidend zijn voor alle recepten tegelijk.
    const recepten = parsed.recepten.map((r, i) => ({ ...r, foto: parsed.recepten.length === 1 ? afbeelding : null }));

    return res.status(200).json({ recepten });
  } catch (e) {
    if (e.name === "TimeoutError") {
      return res.status(400).json({ error: "Pagina duurde te lang — probeer een andere URL" });
    }
    return res.status(500).json({ error: "Kon recept niet extraheren: " + e.message });
  }
}
