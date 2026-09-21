const { laadFuncties } = require("./extractie.js");
const { sectie, test, samenvatting } = require("./testhulp.js");

sectie("Schetsboek — geëxtraheerd uit de echte broncode van schetsboek.js");

const { formatDuur, schetsTypeInfo, persoonKleur, formatDatumKort, schetsMatcht } = laadFuncties("../pages/schetsboek.js", [
  /const PERSONEN = /,
  /function persoonKleur\(naam\)/,
  /const SCHETS_TYPES = /,
  /function schetsTypeInfo\(id\)/,
  /function formatDatumKort\(datumStr\)/,
  /function formatDuur\(sec\)/,
  /function schetsMatcht\(schets, term\)/,
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

samenvatting();
