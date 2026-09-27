const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test, samenvatting } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "pages", "lijsten.js");

const { berekenVolgendeItems, itemsGekochtDezeRonde } = laadFuncties(BESTAND, [
  /function itemsGekochtDezeRonde\(items\)/,
  /function berekenVolgendeItems\(items, modus\)/,
]);

sectie("Boodschappenlijst — 'Klaar met boodschappen'-opties (bewaren/leegmaken/afgevinkt verwijderen)");

// Realistisch pakken-modus-scenario: ALLE items hebben checked:true — dat is
// nu eenmaal de voorwaarde om in pakken-modus te verschijnen. Het onderscheid
// "al gepakt of niet" zit uitsluitend in inCart. Dit exacte punt was de bug
// die gemeld werd: alles verdween, inclusief het ene item dat nog niet was
// gepakt, omdat er destijds op checked i.p.v. inCart werd gefilterd.
const pakkenLijst = [
  { name: "Rode paprika", checked: true, inCart: true },
  { name: "Roma tomaten", checked: true, inCart: true },
  { name: "Melk", checked: true, inCart: false },
  { name: "Brood", checked: true, inCart: false },
];

const resAfgevinkt = berekenVolgendeItems(pakkenLijst, "afgevinktVerwijderen");
test("afgevinktVerwijderen laat alleen de nog niet gepakte items (inCart:false) over, ondanks dat ALLE items checked:true hebben",
  resAfgevinkt.length === 2 && resAfgevinkt.every(i => !i.inCart));
test("afgevinktVerwijderen laat de juiste (nog niet gepakte) items met naam over",
  resAfgevinkt.map(i => i.name).sort().join(",") === "Brood,Melk");
test("afgevinktVerwijderen wijzigt de overgebleven items verder niet (checked blijft gewoon true)",
  resAfgevinkt.every(i => i.checked === true && i.inCart === false));

test("leegmaken geeft altijd een lege lijst", berekenVolgendeItems(pakkenLijst, "leegmaken").length === 0);

const resBewaren = berekenVolgendeItems(pakkenLijst, "bewaren");
test("bewaren behoudt alle items", resBewaren.length === 4);
test("bewaren ontvinkt alle items én haalt ze uit de kar (checked én inCart terug naar false)",
  resBewaren.every(i => i.checked === false && i.inCart === false));

const allesGepakt = [{ name: "A", checked: true, inCart: true }, { name: "B", checked: true, inCart: true }];
test("als alles al gepakt is, gedraagt afgevinktVerwijderen zich hetzelfde als leegmaken",
  berekenVolgendeItems(allesGepakt, "afgevinktVerwijderen").length === 0);

const nietsGepakt = [{ name: "A", checked: true, inCart: false }];
test("als niets nog gepakt is, blijft bij afgevinktVerwijderen de hele lijst gewoon staan",
  berekenVolgendeItems(nietsGepakt, "afgevinktVerwijderen").length === 1);

test("een lege lijst crasht niet, voor geen enkele modus",
  berekenVolgendeItems([], "afgevinktVerwijderen").length === 0 &&
  berekenVolgendeItems([], "leegmaken").length === 0 &&
  berekenVolgendeItems([], "bewaren").length === 0);

sectie("Bevestiging: een niet-gepakt item wordt nooit stilletjes verwijderd of als 'gekocht' geteld");
const itemMetVolledigeData = { id: "x1", name: "Melk", category: "zuivel", amount: 2, unit: "L", checked: true, inCart: false };
const resVolledig = berekenVolgendeItems([itemMetVolledigeData], "afgevinktVerwijderen");
test("het overgebleven item is het exact hetzelfde object — niets wordt herbouwd of gewist", resVolledig[0] === itemMetVolledigeData);
test("het overgebleven item behoudt al zijn velden (hoeveelheid, eenheid, categorie)",
  resVolledig[0].amount === 2 && resVolledig[0].unit === "L" && resVolledig[0].category === "zuivel");

const rondeMetGemengdeStatus = [
  { name: "Rode paprika", inCart: true },
  { name: "Melk", inCart: false },
];
const gekocht = itemsGekochtDezeRonde(rondeMetGemengdeStatus);
test("itemsGekochtDezeRonde telt alleen daadwerkelijk gepakte items mee", gekocht.length === 1 && gekocht[0].name === "Rode paprika");
test("een niet-gepakt item wordt NOOIT als gekocht geteld (voorkomt onterechte koopfrequentie-registratie)",
  !gekocht.some(i => i.name === "Melk"));

samenvatting();
