const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "pages", "onderhoud.js");
const { dagPlus, dagVerschil, fmtDatum, berekenSchema } = laadFuncties(BESTAND, [
  /function dagPlus\(/,
  /function dagVerschil\(/,
  /function fmtDatum\(/,
  /function berekenSchema\(/,
]);

const START = "2026-08-01";

sectie("Verbouwplanning — fan-in (twee onafhankelijke taken -> één die op de langzaamste wacht)");
{
  const taken = [
    { id: "a", duurDagen: 3, afhankelijkheden: [] },
    { id: "b", duurDagen: 7, afhankelijkheden: [] },
    { id: "c", duurDagen: 2, afhankelijkheden: ["a", "b"] },
  ];
  const s = berekenSchema(taken, START, true);
  test("c start pas als de langzaamste (b) klaar is", fmtDatum(s.c.start) === fmtDatum(s.b.eind));
}

sectie("Verbouwplanning — fan-out (één taak -> meerdere die er allebei op wachten)");
{
  const taken = [
    { id: "sloop", duurDagen: 2, afhankelijkheden: [] },
    { id: "elektra", duurDagen: 5, afhankelijkheden: ["sloop"] },
    { id: "loodgieter", duurDagen: 4, afhankelijkheden: ["sloop"] },
  ];
  const s = berekenSchema(taken, START, true);
  test("elektra en loodgieter starten allebei tegelijk na sloop", fmtDatum(s.elektra.start) === fmtDatum(s.loodgieter.start));
}

sectie("Verbouwplanning — circulaire afhankelijkheid crasht niet");
{
  const taken = [
    { id: "a", duurDagen: 3, afhankelijkheden: ["b"] },
    { id: "b", duurDagen: 3, afhankelijkheden: ["a"] },
  ];
  let gelukt = false;
  try { berekenSchema(taken, START, true); gelukt = true; } catch {}
  test("berekening voltooit zonder crash", gelukt);
}

sectie("Verbouwplanning — cascade: vertraging aan het begin werkt door tot 5 niveaus verderop");
{
  const taken = [
    { id: "t1", duurDagen: 2, afhankelijkheden: [] },
    { id: "t2", duurDagen: 2, afhankelijkheden: ["t1"] },
    { id: "t3", duurDagen: 2, afhankelijkheden: ["t2"] },
    { id: "t4", duurDagen: 2, afhankelijkheden: ["t3"] },
    { id: "t5", duurDagen: 2, afhankelijkheden: ["t4"] },
  ];
  const basis = berekenSchema(taken, START, false);
  taken[0].werkelijkeStart = START;
  taken[0].werkelijkEind = "2026-08-10"; // gepland: 2 dagen, werkelijk: 9 dagen verstreken
  const actueel = berekenSchema(taken, START, true);
  const verwachteVertraging = dagVerschil(fmtDatum(actueel.t1.eind), fmtDatum(basis.t1.eind));
  const werkelijkeVertraging = dagVerschil(fmtDatum(actueel.t5.eind), fmtDatum(basis.t5.eind));
  test("de vertraging van taak 1 werkt exact door tot taak 5, vijf niveaus verderop", werkelijkeVertraging === verwachteVertraging);
}

sectie("Verbouwplanning — eerder klaar dan gepland geeft een voorsprong, geen vertraging");
{
  const taken = [
    { id: "a", duurDagen: 10, afhankelijkheden: [], werkelijkeStart: START, werkelijkEind: "2026-08-05" },
    { id: "b", duurDagen: 3, afhankelijkheden: ["a"] },
  ];
  const basis = berekenSchema(taken, START, false);
  const actueel = berekenSchema(taken, START, true);
  const vertraging = dagVerschil(fmtDatum(actueel.b.eind), fmtDatum(basis.b.eind));
  test("taak b schuift naar vóren (negatieve vertraging) als a eerder klaar was", vertraging < 0);
}

sectie("Verbouwplanning — randgevallen in duur crashen niet");
{
  const taken = [
    { id: "nul", duurDagen: 0, afhankelijkheden: [] },
    { id: "negatief", duurDagen: -5, afhankelijkheden: [] },
    { id: "tekst", duurDagen: "abc", afhankelijkheden: [] },
  ];
  const s = berekenSchema(taken, START, true);
  test("duur 0 wordt minimaal 1 dag", dagVerschil(fmtDatum(s.nul.eind), fmtDatum(s.nul.start)) >= 1);
  test("negatieve duur wordt minimaal 1 dag", dagVerschil(fmtDatum(s.negatief.eind), fmtDatum(s.negatief.start)) >= 1);
  test("tekst als duur crasht niet", dagVerschil(fmtDatum(s.tekst.eind), fmtDatum(s.tekst.start)) >= 1);
}

sectie("Verbouwplanning — verwijzing naar niet-bestaande taak crasht niet");
{
  const taken = [{ id: "a", duurDagen: 5, afhankelijkheden: ["bestaat-niet"] }];
  let gelukt = false;
  try { berekenSchema(taken, START, true); gelukt = true; } catch {}
  test("crasht niet bij verwijzing naar verwijderde/niet-bestaande taak", gelukt);
}
