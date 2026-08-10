import { isValidSession, getSessionTokenFromReq, getSessionUser } from "../../lib/auth";
import { logAiGebruik } from "../../lib/ai-usage";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Methode niet toegestaan" });

  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY niet ingesteld" });

  const { persoon, klachten, medicatie } = req.body || {};
  if (!Array.isArray(klachten) || klachten.length === 0) {
    return res.status(400).json({ error: "Nog geen klachten geregistreerd om een vragenlijst op te baseren" });
  }

  try {
    const klachtenOverzicht = klachten
      .map(k => `${k.datum} · ${k.categorie}${k.ernst ? ` (ernst ${k.ernst}/5)` : ""}${k.notitie ? ` — ${k.notitie}` : ""}`)
      .join("\n");
    const medicatieOverzicht = (medicatie || []).map(m => `${m.naam}${m.dosering ? ` (${m.dosering})` : ""}, sinds ${m.sinds}`).join("\n") || "(geen)";

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
          content: `Dit zijn de recente klachten en medicatie van ${persoon || "iemand"}. Stel een lijst voorbereidende vragen op die deze persoon aan de (huis)arts zou kunnen stellen tijdens een afspraak — dus vragen ÁÁN de arts, niet antwoorden of eigen conclusies.

Klachten:
${klachtenOverzicht}

Huidige medicatie:
${medicatieOverzicht}

Geef ALLEEN geldige JSON terug, geen uitleg of markdown, in dit exacte formaat:
{"vragen": ["korte, concrete vraag 1", "vraag 2", ...]}

BELANGRIJK: dit zijn ALTIJD vragen om aan de arts te stellen (bv. "Kan de vermoeidheid gerelateerd zijn aan de nieuwe medicatie?", "Is het normaal dat dit al 3 maanden terugkomt?") — nooit een eigen diagnose, oorzaak of advies. Maximaal 8 vragen, gebaseerd op wat er daadwerkelijk in de data opvalt (frequentie, timing, combinatie met medicatie, etc.).`
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
        bron: "gezondheid-vragenlijst",
        inputTokens: aiData.usage.input_tokens || 0,
        outputTokens: aiData.usage.output_tokens || 0,
        gebruiker,
      });
    }

    return res.status(200).json({ vragen: Array.isArray(parsed.vragen) ? parsed.vragen : [] });
  } catch (e) {
    return res.status(500).json({ error: "Kon geen vragenlijst opstellen: " + e.message });
  }
}
