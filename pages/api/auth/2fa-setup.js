import QRCode from "qrcode";
import { isValidSession, getSessionTokenFromReq, getSessionUser, start2FASetup } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }

  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  try {
    const gebruiker = (await getSessionUser(token)) || "Huishouden";
    const { secret, otpauthUrl } = await start2FASetup(gebruiker);
    // QR-code wordt volledig server-side gegenereerd — het geheim gaat nooit
    // naar een externe dienst, alleen als afbeelding terug naar de browser.
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 240, margin: 1 });
    return res.status(200).json({ secret, qrDataUrl });
  } catch (e) {
    return res.status(500).json({ error: "Kon 2FA-instellen niet starten: " + e.message });
  }
}
