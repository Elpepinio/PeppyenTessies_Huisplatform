const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test, samenvatting } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "pages", "lijsten.js");

const { berekenVolgendeItems } = laadFuncties(BESTAND, [
  /function berekenVolgendeItems\(items, modus\)/,
]);

sectie("Boodschappenlijst — 'Klaar met boodschappen'-opties (bewaren/leegmaken/afgevinkt verwijderen)");

const lijst = [
  { name: "Rode paprika", checked: true },
  { name: "Roma tomaten", checked: true },
  { name: "Melk", checked: false },
  { name: "Brood", checked: false },
];

const resAfgevinkt = berekenVolgendeItems(lijst, "afgevinktVerwijderen");
test("afgevinktVerwijderen laat alleen de niet-afgevinkte items over", resAfgevinkt.length === 2 && resAfgevinkt.every(i => !i.checked));
test("afgevinktVerwijderen laat de juiste (niet-afgevinkte) items met naam over",
  resAfgevinkt.map(i => i.name).sort().join(",") === "Brood,Melk");
test("afgevinktVerwijderen wijzigt de overgebleven items verder niet", resAfgevinkt.every(i => i.checked === false));

test("leegmaken geeft altijd een lege lijst", berekenVolgendeItems(lijst, "leegmaken").length === 0);

const resBewaren = berekenVolgendeItems(lijst, "bewaren");
test("bewaren behoudt alle items", resBewaren.length === 4);
test("bewaren ontvinkt alle items (ook inCart wordt gereset)", resBewaren.every(i => i.checked === false));

const allesAfgevinkt = [{ name: "A", checked: true }, { name: "B", checked: true }];
test("als alles is afgevinkt, gedraagt afgevinktVerwijderen zich hetzelfde als leegmaken",
  berekenVolgendeItems(allesAfgevinkt, "afgevinktVerwijderen").length === 0);

const nietsAfgevinkt = [{ name: "A", checked: false }];
test("als niets is afgevinkt, blijft bij afgevinktVerwijderen de hele lijst gewoon staan",
  berekenVolgendeItems(nietsAfgevinkt, "afgevinktVerwijderen").length === 1);

test("een lege lijst crasht niet, voor geen enkele modus",
  berekenVolgendeItems([], "afgevinktVerwijderen").length === 0 &&
  berekenVolgendeItems([], "leegmaken").length === 0 &&
  berekenVolgendeItems([], "bewaren").length === 0);

samenvatting();
