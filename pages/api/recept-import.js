import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

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

    // Strip HTML tags voor de AI — keep structuur maar verwijder scripts/styles
    const tekst = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000); // Max 8000 tekens voor de AI

    // AI extractie
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `Extraheer het recept uit deze webpagina-tekst en geef het terug als JSON.
Geef ALLEEN geldige JSON terug, geen uitleg of markdown.

Paginatekst:
${tekst}

Gewenst JSON-formaat:
{
  "naam": "naam van het recept",
  "keuken": "type keuken (Nederlands/Italiaans/etc)",
  "bereidingstijd": 30,
  "porties": 4,
  "kcal": 0,
  "beschrijving": "korte beschrijving",
  "ingredienten": [{"naam": "ingrediënt", "hoeveelheid": "100", "eenheid": "g"}],
  "stappen": ["stap 1", "stap 2"],
  "bron": "${url}"
}

Als er geen recept op de pagina staat, geef dan: {"fout": "Geen recept gevonden op deze pagina"}`
        }],
      }),
    });

    const aiData = await aiRes.json();
    const aiTekst = aiData.content?.find(b => b.type === "text")?.text || "";
    const clean = aiTekst.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    if (parsed.fout) {
      return res.status(400).json({ error: parsed.fout });
    }

    return res.status(200).json({ recept: parsed });
  } catch (e) {
    if (e.name === "TimeoutError") {
      return res.status(400).json({ error: "Pagina duurde te lang — probeer een andere URL" });
    }
    return res.status(500).json({ error: "Kon recept niet extraheren: " + e.message });
  }
}
