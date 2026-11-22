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

sectie("Offertes — wekelijks navragen tot akkoord");
const off = P.maakOfferte({ naam: "Häcker najaar", klantId: "k1", verstuurdOp: "2026-11-20", bedrag: 4500, vandaag: "2026-11-22", wie: "Pepijn", nu: 5, nieuwId });
const nv = off.items[0];
test("offerte heeft status 'offerte' en één navraagtaak", P.projectStatus(off) === "offerte" && off.items.length === 1 && nv.offerteNavraag);
test("eerste navraag een week na versturen, om 10:00", nv.dueDate === "2026-11-27" && nv.herinnering === "2026-11-27T10:00");
test("navraag herhaalt wekelijks", nv.herhaling.freq === "week" && nv.herhaling.interval === 1);
test("bedrag staat in de notitie", /4\.500/.test(nv.note));
test("achteraf ingevoerde offerte: eerste vraag vandaag", P.eersteNavraagDatum("2026-10-01", "2026-11-22") === "2026-11-22");
test("om de 2 weken navragen", P.maakOfferte({ naam: "x", verstuurdOp: "2026-11-20", weken: 2, vandaag: "2026-11-22", nieuwId }).items[0].dueDate === "2026-12-04");
const nagevraagd = P.vinkTaak(nv, { vandaag: "2026-11-27" });
test("afvinken (nagevraagd) → volgende week opnieuw, herinnering schuift mee", nagevraagd.checked === false && nagevraagd.dueDate === "2026-12-04" && nagevraagd.herinnering === "2026-12-04T10:00");
test("teller 'keer nagevraagd'", P.offerteNagevraagd(off, "2026-11-27").project.offerte.keerNagevraagd === 1);
test("project zonder status telt als lopend", P.projectStatus({ project: {} }) === "lopend" && P.projectStatus({}) === null);

const metEigen = { ...off, items: [...off.items, { id: "eigen", name: "Moodboard sturen", category: "pre" }] };
const ak = P.offerteAkkoord(metEigen, klein, { draaidag: "2026-12-10", opleverdatum: "2026-12-24", akkoordOp: "2026-11-30", vandaag: "2026-11-30", nu: dag("2026-11-30"), nieuwId });
test("akkoord: status lopend, zelfde lijst-id en naam", P.projectStatus(ak) === "lopend" && ak.id === off.id && ak.name === "Häcker najaar");
test("akkoord: navraagtaak weg, eigen taak blijft", !ak.items.some(i => i.offerteNavraag) && ak.items.some(i => i.id === "eigen"));
test("akkoord: alle sjabloonstappen erbij", ak.items.filter(i => i.sjabloonStapId).length === klein.stappen.length);
test("akkoord: offerte- en akkoordstap meteen klaar", ["k-offerte", "k-akkoord"].every(id => ak.items.find(i => i.sjabloonStapId === id).checked));
test("akkoord: overige stappen open", !ak.items.find(i => i.sjabloonStapId === "k-script").checked);
test("akkoord: klant en offertegegevens bewaard", ak.project.klantId === "k1" && ak.project.offerte.verstuurdOp === "2026-11-20" && ak.project.offerte.akkoordOp === "2026-11-30");
test("akkoord: meteen-klaar-stappen tellen niet mee voor timing", P.berekenLeerVoorstellen(klein, ak).every(v => v.type !== "timing"));
test("offertestap herkennen: vlag gaat vóór tekst", P.isOfferteStap({ fase: "pre", tekst: "Offerte", bijAkkoordKlaar: false }) === false && P.isOfferteStap({ fase: "pre", tekst: "Begroting", bijAkkoordKlaar: true }) === true);

const af = P.offerteAfgewezen(off, { datum: "2026-12-05", reden: "Te duur" });
test("afgewezen: status, afgerond, navraag weg, reden bewaard", P.projectStatus(af) === "afgewezen" && af.project.afgerond && af.items.length === 0 && af.project.offerte.reden === "Te duur");

const stat = P.offerteStatistiek([off, ak, af, { project: { status: "lopend", offerte: { verstuurdOp: "2026-11-01", akkoordOp: "2026-11-21" } } }]);
test("statistiek: open / akkoord / afgewezen", stat.open === 1 && stat.akkoord === 2 && stat.afgewezen === 1);
test("statistiek: scoringspercentage en mediaan dagen tot akkoord", stat.scoringPct === 67 && stat.mediaanDagenTotAkkoord === 15);

