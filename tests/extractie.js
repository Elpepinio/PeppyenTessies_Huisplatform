const fs = require("fs");

// Haalt een los te draaien functie (of losse const/functie-groep) uit een
// echt broncodebestand van de app, op basis van brace-matching. Zo testen we
// altijd de daadwerkelijke, actuele logica — niet een gekopieerde variant die
// stilletjes uit de pas kan gaan lopen met wat er echt in de app staat.
function extraheerBlok(bestandspad, startPatroon) {
  const inhoud = fs.readFileSync(bestandspad, "utf-8");
  const startIdx = inhoud.search(startPatroon);
  if (startIdx === -1) throw new Error(`Patroon niet gevonden in ${bestandspad}: ${startPatroon}`);

  const eersteAccolade = inhoud.indexOf("{", startIdx);
  const eersteKommapunt = inhoud.indexOf(";", startIdx);

  // Simpele losse const-declaratie zonder blok (bv. `const X = "...";`) —
  // als het kommapunt vóór de eerstvolgende accolade komt (of er is
  // helemaal geen accolade), is dit zo'n eenregelige declaratie.
  if (eersteKommapunt !== -1 && (eersteAccolade === -1 || eersteKommapunt < eersteAccolade)) {
    return inhoud.slice(startIdx, eersteKommapunt + 1);
  }

  if (eersteAccolade === -1) throw new Error(`Geen openende accolade of kommapunt gevonden na patroon in ${bestandspad}`);

  let diepte = 0;
  let eindIdx = -1;
  for (let i = eersteAccolade; i < inhoud.length; i++) {
    if (inhoud[i] === "{") diepte++;
    else if (inhoud[i] === "}") {
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
