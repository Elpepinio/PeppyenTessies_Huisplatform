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

samenvatting();
