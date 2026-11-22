const fs = require("fs");
const path = require("path");
const { sectie, test, samenvatting } = require("./testhulp.js");

// lib/taken-logica.js is bewust importvrij: hier laden we het hele bestand
// rechtstreeks (alleen de `export`-woordjes eraf), zodat de tests altijd de
// echte, actuele code controleren — geen kopie.
const bron = fs.readFileSync(path.join(__dirname, "../lib/taken-logica.js"), "utf8").replace(/^export /gm, "");
const namen = [...bron.matchAll(/^(?:function|const) ([A-Za-z_]\w*)/gm)].map(m => m[1]);
const L = new Function(`${bron}\nreturn { ${namen.join(", ")} };`)();

let chronoNl = null;
try { chronoNl = require("chrono-node").nl; } catch { /* zonder node_modules: chrono-tests overslaan */ }

const herh = (h) => L.normaliseerHerhaling(h);

sectie("Herhaling — oude string-vorm blijft werken");
test("'dagelijks' → elke dag", JSON.stringify(herh("dagelijks")) === JSON.stringify({ freq: "dag", interval: 1 }));
test("'wekelijks' → +7 dagen", L.volgendeHerhalingsDatum("2026-11-23", "wekelijks") === "2026-11-30");
test("'maandelijks' 31 jan → 28 feb (geen doorrollen naar maart)", L.volgendeHerhalingsDatum("2027-01-31", "maandelijks") === "2027-02-28");
test("'maandelijks' 31 jan schrikkeljaar → 29 feb", L.volgendeHerhalingsDatum("2028-01-31", "maandelijks") === "2028-02-29");
test("onbekende herhaling → null", herh("soms") === null && herh({ freq: "uur" }) === null);
test("interval wordt geklemd en afgerond", herh({ freq: "dag", interval: 0 }).interval === 1 && herh({ freq: "dag", interval: 2.7 }).interval === 2);

sectie("Herhaling — nieuwe mogelijkheden");
test("om de 3 dagen", L.volgendeHerhalingsDatum("2026-11-23", { freq: "dag", interval: 3 }) === "2026-11-26");
test("om de 2 weken", L.volgendeHerhalingsDatum("2026-11-23", { freq: "week", interval: 2 }) === "2026-12-07");
test("jaarlijks 29 feb → 28 feb volgend jaar", L.volgendeHerhalingsDatum("2028-02-29", "jaarlijks") === "2029-02-28");
test("werkdagen: vrijdag → maandag", L.volgendeHerhalingsDatum("2026-11-27", "werkdagen") === "2026-11-30");
test("werkdagen: dinsdag → woensdag", L.volgendeHerhalingsDatum("2026-11-24", "werkdagen") === "2026-11-25");
test("werkdagen: zaterdag → maandag", L.volgendeHerhalingsDatum("2026-11-28", "werkdagen") === "2026-11-30");
const maDo = { freq: "week", interval: 1, dagen: [4, 1] };
test("ma+do: dagen worden gesorteerd", herh(maDo).dagen.join() === "1,4");
test("ma+do: maandag → donderdag", L.volgendeHerhalingsDatum("2026-11-23", maDo) === "2026-11-26");
test("ma+do: donderdag → volgende maandag", L.volgendeHerhalingsDatum("2026-11-26", maDo) === "2026-11-30");
const om2maDo = { freq: "week", interval: 2, dagen: [1, 4] };
test("om de 2 weken ma+do: ma → do zelfde week", L.volgendeHerhalingsDatum("2026-11-23", om2maDo) === "2026-11-26");
test("om de 2 weken ma+do: do → ma twee weken later", L.volgendeHerhalingsDatum("2026-11-26", om2maDo) === "2026-12-07");
test("over de jaargrens", L.volgendeHerhalingsDatum("2026-12-31", "dagelijks") === "2027-01-01");
test("over de zomertijdwissel (29 mrt 2026) gewoon +1 dag", L.volgendeHerhalingsDatum("2026-03-28", "dagelijks") === "2026-03-29" && L.volgendeHerhalingsDatum("2026-03-29", "dagelijks") === "2026-03-30");

sectie("Herhaling — labels");
test("Werkdagen", L.herhalingLabel("werkdagen") === "Werkdagen");
test("Om de 2 weken op ma, do", L.herhalingLabel(om2maDo) === "Om de 2 weken op ma, do");
test("Elke maand", L.herhalingLabel("maandelijks") === "Elke maand");
test("Om de 3 dagen", L.herhalingLabel({ freq: "dag", interval: 3 }) === "Om de 3 dagen");
test("geen herhaling → lege tekst", L.herhalingLabel(null) === "");

