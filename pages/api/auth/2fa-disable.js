import { isValidSession, getSessionTokenFromReq, verifyPassword, disable2FA } from "../../../lib/auth";

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

    // Uitschakelen van 2FA is gevoelig genoeg om nogmaals het wachtwoord te
    // vragen — voorkomt dat iemand die even bij een openstaand toestel kan,
    // in één tik de tweede beveiligingslaag wegneemt.
    const geldig = await verifyPassword(password);
    if (!geldig) return res.status(401).json({ error: "Wachtwoord onjuist" });

    await disable2FA();
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Kon 2FA niet uitschakelen" });
  }
}
