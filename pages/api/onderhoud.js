import { Redis } from "@upstash/redis";
import { isValidSession, getSessionTokenFromReq } from "../../lib/auth";

const redis = Redis.fromEnv();
const DATA_KEY = "huishouden:onderhoud";
const FACTUUR_KEY = (itemId) => `huishouden:onderhoud:factuur:${itemId}`;

// Zonder deze instelling gebruikt Next.js de standaardlimiet van 1MB per
// request — te klein zodra er factuurfoto's/PDF's meegestuurd worden.
export const config = { api: { bodyParser: { sizeLimit: "20mb" } } };

const EMPTY = { objecten: [], taken: [], projecten: [], projectTaken: [], mijlpalen: [] };

export default async function handler(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!await isValidSession(token)) return res.status(401).json({ error: "Niet ingelogd" });

  if (req.method === "GET") {
    try {
      const data = await redis.get(DATA_KEY);
      if (!data) return res.status(200).json(EMPTY);
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      const projecten = parsed.projecten || [];

      // Factuurfoto's staan los opgeslagen (zelfde reden als bij Bonnetjes/
      // Planten: grote foto's horen niet inline in het hoofd-record) — hier
      // per project terugladen op basis van welke item-id's een factuur hebben.
      const projectenMetFacturen = await Promise.all(
        projecten.map(async p => {
          const facturenIds = Object.keys(p.facturen || {}).filter(id => p.facturen[id]);
          if (facturenIds.length === 0) return p;
          const fotos = {};
          await Promise.all(facturenIds.map(async id => {
            try {
              const foto = await redis.get(FACTUUR_KEY(id));
              if (foto) fotos[id] = foto;
            } catch { /* los record kwijt — negeren, rest blijft werken */ }
          }));
          return { ...p, facturenFotos: fotos };
        })
      );

      return res.status(200).json({ ...EMPTY, ...parsed, projecten: projectenMetFacturen });
    } catch (e) { return res.status(500).json({ error: "Laden mislukt" }); }
  }

  if (req.method === "POST") {
    try {
      const body = req.body || {};
      const projecten = body.projecten || [];

      // Nieuw/gewijzigde factuurfoto's (in project.facturenFotos) naar hun
      // eigen key schrijven, en daarna uit het hoofd-record halen — daar
      // blijft alleen een vlaggetje (facturen: {itemId: true}) staan.
      const projectenSchoon = await Promise.all(
        projecten.map(async p => {
          const { facturenFotos, ...rest } = p;
          if (facturenFotos && Object.keys(facturenFotos).length > 0) {
            await Promise.all(Object.entries(facturenFotos).map(async ([id, foto]) => {
              if (foto) await redis.set(FACTUUR_KEY(id), foto);
              else { try { await redis.del(FACTUUR_KEY(id)); } catch {} }
            }));
          }
          return rest;
        })
      );

      await redis.set(DATA_KEY, JSON.stringify({ ...body, projecten: projectenSchoon }));
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: "Opslaan mislukt: " + e.message }); }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Methode niet toegestaan" });
}
