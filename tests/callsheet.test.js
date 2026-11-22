const fs = require("fs");
const path = require("path");
const { sectie, test, samenvatting } = require("./testhulp.js");

// Pure bestanden achter elkaar laden (zonder import/export-regels).
const lees = (f) => fs.readFileSync(path.join(__dirname, "../lib", f), "utf8").replace(/^import [\s\S]*?;$/gm, "").replace(/^export /gm, "");
const bron = ["taken-logica.js", "projecten-logica.js", "callsheet-logica.js"].map(lees).join("\n");
const namen = [...new Set([...bron.matchAll(/^(?:function|const) ([A-Za-z_]\w*)/gm)].map(m => m[1]))];
const C = new Function(`${bron}\nreturn { ${namen.join(", ")} };`)();
let ExcelJS = null;
try { ExcelJS = require("exceljs"); } catch { /* zonder node_modules: Excel-tests overslaan */ }

let t = 0;
const nieuwId = () => `id${++t}`;
const groot = C.STANDAARD_SJABLONEN.find(s => s.id === "commercial-groot");
let proj = C.maakProjectUitSjabloon(groot, { naam: "Häcker", klantId: "kk", draaidag: "2026-12-02", opleverdatum: "2026-12-20", vandaag: "2026-11-22", nieuwId });
proj = C.zetDraaidagen(proj, [{ id: "d1", datum: "2026-12-02" }, { id: "d2", datum: "2026-12-03" }], { nieuwId });
proj = C.pasOnderdelenToe(proj, ["acteurs", "figuranten", "loc-interieur", "hotel", "crew-regie", "crew-camera", "crew-geluid"], { vandaag: "2026-11-22", deliverables: { tvc: ["16x9"], online: ["16x9", "9x16", "1x1", "4x5"] }, nieuwId });
const zet = (onderdeelId, bezetting) => { proj = { ...proj, items: proj.items.map(i => (i.onderdeelId === onderdeelId ? { ...i, bezetting } : i)) }; };
zet("crew", [
  { id: "c1", onderdeelId: "crew-regie", naam: "Mick Romeijn", status: "bevestigd", telefoon: "06 48 57 27 66" },
  { id: "c2", onderdeelId: "crew-camera", naam: "Tom van Berkel", status: "bevestigd", notitie: "tel 06 41 79 60 53" },
  { id: "c3", onderdeelId: "crew-geluid", naam: "Olivier Nijs", status: "optie" },
]);
zet("acteurs", [{ id: "a1", onderdeelId: "acteurs", naam: "Linda van Groenewegen", status: "bevestigd" }, { id: "a2", onderdeelId: "acteurs", naam: "Manager", status: "optie" }]);
zet("loc-interieur", [{ id: "l1", onderdeelId: "loc-interieur", naam: "Häcker Küchen fabriek", adres: "Venner Esch 3, 49179 Ostercappeln, Duitsland", status: "bevestigd" }]);
zet("hotel", [{ id: "h1", onderdeelId: "hotel", naam: "IDINGSHOF Hotel & Restaurant", adres: "Bührener Esch 1, 49565 Bramsche, Duitsland", status: "bevestigd" }]);
const klant = { id: "kk", naam: "Keuken Kampioen", callsheet: {
  productie: [{ functie: "Agency", naam: "Scheepens" }, { functie: "Creative Director", naam: "Bram Giesen" }],
  factuur: "Full Frame B.V.\nBurgemeester Stekelenburgplein 199 unit 1.11\n5041SC Tilburg",
  klantOpSet: [{ organisatie: "Scheepens", naam: "Angela Mostert" }, { organisatie: "Keuken Kampioen", naam: "Susan de Pous" }],
  plaats: "Ostercappeln (Duitsland)",
} };
const ins = { mijnNaam: "Pepijn Robben", mijnTelefoon: "06 385 29 405", productiebedrijf: "Full Frame" };

