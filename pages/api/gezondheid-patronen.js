import { isValidSession, getSessionTokenFromReq, getSessionUser } from "../../lib/auth";
import { logAiGebruik } from "../../lib/ai-usage";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Methode niet toegestaan" });

  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY niet ingesteld" });

  const { persoon, klachten } = req.body || {};
  if (!Array.isArray(klachten) || klachten.length < 3) {
    return res.status(400).json({ error: "Nog te weinig geregistreerde klachten voor een zinvolle patroonanalyse" });
  }

  try {
    const overzicht = klachten
      .map(k => `${k.datum} · ${k.categorie}${k.ernst ? ` (ernst ${k.ernst}/5)` : ""}${k.notitie ? ` — ${k.notitie}` : ""}`)
      .join("\n");

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
          content: `Dit is het klachtenlogboek van ${persoon || "iemand"}. Beschrijf ALLEEN patronen die je in de data zelf ziet (tijd van het jaar, frequentie, terugkerende woorden in de notities, mogelijke triggers die de persoon zelf noemt) — puur beschrijvend, gebaseerd op wat er letterlijk staat.

Log:
${overzicht}

Geef ALLEEN geldige JSON terug, geen uitleg of markdown, in dit exacte formaat:
{"patronen": [{"observatie": "korte, feitelijke beschrijving van het patroon, bv. 'Hoofdpijn kwam de afgelopen 2 jaar steeds in augustus voor (3x)'"}]}

BELANGRIJK: nooit een diagnose stellen, nooit een medische oorzaak suggereren, nooit behandeladvies geven — alleen benoemen WAT er patroonmatig in de data staat. Maximaal 5 observaties. Niets gevonden: {"patronen": [], "opmerking": "korte uitleg"}`
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
        bron: "gezondheid-patronen",
        inputTokens: aiData.usage.input_tokens || 0,
        outputTokens: aiData.usage.output_tokens || 0,
        gebruiker,
      });
    }

    return res.status(200).json({
      patronen: Array.isArray(parsed.patronen) ? parsed.patronen : [],
      opmerking: parsed.opmerking || null,
    });
  } catch (e) {
    return res.status(500).json({ error: "Kon geen patronen bepalen: " + e.message });
  }
}