sectie("Onderdelen — aan/uit zetten wat er nodig is");
const basisP = P.maakProjectUitSjabloon(groot, { naam: "Groot", draaidag: "2027-01-20", opleverdatum: "2027-02-17", vandaag: "2026-11-22", nu: dag("2026-11-22"), nieuwId });
const meet = { kickoff: { datum: "2026-11-25", tijd: "14:00" }, ppm: { datum: "2027-01-13", tijd: "10:00" } };
const ctxO = { draaidag: "2027-01-20", vandaag: "2026-11-22", meetings: meet, nieuwId, nu: 1 };
const metO = P.pasOnderdelenToe(basisP, ["kickoff", "ppm", "acteurs", "figuranten", "loc-exterieur", "hotel", "verzekering", "crew-camera", "crew-gripper"], ctxO);
const od = (id) => metO.items.filter(i => i.onderdeelId === id);
test("kickoff: nieuwe taak op gekozen dag, herinnering een uur vooraf", od("kickoff").length === 1 && od("kickoff")[0].dueDate === "2026-11-25" && od("kickoff")[0].herinnering === "2026-11-25T13:00" && od("kickoff")[0].note === "Om 14:00");
test("PPM: bestaande sjabloonstap gebruikt (geen dubbele) en ingepland", od("ppm").length === 1 && od("ppm")[0].sjabloonStapId === "g-ppm" && od("ppm")[0].dueDate === "2027-01-13" && metO.items.filter(i => /PPM/.test(i.name)).length === 1);
test("acteurs: koppelt aan de casting-stap uit het sjabloon", od("acteurs").length === 1 && od("acteurs")[0].sjabloonStapId === "g-casting");
test("verzekering: koppelt aan bestaande sjabloonstap", od("verzekering")[0].sjabloonStapId === "g-verzekering");
test("figuranten: nieuwe taak met deelstappen en deadline t.o.v. draaidag", od("figuranten")[0].dueDate === "2027-01-10" && od("figuranten")[0].substappen.length === 3 && od("figuranten")[0].anker === "draai");
test("hotel en exterieur aangemaakt", od("hotel").length === 1 && od("loc-exterieur").length === 1);
test("niet gekozen → geen taak (interieur, props, edelfiguranten)", !od("loc-interieur").length && !od("props").length && !od("edelfiguranten").length);
const crewT = od("crew")[0];
test("crew: één taak (de sjabloonstap) met een deelstap per gekozen rol", od("crew").length === 1 && crewT.sjabloonStapId === "g-crew" && crewT.substappen.map(s => s.tekst).join() === "Camera,Gripper");
test("keuze en meetings worden bij het project bewaard", metO.project.onderdelen.includes("hotel") && metO.project.meetings.kickoff.tijd === "14:00");

// tijdens het project: camera afgevinkt, gripper uit, belichter aan, hotel uit, verzekering uit
const bezig = { ...metO, items: metO.items.map(i => (i.onderdeelId === "crew" ? { ...i, substappen: i.substappen.map(s => (s.tekst === "Camera" ? { ...s, afgevinkt: true } : s)) } : i.onderdeelId === "figuranten" ? { ...i, checked: true } : i)) };
const nieuweKeuze = ["kickoff", "ppm", "acteurs", "loc-exterieur", "crew-camera", "crew-belichter"];
test("waarschuwing: tel open taken die verdwijnen (hotel + verzekering)", P.telVerdwijnendeTaken(bezig, nieuweKeuze) === 2);
const na = P.pasOnderdelenToe(bezig, nieuweKeuze, ctxO);
const nd = (id) => na.items.filter(i => i.onderdeelId === id);
test("uitgezet en nog open → weg", !nd("hotel").length && !nd("verzekering").length);
test("uitgezet maar al gedaan → blijft staan", nd("figuranten").length === 1);
test("crew: afgevinkte rol blijft afgevinkt, gripper weg, belichter erbij", nd("crew")[0].substappen.map(s => `${s.tekst}:${s.afgevinkt}`).join() === "Camera:true,Belichter:false");
test("geen dubbele taken bij opnieuw toepassen", na.items.length === new Set(na.items.map(i => i.id)).size && nd("kickoff").length === 1 && nd("acteurs").length === 1);
test("weggezette sjabloonstap onthouden", na.project.uitgezetteStapIds.includes("g-verzekering"));
test("…en het leren stelt dan NIET voor die stap uit het sjabloon te halen", !P.berekenLeerVoorstellen(groot, na).some(v => v.type === "verwijderen" && v.stapId === "g-verzekering"));
test("…en stelt onderdeel-taken niet voor als nieuwe sjabloonstap", !P.berekenLeerVoorstellen(groot, na).some(v => v.type === "toevoegen"));
const alleCrewUit = P.pasOnderdelenToe(na, ["kickoff"], ctxO);
test("alle crew uit → crew-taak weg (was nog open)", !alleCrewUit.items.some(i => i.onderdeelId === "crew"));
test("weer aanzetten → sjabloonstap komt terug als nieuwe taak, niet meer 'uitgezet'", (() => {
  const terug = P.pasOnderdelenToe(alleCrewUit, ["kickoff", "verzekering"], ctxO);
  return terug.items.filter(i => i.onderdeelId === "verzekering").length === 1;
})());

