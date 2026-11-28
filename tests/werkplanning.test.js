const fs = require("fs");
const path = require("path");
const { sectie, test, samenvatting } = require("./testhulp.js");
const lees = (f) => fs.readFileSync(path.join(__dirname, "../lib", f), "utf8").replace(/^import [\s\S]*?;$/gm, "").replace(/^export /gm, "");
const bron = ["taken-logica.js", "projecten-logica.js", "werkplanning-logica.js"].map(lees).join("\n");
const namen = [...new Set([...bron.matchAll(/^(?:function|const|let) ([A-Za-z_]\w*)/gm)].map(m => m[1]))];
const L = new Function(`${bron}\nreturn { ${namen.join(", ")} };`)();

sectie("Werkplanning over alle projecten");
const t = (id, d, extra = {}) => ({ id, name: id, category: "pre", dueDate: d, ...extra });
const lijsten = [
  { id: "A", name: "Häcker", project: { draaidag: "2026-12-09", klantId: "k1" }, items: [t("a1", "2026-12-07"), t("a2", "2026-12-07"), t("ppm", "2026-12-04", { onderdeelId: "ppm" }), t("edit", "2026-12-16", { category: "post", duur: 3 })] },
  { id: "B", name: "Jumbo", project: { draaidag: "2026-12-09", klantId: "k2" }, items: [t("b1", "2026-12-07"), t("b2", "2026-12-07"), t("klaar", "2026-12-07", { checked: true })] },
  { id: "C", name: "Taken", items: [t("c1", "2026-12-07"), t("c2", "2026-12-07"), t("c3", "2026-12-07"), t("c4", "2026-12-09")] },
  { id: "D", name: "Afgewezen", project: { draaidag: "2026-12-10", status: "afgewezen" }, items: [] },
];
const dagen = L.werkbelasting(lijsten, { vandaag: "2026-12-01", dagen: 21 });
const d = (x) => dagen.find(y => y.datum === x);
test("21 dagen", dagen.length === 21 && dagen[0].datum === "2026-12-01");
test("ma 7 dec: 7 deadlines over 3 lijsten → vol", d("2026-12-07").deadlines.length === 7 && d("2026-12-07").niveau === "vol");
test("afgevinkte taken tellen niet", !d("2026-12-07").deadlines.some(x => x.item.id === "klaar"));
test("vaste momenten apart", d("2026-12-04").momenten.length === 1 && d("2026-12-04").niveau === "rustig");
test("draaidag = vol, ook zonder taken", d("2026-12-09").draaidagen.length === 2 && d("2026-12-09").niveau === "vol");
test("afgewezen project telt niet mee", !d("2026-12-10").draaidagen.length);
test("duur: dagen ervoor tellen als 'bezig'", d("2026-12-14").bezig.length === 1 && d("2026-12-15").bezig.length === 1 && d("2026-12-16").deadlines.length === 1);
test("weekend gemarkeerd", d("2026-12-05").vrij === "Weekend");
const w = L.werkplanningWaarschuwingen(dagen);
test("dubbele draaidag gesignaleerd", w.some(x => x.soort === "dubbele-draaidag" && x.datum === "2026-12-09"));
test("piekdag gesignaleerd", w.some(x => x.soort === "piek" && x.datum === "2026-12-07"));
L.zetEigenVrijeDagen([{ van: "2026-12-07", tot: "2026-12-08" }]);
const metVrij = L.werkbelasting(lijsten, { vandaag: "2026-12-01", dagen: 21 });
test("eigen vrije dag gemarkeerd + waarschuwing", metVrij.find(y => y.datum === "2026-12-07").vrij === "Jouw vrije dag" && L.werkplanningWaarschuwingen(metVrij).some(x => x.soort === "vrije-dag" && x.datum === "2026-12-07"));
test("eigen vrije dag telt niet als werkdag", L.naarWerkdag("2026-12-08", -1) === "2026-12-04" && L.plusWerkdagen("2026-12-04", 1) === "2026-12-09");
L.zetEigenVrijeDagen([]);
test("weer leeg → normaal", L.naarWerkdag("2026-12-08", -1) === "2026-12-08");
const weken = L.perWeek(dagen);
test("per week (maandag als sleutel)", weken[0].maandag === "2026-11-30" && weken[1].maandag === "2026-12-07" && weken[1].zwaarste === "vol");

