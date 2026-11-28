import { ONDERDEEL_WOORDEN } from "./intake-logica";
import { nieuweBezetting, standaardBuyouts, bezettingKosten, draaidagenVan, projectStatus } from "./projecten-logica";

// ════════════════════════════════════════════════════════════════════
// OFFERTE-PDF → KOSTENOVERZICHT
// Leest de specificatie uit een offerte-PDF (zoals de Full Frame-offertes
// uit EOS: kopjes met daaronder posten, elk met aantal + eenheid, prijs en
// totaal) en maakt er een Excel van om de werkelijke kosten bij te houden:
// per post Begroot · Werkelijk · Verschil, met subtotalen en marge als
// formules.
//
// Stap 1 (browser): pdf.js levert per pagina tekststukjes met x/y.
// Stap 2 (hier, puur): stukjes → regels → offerte { kopjes, posten, totaal }.
// Stap 3 (hier, puur): offerte → ExcelJS-werkboek (ExcelJS wordt meegegeven).
// ════════════════════════════════════════════════════════════════════

// "9.500,00" → 9500 · "-2.100,00" → -2100 · "€ 1.000,00" → 1000
export function leesEuro(s) {
  const t = String(s || "").replace(/€|\s/g, "");
  if (!/^-?[\d.]*\d(,\d+)?$/.test(t)) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
// Aantallen staan in EOS met een punt als decimaalteken ("1.5 dag", "1.25 stuks").
export function leesAantal(s) {
  const n = Number(String(s || "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// pdf.js-stukjes → regels (per pagina van boven naar beneden). Kop- en
// voetteksten (bovenste en onderste strook van de pagina) vallen weg.
// paginas: [[{ str, x, y, w }]] — y = afstand vanaf de onderkant.
export function regelsUitPdf(paginas, { kop = 615, voet = 70 } = {}) {
  const regels = [];
  paginas.forEach((stukjes, p) => {
    const zinvol = stukjes.filter(s => String(s.str || "").trim() && s.y > voet && s.y < kop);
    const rijen = [];
    for (const s of [...zinvol].sort((a, b) => b.y - a.y || a.x - b.x)) {
      const rij = rijen.find(r => Math.abs(r.y - s.y) <= 2.5);
      if (rij) rij.stukjes.push(s); else rijen.push({ y: s.y, stukjes: [s] });
    }
    for (const r of rijen) {
      const st = r.stukjes.sort((a, b) => a.x - b.x);
      regels.push({ pagina: p + 1, y: r.y, x: st[0].x, tekst: st.map(s => s.str.trim()).join(" ").replace(/\s+/g, " "), stukjes: st });
    }
  });
  return regels;
}

const EENHEID = "(x|dag\\.?|dagen|uur|uren|stuks?|st\\.?|prijs|keer|week|weken|maand|km|pp|p\\.p\\.|set|post)";
// naam  aantal eenheid  [€] prijs  € totaal
const KOSTENREGEL = new RegExp(`^(.*?)\\s+(-?\\d+(?:[.,]\\d+)?)\\s*${EENHEID}\\s+(€\\s*)?(-?[\\d.]+,\\d{2})\\s+€\\s*(-?[\\d.]+,\\d{2})$`, "i");

export function leesKostenregel(tekst) {
  const m = KOSTENREGEL.exec(String(tekst || "").trim());
  if (!m) return null;
  return {
    naam: m[1].trim(), aantal: leesAantal(m[2]), eenheid: m[3].replace(/\.$/, "").toLowerCase(),
    prijs: leesEuro(m[5]), totaal: leesEuro(m[6]), prijsMetEuro: !!m[4],
  };
}

const haakjesOpen = (s) => (s.match(/\(/g) || []).length > (s.match(/\)/g) || []).length;
const rond = (n) => Math.round(n * 100) / 100;

// Regels → offerte. Kopjes zijn kostenregels die minder ver inspringen (of
// waarvan de prijs zonder €-teken staat); posten springen verder in.
export function leesOfferte(regels) {
  const alle = regels.map(r => (typeof r === "string" ? { tekst: r, x: 0, pagina: 1 } : r));
  const tekst = alle.map(r => r.tekst).join("\n");
  const start = alle.findIndex(r => /^specificatie$/i.test(r.tekst.trim()));
  const eindIdx = alle.findIndex((r, i) => i > start && /totaal\s+(exclusief|excl\.?)\s+btw/i.test(r.tekst));
  const spec = alle.slice(start >= 0 ? start + 1 : 0, eindIdx >= 0 ? eindIdx : alle.length);

  const kost = spec.map(r => ({ r, k: leesKostenregel(r.tekst) })).filter(x => x.k);
  const minX = kost.length ? Math.min(...kost.map(x => x.r.x)) : 0;
  const isKop = (r, k) => (kost.some(x => x.r.x > minX + 4) ? r.x <= minX + 4 : !k.prijsMetEuro);

  const kopjes = [];
  let kopje = null, post = null;
  for (const r of spec) {
    if (/^(aantal\s+prijs\s+totaal|offerte|factuur)$/i.test(r.tekst.trim())) continue;
    const k = leesKostenregel(r.tekst);
    if (k && isKop(r, k)) {
      kopje = { naam: k.naam, omschrijving: "", aantal: k.aantal, eenheid: k.eenheid, prijs: k.prijs, totaal: k.totaal, posten: [] };
      kopjes.push(kopje);
      post = null;
      continue;
    }
    if (k) {
      if (!kopje) { kopje = { naam: "Offerte", omschrijving: "", aantal: 1, eenheid: "x", prijs: null, totaal: null, posten: [] }; kopjes.push(kopje); }
      post = { naam: k.naam, omschrijving: "", aantal: k.aantal, eenheid: k.eenheid, prijs: k.prijs, totaal: k.totaal };
      kopje.posten.push(post);
      continue;
    }
    // Tekst zonder bedragen: vervolg van een afgebroken kopnaam, of omschrijving.
    const t = r.tekst.trim();
    if (kopje && !post && haakjesOpen(kopje.naam)) { kopje.naam = `${kopje.naam} ${t}`; continue; }
    const doel = post || kopje;
    if (doel) doel.omschrijving = doel.omschrijving ? `${doel.omschrijving}\n${t}` : t;
  }
  // Kopjes zonder posten (bv. "Casting 1 prijs") krijgen zichzelf als post.
  for (const kp of kopjes) {
    if (!kp.posten.length) kp.posten.push({ naam: kp.naam, omschrijving: kp.omschrijving, aantal: kp.aantal, eenheid: kp.eenheid, prijs: kp.prijs, totaal: kp.totaal });
    kp.som = rond(kp.posten.reduce((s, p) => s + (p.totaal || 0), 0));
    if (kp.totaal == null) kp.totaal = kp.som;
  }

  const totaalRegel = eindIdx >= 0 ? alle[eindIdx].tekst : "";
  const totaalExcl = leesEuro((/(-?[\d.]+,\d{2})\s*$/.exec(totaalRegel) || [])[1]);
  const somKopjes = rond(kopjes.reduce((s, k) => s + (k.totaal || 0), 0));

  // Gegevens van de eerste pagina (linkerkolom in EOS-offertes).
  const veld = (naam) => {
    const i = alle.findIndex(r => r.pagina === 1 && new RegExp(`^${naam}$`, "i").test(r.tekst.trim()));
    if (i >= 0 && alle[i + 1]) return alle[i + 1].tekst.trim();
    const m = new RegExp(`${naam}\\s*:?\\s*([^\\n]+)`, "i").exec(tekst);
    return m ? m[1].trim() : "";
  };
  const betreft = (() => {
    const i = alle.findIndex(r => r.pagina === 1 && /^betreft$/i.test(r.tekst.trim()));
    if (i < 0) return "";
    const uit = [];
    for (let j = i + 1; j < alle.length && uit.length < 6; j++) {
      if (/^(offertedatum|offertenummer|uw referentie|datum)$/i.test(alle[j].tekst.trim())) break;
      uit.push(alle[j].tekst.trim());
    }
    return uit.join(" ");
  })();

  return {
    nummer: (veld("Offertenummer").match(/[\w-]+/) || [""])[0],
    datum: veld("Offertedatum"),
    betreft,
    kopjes,
    totaal: totaalExcl ?? somKopjes,
    somKopjes,
    klopt: totaalExcl == null || Math.abs(totaalExcl - somKopjes) < 0.05,
    aantalPosten: kopjes.reduce((n, k) => n + k.posten.length, 0),
    // De rest van de tekst (doel, deliverables, crew, cast…) voor de herkenning.
    tekst: alle.slice(0, start >= 0 ? start : 0).map(r => r.tekst).join("\n"),
    postnamen: kopjes.flatMap(k => [k.naam, ...k.posten.map(p => p.naam)]).join("\n"),
  };
}

// Alleen de linkerkolom van pagina 1 (adresblok, betreft, datum, nummer)
// staat in EOS naast de lopende tekst; die eerst als aparte regels nemen
// zodat "Offertenummer" en het nummer onder elkaar komen.
export function regelsUitOffertePdf(paginas) {
  if (!paginas.length) return [];
  const eerste = paginas[0];
  const links = eerste.filter(s => s.x < 200);
  const rechts = eerste.filter(s => s.x >= 200);
  const heeftKolommen = links.length > 5 && rechts.length > 5 && links.some(s => /^offertenummer$/i.test(String(s.str).trim()));
  if (!heeftKolommen) return regelsUitPdf(paginas);
  return [...regelsUitPdf([links]), ...regelsUitPdf([rechts]), ...regelsUitPdf(paginas.slice(1)).map(r => ({ ...r, pagina: r.pagina + 1 }))];
}

// ── Excel: kostenoverzicht om bij te houden ───────────────────────────
// Kolommen: Post | Omschrijving | Aantal | Eenheid | Prijs | Begroot |
//           Werkelijk | Verschil | Prognose | Leverancier / naam | Betaald | Opmerking
// Begroot = aantal × prijs, Verschil = Begroot − Werkelijk (alleen als
// ingevuld), Prognose = Werkelijk of anders nog Begroot. Subtotalen per
// kopje, totalen en de verwachte marge rekenen als formules mee.
export function maakKostenWerkboek(offerte, ExcelJS, { projectNaam = "", klantNaam = "", werkelijk = {}, marge = { minimum: 20, doel: 25 }, eigen = null } = {}) {
  const isEigen = (ki, pi, p, k) => (eigen ? eigen.has(`${ki}.${pi}`) : isEigenPost(p.naam, k.naam));
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ons Huishouden — Taken";
  wb.calcProperties = { fullCalcOnLoad: true }; // Excel/Numbers rekent alles opnieuw bij openen
  const ws = wb.addWorksheet("Kostenoverzicht", { views: [{ state: "frozen", ySplit: 5 }], pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [
    { width: 40 }, { width: 42 }, { width: 8 }, { width: 8 }, { width: 13 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 24 }, { width: 9 }, { width: 30 }, { width: 11 }, { width: 12, hidden: true }, { width: 12, hidden: true },
  ];
  const EUR = '"€" #,##0.00;[Red]-"€" #,##0.00';
  const font = (x = {}) => ({ name: "Arial", size: 10, ...x });
  const vul = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
  const DONKER = vul("FF404040"), KOP = vul("FFD9D9D9"), INVUL = vul("FFFFF8DC"), REKEN = vul("FFF2F2F2");
  const dun = { style: "thin", color: { argb: "FFBFBFBF" } };
  const rand = { top: dun, bottom: dun, left: dun, right: dun };
  const N = 13;

  ws.getCell("A1").value = `KOSTENOVERZICHT ${[klantNaam, projectNaam || offerte.betreft].filter(Boolean).join(" – ")}`.toUpperCase();
  ws.getCell("A1").font = font({ bold: true, size: 14 });
  ws.getCell("A2").value = [offerte.nummer ? `Offerte ${offerte.nummer}` : "", offerte.datum, offerte.betreft && projectNaam ? offerte.betreft : ""].filter(Boolean).join(" · ");
  ws.getCell("A2").font = font({ color: { argb: "FF808080" } });
  ws.getCell("A3").value = "Vul de gele kolommen in. Begroot, verschil, prognose, subtotalen en marge rekenen vanzelf mee.";
  ws.getCell("A3").font = font({ size: 9, italic: true, color: { argb: "FF808080" } });

  const kop = ws.getRow(5);
  ["Post", "Omschrijving", "Aantal", "Eenheid", "Prijs", "Begroot", "Werkelijk", "Verschil", "Prognose", "Leverancier / naam", "Betaald", "Opmerking", "Eigen werk"].forEach((t, i) => {
    const c = kop.getCell(i + 1);
    c.value = t; c.font = font({ bold: true, color: { argb: "FFFFFFFF" } }); c.fill = DONKER; c.border = rand;
    c.alignment = { vertical: "middle", horizontal: i >= 2 && i <= 8 ? "right" : "left" };
  });
  kop.height = 20;

  let r = 6;
  const kopRijen = [];
  offerte.kopjes.forEach((k, ki) => {
    const kr = r++;
    const row = ws.getRow(kr);
    row.getCell(1).value = k.naam;
    for (let c = 1; c <= N; c++) { const x = row.getCell(c); x.fill = KOP; x.font = font({ bold: true }); x.border = rand; }
    const eerste = r;
    k.posten.forEach((p, pi) => {
      const pr = ws.getRow(r);
      pr.getCell(1).value = p.naam;
      pr.getCell(2).value = (p.omschrijving || "").replace(/\n/g, " ");
      pr.getCell(3).value = p.aantal;
      pr.getCell(4).value = p.eenheid;
      pr.getCell(5).value = p.prijs;
      pr.getCell(6).value = { formula: `C${r}*E${r}`, result: p.totaal };
      const w = werkelijk[`${ki}.${pi}`];
      if (w != null) pr.getCell(7).value = w;
      pr.getCell(8).value = { formula: `IF(G${r}="","",F${r}-G${r})` };
      // Eigen werk (regie/montage/projectbegeleiding door jou) kost niets
      // extra: prognose 0, tenzij je er toch een bedrag bij werkelijk zet.
      pr.getCell(13).value = isEigen(ki, pi, p, k) ? "ja" : "nee";
      pr.getCell(9).value = { formula: `IF(G${r}="",IF(OR(M${r}="ja",F${r}<0),0,F${r}),G${r})` };
      // verborgen hulpkolommen: begroot en verschil van ingevulde ingekochte posten
      pr.getCell(14).value = { formula: `IF(OR(G${r}="",M${r}="ja"),0,F${r})` };
      pr.getCell(15).value = { formula: `IF(OR(G${r}="",M${r}="ja"),0,F${r}-G${r})` };
      for (let c = 1; c <= N; c++) {
        const x = pr.getCell(c);
        x.font = font(); x.border = rand;
        x.alignment = { vertical: "top", wrapText: c === 2 || c === 12 };
        if ([7, 10, 11, 12, 13].includes(c)) x.fill = INVUL;
        if (c === 9) x.fill = REKEN;
      }
      [5, 6, 7, 8, 9].forEach(c => { pr.getCell(c).numFmt = EUR; });
      pr.getCell(2).font = font({ size: 9, color: { argb: "FF606060" } });
      pr.getCell(11).dataValidation = { type: "list", allowBlank: true, formulae: ['"ja,nee,deels"'] };
      pr.getCell(13).dataValidation = { type: "list", allowBlank: false, formulae: ['"ja,nee"'] };
      r++;
    });
    const laatste = r - 1;
    row.getCell(6).value = { formula: `SUM(F${eerste}:F${laatste})`, result: k.som };
    row.getCell(7).value = { formula: `IF(COUNT(G${eerste}:G${laatste})=0,"",SUM(G${eerste}:G${laatste}))` };
    row.getCell(8).value = { formula: `IF(COUNT(H${eerste}:H${laatste})=0,"",SUM(H${eerste}:H${laatste}))` };
    row.getCell(9).value = { formula: `SUM(I${eerste}:I${laatste})` };
    [6, 7, 8, 9].forEach(c => { row.getCell(c).numFmt = EUR; });
    kopRijen.push(kr);
  });

  r++;
  const totRij = r;
  const som = (kol) => kopRijen.map(x => `N(${kol}${x})`).join("+") || "0";
  const tot = ws.getRow(totRij);
  tot.getCell(1).value = "TOTAAL EXCL. BTW";
  tot.getCell(6).value = { formula: som("F"), result: offerte.somKopjes };
  tot.getCell(7).value = { formula: som("G") };
  tot.getCell(8).value = { formula: som("H") };
  tot.getCell(9).value = { formula: som("I") };
  tot.getCell(14).value = { formula: `SUM(N6:N${totRij - 2})` };
  tot.getCell(15).value = { formula: `SUM(O6:O${totRij - 2})` };
  for (let c = 1; c <= N; c++) { const x = tot.getCell(c); x.font = font({ bold: true, color: { argb: "FFFFFFFF" } }); x.fill = DONKER; x.border = rand; }
  [6, 7, 8, 9].forEach(c => { tot.getCell(c).numFmt = EUR; });

  const info = (rij, label, kol, waarde, fmt, vet = false) => {
    const x = ws.getRow(rij);
    x.getCell(1).value = label; x.getCell(1).font = font({ bold: vet, color: vet ? undefined : { argb: "FF606060" } });
    x.getCell(kol).value = waarde; x.getCell(kol).numFmt = fmt; x.getCell(kol).font = font({ bold: vet });
  };
  r = totRij + 1;
  info(r++, "Werkelijk uitgegeven tot nu toe", 7, { formula: `G${totRij}` }, EUR);
  info(r++, "Verschil op de ingevulde posten (+ = goedkoper dan begroot)", 8, { formula: `H${totRij}` }, EUR);
  info(r++, "Verwachte eindkosten (werkelijk waar ingevuld, anders begroot)", 9, { formula: `I${totRij}` }, EUR);
  const margeRij = r;
  info(r++, "Verwachte winst (eigen werk + marge op inkoop)", 9, { formula: `F${totRij}-I${totRij}` }, EUR, true);
  const pctRijen = [];
  info(r++, "Verwachte winst in % van de offerte", 9, { formula: `IF(F${totRij}=0,"",I${margeRij}/F${totRij})` }, "0.0%", true);
  info(r++, "waarvan eigen werk (kolom 'Eigen werk' = ja)", 9, { formula: `SUMIF(M6:M${totRij - 2},"ja",F6:F${totRij - 2})` }, EUR);
  pctRijen.push(r); info(r++, "Marge op ingekochte posten (ingevuld)", 9, { formula: `IF(N${totRij}=0,"",O${totRij}/N${totRij})` }, "0.0%", true);
  info(r++, `Kostenplafond voor ${marge.minimum}% marge (minimum)`, 9, { formula: `F${totRij}*(1-${marge.minimum / 100})` }, EUR);
  info(r++, `Kostenplafond voor ${marge.doel}% marge (doel)`, 9, { formula: `F${totRij}*(1-${marge.doel / 100})` }, EUR);
  // Kleur: rood onder het minimum, oranje tot het doel, groen vanaf het doel.
  for (const pr of pctRijen) {
    ws.addConditionalFormatting({ ref: `I${pr}`, rules: [
      { type: "cellIs", operator: "lessThan", formulae: [marge.minimum / 100], style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFF4C7C3" } }, font: { color: { argb: "FFC00000" } } } },
      { type: "cellIs", operator: "between", formulae: [marge.minimum / 100, marge.doel / 100 - 0.0001], style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFCE8B2" } } } },
      { type: "cellIs", operator: "greaterThanOrEqual", formulae: [marge.doel / 100], style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFD9EAD3" } }, font: { color: { argb: "FF2D4A3E" } } } },
    ] });
  }
  if (offerte.totaal != null) info(r++, `Offertebedrag volgens PDF${offerte.klopt ? " (komt overeen met de posten)" : " — wijkt af van de som van de posten, controleer"}`, 6, offerte.totaal, EUR);
  ws.autoFilter = { from: "A5", to: `M${totRij - 2}` };
  return wb;
}

export function kostenBestandsnaam(offerte, projectNaam = "") {
  const basis = `Kostenoverzicht ${offerte.nummer || ""} ${projectNaam || offerte.betreft || ""}`.trim();
  return basis.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 _-]/g, "").replace(/\s+/g, "_").slice(0, 90) + ".xlsx";
}

// Compacte vorm om in het project te bewaren (omschrijvingen ingekort).
export function compacteSpecificatie(o) {
  return {
    nummer: o.nummer, datum: o.datum, betreft: o.betreft, totaal: o.totaal, somKopjes: o.somKopjes, klopt: o.klopt,
    tekst: String(o.tekst || "").slice(0, 8000), postnamen: o.postnamen,
    kopjes: o.kopjes.map(k => ({
      naam: k.naam, totaal: k.totaal, som: k.som,
      posten: k.posten.map(p => ({ naam: p.naam, omschrijving: String(p.omschrijving || "").slice(0, 300), aantal: p.aantal, eenheid: p.eenheid, prijs: p.prijs, totaal: p.totaal })),
    })),
  };
}

// Begroot tegenover werkelijk per kopje (werkelijk: { "kopje.post": bedrag }).
// eigen: Set met sleutels van eigen-werkposten (zie eigenPostSleutels).
export function specificatieStand(spec, werkelijk = {}, eigen = new Set()) {
  const r2 = (n) => Math.round(n * 100) / 100;
  const kopjes = (spec?.kopjes || []).map((k, ki) => {
    const posten = k.posten.map((p, pi) => ({ ...p, sleutel: `${ki}.${pi}`, eigen: eigen.has(`${ki}.${pi}`), werkelijk: werkelijk[`${ki}.${pi}`] ?? null }));
    const ingevuld = posten.filter(p => p.werkelijk != null);
    return {
      naam: k.naam, begroot: k.totaal, posten,
      werkelijk: ingevuld.length ? r2(ingevuld.reduce((s, p) => s + p.werkelijk, 0)) : null,
      verschil: ingevuld.length ? r2(ingevuld.reduce((s, p) => s + (p.totaal || 0) - p.werkelijk, 0)) : null,
      // Eigen werk kost niets extra (tenzij je toch een bedrag invult).
      // Korting (negatieve post) is minder omzet, geen lagere kosten.
      prognose: r2(posten.reduce((s, p) => s + (p.werkelijk ?? (p.eigen || (p.totaal || 0) < 0 ? 0 : p.totaal ?? 0)), 0)),
      ingevuld: ingevuld.length,
    };
  });
  const alle = kopjes.flatMap(k => k.posten);
  const begroot = r2(kopjes.reduce((s, k) => s + (k.begroot || 0), 0));
  const prognose = r2(kopjes.reduce((s, k) => s + k.prognose, 0));
  const inkoopIngevuld = alle.filter(p => p.werkelijk != null && !p.eigen);
  const begrootIngevuld = r2(inkoopIngevuld.reduce((t, p) => t + (p.totaal || 0), 0));
  const verschilInkoop = r2(inkoopIngevuld.reduce((t, p) => t + (p.totaal || 0) - p.werkelijk, 0));
  const verschil = r2(kopjes.reduce((s, k) => s + (k.verschil || 0), 0));
  const eigenTotaal = r2(alle.filter(p => p.eigen).reduce((s, p) => s + (p.totaal || 0), 0));
  const winst = r2(begroot - prognose);
  return {
    kopjes, begroot, prognose, begrootIngevuld, eigenTotaal,
    // Winst = eigen werk + wat je op ingekochte posten overhoudt. Posten
    // die nog niet zijn ingevuld tellen voorzichtig als "kost wat begroot is".
    winst, winstPct: begroot ? Math.round((1000 * winst) / begroot) / 10 : null,
    // Marge op wat er al is ingekocht — de toets voor je 20/25%.
    margeIngevuldPct: begrootIngevuld ? Math.round((1000 * verschilInkoop) / begrootIngevuld) / 10 : null,
    werkelijk: r2(kopjes.reduce((s, k) => s + (k.werkelijk || 0), 0)),
    verschil,
    ingevuld: kopjes.reduce((n, k) => n + k.ingevuld, 0),
    posten: kopjes.reduce((n, k) => n + k.posten.length, 0),
    marge: r2(begroot - prognose),
  };
}

// "Online commercial Keukenkampioen (algemene offerte) 4 binnenkijkers - 1 lange
// dag - 2 normale draaidagen" → "Online commercial Keukenkampioen 4 binnenkijkers"
export function korteProjectnaam(betreft, max = 60) {
  let t = String(betreft || "").split(/\s+[-–]\s+/)[0].replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  t = t.slice(0, max + 1);
  return t.slice(0, t.lastIndexOf(" ") > 20 ? t.lastIndexOf(" ") : max).trim();
}

// ════════════════════════════════════════════════════════════════════
// DE OFFERTE ALS LIJST VAN WAT ER GEREGELD MOET WORDEN
// Elke post voor crew, cast, locaties, hotel, catering en props wordt een
// open plek (naam nog leeg) bij het juiste onderdeel, met het begrote
// bedrag uit de offerte erbij. Dezelfde rol in meerdere kopjes (bv.
// cameraman voorbereiding + normale dagen + lange dag) is één persoon; een
// tweede dezelfde rol binnen één kopje (extra belichter) een tweede plek.
// Cast "2 stuks" = twee mensen. Vul je naam en prijs in, dan rekent de app
// de werkelijke kosten terug naar de posten van de offerte.
// ════════════════════════════════════════════════════════════════════
const TE_REGELEN = /^(crew-|loc-)|^(acteurs|edelfiguranten|figuranten|hotel|catering|props|decor|verzekering)$/;
const CAST = ["acteurs", "edelfiguranten", "figuranten"];
export function postOnderdeel(naam) {
  const t = String(naam || "").toLowerCase();
  for (const [id, re] of ONDERDEEL_WOORDEN) if (re.test(t)) return TE_REGELEN.test(id) ? id : null;
  return null;
}
// "Cameraman - senior (per uur) Voorbereiden" → "Cameraman"
const korteNaam = (n) => String(n || "").replace(/\([^)]*\)/g, " ").split(/\s+-\s+/)[0].replace(/\b(begroot|voorbereiden|productie)\s*$/i, "").replace(/^regiefee$/i, "Regie").replace(/\s+/g, " ").trim() || String(n || "");
const STUKS = /^(x|stuks?|st|prijs|keer|pp|p\.p\.|set|post)$/;
const familie = (e) => (e === "dag" || e === "dagen" ? "dag" : e === "uur" || e === "uren" ? "uur" : "stuk");
const r2 = (n) => Math.round(n * 100) / 100;
const euroKort = (n) => `€ ${Number(n || 0).toLocaleString("nl-NL", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function plekkenUitOfferte(spec) {
  const plekken = [];
  (spec?.kopjes || []).forEach((k, ki) => {
    const gezien = {};
    k.posten.forEach((p, pi) => {
      const id = postOnderdeel(p.naam);
      if (!id || !(p.totaal > 0)) return;
      const post = { sleutel: `${ki}.${pi}`, naam: p.naam, kopje: k.naam, aantal: p.aantal, eenheid: p.eenheid, prijs: p.prijs, totaal: p.totaal };
      if (CAST.includes(id)) {
        const n = STUKS.test(p.eenheid) ? Math.max(1, Math.round(p.aantal || 1)) : 1;
        const lbl = String(p.naam).replace(/\s*\bbegroot\b/i, "").trim();
        for (let j = 0; j < n; j++) plekken.push({ plekKey: `${id}|${ki}.${pi}#${j + 1}`, onderdeelId: id, label: n > 1 ? `${lbl} (${j + 1}/${n})` : lbl, posten: [{ ...post, aandeel: 1 / n }] });
        return;
      }
      // Crew/props/catering: per rol één plek; komt dezelfde rol twee keer
      // voor in één kopje, dan is dat een tweede persoon.
      const sleutel = id;
      // Drone (crew + toestel), catering en props: altijd één leverancier.
      gezien[sleutel] = ["crew-drone", "catering", "props", "decor"].includes(id) ? 1 : (gezien[sleutel] || 0) + 1;
      const plekKey = `${sleutel}#${gezien[sleutel]}`;
      const bestaand = plekken.find(x => x.plekKey === plekKey);
      if (bestaand) bestaand.posten.push({ ...post, aandeel: 1 });
      else plekken.push({ plekKey, onderdeelId: id, label: korteNaam(p.naam) + (gezien[sleutel] > 1 ? ` (${gezien[sleutel]})` : ""), posten: [{ ...post, aandeel: 1 }] });
    });
  });
  return plekken.map(pl => {
    const begroot = r2(pl.posten.reduce((s, p) => s + p.totaal * p.aandeel, 0));
    // Eenheid van de grootste post; aantal = som van posten met die eenheid.
    const hoofd = [...pl.posten].sort((a, b) => b.totaal - a.totaal)[0];
    const fam = familie(hoofd.eenheid);
    const som = r2(pl.posten.filter(p => familie(p.eenheid) === fam).reduce((s, p) => s + (p.aantal || 0), 0));
    // Eén stuk/prijs (bv. regiefee, 1 edelfigurant) = een totaalbedrag.
    const eenheid = (CAST.includes(pl.onderdeelId) && fam === "stuk") || (fam === "stuk" && som <= 1) ? "totaal" : fam;
    const aantal = eenheid === "totaal" ? null : som;
    const tekst = pl.posten.map(p => (CAST.includes(pl.onderdeelId) && p.aandeel < 1 ? `1 × ${euroKort(p.prijs)}` : `${p.aantal} ${p.eenheid} × ${euroKort(p.prijs)}`)).join(" + ");
    return { ...pl, begroot, eenheid, aantal, tekst };
  });
}

