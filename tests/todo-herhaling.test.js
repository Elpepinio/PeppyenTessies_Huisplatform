const { laadFuncties } = require("./extractie.js");
const { sectie, test, samenvatting } = require("./testhulp.js");

sectie("To-do herhaling — volgende vervaldatum berekenen");

// Haalt de ECHTE, actuele functie rechtstreeks uit lijsten.js — geen kopie.
const { volgendeHerhaling } = laadFuncties("../pages/lijsten.js", [
  /function datumNaarStr\(d\)/,
  /function volgendeHerhaling\(huidigeDatumStr, type\)/,
]);

sectie("Dagelijks en wekelijks — geen bijzonderheden");
test("31 januari + dagelijks = 1 februari", volgendeHerhaling("2026-01-31", "dagelijks") === "2026-02-01");
test("19 augustus + wekelijks = 26 augustus", volgendeHerhaling("2026-08-19", "wekelijks") === "2026-08-26");

sectie("Maandelijks — het randgeval waar JS' setMonth() van nature fout gaat");
test("31 januari 2026 (geen schrikkeljaar) + maandelijks = 28 februari (niet 3 maart!)",
  volgendeHerhaling("2026-01-31", "maandelijks") === "2026-02-28");
test("31 januari 2024 (WEL schrikkeljaar) + maandelijks = 29 februari",
  volgendeHerhaling("2024-01-31", "maandelijks") === "2024-02-29");
test("31 maart + maandelijks = 30 april (april heeft geen 31 dagen)",
  volgendeHerhaling("2026-03-31", "maandelijks") === "2026-04-30");
test("15 mei + maandelijks = 15 juni (normale maand: dag blijft simpelweg gelijk)",
  volgendeHerhaling("2026-05-15", "maandelijks") === "2026-06-15");

sectie("Maandelijks — jaarovergang");
test("15 december + maandelijks = 15 januari van het jaar erna",
  volgendeHerhaling("2026-12-15", "maandelijks") === "2027-01-15");

samenvatting();