sectie("Onderdelen — standaardkeuze en leren");
test("standaardsjabloon heeft eigen standaardkeuze", P.standaardOnderdelen(klein).join() === "kickoff,callsheets,snacks,crew-camera-assistent,crew-geluid,loc-interieur,edit-v1,edit-v2,kleurcorrectie,afmixen");
test("vorige keuze bij dit sjabloon gaat vóór (zelflerend)", P.standaardOnderdelen({ ...groot, laatsteOnderdelen: ["hotel"], onderdelenBekend: P.ONDERDELEN.flatMap(g => g.items.map(i => i.id)) }).join() === "hotel");
test("oude opgeslagen keuze (zonder postproductie): nieuwe onderdelen volgen de sjabloonstandaard", (() => { const r = P.standaardOnderdelen({ ...groot, laatsteOnderdelen: ["hotel"] }); return r[0] === "hotel" && r.includes("grading") && r.includes("edit-lock") && !r.includes("kickoff"); })());
test("eigen sjabloon zonder keuze: afgeleid uit de stappen + kickoff/PPM", P.standaardOnderdelen({ stappen: [{ tekst: "Productieverzekering afsluiten" }] }).join() === "kickoff,ppm,verzekering");
test("PPM standaard 5 dagen vóór draaidag, kickoff over 2 dagen", (() => { const m = P.standaardMeetings({ draaidag: "2027-01-20", vandaag: "2026-11-22" }); return m.ppm.datum === "2027-01-15" && m.kickoff.datum === "2026-11-24"; })());
test("deadline in het verleden → vandaag", P.pasOnderdelenToe(P.maakProjectUitSjabloon(klein, { naam: "x", draaidag: "2026-11-28", vandaag: "2026-11-22", nieuwId }), ["hotel"], { draaidag: "2026-11-28", vandaag: "2026-11-22", nieuwId }).items.find(i => i.onderdeelId === "hotel").dueDate === "2026-11-22");
test("elk onderdeel-id is uniek", (() => { const ids = P.ONDERDELEN.flatMap(g => g.items.map(i => i.id)); return new Set(ids).size === ids.length; })());

sectie("Nieuwe onderdelen: PPM opstellen, callsheets, catering, snacks");
const kp = P.pasOnderdelenToe(P.maakProjectUitSjabloon(klein, { naam: "K", draaidag: "2027-01-20", vandaag: "2026-11-22", nieuwId }), ["callsheets", "catering", "snacks", "ppm-document"], { draaidag: "2027-01-20", vandaag: "2026-11-22", nieuwId });
const ko = (id) => kp.items.filter(i => i.onderdeelId === id);
test("callsheets koppelt aan 'Callsheet opstellen' uit het sjabloon", ko("callsheets").length === 1 && ko("callsheets")[0].sjabloonStapId === "k-callsheet");
test("catering, snacks en PPM opstellen worden taken", ko("catering").length === 1 && ko("snacks")[0].dueDate === "2027-01-19" && ko("ppm-document")[0].soort === "document");
test("groot: catering koppelt aan bestaande cateringstap", P.pasOnderdelenToe(basisP, ["catering"], ctxO).items.filter(i => i.onderdeelId === "catering")[0].sjabloonStapId === "g-catering");
test("geen namen bij meetings en documenten", ["kickoff", "ppm", "ppm-document", "callsheets"].every(id => P.onderdeelVan(id).geenNamen));

sectie("Bezetting — namen, status en prijsafspraken");
test("bedrag-invoer: 1.250,50 / 450 / leeg", P.leesBedragInvoer("1.250,50") === 1250.5 && P.leesBedragInvoer("€ 450") === 450 && P.leesBedragInvoer("") === null);
test("bedrag-invoer: 1.500 en 12.000 zijn duizendtallen, 12.5 blijft decimaal", P.leesBedragInvoer("1.500") === 1500 && P.leesBedragInvoer("12.000") === 12000 && P.leesBedragInvoer("12.5") === 12.5 && P.leesBedragInvoer("1.234.567") === 1234567);
const crewItem = { onderdeelId: "crew", substappen: [{ id: "s1", tekst: "Camera", rolId: "crew-camera", afgevinkt: false }, { id: "s2", tekst: "Gripper", rolId: "crew-gripper", afgevinkt: true }, { id: "s3", tekst: "Eigen stap", afgevinkt: false }],
  bezetting: [
    { id: "b1", onderdeelId: "crew-camera", naam: "Sanne", status: "bevestigd", bedrag: 450, eenheid: "dag" },
    { id: "b2", onderdeelId: "crew-camera", naam: "Joris", status: "optie", bedrag: 400, eenheid: "dag" },
  ] };
