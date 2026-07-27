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
      const current = await redis.get(DATA_KEY);
      const curr = current ? (typeof current === "string" ? JSON.parse(current) : current) : { lists: [] };
      const currLists = curr.lists || [];

      // ── Modus A: gerichte update van precies ÉÉN lijst ────────────────
      // De veiligste manier voor een ANDERE tool (bv. Maaltijdplanner, die
      // alleen de Boodschappenlijst wil bijwerken) om een wijziging door te
      // geven — zonder dat die tool alle overige lijsten hoeft te kennen of
      // mee te sturen. Kan dus nooit per ongeluk iets anders raken.
      if (incoming.listUpdate) {
        const bijgewerkt = incoming.listUpdate;
        const bestaatAl = currLists.some(l => l.id === bijgewerkt.id);
        const nieuweLists = bestaatAl
          ? currLists.map(l => l.id === bijgewerkt.id ? bijgewerkt : l)
          : [...currLists, bijgewerkt];
        await redis.set(DATA_KEY, JSON.stringify({ ...curr, lists: nieuweLists }));
        return res.status(200).json({ ok: true });
      }

      // ── Modus B: volledige lijst-array (gebruikt door de Lijsten-tool
      // zelf, bv. bij herordenen/hernoemen/toevoegen van hele lijsten) ───
      const incomingLists = incoming.lists || [];
      // Een lijst mag ALLEEN verdwijnen als de aanroeper dat expliciet
      // aangeeft via deletedListIds — nooit stilzwijgend omdat 'ie toevallig
      // ontbreekt in wat er is meegestuurd. Dat laatste was de oorzaak van
      // een ernstige bug: een aanroeper die (om welke reden dan ook) een
      // onvolledige lijst-array meestuurde, wiste daarmee alle andere
      // lijsten die niet toevallig in de laatste 10 seconden waren gemaakt.
      const deletedListIds = new Set(incoming.deletedListIds || []);

      // Per lijst: voeg items samen op basis van id, zodat gelijktijdige
      // wijzigingen (bv. een ander apparaat dat tegelijk iets toevoegt)
      // niet verloren gaan.
      const mergedLists = incomingLists.map(inList => {
        const currList = currLists.find(l => l.id === inList.id);
        if (!currList) return inList; // nieuwe lijst, bewaar as-is

        const inListIds = new Set((inList.items || []).map(i => i.id));
        const extraItems = (currList.items || []).filter(i => !inListIds.has(i.id));
        const tiendSecondenGeleden = Date.now() - 10000;
        const nieuweExtraItems = extraItems.filter(i => i.addedAt > tiendSecondenGeleden);

        return {
          ...inList,
          items: [...(inList.items || []), ...nieuweExtraItems],
        };
      });

      // Lijsten die in huidig staan maar niet in incoming: ALTIJD bewaren,
      // tenzij expliciet als verwijderd gemarkeerd.
      const incomingIds = new Set(incomingLists.map(l => l.id));
      const teBewaren = currLists.filter(l => !incomingIds.has(l.id) && !deletedListIds.has(l.id));

      await redis.set(DATA_KEY, JSON.stringify({
        ...incoming,
        lists: [...mergedLists, ...teBewaren],
      }));
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Kon data niet opslaan" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
