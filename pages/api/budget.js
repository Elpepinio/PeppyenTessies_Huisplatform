import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";
import { logFout } from "../../lib/error-log";

const redis = Redis.fromEnv();

// Elke opslag stuurt de VOLLEDIGE budget-staat mee (geen diff) — met jaren
// aan transacties, budgetten en geschiedenis kan dat royaal boven Next.js'
// standaardlimiet van 1MB uitkomen, zeker bij een grote inhaal-import in één
// keer. Zonder deze verhoging wijst Next.js zo'n verzoek stilletjes af (413)
// vóórdat de eigen handler-code er ooit aan te pas komt — de import lijkt
// dan even te lukken (lokale state update), tot de eerstvolgende
// achtergrond-sync de nooit-echt-opgeslagen wijziging weer overschrijft.
// Let op: Vercel zelf hanteert voor serverless functions een harde limiet
// van ~4,5MB voor de request-body, die deze instelling niet kan
// overschrijven — vandaar dat er hier ruim onder gebleven wordt i.p.v. een
// hogere waarde op te geven die het platform toch zou blokkeren.
export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };
const DATA_KEY = "huishouden:budget";

const EMPTY_STATE = {
  setupDone: false,
  theme: "dark",
  names: { p1: "Partner 1", p2: "Partner 2" },
  incomes: { p1: 0, p2: 0, bijdrage_p1: 0, bijdrage_p2: 0, kinderbijslag: 0 },
  expenses: [],
  budgets: [],
  receipts: [],
  savingsGoals: [],
  tasks: [],
  bijst: [],
  ibanMap: {},
  categorieMap: {},
  bekendeIbans: {},
};

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  const loggedIn = await isValidSession(token);
  if (!loggedIn) {
    return res.status(401).json({ error: "Niet ingelogd" });
  }

  if (req.method === "GET") {
    try {
      const data = await redis.get(DATA_KEY);
      if (!data) {
        return res.status(200).json(EMPTY_STATE);
      }
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return res.status(200).json({ ...EMPTY_STATE, ...parsed });
    } catch (e) {
      logFout({ bron: "api-budget-get", bericht: e.message, stack: e.stack });
      return res.status(500).json({ error: "Kon data niet laden" });
    }
  }

  if (req.method === "POST") {
    try {
      const body = req.body || {};
      await redis.set(DATA_KEY, JSON.stringify({ ...EMPTY_STATE, ...body }));
      return res.status(200).json({ ok: true });
    } catch (e) {
      logFout({ bron: "api-budget-post", bericht: e.message, stack: e.stack });
      return res.status(500).json({ error: "Kon data niet opslaan" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
