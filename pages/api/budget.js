import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
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
      return res.status(500).json({ error: "Kon data niet laden" });
    }
  }

  if (req.method === "POST") {
    try {
      const body = req.body || {};
      await redis.set(DATA_KEY, JSON.stringify({ ...EMPTY_STATE, ...body }));
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Kon data niet opslaan" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
