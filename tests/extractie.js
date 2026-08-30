const fs = require("fs");

// Haalt een los te draaien functie (of losse const/functie-groep) uit een
// echt broncodebestand van de app, op basis van brace-matching. Zo testen we
// altijd de daadwerkelijke, actuele logica — niet een gekopieerde variant die
// stilletjes uit de pas kan gaan lopen met wat er echt in de app staat.
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
    const eersteHaakje = inhoud.indexOf("(", startIdx);
    if (eersteHaakje === -1) throw new Error(`Geen parameterlijst gevonden voor functie in ${bestandspad}`);
    let haakjesDiepte = 0, naParams = -1;
    for (let i = eersteHaakje; i < inhoud.length; i++) {
      if (inhoud[i] === "(") haakjesDiepte++;
      else if (inhoud[i] === ")") { haakjesDiepte--; if (haakjesDiepte === 0) { naParams = i + 1; break; } }
    }
    if (naParams === -1) throw new Error(`Kon einde van parameterlijst niet vinden in ${bestandspad}`);
    const bodyStart = inhoud.indexOf("{", naParams);
    if (bodyStart === -1) throw new Error(`Geen functie-body gevonden in ${bestandspad}`);

    let diepte = 0, eindIdx = -1;
    for (let i = bodyStart; i < inhoud.length; i++) {
      if (inhoud[i] === "{") diepte++;
      else if (inhoud[i] === "}") { diepte--; if (diepte === 0) { eindIdx = i + 1; break; } }
    }
    if (eindIdx === -1) throw new Error(`Kon einde van functie-body niet vinden in ${bestandspad}`);
    return inhoud.slice(startIdx, eindIdx);
  }

  const eersteAccolade = inhoud.indexOf("{", startIdx);
  const eersteBlokhaak = inhoud.indexOf("[", startIdx);
  const eersteKommapunt = inhoud.indexOf(";", startIdx);

  // Welke opent het eerst: een blok ({...}), een array ([...]), of is het
  // een simpele eenregelige declaratie zonder blok/array (bv. `const X = "...";`)?
  const kandidaten = [
    eersteAccolade !== -1 ? { idx: eersteAccolade, open: "{", close: "}" } : null,
    eersteBlokhaak !== -1 ? { idx: eersteBlokhaak, open: "[", close: "]" } : null,
  ].filter(Boolean).sort((a, b) => a.idx - b.idx);
  const eersteOpener = kandidaten[0] || null;

  if (eersteKommapunt !== -1 && (!eersteOpener || eersteKommapunt < eersteOpener.idx)) {
    return inhoud.slice(startIdx, eersteKommapunt + 1);
  }

  if (!eersteOpener) throw new Error(`Geen openende accolade/blokhaak of kommapunt gevonden na patroon in ${bestandspad}`);

  let diepte = 0;
  let eindIdx = -1;
  for (let i = eersteOpener.idx; i < inhoud.length; i++) {
    if (inhoud[i] === eersteOpener.open) diepte++;
    else if (inhoud[i] === eersteOpener.close) {
      diepte--;
      if (diepte === 0) { eindIdx = i + 1; break; }
    }
  }
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
  const startIdx = inhoud.search(startPatroon);
  const stuk = inhoud.slice(startIdx, startIdx + 200);
  const match = stuk.match(/function\s+(\w+)/) || stuk.match(/const\s+(\w+)\s*=/);
  if (!match) throw new Error(`Kon functienaam niet bepalen bij patroon in ${bestandspad}`);
  return match[1];
}

module.exports = { extraheerBlok, laadFuncties };
