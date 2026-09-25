// Wordt door Claude bijgewerkt bij elke nieuwe zip-uitlevering — puur zodat
// je in de instellingen in één oogopslag kunt zien of een nieuwe deploy
// daadwerkelijk is doorgekomen, in plaats van te moeten gokken.
export const BUILD_INFO = {
  datum: "2026-09-24T13:50:00+02:00",
  omschrijving: "Budget: de échte oorzaak gevonden waarom CSV uploaden leek te falen. Het bestand werd wel degelijk ingelezen (of gaf een foutmelding), maar dat overzicht verscheen alleen op het Bank-tabblad zelf — klikte je via de header-knop of 'Nu bijwerken' op het dashboard, dan schakelde de app niet automatisch daarheen, dus leek het alsof er niets gebeurde. handleCSV/handleCreditcardCSV schakelen nu meteen naar het Bank-tabblad zodra je een bestand kiest, ongeacht vanaf welk tabblad je de upload startte",
};