// Open plekken toevoegen aan de juiste taken. Idempotent (zelfde plek niet
// twee keer). Plekken voor een onderdeel dat niet aan staat worden
// overgeslagen (en geteld), zodat je keuze bij de start blijft staan.
export function vulBezettingUitOfferte(lijst, spec, { nieuwId }) {
  const p = lijst.project || {};
  let toegevoegd = 0, overgeslagen = 0;
  const plekken = plekkenUitOfferte(spec);
  let items = [...(lijst.items || [])];
  for (const pl of plekken) {
    const doelId = /^crew-/.test(pl.onderdeelId) ? "crew" : pl.onderdeelId;
    const idx = items.findIndex(i => i.onderdeelId === doelId && !i.checked);
    const taak = items[idx];
    const crewRolAan = doelId !== "crew" || (taak?.substappen || []).some(s => s.rolId === pl.onderdeelId);
    if (idx < 0 || !crewRolAan) { overgeslagen++; continue; }
    if ((taak.bezetting || []).some(b => b.offerte?.plekKey === pl.plekKey)) continue;
    const b = nieuweBezetting({
      onderdeelId: pl.onderdeelId, eenheid: pl.eenheid, aantal: pl.aantal,
      buyouts: standaardBuyouts(p.deliverables, pl.onderdeelId),
      offerte: { plekKey: pl.plekKey, label: pl.label, begroot: pl.begroot, tekst: pl.tekst, posten: pl.posten.map(x => ({ sleutel: x.sleutel, aandeel: x.aandeel })) },
    }, nieuwId);
    items[idx] = { ...taak, bezetting: [...(taak.bezetting || []), b] };
    toegevoegd++;
  }
  return { lijst: { ...lijst, items }, toegevoegd, overgeslagen, nodigeOnderdelen: [...new Set(plekken.map(pl => pl.onderdeelId))] };
}