sectie("Afvinken — herhalende taak rolt door, herinnering schuift mee");
const herhalend = { id: "a", name: "Kliko", dueDate: "2026-11-23", herinnering: "2026-11-22T20:00", herhaling: "wekelijks", checked: false, mijnDag: "2026-11-22" };
const gevinkt = L.vinkTaak(herhalend, { wie: "Pepijn", nu: 1, vandaag: "2026-11-22" });
test("vervaldatum +1 week", gevinkt.dueDate === "2026-11-30");
test("herinnering +1 week, zelfde tijd", gevinkt.herinnering === "2026-11-29T20:00");
test("blijft open (niet afgevinkt)", gevinkt.checked === false);
test("handmatige Mijn dag vervalt", gevinkt.mijnDag === null);
test("wie/wanneer bijgewerkt", gevinkt.lastActionBy === "Pepijn" && gevinkt.lastActionAt === 1);
const alleenHerinnering = L.vinkTaak({ id: "b", herinnering: "2026-11-23T09:00", herhaling: "dagelijks", checked: false }, { vandaag: "2026-11-22" });
test("alleen herinnering (geen vervaldatum): herinnering schuift, vervaldatum blijft leeg", alleenHerinnering.herinnering === "2026-11-24T09:00" && alleenHerinnering.dueDate === null);
const gewoon = L.vinkTaak({ id: "c", checked: false }, { nu: 5 });
test("gewone taak wordt afgevinkt met voltooidOp", gewoon.checked === true && gewoon.voltooidOp === 5);
test("nogmaals → weer open, voltooidOp leeg", L.vinkTaak(gewoon).checked === false && L.vinkTaak(gewoon).voltooidOp === null);

sectie("Mijn dag en Gepland");
const vandaag = "2026-11-22";
test("verlopen taak staat in Mijn dag", L.isInMijnDag({ dueDate: "2026-11-20" }, vandaag));
test("handmatig toegevoegd voor vandaag", L.isInMijnDag({ mijnDag: vandaag }, vandaag));
test("handmatig van gisteren telt niet meer", !L.isInMijnDag({ mijnDag: "2026-11-21" }, vandaag));
test("herinnering vandaag telt mee", L.isInMijnDag({ herinnering: "2026-11-22T15:00" }, vandaag));
test("afgevinkt nooit in Mijn dag", !L.isInMijnDag({ dueDate: vandaag, checked: true }, vandaag));
test("toekomstige taak niet in Mijn dag", !L.isInMijnDag({ dueDate: "2026-11-25" }, vandaag));
const gepland = L.groepeerGepland([
  { id: "1", dueDate: "2026-11-20" }, { id: "2", dueDate: vandaag }, { id: "3", herinnering: "2026-11-23T08:00" },
  { id: "4", dueDate: "2026-11-27" }, { id: "5", dueDate: "2027-01-05" }, { id: "6" }, { id: "7", dueDate: vandaag, checked: true },
], vandaag);
test("groepen in volgorde te laat → later", gepland.map(g => g.id).join() === "telaat,vandaag,morgen,week,later");
test("taak zonder datum en afgevinkte taak vallen weg", gepland.reduce((n, g) => n + g.items.length, 0) === 5);
test("alleen-herinnering valt onder Morgen", gepland.find(g => g.id === "morgen").items[0].id === "3");
test("sorteren op vervaldatum zet zonder-datum achteraan", L.sorteerTaken([{ name: "x" }, { name: "y", dueDate: "2026-01-01" }], "vervaldatum")[0].name === "y");

sectie("Tijdzone — Nederlandse wandklok ↔ exact moment");
test("winter: 23 nov 09:00 = 08:00 UTC", L.lokaalNaarEpoch("2026-11-23T09:00") === Date.UTC(2026, 10, 23, 8, 0));
test("zomer: 1 jul 09:00 = 07:00 UTC", L.lokaalNaarEpoch("2026-07-01T09:00") === Date.UTC(2026, 6, 1, 7, 0));
test("dag van de zomertijdwissel 29 mrt 12:00 = 10:00 UTC", L.lokaalNaarEpoch("2026-03-29T12:00") === Date.UTC(2026, 2, 29, 10, 0));
test("terug: epoch → lokale tijd", L.epochNaarLokaal(Date.UTC(2026, 10, 23, 8, 0)) === "2026-11-23T09:00");
test("ongeldige invoer → null", L.lokaalNaarEpoch("morgen") === null);

