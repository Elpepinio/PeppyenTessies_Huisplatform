const { laadFuncties } = require("./extractie.js");
const { sectie, test, samenvatting } = require("./testhulp.js");

sectie("Afvalkalender — Restafval+GFT en Papier+Plastic samenvoegen tot 1 kliko-kaartje");

const { groepeerKlikos } = laadFuncties("../pages/afvalkalender.js", [
  /const KLIKO_GROEPEN = /,
  /function groepeerKlikos\(ophalingen\)/,
]);

sectie("Twee gekoppelde typen op dezelfde dag worden samengevoegd");
const zelfdeDatum = [
  { date: "2026-08-25T00:00:00", name: "Papier", daysTillDate: 6 },
  { date: "2026-08-25T00:00:00", name: "Pbd", daysTillDate: 6 },
];
const samengevoegd = groepeerKlikos(zelfdeDatum);
test("resultaat bevat precies 1 kaartje i.p.v. 2", samengevoegd.length === 1);
test("het samengevoegde kaartje heeft de juiste naam", samengevoegd[0].naamOverride === "Papier + Plastic");
test("de datum klopt", samengevoegd[0].date === "2026-08-25T00:00:00");

sectie("Gekoppelde typen op VERSCHILLENDE dagen blijven los staan");
const verschillendeDatum = [
  { date: "2026-08-25T00:00:00", name: "Restafval", daysTillDate: 6 },
  { date: "2026-08-27T00:00:00", name: "Gft", daysTillDate: 8 },
];
const nietSamengevoegd = groepeerKlikos(verschillendeDatum);
test("blijven 2 losse kaartjes (geen gedeelde ophaaldag)", nietSamengevoegd.length === 2);
test("geen van beide heeft een naamOverride", !nietSamengevoegd[0].naamOverride && !nietSamengevoegd[1].naamOverride);

sectie("Niet-gekoppelde typen blijven altijd apart, ook al vallen ze samen");
const ongekoppeld = [
  { date: "2026-09-03T00:00:00", name: "Textiel", daysTillDate: 15 },
  { date: "2026-09-03T00:00:00", name: "Grofvuil", daysTillDate: 15 },
];
const resultaatOngekoppeld = groepeerKlikos(ongekoppeld);
test("Textiel en Grofvuil delen geen kliko, dus blijven 2 losse kaartjes", resultaatOngekoppeld.length === 2);

sectie("Gemengd scenario — realistische kalender met 5 ophalingen");
const gemengd = [
  { date: "2026-08-25T00:00:00", name: "Papier", daysTillDate: 6 },
  { date: "2026-08-25T00:00:00", name: "Pbd", daysTillDate: 6 },
  { date: "2026-08-27T00:00:00", name: "Gft", daysTillDate: 8 },
  { date: "2026-08-31T00:00:00", name: "Restafval", daysTillDate: 12 },
  { date: "2026-09-03T00:00:00", name: "Textiel", daysTillDate: 15 },
];
const resultaatGemengd = groepeerKlikos(gemengd);
test("5 ophalingen worden 4 kaartjes (1 samengevoegd + 3 los)", resultaatGemengd.length === 4);
test("de losse Gft/Restafval/Textiel-items zijn nog steeds aanwezig",
  resultaatGemengd.some(o => o.name === "Gft") &&
  resultaatGemengd.some(o => o.name === "Restafval") &&
  resultaatGemengd.some(o => o.name === "Textiel"));

samenvatting();
