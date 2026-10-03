const fs = require("fs");

// Loopt teken voor teken door JS-brontekst en roept `callback(i, c)` alleen
// aan voor tekens die ECHTE CODE zijn — niet voor tekens die binnen een
// '...'/"..."/`...`-string zitten. Een template literal's eigen tekst
// (bv. de €-tekst in `€ ${bedrag}`) telt dus niet mee, maar de code BINNEN
// een ${...}-interpolatie wel — anders zou een accolade die toevallig in
// zo'n interpolatie staat (of, zoals hier, de accolades van ${...} zelf)
// de haakjes-telling in de war sturen en de declaratie te vroeg laten
// eindigen. Zonder dit zou bv. `const euro = n => \`€ ${Math.round(n)}\`;`
// al stoppen bij de sluitende "}" van ${...}, vóór de echte afsluitende
// backtick en puntkomma.
// Telt het aantal backslashes direct vóór positie i — een even aantal
// (incl. 0) betekent dat die backslashes zichzelf in paren opheffen, dus
// het teken op i zelf is NIET escaped; een oneven aantal betekent dat het
// wél escaped is. Robuuster dan alleen het ene voorgaande teken bekijken,
// wat ten onrechte "escaped" zou concluderen bij bv. een string die zelf
// op een letterlijke backslash eindigt (`"pad\\\\"` → twee backslashes,
// dus de sluitende aanhalingsteken is NIET escaped).
function aantalVoorgaandeBackslashes(inhoud, i) {
  let n = 0;
  while (i - 1 - n >= 0 && inhoud[i - 1 - n] === "\\") n++;
  return n;
}
function isEscaped(inhoud, i) {
  return aantalVoorgaandeBackslashes(inhoud, i) % 2 === 1;
}

function scanCode(inhoud, vanaf, callback) {
  let inSingle = false, inDouble = false, inTemplate = false, templateExprDiepte = 0;
  let inLineComment = false, inBlockComment = false;
  for (let i = vanaf; i < inhoud.length; i++) {
    const c = inhoud[i];
    if (inLineComment) { if (c === "\n") inLineComment = false; continue; }
    if (inBlockComment) { if (c === "*" && inhoud[i + 1] === "/") { inBlockComment = false; i++; } continue; }
    if (inSingle) { if (c === "'" && !isEscaped(inhoud, i)) inSingle = false; continue; }
    if (inDouble) { if (c === '"' && !isEscaped(inhoud, i)) inDouble = false; continue; }
    if (inTemplate && templateExprDiepte === 0) {
      if (c === "`" && !isEscaped(inhoud, i)) { inTemplate = false; callback(i, c); }
      else if (c === "$" && inhoud[i + 1] === "{") { templateExprDiepte = 1; i++; }
      continue; // platte template-tekst is geen code
    }
    if (inTemplate && templateExprDiepte > 0) {
      if (c === "{") templateExprDiepte++;
      else if (c === "}") { templateExprDiepte--; if (templateExprDiepte === 0) continue; }
      callback(i, c);
      continue;
    }
    // Comments vóór strings checken: een Nederlandse comment als
    // "// zzp'er" of "// 'bewaren'" staat vol apostrofs die anders ten
    // onrechte als stringstart worden gezien.
    if (c === "/" && inhoud[i + 1] === "/") { inLineComment = true; i++; continue; }
    if (c === "/" && inhoud[i + 1] === "*") { inBlockComment = true; i++; continue; }
    if (c === "'") { inSingle = true; continue; }
    if (c === '"') { inDouble = true; continue; }
    if (c === "`") { inTemplate = true; continue; }
    callback(i, c);
  }
}

// Haalt een los te draaien functie (of losse const/functie-groep) uit een
// echt broncodebestand van de app, op basis van brace-matching. Zo testen we
// altijd de daadwerkelijke, actuele logica — niet een gekopieerde variant die
// stilletjes uit de pas kan gaan lopen met wat er echt in de app staat.
// Index van het eerste ECHTE-CODE-teken uit `tekens` (een string met één of
// meer te zoeken tekens) vanaf `vanaf`, of -1 als geen ervan in echte code
// voorkomt. Tekens binnen een string/template literal tellen niet mee.
function eersteCodeTeken(inhoud, vanaf, tekens) {
  let gevonden = -1;
  scanCode(inhoud, vanaf, (i, c) => {
    if (gevonden === -1 && tekens.includes(c)) gevonden = i;
  });
  return gevonden;
}

// Vanaf de positie van een openend `open`-teken: de index net ná het
// bijbehorende, in diepte gebalanceerde `close`-teken — met dezelfde
// stringbewuste telling, dus een accolade/haakje binnen een string of
// template literal verstoort de telling niet.
function vindBalans(inhoud, openIdx, open, close) {
  let diepte = 0, eindIdx = -1;
  scanCode(inhoud, openIdx, (i, c) => {
    if (eindIdx !== -1) return;
    if (c === open) diepte++;
    else if (c === close) { diepte--; if (diepte === 0) eindIdx = i + 1; }
  });
  return eindIdx;
}

