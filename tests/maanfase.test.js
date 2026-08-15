const { laadFuncties } = require("./extractie.js");
const { sectie, test, samenvatting } = require("./testhulp.js");

sectie("Maanfase-berekening — getest tegen geverifieerde volle-maan-data");

// Haalt de ECHTE, actuele functie rechtstreeks uit gezondheid.js — geen
// kopie, dus deze test loopt automatisch mee als de berekening ooit wijzigt.
const { berekenMaanfase } = laadFuncties("../pages/gezondheid.js", [
  /const MAAN_REFERENTIE = /,
  /const SYNODISCHE_MAAND = /,
  /const MAANFASEN = /,
  /function berekenMaanfase\(datumStr\)/,
]);

// Referentiedata: NASA/AstroPixels-geverifieerde volle manen (bron: fullmoonwatch.com).
sectie("Bekende volle manen geven ~100% illuminatie");
test("21 januari 2000 (volle maan 04:40 UTC) is 'Volle maan'", berekenMaanfase("2000-01-21").illuminatie >= 95);
test("11 december 2000 (volle maan 09:03 UTC) is 'Volle maan'", berekenMaanfase("2000-12-11").illuminatie >= 95);
test("21 januari 2000 krijgt het juiste label", berekenMaanfase("2000-01-21").label === "Volle maan");

sectie("Cyclus is intern consistent");
const eersteFase = berekenMaanfase("2026-01-01");
const eenCyclusLater = berekenMaanfase("2026-01-30"); // ~29,5 dagen verder
test("Illuminatie herhaalt zich na ~1 synodische maand", Math.abs(eersteFase.illuminatie - eenCyclusLater.illuminatie) < 15);

let alleTussen0en100 = true;
for (let dag = 1; dag <= 28; dag++) {
  const val = berekenMaanfase(`2026-02-${String(dag).padStart(2,"0")}`).illuminatie;
  if (val < 0 || val > 100) alleTussen0en100 = false;
}
test("Illuminatie zit altijd tussen 0 en 100 (hele maand doorgelopen)", alleTussen0en100);

samenvatting();
