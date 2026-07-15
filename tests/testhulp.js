// Minimale test-helper, bewust zonder externe testafhankelijkheid (jest,
// mocha, etc.) — houdt de app dependency-vrij en de tests simpel leesbaar.
let totaal = 0;
let gefaald = 0;
let huidigeSectie = "";

function sectie(naam) {
  huidigeSectie = naam;
  console.log(`\n--- ${naam} ---`);
}

function test(naam, conditie) {
  totaal++;
  if (conditie) {
    console.log(`  ✅ ${naam}`);
  } else {
    gefaald++;
    console.log(`  ❌ FOUT: ${naam}`);
  }
}

function samenvatting() {
  console.log(`\n${"=".repeat(50)}`);
  if (gefaald === 0) {
    console.log(`🎉 Alle ${totaal} tests geslaagd`);
  } else {
    console.log(`⚠️  ${gefaald} van ${totaal} tests gefaald`);
  }
  console.log("=".repeat(50));
  return gefaald === 0;
}

module.exports = { sectie, test, samenvatting };
