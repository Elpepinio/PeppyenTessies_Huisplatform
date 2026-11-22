const fs = require("fs");
const path = require("path");
const { sectie, test, samenvatting } = require("./testhulp.js");
const lees = (f) => fs.readFileSync(path.join(__dirname, "../lib", f), "utf8").replace(/^import [\s\S]*?;$/gm, "").replace(/^export /gm, "");
const bron = ["taken-logica.js", "projecten-logica.js", "intake-logica.js", "offerte-pdf-logica.js"].map(lees).join("\n");
const namen = [...new Set([...bron.matchAll(/^(?:function|const) ([A-Za-z_]\w*)/gm)].map(m => m[1]))];
const L = new Function(`${bron}\nreturn { ${namen.join(", ")} };`)();
let ExcelJS = null;
try { ExcelJS = require("exceljs"); } catch { /* overslaan */ }

// Nagebootste pdf.js-uitvoer van een EOS-offerte: kopjes springen minder in
// (x=120) dan posten (x=135); kolommen aantal/prijs/totaal rechts.
const stuk = (str, x, y) => ({ str, x, y, w: str.length * 4 });
const kostregel = (y, x, naam, aantal, prijs, totaal, euroBijPrijs) => [
  stuk(naam, x, y), stuk(aantal, 372, y), ...(euroBijPrijs ? [stuk("€", 428, y), stuk(prijs, 436, y)] : [stuk(prijs, 433, y)]), stuk(`€ ${totaal}`, 492, y),
];
const pagina1 = [
  stuk("Offerte", 9, 628), stuk("Contact", 34, 58), stuk("info@fullframe.nl", 76, 46),
  stuk("T.a.v.", 35, 575), stuk("Bureau X", 35, 563),
  stuk("Betreft", 35, 470), stuk("Online commercial", 35, 458), stuk("Keukens - 2 draaidagen", 35, 446),
  stuk("Offertedatum", 35, 420), stuk("4 september 2026", 35, 408),
  stuk("Offertenummer", 35, 390), stuk("9780", 35, 378),
  stuk("Doel", 220, 572), stuk("We gaan uit van 2 draaidagen. Deliverables 16:9 en 9x16 online.", 220, 558),
  stuk("Scheepens is verantwoordelijk voor: Fotograaf", 220, 540),
];
const pagina2 = [
  stuk("Specificatie", 120, 600), stuk("Aantal", 372, 590), stuk("Prijs", 440, 590), stuk("Totaal", 500, 590),
  ...kostregel(570, 120, "Regie", "1x", "9.500,00", "9.500,00", false),
  stuk("Hierin worden de kosten van de regisseur omschreven", 120, 558),
  ...kostregel(545, 135, "Regiefee", "1 prijs", "9.500,00", "9.500,00", true),
  ...kostregel(520, 120, "Productie (Commercial materiaal normale", "2 dag.", "1.350,00", "2.700,00", false),
  stuk("draaidag)", 120, 508),
  ...kostregel(495, 135, "Cameraset", "2 dag.", "1.000,00", "2.000,00", true),
  stuk("Cinema camera. Inclusief follow focus.", 135, 483),
  ...kostregel(470, 135, "Geluidsset", "2 dag", "350,00", "700,00", true),
  ...kostregel(445, 120, "Postproductie", "1x", "1.587,50", "1.587,50", false),
  ...kostregel(432, 135, "Monteren Postproductie", "18 uur", "80,00", "1.440,00", true),
  ...kostregel(419, 135, "Omzetten MXF", "1.25 stuks", "150,00", "187,50", true),
  ...kostregel(406, 135, "Belichter (dagprijs)", "1 dag", "-40,00", "-40,00", true),
  ...kostregel(380, 120, "Korting", "1x", "-200,00", "-200,00", false),
  ...kostregel(367, 135, "Korting", "1 prijs", "-200,00", "-200,00", true),
  stuk("Contact +31 (0) 13 534 09 88", 34, 58),
];
const pagina3 = [stuk("Totaal exclusief BTW", 380, 600), stuk("€ 13.587,50", 492, 600)];

