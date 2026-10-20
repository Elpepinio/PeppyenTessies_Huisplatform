const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test, samenvatting } = require("./testhulp");

const { podcastIdUitLink, mapPodcast } = laadFuncties(path.join(__dirname, "..", "pages", "api", "podcast-zoek.js"), [
  /function podcastIdUitLink\(/,
  /function mapPodcast\(/,
]);

sectie("Podcasts — Apple Podcasts-link");
test("id uit een gewone podcastlink", podcastIdUitLink("https://podcasts.apple.com/nl/podcast/de-podcast/id1234567890") === "1234567890");
test("id uit een afleveringslink met ?i=", podcastIdUitLink("https://podcasts.apple.com/nl/podcast/naam/id1234567890?i=1000123") === "1234567890");
test("andere sites worden geweigerd", podcastIdUitLink("https://evil.example/podcast/id1234567890") === null);
test("lege of rare invoer geeft null", podcastIdUitLink("") === null && podcastIdUitLink(undefined) === null && podcastIdUitLink("https://podcasts.apple.com/nl/") === null);

sectie("Podcasts — zoekresultaat omzetten");
const r = mapPodcast({ collectionId: 42, collectionName: "Een Podcast", artistName: "Maker", primaryGenreName: "Nieuws", artworkUrl600: "https://x/600.jpg", artworkUrl100: "https://x/100.jpg", collectionViewUrl: "https://podcasts.apple.com/nl/podcast/een/id42?uo=4", trackCount: 120 });
test("velden worden netjes overgenomen", r.titel === "Een Podcast" && r.maker === "Maker" && r.genre === "Nieuws" && r.id === "42" && r.aantalAfleveringen === 120);
test("link wordt zonder tracking-parameters bewaard", r.podcastUrl === "https://podcasts.apple.com/nl/podcast/een/id42");
test("grote cover heeft voorrang, kleine is terugval", r.poster === "https://x/600.jpg" && mapPodcast({ collectionName: "A", artworkUrl100: "https://x/100.jpg" }).poster === "https://x/100.jpg");
test("resultaat zonder naam wordt genegeerd", mapPodcast({ artistName: "x" }) === null && mapPodcast(null) === null);

samenvatting();
