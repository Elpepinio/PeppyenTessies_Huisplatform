const { laadFuncties } = require("./extractie.js");
const { sectie, test, samenvatting } = require("./testhulp.js");

sectie("Regenradar — wind-verschuiving voor geschatte toekomst-frames");

const { windVerschuiving } = laadFuncties("../pages/weer-radar.js", [
  /function windVerschuiving\(lat, windSnelheidKmh, windRichtingGraden, offsetMinuten\)/,
]);
const { rondAfNaarVijfMinuten } = laadFuncties("../pages/weer-radar.js", [
  /function rondAfNaarVijfMinuten\(datum\)/,
]);

sectie("KNMI-nowcast — tijdstempel-afronding naar hele 5-minuten-stappen");
test("14:37:22 rondt af naar 14:35:00", rondAfNaarVijfMinuten(new Date("2026-08-30T14:37:22Z")).toISOString() === "2026-08-30T14:35:00.000Z");
test("14:40:00 (al exact op 5 min) blijft ongewijzigd", rondAfNaarVijfMinuten(new Date("2026-08-30T14:40:00Z")).toISOString() === "2026-08-30T14:40:00.000Z");
test("14:44:59 rondt naar beneden af naar 14:40:00 (nooit naar boven)", rondAfNaarVijfMinuten(new Date("2026-08-30T14:44:59Z")).toISOString() === "2026-08-30T14:40:00.000Z");

sectie("Richting — neerslag beweegt tegenovergesteld aan waar de wind vandaan komt");
const uitWest = windVerschuiving(51.56, 20, 270, 60);
test("wind uit het westen (270°) beweegt neerslag naar het oosten (positieve deltaLon)", uitWest.deltaLon > 0);
test("wind uit het westen geeft nauwelijks noord-zuid-verplaatsing", Math.abs(uitWest.deltaLat) < 0.001);

const uitNoord = windVerschuiving(51.56, 20, 0, 60);
test("wind uit het noorden (0°) beweegt neerslag naar het zuiden (negatieve deltaLat)", uitNoord.deltaLat < 0);
test("wind uit het noorden geeft nauwelijks oost-west-verplaatsing", Math.abs(uitNoord.deltaLon) < 0.001);

const uitOost = windVerschuiving(51.56, 20, 90, 60);
test("wind uit het oosten (90°) beweegt neerslag naar het westen (negatieve deltaLon)", uitOost.deltaLon < 0);

const uitZuid = windVerschuiving(51.56, 20, 180, 60);
test("wind uit het zuiden (180°) beweegt neerslag naar het noorden (positieve deltaLat)", uitZuid.deltaLat > 0);

sectie("Schaal — langer wachten of hardere wind geeft een grotere verplaatsing");
const kort = windVerschuiving(51.56, 20, 270, 30);
const lang = windVerschuiving(51.56, 20, 270, 120);
test("120 minuten vooruit geeft een grotere verplaatsing dan 30 minuten", Math.abs(lang.deltaLon) > Math.abs(kort.deltaLon));

const zachteWind = windVerschuiving(51.56, 10, 270, 60);
const hardeWind = windVerschuiving(51.56, 40, 270, 60);
test("hardere wind (40 km/u) geeft een grotere verplaatsing dan zachte wind (10 km/u)", Math.abs(hardeWind.deltaLon) > Math.abs(zachteWind.deltaLon));

test("windstil (0 km/u) geeft geen enkele verplaatsing", windVerschuiving(51.56, 0, 270, 60).deltaLon === 0 && windVerschuiving(51.56, 0, 270, 60).deltaLat === 0);

samenvatting();