sectie("Offerte-PDF — specificatie uitlezen");
const regels = L.regelsUitOffertePdf([pagina1, pagina2, pagina3]);
const o = L.leesOfferte(regels);
test("bedragen: duizendpunt + komma, min, €", L.leesEuro("9.500,00") === 9500 && L.leesEuro("€ -2.100,00") === -2100 && L.leesEuro("350,00") === 350 && L.leesEuro("abc") === null);
test("aantallen met punt als decimaal", L.leesAantal("1.25") === 1.25 && L.leesAantal("5.5") === 5.5);
test("nummer, datum en betreft uit de linkerkolom", o.nummer === "9780" && o.datum === "4 september 2026" && o.betreft === "Online commercial Keukens - 2 draaidagen");
test("vier kopjes", o.kopjes.map(k => k.naam).join("|") === "Regie|Productie (Commercial materiaal normale draaidag)|Postproductie|Korting");
test("afgebroken kopnaam aan elkaar", o.kopjes[1].naam.endsWith("draaidag)"));
test("posten met aantal, eenheid, prijs en totaal", (() => { const p = o.kopjes[1].posten[0]; return p.naam === "Cameraset" && p.aantal === 2 && p.eenheid === "dag" && p.prijs === 1000 && p.totaal === 2000; })());
test("omschrijving bij post en kopje", /follow focus/.test(o.kopjes[1].posten[0].omschrijving) && /regisseur/.test(o.kopjes[0].omschrijving));
test("1.25 stuks × 150 = 187,50", o.kopjes[2].posten[1].aantal === 1.25 && o.kopjes[2].posten[1].totaal === 187.5);
test("totaal uit de PDF en controle op de som", o.totaal === 13587.5 && o.klopt && o.aantalPosten === 7);
test("tekst vóór de specificatie apart (voor de herkenning)", /2 draaidagen/.test(o.tekst) && !/Cameraset/.test(o.tekst));
test("voettekst valt weg", !regels.some(r => /info@fullframe/.test(r.tekst)));
test("klopt=false als som afwijkt", L.leesOfferte([...regels.slice(0, -1), { tekst: "Totaal exclusief BTW € 99.999,00", x: 380, pagina: 3 }]).klopt === false);
test("zonder inspringing: kopje herkend aan prijs zonder €", (() => { const x = L.leesOfferte(["Specificatie", "Crew 1x 500,00 € 500,00", "Camera 1 dag € 500,00 € 500,00", "Totaal exclusief BTW € 500,00"]); return x.kopjes.length === 1 && x.kopjes[0].posten[0].naam === "Camera"; })());

sectie("Offerte-PDF — herkenning voor het project");
const h = L.herkenUitOfferte(L.compacteSpecificatie(o), { vandaag: "2026-11-22" });
test("draaidagen en deliverables uit de tekst", h.draaidagen === 2 && h.deliverables.online.includes("9x16"));
test("geen fotograaf: staat alleen bij 'verantwoordelijk' van het bureau", !h.onderdelen.includes("crew-fotografie") && !h.deliverables.fotografie);
test("post door ons (postproductie in de posten)", h.postDoorOns === true && h.onderdelen.includes("edit-v1"));
test("crew uit de postnamen", h.onderdelen.includes("crew-belichter") && h.onderdelen.includes("crew-regie"));
test("budget = offertetotaal", h.budget === 13587.5);

sectie("Marge-doel (standaard minimaal 20%, streven 25%)");
test("status: goed / krap / te laag", L.margeStatus(26) === "goed" && L.margeStatus(22) === "krap" && L.margeStatus(19.9) === "te-laag" && L.margeStatus(null) === null);
test("eigen doel", L.margeStatus(16, { minimum: 15, doel: 30 }) === "krap");
test("doel nooit onder het minimum", L.normaliseerMarge({ minimum: 30, doel: 10 }).doel === 30);
test("kostenplafond: 100.000 bij 20% → 80.000", L.kostenPlafond(100000, 20) === 80000 && L.kostenPlafond(96847.5, 25) === 72635.63);
test("korte projectnaam uit 'betreft'", L.korteProjectnaam("Online commercial Keukenkampioen (algemene offerte) 4 binnenkijkers - 1 lange dag - 2 normale draaidagen") === "Online commercial Keukenkampioen 4 binnenkijkers");