sectie("Herinneringen inplannen — alleen wat nodig is");
const nu = Date.UTC(2026, 10, 22, 5, 30); // 22 nov 06:30 NL
const lijsten = [{ id: "L", items: [
  { id: "a", name: "A", herinnering: "2026-11-22T09:00" },
  { id: "b", name: "B", herinnering: "2026-11-22T06:00" },             // al voorbij
  { id: "c", name: "C", herinnering: "2026-12-20T09:00" },             // verder dan horizon
  { id: "d", name: "D", herinnering: "2026-11-23T09:00", checked: true },
  { id: "e", name: "E", herinnering: "2026-11-24T10:00" },
] }];
const leeg = L.berekenHerinneringWijzigingen(lijsten, {}, nu);
test("alleen toekomstige, open, binnen-de-horizon herinneringen worden gepland", leeg.plannen.map(p => p.itemId).sort().join() === "a,e");
test("plan bevat lijst-id en exact moment", leeg.plannen.find(p => p.itemId === "a").listId === "L" && leeg.plannen.find(p => p.itemId === "a").epoch === Date.UTC(2026, 10, 22, 8, 0));
const bestaand = { a: { tijd: "2026-11-22T09:00", messageId: "m1" }, e: { tijd: "2026-11-24T09:00", messageId: "m2" }, d: { tijd: "2026-11-23T09:00", messageId: "m3" } };
const wijz = L.berekenHerinneringWijzigingen(lijsten, bestaand, nu);
test("ongewijzigde herinnering wordt niet opnieuw gepland", !wijz.plannen.some(p => p.itemId === "a"));
test("gewijzigde tijd: oude annuleren, nieuwe plannen", wijz.annuleren.some(x => x.messageId === "m2") && wijz.plannen.some(p => p.itemId === "e" && p.tijd === "2026-11-24T10:00"));
test("afgevinkte taak: geplande melding annuleren", wijz.annuleren.some(x => x.messageId === "m3"));

sectie("Wie krijgt de melding?");
const subs = [{ endpoint: "1", user: "Pepijn" }, { endpoint: "2", user: "Tessa" }, { endpoint: "3" }];
test("werk: alleen de toestellen van de eigenaar", L.kiesOntvangers(subs, { ruimte: "werk", eigenaar: "Tessa" }).map(s => s.endpoint).join() === "2");
test("werk: toestel zonder bekende eigenaar krijgt niets", !L.kiesOntvangers(subs, { ruimte: "werk", eigenaar: "Pepijn" }).some(s => s.endpoint === "3"));
test("thuis, toegewezen: alleen die persoon", L.kiesOntvangers(subs, { ruimte: "thuis", toegewezenAan: "Pepijn" }).map(s => s.endpoint).join() === "1");
test("thuis, niet toegewezen: iedereen", L.kiesOntvangers(subs, { ruimte: "thuis" }).length === 3);

sectie("Slim invoeren — herhaling in gewone taal");
test("elke werkdag", L.herkenHerhaling("stand-up elke werkdag").herhaling.dagen.join() === "1,2,3,4,5");
test("om de 2 weken", JSON.stringify(L.herkenHerhaling("planten water geven om de 2 weken").herhaling) === JSON.stringify({ freq: "week", interval: 2 }));
test("elke maandag en donderdag", L.herkenHerhaling("sporten elke maandag en donderdag").herhaling.dagen.join() === "1,4");
test("tekst zonder herhaling-stukje", L.herkenHerhaling("sporten elke maandag en donderdag").rest === "sporten");
test("geen herhaling → null", L.herkenHerhaling("brood halen").herhaling === null);

if (chronoNl) {
  const zondagOchtend = new Date(2026, 10, 22, 7, 0); // zo 22 nov 2026
  const a = L.ontleedSnelleInvoer("morgen om 9 uur kliko buiten zetten", chronoNl, zondagOchtend);
  test("'morgen om 9 uur' → vervaldatum + herinnering", a.dueDate === "2026-11-23" && a.herinnering === "2026-11-23T09:00");
  test("titel zonder datumtekst, met hoofdletter", a.titel === "Kliko buiten zetten");
  const b = L.ontleedSnelleInvoer("offerte Häcker sturen vrijdag", chronoNl, zondagOchtend);
  test("alleen een dag → vervaldatum, géén herinnering", b.dueDate === "2026-11-27" && b.herinnering === null);
  test("titel blijft netjes", b.titel === "Offerte Häcker sturen");
  const c = L.ontleedSnelleInvoer("! belastingaangifte", chronoNl, zondagOchtend);
  test("'!' maakt belangrijk", c.belangrijk === true && c.titel === "Belastingaangifte" && c.dueDate === null);
  const d = L.ontleedSnelleInvoer("vuilnis buiten elke maandag", chronoNl, zondagOchtend);
  test("herhaling zonder datum start op de eerstvolgende passende dag", d.herhaling.dagen.join() === "1" && d.dueDate === "2026-11-23" && d.titel === "Vuilnis buiten");
  const e = L.ontleedSnelleInvoer("tandarts bellen", chronoNl, zondagOchtend);
  test("gewone tekst blijft gewone tekst", e.titel === "Tandarts bellen" && !e.dueDate && !e.herhaling);
} else {
  console.log("  (chrono-node niet geïnstalleerd — slim-invoeren-tests overgeslagen)");
}