const sync1 = P.synchroniseerCrewStappen(crewItem);
test("crew-rol niet klaar zolang niet iedereen bevestigd is", sync1.substappen[0].afgevinkt === false);
test("rol zonder namen houdt handmatig vinkje", sync1.substappen[1].afgevinkt === true);
const sync2 = P.synchroniseerCrewStappen({ ...crewItem, bezetting: crewItem.bezetting.map(b => ({ ...b, status: "bevestigd" })) });
test("iedereen bevestigd → rol automatisch afgevinkt", sync2.substappen[0].afgevinkt === true && sync2.substappen[2].afgevinkt === false);
const sam = P.bezettingSamenvatting([crewItem, { bezetting: [{ naam: "Hotel Ibis", status: "bevestigd", bedrag: 320, eenheid: "totaal" }, { naam: "", bedrag: 99 }] }]);
test("samenvatting: aantal, bevestigd, bedragen per eenheid (lege regels tellen niet)", sam.aantal === 3 && sam.bevestigd === 2 && sam.perEenheid.dag === 850 && sam.perEenheid.totaal === 320);
test("prijstekst", P.prijsTekst(450, "dag") === "€ 450 per dag" && P.prijsTekst(1250.5, "totaal") === "€ 1.250,50");

sectie("Contactenboek — namen en prijzen onthouden");
let boek = [];
let r1 = P.onthoudContact(boek, { onderdeelId: "crew-camera", naam: "Sanne de Vries", bedrag: 450, eenheid: "dag", notitie: "06-12345678" }, { projectId: "p1", projectNaam: "Häcker", datum: "2026-11-22", nieuwId });
boek = r1.contacten;
test("nieuwe naam wordt contact met rol, project en prijs", boek.length === 1 && boek[0].rollen.join() === "crew-camera" && boek[0].prijzen["crew-camera"].bedrag === 450 && boek[0].notitie === "06-12345678" && r1.contactId === boek[0].id);
boek = P.onthoudContact(boek, { onderdeelId: "crew-camera", naam: "sanne de vries ", bedrag: 500, eenheid: "dag" }, { projectId: "p2", projectNaam: "Bakkerij", datum: "2027-02-01", nieuwId }).contacten;
test("zelfde naam (andere schrijfwijze) → zelfde contact, nieuwe prijs, oude in historie", boek.length === 1 && boek[0].prijzen["crew-camera"].bedrag === 500 && boek[0].prijzen["crew-camera"].historie[0].bedrag === 450 && boek[0].projecten.length === 2);
boek = P.onthoudContact(boek, { onderdeelId: "crew-belichter", naam: "Sanne de Vries", bedrag: null }, { projectId: "p2", datum: "2027-02-01", nieuwId }).contacten;
test("tweede rol erbij, zonder prijs → prijzen blijven", boek[0].rollen.join() === "crew-camera,crew-belichter" && boek[0].prijzen["crew-camera"].bedrag === 500 && boek[0].projecten.length === 2);
boek = P.onthoudContact(boek, { onderdeelId: "loc-interieur", naam: "Studio Noord", bedrag: 900, eenheid: "dag" }, { projectId: "p3", datum: "2027-03-01", nieuwId }).contacten;
const sug = P.contactSuggesties(boek, "crew-camera", "");
test("suggesties: eerst wie deze rol eerder deed, met laatste prijs", sug[0].naam === "Sanne de Vries" && sug[0].zelfdeRol && sug[0].laatstePrijs.bedrag === 500);
test("suggesties filteren op getypte tekst", P.contactSuggesties(boek, "crew-camera", "noord").map(c => c.naam).join() === "Studio Noord");
test("telefoon en adres worden onthouden (voor de callsheet)", (() => { const b = P.onthoudContact(boek, { onderdeelId: "loc-interieur", naam: "Studio Noord", telefoon: "013-1234567", adres: "Noordweg 1, Tilburg" }, { datum: "2027-03-02", nieuwId }).contacten; const c = b.find(x => x.naam === "Studio Noord"); return c.telefoon === "013-1234567" && c.adres === "Noordweg 1, Tilburg" && c.prijzen["loc-interieur"].bedrag === 900; })());
test("lege naam wordt niet onthouden", P.onthoudContact(boek, { naam: "  " }, { nieuwId }).contacten.length === boek.length);

sectie("Postproductie-onderdelen");
const postP = P.pasOnderdelenToe(P.maakProjectUitSjabloon(klein, { naam: "Post", draaidag: "2027-01-20", opleverdatum: "2027-02-10", vandaag: "2026-11-22", nieuwId }),
  ["edit-v1", "edit-v2", "kleurcorrectie", "afmixen", "animatie", "muziek-componeren"], { draaidag: "2027-01-20", vandaag: "2026-11-22", nieuwId });