sectie("Nacalculatie");
const specN = L.compacteSpecificatie(o);
const nac = L.maakNacalculatie(specN, { "1.0": 1600, "1.1": 770, "2.0": 900 }, L.eigenPostSleutels(specN), { datum: "2026-12-20" });
test("eigen werk niet in de nacalculatie-posten", nac.posten.length === 2 && !nac.posten.some(p => /Monteren/.test(p.naam)));
test("verschil per post in %", nac.posten.find(p => p.naam === "Geluidsset").verschilPct === 10 && nac.posten.find(p => p.naam === "Cameraset").verschilPct === -20);
test("categorie via de rol, anders korte naam", L.postCategorie("Cateringskosten begroot") === "catering" && L.postCategorie("Cameraman - senior") === "crew-camera" && L.postCategorie("Cameraset") === "cameraset");
const projN = (naam, cat, b, w) => ({ name: naam, project: { nacalculatie: { posten: [{ naam: "Catering", categorie: cat, begroot: b, werkelijk: w }] } } });
const inz = L.nacalculatieInzichten([projN("A", "catering", 1000, 1100), projN("B", "catering", 2000, 2400), projN("C", "props", 500, 450)]);
test("inzicht: catering gemiddeld +15% over 2 projecten; props (1×) nog niet", inz.length === 1 && inz[0].categorie === "catering" && inz[0].gemiddeldPct === 15 && inz[0].aantal === 2);
const specCat = L.compacteSpecificatie(L.leesOfferte(["Specificatie", { tekst: "Overig 1x 1.000,00 € 1.000,00", x: 120 }, { tekst: "Cateringskosten 20 prijs € 50,00 € 1.000,00", x: 135 }, { tekst: "Totaal exclusief BTW € 1.000,00", x: 380 }]));
test("inzicht getoond bij een nieuwe offerte met catering", L.inzichtenVoorOfferte(specCat, inz).length === 1 && L.inzichtenVoorOfferte(specN, inz).length === 0);

sectie("Cijfers over het jaar");
const pl = (naam, o, extra = {}) => ({ name: naam, project: { status: o.akkoordOp ? "lopend" : o.afgewezenOp ? "afgewezen" : "offerte", klantId: extra.klantId || "kk", offerte: o, ...extra } });
const lijstenC = [
  pl("A", { verstuurdOp: "2026-01-10", akkoordOp: "2026-02-01", bedrag: 20000 }, { nacalculatie: { winst: 5000, offerte: 20000 } }),
  pl("B", { verstuurdOp: "2026-03-01", akkoordOp: "2026-03-20", bedrag: 10000 }, { klantId: "hk", nacalculatie: { winst: 1500, offerte: 10000 } }),
  pl("C", { verstuurdOp: "2026-04-01", afgewezenOp: "2026-04-20", bedrag: 30000, reden: "Te duur" }),
  pl("D", { verstuurdOp: "2026-11-01", bedrag: 15000 }),
  pl("E", { verstuurdOp: "2025-11-01", akkoordOp: "2025-12-01", bedrag: 99000 }),
];
const cf = L.projectCijfers(lijstenC, { jaar: 2026, klanten: [{ id: "kk", naam: "Keuken Kampioen" }, { id: "hk", naam: "Häcker" }] });
test("omzet uit akkoord in dit jaar (niet vorig jaar)", cf.omzet === 30000 && cf.akkoord === 2 && cf.maanden[1].omzet === 20000 && cf.maanden[2].omzet === 10000);
test("scoringskans: 2 van 3 beslist; op bedrag 30k van 60k", cf.scoringPct === 67 && cf.scoringBedragPct === 50);
test("open offertes: aantal en waarde", cf.openAantal === 1 && cf.openWaarde === 15000);
test("winst uit nacalculaties: 6.500 op 30.000 = 21,7%", cf.winst === 6500 && cf.winstPct === 21.7 && cf.winstProjecten === 2);
test("klanten op omzet, met afwijzingen", cf.klanten[0].naam === "Keuken Kampioen" && cf.klanten[0].omzet === 20000 && cf.klanten[0].afgewezen === 1);
test("redenen van afwijzing", cf.redenen[0].reden === "Te duur");
test("jaren met data", L.cijferJaren(lijstenC, 2026).join() === "2026,2025");

