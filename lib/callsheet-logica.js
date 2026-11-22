// ════════════════════════════════════════════════════════════════════
// CALLSHEET — per draaidag, opgebouwd uit wat al in het project staat
// (locaties, crew, cast, hotel, deliverables, klant) in de vorm van Pepijns
// eigen callsheet-template (Keuken Kampioen – Häcker, 2 december 2026):
//
//   samenvatting (crew / cast / klant op set) · logo's · titel · set-telefoon
//   LOCATIES · PRODUCTIE (+ factuurgegevens) · CALLS · CAST CALL ·
//   DRAAISCHEMA · BELANGRIJKE NOTES · CREW & KLANT · CAMERA / DATA
//   "Geel gemarkeerd = nog in te vullen"
//
// Alles wat je in de editor aanpast wordt per draaidag bewaard
// (project.callsheets[dagId]); wat per klant hetzelfde blijft (contacten bij
// bureau/klant, factuurgegevens, logo's) en per werkruimte (jouw naam en
// telefoon, vaste notes, productielogo) wordt onthouden voor de volgende keer.
//
// Puur: geen imports behalve de pure logica; de Excel-schrijver krijgt
// ExcelJS mee als parameter (zo blijft de bundel klein en is alles testbaar).
// ════════════════════════════════════════════════════════════════════
import { strNaarDatum } from "./taken-logica";
import { draaidagenVan, onderdeelVan, normaliseerDeliverables, DELIVERABLE_KANALEN } from "./projecten-logica";

export const STANDAARD_NOTES = [
  "Meld eventuele schade altijd direct bij productie.",
  "Reiskostenvergoeding bedraagt maximaal € 0,23/km voor personenauto's en € 0,50/km voor materiaalwagens.",
  "{productiebedrijf} is niet verantwoordelijk voor eventuele verkeersboetes.",
  "Het is niet toegestaan om zonder toestemming foto's van de productie online te plaatsen.",
  "Neem je eigen waterfles mee om bij te vullen.",
  "Aanwezigheid op set betekent dat je akkoord gaat met de regels zoals vermeld op het callsheet.",
];
const CS_CAST = ["acteurs", "edelfiguranten", "figuranten"];