const po = (id) => postP.items.filter(i => i.onderdeelId === id);
test("edit v1 koppelt aan 'Eerste montage'", po("edit-v1")[0].sjabloonStapId === "k-montage");
test("edit v2 koppelt aan 'Feedback verwerken', NIET aan 'V1 doorsturen … voor feedback'", po("edit-v2")[0].sjabloonStapId === "k-feedback");
test("kleurcorrectie koppelt aan bestaande stap", po("kleurcorrectie")[0].sjabloonStapId === "k-kleur");
test("animatie: nieuwe post-taak, deadline t.o.v. oplevering", po("animatie")[0].category === "post" && po("animatie")[0].anker === "oplever" && po("animatie")[0].dueDate === "2027-02-04");
test("muziek componeren 14 dagen vóór oplevering", po("muziek-componeren")[0].dueDate === "2027-01-27");
test("afmixen wordt eigen taak (klein sjabloon combineerde het met kleur)", po("afmixen").length === 1 && !po("afmixen")[0].sjabloonStapId);
test("oplevering verschuiven schuift post-onderdelen mee", P.verschuifProject(postP, { opleverdatum: "2027-02-17" }).items.find(i => i.onderdeelId === "animatie").dueDate === "2027-02-11");
test("groot: edit lock en grading koppelen aan sjabloon", (() => { const g = P.pasOnderdelenToe(basisP, ["edit-lock", "grading", "muziek-stock", "edit-v2"], ctxO); const f = (id) => g.items.find(i => i.onderdeelId === id)?.sjabloonStapId; return f("edit-lock") === "g-lock" && f("grading") === "g-grading" && f("muziek-stock") === "g-muziek" && f("edit-v2") === "g-feedback2"; })());

sectie("Deliverables — door het hele proces");
const del = { tvc: ["16x9"], online: ["9x16", "16x9", "rommel"], "online-paid": [], fotografie: true };
test("normaliseren: volgorde formaten, ongeldige en lege weg", JSON.stringify(P.normaliseerDeliverables(del)) === JSON.stringify({ fotografie: true, tvc: ["16x9"], online: ["16x9", "9x16"] }));
test("regels per kanaal × formaat + fotografie", P.deliverableRegels(del).map(r => r.tekst).join("|") === "TVC — 16x9|Online — 16x9|Online — 9x16|Fotografie — selectie + retouche");
test("korte tekst voor de projectkop", P.deliverablesTekst(del) === "TVC 16x9 · Online 16x9/9x16 · Fotografie");
const metDel = P.pasOnderdelenToe(P.maakProjectUitSjabloon(klein, { naam: "D", draaidag: "2027-01-20", opleverdatum: "2027-02-10", vandaag: "2026-11-22", nieuwId }), [], { vandaag: "2026-11-22", deliverables: del, nieuwId });
const opl = metDel.items.find(i => i.onderdeelId === "deliverables");
test("opleverstap uit het sjabloon wordt de deliverables-checklist", opl.sjabloonStapId === "k-oplever" && opl.substappen.filter(s => s.delivId).length === 4);
test("deliverables bij het project bewaard", metDel.project.deliverables.tvc[0] === "16x9");
const opl2 = P.pasOnderdelenToe({ ...metDel, items: metDel.items.map(i => (i.onderdeelId === "deliverables" ? { ...i, substappen: i.substappen.map(s => (s.delivId === "tvc-16x9" ? { ...s, afgevinkt: true } : s)) } : i)) },
  [], { vandaag: "2026-11-22", deliverables: { tvc: ["16x9"], "online-paid": ["4x5"] }, nieuwId }).items.find(i => i.onderdeelId === "deliverables");
test("deliverables wijzigen: vinkje blijft, weggehaald formaat weg, nieuw formaat erbij", opl2.substappen.filter(s => s.delivId).map(s => `${s.delivId}:${s.afgevinkt}`).join() === "tvc-16x9:true,online-paid-4x5:false");
test("zonder opleverstap in sjabloon: nieuwe taak op de opleverdag", (() => { const t = P.pasOnderdelenToe({ items: [], project: { draaidag: "2027-01-20", opleverdatum: "2027-02-10" } }, [], { vandaag: "2026-11-22", deliverables: { online: ["1x1"] }, nieuwId }).items[0]; return t.name === "Deliverables opleveren" && t.dueDate === "2027-02-10" && t.category === "post"; })());
test("PPM-document noemt deliverables en buy-outs", P.onderdeelVan("ppm-document").stappen.some(s => /deliverables/i.test(s)));

