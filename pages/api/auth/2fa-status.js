import { isValidSession, getSessionTokenFromReq, is2FAEnabled, getRecoveryCodesRemaining } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }

  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  try {
    const enabled = await is2FAEnabled();
    const recoveryCodesRemaining = enabled ? await getRecoveryCodesRemaining() : 0;
    return res.status(200).json({ enabled, recoveryCodesRemaining });
  } catch (e) {
    return res.status(500).json({ error: "Kon status niet ophalen" });
  }
}
