const { laadFuncties } = require("./extractie.js");
const { sectie, test, samenvatting } = require("./testhulp.js");

sectie("Declaratieformulier-xlsx — vertaling van declaratie-items naar formulierkolommen");

const { veldenVoorItem, maandNaam, formatDatumVoorLabel, formatBedragVoorLabel } = laadFuncties("../pages/api/declaraties-xlsx.js", [
  /const MAAND_NAMEN = /,
  /function maandNaam\(datumStr\)/,
  /function formatDatumVoorLabel\(datumStr\)/,
  /function formatBedragVoorLabel\(bedrag\)/,
  /const VERVOERMIDDEL_LABELS = /,
  /const KM_TARIEF = /,
  /function veldenVoorItem\(item\)/,
]);

sectie("Maandnaam uit een datum, met hoofdletter");
test("september wordt 'September' (hoofdletter, zoals het sjabloon dat al gebruikte)", maandNaam("2026-09-15") === "September");
test("januari wordt 'Januari'", maandNaam("2026-01-01") === "Januari");

sectie("Kilometer — als formule, zodat de onderliggende km zichtbaar blijft (zelfde conventie als het origineel)");
const kmItem = veldenVoorItem({ type: "kilometer", project: "Project Alpha", van: "Tilburg", naar: "Amsterdam", km: 82, retour: true });
test("kostensoort is 'KM vergoeding werk'", kmItem.kostensoort === "KM vergoeding werk");
test("omschrijving bevat het project, het traject en '(retour)'", kmItem.omschrijving.includes("Project Alpha") && kmItem.omschrijving.includes("Tilburg → Amsterdam") && kmItem.omschrijving.includes("(retour)"));
test("bedrag is een FORMULE (geen kaal getal) met de verdubbelde (retour) kilometers", kmItem.bedragOfFormule.formula === "164*0.23");

const kmEnkel = veldenVoorItem({ type: "kilometer", project: "P", van: "A", naar: "B", km: 20, retour: false });
test("enkele reis verdubbelt niet", kmEnkel.bedragOfFormule.formula === "20*0.23");
test("een enkele reis vermeldt geen '(retour)' in de omschrijving", !kmEnkel.omschrijving.includes("retour"));

sectie("Parkeren — plain bedrag, geen formule nodig");
const parkerenItem = veldenVoorItem({ type: "parkeren", project: "Project Alpha", locatie: "Garage Centrum", bedrag: 14.5 });
test("kostensoort is 'Parkeerkosten'", parkerenItem.kostensoort === "Parkeerkosten");
test("bedrag is het kale getal, geen formule-object", parkerenItem.bedragOfFormule === 14.5);
test("omschrijving bevat project en locatie", parkerenItem.omschrijving.includes("Project Alpha") && parkerenItem.omschrijving.includes("Garage Centrum"));

sectie("OV — meerdere trajectdelen samengevat, kostensoort volgt Pepijns eigen bestaande conventie");
const ovItem = veldenVoorItem({
  type: "ov", project: "Project Beta",
  ritten: [
    { vervoermiddel: "trein", omschrijving: "Tilburg-Utrecht", bedrag: 8.4 },
    { vervoermiddel: "ovfiets", omschrijving: "", bedrag: 4.55 },
    { vervoermiddel: "trein", omschrijving: "Utrecht-Tilburg", bedrag: 8.4 },
  ],
});
test("OV valt terug op 'KM vergoeding werk' als kostensoort (geen apart OV-vak in het sjabloon)", ovItem.kostensoort === "KM vergoeding werk");
test("het totaalbedrag is de som van alle trajectdelen", ovItem.bedragOfFormule === 21.35);
test("omschrijving somt alle vervoermiddelen op", ovItem.omschrijving.includes("Trein") && ovItem.omschrijving.includes("OV-fiets"));

sectie("Overig — beste-gok-kostensoort, duidelijk als zodanig gedocumenteerd in de code");
const overigItem = veldenVoorItem({ type: "overig", project: "Project Beta", omschrijving: "Zakelijk etentje", bedrag: 42.3 });
test("krijgt een kostensoort toegewezen (geen lege/undefined waarde)", typeof overigItem.kostensoort === "string" && overigItem.kostensoort.length > 0);
test("omschrijving en bedrag komen correct door", overigItem.omschrijving.includes("Zakelijk etentje") && overigItem.bedragOfFormule === 42.3);

sectie("Bon-bijlage — labeltekst boven elke ingevoegde afbeelding");
test("datum wordt dag-maand-jaar met voorloopnullen", formatDatumVoorLabel("2026-09-05") === "5-09-2026");
test("een lege/ontbrekende datum crasht niet, geeft een lege string", formatDatumVoorLabel("") === "" && formatDatumVoorLabel(null) === "");
test("bedrag wordt met euroteken en twee decimalen weergegeven", formatBedragVoorLabel(6) === "€ 6,00");
test("ontbrekend bedrag geeft € 0,00, geen crash", formatBedragVoorLabel(undefined) === "€ 0,00");

samenvatting();
