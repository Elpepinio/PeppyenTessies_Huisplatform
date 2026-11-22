const fs = require("fs");
const path = require("path");
const { sectie, test, samenvatting } = require("./testhulp.js");

// Beide bestanden zijn puur; projecten-logica importeert alleen uit
// taken-logica. We laden ze achter elkaar (zonder import/export-regels), zodat
// de tests de echte, actuele code controleren.
const lees = (f) => fs.readFileSync(path.join(__dirname, "../lib", f), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const bron = lees("taken-logica.js") + "\n" + lees("projecten-logica.js");
const namen = [...bron.matchAll(/^(?:function|const) ([A-Za-z_]\w*)/gm)].map(m => m[1]);
const P = new Function(`${bron}\nreturn { ${[...new Set(namen)].join(", ")} };`)();

let teller = 0;
const nieuwId = () => `id${++teller}`;
const klein = P.STANDAARD_SJABLONEN.find(t => t.id === "commercial-klein");
const groot = P.STANDAARD_SJABLONEN.find(t => t.id === "commercial-groot");

sectie("Standaardsjablonen — compleet en geldig");
for (const t of P.STANDAARD_SJABLONEN) {
  const ids = t.stappen.map(s => s.id);
  test(`${t.naam}: unieke stap-id's`, new Set(ids).size === ids.length);
  test(`${t.naam}: alle drie de fases komen voor`, ["pre", "productie", "post"].every(f => t.stappen.some(s => s.fase === f)));
  test(`${t.naam}: alle stappen zijn geldig (normaliseren verandert niets)`, t.stappen.every(s => JSON.stringify(P.normaliseerStap(s, nieuwId)) === JSON.stringify(s)));
  test(`${t.naam}: bevat mensen, documenten én regelen/doorsturen`, ["persoon", "document", "regelen"].every(k => t.stappen.some(s => s.soort === k)));
}
test("groot sjabloon heeft de AAF-stap naar de geluidsstudio", groot.stappen.some(s => /AAF/.test(s.tekst)));

sectie("Project maken vanuit sjabloon");
const proj = P.maakProjectUitSjabloon(klein, { naam: "Häcker", klantId: "k1", draaidag: "2026-12-10", opleverdatum: "2026-12-24", vandaag: "2026-11-22", wie: "Pepijn", nu: 1000, nieuwId });
const zoek = (stapId) => proj.items.find(i => i.sjabloonStapId === stapId);
test("één taak per stap", proj.items.length === klein.stappen.length);
test("draaidag-stap: 14 dagen vóór draaidag", zoek("k-script").dueDate === "2026-11-26");
test("oplever-stap: 7 dagen vóór oplevering", zoek("k-montage").dueDate === "2026-12-17");
test("fase wordt de categorie, soort/anker/offset gaan mee", zoek("k-crew").category === "pre" && zoek("k-crew").soort === "persoon" && zoek("k-crew").anker === "draai" && zoek("k-crew").offset === -14);
test("klant gaat mee naar elke taak", proj.items.every(i => i.klantId === "k1"));
test("lijst heeft de drie fases als categorieën", proj.categories.map(c => c.id).join() === "pre,productie,post");
test("projectgegevens bewaard", proj.project.draaidag === "2026-12-10" && proj.project.stapIds.length === klein.stappen.length && proj.project.sjabloonId === "commercial-klein");
test("taken staan per fase op volgorde", proj.items.findIndex(i => i.category === "post") > proj.items.findIndex(i => i.category === "productie"));
const laat = P.maakProjectUitSjabloon(klein, { naam: "Spoed", draaidag: "2026-11-29", vandaag: "2026-11-22", nieuwId });
test("deadline in het verleden komt op vandaag", laat.items.find(i => i.sjabloonStapId === "k-offerte").dueDate === "2026-11-22");
test("zonder opleverdatum: standaarddoorlooptijd", laat.project.opleverdatum === "2026-12-13");
const laatEcht = P.maakProjectUitSjabloon(klein, { naam: "Spoed", draaidag: "2026-11-29", vandaag: "2026-11-22", verledenNaarVandaag: false, nieuwId });
test("…tenzij uitgezet", laatEcht.items.find(i => i.sjabloonStapId === "k-offerte").dueDate === "2026-11-04");
test("gebruik wordt geteld", P.registreerGebruik(P.STANDAARD_SJABLONEN, "commercial-klein")[0].gebruikt === 1);

sectie("Draaidag verschuift → taken schuiven mee");
const metAfgevinkt = { ...proj, items: proj.items.map(i => (i.sjabloonStapId === "k-offerte" ? { ...i, checked: true } : i)) };
const verschoven = P.verschuifProject(metAfgevinkt, { draaidag: "2026-12-12" });
const v = (id) => verschoven.items.find(i => i.sjabloonStapId === id);
test("open draai-stap schuift 2 dagen", v("k-script").dueDate === "2026-11-28");
test("oplever-stap blijft staan als alleen de draaidag wijzigt", v("k-montage").dueDate === "2026-12-17");
test("afgevinkte taak blijft ongemoeid", v("k-offerte").dueDate === zoek("k-offerte").dueDate);
test("projectdatum bijgewerkt", verschoven.project.draaidag === "2026-12-12");
test("oplevering verschuiven schuift post-stappen", P.verschuifProject(proj, { opleverdatum: "2026-12-31" }).items.find(i => i.sjabloonStapId === "k-oplever").dueDate === "2026-12-31");

sectie("Voortgang per fase");
const vg = P.projectVoortgang(metAfgevinkt);
test("pre: 1 klaar", vg[0].klaar === 1 && vg[0].totaal === klein.stappen.filter(s => s.fase === "pre").length);

sectie("Leren — wat deed je anders dan het sjabloon?");
const dag = (s) => new Date(...s.split("-").map((x, i) => (i === 1 ? +x - 1 : +x)), 12).getTime();
let geleerdProject = {
  ...proj,
  items: proj.items
    .filter(i => i.sjabloonStapId !== "k-gearcheck")                                   // weggehaald
    .map(i => (i.sjabloonStapId === "k-crew" ? { ...i, name: "Crew + drone-operator boeken", checked: true, voltooidOp: dag("2026-11-19") } : i)) // hernoemd, 21 dagen vóór
    .map(i => (i.sjabloonStapId === "k-callsheet" ? { ...i, soort: "regelen", checked: true, voltooidOp: dag("2026-12-08") } : i))
    .map(i => (i.sjabloonStapId === "k-script" ? { ...i, checked: true, voltooidOp: dag("2026-11-25") } : i)) // 15 dagen vóór (−14 in sjabloon → klein verschil)
    .concat([{ id: "extra", name: "Drone-vergunning aanvragen", category: "pre", soort: "regelen", dueDate: "2026-11-20", checked: false }]),
};
const vs = P.berekenLeerVoorstellen(klein, geleerdProject);
const type = (t) => vs.filter(x => x.type === t);
test("toegevoegde taak → voorstel om toe te voegen, met fase/soort", type("toevoegen").length === 1 && type("toevoegen")[0].stap.tekst === "Drone-vergunning aanvragen" && type("toevoegen")[0].stap.soort === "regelen");
test("…met offset t.o.v. de draaidag (20 dagen vóór)", type("toevoegen")[0].stap.offset === -20);
test("weggehaalde stap → voorstel om te verwijderen", type("verwijderen").length === 1 && type("verwijderen")[0].stapId === "k-gearcheck");
test("hernoemde stap → voorstel om te wijzigen", type("wijzigen").some(x => x.stapId === "k-crew" && x.velden.tekst === "Crew + drone-operator boeken"));
test("andere soort → voorstel om te wijzigen", type("wijzigen").some(x => x.stapId === "k-callsheet" && x.velden.soort === "regelen"));
test("één project, 7 dagen eerder → timingvoorstel", type("timing").some(x => x.stapId === "k-crew" && x.naar === -21 && x.van === -14));
test("één project, maar 1 dag verschil → géén timingvoorstel", !type("timing").some(x => x.stapId === "k-script"));
test("mail-taken worden niet voorgesteld", !P.berekenLeerVoorstellen(klein, { ...proj, items: [...proj.items, { id: "m", name: "x", category: "pre", bron: "mail" }] }).some(x => x.type === "toevoegen"));

sectie("Leren — voorstellen toepassen");
const gekozen = vs.filter(x => x.type !== "verwijderen").map(x => x.id); // alles behalve verwijderen
const nieuw = P.pasLeerVoorstellenToe(klein, geleerdProject, vs, gekozen, nieuwId);
const ns = (id) => nieuw.stappen.find(s => s.id === id);
test("toegevoegde stap staat in het sjabloon", nieuw.stappen.some(s => s.tekst === "Drone-vergunning aanvragen" && s.offset === -20));
test("niet-gekozen verwijdering is niet uitgevoerd", !!ns("k-gearcheck"));
test("hernoeming + nieuwe timing doorgevoerd", ns("k-crew").tekst === "Crew + drone-operator boeken" && ns("k-crew").offset === -21);
test("soort gewijzigd", ns("k-callsheet").soort === "regelen");
test("timing van alle afgeronde stappen vastgelegd (ook zonder voorstel)", nieuw.geleerd["k-script"].offsets.join() === "-15" && nieuw.geleerd["k-crew"].offsets.join() === "-21");
test("teller 'geleerd van' loopt op", nieuw.geleerdVan === 1);
test("origineel sjabloon niet aangepast (puur)", klein.stappen.find(s => s.id === "k-crew").offset === -14 && !klein.geleerd);
test("sjabloon blijft gesorteerd per fase", nieuw.stappen.findIndex(s => s.fase === "post") > nieuw.stappen.findIndex(s => s.fase === "productie"));

sectie("Leren — over meerdere projecten (mediaan)");
const naTwee = { ...klein, geleerd: { "k-script": { offsets: [-18, -17] } } };
const p3 = { ...proj, project: { ...proj.project, startDatum: "2026-11-01" }, items: proj.items.map(i => (i.sjabloonStapId === "k-script" ? { ...i, checked: true, voltooidOp: dag("2026-11-22") } : i)) }; // −18
const t3 = P.berekenLeerVoorstellen(naTwee, p3).find(x => x.stapId === "k-script" && x.type === "timing");
test("na 3 projecten (−18, −17, −18) → voorstel −18", t3 && t3.naar === -18 && t3.aantalProjecten === 3);
test("timing-reeks bewaart maximaal 6 projecten", P.pasLeerVoorstellenToe({ ...klein, geleerd: { "k-script": { offsets: [1, 2, 3, 4, 5, 6] } } }, p3, [], [], nieuwId).geleerd["k-script"].offsets.length === 6);
test("mediaan even aantal wordt afgerond", P.mediaan([-10, -7]) === -8 || P.mediaan([-10, -7]) === -9);
test("hint in de editor", P.timingHint(naTwee, "k-script").mediaan === -17 && P.timingHint(naTwee, "k-script").aantal === 2);
test("offset-tekst", P.offsetTekst({ offset: -14, anker: "draai" }) === "14 dagen vóór draaidag" && P.offsetTekst({ offset: 1, anker: "oplever" }) === "1 dag na oplevering" && P.offsetTekst({ offset: 0, anker: "draai" }) === "op de draaidag");

test("tweede keer leren van hetzelfde project telt timing niet dubbel", (() => {
  const nogmaals = P.pasLeerVoorstellenToe(nieuw, geleerdProject, [], [], nieuwId, { metTiming: false });
  return nogmaals.geleerd["k-crew"].offsets.length === 1 && nogmaals.geleerdVan === 1;
})());

sectie("Leren — geen valse timing bij een laat gestart project");
const laatProject = P.maakProjectUitSjabloon(klein, { naam: "Laat", draaidag: "2026-12-03", vandaag: "2026-11-22", nu: dag("2026-11-22"), nieuwId });
const lp = (id, voltooid) => ({ ...laatProject, items: laatProject.items.map(i => (i.sjabloonStapId === id ? { ...i, checked: true, voltooidOp: dag(voltooid) } : i)) });
test("stap lag bij de start al in het verleden → telt niet mee", P.werkelijkeOffset(lp("k-offerte", "2026-11-24").items.find(i => i.sjabloonStapId === "k-offerte"), klein.stappen[0], laatProject.project) === null);
test("…en levert dus ook geen timingvoorstel op", !P.berekenLeerVoorstellen(klein, lp("k-offerte", "2026-11-24")).some(v => v.type === "timing"));
test("op de startdag afgevinkt → telt niet mee", P.werkelijkeOffset(lp("k-locatie", "2026-11-22").items.find(i => i.sjabloonStapId === "k-locatie"), klein.stappen.find(s => s.id === "k-locatie"), laatProject.project) === null);
test("normale stap later afgerond → telt wél mee", P.werkelijkeOffset(lp("k-locatie", "2026-11-25").items.find(i => i.sjabloonStapId === "k-locatie"), klein.stappen.find(s => s.id === "k-locatie"), laatProject.project) === -8);
test("project onthoudt startdatum en oorspronkelijke stapdatum", laatProject.project.startDatum === "2026-11-22" && laatProject.items.find(i => i.sjabloonStapId === "k-offerte").sjabloonDatum === "2026-11-08");

samenvatting();
