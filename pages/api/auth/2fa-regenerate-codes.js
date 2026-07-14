import { isValidSession, getSessionTokenFromReq, verifyPassword, regenerateRecoveryCodes } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }

  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  try {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: "Vul je wachtwoord in ter bevestiging" });

    // Nieuwe herstelcodes genereren maakt de oude ongeldig — ook dit vragen
    // we het wachtwoord nogmaals bij, net als bij het uitschakelen van 2FA.
    const geldig = await verifyPassword(password);
    if (!geldig) return res.status(401).json({ error: "Wachtwoord onjuist" });

    const codes = await regenerateRecoveryCodes();
    if (!codes) return res.status(400).json({ error: "Tweestapsverificatie is niet actief" });

    return res.status(200).json({ ok: true, recoveryCodes: codes });
  } catch (e) {
    return res.status(500).json({ error: "Kon herstelcodes niet vernieuwen" });
  }
}
