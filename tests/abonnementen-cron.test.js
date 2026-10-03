const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test, samenvatting } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "pages", "api", "cron", "abonnementen-check.js");

const { vindTeMeldenDrempel, berekenLaatsteOpzegmoment, berekenDagenTot } = laadFuncties(BESTAND, [
  /const MELD_DREMPELS = /,
  /function berekenLaatsteOpzegmoment\(volgendeVerlengdatum, opzegtermijnDagen\)/,
  /function berekenDagenTot\(datum, vandaag = new Date\(\)\)/,
  /function vindTeMeldenDrempel\(dagenTot, gemeldeDagen\)/,
]);

sectie("Abonnementen-cron — welke opzeg-drempel moet gemeld worden, en wanneer niet opnieuw");
test("ruim op tijd (20 dagen): nog geen enkele drempel bereikt", vindTeMeldenDrempel(20, []) === null);
test("precies op de 14-dagen-drempel, nog niets gemeld: meldt 14", vindTeMeldenDrempel(14, []) === 14);
test("op de 14-dagen-drempel, al gemeld: geen dubbele melding", vindTeMeldenDrempel(14, [14]) === null);
test("op 5 dagen met 14 al gemeld, maar de 3-dagen-drempel nog niet bereikt (5 > 3): nog geen melding", vindTeMeldenDrempel(5, [14]) === null);
test("op de 3-dagen-drempel, 14 al gemeld: meldt nu 3", vindTeMeldenDrempel(3, [14]) === 3);
test("op de dag zelf (0 dagen), niets eerder gemeld: meldt 0, de meest urgente", vindTeMeldenDrempel(0, []) === 0);
test("een gemiste cron-run die van 20 direct naar 2 dagen springt: meldt alsnog de meest urgente nog-niet-gemelde drempel (3)",
  vindTeMeldenDrempel(2, []) === 3);
test("alle drempels al gemeld: geen nieuwe melding meer", vindTeMeldenDrempel(0, [14, 3, 0]) === null);
test("het opzegmoment ligt al in het verleden (negatief): geen zinvolle melding meer te sturen", vindTeMeldenDrempel(-2, []) === null);
test("geen dagenTot bekend (null): crasht niet, meldt niets", vindTeMeldenDrempel(null, []) === null);

sectie("Abonnementen-cron — hergebruikte opzegmoment-berekening (consistent met de hoofd-app)");
const opzegmoment = berekenLaatsteOpzegmoment("2026-03-01", 30);
test("verlengdatum 1 maart met 30 dagen opzegtermijn geeft 30 januari", opzegmoment.toISOString().slice(0, 10) === "2026-01-30");
test("berekenDagenTot werkt consistent met de rest van de app", berekenDagenTot(opzegmoment, new Date("2026-01-15")) === 15);

samenvatting();
