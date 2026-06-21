import {
  hasHousehold,
  createHousehold,
  createSession,
  sessionCookieHeader,
} from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }

  try {
    const exists = await hasHousehold();
    if (exists) {
      return res.status(409).json({ error: "Er is al een huishoudaccount ingesteld" });
    }

    const { name, password } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Vul een naam voor het huishouden in" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Wachtwoord moet minstens 6 tekens zijn" });
    }

    await createHousehold(name.trim(), password);
    const token = await createSession();
    res.setHeader("Set-Cookie", sessionCookieHeader(token));
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Kon account niet aanmaken" });
  }
}
