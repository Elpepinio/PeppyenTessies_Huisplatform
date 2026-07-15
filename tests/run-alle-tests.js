const fs = require("fs");
const path = require("path");
const { samenvatting } = require("./testhulp");

const testDir = __dirname;
const testBestanden = fs.readdirSync(testDir).filter(f => f.endsWith(".test.js")).sort();

console.log(`🧪 ${testBestanden.length} testbestanden gevonden: ${testBestanden.join(", ")}`);

let crashte = false;
for (const bestand of testBestanden) {
  console.log(`\n${"#".repeat(50)}`);
  console.log(`# ${bestand}`);
  console.log("#".repeat(50));
  try {
    require(path.join(testDir, bestand));
  } catch (e) {
    crashte = true;
    console.log(`\n💥 Testbestand ${bestand} crashte volledig: ${e.message}`);
    console.log(e.stack);
  }
}

const geslaagd = samenvatting() && !crashte;
process.exit(geslaagd ? 0 : 1);
