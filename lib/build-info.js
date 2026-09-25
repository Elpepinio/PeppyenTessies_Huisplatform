// Wordt door Claude bijgewerkt bij elke nieuwe zip-uitlevering — puur zodat
// je in de instellingen in één oogopslag kunt zien of een nieuwe deploy
// daadwerkelijk is doorgekomen, in plaats van te moeten gokken.
export const BUILD_INFO = {
  datum: "2026-09-25T09:20:00+02:00",
  omschrijving: "Budget: waarschijnlijke oorzaak gevonden van 'geïmporteerde transacties verdwijnen weer' — saveBudgetData controleerde nooit of de server-opslag daadwerkelijk lukte (fetch() gooit alleen bij een netwerkfout, niet bij bv. een verlopen sessie). Bij zo'n stille mislukking bleef de import er lokaal even goed uitzien, tot de eerstvolgende achtergrond-sync de oude data weer terugzette. confirmCSV wacht nu op bevestigde opslag, toont een duidelijke foutmelding bij mislukking (met behoud van de reviewlijst om meteen opnieuw te proberen), en de import-vergrendeling is beveiligd met finally tegen vastlopen",
};
