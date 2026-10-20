const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "pages", "onderhoud.js");
const { dagPlus, dagVerschil, fmtDatum, berekenSchema, berekenKritiekPad, berekenBetaling, ruimKostRegelOp } = laadFuncties(BESTAND, [
  /function dagPlus\(/,
  /function dagVerschil\(/,
  /function fmtDatum\(/,
  /function isWeekend\(/,
  /function naarWerkdag\(/,
  /function werkdagPlus\(/,
  /function werkdagMin\(/,
  /function berekenSchema\(/,
  /function berekenKritiekPad\(/,
  /function berekenBetaling\(/,
  /function ruimKostRegelOp\(/,
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

sectie("Kritiek pad — bottleneck-tak is kritiek, snellere parallelle tak heeft speling");
{
  // A (2d) -> B (5d, bottleneck) -> D (2d)
  //        -> C (1d, sneller)    ->
  const taken = [
    { id: "a", duurDagen: 2, afhankelijkheden: [] },
    { id: "b", duurDagen: 5, afhankelijkheden: ["a"] },
    { id: "c", duurDagen: 1, afhankelijkheden: ["a"] },
    { id: "d", duurDagen: 2, afhankelijkheden: ["b", "c"] },
  ];
  const schema = berekenSchema(taken, START, true);
  const speling = berekenKritiekPad(taken, schema);
  test("A (voedt beide takken) zit op het kritieke pad", speling.a === 0);
  test("B (de langzame/bepalende tak) zit op het kritieke pad", speling.b === 0);
  test("D (eindtaak) zit op het kritieke pad", speling.d === 0);
  test("C (de snellere, parallelle tak) heeft speling — is niet kritiek", speling.c > 0);
  test("C heeft precies het verschil in tak-duur als speling (4 dagen)", speling.c === 4);
}

sectie("Kritiek pad — één enkele taak is altijd kritiek");
{
  const taken = [{ id: "a", duurDagen: 5, afhankelijkheden: [] }];
  const schema = berekenSchema(taken, START, true);
  const speling = berekenKritiekPad(taken, schema);
  test("de enige taak in het project heeft geen speling", speling.a === 0);
}

sectie("Werkdagen — taak van 3 dagen die op vrijdag start, is pas woensdag klaar (weekend overgeslagen)");
{
  // 2026-07-31 is een vrijdag, 2026-08-05 is de daaropvolgende woensdag.
  const taken = [{ id: "a", duurDagen: 3, afhankelijkheden: [] }];
  const kalender = berekenSchema(taken, "2026-07-31", true, false);
  const werkdagen = berekenSchema(taken, "2026-07-31", true, true);
  test("kalenderdagen: vrijdag + 3 dagen = maandag (loopt door het weekend)", fmtDatum(kalender.a.eind) === "2026-08-03");
  test("werkdagen: vrijdag + 3 werkdagen = woensdag (weekend overgeslagen)", fmtDatum(werkdagen.a.eind) === "2026-08-05");
}

sectie("Werkdagen — start op een weekend schuift automatisch naar de eerstvolgende maandag");
{
  // 2026-08-01 is een zaterdag, 2026-08-03 is de eerstvolgende maandag.
  const taken = [{ id: "a", duurDagen: 2, afhankelijkheden: [] }];
  const werkdagen = berekenSchema(taken, "2026-08-01", true, true);
  test("start schuift van zaterdag naar maandag", fmtDatum(werkdagen.a.start) === "2026-08-03");
  test("eind is maandag + 2 werkdagen = woensdag", fmtDatum(werkdagen.a.eind) === "2026-08-05");
}

sectie("Werkdagen — cascade werkt ook correct door met werkdagen-modus aan");
{
  const taken = [
    { id: "a", duurDagen: 3, afhankelijkheden: [] },
    { id: "b", duurDagen: 2, afhankelijkheden: ["a"] },
  ];
  const werkdagen = berekenSchema(taken, "2026-07-31", true, true); // vrijdag start
  test("b start exact waar a (in werkdagen) eindigt", fmtDatum(werkdagen.b.start) === fmtDatum(werkdagen.a.eind));
}

sectie("Verbouwingskosten — deelbetalingen");
{
  const a = berekenBetaling(1000, false, [{ bedrag: 300 }, { bedrag: 200.5 }]);
  test("twee deelbetalingen tellen op, rest staat open", a.betaald === 500.5 && a.open === 499.5 && a.status === "deels");
  test("geen betalingen = open", berekenBetaling(1000, false, []).status === "open" && berekenBetaling(1000, false, undefined).open === 1000);
  test("deelbetalingen die samen het bedrag halen = betaald", berekenBetaling(1000, false, [{ bedrag: 600 }, { bedrag: 400 }]).status === "betaald");
  const v = berekenBetaling(1000, true, [{ bedrag: 100 }]);
  test("volledig-betaald vinkje telt voor het hele bedrag (oude data blijft werken)", v.betaald === 1000 && v.open === 0 && v.status === "betaald");
  test("te veel betaald wordt gemeld, open blijft 0", berekenBetaling(100, false, [{ bedrag: 130 }]).teveel === 30 && berekenBetaling(100, false, [{ bedrag: 130 }]).open === 0);
  test("negatieve of rommelige bedragen worden genegeerd", berekenBetaling(100, false, [{ bedrag: -50 }, { bedrag: "abc" }, null]).betaald === 0);
  test("komma-afrondingsfout (0,1+0,2) blijft netjes", berekenBetaling(0.3, false, [{ bedrag: 0.1 }, { bedrag: 0.2 }]).open === 0);
  test("bedrag 0 is nooit 'betaald' zonder vinkje", berekenBetaling(0, false, []).status === "open");
}

sectie("Verbouwingskosten — verwijderen ruimt alles van de regel op");
{
  const p = { id: "p", betaalStatus: { a: true, b: true }, deelbetalingen: { a: [{ bedrag: 5 }], b: [{ bedrag: 7 }] }, facturen: { a: true, b: true }, facturenFotos: { a: "foto-a", b: "foto-b" }, naam: "Keuken" };
  const r = ruimKostRegelOp(p, "a");
  test("betaalstatus, deelbetalingen en factuur van de regel verdwijnen", !("a" in r.betaalStatus) && !("a" in r.deelbetalingen) && !("a" in r.facturen));
  test("factuurfoto krijgt null zodat de server hem ook wist", r.facturenFotos.a === null);
  test("andere regels blijven onaangeroerd", r.betaalStatus.b === true && r.deelbetalingen.b[0].bedrag === 7 && r.facturenFotos.b === "foto-b" && r.naam === "Keuken");
  const leeg = ruimKostRegelOp({ id: "x" }, "a");
  test("project zonder deze velden crasht niet", leeg.betaalStatus && Object.keys(leeg.deelbetalingen).length === 0);
}
