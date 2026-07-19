import { isValidSession, getSessionTokenFromReq, getSessionUser } from "../../lib/auth";
import { logAiGebruik } from "../../lib/ai-usage";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Methode niet toegestaan" });

  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY niet ingesteld" });

  const { kleurNaam, fabrikant, kleurcode, hex } = req.body || {};
  if (!kleurNaam || !kleurNaam.trim()) return res.status(400).json({ error: "Geen kleurnaam opgegeven" });

  try {
    const kleurBeschrijving = [kleurNaam, fabrikant, kleurcode, hex].filter(Boolean).join(" · ");

    // Pure kleurtheorie-vraag, geen actuele webdata nodig — dus zonder
    // web-search-tool, dat scheelt kosten en is sneller.
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 900,
        messages: [{
          role: "user",
          content: `Je bent een interieurstylist. Deze basiskleur wordt gebruikt in een verbouwing: "${kleurBeschrijving}".

Geef tegenkleuren die hier goed bij passen, verdeeld in twee categorieën:
- 2 "gedrukte" opties: verzadigde, opvallende kleuren die een sterk contrast/accent geven
- 2 "rustige" opties: gedempte, ingetogen tinten die harmonieus aansluiten zonder te schreeuwen

Geef ALLEEN geldige JSON terug, geen uitleg of markdown, in dit exacte formaat:
{
  "gedrukt": [{"kleurnaam": "naam", "hex": "#rrggbb (indicatief)", "toelichting": "1 korte zin waarom dit werkt"}],
  "rustig": [{"kleurnaam": "naam", "hex": "#rrggbb (indicatief)", "toelichting": "1 korte zin waarom dit werkt"}]
}`
        }],
      }),
    });

    const aiData = await aiRes.json();
    if (aiData.error) return res.status(500).json({ error: aiData.error.message || "AI-fout" });

    const aiTekst = (aiData.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    const clean = aiTekst.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    if (aiData.usage) {
      const gebruiker = await getSessionUser(token);
      logAiGebruik({
        bron: "moodboard-tegenkleuren",
        inputTokens: aiData.usage.input_tokens || 0,
        outputTokens: aiData.usage.output_tokens || 0,
        gebruiker,
      });
    }

    return res.status(200).json({
      gedrukt: Array.isArray(parsed.gedrukt) ? parsed.gedrukt : [],
      rustig: Array.isArray(parsed.rustig) ? parsed.rustig : [],
    });
  } catch (e) {
    return res.status(500).json({ error: "Kon geen tegenkleuren bepalen: " + e.message });
  }
}
