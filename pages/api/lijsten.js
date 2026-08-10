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
      const incoming = req.body;
      // Slim merge: haal huidige staat op en voeg nieuwe items samen
      // zodat gelijktijdige wijzigingen niet verloren gaan
      const current = await redis.get(DATA_KEY);
      if (current) {
        const curr = typeof current === "string" ? JSON.parse(current) : current;
        const currLists = curr.lists || [];
        const incomingLists = incoming.lists || [];

        // Per lijst: voeg items samen op basis van id
        // Items die in "huidig" staan maar niet in "incoming" zijn waarschijnlijk
        // door de ander toegevoegd — bewaar ze
        const mergedLists = incomingLists.map(inList => {
          const currList = currLists.find(l => l.id === inList.id);
          if (!currList) return inList; // nieuwe lijst, bewaar as-is

          // Vind items in currList die niet in inList staan
          // (mogelijk door andere gebruiker toegevoegd)
          const inListIds = new Set((inList.items || []).map(i => i.id));
          const extraItems = (currList.items || []).filter(i => !inListIds.has(i.id));

          // Als er extra items zijn die max 10 seconden geleden zijn toegevoegd,
          // samenvoegen (recent = waarschijnlijk door ander apparaat)
          const tiendSecondenGeleden = Date.now() - 10000;
          const nieuweExtraItems = extraItems.filter(i => i.addedAt > tiendSecondenGeleden);

          return {
            ...inList,
            items: [...(inList.items || []), ...nieuweExtraItems],
          };
        });

        // Lijsten die in huidig staan maar niet in incoming (door ander verwijderd of nieuw)
        const incomingIds = new Set(incomingLists.map(l => l.id));
        const extraLijsten = currLists.filter(l => !incomingIds.has(l.id) && l.createdAt > Date.now() - 10000);

        await redis.set(DATA_KEY, JSON.stringify({
          ...incoming,
          lists: [...mergedLists, ...extraLijsten],
        }));
      } else {
        await redis.set(DATA_KEY, JSON.stringify(incoming));
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Kon data niet opslaan" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
