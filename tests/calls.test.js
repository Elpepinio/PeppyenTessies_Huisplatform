const fs = require("fs");
const path = require("path");
const { sectie, test, samenvatting } = require("./testhulp.js");
const lees = (f) => fs.readFileSync(path.join(__dirname, "../lib", f), "utf8").replace(/^import [\s\S]*?;$/gm, "").replace(/^export /gm, "");
const bron = ["taken-logica.js", "projecten-logica.js", "calls-logica.js"].map(lees).join("\n");
const namen = [...new Set([...bron.matchAll(/^(?:function|const) ([A-Za-z_]\w*)/gm)].map(m => m[1]))];
const L = new Function(`${bron}\nreturn { ${namen.join(", ")} };`)();
let t = 0;
const nieuwId = () => `id${++t}`;

sectie("Calls — actiepunten uit notities");
const notities = `Call met Leonie over de fabrieksshoot
Ze willen een extra shot van de lijn.
-> moodboard sturen vrijdag
[ ] Locatie-update mailen naar Leonie.
- [ ] drone-toestemming checken
• TODO: callsheet aanpassen
Actie: crew briefen
AP - offerte herzien
Ik: hotel boeken
- gewoon een opsomming
Todo`;
const ap = L.callActiepunten(notities);
test("zeven actiepunten herkend", ap.length === 7, ap.map(a => a.tekst).join(" | "));
test("pijl → tekst zonder pijl, hoofdletter", ap[0].tekst === "Moodboard sturen vrijdag");
test("[ ] met punt aan eind → punt weg", ap[1].tekst === "Locatie-update mailen naar Leonie");
test("- [ ] werkt", ap[2].tekst === "Drone-toestemming checken");
test("• TODO: werkt", ap[3].tekst === "Callsheet aanpassen");
test("Actie: / AP - / Ik:", ap[4].tekst === "Crew briefen" && ap[5].tekst === "Offerte herzien" && ap[6].tekst === "Hotel boeken");
test("gewone opsomming en losse 'Todo' niet", !ap.some(a => /opsomming/.test(a.tekst)));
test("regelnummer bewaard", ap[0].regel === 2);
test("lege notities → niets", L.callActiepunten("").length === 0 && L.callActiepunten(null).length === 0);

sectie("Calls — bewaren in project");
let l = { id: "p", name: "Häcker", project: { klantId: "k", draaidag: "2026-12-02" }, items: [{ id: "a", name: "Bestaand" }] };
const taak = (naam) => L.nieuweTaak({ name: naam, category: "pre" }, { wie: "Pepijn", nu: 1 });
l = L.bewaarCallInProject(l, { datum: "2026-11-24", met: " Leonie ", notities: "Notities\n-> moodboard" }, [taak("Moodboard sturen"), taak("Crew briefen")], { nieuwId, wie: "Pepijn", nu: 100 });
const c1 = l.project.calls[0];
test("call aangemaakt met id en schone velden", c1.id === "id1" && c1.met === "Leonie" && c1.door === "Pepijn" && c1.aangemaaktOp === 100);
test("taken toegevoegd met callId", l.items.length === 3 && l.items.slice(1).every(i => i.callId === "id1"));
test("bestaande taak blijft zonder callId", !l.items[0].callId);
test("callTakenVan", L.callTakenVan(l, "id1").length === 2);
l = L.bewaarCallInProject(l, { id: "id1", datum: "2026-11-24", met: "Leonie + Jan", notities: "Bijgewerkt" }, [taak("Extra")], { nieuwId, wie: "Tessa", nu: 200 });
test("bijwerken: geen dubbele call", l.project.calls.length === 1);
test("bijwerken: velden nieuw, maker/aanmaak blijft", l.project.calls[0].met === "Leonie + Jan" && l.project.calls[0].door === "Pepijn" && l.project.calls[0].aangemaaktOp === 100 && l.project.calls[0].bijgewerktOp === 200);
test("bijwerken: extra taak erbij", L.callTakenVan(l, "id1").length === 3);
l = L.bewaarCallInProject(l, { datum: "2026-12-01", met: "", notities: "" }, [], { nieuwId, nu: 300 });
l = L.bewaarCallInProject(l, { datum: "2026-11-20", met: "Bureau", notities: "" }, [], { nieuwId, nu: 400 });
test("callsVan: nieuwste datum eerst", L.callsVan(l.project).map(c => c.datum).join(",") === "2026-12-01,2026-11-24,2026-11-20");
test("callsVan zonder calls", L.callsVan({}).length === 0);
test("samenvatting: eerste niet-lege regel, ingekort", L.callSamenvatting("\n\n  Eerste regel  \ntweede") === "Eerste regel" && L.callSamenvatting("x".repeat(200), 10).length === 10);
l = L.verwijderCall(l, "id1");
test("verwijderen: call weg", !l.project.calls.some(c => c.id === "id1"));
test("verwijderen: taken blijven, zonder callId", l.items.length === 4 && !l.items.some(i => i.callId));


