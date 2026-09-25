const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test, samenvatting } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "pages", "budget.js");

// euro() wordt hier bewust NIET geëxtraheerd, maar als context meegegeven —
// de extractietool telt accolades naïef, en euro()'s eigen definitie heeft
// een geneste accolade binnen een template-literal-interpolatie
// (toLocaleString("nl-NL", {...}) binnen ${...}), waardoor de telling te
// vroeg zou stoppen. Dit is een exacte kopie van de echte implementatie.
const euro = n => `€${(+n).toLocaleString("nl-NL",{minimumFractionDigits:0,maximumFractionDigits:0})}`;

const { projecteerEindeMaand, nettoExpensesFilter, isVermoedelijkOverboeking, bouwAlgemeneContext, bouwCategorieContext, categorieUitAlert } = laadFuncties(
  BESTAND,
  [
    /^const CATEGORIES = /m,
    /^const fmtM = /m,
    /^function projecteerEindeMaand\(/m,
    /^function nettoExpensesFilter\(/m,
    /^const OVERBOEKING_PATROON = /m,
    /^function isVermoedelijkOverboeking\(/m,
    /^function bouwAlgemeneContext\(/m,
    /^function bouwCategorieContext\(/m,
    /^function categorieUitAlert\(/m,
  ],
  { euro },
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

sectie("AI-chat — context-opbouw (categorieherkenning al eerder getest)");

test("categorieUitAlert herkent het exacte scenario uit de melding ('Persoonlijke verzorging +30% vs gemiddelde')",
  categorieUitAlert("Persoonlijke verzorging +30% vs gemiddelde") === "Persoonlijke verzorging");
test("categorieUitAlert herkent 'Budget overschreden: Cat'", categorieUitAlert("Budget overschreden: Boodschappen") === "Boodschappen");
test("categorieUitAlert geeft null bij een melding zonder categorie (geen crash)",
  categorieUitAlert("P. Robben nog niet gezien deze maand") === null);

const algemeneContext = bouwAlgemeneContext(
  [{ category: "Boodschappen", amount: 120, month: "2026-09" }, { category: "Wonen", amount: 900, month: "2026-09" }],
  [{ category: "Boodschappen", amount: 150, period: "maand" }],
  "2026-09", 2500, 1020,
);
test("de algemene context bevat de maand", algemeneContext.includes("Sep '26"));
test("de algemene context bevat het inkomen en het totaal uitgegeven", algemeneContext.includes("€2.500") && algemeneContext.includes("€1.020"));
test("de algemene context somt de categorieën op, grootste eerst", algemeneContext.indexOf("Wonen") < algemeneContext.indexOf("Boodschappen"));
test("de algemene context bevat het ingestelde budget", algemeneContext.includes("Boodschappen: budget €150"));

const categorieContext = bouwCategorieContext(
  [
    { name: "Kapper", amount: 45, category: "Persoonlijke verzorging", month: "2026-09" },
    { name: "Drogist", amount: 30, category: "Persoonlijke verzorging", month: "2026-09" },
    { name: "Kapper", amount: 40, category: "Persoonlijke verzorging", month: "2026-08" },
  ],
  "Persoonlijke verzorging", "2026-09", "2026-08",
);
test("de categorie-context noemt de losse aankopen van deze maand bij naam (precies wat 'ik kan er niks mee' oplost)",
  categorieContext.includes("Kapper") && categorieContext.includes("Drogist"));
test("de categorie-context vergelijkt met de vorige maand", categorieContext.includes("Aug '26"));
test("genegeerde transacties tellen niet mee in de categorie-context", (() => {
  const metGenegeerd = bouwCategorieContext(
    [{ name: "Genegeerd item", amount: 999, category: "Persoonlijke verzorging", month: "2026-09", genegeerd: true }],
    "Persoonlijke verzorging", "2026-09", "2026-08",
  );
  return !metGenegeerd.includes("Genegeerd item");
})());

samenvatting();
