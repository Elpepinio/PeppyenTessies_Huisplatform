const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");
const { laadFuncties } = require("./extractie");
const { sectie, test } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "pages", "budget.js");

// parseRabobankCSV roept uid() aan, die zelf niet meegeëxtraheerd wordt (puur
// een willekeurige-ID-generator, niet relevant om te testen) — die geven we
// als losse mock mee. tokenizeCsv gebruikt PapaParse, dus die geven we ook
// mee als context (net als eerder SunCalc voor de Weer-tool).
const mockUid = () => Math.random().toString(36).slice(2);

const { parseRabobankCSV, guessCategory } = laadFuncties(
  BESTAND,
  [/^function tokenizeCsv\(/m, /^function parseRabobankCSV\(/m, /^function guessCategory\(/m],
  { uid: mockUid, Papa }
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

// PapaParse verving eerder een handgeschreven aanhalingsteken-lus die twee
// bekende zwakke plekken had: een ontsnapt aanhalingsteken ("") midden in
// een veld werd stilletjes weggelaten, en een veld met een regeleinde erin
// brak de rij verkeerd op. Deze twee tests bewijzen dat dat nu klopt.
sectie("CSV-import — PapaParse lost bekende edge cases van de oude parser op");
{
  const header = '"IBAN/BBAN","Munt","BIC","Volgnr","Datum","Rentedatum","Bedrag","Saldo na trn","Tegenrekening IBAN/BBAN","Naam tegenpartij","Naam uiteindelijke partij","Naam initiërende partij","BIC tegenpartij","Code","Batch ID","Transactiereferentie","Machtigingskenmerk","Incassant ID","Betalingskenmerk","Omschrijving-1","Omschrijving-2","Omschrijving-3","Redencode","Oorspr bedrag","Oorspr munt","Koers"\n';

  const regelMetOntsnaptQuote = '"NL01RABO0123456789","EUR","RABONL2U","1","2026-06-01","2026-06-01","-45,50","1000,00","NL99ABNA0111111111","Albert Heijn ""Bonus"" kaart","","","ABNANL2A","","","","","","","Betaalpas afschrijving","","","","","",""\n';
  const rijenMetQuote = parseRabobankCSV(header + regelMetOntsnaptQuote, {}, {}, {});
  test("een ontsnapt aanhalingsteken (\"\") in de naam blijft behouden i.p.v. stilletjes te verdwijnen",
    rijenMetQuote[0]?.name.includes('"Bonus"'));

  const regelMetRegeleinde = '"NL01RABO0123456789","EUR","RABONL2U","1","2026-06-01","2026-06-01","-950,00","1000,00","NL99ABNA0111111111","Verhuurder\nAppartementen BV","","","ABNANL2A","","","","","","","Huur juni","","","","","",""\n';
  const rijenMetRegeleinde = parseRabobankCSV(header + regelMetRegeleinde, {}, {}, {});
  test("een regeleinde midden in een veld breekt de transactie niet langer in tweeën",
    rijenMetRegeleinde.length === 1 && rijenMetRegeleinde[0]?.name.includes("Appartementen BV"));
}