sectie("Vaste momenten & geplande calls");
{
  const t = (id, d, extra = {}) => ({ id, name: id, category: "pre", dueDate: d, ...extra });
  let l = { id: "p", project: { draaidag: "2026-12-10", opleverdatum: "2026-12-18", calls: [] }, items: [
    t("ppm", "2026-12-03", { onderdeelId: "ppm", note: "Om 10:00", herinnering: "2026-12-03T09:00" }),
    t("callsheet", "2026-12-07", { naId: "ppm", naDagen: 2 }),
    t("draai", "2026-12-10", { anker: "draai", offset: 0, category: "productie" }),
    t("backup", "2026-12-10", { anker: "draai", offset: 0, category: "productie" }),
    t("script", "2026-12-04", { anker: "draai", offset: -4 }),
    t("edit", "2026-12-14", { anker: "draai", offset: 2, category: "post" }),
  ] };
  const g = (x, id) => x.items.find(i => i.id === id);
  test("momentTijd uit notitie", L.momentTijd(g(l, "ppm")) === "10:00" && L.momentTijd({ herinnering: "2026-12-01T14:30" }) === "14:30" && L.momentTijd({}) === null);
  const r = L.verzetMoment(l, "ppm", { datum: "2026-12-04", tijd: "14:00" });
  test("PPM verzet: datum, notitie en herinnering (uur ervoor)", g(r.lijst, "ppm").dueDate === "2026-12-04" && g(r.lijst, "ppm").note === "Om 14:00" && g(r.lijst, "ppm").herinnering === "2026-12-04T13:00");
  test("PPM verzet: wachtende taak schuift mee", g(r.lijst, "callsheet").dueDate === "2026-12-08");
  const d = L.verzetMoment(l, "draai", { datum: "2026-12-15" });
  test("draaidag-moment verzet de draaidag van het project", d.lijst.project.draaidag === "2026-12-15" && g(d.lijst, "draai").dueDate === "2026-12-15" && g(d.lijst, "backup").dueDate === "2026-12-15");
  test("draaidag: planning eromheen schuift mee", g(d.lijst, "script").dueDate === "2026-12-11" && g(d.lijst, "edit").dueDate === "2026-12-17");
  // Geplande call als moment
  const call = { id: "c1", datum: "2026-12-02", tijd: "15:30", met: "Leonie", onderwerp: "Review moodboard", momentTaakId: "mom" };
  l = L.bewaarCallInProject({ ...l, items: [...l.items, t("mom", "2026-12-02", { vast: true, callMoment: true, note: "Om 15:30" })] }, call, [], { nieuwId: () => "x", nu: 1 });
  test("call bewaart tijd, onderwerp en moment", l.project.calls[0].tijd === "15:30" && l.project.calls[0].onderwerp === "Review moodboard" && l.project.calls[0].momentTaakId === "mom");
  const l2 = L.bewaarCallInProject(l, { id: "c1", datum: "2026-12-02", met: "Leonie", notities: "x" }, [], { nu: 2 });
  test("bijwerken zonder die velden behoudt ze", l2.project.calls[0].tijd === "15:30" && l2.project.calls[0].momentTaakId === "mom");
  test("callVoorMoment", L.callVoorMoment(l, g(l, "mom"))?.id === "c1");
  const m = L.verzetMoment(l, "mom", { datum: "2026-12-03", tijd: "11:00" });
  test("moment verzetten → call krijgt nieuwe datum/tijd", m.lijst.project.calls[0].datum === "2026-12-03" && m.lijst.project.calls[0].tijd === "11:00");
  const s2 = L.synchroniseerMomentMetCall(l, { ...l.project.calls[0], datum: "2026-12-04", tijd: "09:30" });
  test("call verzetten → moment in planning mee", g(s2, "mom").dueDate === "2026-12-04" && L.momentTijd(g(s2, "mom")) === "09:30");
  test("fase op datum", L.faseVoorDatum(l.project, "2026-12-01") === "pre" && L.faseVoorDatum(l.project, "2026-12-10") === "productie" && L.faseVoorDatum(l.project, "2026-12-11") === "post");
}

samenvatting();
