const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test, samenvatting } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "pages", "beleggingen.js");

const {
  statusInfo, berekenFireVoortgang, berekenDividendVoortgang, berekenClusterConcentratie,
  berekenDagenSinds, vindTheseCheckNodig,
} = laadFuncties(BESTAND, [
  /const CLUSTERS = /,
  /const STATUS_OPTIES = /,
  /function statusInfo\(id\)/,
  /function berekenFireVoortgang\(huidigVermogen, doel\)/,
  /function berekenDividendVoortgang\(gerealiseerd, doel\)/,
  /function berekenClusterConcentratie\(posities\)/,
  /function berekenDagenSinds\(datumStr\)/,
  /const THESE_CHECK_DREMPEL_DAGEN = /,
  /function vindTheseCheckNodig\(posities, drempelDagen = THESE_CHECK_DREMPEL_DAGEN\)/,
]);

sectie("Beleggingen — FIRE-voortgang (geverifieerd tegen de laatst bekende tracker-waarde: 20,9%)");
test("vermogen €188.500 tegen doel €900.000 komt uit op 20,9% — exact de waarde uit de brontracker",
  berekenFireVoortgang(188500, 900000).percentage === 20.9);
test("nog-te-gaan is het doel minus het huidige vermogen", berekenFireVoortgang(188500, 900000).nogTeGaan === 711500);
test("voortgang wordt nooit hoger dan 100%, ook als het vermogen het doel overschrijdt", berekenFireVoortgang(1000000, 900000).percentage === 100);
test("bij een doel van 0 crasht het niet, en wordt 0% getoond", berekenFireVoortgang(100000, 0).percentage === 0);
test("geen vermogen ingevuld crasht niet", berekenFireVoortgang(0, 900000).percentage === 0);
test("nog-te-gaan is nooit negatief, ook niet als het vermogen het doel overschrijdt", berekenFireVoortgang(1000000, 900000).nogTeGaan === 0);

sectie("Beleggingen — dividend-voortgang (geverifieerd tegen de laatst bekende tracker-waarde: 76,9%)");
test("gerealiseerd €923 tegen doel €1.200 komt uit op 76,9% — exact de waarde uit de brontracker",
  berekenDividendVoortgang(923, 1200).percentage === 76.9);
test("geen doel ingevuld crasht niet", berekenDividendVoortgang(500, 0).percentage === 0);
test("boven het doel mag de dividend-voortgang wél boven 100% komen (geen cap, in tegenstelling tot FIRE)",
  berekenDividendVoortgang(1500, 1200).percentage > 100);

sectie("Beleggingen — concentratie per cluster");
const voorbeeldPosities = [
  { naam: "ASML", cluster: "Tech/AI", huidigeWaardeEur: "52000", actief: true },
  { naam: "Nvidia", cluster: "Tech/AI", huidigeWaardeEur: "35000", actief: true },
  { naam: "Danaher", cluster: "Healthcare", huidigeWaardeEur: "20000", actief: true },
  { naam: "Veolia", cluster: "Klimaat/Duurzaamheid", huidigeWaardeEur: "10000", actief: true },
  { naam: "Verkocht aandeel", cluster: "Tech/AI", huidigeWaardeEur: "99999", actief: false },
  { naam: "Zonder waarde", cluster: "Overig", huidigeWaardeEur: "", actief: true },
];
const resultaat = berekenClusterConcentratie(voorbeeldPosities);
test("het totaal telt alleen actieve posities MET een ingevulde waarde mee (99999 van de verkochte positie telt niet mee)",
  resultaat.totaalWaarde === 117000);
test("Tech/AI is de grootste cluster (52.000+35.000=87.000 van 117.000 = 74,4%)",
  resultaat.perCluster[0].cluster === "Tech/AI" && resultaat.perCluster[0].percentage === 74.4);
test("de clusters staan gesorteerd van grootste naar kleinste percentage",
  resultaat.perCluster[0].percentage >= resultaat.perCluster[1].percentage && resultaat.perCluster[1].percentage >= resultaat.perCluster[2].percentage);
test("een positie zonder ingevulde waarde wordt genegeerd, niet als 0 meegeteld in een cluster",
  !resultaat.perCluster.some(c => c.cluster === "Overig"));
test("een inactieve (verkochte) positie duikt nergens in de clusterlijst op", !resultaat.perCluster.some(c => c.posities.includes("Verkocht aandeel")));
test("een lege lijst crasht niet", berekenClusterConcentratie([]).totaalWaarde === 0);
test("posities zonder enige ingevulde waarde crashen niet", berekenClusterConcentratie([{ naam: "X", cluster: "Y" }]).totaalWaarde === 0);

sectie("Beleggingen — statusInfo (thesis-journal statussen)");
test("'intact' geeft het juiste label en groene kleur", statusInfo("intact").label === "These intact" && statusInfo("intact").kleur === "groen");
test("'gebroken' geeft rood", statusInfo("gebroken").kleur === "rood");
test("een onbekende status valt netjes terug op de eerste optie, geen crash", statusInfo("onzin").id === "intact");

sectie("Beleggingen — staleness en these-check-herinnering ('snel bijwerken'-feature)");
test("geen datum ingevuld geeft null, geen crash", berekenDagenSinds("") === null && berekenDagenSinds(null) === null);
test("een datum van exact vandaag geeft 0 dagen", (() => {
  const vandaag = new Date().toISOString().slice(0, 10);
  return berekenDagenSinds(vandaag) === 0;
})());
test("een datum 10 dagen geleden geeft 10", (() => {
  const tienDagenGeleden = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return berekenDagenSinds(tienDagenGeleden) === 10;
})());

const positiesVoorTheseCheck = [
  { naam: "Recent getoetst", actief: true, laatstGetoetst: new Date().toISOString().slice(0, 10) },
  { naam: "Lang geleden getoetst", actief: true, laatstGetoetst: "2020-01-01" },
  { naam: "Nooit getoetst", actief: true, laatstGetoetst: "" },
  { naam: "Inactief, nooit getoetst", actief: false, laatstGetoetst: "" },
];
const checkNodig = vindTheseCheckNodig(positiesVoorTheseCheck);
test("een recent getoetste positie wordt NIET als 'check nodig' gemarkeerd", !checkNodig.some(p => p.naam === "Recent getoetst"));
test("een lang geleden getoetste positie WORDT gemarkeerd", checkNodig.some(p => p.naam === "Lang geleden getoetst"));
test("een nooit-getoetste positie WORDT ook gemarkeerd", checkNodig.some(p => p.naam === "Nooit getoetst"));
test("een INACTIEVE (verkochte) positie wordt genegeerd, ook al is-ie nooit getoetst", !checkNodig.some(p => p.naam === "Inactief, nooit getoetst"));
test("een eigen, lagere drempel wordt gerespecteerd", vindTheseCheckNodig([{ naam: "X", actief: true, laatstGetoetst: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) }], 3).length === 1);
test("een lege lijst crasht niet", vindTheseCheckNodig([]).length === 0);
test("ontbrekende lijst (undefined) crasht niet", vindTheseCheckNodig(undefined).length === 0);

samenvatting();
