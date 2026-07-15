const fs = require("fs");
const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "pages", "budget.js");

// parseRabobankCSV roept uid() aan, die zelf niet meegeëxtraheerd wordt (puur
// een willekeurige-ID-generator, niet relevant om te testen) — die geven we
// als losse mock mee.
const mockUid = () => Math.random().toString(36).slice(2);

const { parseRabobankCSV, guessCategory } = laadFuncties(
  BESTAND,
  [/^function parseRabobankCSV\(/m, /^function guessCategory\(/m],
  { uid: mockUid }
);

sectie("CSV-import — Nederlandstalig Rabobank-formaat");
{
  const tekst = fs.readFileSync(path.join(__dirname, "voorbeelddata", "rabobank-voorbeeld-nl.csv"), "utf-8");
  const rijen = parseRabobankCSV(tekst, {}, {}, {});
  test("beide voorbeeldtransacties worden gevonden", rijen.length === 2);
  test("naam wordt correct gelezen (niet de valutakolom)", rijen[0].name.includes("Albert Heijn"));
  test("bedrag wordt correct en positief geparsed", rijen[0].amount === 45.50);
  test("maand wordt correct afgeleid uit een ISO-datum", rijen[0].month === "2026-06");
}

sectie("CSV-import — Engelstalig Rabobank 'CSV_A'-formaat (zelfde data, andere kolomnamen)");
{
  const tekst = fs.readFileSync(path.join(__dirname, "voorbeelddata", "rabobank-voorbeeld-en.csv"), "utf-8");
  const rijen = parseRabobankCSV(tekst, {}, {}, {});
  test("beide voorbeeldtransacties worden gevonden", rijen.length === 2);
  test("naam wordt correct gelezen ondanks Engelse kolomnamen", rijen[0].name.includes("Albert Heijn"));
  test("naam bevat NIET de valutacode (de oorspronkelijke bug)", !rijen[0].name.toLowerCase().startsWith("eur"));
  test("bedrag wordt correct geparsed", rijen[0].amount === 45.50);
}

sectie("CSV-import — bekende-rekeningnummer-koppeling wint van tekstherkenning");
{
  const tekst = fs.readFileSync(path.join(__dirname, "voorbeelddata", "rabobank-voorbeeld-nl.csv"), "utf-8");
  const bekendeIbans = { "NL38RABO0353865362": "Gezamenlijke rekening" };
  const rijen = parseRabobankCSV(tekst, {}, {}, bekendeIbans);
  const inleg = rijen.find(r => r.name.includes("Inleg"));
  test("transactie naar de gezamenlijke rekening krijgt die categorie via IBAN-koppeling", inleg.category === "Gezamenlijke rekening");
}

sectie("CSV-import — categorie-sleutel houdt rekening met omschrijving, niet alleen naam");
{
  const tekst = fs.readFileSync(path.join(__dirname, "voorbeelddata", "rabobank-voorbeeld-nl.csv"), "utf-8");
  const rijen = parseRabobankCSV(tekst, {}, {}, {});
  const alleSleutelsVerschillend = new Set(rijen.map(r => r.categorieSleutel)).size === rijen.length;
  test("verschillende transacties van verschillende partijen krijgen verschillende categorie-sleutels", alleSleutelsVerschillend);
}

sectie("Categorieherkenning — bekende winkels/patronen");
{
  test("Albert Heijn → Boodschappen", guessCategory("Albert Heijn Amsterdam") === "Boodschappen");
  test("Netflix → Abonnementen", guessCategory("Netflix.com") === "Abonnementen");
  test("Unicef-donatie → Goede doelen", guessCategory("Unicef Nederland donatie") === "Goede doelen");
  test("Inleg naar gezamenlijk → Gezamenlijke rekening", guessCategory("Inleg Pepijn") === "Gezamenlijke rekening");
  test("Onbekende tekst → Overig (nooit crashen)", guessCategory("Volledig willekeurige tekst 123") === "Overig");
}
