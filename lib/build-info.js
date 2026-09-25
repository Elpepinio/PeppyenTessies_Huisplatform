// Wordt door Claude bijgewerkt bij elke nieuwe zip-uitlevering — puur zodat
// je in de instellingen in één oogopslag kunt zien of een nieuwe deploy
// daadwerkelijk is doorgekomen, in plaats van te moeten gokken.
export const BUILD_INFO = {
  datum: "2026-09-25T09:55:00+02:00",
  omschrijving: "Budget: de daadwerkelijke oorzaak van 'import verschijnt even, verdwijnt dan weer' gevonden en gefixt — de API-route had géén verhoogd payload-limiet, dus viel terug op Next.js' standaard van 1MB. Elke opslag stuurt de VOLLEDIGE budget-staat mee (geen diff), en dat kan na jaren gebruik plus een grote inhaal-import ruim boven 1MB uitkomen. Zo'n te groot verzoek werd stilletjes afgewezen vóórdat de eigen code er ooit aan te pas kwam: de import leek lokaal even te lukken, tot de eerstvolgende achtergrond-sync de nooit-echt-opgeslagen wijziging weer overschreef. Limiet nu op 4MB gezet — bewust onder Vercel's eigen harde platformlimiet van ~4,5MB voor serverless functions, die geen enkele instelling hier kan overschrijven",
};
