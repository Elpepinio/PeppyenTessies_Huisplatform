const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test, samenvatting } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "pages", "api", "schetsboek-research.js");

const { verzamelBronnen, haalStructuurEruit } = laadFuncties(BESTAND, [
  /function verzamelBronnen\(contentBlokken\)/,
  /const STRUCTUUR_LABELS = /,
  /function haalStructuurEruit\(analyse\)/,
]);

sectie("Schetsboek AI-research — bronnen verzamelen uit web-search-citations");

const blokkenMetDubbeleBron = [
  { type: "text", text: "Op basis van de zoekresultaten, " },
  { type: "text", text: "Claude Shannon werd geboren op 30 april 1916.", citations: [
    { type: "web_search_result_location", url: "https://en.wikipedia.org/wiki/Claude_Shannon", title: "Claude Shannon - Wikipedia", cited_text: "..." },
  ]},
  { type: "text", text: "Nog een claim uit dezelfde bron.", citations: [
    { type: "web_search_result_location", url: "https://en.wikipedia.org/wiki/Claude_Shannon", title: "Claude Shannon - Wikipedia", cited_text: "..." },
  ]},
  { type: "server_tool_use", name: "web_search", input: { query: "claude shannon" } },
];
const bronnen1 = verzamelBronnen(blokkenMetDubbeleBron);
test("dezelfde URL twee keer geciteerd levert maar 1 bron op (gededupliceerd)", bronnen1.length === 1);
test("de bron bevat de juiste url en titel", bronnen1[0].url === "https://en.wikipedia.org/wiki/Claude_Shannon" && bronnen1[0].titel === "Claude Shannon - Wikipedia");

const blokkenMetTweeBronnen = [
  { type: "text", text: "A", citations: [{ url: "https://a.nl", title: "Site A" }] },
  { type: "text", text: "B", citations: [{ url: "https://b.nl", title: "Site B" }] },
];
test("twee verschillende URLs geven twee losse bronnen", verzamelBronnen(blokkenMetTweeBronnen).length === 2);

test("geen citations ergens geeft een lege lijst, geen crash", verzamelBronnen([{ type: "text", text: "geen bronnen hier" }]).length === 0);
test("lege/ontbrekende content crasht niet", verzamelBronnen([]).length === 0 && verzamelBronnen(undefined).length === 0);

const rZonderTitel = verzamelBronnen([{ type: "text", text: "x", citations: [{ url: "https://voorbeeld.nl" }] }]);
test("een citation zonder titel valt terug op de URL zelf", rZonderTitel[0].titel === "https://voorbeeld.nl");

sectie("Schetsboek AI-research — gestructureerde velden eruit halen (marktomvang/concurrentie/investering/vervolgstap)");
const rVolledig = haalStructuurEruit("## Bestaat dit al?\n\nJa hoor.\n\nKORT: Kansrijk maar verzadigd\nMARKTOMVANG: Gemiddeld - groeiende interesse\nCONCURRENTIE: 3\nINVESTERING: Laag\nVERVOLGSTAP: Testadvertentie plaatsen om vraag te peilen");
test("de analyse zonder structuur bevat geen labels meer", !/KORT:|MARKTOMVANG:|VERVOLGSTAP:/.test(rVolledig.analyseZonderStructuur));
test("kortVerdict wordt correct geëxtraheerd", rVolledig.kortVerdict === "Kansrijk maar verzadigd");
test("marktomvang wordt correct geëxtraheerd", rVolledig.marktomvang === "Gemiddeld - groeiende interesse");
test("concurrentie wordt correct geëxtraheerd", rVolledig.concurrentie === "3");
test("investering wordt correct geëxtraheerd", rVolledig.investering === "Laag");
test("vervolgstap (het belangrijkste veld, wordt een voorgesteld actiepunt) wordt correct geëxtraheerd",
  rVolledig.vervolgstap === "Testadvertentie plaatsen om vraag te peilen");

const rLeeg = haalStructuurEruit("Analyse zonder enige structuurregel.");
test("ontbrekende structuurregels geven een nette KORT-fallback, geen crash", rLeeg.kortVerdict === "Onderzocht — zie details");
test("ontbrekende velden worden null, niet undefined of een crash", rLeeg.marktomvang === null && rLeeg.vervolgstap === null);
test("de analyse blijft ongewijzigd als er geen structuurregels zijn", rLeeg.analyseZonderStructuur === "Analyse zonder enige structuurregel.");

const rAndereVolgorde = haalStructuurEruit("Tekst.\n\nVERVOLGSTAP: Doe X\nKORT: Test\nCONCURRENTIE: 2");
test("werkt ook als de velden in een andere volgorde staan dan gevraagd",
  rAndereVolgorde.vervolgstap === "Doe X" && rAndereVolgorde.kortVerdict === "Test" && rAndereVolgorde.concurrentie === "2");

samenvatting();