sectie("Sjabloon voorstellen bij akkoord");
const SJ = L.STANDAARD_SJABLONEN;
test("zonder geschiedenis: € 96.847 → groot", L.kiesSjabloon(SJ, [], { bedrag: 96847.5 }).id === "commercial-groot");
test("zonder geschiedenis: € 8.000 en 1 dag → klein", L.kiesSjabloon(SJ, [], { bedrag: 8000, draaidagen: 1 }).id === "commercial-klein");
test("zonder geschiedenis: 2 draaidagen → groot", L.kiesSjabloon(SJ, [], { draaidagen: 2 }).id === "commercial-groot");
const hist = [12000, 15000, 14000, 60000, 80000].map((b, i) => ({ project: { sjabloonId: b > 20000 ? "commercial-groot" : "commercial-klein", offerte: { bedrag: b }, status: "lopend" } }));
test("met geschiedenis: € 13.000 lijkt op je kleine projecten → klein", (() => { const r = L.kiesSjabloon(SJ, hist, { bedrag: 13000 }); return r.id === "commercial-klein" && /vergelijkbare/.test(r.reden); })());
test("met geschiedenis: € 70.000 → groot", L.kiesSjabloon(SJ, hist, { bedrag: 70000 }).id === "commercial-groot");
test("niets bekend → eerste sjabloon, geen reden", L.kiesSjabloon(SJ, [], {}).reden === null);

sectie("Offerte-PDF — begroot tegenover werkelijk");
const spec = L.compacteSpecificatie(o);
const st = L.specificatieStand(spec, { "1.0": 1800, "2.0": 1600 });
test("per kopje werkelijk en verschil", st.kopjes[1].werkelijk === 1800 && st.kopjes[1].verschil === 200 && st.kopjes[2].verschil === -160);
test("zonder eigen werk: marge op ingevulde posten (200−160)/(2000+1440) = 1,2%", st.margeIngevuldPct === 1.2 && st.begrootIngevuld === 3440);
test("korting is geen kostenbesparing: prognose zonder de −200", st.prognose === 13587.5 + 40 + 200 - 200 + 160);

sectie("Eigen werk telt als winst");
test("gok op naam: montage/projectbegeleiding wel, afmixen/cameraset niet", L.isEigenPost("Monteren Postproductie") && L.isEigenPost("Projectbegeleiding en communicatie") && L.isEigenPost("Productiefee") && !L.isEigenPost("Afmixen") && !L.isEigenPost("Cameraset") && !L.isEigenPost("Cameraman - senior"));
const eigen = L.eigenPostSleutels(spec);
test("in de testofferte: monteren eigen werk", eigen.has("2.0") && !eigen.has("1.0"));
test("keuze per project wint, daarna wat geleerd is", L.eigenPostSleutels(spec, { "2.0": false }).has("2.0") === false && L.eigenPostSleutels(spec, {}, { cameraset: true }).has("1.0"));
const st2 = L.specificatieStand(spec, {}, eigen);
test("eigen werk kost niets: winst = eigen werk − kortingen", st2.eigenTotaal === 1627.5 && st2.winst === 1627.5 - 40 - 200);
const st3 = L.specificatieStand(spec, { "1.0": 1600 }, eigen);
test("marge op ingekochte posten: cameraset 2.000 → 1.600 = 20%", st3.margeIngevuldPct === 20 && st3.winst === 1627.5 - 240 + 400);

