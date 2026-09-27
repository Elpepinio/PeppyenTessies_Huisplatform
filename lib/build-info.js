// Wordt door Claude bijgewerkt bij elke nieuwe zip-uitlevering — puur zodat
// je in de instellingen in één oogopslag kunt zien of een nieuwe deploy
// daadwerkelijk is doorgekomen, in plaats van te moeten gokken.
export const BUILD_INFO = {
  datum: "2026-09-26T12:20:00+02:00",
  omschrijving: "Schetsboek: nieuw schetstype 🔷 Vectorschets, naast de bestaande pixel-Tekening. Hergebruikt tldraw (dezelfde vector-tekenengine als het Bord, al eerder in dit project geïntegreerd) i.p.v. een nieuwe library te zoeken — rechthoeken, ellipsen, pijlen, lijnen, tekst en vrij tekenen, allemaal los verplaatsbaar/verschaalbaar/verwijderbaar. Bij 'Klaar' wordt zowel een platte PNG geëxporteerd (voor de grid/duimnagel/PDF, via editor.toImage — opgezocht in de daadwerkelijk geïnstalleerde package i.p.v. aangenomen) als het volledige tldraw-document apart opgeslagen, zodat een vectorschets bij het heropenen weer met losse, bewerkbare vormen verschijnt i.p.v. als kale afbeelding. Nieuwe serveracties (vectorSnapshotOpslaan, GET ?vectorschets=) met bijbehorende opruiming bij het verwijderen van een schets of project. Getest met 3 nieuwe tests voor het nieuwe type",
};