sectie("Callsheet — opgebouwd uit het project");
const cs = C.bouwCallsheet(proj, "d1", { klant, instellingen: ins });
test("titel: klant – project, in hoofdletters", cs.titel === "CALLSHEET KEUKEN KAMPIOEN – HÄCKER");
test("dag 1 van 2, plaats uit het klantgeheugen", cs.dagNr === 1 && cs.aantalDagen === 2 && cs.plaats === "Ostercappeln (Duitsland)");
test("set telefoon = jij", cs.setTelefoon === "Pepijn Robben – 06 385 29 405");
test("locaties: draailocatie + overnachting met adres", cs.locaties.map(l => `${l.label}:${l.naam}`).join("|") === "Draailocatie:Häcker Küchen fabriek|Overnachting:IDINGSHOF Hotel & Restaurant" && /Ostercappeln/.test(cs.locaties[0].adres));
test("crew: rollen, telefoon (ook uit notitie), jijzelf als productie", cs.crew.map(c => `${c.functie}:${voorn(c.naam)}:${c.telefoon}`).join("|") === "Regie:Mick:06 48 57 27 66|Camera:Tom:06 41 79 60 53|Productie:Pepijn:06 385 29 405|Geluid:Olivier:");
function voorn(n) { return C.voornaam(n); }
test("niet bevestigde crew is geel", cs.crew.find(c => c.naam === "Olivier Nijs").geel && !cs.crew.find(c => c.naam === "Mick Romeijn").geel);
test("cast: bevestigd normaal, optie geel met '(nog niet bevestigd)'", cs.cast.length === 2 && !cs.cast[0].geel && cs.cast[1].geel && /nog niet bevestigd/.test(cs.cast[1].naam) && cs.cast[0].rol === "Acteur");
test("productie: bureau/klant uit geheugen + production company + jij + regie", cs.productie.map(r => r.functie).join("|") === "Agency|Creative Director|Production company|Productie|Regie");
test("calls: vertrek hotel, crewcall op de draailocatie, lunch, wrap", cs.calls[0].wat === "Vertrek hotel" && /Venner Esch/.test(cs.calls[1].locatie) && cs.calls.some(c => c.wat === "Lunch"));
test("camera uit de deliverables (zoals in het template)", cs.camera === "Wij draaien voor 16:9 maar houden rekening met: 4:5, 1:1 & 9:16");
test("standaard notes met productiebedrijf ingevuld", cs.notes.some(n => n === "Full Frame is niet verantwoordelijk voor eventuele verkeersboetes."));
test("samenvatting zoals bovenaan het template", (() => { const s = C.samenvatting(cs); return s[0] === "Crew: (4) Mick, Tom, Pepijn, Olivier" && s[1].startsWith("Cast: (2) Linda van Groenewegen") && s[2] === "Agency & Klant op set: (2) Angela, Susan"; })());
test("telefoon uit notitie halen", C.telefoonUit({ notitie: "bel 06-12345678 na 9u" }) === "06-12345678" && C.telefoonUit({ notitie: "geen nummer" }) === "");
test("Google Maps-link", C.mapsLink("Venner Esch 3, Ostercappeln") === "https://www.google.com/maps/search/?api=1&query=Venner+Esch+3%2C+Ostercappeln");

sectie("Callsheet — eigen aanpassingen per dag bewaard");
const metOpgeslagen = { ...proj, project: { ...proj.project, callsheets: { d2: {
  schema: [{ tijd: "08:00 – 09:00", wat: "Crewcall, opbouw", cast: "Linda", notes: "" }, { pauze: true, wat: "LUNCH", tijd: "12:15 – 12:45" }],
  castDetails: { a1: { calltijd: "08:00", visagie: "08:00 – 08:45", rol: "Host / hoofdpersonage" } },
  afwezig: ["c3"], titel: "CALLSHEET EIGEN TITEL",
} } } };
const cs2 = C.bouwCallsheet(metOpgeslagen, "d2", { klant, instellingen: ins });
test("dag 2 van 2 met eigen titel", cs2.dagNr === 2 && cs2.titel === "CALLSHEET EIGEN TITEL");
test("castdetails per persoon", cs2.cast[0].calltijd === "08:00" && cs2.cast[0].rol === "Host / hoofdpersonage");
test("afwezig op deze dag → niet op de callsheet", !cs2.crew.some(c => c.naam === "Olivier Nijs"));
test("dag 1 heeft het eigen schema van dag 2 niet", cs.schema.length === 0 && cs2.schema.length === 2);
const geh = C.callsheetGeheugen(cs);
test("geheugen per klant: bureau/klant-contacten (niet jij/regie), factuur, klant op set", geh.klant.productie.map(r => r.functie).join() === "Agency,Creative Director" && /Full Frame B\.V\./.test(geh.klant.factuur) && geh.klant.klantOpSet.length === 2);
test("bestandsnaam", C.callsheetBestandsnaam(cs) === "Callsheet_KEUKEN_KAMPIOEN_HACKER_woensdag_2_december.xlsx");