sectie("Offerte → wat er geregeld moet worden");
const spec2 = L.compacteSpecificatie(L.leesOfferte([
  "Specificatie",
  { tekst: "Preproductie 1x 1.390,00 € 1.390,00", x: 120 },
  { tekst: "Cameraman - senior (per uur) Voorbereiden 6 uur € 90,00 € 540,00", x: 135 },
  { tekst: "Producer 1 dag € 850,00 € 850,00", x: 135 },
  { tekst: "Productie (crew lange draaidag) 1 dag 3.400,00 € 3.400,00", x: 120 },
  { tekst: "Cameraman - high end (dagprijs) 1 dag € 1.000,00 € 1.000,00", x: 135 },
  { tekst: "Belichter - senior (dagprijs) 1 dag € 850,00 € 850,00", x: 135 },
  { tekst: "Belichter (dagprijs) 1 dag € 700,00 € 700,00", x: 135 },
  { tekst: "Cameraset 1 dag € 850,00 € 850,00", x: 135 },
  { tekst: "Casting 1 prijs 7.200,00 € 7.200,00", x: 120 },
  { tekst: "Edelfigurant Binnenkijker 01 begroot 2 stuks € 1.600,00 € 3.200,00", x: 135 },
  { tekst: "Figuranten 3 stuks € 1.350,00 € 4.050,00", x: 135 },
  { tekst: "Regiefee 1 prijs € -50,00 € -50,00", x: 135 },
  { tekst: "Totaal exclusief BTW € 11.990,00", x: 380 },
].map(r => (typeof r === "string" ? { tekst: r, x: 120 } : r))));
const plekken = L.plekkenUitOfferte(spec2);
const vind = (label) => plekken.find(p => p.label === label);
test("cameraman: voorbereiding + draaidag = één plek", vind("Cameraman") && vind("Cameraman").posten.length === 2 && vind("Cameraman").begroot === 1540 && vind("Cameraman").eenheid === "dag" && vind("Cameraman").aantal === 1);
test("tweede belichter in hetzelfde kopje = tweede plek", vind("Belichter") && vind("Belichter (2)") && vind("Belichter (2)").begroot === 700);
test("apparatuur (cameraset) is geen plek", !plekken.some(p => /cameraset/i.test(p.label)));
test("cast '2 stuks' = twee mensen à € 1.600", plekken.filter(p => p.onderdeelId === "edelfiguranten").length === 2 && plekken.filter(p => p.onderdeelId === "edelfiguranten").every(p => p.begroot === 1600 && p.eenheid === "totaal"));
test("3 figuranten", plekken.filter(p => p.onderdeelId === "figuranten").length === 3);
test("negatieve posten (korting) geen plek", !plekken.some(p => p.begroot <= 0));
test("drone crew + drone = één plek bij de rol Drone", (() => {
  const s = L.compacteSpecificatie(L.leesOfferte(["Specificatie", { tekst: "Drone crew 1x 2.750,00 € 2.750,00", x: 120 }, { tekst: "Drone Crew 1 dag € 1.750,00 € 1.750,00", x: 135 }, { tekst: "Drone 1 dag € 1.000,00 € 1.000,00", x: 135 }, { tekst: "Totaal exclusief BTW € 2.750,00", x: 380 }]));
  const pl = L.plekkenUitOfferte(s);
  return pl.length === 1 && pl[0].onderdeelId === "crew-drone" && pl[0].begroot === 2750 && L.onderdeelVan("crew-drone").label.startsWith("Drone");
})());
let proj = L.maakProjectUitSjabloon(L.STANDAARD_SJABLONEN[1], { naam: "P", draaidag: "2026-12-10", opleverdatum: "2026-12-24", vandaag: "2026-11-22", nieuwId: (() => { let i = 0; return () => `n${++i}`; })() });
let nid = 100; const nieuwId2 = () => `b${++nid}`;
proj = L.pasOnderdelenToe(proj, ["crew-camera", "crew-belichter", "edelfiguranten", "figuranten"], { vandaag: "2026-11-22", deliverables: { tvc: ["16x9"], online: ["9x16"] }, nieuwId: nieuwId2 });
const r = L.vulBezettingUitOfferte(proj, spec2, { nieuwId: nieuwId2 });
const bez = r.lijst.items.flatMap(i => i.bezetting || []);
test("open plekken bij de juiste taken (producer staat uit → overgeslagen)", r.toegevoegd === 8 && r.overgeslagen === 1 && bez.every(b => b.naam === "" && b.offerte));
test("buy-outs voor cast klaargezet volgens deliverables", bez.find(b => b.onderdeelId === "edelfiguranten").buyouts.length === 2);
test("nog een keer = niets dubbel", L.vulBezettingUitOfferte(r.lijst, spec2, { nieuwId: nieuwId2 }).toegevoegd === 0);
// Namen + prijzen invullen → werkelijke kosten per post
const ingevuld = { ...r.lijst, items: r.lijst.items.map(i => ({ ...i, bezetting: (i.bezetting || []).map(b => (b.offerte.label === "Cameraman" ? { ...b, naam: "Tom", bedrag: 900, aantal: 1.5 } : b.onderdeelId === "edelfiguranten" ? { ...b, naam: "X", bedrag: 1500, buyouts: [] } : b)) })) };
const w = L.werkelijkUitBezetting(ingevuld, spec2);
test("cameraman 1,5 × 900 = 1.350, verdeeld naar rato over voorbereiding en draaidag", w["0.0"] === 473.38 && w["1.0"] === 876.62);
test("twee edelfiguranten op één post opgeteld", w["2.0"] === 3000);
test("zonder prijs geen werkelijk", w["1.1"] === undefined);

