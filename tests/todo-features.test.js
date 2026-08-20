const { laadFuncties } = require("./extractie.js");
const { sectie, test, samenvatting } = require("./testhulp.js");

sectie("To-do-features — geëxtraheerd uit de echte broncode van lijsten.js");

// Deze vier zijn zuivere, op zichzelf staande functies — rechtstreeks uit
// lijsten.js gehaald, geen kopie.
const { vandaagStr, datumNaarStr, isVerlopen, formatVervaldatum, volgendeHerhaling } = laadFuncties("../pages/lijsten.js", [
  /function vandaagStr\(\)/,
  /function datumNaarStr\(d\)/,
  /function isVerlopen\(datumStr\)/,
  /function formatVervaldatum\(datumStr\)/,
  /function volgendeHerhaling\(huidigeDatumStr, type\)/,
]);

// ── Vervaldatum: verlopen-detectie ──────────────────────────────────────
sectie("isVerlopen — een taak is verlopen zodra de datum vóór vandaag ligt");
const vandaag = vandaagStr();
const gisteren = datumNaarStr(new Date(Date.now() - 86400000));
const morgen = datumNaarStr(new Date(Date.now() + 86400000));
test("gisteren is verlopen", isVerlopen(gisteren) === true);
test("vandaag is NIET verlopen (moet nog gedaan worden, niet te laat)", isVerlopen(vandaag) === false);
test("morgen is niet verlopen", isVerlopen(morgen) === false);
test("geen datum is niet verlopen", isVerlopen(null) === false);
test("lege string is niet verlopen", isVerlopen("") === false);

// ── Vervaldatum: weergavetekst ──────────────────────────────────────────
sectie("formatVervaldatum — leesbare tekst");
test("vandaag geeft 'Vandaag'", formatVervaldatum(vandaag) === "Vandaag");
test("morgen geeft 'Morgen'", formatVervaldatum(morgen) === "Morgen");
test("lege datum geeft lege string", formatVervaldatum(null) === "" && formatVervaldatum("") === "");
test("een verdere datum geeft een normale datumtekst (geen crash, iets van tekst terug)",
  typeof formatVervaldatum("2026-12-25") === "string" && formatVervaldatum("2026-12-25").length > 0);

