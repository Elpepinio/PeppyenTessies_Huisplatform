const fs = require("fs");
const path = require("path");
const { sectie, test, samenvatting } = require("./testhulp.js");

const lees = (f) => fs.readFileSync(path.join(__dirname, "../lib", f), "utf8").replace(/^import [\s\S]*?;$/gm, "").replace(/^export /gm, "");
const bron = ["taken-logica.js", "projecten-logica.js", "intake-logica.js", "callsheet-logica.js"].map(lees).join("\n");
const namen = [...new Set([...bron.matchAll(/^(?:function|const) ([A-Za-z_]\w*)/gm)].map(m => m[1]))];
const L = new Function(`${bron}\nreturn { ${namen.join(", ")} };`)();
let t = 0;
const nieuwId = () => `id${++t}`;
const V = "2026-11-22";
const kl = [{ id: "kk", naam: "Keuken Kampioen" }, { id: "hk", naam: "Häcker" }];

sectie("Intake — eerste telefoongesprek herkennen");
const a = L.leesIntake(`Belletje Angela Mostert 06 12345678 van Scheepens voor Keuken Kampioen. Ze willen 2 draaidagen begin december, prelight de dag ervoor. Post doet het bureau zelf, alleen de shoot. Budget rond de 25k. Online 16:9 en 9:16 + 1:1, ook wat stills. Acteur + 10 figuranten, in de fabriek, hotel nodig. Oplevering 18 december, live vanaf 5 januari.`, { vandaag: V, klanten: kl });
test("klant herkend", a.klantId === "kk");
test("2 draaidagen, begin december", a.draaidagen === 2 && a.draaidag === "2026-12-01");
test("aparte pre-light dag", a.prelight === "aparte-dag");
test("post door het bureau → niet door ons", a.postDoorOns === false);
test("budget 25k → 25.000", a.budget === 25000);
test("oplevering en live los van elkaar", a.opleverdatum === "2026-12-18" && a.liveDatum === "2027-01-05");
test("deliverables online in 3 formaten + fotografie", a.deliverables.online.join() === "16x9,1x1,9x16" && a.deliverables.fotografie === true);
test("onderdelen: acteurs, figuranten, interieur, hotel, fotograaf", ["acteurs", "figuranten", "loc-interieur", "hotel", "crew-fotografie"].every(id => a.onderdelen.includes(id)));
test("aantal figuranten onthouden", a.aantallen.figuranten === 10);
test("contactpersoon met telefoon (zonder 'Belletje')", a.contact.naam === "Angela Mostert" && a.contact.telefoon === "06 12345678");

const b = L.leesIntake(`Charlotte van Roosmalen 0612345678 belde. Draaien op 14-1, één dag. Prelight ochtend zelf. Wij doen ook de montage, kleurcorrectie en afmix. TV spot 30s + online cutdowns 9:16. €18.500. Deadline 30 januari.`, { vandaag: V, klanten: kl });
test("datum 14-1 → volgend jaar", b.draaidag === "2027-01-14");
test("'één dag' → 1 draaidag", b.draaidagen === 1);
test("prelight op de dag zelf", b.prelight === "zelfde-dag");
test("post door ons + post-onderdelen", b.postDoorOns === true && ["edit-v1", "kleurcorrectie", "afmixen"].every(id => b.onderdelen.includes(id)));
test("TV altijd 16:9, online 9:16", b.deliverables.tvc.join() === "16x9" && b.deliverables.online.join() === "9x16");
test("€ 18.500 en deadline", b.budget === 18500 && b.opleverdatum === "2027-01-30");
test("tussenvoegsels in naam", b.contact.naam === "Charlotte van Roosmalen");

const c = L.leesIntake("shoot van drie dagen in maart (10 maart t/m 12 maart), buiten op het strand, geen prelight, budget 40 duizend, regisseur + DOP + visagie en styling. Montage niet bij ons.", { vandaag: V });
test("drie dagen + 10 maart", c.draaidagen === 3 && c.draaidag === "2027-03-10");
test("geen prelight", c.prelight === "geen");
test("40 duizend", c.budget === 40000);
test("crew herkend", ["crew-regie", "crew-camera", "crew-visagie", "crew-stylist", "loc-exterieur"].every(id => c.onderdelen.includes(id)));
test("'montage niet bij ons' → post extern, geen post-onderdelen", c.postDoorOns === false && !c.onderdelen.includes("edit-v1"));
test("lege tekst → niets herkend", L.leesIntake("", { vandaag: V }).herkend.length === 0);
test("tijd 14:30 is geen datum", L.vindDatums("om 14:30 bellen", V).length === 0);

