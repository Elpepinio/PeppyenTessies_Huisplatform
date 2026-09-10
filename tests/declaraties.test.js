const { laadFuncties } = require("./extractie.js");
const { sectie, test, samenvatting } = require("./testhulp.js");

sectie("Declaraties — geëxtraheerd uit de echte broncode van declaraties.js");

const { kwartaalVan, bedragVoorItem, berekenPeriodeBereik, vandaagStr, persoonKleur } = laadFuncties("../pages/declaraties.js", [
  /const KM_TARIEF = /,
  /const PERSONEN = /,
  /function persoonKleur\(naam\)/,
  /function vandaagStr\(\)/,
  /function kwartaalVan\(datumStr\)/,
  /function bedragVoorItem\(item\)/,
  /function berekenPeriodeBereik\(preset, jaar\)/,
]);

sectie("Persoon-koppeling");
test("Pepijn en Tessa krijgen elk hun eigen, verschillende kleur", persoonKleur("Pepijn") !== persoonKleur("Tessa"));
test("een onbekende naam crasht niet, geeft een neutrale kleur terug", typeof persoonKleur("Onbekend") === "string");

sectie("Kwartaalbepaling uit een datum");
test("januari valt in Q1", kwartaalVan("2026-01-15") === 1);
test("maart valt nog in Q1", kwartaalVan("2026-03-31") === 1);
test("april valt in Q2", kwartaalVan("2026-04-01") === 2);
test("juli valt in Q3", kwartaalVan("2026-07-04") === 3);
test("december valt in Q4", kwartaalVan("2026-12-31") === 4);

sectie("Bedragberekening per declaratietype");
test("kilometervergoeding = km × tarief", bedragVoorItem({ type: "kilometer", km: 42, tarief: 0.23 }) === Math.round(42*0.23*100)/100);
test("kilometervergoeding valt terug op het huidige tarief als er geen tarief is opgeslagen (oude data)",
  bedragVoorItem({ type: "kilometer", km: 10 }) === Math.round(10*0.23*100)/100);
test("parkeren/OV/overig gebruiken het opgeslagen bedrag direct", bedragVoorItem({ type: "parkeren", bedrag: 12.5 }) === 12.5);
test("ontbrekend bedrag geeft 0, geen crash", bedragVoorItem({ type: "overig" }) === 0);

sectie("Periode-berekening — vaste presets");
const nu = new Date();
const jaar = nu.getFullYear();
test("'deze maand' begint op de 1e van de huidige maand", berekenPeriodeBereik("deze-maand", jaar).van.endsWith("-01"));
test("'deze maand' eindigt vandaag", berekenPeriodeBereik("deze-maand", jaar).tot === vandaagStr());
test("'vorige maand' geeft een volledige maand (van dag 01 tot de laatste dag)",
  berekenPeriodeBereik("vorige-maand", jaar).van.endsWith("-01") && !berekenPeriodeBereik("vorige-maand", jaar).tot.endsWith("-01"));

sectie("Periode-berekening — kwartalen, ook over de jaargrens heen");
const ditKwartaal = berekenPeriodeBereik("dit-kwartaal", jaar);
test("'dit kwartaal' begint op de 1e dag van het huidige kwartaal", ditKwartaal.van.endsWith("-01"));
const verwachteStartMaand = (kwartaalVan(vandaagStr())-1)*3 + 1;
test("'dit kwartaal' start in de juiste maand", ditKwartaal.van === `${jaar}-${String(verwachteStartMaand).padStart(2,"0")}-01`);

const vorigKwartaal = berekenPeriodeBereik("vorig-kwartaal", jaar);
test("'vorig kwartaal' geeft een geldig van/tot-bereik terug", vorigKwartaal.van < vorigKwartaal.tot);
test("'vorig kwartaal' ligt volledig vóór 'dit kwartaal'", vorigKwartaal.tot < ditKwartaal.van);

samenvatting();
