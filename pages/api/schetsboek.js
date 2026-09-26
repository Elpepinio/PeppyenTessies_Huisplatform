import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const PROJECTEN_KEY = "huishouden:schetsboek:projecten";
const SCHETSEN_KEY = "huishouden:schetsboek:schetsen";
const MEDIA_KEY = (id) => `huishouden:schetsboek:media:${id}`;
const BORD_KEY = (projectId) => `huishouden:schetsboek:bord:${projectId}`;
const RESEARCH_KEY = (projectId) => `huishouden:schetsboek:research:${projectId}`;
const CHAT_KEY = (projectId) => `huishouden:schetsboek:chat:${projectId}`;

// Video/spraak/foto kunnen groot zijn — Vercel's standaard limiet (4,5MB)
// is snel te klein voor een spraakbericht of videofragment, dus die zetten
// we hier expliciet ruimer.
export const config = { api: { bodyParser: { sizeLimit: "25mb" } } };

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  // Eén specifiek schets-medium ophalen (lazy — pas als je 'm echt opent,
  // niet standaard meegestuurd met de rest van het overzicht).
  if (req.method === "GET" && req.query.media) {
    try {
      const media = await redis.get(MEDIA_KEY(req.query.media));
      if (!media) return res.status(404).json({ error: "Media niet gevonden" });
      return res.status(200).json({ media });
    } catch (e) {
      return res.status(500).json({ error: "Kon media niet laden" });
    }
  }

  // Het tldraw-bord-document van een project — ook lazy, pas opgehaald
  // zodra je het bord daadwerkelijk opent.
  if (req.method === "GET" && req.query.bord) {
    try {
      const data = await redis.get(BORD_KEY(req.query.bord));
      const snapshot = data ? (typeof data === "string" ? JSON.parse(data) : data) : null;
      return res.status(200).json({ snapshot });
    } catch (e) {
      return res.status(500).json({ error: "Kon bord niet laden" });
    }
  }

  // Eerder opgeslagen AI-research van een project — lazy, en meteen
  // bruikbaar zonder opnieuw te hoeven betalen voor web-search.
  if (req.method === "GET" && req.query.research) {
    try {
      const data = await redis.get(RESEARCH_KEY(req.query.research));
      const research = data ? (typeof data === "string" ? JSON.parse(data) : data) : null;
      return res.status(200).json({ research });
    } catch (e) {
      return res.status(500).json({ error: "Kon onderzoek niet laden" });
    }
  }

  // Eerder gesparde chatgeschiedenis van een project.
  if (req.method === "GET" && req.query.chat) {
    try {
      const data = await redis.get(CHAT_KEY(req.query.chat));
      const berichten = data ? (typeof data === "string" ? JSON.parse(data) : data) : [];
      return res.status(200).json({ berichten });
    } catch (e) {
      return res.status(500).json({ error: "Kon gesprek niet laden" });
    }
  }

  if (req.method === "GET") {
    try {
      const [projectenData, schetsenData] = await Promise.all([
        redis.get(PROJECTEN_KEY),
        redis.get(SCHETSEN_KEY),
      ]);
      const projecten = projectenData ? (typeof projectenData === "string" ? JSON.parse(projectenData) : projectenData) : [];
      const schetsen = schetsenData ? (typeof schetsenData === "string" ? JSON.parse(schetsenData) : schetsenData) : [];
      return res.status(200).json({ projecten, schetsen });
    } catch (e) {
      return res.status(500).json({ error: "Laden mislukt" });
    }
  }

  if (req.method === "POST") {
    try {
      const { actie } = req.body;

      if (actie === "projecten") {
        await redis.set(PROJECTEN_KEY, JSON.stringify(req.body.projecten || []));
        return res.status(200).json({ ok: true });
      }

      if (actie === "schetsToevoegen") {
        const { schets, media } = req.body;
        if (media) await redis.set(MEDIA_KEY(schets.id), media);
        const schetsenData = await redis.get(SCHETSEN_KEY);
        const schetsen = schetsenData ? (typeof schetsenData === "string" ? JSON.parse(schetsenData) : schetsenData) : [];
        schetsen.push(schets);
        await redis.set(SCHETSEN_KEY, JSON.stringify(schetsen));
        return res.status(200).json({ ok: true });
      }

      if (actie === "schetsBijwerken") {
        // Alleen lichte velden (titel e.d.) — nooit media, die verandert
        // nooit na het aanmaken, dus die hoeft nooit opnieuw verstuurd te
        // worden.
        const { schetsId, wijzigingen } = req.body;
        const schetsenData = await redis.get(SCHETSEN_KEY);
        const schetsen = schetsenData ? (typeof schetsenData === "string" ? JSON.parse(schetsenData) : schetsenData) : [];
        const bijgewerkt = schetsen.map(s => s.id === schetsId ? { ...s, ...wijzigingen } : s);
        await redis.set(SCHETSEN_KEY, JSON.stringify(bijgewerkt));
        return res.status(200).json({ ok: true });
      }

      if (actie === "volgordeBijwerken") {
        // { volgordes: [{id, volgorde}, ...] } — na het slepen worden alle
        // betrokken volgorde-nummers in één keer weggeschreven i.p.v. per
        // item een losse aanroep te doen.
        const { volgordes } = req.body;
        const volgordeMap = Object.fromEntries((volgordes||[]).map(v => [v.id, v.volgorde]));
        const schetsenData = await redis.get(SCHETSEN_KEY);
        const schetsen = schetsenData ? (typeof schetsenData === "string" ? JSON.parse(schetsenData) : schetsenData) : [];
        const bijgewerkt = schetsen.map(s => volgordeMap[s.id] !== undefined ? { ...s, volgorde: volgordeMap[s.id] } : s);
        await redis.set(SCHETSEN_KEY, JSON.stringify(bijgewerkt));
        return res.status(200).json({ ok: true });
      }

      if (actie === "bordOpslaan") {
        const { projectId, snapshot } = req.body;
        await redis.set(BORD_KEY(projectId), JSON.stringify(snapshot));
        return res.status(200).json({ ok: true });
      }

      if (actie === "researchOpslaan") {
        // Overschrijft eerder onderzoek voor dit project — er is bewust maar
        // één bewaard exemplaar per project (het meest recente), geen
        // geschiedenis van oudere onderzoeken.
        const { projectId, research } = req.body;
        await redis.set(RESEARCH_KEY(projectId), JSON.stringify(research));
        return res.status(200).json({ ok: true });
      }

      if (actie === "chatOpslaan") {
        const { projectId, berichten } = req.body;
        await redis.set(CHAT_KEY(projectId), JSON.stringify(berichten || []));
        return res.status(200).json({ ok: true });
      }

      if (actie === "schetsVerwijderen") {
        const { schetsId } = req.body;
        const schetsenData = await redis.get(SCHETSEN_KEY);
        const schetsen = schetsenData ? (typeof schetsenData === "string" ? JSON.parse(schetsenData) : schetsenData) : [];
        await redis.set(SCHETSEN_KEY, JSON.stringify(schetsen.filter(s => s.id !== schetsId)));
        try { await redis.del(MEDIA_KEY(schetsId)); } catch {}
        return res.status(200).json({ ok: true });
      }

      if (actie === "projectVerwijderen") {
        // Ook alle schetsen (en hun media) binnen dat project opruimen —
        // een leeg project achterlaten dat toch niet meer bereikbaar is,
        // is verwarrender dan gewoon alles meenemen.
        const { projectId } = req.body;
        const [projectenData, schetsenData] = await Promise.all([redis.get(PROJECTEN_KEY), redis.get(SCHETSEN_KEY)]);
        const projecten = projectenData ? (typeof projectenData === "string" ? JSON.parse(projectenData) : projectenData) : [];
        const schetsen = schetsenData ? (typeof schetsenData === "string" ? JSON.parse(schetsenData) : schetsenData) : [];
        const teVerwijderen = schetsen.filter(s => s.projectId === projectId);
        await Promise.all(teVerwijderen.map(s => redis.del(MEDIA_KEY(s.id)).catch(() => {})));
        await redis.del(BORD_KEY(projectId)).catch(() => {});
        await redis.del(RESEARCH_KEY(projectId)).catch(() => {});
        await redis.del(CHAT_KEY(projectId)).catch(() => {});
        await Promise.all([
          redis.set(PROJECTEN_KEY, JSON.stringify(projecten.filter(p => p.id !== projectId))),
          redis.set(SCHETSEN_KEY, JSON.stringify(schetsen.filter(s => s.projectId !== projectId))),
        ]);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: "Onbekende actie" });
    } catch (e) {
      return res.status(500).json({ error: "Opslaan mislukt: " + e.message });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