sectie("Buy-outs — cast en fotograaf");
test("buy-out geldt voor cast en fotograaf, niet voor bv. camera", P.buyoutSoort("figuranten") === "cast" && P.buyoutSoort("crew-fotografie") === "fotografie" && P.buyoutSoort("crew-camera") === null);
test("standaard buy-outs volgen de deliverables (TVC → TV)", P.standaardBuyouts(del, "acteurs").map(b => b.medium).join() === "tv,online");
test("fotograaf: geen TV-buy-out", P.standaardBuyouts({ tvc: ["16x9"], "online-paid": ["4x5"] }, "crew-fotografie").map(b => b.medium).join() === "online-paid");
test("einddatum buy-out: 1 jaar vanaf 10 feb → 9 feb", P.buyoutEinde("2027-02-10", "1j") === "2028-02-09");
test("einddatum 6 maanden vanaf 31 aug → 27 feb (geen doorrollen)", P.buyoutEinde("2026-08-31", "6m") === "2027-02-27");
test("onbeperkt → geen einddatum", P.buyoutEinde("2027-02-10", "onbeperkt") === null);
const sb = P.bezettingSamenvatting([{ bezetting: [{ naam: "Eva", status: "bevestigd", bedrag: 600, eenheid: "dag", buyouts: [{ medium: "tv", duur: "1j", bedrag: 1500 }, { medium: "online", duur: "1j", bedrag: 750 }] }] }]);
test("buy-outbedragen apart opgeteld", sb.perEenheid.dag === 600 && sb.perEenheid.buyout === 2250 && P.prijsTekst(2250, "buyout") === "€ 2.250 buy-outs");
const bk = P.onthoudContact([], { onderdeelId: "acteurs", naam: "Eva", bedrag: 600, eenheid: "dag", buyouts: [{ medium: "tv", duur: "1j", bedrag: 1500 }, { medium: "online", duur: null, bedrag: null }] }, { projectId: "p", projectNaam: "P", datum: "2026-11-22", nieuwId }).contacten;
test("buy-outafspraak onthouden bij het contact (lege regels niet)", bk[0].prijzen.acteurs.buyouts.length === 1 && bk[0].prijzen.acteurs.buyouts[0].bedrag === 1500 && bk[0].prijzen.acteurs.bedrag === 600);

sectie("Eigen planning — zelf afspraken toevoegen");
const epBasis = P.maakProjectUitSjabloon(klein, { naam: "EP", draaidag: "2027-01-20", opleverdatum: "2027-02-10", vandaag: "2026-11-22", nieuwId });
const ep = [
  { id: "e1", naam: "Moodboardpresentatie", datum: "2026-12-15", tijd: "14:00" },
  { id: "e2", naam: "Extra draaidag", datum: "2027-01-20", tijd: "08:00" },
  { id: "e3", naam: "Review met klant", datum: "2027-02-01", tijd: "11:30" },
  { id: "e4", naam: "  ", datum: "2027-02-02" },
];
const epP = P.pasOnderdelenToe(epBasis, [], { vandaag: "2026-11-22", eigenPlanning: ep, nieuwId });
const epi = (id) => epP.items.filter(i => i.eigenPlanningId === id);
test("elke afspraak wordt één taak met herinnering een uur vooraf", epi("e1").length === 1 && epi("e1")[0].dueDate === "2026-12-15" && epi("e1")[0].herinnering === "2026-12-15T13:00" && epi("e1")[0].note === "Om 14:00");
test("fase volgt de datum: vóór / op / na de draaidag", epi("e1")[0].category === "pre" && epi("e2")[0].category === "productie" && epi("e3")[0].category === "post");
test("afspraak zonder naam wordt genegeerd", !epi("e4").length && epP.project.eigenPlanning.length === 3);
const epGewijzigd = P.pasOnderdelenToe(epP, [], { vandaag: "2026-11-22", eigenPlanning: [{ ...ep[0], datum: "2026-12-16" }, ep[2]], nieuwId });
test("verzetten werkt de taak bij (geen dubbele)", epGewijzigd.items.filter(i => i.eigenPlanningId === "e1").length === 1 && epGewijzigd.items.find(i => i.eigenPlanningId === "e1").dueDate === "2026-12-16");
test("weggehaalde afspraak verdwijnt", !epGewijzigd.items.some(i => i.eigenPlanningId === "e2"));
test("zonder eigenPlanning-parameter blijft alles staan", P.pasOnderdelenToe(epP, [], { vandaag: "2026-11-22", nieuwId }).items.filter(i => i.eigenPlanningId).length === 3);
const verzetInTaak = { ...epP, items: epP.items.map(i => (i.eigenPlanningId === "e1" ? { ...i, dueDate: "2026-12-18", note: "Om 09:30" } : i)) };
const gelezen = P.leesPlanningUitTaken(verzetInTaak);
test("planning wordt uit de taken gelezen (in de taak verzet → gaat mee)", gelezen.eigenPlanning.find(e => e.id === "e1").datum === "2026-12-18" && gelezen.eigenPlanning.find(e => e.id === "e1").tijd === "09:30");
test("eigen planning wordt niet als sjabloonstap voorgesteld", !P.berekenLeerVoorstellen(klein, epP).some(v => v.type === "toevoegen"));
test("eigen planning telt niet als 'verdwijnende' onderdeeltaak", P.telVerdwijnendeTaken(epP, []) === P.telVerdwijnendeTaken(epBasis, []));
let tk = P.onthoudPlanningNamen(klein, ep);
tk = P.onthoudPlanningNamen(tk, [{ naam: "Moodboardpresentatie" }]);
test("namen onthouden per sjabloon, vaakst gebruikt eerst", P.planningSuggesties(tk).join("|") === "Moodboardpresentatie|Extra draaidag|Review met klant");
test("al gekozen namen niet nogmaals voorstellen", !P.planningSuggesties(tk, [{ naam: "moodboardpresentatie" }]).includes("Moodboardpresentatie"));