function extraheerBlok(bestandspad, startPatroon) {
  const inhoud = fs.readFileSync(bestandspad, "utf-8");
  const startIdx = inhoud.search(startPatroon);
  if (startIdx === -1) throw new Error(`Patroon niet gevonden in ${bestandspad}: ${startPatroon}`);

  const isFunctieDeclaratie = /function\s/.test(inhoud.slice(startIdx, startIdx + 40));

  if (isFunctieDeclaratie) {
    // Parameterlijsten kunnen zelf haakjes/accolades bevatten die niks met
    // de functie-body te maken hebben — een array-standaardwaarde (bv.
    // `vensters = [[1,2]]`) of gedestructureerde parameters (bv.
    // `function f({ a, b })`). Daarom: eerst de ronde haakjes van de
    // parameterlijst volledig doorlopen op haakjes-diepte, en pas ná die
    // sluitende ")" zoeken naar de accolade die de echte functie-body opent.
    const eersteHaakje = eersteCodeTeken(inhoud, startIdx, "(");
    if (eersteHaakje === -1) throw new Error(`Geen parameterlijst gevonden voor functie in ${bestandspad}`);
    const naParams = vindBalans(inhoud, eersteHaakje, "(", ")");
    if (naParams === -1) throw new Error(`Kon einde van parameterlijst niet vinden in ${bestandspad}`);
    const bodyStart = eersteCodeTeken(inhoud, naParams, "{");
    if (bodyStart === -1) throw new Error(`Geen functie-body gevonden in ${bestandspad}`);

    const eindIdx = vindBalans(inhoud, bodyStart, "{", "}");
    if (eindIdx === -1) throw new Error(`Kon einde van functie-body niet vinden in ${bestandspad}`);
    return inhoud.slice(startIdx, eindIdx);
  }

  const eersteAccolade = eersteCodeTeken(inhoud, startIdx, "{");
  const eersteBlokhaak = eersteCodeTeken(inhoud, startIdx, "[");
  const eersteKommapunt = eersteCodeTeken(inhoud, startIdx, ";");

  // Welke opent het eerst: een blok ({...}), een array ([...]), of is het
  // een simpele eenregelige declaratie zonder blok/array (bv. `const X = "...";`,
  // of `const euro = n => \`€ ${bedrag}\`;` — de accolades van ${...} horen
  // bij de template literal, niet bij een blok, en worden door scanCode dus
  // ook niet als "eerste accolade" aangemerkt)?
  const kandidaten = [
    eersteAccolade !== -1 ? { idx: eersteAccolade, open: "{", close: "}" } : null,
    eersteBlokhaak !== -1 ? { idx: eersteBlokhaak, open: "[", close: "]" } : null,
  ].filter(Boolean).sort((a, b) => a.idx - b.idx);
  const eersteOpener = kandidaten[0] || null;

  if (eersteKommapunt !== -1 && (!eersteOpener || eersteKommapunt < eersteOpener.idx)) {
    return inhoud.slice(startIdx, eersteKommapunt + 1);
  }

  if (!eersteOpener) throw new Error(`Geen openende accolade/blokhaak of kommapunt gevonden na patroon in ${bestandspad}`);

  const eindIdx = vindBalans(inhoud, eersteOpener.idx, eersteOpener.open, eersteOpener.close);
  if (eindIdx === -1) throw new Error(`Kon einde van blok niet vinden in ${bestandspad}`);
  return inhoud.slice(startIdx, eindIdx);
}

// Evalueert één of meerdere geëxtraheerde blokken samen in een gedeelde
// scope en geeft de resulterende variabelen/functies terug. `context` kan
// gebruikt worden om functies die de geëxtraheerde code aanroept maar zelf
// niet bevat (zoals een ID-generator) van buitenaf mee te geven.
function laadFuncties(bestandspad, patronen, context = {}) {
  const blokken = patronen.map(p => extraheerBlok(bestandspad, p)).join("\n\n");
  const module_ = { exports: {} };
  const contextNamen = Object.keys(context);
  const wrapper = new Function("module", "exports", "require", ...contextNamen, `
    ${blokken}
    module.exports = { ${patronen.map(p => extraheerFunctieNaam(bestandspad, p)).join(", ")} };
  `);
  wrapper(module_, module_.exports, require, ...contextNamen.map(n => context[n]));
  return module_.exports;
}

function extraheerFunctieNaam(bestandspad, startPatroon) {
  const inhoud = fs.readFileSync(bestandspad, "utf-8");
  // De naam halen we uitsluitend uit wat het patroon ZELF matcht — elk
  // patroon in dit project is van de vorm `/const NAAM = /` of
  // `/function naam\(/`, dus de naam staat altijd al in de match. Eerder
  // werd hiervoor een vast venster van 200 tekens ná de match doorzocht;
  // bij een korte, eenregelige declaratie (bv. een array die snel sluit)
  // kon dat venster doorlopen tot in de ERNA volgende declaratie, en dan
  // per ongeluk DIE naam opleveren in plaats van de juiste.
  const match = inhoud.match(startPatroon);
  if (!match) throw new Error(`Patroon niet gevonden in ${bestandspad}: ${startPatroon}`);
  // Geen "=" vereisen na "const NAAM" — sommige patronen in dit project
  // stoppen bewust direct na de naam (bv. `/^const X/m`) zonder het "="
  // zelf mee te matchen.
  const naamMatch = match[0].match(/function\s+(\w+)/) || match[0].match(/const\s+(\w+)/);
  if (!naamMatch) throw new Error(`Kon functienaam niet bepalen bij patroon in ${bestandspad}`);
  return naamMatch[1];
}

module.exports = { extraheerBlok, laadFuncties };
