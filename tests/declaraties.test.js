const { laadFuncties } = require("./extractie.js");
const { sectie, test, samenvatting } = require("./testhulp.js");

sectie("Declaraties — geëxtraheerd uit de echte broncode van declaraties.js");

const { kwartaalVan, bedragVoorItem, kmVoorItem, berekenPeriodeBereik, vandaagStr, persoonKleur, berekenLocatieFavorieten, berekenOvOmschrijvingFavorieten, naamVoorFavoriet } = laadFuncties("../pages/declaraties.js", [
  /const KM_TARIEF = /,
  /const PERSONEN = /,
  /const VERVOERMIDDELEN = /,
  /function vervoermiddelInfo\(id\)/,
  /function persoonKleur\(naam\)/,
  /function naamVoorFavoriet\(item\)/,
  /function vandaagStr\(\)/,
  /function kwartaalVan\(datumStr\)/,
  /function bedragVoorItem\(item\)/,
  /function kmVoorItem\(item\)/,
  /function berekenLocatieFavorieten\(items, type, veld, max = 6\)/,
  /function berekenOvOmschrijvingFavorieten\(items, max = 6\)/,
  /function berekenPeriodeBereik\(preset, jaar\)/,
]);

sectie("Favorieten — leesbare naam per declaratietype");
test("kilometer-favoriet toont van → naar, met (retour) indien van toepassing",
  naamVoorFavoriet({ type:"kilometer", van:"Huis", naar:"Klant X", retour:true }) === "Huis → Klant X (retour)");
test("kilometer-favoriet zonder retour laat dat achterwege",
  naamVoorFavoriet({ type:"kilometer", van:"Huis", naar:"Klant X", retour:false }) === "Huis → Klant X");
test("parkeren-favoriet toont de locatie", naamVoorFavoriet({ type:"parkeren", locatie:"Garage Centrum" }) === "Garage Centrum");
test("OV-favoriet toont de vervoermiddel-iconen van alle trajectdelen op een rij",
  naamVoorFavoriet({ type:"ov", ritten:[{vervoermiddel:"trein"},{vervoermiddel:"ovfiets"},{vervoermiddel:"trein"}], project:"Project Y" }) === "🚆🚲🚆 · Project Y");
test("overig-favoriet valt terug op de omschrijving", naamVoorFavoriet({ type:"overig", omschrijving:"Zakelijk etentje" }) === "Zakelijk etentje");
test("een favoriet zonder enige herkenbare tekst crasht niet, geeft een nette terugval", typeof naamVoorFavoriet({ type:"overig" }) === "string");

sectie("OV — meerdere trajectdelen per declaratie (trein heen, OV-fiets, trein terug, bus terug)");
const ovMetVierDelen = {
  type: "ov",
  ritten: [
    { vervoermiddel: "trein",   omschrijving: "Tilburg-Utrecht", bedrag: 8.40 },
    { vervoermiddel: "ovfiets", omschrijving: "",                bedrag: 4.55 },
    { vervoermiddel: "trein",   omschrijving: "Utrecht-Tilburg", bedrag: 8.40 },
    { vervoermiddel: "bus",     omschrijving: "",                bedrag: 2.10 },
  ],
};
test("het totaalbedrag is de som van alle trajectdelen", bedragVoorItem(ovMetVierDelen) === 23.45);
test("een OV-declaratie met één trajectdeel telt ook gewoon correct op",
  bedragVoorItem({ type: "ov", ritten: [{ vervoermiddel: "bus", bedrag: 3.20 }] }) === 3.2);
test("oudere OV-declaraties zonder ritten (vóór deze functie) vallen terug op het oude, losse bedrag-veld",
  bedragVoorItem({ type: "ov", bedrag: 12.50 }) === 12.5);
test("een lege trajectdelen-lijst geeft 0, geen crash", bedragVoorItem({ type: "ov", ritten: [] }) === 0);

sectie("Favoriete locaties — meest gebruikt eerst");
const testItems = [
  { type: "kilometer", van: "Huis", naar: "Kantoor A", toegevoegdOp: 1000 },
  { type: "kilometer", van: "Huis", naar: "Kantoor A", toegevoegdOp: 2000 },
  { type: "kilometer", van: "Huis", naar: "Kantoor B", toegevoegdOp: 3000 },
  { type: "parkeren", locatie: "Garage Centrum", toegevoegdOp: 1500 },
];
test("'Huis' is de vaakst gebruikte 'van'-locatie voor kilometerdeclaraties",
  berekenLocatieFavorieten(testItems, "kilometer", "van")[0] === "Huis");
test("favorieten van een ander declaratietype (parkeren) blijven gescheiden van kilometer-favorieten",
  berekenLocatieFavorieten(testItems, "parkeren", "locatie").includes("Garage Centrum") &&
  !berekenLocatieFavorieten(testItems, "kilometer", "van").includes("Garage Centrum"));

sectie("Favoriete OV-trajectomschrijvingen — genest in ritten[]");
const ovItems = [
  { type: "ov", toegevoegdOp: 1000, ritten: [{ vervoermiddel: "trein", omschrijving: "Tilburg-Utrecht", bedrag: 8.4 }] },
  { type: "ov", toegevoegdOp: 2000, ritten: [{ vervoermiddel: "trein", omschrijving: "Tilburg-Utrecht", bedrag: 8.4 }] },
];
test("een vaak gebruikte trajectomschrijving wordt herkend als favoriet", berekenOvOmschrijvingFavorieten(ovItems)[0] === "Tilburg-Utrecht");

sectie("Enkele reis vs. retour");
test("20 km enkele reis à €0,23 = €4,60", bedragVoorItem({ type:"kilometer", km:20, tarief:0.23, retour:false }) === 4.6);
test("20 km retour = exact het dubbele bedrag (€9,20)", bedragVoorItem({ type:"kilometer", km:20, tarief:0.23, retour:true }) === 9.2);
test("kmVoorItem verdubbelt bij retour", kmVoorItem({ km:20, retour:true }) === 40);
test("kmVoorItem laat enkele reis ongewijzigd", kmVoorItem({ km:20, retour:false }) === 20);
test("oudere registraties zonder het retour-veld (undefined) blijven een enkele reis, geen crash",
  kmVoorItem({ km:15 }) === 15 && bedragVoorItem({ type:"kilometer", km:15, tarief:0.23 }) === Math.round(15*0.23*100)/100);

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
