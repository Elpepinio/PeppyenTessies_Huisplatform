import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:lijsten";

const BOODSCHAPPEN_CATEGORIEEN = [
  // ── Markt ──
  { id: "groentekraam",  label: "Groentekraam",   icon: "🥦" },
  { id: "kaaskraam",     label: "Kaaskraam",       icon: "🧀" },
  { id: "viskraam",      label: "Viskraam",        icon: "🐟" },
  { id: "bloemenkraam",  label: "Bloemenkraam",    icon: "💐" },
  // ── Supermarkt ──
  { id: "zuivel_eieren", label: "Zuivel & Eieren", icon: "🥛" },
  { id: "vlees_vis",     label: "Vlees & Vis",     icon: "🥩" },
  { id: "brood_bakkerij",label: "Brood & Bakkerij",icon: "🥐" },
  { id: "houdbaar",      label: "Houdbaar",        icon: "🥫" },
  { id: "diepvries",     label: "Diepvries",       icon: "🧊" },
  { id: "drogisterij",   label: "Drogisterij",     icon: "🧴" },
  { id: "huishouden",    label: "Huishouden",      icon: "🧽" },
  { id: "dranken",       label: "Dranken",         icon: "🧃" },
  { id: "overig",        label: "Overig",          icon: "🛒" },
];

const DEFAULT_STATE = {
  lists: [
    {
      id: "boodschappen",
      name: "Boodschappen",
      icon: "🛒",
      categories: BOODSCHAPPEN_CATEGORIEEN,
      items: [],
      history: {},
      favorites: [],
      createdAt: Date.now(),
    },
  ],
};

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  const loggedIn = await isValidSession(token);
  if (!loggedIn) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "GET") {
    try {
      const data = await redis.get(DATA_KEY);
      if (!data) return res.status(200).json(DEFAULT_STATE);
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return res.status(200).json({ ...DEFAULT_STATE, ...parsed });
    } catch (e) {
      return res.status(500).json({ error: "Kon data niet laden" });
    }
  }

  if (req.method === "POST") {
    try {
      await redis.set(DATA_KEY, JSON.stringify(req.body));
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Kon data niet opslaan" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