sectie("Plak-import");
const plak = `Werk:
- [ ] Offerte Häcker
    draaiboek checken
    reiskosten
- [x] Factuur oktober
• Camera laten nakijken
Thuis:
1. Kliko buiten
☐ Verjaardag oma`;
const p = L.ontleedPlakImport(plak);
test("kopjes met ':' worden lijsten", p.groepen.map(g => g.lijstNaam).join() === "Werk,Thuis");
test("opsommingstekens en vinkjes verdwijnen", p.groepen[0].taken.map(t => t.tekst).join("|") === "Offerte Häcker|Camera laten nakijken");
test("ingesprongen regels worden substappen", p.groepen[0].taken[0].substappen.join("|") === "draaiboek checken|reiskosten");
test("afgevinkte regels worden overgeslagen en geteld", p.overgeslagen === 1);
test("nummering en ☐ werken ook", p.groepen[1].taken.map(t => t.tekst).join("|") === "Kliko buiten|Verjaardag oma");
test("losse regels zonder kopje → één groep zonder naam", L.ontleedPlakImport("a\nb").groepen[0].lijstNaam === null && L.ontleedPlakImport("a\nb").groepen[0].taken.length === 2);
test("lege invoer → niets", L.ontleedPlakImport("  \n ").groepen.length === 0);

sectie("Taak via e-mail");
test("Fwd:/RE:/Doorst: weg uit onderwerp", L.onderwerpNaarTitel("Fwd: RE: Doorst: Offerte draaidag") === "Offerte draaidag");
test("leeg onderwerp → standaardtitel", L.onderwerpNaarTitel("  ") === "Taak uit e-mail");
test("afzender met naam en <adres>", L.emailUitAfzender("Pepijn Robben <Pepijn@Voorbeeld.nl>") === "pepijn@voorbeeld.nl");
test("alleen toegestane afzenders", L.afzenderToegestaan("X <pepijn@voorbeeld.nl>", ["Pepijn@voorbeeld.nl"]) && !L.afzenderToegestaan("spam@x.nl", ["pepijn@voorbeeld.nl"]));
test("lege toegestane-lijst laat niets door", !L.afzenderToegestaan("pepijn@voorbeeld.nl", []));
test("token uit ontvangeradres", L.mailTokenUitAdressen(["iemand@x.nl", "Taken <taken-ab12cd34ef@abc.resend.app>"]) === "ab12cd34ef");
test("geen taken-adres → null", L.mailTokenUitAdressen(["info@x.nl"]) === null);
test("adres opbouwen", L.mailAdres("ab12cd34ef", "@ABC.resend.app") === "taken-ab12cd34ef@abc.resend.app");
test("domeincontrole", L.isGeldigDomein("abc123.resend.app") && !L.isGeldigDomein("geen domein"));

sectie("Pincode en opslaan");
test("pincode: 6–8 cijfers", L.isGeldigePin("123456") && L.isGeldigePin("12345678") && !L.isGeldigePin("12345") && !L.isGeldigePin("12345a"));
test("persoon-slug alleen voor bekende personen", L.persoonSlug("Pepijn") === "pepijn" && L.persoonSlug("Hacker") === null);
const nuMs = 1_000_000;
const huidig = [{ id: "x", items: [{ id: "1" }, { id: "2", addedAt: nuMs - 3000 }, { id: "3", addedAt: nuMs - 60000 }] }, { id: "y", items: [] }, { id: "z", items: [] }];
const samen = L.voegLijstenSamen(huidig, [{ id: "x", items: [{ id: "1" }] }], ["z"], nuMs);
test("item dat een ander toestel net toevoegde blijft behouden", samen[0].items.some(i => i.id === "2"));
test("oud item dat niet meer meekomt is echt verwijderd", !samen[0].items.some(i => i.id === "3"));
test("niet-meegestuurde lijst blijft bestaan", samen.some(l => l.id === "y"));
test("expliciet verwijderde lijst verdwijnt", !samen.some(l => l.id === "z"));
const t = L.nieuweTaak({ name: "Test" }, { wie: "Tessa", nu: 7, id: "q" });
test("nieuwe taak heeft alle velden", t.id === "q" && t.addedBy === "Tessa" && t.mijnDag === null && Array.isArray(t.substappen) && t.herinnering === null);

samenvatting();
