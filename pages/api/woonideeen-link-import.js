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

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Ongeldig protocol");
  } catch {
    return res.status(400).json({ error: "Ongeldige URL" });
  }

  try {
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

    // Voorbeeldfoto uit de og:image meta-tag, zoals bij receptimport — de
    // gebruiker kan 'm in de app altijd nog vervangen door een eigen foto.
    let afbeelding = null;
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogImageMatch) {
      try { afbeelding = new URL(ogImageMatch[1], url).toString(); } catch { /* ongeldige URL, negeren */ }
    }

    const tekst = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 10000);

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Bekijk deze webpagina-tekst van een woonproduct (meubel, verlichting, vloerkleed, decoratie, etc.).

Geef ALLEEN geldige JSON terug, geen uitleg of markdown, in dit exacte formaat:
{
  "titel": "naam van het product, kort en duidelijk",
  "omschrijving": "korte omschrijving van 1-2 zinnen — materiaal, afmetingen, stijl als vermeld",
  "prijs": prijs als getal zonder €-teken, null als onduidelijk,
  "categorie": "verlichting|tafels|zitmeubels|vloerkleden|kasten|wanddecoratie|planten_vazen|textiel|keuken_tafelen|buiten_tuin|overig"
}

Paginatekst:
${tekst}

Als dit duidelijk geen productpagina is: {"fout": "Geen product gevonden op deze pagina"}`
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
        bron: "woonideeen-link-import",
        inputTokens: aiData.usage.input_tokens || 0,
        outputTokens: aiData.usage.output_tokens || 0,
        gebruiker,
      });
    }

    if (parsed.fout) {
      return res.status(400).json({ error: parsed.fout });
    }

    return res.status(200).json({ ...parsed, foto: afbeelding });
  } catch (e) {
    if (e.name === "TimeoutError") {
      return res.status(400).json({ error: "Pagina duurde te lang — probeer een andere URL" });
    }
    return res.status(500).json({ error: "Kon info niet ophalen: " + e.message });
  }
}
