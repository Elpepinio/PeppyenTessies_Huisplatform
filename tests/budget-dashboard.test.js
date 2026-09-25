const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test, samenvatting } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "pages", "budget.js");

const { projecteerEindeMaand, nettoExpensesFilter, isVermoedelijkOverboeking } = laadFuncties(
  BESTAND,
  [/^function projecteerEindeMaand\(/m, /^function nettoExpensesFilter\(/m, /^const OVERBOEKING_PATROON = /m, /^function isVermoedelijkOverboeking\(/m],
);

sectie("Dashboard-herziening — 'op dit tempo'-projectie voor maandbudgetten");

const nuDag10 = new Date(2026, 3, 10); // 10 april 2026 — april heeft 30 dagen
const r1 = projecteerEindeMaand({ period: "maand", amount: 200 }, 100, "2026-04", "2026-04", nuDag10);
test("dag 10 van een 30-dagenmaand, €100 van €200 budget → projectie €300", r1.projectie === 300);
test("diezelfde situatie: al op koers voor 100 euro overschrijding, ook al is pas 50% opgemaakt", r1.overschrijding === 100);

const r2 = projecteerEindeMaand({ period: "maand", amount: 200 }, 50, "2026-04", "2026-04", nuDag10);
test("ruim binnen tempo geeft een lagere projectie dan het budget (geen overschrijding)", r2.projectie === 150 && r2.overschrijding < 0);

test("kwartaalbudget geeft nooit een maand-projectie (andere ritmiek)",
  projecteerEindeMaand({ period: "kwartaal", amount: 200 }, 100, "2026-04", "2026-04", nuDag10) === null);

test("jaarbudget geeft nooit een maand-projectie",
  projecteerEindeMaand({ period: "jaar", amount: 2000 }, 500, "2026-04", "2026-04", nuDag10) === null);

test("een afgesloten/andere maand dan de huidige geeft geen projectie (achteraf niets meer te voorspellen)",
  projecteerEindeMaand({ period: "maand", amount: 200 }, 100, "2026-03", "2026-04", nuDag10) === null);

test("nog niets uitgegeven geeft geen projectie (voorkomt een zinloze €0-projectie)",
  projecteerEindeMaand({ period: "maand", amount: 200 }, 0, "2026-04", "2026-04", nuDag10) === null);

const nuDag15 = new Date(2026, 3, 15); // dag 15 van 30
const r3 = projecteerEindeMaand({ period: "maand", amount: 300 }, 150, "2026-04", "2026-04", nuDag15);
test("exact op tempo (helft van de maand, helft van het budget) geeft projectie === budget", r3.projectie === 300 && r3.overschrijding === 0);

sectie("Sparen telt niet mee als uitgave (nettoExpensesFilter)");

test("een overboeking met categorie 'Sparen' wordt herkend als overboeking, ongeacht de naam",
  isVermoedelijkOverboeking("Willekeurige naam", "Sparen") === true);
test("een overboeking náár een herkenbare spaarrekening-naam wordt herkend, ook zonder de categorie 'Sparen'",
  isVermoedelijkOverboeking("Overboeking naar Spaarrekening", "Overig") === true);
test("Rabo Peaks (beleggen) wordt herkend via het naam-patroon",
  isVermoedelijkOverboeking("Rabo Peaks storting", "Overig") === true);
test("een gewone uitgave wordt NIET als overboeking gezien",
  isVermoedelijkOverboeking("Albert Heijn", "Boodschappen") === false);

const expensesMetSparen = [
  { name: "Albert Heijn", amount: 45, category: "Boodschappen", month: "2026-09" },
  { name: "Overboeking naar Spaarrekening", amount: 300, category: "Sparen", month: "2026-09" },
  { name: "Rabo Peaks", amount: 50, category: "Overig", month: "2026-09" },
  { name: "Netflix", amount: 12, category: "Abonnementen", month: "2026-09" },
];
const nettoResultaat = nettoExpensesFilter(expensesMetSparen);
test("sparen en beleggen worden uit de netto-uitgaven gefilterd — alleen de 2 échte uitgaven blijven over",
  nettoResultaat.length === 2 && nettoResultaat.every(e => e.name === "Albert Heijn" || e.name === "Netflix"));
test("het totaal van de overgebleven uitgaven is 57 (45+12), niet 407 (inclusief sparen)",
  nettoResultaat.reduce((s,e) => s+e.amount, 0) === 57);

samenvatting();
