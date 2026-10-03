const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test, samenvatting } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "pages", "lijsten.js");

const { berekenVolgendeItems, itemsGekochtDezeRonde } = laadFuncties(BESTAND, [
  /function itemsGekochtDezeRonde\(items\)/,
  /function berekenVolgendeItems\(items, modus\)/,
]);

sectie("Boodschappenlijst — 'Klaar met boodschappen'-opties (bewaren/leegmaken)");

// Realistisch pakken-modus-scenario: ALLE items hebben checked:true — dat is
// nu eenmaal de voorwaarde om in pakken-modus te verschijnen. Het onderscheid
// "al gepakt of niet" zit uitsluitend in inCart.
const pakkenLijst = [
  { name: "Rode paprika", checked: true, inCart: true },
  { name: "Roma tomaten", checked: true, inCart: true },
  { name: "Melk", checked: true, inCart: false },
  { name: "Brood", checked: true, inCart: false },
];

test("leegmaken geeft altijd een lege lijst", berekenVolgendeItems(pakkenLijst, "leegmaken").length === 0);

const resBewaren = berekenVolgendeItems(pakkenLijst, "bewaren");
test("bewaren behoudt alle items — ook de al gepakte (gekochte) items blijven gewoon op de lijst staan",
  resBewaren.length === 4);
test("bewaren ontvinkt alle items én haalt ze uit de kar (checked én inCart terug naar false), zodat je ze de volgende keer weer kunt aanvinken",
  resBewaren.every(i => i.checked === false && i.inCart === false));

// Regressietest voor de gemelde situatie: een losse "afgevinkte items
// verwijderen"-modus bestond eerder, en haalde gekochte items (inCart:true)
// definitief van de lijst — ook uit het aanvink-scherm waar je ze de
// volgende keer weer had willen selecteren. Op expliciet verzoek
// weggehaald: elke modus die niet "leegmaken" is, gedraagt zich nu als
// "bewaren" en behoudt dus ALTIJD alle items.
test("regressie: ALLE items blijven behouden, ongeacht welke modus-tekst wordt doorgegeven (zolang het geen 'leegmaken' is) — de vroegere verwijder-modus bestaat niet meer",
  berekenVolgendeItems(pakkenLijst, "afgevinktVerwijderen").length === 4 &&
  berekenVolgendeItems(pakkenLijst, "iets-anders").length === 4);

test("een lege lijst crasht niet, voor geen enkele modus",
  berekenVolgendeItems([], "leegmaken").length === 0 &&
  berekenVolgendeItems([], "bewaren").length === 0);

sectie("Bevestiging: een gekocht item wordt nooit stilletjes verwijderd of gewist — alleen de vinkjes resetten");
const itemMetVolledigeData = { id: "x1", name: "Melk", category: "zuivel", amount: 2, unit: "L", checked: true, inCart: true };
const resVolledig = berekenVolgendeItems([itemMetVolledigeData], "bewaren");
test("het item blijft in de lijst staan (wordt niet verwijderd)", resVolledig.length === 1);
test("het item behoudt al zijn velden (hoeveelheid, eenheid, categorie) — alleen checked/inCart resetten",
  resVolledig[0].amount === 2 && resVolledig[0].unit === "L" && resVolledig[0].category === "zuivel" && resVolledig[0].name === "Melk");

const rondeMetGemengdeStatus = [
  { name: "Rode paprika", inCart: true },
  { name: "Melk", inCart: false },
];
const gekocht = itemsGekochtDezeRonde(rondeMetGemengdeStatus);
test("itemsGekochtDezeRonde telt alleen daadwerkelijk gepakte items mee", gekocht.length === 1 && gekocht[0].name === "Rode paprika");
test("een niet-gepakt item wordt NOOIT als gekocht geteld (voorkomt onterechte koopfrequentie-registratie)",
  !gekocht.some(i => i.name === "Melk"));

samenvatting();
