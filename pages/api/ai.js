import { isValidSession, getSessionTokenFromReq, getSessionUser } from "../../lib/auth";
import { logAiGebruik } from "../../lib/ai-usage";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Methode niet toegestaan" });

  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY niet ingesteld in Vercel environment variables" });

  try {
    const { prompt, imageBase64, imageBase64Array, imageType, maxTokens = 1024, bron = "onbekend" } = req.body;

    const content = [];
    if (Array.isArray(imageBase64Array) && imageBase64Array.length > 0) {
      // Meerdere foto's (bv. een recept dat over meerdere kookboekpagina's loopt)
      // in dezelfde aanroep, zodat de AI ze als één geheel leest.
      imageBase64Array.forEach(b64 => {
        content.push({ type: "image", source: { type: "base64", media_type: imageType || "image/jpeg", data: b64 } });
      });
    } else if (imageBase64) {
      content.push({ type: "image", source: { type: "base64", media_type: imageType || "image/jpeg", data: imageBase64 } });
    }
    content.push({ type: "text", text: prompt });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        messages: [{ role: "user", content }],
      }),
    });

    const data = await response.json();
    const text = data.content?.find(b => b.type === "text")?.text || "";

    if (data.usage) {
      const gebruiker = await getSessionUser(token);
      logAiGebruik({
        bron, inputTokens: data.usage.input_tokens || 0, outputTokens: data.usage.output_tokens || 0, gebruiker,
      });
    }

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: "AI-analyse mislukt: " + e.message });
  }
}