// Werkelijke kosten per offertepost, afgeleid uit de ingevulde namen en
// prijsafspraken (prijs × aantal + buy-outs), naar rato verdeeld over de
// posten van die plek.
export function werkelijkUitBezetting(lijst, spec) {
  const n = draaidagenVan(lijst.project || {}).length || 1;
  const uit = {};
  for (const i of lijst.items || []) {
    for (const b of i.bezetting || []) {
      if (!b.offerte?.posten?.length || b.bedrag == null) continue;
      const kosten = bezettingKosten(b, n).totaal;
      const gewichten = b.offerte.posten.map(x => {
        const [ki, pi] = x.sleutel.split(".").map(Number);
        return (spec?.kopjes?.[ki]?.posten?.[pi]?.totaal || 0) * (x.aandeel ?? 1);
      });
      const totaalGewicht = gewichten.reduce((s, g) => s + g, 0) || b.offerte.posten.length;
      b.offerte.posten.forEach((x, j) => {
        const deel = totaalGewicht ? (gewichten[j] || (gewichten.every(g => !g) ? 1 : 0)) / totaalGewicht : 0;
        uit[x.sleutel] = r2((uit[x.sleutel] || 0) + kosten * deel);
      });
    }
  }
  return uit;
}

// ── Eigen werk ────────────────────────────────────────────────────────
// Posten die je zelf doet (geen inkoop): die bedragen blijven bij jou.
// Eerste gok op naam; wat je per post aan/uit zet onthoudt de app (per
// postnaam) voor de volgende offertes.
const EIGEN_GOK = /projectbegeleiding|productiefee|productie ?fee|co[öo]rdinatie|offerte|monteren|montage|\bedit(en|ing)?\b|kleurcorr|grading|animeren|animatie|motion|omzetten|exporteren|export|ondertitel|versies|opmaak|deliverables? (maken|opleveren)/i;
const GEEN_EIGEN = /afmix|geluidsstudio|voice|stem|muziek|licentie|huur|set\b|kosten|catering|reis|transport|verzekering/i;
export const postNaamSleutel = (naam) => String(naam || "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
export function isEigenPost(naam, kopje = "") {
  return EIGEN_GOK.test(naam) && !GEEN_EIGEN.test(naam);
}
// overrides: { "ki.pi": true/false } in dit project; geleerd: { postnaam: true/false }.
export function eigenPostSleutels(spec, overrides = {}, geleerd = {}) {
  const uit = new Set();
  (spec?.kopjes || []).forEach((k, ki) => k.posten.forEach((p, pi) => {
    const s = `${ki}.${pi}`;
    const keuze = overrides[s] ?? geleerd[postNaamSleutel(p.naam)] ?? isEigenPost(p.naam, k.naam);
    if (keuze && p.totaal > 0) uit.add(s);
  }));
  return uit;
}

// ════════════════════════════════════════════════════════════════════
// NACALCULATIE — bij het afronden vastleggen hoe de offerte uitpakte, en
// over meerdere projecten zien welke posten structureel duurder of
// goedkoper uitvallen ("catering kwam de laatste 3 keer 15% hoger uit").
// ════════════════════════════════════════════════════════════════════
export function postCategorie(naam) {
  const id = postOnderdeel(naam);
  if (id) return id;
  return korteNaam(naam).toLowerCase();
}
export function maakNacalculatie(spec, werkelijk = {}, eigen = new Set(), { datum = null } = {}) {
  const st = specificatieStand(spec, werkelijk, eigen);
  const posten = st.kopjes.flatMap(k => k.posten)
    .filter(p => p.werkelijk != null && !p.eigen && (p.totaal || 0) > 0)
    .map(p => ({ naam: p.naam, categorie: postCategorie(p.naam), begroot: p.totaal, werkelijk: p.werkelijk, verschilPct: Math.round((1000 * (p.werkelijk - p.totaal)) / p.totaal) / 10 }));
  return {
    datum, offerte: st.begroot, kosten: st.prognose, winst: st.winst, winstPct: st.winstPct,
    margeInkoopPct: st.margeIngevuldPct, eigenWerk: st.eigenTotaal, ingevuld: st.ingevuld, posten,
  };
}
// Over alle afgeronde projecten: per categorie het gemiddelde verschil
// tussen werkelijk en begroot (alleen bij minstens `minimum` projecten).
export function nacalculatieInzichten(lijsten, { minimum = 2 } = {}) {
  const per = {};
  for (const l of lijsten || []) {
    const n = l.project?.nacalculatie;
    if (!n?.posten?.length) continue;
    const dezeKeer = {};
    for (const p of n.posten) {
      const c = (dezeKeer[p.categorie] ||= { begroot: 0, werkelijk: 0, naam: p.naam });
      c.begroot += p.begroot; c.werkelijk += p.werkelijk;
    }
    for (const [cat, c] of Object.entries(dezeKeer)) {
      (per[cat] ||= { categorie: cat, naam: c.naam, projecten: [] }).projecten.push({ project: l.name, pct: Math.round((1000 * (c.werkelijk - c.begroot)) / c.begroot) / 10 });
    }
  }
  return Object.values(per)
    .filter(x => x.projecten.length >= minimum)
    .map(x => ({ ...x, aantal: x.projecten.length, gemiddeldPct: Math.round((10 * x.projecten.reduce((s, p) => s + p.pct, 0)) / x.projecten.length) / 10 }))
    .sort((a, b) => Math.abs(b.gemiddeldPct) - Math.abs(a.gemiddeldPct));
}
// Welke inzichten gelden voor de posten in deze (nieuwe) offerte?
export function inzichtenVoorOfferte(spec, inzichten, { drempel = 5 } = {}) {
  const cats = new Set((spec?.kopjes || []).flatMap(k => k.posten.filter(p => p.totaal > 0).map(p => postCategorie(p.naam))));
  return (inzichten || []).filter(i => cats.has(i.categorie) && Math.abs(i.gemiddeldPct) >= drempel);
}

// ════════════════════════════════════════════════════════════════════
// CIJFERS — overzicht over al je projecten in een jaar: omzet uit akkoord
// gegeven offertes (per maand), scoringskans, gemiddelde winst, waarde van
// openstaande offertes, klanten en redenen van afwijzing.
// ════════════════════════════════════════════════════════════════════
const jaarVan = (d) => (d ? Number(String(d).slice(0, 4)) : null);
const maandVan = (d) => (d ? Number(String(d).slice(5, 7)) - 1 : null);
// Winst van één project: de nacalculatie als die er is, anders de actuele stand.
export function projectWinst(l, eigenGeleerd = {}) {
  const p = l.project || {};
  if (p.nacalculatie) return { winst: p.nacalculatie.winst, offerte: p.nacalculatie.offerte, definitief: true };
  const o = p.offerte;
  if (!o?.specificatie) return null;
  const werkelijk = { ...werkelijkUitBezetting(l, o.specificatie), ...(o.werkelijk || {}) };
  const st = specificatieStand(o.specificatie, werkelijk, eigenPostSleutels(o.specificatie, o.eigen || {}, eigenGeleerd));
  return { winst: st.winst, offerte: st.begroot, definitief: false };
}
export function projectCijfers(lijsten, { jaar, klanten = [], eigenGeleerd = {} } = {}) {
  const projecten = (lijsten || []).filter(l => l.project);
  const r2 = (n) => Math.round(n * 100) / 100;
  const maanden = Array.from({ length: 12 }, (_, m) => ({ maand: m, omzet: 0, akkoord: 0, verstuurd: 0 }));
  const akkoord = projecten.filter(l => jaarVan(l.project.offerte?.akkoordOp) === jaar);
  const afgewezen = projecten.filter(l => jaarVan(l.project.offerte?.afgewezenOp) === jaar);
  const verstuurd = projecten.filter(l => jaarVan(l.project.offerte?.verstuurdOp) === jaar);
  for (const l of akkoord) { const m = maanden[maandVan(l.project.offerte.akkoordOp)]; m.omzet = r2(m.omzet + (l.project.offerte.bedrag || 0)); m.akkoord++; }
  for (const l of verstuurd) maanden[maandVan(l.project.offerte.verstuurdOp)].verstuurd++;
  const omzet = r2(akkoord.reduce((s, l) => s + (l.project.offerte.bedrag || 0), 0));
  const beslist = akkoord.length + afgewezen.length;
  const bedragBeslist = r2([...akkoord, ...afgewezen].reduce((s, l) => s + (l.project.offerte.bedrag || 0), 0));
  const open = projecten.filter(l => projectStatus(l) === "offerte" && !l.project.afgerond);
  // Winst: alleen projecten met ingelezen offerte of nacalculatie.
  const metWinst = akkoord.map(l => projectWinst(l, eigenGeleerd)).filter(Boolean);
  const winst = r2(metWinst.reduce((s, w) => s + w.winst, 0));
  const winstBasis = r2(metWinst.reduce((s, w) => s + w.offerte, 0));
  // Klanten
  const perKlant = {};
  for (const l of [...akkoord, ...afgewezen]) {
    const id = l.project.klantId || "geen";
    const k = (perKlant[id] ||= { klantId: id, naam: klanten.find(x => x.id === id)?.naam || "Zonder klant", omzet: 0, akkoord: 0, afgewezen: 0 });
    if (l.project.offerte.akkoordOp && jaarVan(l.project.offerte.akkoordOp) === jaar) { k.omzet = r2(k.omzet + (l.project.offerte.bedrag || 0)); k.akkoord++; } else k.afgewezen++;
  }
  const redenen = {};
  for (const l of afgewezen) { const r = String(l.project.offerte.reden || "").trim() || "Geen reden opgegeven"; redenen[r] = (redenen[r] || 0) + 1; }
  return {
    jaar, maanden, omzet,
    akkoord: akkoord.length, afgewezen: afgewezen.length, verstuurd: verstuurd.length,
    scoringPct: beslist ? Math.round((100 * akkoord.length) / beslist) : null,
    scoringBedragPct: bedragBeslist ? Math.round((100 * omzet) / bedragBeslist) : null,
    openAantal: open.length, openWaarde: r2(open.reduce((s, l) => s + (l.project.offerte?.bedrag || 0), 0)),
    winst, winstPct: winstBasis ? Math.round((1000 * winst) / winstBasis) / 10 : null, winstProjecten: metWinst.length,
    gemiddeldeOfferte: akkoord.length ? r2(omzet / akkoord.length) : null,
    klanten: Object.values(perKlant).sort((a, b) => b.omzet - a.omzet),
    redenen: Object.entries(redenen).map(([reden, aantal]) => ({ reden, aantal })).sort((a, b) => b.aantal - a.aantal),
  };
}
export function cijferJaren(lijsten, huidigJaar) {
  const jaren = new Set([huidigJaar]);
  for (const l of lijsten || []) for (const d of [l.project?.offerte?.akkoordOp, l.project?.offerte?.verstuurdOp, l.project?.offerte?.afgewezenOp]) if (d) jaren.add(jaarVan(d));
  return [...jaren].sort((a, b) => b - a);
}