sectie("Intake — meerdere opties");
const opt = L.leesIntake("15 januari / di 19 jan opleveren.\nFilmen woensdag de 16 december of woensdag de 6e.\n\n2 quotes.\n20K\n90K voor de andere versies.", { vandaag: "2026-11-23" });
test("twee draaidag-opties, 'woensdag de 6e' = wo 6 januari", JSON.stringify(opt.draaidagOpties) === '["2026-12-16","2027-01-06"]' && opt.draaidag === "2026-12-16");
test("twee opleveropties (15 jan / 19 jan)", JSON.stringify(opt.opleverOpties) === '["2027-01-15","2027-01-19"]');
test("budgetten in K: € 20.000 of € 90.000", opt.budget === 20000 && JSON.stringify(opt.budgetOpties) === "[20000,90000]");
test("chip toont beide draaidagen", opt.herkend.some(h => h.label === "Draaidag: wo 16 dec of wo 6 jan"));
test("'de 23ste' zonder weekdag → maand van de datum ervoor", L.leesIntake("Draaien 20 december of de 23ste.", { vandaag: "2026-11-23" }).draaidagOpties?.[1] === "2026-12-23");
test("geen 'of' → één draaidag", !L.leesIntake("Draaien 20 december, oplevering 30 december.", { vandaag: "2026-11-23" }).draaidagOpties);
test("datumKortNl", L.datumKortNl("2026-12-16") === "wo 16 dec");

test("offerte-deadline: 'offerte voor vrijdag sturen'", L.leesIntake("Offerte voor vrijdag sturen.", { vandaag: "2026-11-23" }).offerteDeadline === "2026-11-27");
test("offerte-deadline: 'quote uiterlijk 27 november'", L.leesIntake("quote uiterlijk 27 november", { vandaag: "2026-11-23" }).offerteDeadline === "2026-11-27");
test("'2 quotes' is geen deadline", !L.leesIntake("2 quotes.\n20K", { vandaag: "2026-11-23" }).offerteDeadline);

sectie("Aanvraag → offerte → akkoord");
let lijst = L.maakAanvraag({ naam: "Häcker", klantId: "kk", intakeTekst: "notitie", herkend: a, vandaag: V, nieuwId });
test("deadline zelf gekozen + datum gesprek", (() => { const a2 = L.maakAanvraag({ naam: "Z", vandaag: V, gesprekDatum: "2026-11-20", offerteUiterlijk: "2026-11-30", nieuwId }); return a2.items[0].dueDate === "2026-11-30" && a2.items[0].herinnering === "2026-11-30T09:00" && a2.project.intake.datum === "2026-11-20"; })());
test("deadline verzetten", (() => { const a3 = L.zetOfferteDeadline(L.maakAanvraag({ naam: "Z", vandaag: V, nieuwId }), "2026-12-01"); return a3.items[0].dueDate === "2026-12-01" && a3.items[0].herinnering === "2026-12-01T09:00"; })());
test("aanvraag met taak 'offerte opstellen' over 2 dagen", L.projectStatus(lijst) === "aanvraag" && lijst.items[0].aanvraagTaak && lijst.items[0].dueDate === "2026-11-24");
test("intake, budget, live en deliverables bewaard", lijst.project.intake.tekst === "notitie" && lijst.project.budget === 25000 && lijst.project.liveDatum === "2027-01-05" && lijst.project.deliverables.fotografie);
lijst = L.aanvraagNaarOfferte(lijst, { verstuurdOp: V, bedrag: 24000, vandaag: V, nieuwId });
test("offerte verstuurd: navraag erbij, aanvraagtaak afgevinkt, intake blijft", L.projectStatus(lijst) === "offerte" && lijst.items.some(i => i.offerteNavraag) && lijst.items.find(i => i.aanvraagTaak).checked && lijst.project.intake.tekst === "notitie" && lijst.project.offerte.bedrag === 24000);
const groot = L.STANDAARD_SJABLONEN[1];
const akk = L.offerteAkkoord(lijst, groot, { draaidag: "2026-12-01", opleverdatum: "2026-12-18", vandaag: V, nieuwId });
test("akkoord: intake, budget en live gaan mee", akk.project.intake.tekst === "notitie" && akk.project.budget === 25000 && akk.project.liveDatum === "2027-01-05");
const direct = L.offerteAkkoord(L.maakAanvraag({ naam: "X", vandaag: V, nieuwId }), groot, { draaidag: "2026-12-01", vandaag: V, nieuwId });
test("direct akkoord vanuit aanvraag: aanvraagtaak afgevinkt", direct.items.find(i => i.aanvraagTaak).checked);
const af = L.offerteAfgewezen(L.maakAanvraag({ naam: "Y", vandaag: V, nieuwId }), { datum: V, reden: "te duur" });
test("gaat niet door: open aanvraagtaak weg", af.project.status === "afgewezen" && !af.items.length);

