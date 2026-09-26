// Wordt door Claude bijgewerkt bij elke nieuwe zip-uitlevering — puur zodat
// je in de instellingen in één oogopslag kunt zien of een nieuwe deploy
// daadwerkelijk is doorgekomen, in plaats van te moeten gokken.
export const BUILD_INFO = {
  datum: "2026-09-25T21:45:00+02:00",
  omschrijving: "Boodschappenlijst: een derde optie toegevoegd aan het 'Klaar met boodschappen'-scherm — '✅ Afgevinkte items verwijderen' haalt alleen wat je al hebt gepakt van de lijst, en laat wat nog niet is afgevinkt gewoon staan voor een volgende ronde. Verschijnt alleen als er ook daadwerkelijk niet-afgevinkte items op de lijst staan. De kernlogica is uitgepakt naar een aparte, pure berekenVolgendeItems-functie en met 9 tests gedekt, inclusief de randgevallen (alles afgevinkt, niets afgevinkt, een lege lijst)",
};
