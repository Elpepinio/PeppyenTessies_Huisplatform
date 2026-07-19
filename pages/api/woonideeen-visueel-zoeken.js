import { isValidSession, getSessionTokenFromReq, getSessionUser } from "../../lib/auth";
import { logAiGebruik } from "../../lib/ai-usage";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

// Zelfde grens als bij de tekst-gebaseerde prijsvergelijking — elke
// zoekopdracht kost apart geld ($0,01), dus begrensd op een paar pogingen.
const MAX_ZOEKOPDRACHTEN = 3;

const CATEGORIEEN_IDS = ["verlichting","tafels","zitmeubels","vloerkleden","kasten","wanddecoratie","planten_vazen","textiel","keuken_tafelen","buiten_tuin","overig"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Methode niet toegestaan" });

  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY niet ingesteld" });

  const { imageBase64, imageType = "image/jpeg" } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: "Geen foto ontvangen" });

  try {
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
          content: [
            { type: "image", source: { type: "base64", media_type: imageType, data: imageBase64 } },
            { type: "text", text:
              `Bekijk deze foto/screenshot van een woonproduct (meubel, verlichting, vloerkleed, decoratie, etc.) — werk zoals Google Lens: ` +
              `herken eerst wat dit precies is (merk/type/model als zichtbaar of herkenbaar aan stijl/vorm), en zoek dan op het web naar waar dit product ` +
              `(of het dichtstbijzijnde vergelijkbare alternatief als het exacte merk onbekend is) te koop is, en voor welke prijs. ` +
              `Kijk bijvoorbeeld bij bekende Nederlandse woonwinkels (Fonq, Wehkamp, Bol.com, IKEA, Kwantum, Leen Bakker, Karwei, HEMA, JYSK — wat relevant is) maar ook daarbuiten als het een merkproduct is.

Geef ALLEEN geldige JSON terug na je zoekopdrachten, geen uitleg of markdown, in dit exacte formaat:
{
  "titel": "naam van het product, kort en duidelijk",
  "omschrijving": "korte omschrijving van 1-2 zinnen — materiaal, stijl, herkomst als bekend",
  "categorie": "${CATEGORIEEN_IDS.join("|")}",
  "resultaten": [{"winkel": "naam van de winkel", "prijs": prijs als getal zonder €-teken of null, "link": "directe URL"}]
}
Geef maximaal 4 resultaten in "resultaten", gesorteerd van goedkoop naar duur. Kun je het product totaal niet identificeren: {"titel": null, "opmerking": "korte uitleg waarom niet"}`
            },
          ],
        }],
      }),
    });

    const aiData = await aiRes.json();
    if (aiData.error) return res.status(500).json({ error: aiData.error.message || "AI-fout" });

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
        bron: "woonideeen-visueel-zoeken",
        inputTokens: aiData.usage.input_tokens || 0,
        outputTokens: aiData.usage.output_tokens || 0,
        webSearches: aantalZoekopdrachten,
        gebruiker,
      });
    }

    if (!parsed.titel) {
      return res.status(400).json({ error: parsed.opmerking || "Kon het product niet herkennen op deze foto" });
    }

    const resultaten = Array.isArray(parsed.resultaten) ? parsed.resultaten : [];
    return res.status(200).json({
      titel: parsed.titel,
      omschrijving: parsed.omschrijving || "",
      categorie: CATEGORIEEN_IDS.includes(parsed.categorie) ? parsed.categorie : "overig",
      resultaten,
      // Beste (laagste) gevonden prijs alvast als hoofdprijs, mag altijd nog aangepast worden.
      beslissingsPrijs: resultaten.filter(r => r.prijs != null).sort((a,b) => a.prijs - b.prijs)[0]?.prijs ?? null,
    });
  } catch (e) {
    return res.status(500).json({ error: "Kon de foto niet herkennen: " + e.message });
  }
}