sectie("Sjabloon leert de keten");
const sj = { id: "s", naam: "S", stappen: [
  { id: "s1", fase: "pre", soort: "taak", tekst: "Crew", anker: "draai", offset: -10 },
  { id: "s2", fase: "pre", soort: "taak", tekst: "Locatie", anker: "draai", offset: -8 },
  { id: "s3", fase: "pre", soort: "taak", tekst: "Callsheet", anker: "draai", offset: -2 },
  { id: "s4", fase: "post", soort: "taak", tekst: "Montage", anker: "draai", offset: 7 },
] };
let nieuwN = 0; const nieuwId = () => `i${++nieuwN}`;
let pr = L.maakProjectUitSjabloon(sj, { naam: "P", draaidag: "2027-02-17", vandaag: "2027-01-04", nieuwId });
const it = (l, st) => l.items.find(i => i.sjabloonStapId === st);
pr = L.voegVoorgangerToe(pr, it(pr, "s3").id, it(pr, "s1").id).lijst;
pr = L.voegVoorgangerToe(pr, it(pr, "s3").id, it(pr, "s2").id).lijst;
pr = L.zetDuur(pr, it(pr, "s4").id, 5).lijst;
const k = L.ketenUitProject(pr);
test("keten uit project: callsheet wacht op crew + locatie", k.s3.na.map(v => v.stapId).sort().join() === "s1,s2" && k.s4.duur === 5);
const { sjabloon: sj2, aangepast } = L.bewaarKetenInSjabloon(sj, pr);
test("bewaard in sjabloon", aangepast === 2 && sj2.stappen.find(s => s.id === "s3").na.length === 2 && sj2.stappen.find(s => s.id === "s4").duur === 5);
test("normaliseerStap houdt na/duur", L.normaliseerStap(sj2.stappen.find(s => s.id === "s3"), nieuwId).na.length === 2);
const pr2 = L.maakProjectUitSjabloon(sj2, { naam: "P2", draaidag: "2027-03-17", vandaag: "2027-01-04", nieuwId });
test("nieuw project krijgt de geleerde keten", L.voorgangersVan(it(pr2, "s3")).map(v => v.id).sort().join() === [it(pr2, "s1").id, it(pr2, "s2").id].sort().join() && L.duurVan(it(pr2, "s4")) === 5);
const geleerd = L.pasLeerVoorstellenToe(sj, pr, [], [], nieuwId);
test("afronden & leren neemt de keten ook mee", geleerd.stappen.find(s => s.id === "s3").na.length === 2);

sectie("Voorvertoning");
const oud = { items: [t("x", "2026-12-01"), t("y", "2026-12-02"), t("z", "2026-12-03", { checked: true })] };
const nieuw = { items: [t("x", "2026-12-04"), t("y", "2026-12-02"), t("z", "2026-12-09", { checked: true })] };
test("vergelijkPlanning: alleen open, verschoven taken", JSON.stringify(L.vergelijkPlanning(oud, nieuw).verschoven.map(v => [v.id, v.van, v.naar])) === JSON.stringify([["x", "2026-12-01", "2026-12-04"]]));
const ww = L.planningWaarschuwingen({ project: { draaidag: "2026-12-09" }, items: [t("laat", "2026-12-10"), t("zat", "2026-12-05")] });
test("waarschuwingen: te laat + weekend", ww.some(x => x.soort === "te-laat" && x.item.id === "laat") && ww.some(x => x.soort === "vrij" && x.item.id === "zat"));

samenvatting();