if (ExcelJS) {
  sectie("Offerte-PDF — Excel kostenoverzicht");
  const wb = L.maakKostenWerkboek(o, ExcelJS, { projectNaam: "Keukens", klantNaam: "Keuken Kampioen", werkelijk: { "1.0": 1800 } });
  const ws = wb.worksheets[0];
  const kop = ws.getRow(5).values.slice(1).join("|");
  test("kolommen", kop === "Post|Omschrijving|Aantal|Eenheid|Prijs|Begroot|Werkelijk|Verschil|Prognose|Leverancier / naam|Betaald|Opmerking|Eigen werk");
  test("titel", ws.getCell("A1").value === "KOSTENOVERZICHT KEUKEN KAMPIOEN – KEUKENS");
  let camRij = 0; ws.eachRow((r, n) => { if (r.getCell(1).value === "Cameraset") camRij = n; });
  test("begroot = aantal × prijs als formule", ws.getCell(`F${camRij}`).value.formula === `C${camRij}*E${camRij}`);
  test("werkelijk ingevuld uit de app", ws.getCell(`G${camRij}`).value === 1800);
  test("verschil en prognose als formule (eigen werk/korting = 0)", /F\d+-G\d+/.test(ws.getCell(`H${camRij}`).value.formula) && /M\d+="ja",F\d+<0\),0,F\d+\),G\d+/.test(ws.getCell(`I${camRij}`).value.formula));
  let montRij = 0; ws.eachRow((r, n) => { if (r.getCell(1).value === "Monteren Postproductie") montRij = n; });
  test("eigen werk: monteren = ja, cameraset = nee", ws.getCell(`M${montRij}`).value === "ja" && ws.getCell(`M${camRij}`).value === "nee");
  test("subtotaal per kopje", ws.getCell(`F${camRij - 1}`).value.formula.startsWith("SUM(F"));
  let margeOk = false; ws.eachRow(r => { if (r.getCell(1).value === "Verwachte winst (eigen werk + marge op inkoop)") margeOk = /F\d+-I\d+/.test(r.getCell(9).value.formula); });
  test("verwachte marge", margeOk);
  test("betaald: keuzelijst ja/nee/deels", ws.getCell(`K${camRij}`).dataValidation?.formulae?.[0] === '"ja,nee,deels"');
  test("herberekenen bij openen", wb.calcProperties.fullCalcOnLoad === true);
  let plafond = false; ws.eachRow(r => { if (r.getCell(1).value === "Kostenplafond voor 20% marge (minimum)") plafond = /\*\(1-0\.2\)/.test(r.getCell(9).value.formula); });
  test("kostenplafond voor 20% marge", plafond);
  test("bestandsnaam", L.kostenBestandsnaam(o, "Häcker keukens") === "Kostenoverzicht_9780_Hacker_keukens.xlsx");
}
samenvatting();
