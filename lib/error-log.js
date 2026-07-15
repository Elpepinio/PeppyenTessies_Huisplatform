import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const LOG_KEY = "huishouden:foutlog";
const MAX_ENTRIES = 200;

// Logt een fout (client- of server-side) naar een gedeeld logboek, zodat
// problemen zichtbaar worden vóórdat iemand ze toevallig zelf tegenkomt en
// meldt. Bewust een eigen, simpele oplossing in plaats van een externe dienst
// zoals Sentry — geen extra account nodig, past bij de rest van de app.
export async function logFout({ bron = "onbekend", bericht = "", stack = "", url = "", gebruiker = null }) {
  try {
    const huidig = await redis.get(LOG_KEY);
    const lijst = huidig ? (typeof huidig === "string" ? JSON.parse(huidig) : huidig) : [];
    lijst.push({
      datum: new Date().toISOString(),
      bron, bericht: String(bericht).slice(0, 500), stack: String(stack).slice(0, 1000), url, gebruiker,
    });
    const bijgesneden = lijst.length > MAX_ENTRIES ? lijst.slice(lijst.length - MAX_ENTRIES) : lijst;
    await redis.set(LOG_KEY, JSON.stringify(bijgesneden));
  } catch (e) {
    // Loggen zelf mag nooit de eigenlijke actie laten crashen.
    console.error("Foutlog mislukt", e);
  }
}
