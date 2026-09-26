const { laadFuncties } = require("./extractie.js");
const { sectie, test, samenvatting } = require("./testhulp.js");

sectie("Schetsboek — geëxtraheerd uit de echte broncode van schetsboek.js");

const { formatDuur, schetsTypeInfo, persoonKleur, formatDatumKort, schetsMatcht, kortTekstIn, inhoudVoorNotitie, bouwIdeeenSamenvatting, projectLaatstAangeraakt, isProjectStilgevallen, isResearchVerouderd, markdownNaarPlatteTekst } = laadFuncties("../pages/schetsboek.js", [
  /const PERSONEN = /,
  /function persoonKleur\(naam\)/,
  /const SCHETS_TYPES = /,
  /function schetsTypeInfo\(id\)/,
  /function formatDatumKort\(datumStr\)/,
  /function formatDuur\(sec\)/,
  /function inhoudVoorNotitie\(schets\)/,
  /function bouwIdeeenSamenvatting\(schetsenVanProject\)/,
  /function projectLaatstAangeraakt\(project, schetsenVanDitProject\)/,
  /function isProjectStilgevallen\(project, schetsenVanDitProject, nu = Date\.now\(\), drempelDagen = 45\)/,
  /function isResearchVerouderd\(laatsteResearch, nu = Date\.now\(\), drempelDagen = 90\)/,
  /function markdownNaarPlatteTekst\(analyse\)/,
  /function schetsMatcht\(schets, term\)/,
  /function kortTekstIn\(tekst, max = 90\)/,
]);

sectie("Duur-formattering (spraakberichten/video's)");
test("0 seconden geeft 0:00", formatDuur(0) === "0:00");
test("45 seconden geeft 0:45", formatDuur(45) === "0:45");
test("65 seconden geeft 1:05 (minuten, met voorloopnul bij de seconden)", formatDuur(65) === "1:05");
test("125 seconden geeft 2:05", formatDuur(125) === "2:05");
test("ontbrekende/undefined duur crasht niet, geeft 0:00", formatDuur(undefined) === "0:00");
test("een cijfer met decimalen wordt afgerond naar hele seconden", formatDuur(59.7) === "1:00");

sectie("Schets-type-herkenning");
test("bekend type 'tekening' geeft het juiste label en icoon", schetsTypeInfo("tekening").label === "Tekening" && schetsTypeInfo("tekening").icon === "✏️");
test("bekend type 'spraakbericht' wordt herkend", schetsTypeInfo("spraakbericht").label === "Spraakbericht");
test("een onbekend/leeg type crasht niet, valt terug op een bruikbare standaard", typeof schetsTypeInfo("iets-onbestaands").label === "string");

sectie("Persoon-koppeling");
test("Pepijn en Tessa krijgen elk een eigen, verschillende kleur", persoonKleur("Pepijn") !== persoonKleur("Tessa"));
test("een onbekende naam crasht niet", typeof persoonKleur("Onbekend") === "string");

sectie("Datumweergave");
test("een datum wordt kort en leesbaar weergegeven (geen crash, iets van tekst)", formatDatumKort("2026-09-15").length > 0);
test("een lege datum geeft een lege string, geen crash", formatDatumKort("") === "" && formatDatumKort(null) === "");

sectie("Zoeken — matcht op titel en tekst, ongevoelig voor hoofdletters");
test("een lege zoekterm matcht alles", schetsMatcht({ titel: "Draak", tekst: "" }, "") === true);
test("matcht op de titel", schetsMatcht({ titel: "Vliegende draak", tekst: "" }, "draak") === true);
test("matcht op de tekst-inhoud", schetsMatcht({ titel: "", tekst: "Er was eens een prinses" }, "prinses") === true);
test("ongevoelig voor hoofdletters", schetsMatcht({ titel: "DRAAK", tekst: "" }, "draak") === true);
test("geen match als de term nergens in voorkomt", schetsMatcht({ titel: "Draak", tekst: "vuur" }, "prinses") === false);
test("ontbrekende titel/tekst crasht niet", schetsMatcht({}, "iets") === false);

sectie("Tekst-schetsen inkorten — voorkomt dat lange tekst buiten een kaart loopt");
test("een lang kinderboekverhaal wordt ingekort tot maximaal 91 tekens (90 + '…')",
  kortTekstIn("Pagina 1 Krok ligt in zijn bad, met schuim op zijn neus. De nacht is stil en hij is helemaal alleen. Pagina 2 Alleen slapen vindt Krok eng.").length === 91);
test("korte tekst blijft volledig ongewijzigd", kortTekstIn("Kort ideetje") === "Kort ideetje");
test("lege of ontbrekende tekst crasht niet, geeft een lege string", kortTekstIn(undefined) === "" && kortTekstIn("") === "");
test("exact op de grens blijft ongewijzigd (geen onnodige '…')", kortTekstIn("a".repeat(90)).length === 90 && !kortTekstIn("a".repeat(90)).endsWith("…"));
test("net over de grens wordt wél ingekort, met '…' erachter", kortTekstIn("a".repeat(91)).endsWith("…"));

sectie("Bord — notitie-inhoud voor schetsen zonder duimnagel (tekst/spraakbericht)");
test("tekst-schets met titel toont titel + inhoud gescheiden door een lege regel",
  inhoudVoorNotitie({ type:"tekst", titel:"Verhaalidee", tekst:"Er was eens..." }) === "Verhaalidee\n\nEr was eens...");
test("tekst-schets zonder titel toont gewoon de inhoud", inhoudVoorNotitie({ type:"tekst", tekst:"Los ideetje" }) === "Los ideetje");
test("spraakbericht met titel en duur toont icoon + titel + duur",
  inhoudVoorNotitie({ type:"spraakbericht", titel:"Ideetje voor personage", duurSec:47 }) === "🎙️ Ideetje voor personage (0:47)");