sectie("Buy-out loopt af — herinnering een maand van tevoren");
const boLijst = { id: "L", items: [{ id: "a", onderdeelId: "acteurs", bezetting: [
  { id: "b1", naam: "Eva Jansen", buyouts: [{ medium: "tv", duur: "1j" }, { medium: "online", duur: "onbeperkt" }, { medium: "online-paid", duur: null }] },
  { id: "b2", naam: "", buyouts: [{ medium: "tv", duur: "1j" }] },
] }], project: { opleverdatum: "2027-02-10", klantId: "k1" } };
const bo1 = P.synchroniseerBuyoutHerinneringen(boLijst, { nieuwId });
const boTaken = bo1.items.filter(i => i.buyoutKey);
test("alleen buy-outs met een looptijd (niet onbeperkt, niet leeg, niet zonder naam)", boTaken.length === 1);
test("einde 1 jaar na oplevering (9 feb 2028) → herinnering 9 jan 2028 om 10:00", boTaken[0].dueDate === "2028-01-09" && boTaken[0].herinnering === "2028-01-09T10:00");
test("duidelijke naam en notitie, belangrijk, postproductie, klant", /Eva Jansen — TV/.test(boTaken[0].name) && /09-02-2028/.test(boTaken[0].note) && boTaken[0].belangrijk && boTaken[0].category === "post" && boTaken[0].klantId === "k1");
test("opnieuw synchroniseren zonder wijziging → zelfde object (niets opslaan)", P.synchroniseerBuyoutHerinneringen(bo1, { nieuwId }) === bo1);
const live = P.synchroniseerBuyoutHerinneringen({ ...bo1, project: { ...bo1.project, liveDatum: "2027-03-01" } }, { nieuwId });
test("campagne live later → einddatum en herinnering schuiven mee (geen dubbele taak)", live.items.filter(i => i.buyoutKey).length === 1 && live.items.find(i => i.buyoutKey).dueDate === "2028-01-29");
const korter = P.synchroniseerBuyoutHerinneringen({ ...bo1, items: bo1.items.map(i => (i.id === "a" ? { ...i, bezetting: [{ ...i.bezetting[0], buyouts: [{ medium: "tv", duur: "6m" }] }] } : i)) }, { nieuwId });
test("looptijd korter → herinnering eerder", korter.items.find(i => i.buyoutKey).dueDate === "2027-07-09");
const weg = P.synchroniseerBuyoutHerinneringen({ ...bo1, items: bo1.items.map(i => (i.id === "a" ? { ...i, bezetting: [] } : i)) }, { nieuwId });
test("buy-out of naam weg → open herinnering weg", !weg.items.some(i => i.buyoutKey));
const afgevinkt = { ...bo1, items: bo1.items.map(i => (i.buyoutKey ? { ...i, checked: true } : i.id === "a" ? { ...i, bezetting: [] } : i)) };
test("afgevinkte herinnering blijft staan", P.synchroniseerBuyoutHerinneringen(afgevinkt, { nieuwId }).items.some(i => i.buyoutKey));
test("zonder oplever- of livedatum: geen herinnering", !P.synchroniseerBuyoutHerinneringen({ ...boLijst, project: {} }, { nieuwId }).items.some(i => i.buyoutKey));
test("buy-outherinnering wordt niet als sjabloonstap voorgesteld", !P.berekenLeerVoorstellen(klein, { ...bo1, project: { ...bo1.project, stapIds: [] }, items: bo1.items.map(i => (i.buyoutKey ? { ...i, category: "post" } : i)) }).some(v => v.type === "toevoegen"));

