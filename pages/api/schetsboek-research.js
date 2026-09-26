import { isValidSession, getSessionTokenFromReq, getSessionUser } from "../../lib/auth";
import { logAiGebruik } from "../../lib/ai-usage";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

// Elke zoekopdracht kost apart geld ($0,01, los van tokenkosten) — 6 is
// genoeg om een paar concurrenten, wat marktcijfers en een reality-check te
// zoeken, zonder dat één onderzoek onnodig duur wordt.
const MAX_ZOEKOPDRACHTEN = 6;

// Verzamelt de bronnen uit de citations van alle tekstblokken, gededupliceerd
// op URL (in volgorde van eerste voorkomen) — Anthropic's eigen richtlijnen
// schrijven bronvermelding voor bij het rechtstreeks tonen van
// web-search-resultaten aan een gebruiker.
function verzamelBronnen(contentBlokken) {
  const bronnenMap = new Map();
  (contentBlokken || []).forEach(b => {
    (b.citations || []).forEach(c => {
      if (c.url && !bronnenMap.has(c.url)) bronnenMap.set(c.url, { url: c.url, titel: c.title || c.url });
    });
  });
  return [...bronnenMap.values()];
}

// Herkende labels aan het einde van de analyse — in willekeurige volgorde,
// zolang ze aan het eind staan (met eventueel lege regels ertussen). Alles
// vóór het eerste niet-matchende regel (van onderaf gezien) blijft de
// leesbare analysetekst.
const STRUCTUUR_LABELS = ["KORT", "MARKTOMVANG", "CONCURRENTIE", "INVESTERING", "VERVOLGSTAP"];

function haalStructuurEruit(analyse) {
  const regels = analyse.split("\n");
  const structuur = {};
  let eindIndex = regels.length;
  for (let i = regels.length - 1; i >= 0; i--) {
    const regel = regels[i].trim();
    if (!regel) { eindIndex = i; continue; }
    const match = regel.match(/^([A-Z]+):\s*(.+)$/);
    if (match && STRUCTUUR_LABELS.includes(match[1]) && structuur[match[1]] === undefined) {
      structuur[match[1]] = match[2].trim();
      eindIndex = i;
    } else {
      break;
    }
  }
  return {
    analyseZonderStructuur: regels.slice(0, eindIndex).join("\n").trim(),
    kortVerdict: structuur.KORT || "Onderzocht — zie details",
    marktomvang: structuur.MARKTOMVANG || null,
    concurrentie: structuur.CONCURRENTIE || null,
    investering: structuur.INVESTERING || null,
    vervolgstap: structuur.VERVOLGSTAP || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Methode niet toegestaan" });

  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY niet ingesteld" });

  const { projectNaam, ideeenSamenvatting } = req.body || {};
  if (!ideeenSamenvatting || !ideeenSamenvatting.trim()) {
    return res.status(400).json({ error: "Nog geen tekst-inhoud in dit project om te onderzoeken — voeg eerst een tekst-schets toe." });
  }

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_ZOEKOPDRACHTEN }],
        messages: [{
          role: "user",
          content: `Ik overweeg het volgende bedrijfsidee, met de werktitel "${projectNaam || "naamloos idee"}":

${ideeenSamenvatting}

Doe een kort, eerlijk marktonderzoek met behulp van websearch en beantwoord daarna deze drie vragen, met duidelijke markdown-tussenkopjes (## Bestaat dit al, etc.):

1. BESTAAT DIT AL? — Zoek naar vergelijkbare bestaande bedrijven, producten of diensten (ook internationaal als dat relevant is). Noem concrete namen als je ze vindt, met een korte typering van hoe vergelijkbaar ze zijn.
2. IS ER MARKT VOOR? — Zoek naar aanwijzingen voor vraag: trends, doelgroepgrootte, recente ontwikkelingen in deze markt. Wees eerlijk als je weinig concreets vindt.
3. KANS VAN SLAGEN — Geef op basis van het bovenstaande een eerlijke, genuanceerde inschatting (bv. "kansrijk maar verzadigd", "nichemarkt met weinig concurrentie", "twijfelachtig omdat..."). Vermijd zowel overdreven enthousiasme als onnodig afbreken — wees een kritische, behulpzame sparringpartner.

Eindig je antwoord met exact deze vijf regels, in deze volgorde, elk op een eigen regel en zonder verdere opmaak eromheen (dit wordt automatisch verwerkt tot een overzichtskaartje):
KORT: <je conclusie in maximaal 10 woorden>
MARKTOMVANG: <klein/gemiddeld/groot> - <max 8 woorden toelichting>
CONCURRENTIE: <een cijfer 1-5, waarbij 5 = zeer verzadigd>
INVESTERING: <laag/gemiddeld/hoog>
VERVOLGSTAP: <de meest logische eerste concrete actie, maximaal 15 woorden — dit wordt als eerste actiepunt voorgesteld>

Schrijf in het Nederlands, bondig en concreet (dit wordt op een telefoon gelezen), geen lange inleidingen.`,
        }],
      }),
    });

    const aiData = await aiRes.json();
    if (aiData.error) return res.status(500).json({ error: aiData.error.message || "AI-fout" });

    // Alleen de tekst-blokken bevatten het uiteindelijke antwoord — de
    // losse zoekopdrachten zelf (server_tool_use/server_tool_result) worden
    // genegeerd, die zijn al door Claude verwerkt in de samenvattende tekst.
    const ruweAnalyse = (aiData.content || []).filter(b => b.type === "text").map(b => b.text).join("\n\n").trim();
    if (!ruweAnalyse) return res.status(500).json({ error: "Geen analyse ontvangen — probeer het nog eens." });
    const { analyseZonderStructuur: analyse, kortVerdict, marktomvang, concurrentie, investering, vervolgstap } = haalStructuurEruit(ruweAnalyse);

    // Bronnen uit de citations van elk tekstblok — Anthropic's eigen
    // richtlijnen schrijven voor dat bronvermelding verplicht is wanneer
    // web-search-resultaten rechtstreeks aan een gebruiker getoond worden.
    const bronnen = verzamelBronnen(aiData.content);

    const aantalZoekopdrachten = (aiData.content || []).filter(b => b.type === "server_tool_use" && b.name === "web_search").length;

    if (aiData.usage) {
      const gebruiker = await getSessionUser(token);
      logAiGebruik({
        bron: "schetsboek-research",
        inputTokens: aiData.usage.input_tokens || 0,
        outputTokens: aiData.usage.output_tokens || 0,
        webSearches: aantalZoekopdrachten,
        gebruiker,
      });
    }

    return res.status(200).json({ analyse, kortVerdict, marktomvang, concurrentie, investering, vervolgstap, bronnen, aantalZoekopdrachten });
  } catch (e) {
    return res.status(500).json({ error: "Kon geen onderzoek uitvoeren: " + e.message });
  }
}
