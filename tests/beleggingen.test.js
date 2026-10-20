const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test, samenvatting } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "pages", "beleggingen.js");

const {
  statusInfo, berekenFireVoortgang, berekenDividendVoortgang, berekenClusterConcentratie,
  berekenDagenSinds, vindTheseCheckNodig,
  naarGetal, isPrijsTriggerGeraakt, vindGeraakteTriggers, berekenZevenRegelsScore, vulStartdataAan, ZEVEN_REGELS,
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
  /function naarGetal\(v\)/,
  /function isPrijsTriggerGeraakt\(huidigeKoers, trigger, richting\)/,
  /function vindGeraakteTriggers\(posities, watchlist\)/,
  /const ZEVEN_REGELS = /,
  /const ZEVEN_REGELS_ANTWOORDEN = /,
  /function berekenZevenRegelsScore\(zevenRegels\)/,
  /const STARTDATA_VERSIE = /,
  /const AANVUL_POSITIEVELDEN = /,
  /const AANVUL_SECTIES = /,
  /function isLeegVeld\(v\)/,
  /function vulStartdataAan\(bestaand, seed\)/,
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

sectie("Beleggingen — koop-/verkoop-triggers");
test("Danaher uit de export: koers $211,74 bij verkoop-trigger $210 → geraakt", isPrijsTriggerGeraakt(211.74, 210, "verkoop") === true);
test("koers precies op de verkoop-trigger telt als geraakt", isPrijsTriggerGeraakt(210, 210, "verkoop") === true);
test("koers onder de verkoop-trigger is niet geraakt", isPrijsTriggerGeraakt(205, 210, "verkoop") === false);
test("koop-trigger: koers onder de trigger is geraakt", isPrijsTriggerGeraakt(48, 50, "koop") === true);
test("koop-trigger: koers boven de trigger is niet geraakt", isPrijsTriggerGeraakt(55, 50, "koop") === false);
test("geen koers ingevuld geeft null, geen crash", isPrijsTriggerGeraakt("", 210, "verkoop") === null);
test("geen trigger ingevuld geeft null, geen crash", isPrijsTriggerGeraakt(211, "", "verkoop") === null);
test("0 of negatief wordt als onbekend behandeld", isPrijsTriggerGeraakt(0, 210, "verkoop") === null && isPrijsTriggerGeraakt(-5, 210, "verkoop") === null);
test("Nederlandse komma als decimaalteken werkt ('226,92')", isPrijsTriggerGeraakt("230,10", "226,92", "verkoop") === true);
test("onzin-invoer crasht niet", isPrijsTriggerGeraakt("abc", "210", "verkoop") === null);
test("onbekende richting geeft null", isPrijsTriggerGeraakt(100, 100, "houden") === null);
test("naarGetal: komma en punt", naarGetal("1,5") === 1.5 && naarGetal("1.5") === 1.5 && naarGetal("") === null && naarGetal(undefined) === null);

const triggerPosities = [
  { id: "a", naam: "Danaher", actief: true, huidigeKoers: "211.74", verkoopTrigger: "210" },
  { id: "b", naam: "Salesforce", actief: true, huidigeKoers: "", verkoopTrigger: "226.92" },
  { id: "c", naam: "Toyota", actief: true, huidigeKoers: "150", verkoopTrigger: "200" },
  { id: "d", naam: "Verkocht", actief: false, huidigeKoers: "999", verkoopTrigger: "100" },
  { id: "e", naam: "Zonder trigger", actief: true, huidigeKoers: "50", verkoopTrigger: "" },
];
const triggerWatch = [
  { id: "w1", naam: "BMY", huidigeKoers: "40", koopTrigger: "45" },
  { id: "w2", naam: "Schneider", huidigeKoers: "", koopTrigger: "200" },
  { id: "w3", naam: "Zonder", huidigeKoers: "10", koopTrigger: "" },
];
const gt = vindGeraakteTriggers(triggerPosities, triggerWatch);
test("alleen Danaher heeft een geraakte verkoop-trigger", gt.verkoop.length === 1 && gt.verkoop[0].naam === "Danaher");
test("een verkochte (inactieve) positie telt niet mee", !gt.verkoop.some(p => p.naam === "Verkocht"));
test("BMY heeft een geraakte koop-trigger", gt.koop.length === 1 && gt.koop[0].naam === "BMY");
test("Salesforce en Schneider worden als 'koers ontbreekt' gemeld", gt.zonderKoers.length === 2 && gt.zonderKoers.some(x => x.naam === "Salesforce") && gt.zonderKoers.some(x => x.naam === "Schneider"));
test("posities zonder trigger veroorzaken geen melding", !gt.zonderKoers.some(x => x.naam === "Zonder trigger" || x.naam === "Zonder"));
test("lege/ontbrekende lijsten crashen niet", vindGeraakteTriggers(undefined, undefined).verkoop.length === 0);

sectie("Beleggingen — 7-regels kwaliteitscheck");
test("er zijn precies 7 regels", ZEVEN_REGELS.length === 7);
const score = berekenZevenRegelsScore({ cashBovenSchuld: "Ja", omzetgroeiBoven10: "Ja", margeBoven10: "Deels", omzetSnellerDanKosten: "Nee", concurrentievoordeel: "Ja", sterkManagement: "N.v.t." });
test("score telt ja/deels/nee/n.v.t. correct", score.ja === 3 && score.deels === 1 && score.nee === 1 && score.nvt === 1 && score.ingevuld === 6);
test("lege of ontbrekende invoer crasht niet en geeft 0 ingevuld", berekenZevenRegelsScore(undefined).ingevuld === 0 && berekenZevenRegelsScore({}).ja === 0);
test("onbekende antwoorden/sleutels worden genegeerd", berekenZevenRegelsScore({ onzin: "Ja", cashBovenSchuld: "Misschien" }).ingevuld === 0);

sectie("Beleggingen — startdata aanvullen voor bestaande gebruikers");
const seed = {
  posities: [
    { ticker: "DHR", verkoopTrigger: "210" },
    { ticker: "GSK.L", aankoopdatum: "2026-09-01", waarderingBijAankoop: "P/E 10x" },
  ],
  onderzochtAfgewezen: [{ naam: "Linde", reden: "ESG" }],
  preIpoVolgen: [{ naam: "Mistral AI", status: "privaat" }],
  bronbelasting: [{ land: "VK" }],
  bronbelastingNietOnderzocht: "Duitsland",
  openstaandeBeslissingen: [{ onderwerp: "X", status: "Y" }],
};
const oud = {
  posities: [
    { id: "1", ticker: "DHR", naam: "Danaher", verkoopTrigger: "" },
    { id: "2", ticker: "GSK.L", naam: "GSK", aankoopdatum: "2026-08-15", waarderingBijAankoop: "" },
    { id: "3", ticker: "ASML.AS", naam: "ASML" },
  ],
  onderzochtAfgewezen: [], preIpoVolgen: undefined, bronbelasting: [], bronbelastingNietOnderzocht: "", openstaandeBeslissingen: [],
};
const r = vulStartdataAan(oud, seed);
test("lege trigger bij Danaher wordt aangevuld", r.data.posities[0].verkoopTrigger === "210");
test("een al ingevulde aankoopdatum wordt NIET overschreven", r.data.posities[1].aankoopdatum === "2026-08-15");
test("een lege waardering-bij-aankoop wordt wel aangevuld", r.data.posities[1].waarderingBijAankoop === "P/E 10x");
test("posities die niet in de startdata staan blijven ongemoeid", r.data.posities[2].naam === "ASML" && r.data.posities[2].verkoopTrigger === undefined);
test("alle lege referentiesecties worden gevuld", r.data.onderzochtAfgewezen.length === 1 && r.data.preIpoVolgen.length === 1 && r.data.bronbelasting.length === 1 && r.data.bronbelastingNietOnderzocht === "Duitsland" && r.data.openstaandeBeslissingen.length === 1);
test("er wordt aangegeven dat er iets gewijzigd is", r.gewijzigd === true);
test("het origineel wordt niet gemuteerd", oud.posities[0].verkoopTrigger === "" && oud.onderzochtAfgewezen.length === 0);
const r2 = vulStartdataAan(r.data, seed);
test("een tweede keer draaien wijzigt niets (versie-vlag)", r2.gewijzigd === false && r2.data === r.data);
const bewustLeeg = { ...r.data, posities: r.data.posities.map(p => p.ticker === "DHR" ? { ...p, verkoopTrigger: "" } : p) };
test("een bewust leeggemaakte trigger komt na de eerste keer niet terug", vulStartdataAan(bewustLeeg, seed).data.posities[0].verkoopTrigger === "");
const aangepast = { ...oud, onderzochtAfgewezen: [{ naam: "Eigen", reden: "eigen" }] };
test("een al gevulde sectie wordt niet overschreven", vulStartdataAan(aangepast, seed).data.onderzochtAfgewezen[0].naam === "Eigen");
test("zonder posities-array crasht het niet", vulStartdataAan({}, seed).data.posities.length === 0);

samenvatting();
