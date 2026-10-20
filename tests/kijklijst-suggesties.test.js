const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test, samenvatting } = require("./testhulp");

const { bouwSuggestiePrompt, parseSuggesties } = laadFuncties(path.join(__dirname, "..", "pages", "kijklijst.js"), [
  /const isAnder = /,
  /function weergaveBeoordeling\(/,
  /const SUGGESTIE_SOORTEN = /,
  /function bouwSuggestiePrompt\(/,
  /function parseSuggesties\(/,
]);

const items = [
  { titel: "Dark", type: "serie", jaar: "2017", genre: "Thriller, Sci-Fi", regisseur: "Baran bo Odar", status: "gekeken", beoordelingen: { Pepijn: 5, Tessa: 4 }, review: "Geweldig" },
  { titel: "Slechte Film", type: "film", genre: "Komedie", status: "gekeken", beoordelingen: { Pepijn: 1, Tessa: 2 } },
  { titel: "Severance", type: "serie", genre: "Thriller", status: "wil_kijken", beoordelingen: { Pepijn: 0, Tessa: 0 } },
  { titel: "Zomergasten", type: "podcast", genre: "Cultuur", maker: "VPRO", status: "gekeken", beoordelingen: { Pepijn: 5, Tessa: 0 } },
  { titel: "De Avonden", type: "boek", genre: "Roman", maker: "Reve", status: "wil_kijken" },
];

sectie("Suggesties — prompt opbouwen");
const f = bouwSuggestiePrompt(items, "filmserie");
test("films & series: favorieten, tegenvallers en wensen staan erin", f.prompt.includes("Dark") && f.prompt.includes("Slechte Film") && f.prompt.includes("Severance"));
test("mening en beoordeling per persoon worden meegegeven", f.prompt.includes("Pepijn 5/5") && f.prompt.includes("Geweldig"));
test("podcast en boek lekken niet in de film-prompt", !f.prompt.includes("Zomergasten") && !f.prompt.includes("De Avonden"));
test("bestaande titels staan in de uitsluitlijst", f.prompt.includes("Stel deze niet voor") && f.prompt.includes("Slechte Film"));
test("vaakst voorkomende genre wordt genoemd", f.prompt.includes("Thriller"));
test("podcasts gebruiken maker en Apple Podcasts", bouwSuggestiePrompt(items, "podcast").prompt.includes("maker: VPRO") && bouwSuggestiePrompt(items, "podcast").prompt.includes("Apple Podcasts"));
test("Voor Jimmy voegt een kindveilig-eis toe", bouwSuggestiePrompt(items, "filmserie", { voorJimmy: true }).prompt.includes("kind van 4 jaar") && !f.prompt.includes("kind van 4 jaar"));
const weinig = bouwSuggestiePrompt(items, "boek");
test("te weinig gegevens geeft een uitleg en geen prompt", weinig.prompt === null && weinig.fout.includes("boeken"));
test("lege lijst crasht niet", bouwSuggestiePrompt([], "luisterboek").prompt === null && bouwSuggestiePrompt(undefined, "podcast").prompt === null);

sectie("Suggesties — antwoord verwerken");
const antwoord = 'Hier: ```json\n[{"titel":"Dark","type":"serie"},{"titel":"Nieuwe Serie","jaar":2021,"type":"serie","reden":"Past erbij"},{"titel":"nieuwe serie","type":"film"},{"titel":"","type":"film"},null]\n``` klaar';
const r = parseSuggesties(antwoord, ["Dark"], "filmserie");
test("al bekende titels, dubbelen en lege regels verdwijnen", r.length === 1 && r[0].titel === "Nieuwe Serie");
test("jaar wordt tekst en reden blijft behouden", r[0].jaar === "2021" && r[0].reden === "Past erbij");
test("onbekend type valt terug op het soort", parseSuggesties('[{"titel":"X","type":"gek"}]', [], "podcast")[0].type === "podcast");
test("tekst om de lijst heen wordt genegeerd", parseSuggesties('Tuurlijk! [{"titel":"A"}] veel plezier', [], "boek")[0].type === "boek");
test("geen lijst geeft een fout", (() => { try { parseSuggesties("sorry", []); return false; } catch { return true; } })());

samenvatting();
