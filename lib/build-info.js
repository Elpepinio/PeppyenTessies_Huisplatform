// Wordt door Claude bijgewerkt bij elke nieuwe zip-uitlevering — puur zodat
// je in de instellingen in één oogopslag kunt zien of een nieuwe deploy
// daadwerkelijk is doorgekomen, in plaats van te moeten gokken.
export const BUILD_INFO = {
  datum: "2026-09-25T11:35:00+02:00",
  omschrijving: "Budget: AI-chat toegevoegd om te sparren over meldingen en de bredere budgetsituatie — hergebruikt de al bestaande /api/ai-route (dezelfde als Gezondheid/Recepten), nu uitgebreid met een messages-array voor een echt gesprek met meerdere beurten. Elke melding in 'Uit de bocht' heeft een 💬-knop die de chat opent met die specifieke melding én (waar te herleiden) de losse aankopen van de betreffende categorie als context, zodat de AI concreet kan reageren i.p.v. algemeen. Plus een losse 'Sparren met AI over je budget'-knop voor open vragen. Onderweg een bestaande beperking van de test-extractietool blootgelegd en omzeild (naïeve accolade-telling struikelt over geneste accolades binnen een template-literal-interpolatie, zoals in euro()) — opgelost door euro() als testcontext mee te geven i.p.v. te extraheren. Getest met 10 nieuwe tests voor de context-opbouw",
};
