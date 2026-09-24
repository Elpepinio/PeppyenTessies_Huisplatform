const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test, samenvatting } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "pages", "budget.js");

const { projecteerEindeMaand } = laadFuncties(
  BESTAND,
  [/^function projecteerEindeMaand\(/m],
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

samenvatting();
