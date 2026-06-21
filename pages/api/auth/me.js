import { hasHousehold, isValidSession, getSessionTokenFromReq } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }

  try {
    const exists = await hasHousehold();
    const token = getSessionTokenFromReq(req);
    const loggedIn = exists ? await isValidSession(token) : false;
    return res.status(200).json({ accountExists: exists, loggedIn });
  } catch (e) {
    return res.status(500).json({ error: "Kon status niet ophalen" });
  }
}