export function datumLang(datum) {
  if (!datum) return "";
  return strNaarDatum(datum).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
export function telefoonUit(b) {
  if (b?.telefoon) return b.telefoon;
  const m = /(\+?\d[\d\s\-()]{7,}\d)/.exec(b?.notitie || "");
  return m ? m[1].trim() : "";
}
export const voornaam = (n) => String(n || "").trim().split(/\s+/)[0] || "";
export function mapsLink(adres) {
  return adres ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres).replace(/%20/g, "+")}` : null;
}
function alleBezetting(lijst) {
  return (lijst.items || []).flatMap(i => (i.bezetting || []).filter(b => b.naam).map(b => ({ ...b, taakOnderdeel: i.onderdeelId })));
}

// Het volledige callsheet-model voor één draaidag: eerst wat je zelf hebt
// ingevuld (opgeslagen), anders afgeleid uit het project, de klant en je
// werkruimte-instellingen.
export function bouwCallsheet(lijst, dagId, { klant = null, instellingen = {} } = {}) {
  const p = lijst.project || {};
  const dagen = draaidagenVan(p);
  const dag = dagen.find(d => d.id === dagId) || dagen[0] || { id: "dag1", datum: p.draaidag };
  const dagNr = Math.max(0, dagen.findIndex(d => d.id === dag.id)) + 1;
  const opgeslagen = (p.callsheets || {})[dag.id] || {};
  const kc = klant?.callsheet || {};
  const ins = instellingen || {};
  const bez = alleBezetting(lijst).filter(b => !(opgeslagen.afwezig || []).includes(b.id));
  const productiebedrijf = ins.productiebedrijf || "";

  // Locaties: draailocaties (exterieur/interieur) + hotel.
  const locs = bez.filter(b => /^loc-/.test(b.onderdeelId));
  const hotels = bez.filter(b => b.onderdeelId === "hotel");
  const locaties = opgeslagen.locaties || [
    ...locs.map((b, n) => ({ label: locs.length > 1 ? `Draailocatie ${n + 1}` : "Draailocatie", naam: b.naam, adres: b.adres || "", geel: b.status !== "bevestigd" })),
    ...hotels.map(b => ({ label: "Overnachting", naam: b.naam, adres: b.adres || "", geel: b.status !== "bevestigd" })),
  ];

  // Crew: per gekozen rol, plus jijzelf (productie) als je er nog niet tussen staat.
  const crewBez = bez.filter(b => /^crew-/.test(b.onderdeelId));
  let crew = crewBez.map(b => ({ bezettingId: b.id, functie: onderdeelVan(b.onderdeelId)?.label || "Crew", naam: b.naam, telefoon: telefoonUit(b), geel: b.status !== "bevestigd" }));
  if (ins.mijnNaam && !crew.some(c => c.naam.trim().toLowerCase() === ins.mijnNaam.trim().toLowerCase())) {
    crew.splice(Math.min(2, crew.length), 0, { functie: ins.mijnFunctie || "Productie", naam: ins.mijnNaam, telefoon: ins.mijnTelefoon || "" });
  }
  if (opgeslagen.crewExtra) crew = [...crew, ...opgeslagen.crewExtra];

  // Cast call: uit de cast-namen, aangevuld met wat je per persoon invulde.
  const detail = opgeslagen.castDetails || {};
  const cast = [
    ...bez.filter(b => CS_CAST.includes(b.onderdeelId)).map(b => {
      const d = detail[b.id] || {};
      const bevestigd = b.status === "bevestigd";
      return {
        bezettingId: b.id, naam: bevestigd ? b.naam : `${b.naam} (nog niet bevestigd)`,
        calltijd: d.calltijd || "", visagie: d.visagie || "", kleding: d.kleding || "", draaiklaar: d.draaiklaar || "",
        rol: d.rol || ({ acteurs: "Acteur", edelfiguranten: "Edelfigurant", figuranten: "Figurant" })[b.onderdeelId] || "", geel: !bevestigd,
      };
    }),
    ...(opgeslagen.castExtra || []).map(c => ({ ...c, geel: c.geel !== false })),
  ];

  // Regie uit de crew, jijzelf als productie; bureau-/klantcontacten uit het klantgeheugen.
  const regie = crewBez.find(b => b.onderdeelId === "crew-regie");
  const productie = opgeslagen.productie || [
    ...(kc.productie || []),
    ...(productiebedrijf ? [{ functie: "Production company", naam: productiebedrijf }] : []),
    ...(ins.mijnNaam ? [{ functie: ins.mijnFunctie || "Productie", naam: ins.mijnNaam }] : []),
    ...(regie ? [{ functie: "Regie", naam: regie.naam }] : []),
  ];

  const hotel = hotels[0];
  const draailoc = locs[0];
  const calls = opgeslagen.calls || [
    ...(hotel ? [{ wat: "Vertrek hotel", tijd: "", locatie: hotel.naam }] : []),
    { wat: "Crewcall", tijd: "08:00 uur", locatie: draailoc ? [draailoc.naam, draailoc.adres].filter(Boolean).join(", ") : "" },
    { wat: "Klant call", tijd: "", locatie: "" },
    { wat: "Lunch", tijd: "12:30 – 13:00 uur", locatie: "" },
    { wat: "Est. wrap", tijd: "", locatie: "" },
  ];

  const deliv = normaliseerDeliverables(p.deliverables || {});
  const formaten = [...new Set(DELIVERABLE_KANALEN.flatMap(k => deliv[k.id] || []))];
  const camera = opgeslagen.camera ?? (formaten.length
    ? (formaten.includes("16x9") && formaten.length > 1
      ? `Wij draaien voor 16:9 maar houden rekening met: ${formaten.filter(f => f !== "16x9").map(f => f.replace("x", ":")).join(", ").replace(/, ([^,]*)$/, " & $1")}`
      : `Wij draaien voor ${formaten.map(f => f.replace("x", ":")).join(", ")}`)
    : "");

  const notes = (opgeslagen.notes || ins.notes || STANDAARD_NOTES).map(n => n.replace(/\{productiebedrijf\}/g, productiebedrijf || "Productie"));
  const klantOpSet = opgeslagen.klantOpSet || kc.klantOpSet || [];

  return {
    dagId: dag.id, datum: dag.datum, dagNr, aantalDagen: dagen.length,
    titel: opgeslagen.titel || `CALLSHEET ${[klant?.naam, lijst.name].filter(Boolean).join(" – ")}`.toUpperCase(),
    plaats: opgeslagen.plaats ?? kc.plaats ?? "",
    setTelefoon: opgeslagen.setTelefoon ?? (ins.mijnNaam ? [ins.mijnNaam, ins.mijnTelefoon].filter(Boolean).join(" – ") : ""),
    locaties, reistijd: opgeslagen.reistijd ?? "",
    productie, factuur: opgeslagen.factuur ?? kc.factuur ?? "", po: opgeslagen.po ?? "",
    calls, cast, schema: opgeslagen.schema || [], notes, crew, klantOpSet,
    camera, data: opgeslagen.data ?? ins.data ?? "",
    logos: { productie: ins.productieLogoId || null, agency: kc.agencyLogoId || null, klant: kc.klantLogoId || null, ...(opgeslagen.logos || {}) },
    afwezig: opgeslagen.afwezig || [],
  };
}

// Wat er per klant en per werkruimte onthouden moet worden na het bewaren.
export function callsheetGeheugen(cs) {
  return {
    klant: { productie: cs.productie.filter(r => !/^(production company|productie|regie)$/i.test(r.functie || "")), factuur: cs.factuur, klantOpSet: cs.klantOpSet, plaats: cs.plaats, agencyLogoId: cs.logos?.agency || null, klantLogoId: cs.logos?.klant || null },
    werkruimte: { notes: cs.notes, productieLogoId: cs.logos?.productie || null },
  };
}

// De drie samenvattingsregels bovenaan (zoals in het template).
export function samenvatting(cs) {
  const castNamen = cs.cast.map(c => c.naam);
  const klantNamen = cs.klantOpSet.map(k => voornaam(k.naam)).filter(Boolean);
  return [
    `Crew: (${cs.crew.length}) ${cs.crew.map(c => voornaam(c.naam)).join(", ")}`,
    `Cast: (${castNamen.length}) ${castNamen.join(", ")}`,
    `Agency & Klant op set: (${klantNamen.length}) ${klantNamen.join(", ")}`,
  ];
}

export function heeftGeel(cs) {
  return cs.cast.some(c => c.geel) || cs.locaties.some(l => l.geel) || cs.crew.some(c => c.geel);
}

// ── Excel-schrijver (ExcelJS wordt meegegeven) ─────────────────────────
// logos: { productie|agency|klant: { base64, extension, breedte, hoogte } }
export function maakCallsheetWerkboek(cs, ExcelJS, logos = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ons Huishouden — Taken";
  const ws = wb.addWorksheet((`Callsheet ${cs.titel.replace(/^CALLSHEET\s*/i, "")}`).slice(0, 31).replace(/[\\/?*[\]:]/g, ""), {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });
  ws.columns = [{ width: 36 }, { width: 30 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 40 }];
  const dun = { style: "thin", color: { argb: "FFBFBFBF" } };
  const rand = { top: dun, left: dun, bottom: dun, right: dun };
  const font = (extra = {}) => ({ name: "Arial", size: 10, ...extra });
  const GRIJS = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
  const DONKER = { type: "pattern", pattern: "solid", fgColor: { argb: "FF404040" } };
  const GEEL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
  let r = 0;
  const rij = () => ++r;
  const cel = (rr, c, waarde, stijl = {}) => {
    const x = ws.getCell(rr, c);
    x.value = waarde ?? "";
    x.font = font(stijl.font);
    if (stijl.fill) x.fill = stijl.fill;
    if (stijl.border !== false) x.border = rand;
    x.alignment = { vertical: "middle", wrapText: true, ...(stijl.align || {}) };
    return x;
  };
  const merge = (rr, c1, c2) => { if (c2 > c1) ws.mergeCells(rr, c1, rr, c2); };
  const sectie = (titel) => {
    rij(); // lege regel
    const rr = rij();
    cel(rr, 1, titel, { font: { bold: true, size: 11, color: { argb: "FFFFFFFF" } }, fill: DONKER, border: false });
    merge(rr, 1, 6);
    ws.getRow(rr).height = 20;
  };
  const kop = (cellen) => {
    const rr = rij();
    for (const [c1, c2, t] of cellen) { cel(rr, c1, t, { font: { bold: true }, fill: GRIJS }); for (let c = c1 + 1; c <= c2; c++) cel(rr, c, "", { fill: GRIJS }); merge(rr, c1, c2); }
  };
  const regel = (cellen, { vet = false, geel = false } = {}) => {
    const rr = rij();
    for (const [c1, c2, t, extra] of cellen) {
      const isEerste = c1 === 1;
      const x = cel(rr, c1, t, { font: { bold: vet && isEerste }, fill: geel && isEerste ? GEEL : undefined, ...(extra || {}) });
      for (let c = c1 + 1; c <= c2; c++) cel(rr, c, "");
      merge(rr, c1, c2);
      if (extra?.link) { x.value = { text: t, hyperlink: extra.link }; x.font = font({ color: { argb: "FF0563C1" }, underline: true }); }
    }
    return rr;
  };

  // Samenvatting (regel 1–3)
  for (const tekst of samenvatting(cs)) { const rr = rij(); cel(rr, 1, tekst, { font: { bold: true } }); for (let c = 2; c <= 6; c++) cel(rr, c, ""); merge(rr, 1, 6); }

  // Logo's (regel 5–8)
  rij();
  const logoRij = r; // 0-gebaseerd voor afbeeldingen = r
  const plaats = { productie: 0, agency: 2, klant: 5 };
  for (const [slot, kolom] of Object.entries(plaats)) {
    const l = logos[slot];
    if (!l?.base64) continue;
    const id = wb.addImage({ base64: l.base64, extension: l.extension || "png" });
    // Verhouding behouden: max. 72 px hoog en niet breder dan de kolomruimte.
    const verhouding = l.breedte && l.hoogte ? l.breedte / l.hoogte : 1.5;
    const maxB = kolom === 5 ? 280 : 200;
    const hoogte = Math.round(Math.min(72, maxB / verhouding));
    ws.addImage(id, { tl: { col: kolom, row: logoRij }, ext: { width: Math.round(hoogte * verhouding), height: hoogte } });
  }
  r += 4;

  // Titel
  let rr = rij(); cel(rr, 1, cs.titel, { font: { bold: true, size: 18 }, border: false, align: { horizontal: "center" } }); merge(rr, 1, 6); ws.getRow(rr).height = 28;
  rr = rij(); cel(rr, 1, [datumLang(cs.datum), cs.aantalDagen > 1 ? `draaidag ${cs.dagNr} van ${cs.aantalDagen}` : "", cs.plaats].filter(Boolean).join(" – "), { font: { size: 11 }, border: false, align: { horizontal: "center" } }); merge(rr, 1, 6);
  if (cs.setTelefoon) { rr = rij(); cel(rr, 1, `Set telefoon: ${cs.setTelefoon}`, { font: { bold: true, size: 11 }, border: false, align: { horizontal: "center" } }); merge(rr, 1, 6); }

  // Locaties
  sectie("LOCATIES");
  kop([[1, 1, "LOCATIE"], [2, 2, "NAAM"], [3, 5, "ADRES"], [6, 6, "ROUTE"]]);
  for (const l of cs.locaties) {
    regel([[1, 1, l.label], [2, 2, l.naam], [3, 5, l.adres], [6, 6, l.adres ? "Open in Google Maps" : "", l.adres ? { link: mapsLink(l.adres) } : undefined]], { vet: true, geel: l.geel });
  }
  if (cs.reistijd) regel([[1, 1, "Reistijd"], [2, 6, cs.reistijd]], { vet: true });

  // Productie + factuurgegevens
  sectie("PRODUCTIE");
  const factuur = [cs.factuur ? "Factuurgegevens:" : "", ...String(cs.factuur || "").split("\n").filter(Boolean), cs.po ? `PO nummer: ${cs.po}` : ""].filter(Boolean);
  const nProd = Math.max(cs.productie.length, factuur.length);
  for (let n = 0; n < nProd; n++) {
    const pr = cs.productie[n] || {};
    regel([[1, 1, pr.functie || ""], [2, 3, pr.naam || ""], [4, 6, factuur[n] || ""]], { vet: true });
  }

  // Calls
  sectie("CALLS");
  kop([[1, 1, "CALLS"], [2, 2, "TIJD"], [3, 6, "LOCATIE"]]);
  for (const c of cs.calls) regel([[1, 1, c.wat], [2, 2, c.tijd], [3, 6, c.locatie]], { vet: true });

  // Cast call
  if (cs.cast.length) {
    sectie("CAST CALL");
    kop([[1, 1, "NAAM"], [2, 2, "CALLTIJD"], [3, 3, "VISAGIE"], [4, 4, "KLEDING"], [5, 5, "DRAAIKLAAR"], [6, 6, "ROL"]]);
    for (const c of cs.cast) regel([[1, 1, c.naam], [2, 2, c.calltijd], [3, 3, c.visagie], [4, 4, c.kleding], [5, 5, c.draaiklaar], [6, 6, c.rol]], { geel: c.geel });
  }

  // Draaischema
  if (cs.schema.length) {
    const d = cs.datum ? strNaarDatum(cs.datum).toLocaleDateString("nl-NL", { day: "numeric", month: "long" }).toUpperCase() : "";
    sectie(`DRAAISCHEMA ${d}`.trim());
    kop([[1, 1, "TIJD"], [2, 4, "WAT"], [5, 5, "CAST"], [6, 6, "NOTES"]]);
    for (const s of cs.schema) {
      if (s.pauze) {
        const pr = rij();
        cel(pr, 1, [s.wat || "LUNCH", s.tijd].filter(Boolean).join(" "), { font: { bold: true }, fill: GRIJS, border: false, align: { horizontal: "center" } });
        merge(pr, 1, 6);
        continue;
      }
      regel([[1, 1, s.tijd], [2, 4, s.wat], [5, 5, s.cast], [6, 6, s.notes]]);
    }
  }

  // Notes
  if (cs.notes.length) {
    sectie("BELANGRIJKE NOTES");
    for (const n of cs.notes) {
      const nr = rij();
      cel(nr, 1, `- ${n}`, { font: { bold: true, color: { argb: "FFC00000" } } });
      for (let c = 2; c <= 6; c++) cel(nr, c, "");
      merge(nr, 1, 6);
      ws.getRow(nr).height = n.length > 110 ? 26 : 15;
    }
  }

  // Crew & klant
  sectie("CREW & KLANT");
  kop([[1, 1, "FUNCTIE"], [2, 2, "NAAM"], [3, 6, "TELEFOON"]]);
  for (const c of cs.crew) regel([[1, 1, c.functie], [2, 2, c.naam], [3, 6, c.telefoon]], { vet: true, geel: c.geel });
  for (const k of cs.klantOpSet) regel([[1, 1, k.organisatie || "Klant"], [2, 2, k.naam], [3, 6, k.telefoon || ""]], { vet: true });

  // Camera / data
  if (cs.camera || cs.data) rij();
  if (cs.camera) regel([[1, 1, "CAMERA"], [2, 6, cs.camera]], { vet: true });
  if (cs.data) regel([[1, 1, "DATA"], [2, 6, cs.data]], { vet: true });

  if (heeftGeel(cs)) {
    rij();
    const gr = rij();
    cel(gr, 1, "Geel gemarkeerd = nog in te vullen", { font: { size: 8, color: { argb: "FF808080" } }, fill: GEEL, border: false });
  }
  return wb;
}

export function callsheetBestandsnaam(cs) {
  const d = cs.datum ? strNaarDatum(cs.datum).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" }) : "";
  return `${cs.titel.replace(/^CALLSHEET\s*/i, "Callsheet ")} ${d}`.replace(/[–—]/g, "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/[^A-Za-z0-9 _-]/g, "").replace(/\s+/g, "_").replace(/_-_/g, "_") + ".xlsx";
}

