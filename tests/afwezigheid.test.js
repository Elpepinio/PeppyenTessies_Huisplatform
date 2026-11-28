const fs = require("fs");
const path = require("path");
const { sectie, test, samenvatting } = require("./testhulp.js");
const lees = (f) => fs.readFileSync(path.join(__dirname, "../lib", f), "utf8").replace(/^import [\s\S]*?;$/gm, "").replace(/^export /gm, "");
const bron = ["afwezigheid-logica.js"].map(lees).join("\n");
const namen = [...new Set([...bron.matchAll(/^(?:function|const) ([A-Za-z_]\w*)/gm)].map(m => m[1]))];
const L = new Function(`${bron}\nreturn { ${namen.join(", ")} };`)();
const chronoNl = require("chrono-node").nl;
const nu = new Date("2026-11-28T10:00:00");

sectie("Afwezigheid herkennen in notities");
const h = (t) => L.herkenAfwezigheid(t, chronoNl, nu);
const eq = (r, van, tot) => r && r.van === van && r.tot === tot;
test("'met vakantie van 21 december tot 4 januari'", eq(h("Leonie is met vakantie van 21 december tot 4 januari"), "2026-12-21", "2027-01-04"));
test("'afwezig 21/12 t/m 4/1'", eq(h("afwezig 21/12 t/m 4/1"), "2026-12-21", "2027-01-04"));
test("'er niet van 21 dec tot en met 4 jan'", eq(h("Ze is er niet van 21 dec tot en met 4 jan"), "2026-12-21", "2027-01-04"));
test("'vrij vanaf 23 december tot 3 januari' (vrij ≠ vrijdag)", eq(h("vrij vanaf 23 december tot 3 januari"), "2026-12-23", "2027-01-03"));
test("'niet aanwezig 24-31 december'", eq(h("Niet aanwezig 24-31 december"), "2026-12-24", "2026-12-31"));
test("'op vakantie tot 10 januari' → vanaf vandaag", eq(h("op vakantie tot 10 januari"), "2026-11-28", "2027-01-10"));
test("in een langere notitie: de juiste regel", eq(h("Shot erbij\nLeonie: kerstvakantie 19 dec tot 3 jan\n-> moodboard"), "2026-12-19", "2027-01-03"));
test("geen afwezigheid → null", h("Draaidag op 20 januari, moodboard vrijdag") === null && L.herkenAfwezigheid("vakantie", null) === null);

sectie("Afwezigheid en planning");
const a = L.normAfwezigheid({ id: "a1", naam: "Leonie Schröder", klantId: "k", van: "2026-12-21", tot: "2027-01-04" });
test("normaliseren draait verwisselde datums om", L.normAfwezigheid({ naam: "x", van: "2027-01-04", tot: "2026-12-21" }).van === "2026-12-21");
test("isAfwezigOp (grenzen inbegrepen)", L.isAfwezigOp(a, "2026-12-21") && L.isAfwezigOp(a, "2027-01-04") && !L.isAfwezigOp(a, "2027-01-05"));
test("noemtPersoon op voornaam, los woord, zonder accenten", L.noemtPersoon("Call met Leonie over locatie", "Leonie Schröder") && L.noemtPersoon("Schröder bellen", "schroder") && !L.noemtPersoon("Leonieke mailen", "Leonie"));
test("afwezigOpDatum filtert op klant", L.afwezigOpDatum([a], "2026-12-28", { klantId: "k" }).length === 1 && L.afwezigOpDatum([a], "2026-12-28", { klantId: "x" }).length === 0);
test("komende afwezigheden (binnen 45 dagen, nog niet voorbij)", L.komendeAfwezigheden([a, { naam: "oud", van: "2026-10-01", tot: "2026-10-05" }, { naam: "ver", van: "2027-06-01", tot: "2027-06-05" }], "2026-11-28").map(x => x.naam).join() === "Leonie Schröder");
const lijst = { project: { klantId: "k", calls: [{ id: "c1", met: "Leonie", momentTaakId: "rev" }] }, items: [
  { id: "ppm", name: "PPM", onderdeelId: "ppm", dueDate: "2026-12-22" },
  { id: "akk", name: "Akkoord klant op script", dueDate: "2026-12-23" },
  { id: "rev", name: "📞 Review", callMoment: true, callId: "c1", dueDate: "2026-12-29" },
  { id: "intern", name: "Crew boeken", dueDate: "2026-12-23" },
  { id: "na", name: "Feedback klant", dueDate: "2027-01-06" },
  { id: "draai", name: "Draaidag", anker: "draai", offset: 0, category: "productie", dueDate: "2026-12-30" },
  { id: "dop", name: "DOP", bezetting: [{ naam: "Jan de Vries" }] },
  { id: "klaar", name: "Akkoord klant", dueDate: "2026-12-22", checked: true },
] };
const c = L.afwezigheidConflicten(lijst, [a]);
test("klant-momenten in de periode botsen", ["ppm", "akk", "rev"].every(id => c.some(x => x.item.id === id)));
test("interne taak, taak buiten periode en afgevinkte taak niet", !c.some(x => ["intern", "na", "klaar"].includes(x.item.id)));
test("andere klant → geen botsing", L.afwezigheidConflicten({ ...lijst, project: { ...lijst.project, klantId: "z" } }, [a]).filter(x => x.reden === "klant").length === 0);
const jan = L.normAfwezigheid({ naam: "Jan", van: "2026-12-28", tot: "2026-12-31" });
const cj = L.afwezigheidConflicten(lijst, [jan]);
test("crewlid op de draaidag afwezig → botsing", cj.some(x => x.item.id === "draai" && x.reden === "draaidag"));

samenvatting();
