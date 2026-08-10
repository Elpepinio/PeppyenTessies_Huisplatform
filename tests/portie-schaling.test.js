const { laadFuncties } = require("./extractie.js");
const { sectie, test, samenvatting } = require("./testhulp.js");

sectie("Portie-schaling naar boodschappenlijst — echte parseHoeveelheid uit de broncode");

// Haalt de ECHTE, actuele parseHoeveelheid-functie (en de UNICODE_BREUKEN
// waar die van afhangt) rechtstreeks uit maaltijden.js — geen kopie, dus
// deze test loopt automatisch mee als die functie ooit wijzigt.
const { parseHoeveelheid } = laadFuncties("../pages/maaltijden.js", [
  /const UNICODE_BREUKEN = /,
  /function parseHoeveelheid\(waarde\)/,
]);

// ── Voorbeeldrecept: "Lasagne", standaard 6 personen ──────────────────────
const recept = {
  id: "r1",
  naam: "Lasagne",
  porties: 6,
  ingredienten: [
    { naam: "Gehakt", hoeveelheid: "600", eenheid: "g" },
    { naam: "Lasagnebladen", hoeveelheid: "12", eenheid: "stuks" },
    { naam: "Ui", hoeveelheid: "1 1/2", eenheid: "stuks" },   // breuk, komt uit AI-scan
    { naam: "Room", hoeveelheid: "0,5", eenheid: "l" },        // NL-komma-notatie
  ],
};

// ── Reproduceert exact de aggregatielogica uit stuurIngredientenNaarBoodschappen ──
function berekenBoodschappenHoeveelheden(recept, gekozenPorties) {
  const ingredienten = {};
  const p = gekozenPorties || recept.porties || 4;
  const schaal = p / (recept.porties || 4);
  recept.ingredienten.forEach(i => {
    const key = i.naam.toLowerCase();
    if (!ingredienten[key]) ingredienten[key] = { naam: i.naam, hoeveelheid: 0, eenheid: i.eenheid };
    ingredienten[key].hoeveelheid += parseHoeveelheid(i.hoeveelheid) * schaal;
  });
  return ingredienten;
}

sectie("Afschalen: 6 → 4 personen (jouw exacte voorbeeld)");
const naar4 = berekenBoodschappenHoeveelheden(recept, 4);
test("Gehakt: 600g × (4/6) = 400g", Math.abs(naar4["gehakt"].hoeveelheid - 400) < 0.01);
test("Lasagnebladen: 12 × (4/6) = 8 stuks", Math.abs(naar4["lasagnebladen"].hoeveelheid - 8) < 0.01);
test("Ui (breuk '1 1/2'): 1.5 × (4/6) = 1 stuk", Math.abs(naar4["ui"].hoeveelheid - 1) < 0.01);
test("Room (komma '0,5'): 0.5 × (4/6) = 0,333 l", Math.abs(naar4["room"].hoeveelheid - 0.3333) < 0.001);
test("NIET de originele 600g gebruikt (dat zou de bug zijn)", Math.round(naar4["gehakt"].hoeveelheid) !== 600);

sectie("Ophogen: 6 → 8 personen (symmetrie-check)");
const naar8 = berekenBoodschappenHoeveelheden(recept, 8);
test("Gehakt: 600g × (8/6) = 800g", Math.abs(naar8["gehakt"].hoeveelheid - 800) < 0.01);
test("Lasagnebladen: 12 × (8/6) = 16 stuks", Math.abs(naar8["lasagnebladen"].hoeveelheid - 16) < 0.01);

sectie("Geen aanpassing: gewoon de standaard 6 personen aanhouden");
const standaard = berekenBoodschappenHoeveelheden(recept, null); // simuleert porties[id] niet gezet
test("Gehakt blijft 600g (schaal = 1)", Math.abs(standaard["gehakt"].hoeveelheid - 600) < 0.01);

sectie("Wat Math.ceil() er tenslotte van maakt (zo verschijnt het op de lijst)");
test("400g gehakt → 400 op de lijst", Math.ceil(naar4["gehakt"].hoeveelheid) === 400);
test("1 stuk ui → 1 op de lijst (niet afgerond naar 2)", Math.ceil(naar4["ui"].hoeveelheid) === 1);

samenvatting();
