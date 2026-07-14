import { isValidSession, getSessionTokenFromReq, confirm2FASetup } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }

  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: "Vul de code uit je authenticator-app in" });

    const codes = await confirm2FASetup(code);
    if (!codes) return res.status(401).json({ error: "Onjuiste code — probeer het nog eens" });

    return res.status(200).json({ ok: true, recoveryCodes: codes });
  } catch (e) {
    return res.status(500).json({ error: "Kon 2FA niet bevestigen" });
  }
}
