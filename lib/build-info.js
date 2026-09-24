// Wordt door Claude bijgewerkt bij elke nieuwe zip-uitlevering — puur zodat
// je in de instellingen in één oogopslag kunt zien of een nieuwe deploy
// daadwerkelijk is doorgekomen, in plaats van te moeten gokken.
export const BUILD_INFO = {
  datum: "2026-09-24T12:15:00+02:00",
  omschrijving: "Budget: bug gefixt waarbij CSV uploaden soms stilletjes niets deed — twee verborgen bestandsinvoervelden (header-knop 'Bank' én het Bank-tabblad zelf) deelden dezelfde React-ref. Zodra je ooit het Bank-tabblad bezocht en weer verliet, verloor de header-knop zijn koppeling (ref werd null) voor de rest van de sessie. Elk invoerveld heeft nu zijn eigen, geïsoleerde ref",
};