if (ExcelJS) {
  sectie("Callsheet — Excel in de stijl van het template");
  const logo = fs.readFileSync(path.join(__dirname, "fixtures/logo.png")).toString("base64");
  const wb = C.maakCallsheetWerkboek({ ...cs2, factuur: klant.callsheet.factuur, po: "9606" }, ExcelJS, { productie: { base64: logo, extension: "png", breedte: 204, hoogte: 162 } });
  const ws = wb.worksheets[0];
  const waarden = [];
  ws.eachRow(r => r.eachCell(c => { if (c.value) waarden.push(typeof c.value === "object" && c.value.text ? c.value.text : String(c.value)); }));
  const zoek = (t) => waarden.some(v => v === t);
  test("kolombreedtes als het template (36/30/18/18/18/40)", ws.columns.map(c => c.width).join() === "36,30,18,18,18,40");
  test("alle secties in de juiste volgorde", (() => {
    const s = ["LOCATIES", "PRODUCTIE", "CALLS", "CAST CALL", "DRAAISCHEMA 3 DECEMBER", "BELANGRIJKE NOTES", "CREW & KLANT"];
    const pos = s.map(x => waarden.indexOf(x));
    return pos.every(p => p >= 0) && pos.every((p, i) => !i || p > pos[i - 1]);
  })());
  test("titel + datumregel met dag 2 van 2", zoek("CALLSHEET EIGEN TITEL") && zoek("donderdag 3 december 2026 – draaidag 2 van 2 – Ostercappeln (Duitsland)"));
  test("factuurgegevens en PO naast de productie", zoek("Factuurgegevens:") && zoek("PO nummer: 9606"));
  test("route-link naar Google Maps", (() => { let ok = false; ws.eachRow(r => r.eachCell(c => { if (c.value && c.value.hyperlink && /google\.com\/maps/.test(c.value.hyperlink)) ok = true; })); return ok; })());
  test("sectiekoppen donker met witte letters", (() => { let ok = false; ws.eachRow(r => r.eachCell(c => { if (c.value === "LOCATIES") ok = c.fill?.fgColor?.argb === "FF404040" && c.font?.color?.argb === "FFFFFFFF"; })); return ok; })());
  test("lunch als grijze balk over de hele breedte", (() => { let ok = false; ws.eachRow(r => r.eachCell(c => { if (c.value === "LUNCH 12:15 – 12:45") ok = c.fill?.fgColor?.argb === "FFD9D9D9" && c.isMerged; })); return ok; })());
  test("niet bevestigde cast is geel + geel-uitleg onderaan", (() => { let geel = false; ws.eachRow(r => r.eachCell(c => { if (String(c.value).includes("nog niet bevestigd")) geel = c.fill?.fgColor?.argb === "FFFFFF00"; })); return geel && zoek("Geel gemarkeerd = nog in te vullen"); })());
  test("notes rood en vet", (() => { let ok = false; ws.eachRow(r => r.eachCell(c => { if (String(c.value).startsWith("- Meld eventuele schade")) ok = c.font?.color?.argb === "FFC00000" && c.font?.bold; })); return ok; })());
  test("logo geplaatst", ws.getImages().length === 1);
  // Bestand schrijven + opnieuw openen is asynchroon: alleen bij los draaien
  // (de verzamel-runner stopt direct na de synchrone tests).
  if (require.main === module) {
    wb.xlsx.writeBuffer().then(async (buf) => {
      const terug = new ExcelJS.Workbook();
      await terug.xlsx.load(buf);
      test("bestand opnieuw te openen, samenvatting op A1", terug.worksheets[0].getCell("A1").value === "Crew: (3) Mick, Tom, Pepijn");
      if (process.env.CALLSHEET_UIT) fs.writeFileSync(process.env.CALLSHEET_UIT, Buffer.from(buf));
      samenvatting();
    });
  } else samenvatting();
} else {
  console.log("  (exceljs niet geïnstalleerd — Excel-tests overgeslagen)");
  samenvatting();
}