sectie("Opzet — post, draaidagen, prelight");
const klein = L.STANDAARD_SJABLONEN[0];
let pr = L.maakProjectUitSjabloon(klein, { naam: "P", draaidag: "2026-12-10", opleverdatum: "2026-12-24", vandaag: V, nieuwId });
pr = L.pasOnderdelenToe(pr, ["edit-v1", "kleurcorrectie", "afmixen", "crew-geluid"], { vandaag: V, nieuwId });
const postVoor = pr.items.filter(i => i.category === "post").map(i => i.name);
let ext = L.pasOpzetToe(pr, { postDoorOns: false, draaidagen: 2, prelight: "aparte-dag" }, { vandaag: V, nieuwId });
const postNa = ext.items.filter(i => i.category === "post").map(i => i.name);
test("post extern: montage/kleur/afmix weg", !postNa.some(n => /montage|edit v1|kleurcorrectie|afmix|feedback|v1 doorsturen/i.test(n)));
test("post extern: factuur en apparatuur terugbrengen blijven", postNa.some(n => /factuur/i.test(n)) && postNa.some(n => /apparatuur/i.test(n)));
test("post extern: taak 'footage overdragen' op de dag na de láátste draaidag", ext.items.some(i => i.opzetTaak === "overdracht" && i.dueDate === "2026-12-12"));
test("overdracht schuift mee als er een draaidag bij komt", L.zetDraaidagen(ext, [...L.draaidagenVan(ext.project), { id: "d3", datum: "2026-12-12" }], { nieuwId }).items.find(i => i.opzetTaak === "overdracht").dueDate === "2026-12-13");
test("2 draaidagen", L.draaidagenVan(ext.project).length === 2 && ext.items.filter(i => i.draaidagId).length === 2);
test("pre-light dag op de dag vóór de eerste draaidag", ext.items.some(i => i.opzetTaak === "prelight" && i.dueDate === "2026-12-09" && i.name === "Pre-light dag"));
test("opzet bewaard", ext.project.opzet.postDoorOns === false && ext.project.opzet.prelight === "aparte-dag" && ext.project.opzet.draaidagen === 2);
test("leren stelt weggehaalde post-stappen niet voor als 'verwijderen'", !L.berekenLeerVoorstellen(klein, ext).some(v => v.type === "verwijderen" || v.type === "toevoegen"));
const terug = L.pasOpzetToe(ext, { postDoorOns: true, prelight: "zelfde-dag", draaidagen: 1 }, { vandaag: V, nieuwId });
test("post weer aan: alle post-taken terug, overdracht weg", terug.items.filter(i => i.category === "post").length === postVoor.length && !terug.items.some(i => i.opzetTaak === "overdracht"));
test("prelight gewisseld naar 'op de draaidag'", terug.items.filter(i => i.opzetTaak === "prelight").length === 1 && terug.items.find(i => i.opzetTaak === "prelight").dueDate === "2026-12-10");
test("terug naar 1 draaidag", L.draaidagenVan(terug.project).length === 1 && !terug.items.some(i => i.draaidagId && i.name === "Draaidag 2"));
test("leren: 'Draaidag 1' is geen hernoeming", !L.berekenLeerVoorstellen(klein, ext).some(v => v.type === "wijzigen"));
test("verschuiven neemt prelight en overdracht mee", (() => { const v = L.verschuifProject(ext, { draaidag: "2026-12-15" }); return v.items.find(i => i.opzetTaak === "prelight").dueDate === "2026-12-14" && v.items.find(i => i.opzetTaak === "overdracht").dueDate === "2026-12-17"; })());
test("callsheet: prelight-call bij prelight op de draaidag", L.bouwCallsheet(terug, "dag1", {}).calls.some(c => /prelight/i.test(c.wat)));

samenvatting();
