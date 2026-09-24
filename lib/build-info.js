// Wordt door Claude bijgewerkt bij elke nieuwe zip-uitlevering — puur zodat
// je in de instellingen in één oogopslag kunt zien of een nieuwe deploy
// daadwerkelijk is doorgekomen, in plaats van te moeten gokken.
export const BUILD_INFO = {
  datum: "2026-09-24T11:40:00+02:00",
  omschrijving: "Budget-tool volledig herzien op basis van patronen uit gevestigde open-source budget-apps (Firefly III, Actual Budget) — de bank-import/CSV-verwerking (parseRabobankCSV, categorieherkenning, alle bestaande rekeningen en historische data) is volledig ongewijzigd gebleven en getest. Dashboard + Inzichten + Meldingen (voorheen 3 losse tabbladen) samengevoegd tot één samenhangend 🏠 Dashboard, in vaste volgorde: maandelijkse kernkaart → 🚨 Uit de bocht (alle meldingen, niet alleen top-3) → 🎯 Budgetten (nu met 'op dit tempo eindig je op €X'-projectie, die een overschrijding al vroeg in de maand signaleert i.p.v. pas bij een volle balk) → 📉 Waar kunnen we besparen → categorieverdeling/stijgers/trend → rekeningen/spaardoelen. De diepgaande meerdere-maanden-analyses (heatmap, jaaroverzicht, reserve-tracking) verhuisd naar een gestroomlijnd 📊 Analyse-tabblad. Getest met 8 nieuwe tests voor de nieuwe tempo-projectie, plus bevestigd dat alle bestaande CSV-importtests exact hetzelfde blijven werken",
};
