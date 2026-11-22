// Zet de pdf.js-worker in public/ zodat PDF's (offertes, bonnetjes,
// facturen) ook zonder internet gelezen kunnen worden — voorheen kwam de
// worker van cdnjs. De versie staat in de bestandsnaam, zodat de service
// worker hem veilig "cache-first" kan bewaren.
const fs = require("fs");
const path = require("path");
const pkg = require("pdfjs-dist/package.json");
const bron = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const doelMap = path.join(__dirname, "..", "public", "pdfjs");
fs.mkdirSync(doelMap, { recursive: true });
for (const f of fs.readdirSync(doelMap)) if (/^pdf\.worker-.*\.mjs$/.test(f)) fs.unlinkSync(path.join(doelMap, f));
fs.copyFileSync(bron, path.join(doelMap, `pdf.worker-${pkg.version}.min.mjs`));
console.log(`pdf.js-worker ${pkg.version} → public/pdfjs/`);
