const fs = require("fs");
const path = require("path");
const { sectie, test, samenvatting } = require("./testhulp.js");
const lees = (f) => fs.readFileSync(path.join(__dirname, "../lib", f), "utf8").replace(/^import [\s\S]*?;$/gm, "").replace(/^export /gm, "");
const bron = ["taken-logica.js", "projecten-logica.js", "intake-logica.js", "offerte-pdf-logica.js", "offerte-versies-logica.js"].map(lees).join("\n");
const namen = [...new Set([...bron.matchAll(/^(?:function|const) ([A-Za-z_]\w*)/gm)].map(m => m[1]))];
const L = new Function(`${bron}\nreturn { ${namen.join(", ")} };`)();
let t = 0;
const nieuwId = () => `id${++t}`;
const V = "2026-11-24";
const spec = (regels, totaal) => L.compacteSpecificatie(L.leesOfferte(["Specificatie", ...regels, { tekst: `Totaal exclusief BTW € ${totaal}`, x: 380 }].map(r => (typeof r === "string" ? { tekst: r, x: 120 } : r))));
const s1 = spec([
  "Crew 1x 2.550,00 € 2.550,00",
  { tekst: "Cameraman - high end 2 dag € 850,00 € 1.700,00", x: 135 },
  { tekst: "Belichter 1 dag € 850,00 € 850,00", x: 135 },
  "Casting 1 prijs 1.600,00 € 1.600,00",
  { tekst: "Edelfigurant 1 stuks € 1.600,00 € 1.600,00", x: 135 },
], "4.150,00");
const s2 = spec([
  "Crew 1x 3.300,00 € 3.300,00",
  { tekst: "Cameraman - high end 3 dag € 850,00 € 2.550,00", x: 135 },
  { tekst: "Geluidsman 1 dag € 750,00 € 750,00", x: 135 },
  "Casting 1 prijs 1.600,00 € 1.600,00",
  { tekst: "Edelfigurant 1 stuks € 1.600,00 € 1.600,00", x: 135 },
], "4.900,00");

sectie("Offerteversies — varianten en revisies");
let l = L.maakOfferte({ naam: "NOISE", verstuurdOp: V, bedrag: 20000, vandaag: V, nieuwId });
test("bestaande offerte = versie 1 (open)", L.offerteVersies(l.project).length === 1 && L.offerteVersies(l.project)[0].status === "open");
l = L.voegOfferteVersieToe(l, { soort: "variant", naam: "2 personen", verstuurdOp: V, bedrag: 90000 }, { nieuwId });
test("variant: twee open offertes", L.openVersies(l.project).length === 2 && l.project.offertes[1].naam === "2 personen");
test("werkversie = laatst verstuurde", l.project.offerte.bedrag === 90000);
const eerste = l.project.offertes[0].id;
l = L.voegOfferteVersieToe(l, { soort: "revisie", vervangtId: eerste, verstuurdOp: "2026-11-26", bedrag: 18500, notitie: "Klant wil 1 draaidag minder" }, { nieuwId });
const rev = l.project.offertes[2];
test("revisie vervangt versie 1, krijgt naam met (v3)", l.project.offertes[0].status === "vervangen" && rev.vervangtId === eerste && /\(v3\)$/.test(rev.naam) && rev.status === "open");
test("wijzigingen: −€ 1.500", rev.wijzigingen.bedragVerschil === -1500 && /−€ 1\.500/.test(rev.wijzigingen.samenvatting));
test("open: v3 + 2 personen", L.openVersies(l.project).map(v => v.bedrag).join() === "90000,18500");
l = L.kiesOfferteVersie(l, rev.id);
test("bij akkoord gekozen: v3; de variant 'niet gekozen'; werkversie volgt", L.gekozenVersie(l.project).id === rev.id && l.project.offertes[1].status === "niet-gekozen" && l.project.offerte.bedrag === 18500);

const akk = L.offerteAkkoord(l, L.STANDAARD_SJABLONEN[0], { draaidag: "2026-12-10", vandaag: V, nieuwId });
test("akkoord houdt alle versies bij", akk.project.offertes.length === 3 && akk.project.offerte.bedrag === 18500 && L.gekozenVersie(akk.project).id === rev.id);

sectie("Offerteversies — wat er veranderd is (met specificatie)");
const d = L.vergelijkOffertes({ bedrag: 4150, specificatie: s1 }, { bedrag: 4900, specificatie: s2 });
test("post erbij / eraf / gewijzigd", d.toegevoegd.map(x => x.naam).join() === "Geluidsman" && d.verwijderd.map(x => x.naam).join() === "Belichter" && d.gewijzigd.length === 1 && d.gewijzigd[0].naam === "Cameraman - high end" && d.gewijzigd[0].verschil === 850);
test("samenvatting", d.samenvatting === "+€ 750 · 1 post erbij · 1 eraf · 1 gewijzigd");
test("werkelijk / eigen meenemen naar de nieuwe versie op postnaam", JSON.stringify(L.zetSleutelsOm(s1, s2, { "0.0": 1600, "0.1": 800, "1.0": 1500 })) === '{"0.0":1600,"1.0":1500}');

sectie("Offerteversies — herziene offerte in een lopend project");
let p = L.maakProjectUitSjabloon(L.STANDAARD_SJABLONEN[0], { naam: "P", draaidag: "2026-12-10", opleverdatum: "2026-12-20", vandaag: V, nieuwId });
p = L.pasOnderdelenToe(p, ["crew-camera", "crew-belichter", "crew-geluid", "edelfiguranten"], { vandaag: V, nieuwId });
p = { ...p, project: { ...p.project, offerte: { verstuurdOp: V, bedrag: 4150, akkoordOp: V, specificatie: s1, werkelijk: { "0.0": 1600 } } } };
p = L.vulBezettingUitOfferte(p, s1, { nieuwId }).lijst;
// Belichter heeft al een naam; cameraman nog niet
p = { ...p, items: p.items.map(i => ({ ...i, bezetting: (i.bezetting || []).map(b => (b.onderdeelId === "crew-belichter" ? { ...b, naam: "Ray" } : b)) })) };
p = L.voegOfferteVersieToe(p, { soort: "revisie", verstuurdOp: "2026-11-28", bedrag: 4900, specificatie: s2, notitie: "Meerwerk: extra draaidag + geluid" }, { nieuwId });
test("revisie van de gekozen offerte wordt meteen de gekozen", L.gekozenVersie(p.project).bedrag === 4900 && p.project.offerte.bedrag === 4900 && p.project.offerte.specificatie === s2);
test("werkelijke kosten meegenomen", p.project.offerte.werkelijk["0.0"] === 1600);
const sync = L.synchroniseerPlekken(p, s2, { nieuwId });
const bez = sync.lijst.items.flatMap(i => i.bezetting || []);
test("cameraman: nieuw budget 2.550 (was 1.700)", bez.find(b => b.onderdeelId === "crew-camera").offerte.begroot === 2550 && bez.find(b => b.onderdeelId === "crew-camera").offerte.vorigBegroot === 1700);
test("geluidsman erbij", sync.toegevoegd === 1 && bez.some(b => b.onderdeelId === "crew-geluid" && b.offerte));
test("belichter (Ray) niet weggegooid maar gemarkeerd", bez.find(b => b.naam === "Ray").offerte.vervallen === true && sync.vervallen === 1);
test("edelfigurant ongewijzigd", bez.filter(b => b.onderdeelId === "edelfiguranten").length === 1);
samenvatting();
