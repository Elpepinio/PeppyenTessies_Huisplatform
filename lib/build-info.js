// Wordt door Claude bijgewerkt bij elke nieuwe zip-uitlevering — puur zodat
// je in de instellingen in één oogopslag kunt zien of een nieuwe deploy
// daadwerkelijk is doorgekomen, in plaats van te moeten gokken.
export const BUILD_INFO = {
  datum: "2026-09-26T21:40:00+02:00",
  omschrijving: "Opslag in Financieel overzicht en Abonnementen grondig nagelopen op verzoek. Geverifieerd via directe simulatie (geen aanname): een realistische reeks bewerkingen over meerdere tabbladen/items heen laat zien dat niets overschreven of kwijtgeraakt wordt, en dat alle datatypes (strings, booleans, null, decimalen) correct door de JSON-opslag heen komen. Twee eerlijke bevindingen gefixt: beide tools faalden tot nu toe STIL bij een mislukte opslag (bv. een haperende verbinding) — je zag dan niets op het scherm, terwijl je wijziging mogelijk niet was aangekomen. Nu krijg je een duidelijke melding ('Opslaan is niet gelukt — controleer je verbinding') zodra een opslag-verzoek mislukt, in plaats van stilzwijgend door te gaan. Ter info, geen wijziging: Financieel slaat per toetsaanslag op (zoals Budget dat al langer doet), Abonnementen pas bij het indrukken van 'Opslaan' — dat laatste is strikt genomen iets veiliger tegen een zeldzame edge-case met verzoeken die elkaar inhalen, maar beide zijn in de praktijk betrouwbaar",
};
