// Wordt door Claude bijgewerkt bij elke nieuwe zip-uitlevering — puur zodat
// je in de instellingen in één oogopslag kunt zien of een nieuwe deploy
// daadwerkelijk is doorgekomen, in plaats van te moeten gokken.
export const BUILD_INFO = {
  datum: "2026-08-31T10:20:00+02:00",
  omschrijving: "Budget: CSV-parsing vervangen door PapaParse (RFC4180-conform) i.p.v. een handgeschreven aanhalingsteken-lus — fixt 2 bewezen edge cases (een ontsnapt aanhalingsteken \"\" in een veld verdween voorheen stilletjes; een regeleinde midden in een veld brak de transactie in tweeën). MT940/CAMT.053 bleek bij Rabobank alleen voor zakelijke rekeningen beschikbaar, dus CSV blijft terecht de aanpak. Getest met 2 nieuwe tests, plus bevestigd dat alle bestaande tests exact hetzelfde resultaat blijven geven",
};
