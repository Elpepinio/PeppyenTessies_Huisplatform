// Wordt door Claude bijgewerkt bij elke nieuwe zip-uitlevering — puur zodat
// je in de instellingen in één oogopslag kunt zien of een nieuwe deploy
// daadwerkelijk is doorgekomen, in plaats van te moeten gokken.
export const BUILD_INFO = {
  datum: "2026-09-26T20:05:00+02:00",
  omschrijving: "Abonnementen: nieuwe categorie 🎬 Entertainment & media (Netflix, HBO Max, Videoland, Disney+, Spotify, dagblad/krant, tijdschrift, enz.) — voorheen moesten deze onder het vage 'Overig' vallen. Geïnspireerd op de 'Dues'-app uit eerder GitHub-onderzoek (69 vooraf ingevulde diensten): een snelkeuzelijst met veelvoorkomende abonnementen per categorie, waarmee je met één tik de naam invult i.p.v. zelf te moeten bedenken en uittypen wat je allemaal hebt — zo mis je niets. categorieInfo zoekt de terugval nu ook robuust op id ('overig') i.p.v. een vaste arrayindex, die anders had kunnen breken bij het toevoegen van deze nieuwe categorie. Getest met 25 tests (1 nieuw, 1 aangepast aan het nieuwe aantal categorieën)",
};
