import { destroySession, sessionCookieHeader, getSessionTokenFromReq } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }

  try {
    const token = getSessionTokenFromReq(req);
    await destroySession(token);
    res.setHeader("Set-Cookie", sessionCookieHeader(null, { clear: true }));
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Kon niet uitloggen" });
  }
}
