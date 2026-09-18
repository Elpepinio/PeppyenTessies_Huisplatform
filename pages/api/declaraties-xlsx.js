import { Redis } from "@upstash/redis";
import ExcelJS from "exceljs";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const SJABLOON_KEY = "huishouden:declaraties-sjablonen";

const MAAND_NAMEN = ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];
function maandNaam(datumStr) {
  const maand = Number(datumStr.split("-")[1]) - 1;
  return MAAND_NAMEN[maand].charAt(0).toUpperCase() + MAAND_NAMEN[maand].slice(1);
}

const VERVOERMIDDEL_LABELS = { trein: "Trein", bus: "Bus", tram: "Tram", metro: "Metro", ovfiets: "OV-fiets", overig: "Overig" };
const KM_TARIEF = 0.23;

// Zet een item uit de Declaraties-tool om naar de drie kolommen die het
// declaratieformulier verwacht: Kostensoort, Omschrijving, en het bedrag
// (als formule voor kilometers — dezelfde conventie die in het originele,
// geüploade voorbeeldbestand al werd gebruikt: =<km>*0.23 i.p.v. een kaal
// getal, zodat de onderliggende kilometers zichtbaar blijven in de formule).
function veldenVoorItem(item) {
  if (item.type === "kilometer") {
    const afstandsfactor = item.retour ? 2 : 1;
    const totaalKm = (item.km || 0) * afstandsfactor;
    return {
      kostensoort: "KM vergoeding werk",
      omschrijving: `${item.project} — ${item.van} → ${item.naar}${item.retour ? " (retour)" : ""}`,
      bedragOfFormule: { formula: `${totaalKm}*${KM_TARIEF}` },
    };
  }
  if (item.type === "parkeren") {
    return {
      kostensoort: "Parkeerkosten",
      omschrijving: `${item.project}${item.locatie ? ` — ${item.locatie}` : ""}`,
      bedragOfFormule: item.bedrag || 0,
    };
  }
  if (item.type === "ov") {
    const trajectOmschrijving = (item.ritten || [])
      .map(r => `${VERVOERMIDDEL_LABELS[r.vervoermiddel] || r.vervoermiddel}${r.omschrijving ? ` (${r.omschrijving})` : ""}`)
      .join(", ");
    const totaal = (item.ritten || []).reduce((s, r) => s + (r.bedrag || 0), 0);
    return {
      kostensoort: "KM vergoeding werk", // geen apart OV-kostensoort in het sjabloon — zelfde conventie als de bestaande OV-regels in het geüploade voorbeeld
      omschrijving: `${item.project} — OV: ${trajectOmschrijving}`,
      bedragOfFormule: Math.round(totaal * 100) / 100,
    };
  }
  // overig
  return {
    kostensoort: "Overige kantoorkosten", // beste gok — geen exacte match in het sjabloon voor "overig", pas dit gerust handmatig aan in het gegenereerde bestand
    omschrijving: `${item.project}${item.omschrijving ? ` — ${item.omschrijving}` : ""}`,
    bedragOfFormule: item.bedrag || 0,
  };
}

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });
  if (req.method !== "POST") return res.status(405).json({ error: "Methode niet toegestaan" });

  try {
    const { persoon, items } = req.body;
    if (!persoon || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Geen persoon of geen declaraties meegegeven" });
    }

    const sjabloonData = await redis.get(SJABLOON_KEY);
    const sjablonen = sjabloonData ? (typeof sjabloonData === "string" ? JSON.parse(sjabloonData) : sjabloonData) : {};
    const sjabloon = sjablonen[persoon];
    if (!sjabloon) {
      return res.status(400).json({ error: `Nog geen declaratieformulier-sjabloon geüpload voor ${persoon}.` });
    }

    // Het sjabloon heeft 24 vaste, al opgemaakte regels (rij 12 t/m 35) met
    // een formule in de Totaal-kolom die al klaarstaat — meer dan dat past
    // er niet zonder de rest van het formulier (totalen, opmaak) te
    // verschuiven, dus dat vangen we hier expliciet af i.p.v. stilzwijgend
    // data te laten verdwijnen.
    const MAX_REGELS = 24;
    if (items.length > MAX_REGELS) {
      return res.status(400).json({ error: `Het sjabloon heeft ruimte voor maximaal ${MAX_REGELS} regels — deze selectie heeft er ${items.length}. Splits de selectie op in kleinere periodes.` });
    }

    const buffer = Buffer.from(sjabloon.base64, "base64");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const ws = workbook.getWorksheet("Declaratieformulier");
    if (!ws) return res.status(400).json({ error: "Kon het tabblad 'Declaratieformulier' niet vinden in het sjabloon." });

    ws.getCell("C5").value = sjabloon.volledigeNaam || persoon;
    ws.getCell("C9").value = new Date();

    let rij = 12;
    for (const item of items) {
      const { kostensoort, omschrijving, bedragOfFormule } = veldenVoorItem(item);
      ws.getCell(`B${rij}`).value = kostensoort;
      ws.getCell(`C${rij}`).value = maandNaam(item.datum);
      ws.getCell(`D${rij}`).value = omschrijving;
      ws.getCell(`E${rij}`).value = bedragOfFormule;
      rij++;
    }

    const uitvoerBuffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="declaratieformulier-${persoon}-${new Date().toISOString().slice(0,10)}.xlsx"`);
    return res.status(200).send(Buffer.from(uitvoerBuffer));
  } catch (e) {
    return res.status(500).json({ error: "Kon het declaratieformulier niet vullen: " + e.message });
  }
}
