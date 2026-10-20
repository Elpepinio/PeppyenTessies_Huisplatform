const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test, samenvatting } = require("./testhulp");

const { veiligeUrl, mapBoek, mapOpenLibrary } = laadFuncties(path.join(__dirname, "..", "pages", "api", "boek-zoek.js"), [
  /function veiligeUrl\(/, /function mapBoek\(/, /function mapOpenLibrary\(/,
]);

sectie("Boeken — Google Books omzetten");
const b = mapBoek({ id: "abc", volumeInfo: { title: "De Avonden", subtitle: "Een winterverhaal", authors: ["Gerard Reve", "Ander"], publishedDate: "1947-05-01", categories: ["Fiction / Klassiekers"], imageLinks: { thumbnail: "http://books.google.com/x.jpg" }, infoLink: "http://books.google.com/info" } });
test("titel + ondertitel, auteurs samengevoegd", b.titel === "De Avonden: Een winterverhaal" && b.maker === "Gerard Reve, Ander");
test("jaar uit publicatiedatum, genre = eerste categorie", b.jaar === "1947" && b.genre === "Fiction");
test("http-covers/links worden https", b.poster.startsWith("https://") && b.link.startsWith("https://"));
test("boek zonder titel wordt genegeerd", mapBoek({ volumeInfo: {} }) === null && mapBoek(null) === null);
test("ontbrekende velden crashen niet", mapBoek({ volumeInfo: { title: "X" } }).maker === "" && mapBoek({ volumeInfo: { title: "X", publishedDate: "jaar onbekend" } }).jaar === "");

sectie("Boeken — Open Library terugval");
const o = mapOpenLibrary({ key: "/works/OL1W", title: "Boek", author_name: ["A", "B", "C", "D"], first_publish_year: 1999, cover_i: 77, subject: ["Romans"] });
test("auteurs max 3, cover-url en link opgebouwd", o.maker === "A, B, C" && o.poster === "https://covers.openlibrary.org/b/id/77-M.jpg" && o.link === "https://openlibrary.org/works/OL1W" && o.jaar === "1999");
test("zonder cover geen kapotte url", mapOpenLibrary({ title: "Z" }).poster === "" && mapOpenLibrary({}) === null);

samenvatting();
