// Wordt door Claude bijgewerkt bij elke nieuwe zip-uitlevering — puur zodat
// je in de instellingen in één oogopslag kunt zien of een nieuwe deploy
// daadwerkelijk is doorgekomen, in plaats van te moeten gokken.
export const BUILD_INFO = {
  datum: "2026-09-25T10:35:00+02:00",
  omschrijving: "Budget: bug gefixt waarbij overboekingen naar sparen/beleggen als gewone uitgave werden meegeteld. isVermoedelijkOverboeking (herkent 'Sparen'-categorie én naam-patronen als spaarrekening/Peaks/vermogensbeheer) bestond al, maar werd nooit toegepast in nettoExpensesFilter — de kernfunctie achter totalSpent, spaarquote, budgetten en categorieverdeling overal in de app. Hoe méér er gespaard werd, hoe lager de getoonde spaarquote uitviel: precies andersom dan bedoeld. Nu correct uitgesloten, met een nieuwe '💰 Gespaard'-kaart op het dashboard zodat dat bedrag zichtbaar blijft i.p.v. gewoon te verdwijnen. Getest met 6 nieuwe tests, inclusief het exacte scenario uit de melding (spaarquote 80% vs. 97% vóór/na de fix)",
};
