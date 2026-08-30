const { laadFuncties } = require("./extractie.js");
const { sectie, test, samenvatting } = require("./testhulp.js");

sectie("Weer-tool — geëxtraheerd uit de echte broncode van weer.js");

const { berekenZonPositie, berekenMaanfase, kledingAdvies, fietsWaarschuwing } = laadFuncties("../pages/weer.js", [
  /function berekenZonPositie\(lat, lon, datum = new Date\(\)\)/,
  /const MAAN_REFERENTIE = /,
  /const SYNODISCHE_MAAND = /,
  /const MAANFASEN = /,
  /function berekenMaanfase\(datum = new Date\(\)\)/,
  /function kledingAdvies\(/,
  /function fietsWaarschuwing\(/,
]);

// ── Zonpositie — getest tegen bekende astronomische referentiepunten
//    (Tilburg, lat 51.56 lon 5.09) ──────────────────────────────────────
sectie("Zonpositie — zomerzonnewende, winterzonnewende, nacht, zonsopgang");
const zomerMiddag = berekenZonPositie(51.56, 5.09, new Date(Date.UTC(2026,5,21,11,40)));
test("21 juni rond zonne-middag: azimut ~180° (zuid)", Math.abs(zomerMiddag.azimut - 180) < 2);
test("21 juni rond zonne-middag: hoge elevatie (~62°, zomerzonnewende)", Math.abs(zomerMiddag.elevatie - 62) < 2);

const winterMiddag = berekenZonPositie(51.56, 5.09, new Date(Date.UTC(2026,11,21,11,40)));
test("21 december rond zonne-middag: azimut ~180° (zuid)", Math.abs(winterMiddag.azimut - 180) < 2);
test("21 december rond zonne-middag: lage elevatie (~15°, winterzonnewende)", Math.abs(winterMiddag.elevatie - 15) < 2);

const nacht = berekenZonPositie(51.56, 5.09, new Date(Date.UTC(2026,5,21,2,0)));
test("2 uur 's nachts: zon staat onder de horizon (negatieve elevatie)", nacht.elevatie < 0);

const zonsopgang = berekenZonPositie(51.56, 5.09, new Date(Date.UTC(2026,5,21,5,0)));
test("rond zonsopgang in juni: zon staat richting het oosten (azimut tussen 40-90°)", zonsopgang.azimut > 40 && zonsopgang.azimut < 90);
test("rond zonsopgang: elevatie laag maar positief of net onder de horizon", zonsopgang.elevatie < 20);

// ── Maanfase — dezelfde 2 onafhankelijk bevestigde referentiepunten als
//    eerder gebruikt in de Gezondheid-tool ─────────────────────────────
sectie("Maanfase — zelfde geverifieerde berekening als in Gezondheid");
test("21 januari 2000 (bevestigde volle maan) geeft ~100% illuminatie",
  berekenMaanfase(new Date(Date.UTC(2000,0,21,4,40))).illuminatie >= 95);
test("11 december 2000 (bevestigde volle maan) geeft ~100% illuminatie",
  berekenMaanfase(new Date(Date.UTC(2000,11,11,9,3))).illuminatie >= 95);

// ── Kledingadvies ────────────────────────────────────────────────────────
sectie("Kledingadvies reageert op temperatuur, wind, UV en regenkans");
test("koud (2°C) geeft advies voor dikke jas", kledingAdvies({ temperatuur: 2 }).some(a => a.includes("Dikke jas")));
test("warm (28°C) geeft zomerkleding-advies", kledingAdvies({ temperatuur: 28 }).some(a => a.includes("Zomerkleding")));
test("hoge UV (8) geeft insmeer-advies", kledingAdvies({ temperatuur: 20, uvMax: 8 }).some(a => a.includes("Smeer je in")));
test("lage UV (2) geeft GEEN insmeer-advies", !kledingAdvies({ temperatuur: 20, uvMax: 2 }).some(a => a.includes("Smeer je in")));
test("hoge regenkans (70%) geeft paraplu-advies", kledingAdvies({ temperatuur: 15, regenkansMax: 70 }).some(a => a.includes("paraplu")));
test("lage regenkans (10%) geeft GEEN paraplu-advies", !kledingAdvies({ temperatuur: 15, regenkansMax: 10 }).some(a => a.includes("paraplu")));

// ── Fietswaarschuwing — reproduceert de exacte tijdvensters uit de vraag
//    van de gebruiker (07-09u en 16-19u) ───────────────────────────────
sectie("Fietswaarschuwing — controleert specifiek de opgegeven spitstijden");
function maakUurData(vandaag, urenMetRegenkans) {
  const time = [], precipitation_probability = [], precipitation = [];
  for (let u = 0; u < 24; u++) {
    time.push(`${vandaag}T${String(u).padStart(2,"0")}:00`);
    precipitation_probability.push(urenMetRegenkans[u] ?? 0);
    precipitation.push(0);
  }
  return { time, precipitation_probability, precipitation };
}
const vandaagIso = new Date().toISOString().slice(0,10);

const regenOm8Uur = maakUurData(vandaagIso, { 8: 70 });
const waarschuwingenOchtend = fietsWaarschuwing(regenOm8Uur);
test("70% regenkans om 8 uur triggert een waarschuwing voor het 07-09-venster", waarschuwingenOchtend.some(w => w.venster === "7:00–9:00"));

const droogDag = maakUurData(vandaagIso, {});
test("een volledig droge dag geeft geen enkele waarschuwing", fietsWaarschuwing(droogDag).length === 0);

const regenOmMiddag = maakUurData(vandaagIso, { 13: 80 });
test("regen om 13:00 (buiten beide fietsvensters) geeft GEEN waarschuwing", fietsWaarschuwing(regenOmMiddag).length === 0);

const regenBeideVensters = maakUurData(vandaagIso, { 8: 60, 17: 90 });
const beideWaarschuwingen = fietsWaarschuwing(regenBeideVensters);
test("regen in zowel het ochtend- als avondvenster geeft 2 losse waarschuwingen", beideWaarschuwingen.length === 2);

samenvatting();
