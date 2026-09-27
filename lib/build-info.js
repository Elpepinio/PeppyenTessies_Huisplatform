// Wordt door Claude bijgewerkt bij elke nieuwe zip-uitlevering — puur zodat
// je in de instellingen in één oogopslag kunt zien of een nieuwe deploy
// daadwerkelijk is doorgekomen, in plaats van te moeten gokken.
export const BUILD_INFO = {
  datum: "2026-09-25T22:30:00+02:00",
  omschrijving: "Boodschappenlijst: bevestigd en expliciet getest dat een niet-gepakt item bij 'Afgevinkte items verwijderen' nooit verdwijnt (het object blijft letterlijk hetzelfde, geen data verloren, geen handmatig opnieuw toevoegen nodig). Onderweg een verwant, kleiner probleem gevonden en gefixt vlak naast de eerdere bug: de archief-/koopfrequentie-registratie gebruikte ook nog checked i.p.v. inCart, waardoor een bewust laten-liggen item toch als 'gekocht' werd meegeteld. Uitgepakt naar een eigen, geteste itemsGekochtDezeRonde-functie — bewust apart gehouden omdat dit checked/inCart-onderscheid nu al twee keer tot een bug leidde",
};
