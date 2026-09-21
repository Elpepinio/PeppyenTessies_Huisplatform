// Wordt door Claude bijgewerkt bij elke nieuwe zip-uitlevering — puur zodat
// je in de instellingen in één oogopslag kunt zien of een nieuwe deploy
// daadwerkelijk is doorgekomen, in plaats van te moeten gokken.
export const BUILD_INFO = {
  datum: "2026-09-21T17:25:00+02:00",
  omschrijving: "Schetsboek: bug gefixt waarbij een lange tekst-schets (bv. een compleet kinderboekverhaal) buiten zijn rasterkaart kon overlopen — de eerdere aanpak (-webkit-line-clamp) bleek onvoldoende betrouwbaar. Tekst wordt nu in JavaScript zelf ingekort tot 90 tekens vóór het naar het scherm gaat, wat per definitie nooit kan overlopen, ongeacht CSS-ondersteuning. Getest met 5 nieuwe tests, inclusief de exacte tekst uit de melding",
};
