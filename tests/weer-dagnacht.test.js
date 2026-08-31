const { laadFuncties } = require("./extractie.js");
const { sectie, test, samenvatting } = require("./testhulp.js");

sectie("Weer — dag/nacht-iconen (geen zon meer 's nachts)");

const { weerInfo } = laadFuncties("../pages/weer.js", [
  /const WEERCODE_INFO = /,
  /function weerInfo\(code, isDay = 1\)/,
]);

sectie("Zonafhankelijke weercodes wisselen tussen zon- en maanicoon");
test("code 0 (helder) overdag toont een zon", weerInfo(0, 1).icon === "☀️");
test("code 0 (helder) 's nachts toont GEEN zon meer, maar een maan", weerInfo(0, 0).icon !== "☀️" && weerInfo(0, 0).icon === "🌙");
test("code 1 (overwegend helder) 's nachts toont ook geen zon", weerInfo(1, 0).icon !== "🌤️" && weerInfo(1, 0).icon === "🌙");
test("code 2 (half bewolkt) 's nachts toont geen zonnetje meer, wel nog een wolk", weerInfo(2, 0).icon === "☁️");

sectie("Weercodes die sowieso geen zon tonen blijven ongewijzigd, dag of nacht");
test("code 3 (bewolkt) is overdag en 's nachts identiek", weerInfo(3, 1).icon === weerInfo(3, 0).icon);
test("code 63 (regen) is overdag en 's nachts identiek", weerInfo(63, 1).icon === weerInfo(63, 0).icon);
test("code 95 (onweer) is overdag en 's nachts identiek", weerInfo(95, 1).icon === weerInfo(95, 0).icon);

sectie("Zonder expliciet is_day-veld (bv. de 7-daagse lijst) valt terug op dag-iconen");
test("weerInfo zonder tweede argument geeft het dag-icoon", weerInfo(0).icon === "☀️");

samenvatting();
