import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";
import { werkContext, leesWerkData, sleutels } from "../../lib/werk-opslag";

const redis = Redis.fromEnv();

// Velden die NOOIT in een export mogen belanden, ook al staan ze in
// huishouden:account — een back-upbestand kan in een mailbox, cloudschijf of
// USB-stick belanden, en zou dan het wachtwoord/2FA effectief lekken.
const GEVOELIGE_ACCOUNT_VELDEN = ["passwordHash", "twoFactorSecret", "twoFactorSecretPending", "recoveryCodes"];

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Methode niet toegestaan" });
  }

  try {
    // Vind alle sleutels van deze app in één keer. KEYS is normaliter iets om
    // te vermijden op grote productie-Redis-databases (kan even blokkeren),
    // maar voor een eenmalige, handmatige back-up-actie op deze schaal
    // (een paar honderd sleutels, incl. foto's) is dat geen probleem.
    const alleSleutels = await redis.keys("huishouden:*");

    const data = {};
    await Promise.all(alleSleutels.map(async key => {
      try {
        const waarde = await redis.get(key);
        if (waarde === null || waarde === undefined) return;

        if (key === "huishouden:account") {
          const account = typeof waarde === "string" ? JSON.parse(waarde) : waarde;
          const veilig = { ...account };
          GEVOELIGE_ACCOUNT_VELDEN.forEach(v => delete veilig[v]);
          data[key] = veilig;
        } else {
          data[key] = waarde;
        }
      } catch { /* individuele sleutel overslaan bij leesfout, rest gaat door */ }
    }));

    // De werkruimte staat bewust NIET onder huishouden:* (anders kon iedereen
    // in huis hem via een back-up inzien). Alleen je EIGEN werkruimte gaat
    // mee, en alleen als die op dit toestel ontgrendeld is.
    const werk = await werkContext(req);
    let werkruimteMee = null;
    if (werk.ontgrendeld && werk.slug) {
      data[sleutels.data(werk.slug)] = await leesWerkData(werk.slug);
      werkruimteMee = werk.user;
    }

    return res.status(200).json({
      gemaaktOp: new Date().toISOString(),
      werkruimteMee,
      aantalSleutels: Object.keys(data).length,
      data,
    });
  } catch (e) {
    return res.status(500).json({ error: "Export mislukt: " + e.message });
  }
}
