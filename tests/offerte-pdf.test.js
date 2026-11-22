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

sectie("Offerte-PDF — begroot tegenover werkelijk");
const spec = L.compacteSpecificatie(o);
const st = L.specificatieStand(spec, { "1.0": 1800, "2.0": 1600 });
test("per kopje werkelijk en verschil", st.kopjes[1].werkelijk === 1800 && st.kopjes[1].verschil === 200 && st.kopjes[2].verschil === -160);
test("marge op ingevulde posten: (200−160)/(2000+1440) = 1,2%", st.margeIngevuldPct === 1.2 && st.begrootIngevuld === 3440);
test("prognose: werkelijk waar ingevuld, anders begroot", st.prognose === 13587.5 - 200 + 160 && st.marge === 40 && st.ingevuld === 2);

if (ExcelJS) {
  sectie("Offerte-PDF — Excel kostenoverzicht");
  const wb = L.maakKostenWerkboek(o, ExcelJS, { projectNaam: "Keukens", klantNaam: "Keuken Kampioen", werkelijk: { "1.0": 1800 } });
  const ws = wb.worksheets[0];
  const kop = ws.getRow(5).values.slice(1).join("|");
  test("kolommen", kop === "Post|Omschrijving|Aantal|Eenheid|Prijs|Begroot|Werkelijk|Verschil|Prognose|Leverancier / naam|Betaald|Opmerking");
  test("titel", ws.getCell("A1").value === "KOSTENOVERZICHT KEUKEN KAMPIOEN – KEUKENS");
  let camRij = 0; ws.eachRow((r, n) => { if (r.getCell(1).value === "Cameraset") camRij = n; });
  test("begroot = aantal × prijs als formule", ws.getCell(`F${camRij}`).value.formula === `C${camRij}*E${camRij}`);
  test("werkelijk ingevuld uit de app", ws.getCell(`G${camRij}`).value === 1800);
  test("verschil en prognose als formule", /F\d+-G\d+/.test(ws.getCell(`H${camRij}`).value.formula) && /IF\(G\d+="",F\d+,G\d+\)/.test(ws.getCell(`I${camRij}`).value.formula));
  test("subtotaal per kopje", ws.getCell(`F${camRij - 1}`).value.formula.startsWith("SUM(F"));
  let margeOk = false; ws.eachRow(r => { if (r.getCell(1).value === "Verwachte marge t.o.v. de offerte") margeOk = /F\d+-I\d+/.test(r.getCell(9).value.formula); });
  test("verwachte marge", margeOk);
  test("betaald: keuzelijst ja/nee/deels", ws.getCell(`K${camRij}`).dataValidation?.formulae?.[0] === '"ja,nee,deels"');
  test("herberekenen bij openen", wb.calcProperties.fullCalcOnLoad === true);
  let plafond = false; ws.eachRow(r => { if (r.getCell(1).value === "Kostenplafond voor 20% marge (minimum)") plafond = /\*\(1-0\.2\)/.test(r.getCell(9).value.formula); });
  test("kostenplafond voor 20% marge", plafond);
  test("bestandsnaam", L.kostenBestandsnaam(o, "Häcker keukens") === "Kostenoverzicht_9780_Hacker_keukens.xlsx");
}
samenvatting();