test("spraakbericht zonder titel valt terug op het type-label",
  inhoudVoorNotitie({ type:"spraakbericht", duurSec:12 }) === "🎙️ Spraakbericht (0:12)");

sectie("AI-research/sparren — ideeën-samenvatting van een project");
const voorbeeldSchetsen = [
  { type:"tekst", titel:"Kernidee", tekst:"Abonnementsdienst voor speelgoed-verhuur." },
  { type:"tekst", tekst:"Doelgroep: gezinnen met kinderen 1-6 jaar" },
  { type:"tekening", titel:"Logo-schets" },
  { type:"foto" },
];
const samenvatting1 = bouwIdeeenSamenvatting(voorbeeldSchetsen);
test("tekst-schets met titel toont 'titel: inhoud'", samenvatting1.includes("Kernidee: Abonnementsdienst voor speelgoed-verhuur."));
test("tekst-schets zonder titel toont gewoon de inhoud", samenvatting1.includes("Doelgroep: gezinnen met kinderen 1-6 jaar"));
test("visuele schetsen komen via hun type+titel in de samenvatting, niet leeg", samenvatting1.includes("[Tekening] Logo-schets"));
test("een schets zonder titel crasht niet, krijgt een duidelijke placeholder", samenvatting1.includes("(zonder titel)"));
test("een leeg project geeft een lege (niet undefined/crashende) samenvatting", bouwIdeeenSamenvatting([]) === "");

sectie("Spraakbericht-transcript — doorzoekbaar en zichtbaar op het bord/in de AI-context");
test("schetsMatcht vindt een spraakbericht op basis van het transcript, niet alleen titel/tekst",
  schetsMatcht({ type:"spraakbericht", titel:"", tekst:"", transcript:"idee over speelgoedverhuur" }, "speelgoed"));
test("inhoudVoorNotitie toont het transcript tussen aanhalingstekens ná het icoon+duur-label bij een spraakbericht",
  inhoudVoorNotitie({ type:"spraakbericht", titel:"Ideetje", duurSec:12, transcript:"we moeten dit zeker uitwerken" }).includes('"we moeten dit zeker uitwerken"'));
test("inhoudVoorNotitie valt terug op het kale label als er geen transcript is (bv. Safari niet ondersteund, of niets verstaan)",
  inhoudVoorNotitie({ type:"spraakbericht", titel:"Ideetje", duurSec:12 }) === "🎙️ Ideetje (0:12)");
const samenvattingMetSpraak = bouwIdeeenSamenvatting([{ type:"spraakbericht", titel:"Kernidee", transcript:"speelgoed per abonnement verhuren" }]);
test("bouwIdeeenSamenvatting neemt het transcript van een spraakbericht mee (anders zou de AI dit idee missen)",
  samenvattingMetSpraak.includes("speelgoed per abonnement verhuren"));
test("een spraakbericht zonder transcript valt terug op het type+titel-label in de samenvatting",
  bouwIdeeenSamenvatting([{ type:"spraakbericht", titel:"Zonder transcript" }]).includes("[Spraakbericht] Zonder transcript"));

sectie("Projectoverzicht — stilgevallen-detectie");
const nu = Date.now(), dag = 24*60*60*1000;
test("een leeg, net aangemaakt project is nooit stilgevallen", !isProjectStilgevallen({ aangemaaktOp: nu }, [], nu));
test("60 dagen zonder nieuwe schets geldt als stilgevallen", isProjectStilgevallen({ aangemaaktOp: nu - 100*dag }, [{ toegevoegdOp: nu - 60*dag }], nu));
test("5 dagen geleden nog iets toegevoegd is NIET stilgevallen", !isProjectStilgevallen({ aangemaaktOp: nu - 100*dag }, [{ toegevoegdOp: nu - 5*dag }], nu));
test("exact op de drempel van 45 dagen geldt al als stilgevallen", isProjectStilgevallen({ aangemaaktOp: nu - 100*dag }, [{ toegevoegdOp: nu - 45*dag }], nu));
test("projectLaatstAangeraakt pakt het meest recente moment van project of schetsen",
  projectLaatstAangeraakt({ aangemaaktOp: nu - 100*dag }, [{ toegevoegdOp: nu - 60*dag }, { toegevoegdOp: nu - 5*dag }]) === nu - 5*dag);

sectie("AI-research — verouderd-signaal en PDF-tekstopschoning");
const nu2 = Date.now(), dag2 = 24*60*60*1000;
test("geen onderzoek is nooit verouderd (niets om verouderd te verklaren)", !isResearchVerouderd(null, nu2));
test("30 dagen oud onderzoek is nog niet verouderd", !isResearchVerouderd({ datum: nu2 - 30*dag2 }, nu2));
test("120 dagen oud onderzoek is verouderd", isResearchVerouderd({ datum: nu2 - 120*dag2 }, nu2));
test("exact op de drempel van 90 dagen geldt al als verouderd", isResearchVerouderd({ datum: nu2 - 90*dag2 }, nu2));

test("markdownNaarPlatteTekst haalt ##-koppen weg", markdownNaarPlatteTekst("## Bestaat dit al?\n\nTekst.") === "Bestaat dit al?\n\nTekst.");
test("markdownNaarPlatteTekst haalt vet-sterretjes weg maar behoudt de tekst",
  markdownNaarPlatteTekst("Er zijn al **concurrenten** actief.") === "Er zijn al concurrenten actief.");
test("meerdere vette stukken in dezelfde zin worden allebei opgeschoond",
  markdownNaarPlatteTekst("**Eerste** en **tweede** vet stuk.") === "Eerste en tweede vet stuk.");

samenvatting();