sectie("Meerdere draaidagen");
const mdBasis = P.maakProjectUitSjabloon(groot, { naam: "MD", draaidag: "2027-01-20", opleverdatum: "2027-02-17", vandaag: "2026-11-22", nieuwId });
test("oud project zonder lijst draaidagen: één dag uit project.draaidag", P.draaidagenVan(mdBasis.project).length === 1 && P.draaidagenVan(mdBasis.project)[0].datum === "2027-01-20");
const md = P.zetDraaidagen(mdBasis, [{ datum: "2027-01-21" }, { datum: "2027-01-20" }, { datum: "2027-01-22" }, { datum: "2027-01-21" }], { nieuwId });
const dd = md.items.filter(i => i.draaidagId);
test("dagen gesorteerd, dubbele weg, eerste = project.draaidag", md.project.draaidagen.map(d => d.datum).join() === "2027-01-20,2027-01-21,2027-01-22" && md.project.draaidag === "2027-01-20");
test("sjabloonstap 'Draaidagen' wordt dag 1, plus taken voor dag 2 en 3", dd.length === 3 && dd[0].sjabloonStapId === "g-draai" && dd.map(i => i.name).join() === "Draaidag 1,Draaidag 2,Draaidag 3");
test("draaidagtaken in productie, met offset t.o.v. dag 1", dd.every(i => i.category === "productie") && dd.map(i => i.offset).join() === "0,1,2");
const mdVerschoven = P.verschuifProject(md, { draaidag: "2027-01-27" });
test("planning verschuiven: alle draaidagen schuiven als blok mee", mdVerschoven.project.draaidagen.map(d => d.datum).join() === "2027-01-27,2027-01-28,2027-01-29" && mdVerschoven.items.filter(i => i.draaidagId).map(i => i.dueDate).join() === "2027-01-27,2027-01-28,2027-01-29");
const md2 = P.zetDraaidagen(md, md.project.draaidagen.filter(d => d.datum !== "2027-01-21"), { nieuwId });
test("dag verwijderen: open taak weg, nummering opnieuw", md2.items.filter(i => i.draaidagId).map(i => i.name).join() === "Draaidag 1,Draaidag 2" && md2.items.filter(i => i.draaidagId)[1].dueDate === "2027-01-22");
const md1 = P.zetDraaidagen(md2, [md2.project.draaidagen[0]], { nieuwId });
test("terug naar één dag: één draaidagtaak", md1.items.filter(i => i.draaidagId).length === 1);
test("zonder dagen: niets veranderen", P.zetDraaidagen(md, [], { nieuwId }) === md);

sectie("Begroting — offerte tegenover kosten");
test("dagprijs zonder aantal = aantal draaidagen", P.bezettingKosten({ bedrag: 450, eenheid: "dag" }, 3).totaal === 1350);
test("eigen aantal gaat voor", P.bezettingKosten({ bedrag: 450, eenheid: "dag", aantal: 2 }, 3).totaal === 900);
test("totaalprijs: altijd 1×", P.bezettingKosten({ bedrag: 900, eenheid: "totaal", aantal: 5 }, 3).totaal === 900);
test("uurprijs × uren", P.bezettingKosten({ bedrag: 60, eenheid: "uur", aantal: 7.5 }, 1).totaal === 450);
test("buy-outs tellen mee", P.bezettingKosten({ bedrag: 650, eenheid: "dag", buyouts: [{ bedrag: 1500 }, { bedrag: null }] }, 2).totaal === 2800);
const bg = P.projectBegroting({ items: [
  { name: "Crew", bezetting: [{ naam: "Sanne", status: "bevestigd", bedrag: 450, eenheid: "dag" }, { naam: "Joris", status: "optie", bedrag: 400, eenheid: "dag" }, { naam: "", bedrag: 999 }] },
  { name: "Cast", bezetting: [{ naam: "Eva", status: "bevestigd", bedrag: 650, eenheid: "dag", buyouts: [{ medium: "tv", bedrag: 1500 }] }, { naam: "Piet", status: "optie" }] },
], project: { draaidagen: [{ id: "a", datum: "2027-01-20" }, { id: "b", datum: "2027-01-21" }], offerte: { bedrag: 6000 }, kostenposten: [{ id: "k", omschrijving: "Reiskosten", bedrag: 300 }] } });
test("bevestigde kosten (2 draaidagen) + overige posten", bg.bevestigd === 900 + 2800 + 300);
test("incl. opties", bg.inclOpties === 900 + 800 + 2800 + 300);
test("marge en percentage t.o.v. offerte", bg.offerte === 6000 && bg.marge === 6000 - 4800 && bg.margePct === 20 && !bg.overschreden);
test("namen zonder prijs worden geteld", bg.zonderPrijs === 1);
test("buy-outs apart zichtbaar", bg.buyouts === 1500);
test("over het budget → waarschuwing", P.projectBegroting({ items: [{ bezetting: [{ naam: "X", bedrag: 7000, eenheid: "totaal" }] }], project: { budget: 5000 } }).overschreden === true);
test("zonder offerte/budget: geen marge", P.projectBegroting({ items: [], project: {} }).marge === null);

samenvatting();