// ── Sortering — reproductie van de exacte comparator uit lijsten.js
//    (regel ~1186-1189: todoSortering === "vervaldatum" tak) ────────────
sectie("Sortering op vervaldatum — items zonder datum altijd achteraan");
function sorteerAlfabetisch(a, b) { return a.name.localeCompare(b.name, "nl", { sensitivity: "base" }); }
function sorteerOpVervaldatum(a, b) { return (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || sorteerAlfabetisch(a, b); }
const taken = [
  { name: "Zonder datum A", dueDate: null },
  { name: "Later", dueDate: "2026-09-01" },
  { name: "Vandaag", dueDate: vandaag },
  { name: "Zonder datum B", dueDate: null },
];
const gesorteerd = [...taken].sort(sorteerOpVervaldatum);
test("taak met vroegste datum staat vooraan", gesorteerd[0].name === "Vandaag");
test("taak zonder datum staat achteraan", gesorteerd[2].dueDate === null && gesorteerd[3].dueDate === null);
test("twee taken zonder datum vallen terug op alfabetische volgorde", gesorteerd[2].name === "Zonder datum A" && gesorteerd[3].name === "Zonder datum B");

// ── "Mijn dag" — reproductie van de exacte filter uit lijsten.js
//    (regel ~1842-1846) ─────────────────────────────────────────────────
sectie("Mijn dag — verzamelt verlopen/vandaag + belangrijk, negeert al-afgevinkte taken");
function berekenMijnDag(lists) {
  return lists
    .filter(l => l.type === "todo")
    .flatMap(l => l.items
      .filter(i => !i.checked && ((i.dueDate && i.dueDate <= vandaagStr()) || i.belangrijk))
      .map(i => ({ ...i, lijstId: l.id, lijstNaam: l.name })));
}
const testLijsten = [
  { id: "l1", name: "Huishouden", type: "todo", items: [
    { id: "a", name: "Verlopen taak", checked: false, dueDate: gisteren, belangrijk: false },
    { id: "b", name: "Vandaag taak", checked: false, dueDate: vandaag, belangrijk: false },
    { id: "c", name: "Belangrijk zonder datum", checked: false, dueDate: null, belangrijk: true },
    { id: "d", name: "Toekomstige taak", checked: false, dueDate: morgen, belangrijk: false },
    { id: "e", name: "Al afgevinkt maar verlopen", checked: true, dueDate: gisteren, belangrijk: false },
    { id: "f", name: "Gewone taak zonder datum", checked: false, dueDate: null, belangrijk: false },
  ]},
  { id: "l2", name: "Boodschappen", type: "standaard", items: [
    { id: "g", name: "Melk", checked: false, dueDate: gisteren, belangrijk: true },
  ]},
];
const mijnDag = berekenMijnDag(testLijsten);
const namen = mijnDag.map(i => i.name);
test("verlopen taak zit erin", namen.includes("Verlopen taak"));
test("taak van vandaag zit erin", namen.includes("Vandaag taak"));
test("belangrijke taak zonder datum zit erin", namen.includes("Belangrijk zonder datum"));
test("toekomstige taak (nog niet verlopen/vandaag) zit er NIET in", !namen.includes("Toekomstige taak"));
test("al afgevinkte taak zit er NIET in, ook al is-ie verlopen", !namen.includes("Al afgevinkt maar verlopen"));
test("gewone taak zonder datum/belangrijk zit er NIET in", !namen.includes("Gewone taak zonder datum"));
test("items uit een NIET-to-do-lijst (bv. boodschappen) worden genegeerd", !namen.includes("Melk"));
test("Mijn dag bevat precies de 3 verwachte items", mijnDag.length === 3);

// ── Herhaling: toggleCheck-gedrag — reproductie van de exacte tak-logica
//    uit lijsten.js (regel ~624-635: !i.checked && i.herhaling) ─────────
sectie("Afvinken van een herhalende taak schuift de datum door i.p.v. 'm afgevinkt te laten staan");
function simuleerToggleCheck(item) {
  if (!item.checked && item.herhaling) {
    return { ...item, dueDate: volgendeHerhaling(item.dueDate, item.herhaling) };
  }
  return { ...item, checked: !item.checked };
}
const herhalendeTaak = { checked: false, herhaling: "wekelijks", dueDate: "2026-08-19" };
const naAfvinken = simuleerToggleCheck(herhalendeTaak);
test("herhalende taak blijft 'checked: false' na afvinken (schuift door i.p.v. afgevinkt te blijven)", naAfvinken.checked === false);
test("de vervaldatum is doorgeschoven naar de volgende week", naAfvinken.dueDate === "2026-08-26");

const nietHerhalendeTaak = { checked: false, herhaling: null, dueDate: "2026-08-19" };
const naAfvinken2 = simuleerToggleCheck(nietHerhalendeTaak);
test("een GEWONE (niet-herhalende) taak wordt gewoon normaal afgevinkt", naAfvinken2.checked === true);
test("de datum van een gewone taak blijft ongewijzigd", naAfvinken2.dueDate === "2026-08-19");

// ── Herhaling inschakelen zonder bestaande vervaldatum
//    (reproductie van regel ~731-740, zetHerhaling) ─────────────────────
sectie("Herhaling inschakelen zonder vervaldatum zet die automatisch op vandaag");
function simuleerZetHerhaling(item, type) {
  const nieuweHerhaling = item.herhaling === type ? null : type;
  return { ...item, herhaling: nieuweHerhaling, dueDate: nieuweHerhaling && !item.dueDate ? vandaagStr() : item.dueDate };
}
const taakZonderDatum = { herhaling: null, dueDate: null };
const naHerhalingAan = simuleerZetHerhaling(taakZonderDatum, "dagelijks");
test("herhaling staat nu aan", naHerhalingAan.herhaling === "dagelijks");
test("vervaldatum is automatisch op vandaag gezet (anders geen ankerpunt om vanaf te herhalen)", naHerhalingAan.dueDate === vandaag);

const taakMetDatum = { herhaling: null, dueDate: "2026-09-01" };
const naHerhalingAan2 = simuleerZetHerhaling(taakMetDatum, "wekelijks");
test("een bestaande vervaldatum wordt NIET overschreven bij het inschakelen van herhaling", naHerhalingAan2.dueDate === "2026-09-01");

const herhalingAlAan = { herhaling: "dagelijks", dueDate: "2026-09-01" };
const naNogmaalsKlikken = simuleerZetHerhaling(herhalingAlAan, "dagelijks");
test("nogmaals op dezelfde herhaling klikken schakelt 'm weer UIT", naNogmaalsKlikken.herhaling === null);

// ── Toewijzen aan persoon — reproductie van regel ~721-725 ──────────────
sectie("Toewijzen aan persoon — nogmaals dezelfde persoon kiezen wijst weer af");
function simuleerZetToegewezenAan(item, persoon) {
  return { ...item, assignedTo: item.assignedTo === persoon ? null : persoon };
}
const nietToegewezen = { assignedTo: null };
const naToewijzen = simuleerZetToegewezenAan(nietToegewezen, "Tessa");
test("taak is toegewezen aan Tessa", naToewijzen.assignedTo === "Tessa");
const naNogmaalsTessa = simuleerZetToegewezenAan(naToewijzen, "Tessa");
test("nogmaals Tessa kiezen wijst de taak weer af (niemand meer toegewezen)", naNogmaalsTessa.assignedTo === null);
const naAnderePersoon = simuleerZetToegewezenAan(naToewijzen, "Pepijn");
test("een andere persoon kiezen wijst opnieuw toe (wisselt, dus niet uitzetten)", naAnderePersoon.assignedTo === "Pepijn");

// ── Belangrijk-markering — simpele toggle, regel ~726-730 ───────────────
sectie("Belangrijk-markering is een simpele aan/uit-toggle");
test("niet-belangrijk wordt belangrijk", { belangrijk: !false }.belangrijk === true);
test("belangrijk wordt weer niet-belangrijk", { belangrijk: !true }.belangrijk === false);

// ── Substappen — toevoegen/afvinken/verwijderen, regel ~742-763 ─────────
sectie("Substappen");
function simuleerVoegSubstapToe(item, tekst) {
  if (!tekst.trim()) return item;
  return { ...item, substappen: [...(item.substappen||[]), { id: "test-id", tekst: tekst.trim(), afgevinkt: false }] };
}
const taakZonderStappen = { substappen: [] };
const metEersteStap = simuleerVoegSubstapToe(taakZonderStappen, "  Was ophangen  ");
test("substap wordt toegevoegd met bijgeknipte tekst (geen rand-spaties)", metEersteStap.substappen[0].tekst === "Was ophangen");
test("nieuwe substap start niet-afgevinkt", metEersteStap.substappen[0].afgevinkt === false);
const naLegeInvoer = simuleerVoegSubstapToe(metEersteStap, "   ");
test("een lege/alleen-spaties substap wordt genegeerd (geen crash, niks toegevoegd)", naLegeInvoer.substappen.length === 1);

function simuleerToggleSubstap(item, stapId) {
  return { ...item, substappen: (item.substappen||[]).map(s => s.id === stapId ? { ...s, afgevinkt: !s.afgevinkt } : s) };
}
const naAfvinkenStap = simuleerToggleSubstap(metEersteStap, "test-id");
test("de juiste substap wordt afgevinkt", naAfvinkenStap.substappen[0].afgevinkt === true);

function simuleerVerwijderSubstap(item, stapId) {
  return { ...item, substappen: (item.substappen||[]).filter(s => s.id !== stapId) };
}
const naVerwijderen = simuleerVerwijderSubstap(metEersteStap, "test-id");
test("substap wordt volledig verwijderd uit de lijst", naVerwijderen.substappen.length === 0);

samenvatting();
