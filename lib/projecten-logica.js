// ════════════════════════════════════════════════════════════════════
// Projectsjablonen — terugkerende stappen voor (commercial)producties:
// pre-productie → productie → postproductie.
//
// Een sjabloon is een lijst stappen. Elke stap heeft:
//   fase   — pre | productie | post
//   soort  — regelen (regelen/doorsturen) | persoon (mensen regelen)
//            | document (opstellen) | taak
//   anker  — draai (de (eerste) draaidag) | oplever (opleverdatum)
//   offset — dagen t.o.v. dat anker (−14 = twee weken ervóór)
//
// "Zelflerend": na een project vergelijkt berekenLeerVoorstellen wat je
// écht deed met het sjabloon — toegevoegde, weggehaalde, hernoemde of
// verplaatste stappen, en wanneer je stappen werkelijk afrondde. Jij kiest
// welke voorstellen het sjabloon in gaan; de timing wordt per stap
// bijgehouden (laatste 6 projecten) zodat de suggesties steeds beter
// worden.
//
// Puur (alleen import van de pure taken-logica), dus volledig testbaar.
// ════════════════════════════════════════════════════════════════════
import { plusDagen, dagenTussen, datumNaarStr } from "./taken-logica";

export const FASES = [
  { id: "pre", label: "Pre-productie", icon: "📝" },
  { id: "productie", label: "Productie", icon: "🎬" },
  { id: "post", label: "Postproductie", icon: "🎞️" },
];
export const SOORTEN = {
  regelen: { label: "Regelen / doorsturen", icon: "📨" },
  persoon: { label: "Mensen regelen", icon: "👥" },
  document: { label: "Document opstellen", icon: "📄" },
  taak: { label: "Taak", icon: "✅" },
};
const ANKERS = ["draai", "oplever"];
const BEWAAR_TIMINGS = 6;

const s = (id, fase, soort, tekst, anker, offset) => ({ id, fase, soort, tekst, anker, offset });

export const STANDAARD_SJABLONEN = [
  {
    id: "commercial-klein", naam: "Commercial — klein", icoon: "🎥", standaardDoorlooptijd: 14,
    omschrijving: "Eén draaidag, kleine crew, één eindversie plus een paar formats.",
    stappen: [
      s("k-offerte", "pre", "document", "Offerte / begroting opstellen", "draai", -25),
      s("k-akkoord", "pre", "regelen", "Akkoord klant op offerte + briefing bevestigen", "draai", -21),
      s("k-script", "pre", "document", "Script / shotlist opstellen", "draai", -14),
      s("k-crew", "pre", "persoon", "Crew boeken (camera-assistent, geluid)", "draai", -14),
      s("k-locatie", "pre", "regelen", "Locatie bevestigen + toestemming", "draai", -10),
      s("k-huur", "pre", "regelen", "Apparatuur reserveren / huren", "draai", -7),
      s("k-callsheet", "pre", "document", "Callsheet opstellen", "draai", -2),
      s("k-callsheet-stuur", "pre", "regelen", "Callsheet doorsturen naar crew en klant", "draai", -1),
      s("k-gearcheck", "pre", "taak", "Gear check: accu's laden, kaarten formatteren", "draai", -1),
      s("k-draai", "productie", "taak", "Draaidag", "draai", 0),
      s("k-backup", "productie", "regelen", "Footage dubbel back-uppen", "draai", 0),
      s("k-retour", "post", "regelen", "Gehuurde apparatuur terugbrengen", "draai", 1),
      s("k-inladen", "post", "taak", "Footage inladen en ordenen", "draai", 1),
      s("k-montage", "post", "taak", "Eerste montage", "oplever", -7),
      s("k-v1", "post", "regelen", "V1 doorsturen naar klant voor feedback", "oplever", -6),
      s("k-feedback", "post", "taak", "Feedback verwerken", "oplever", -3),
      s("k-kleur", "post", "taak", "Kleurcorrectie en geluid afmixen", "oplever", -2),
      s("k-oplever", "post", "regelen", "Eindversie + formats opleveren", "oplever", 0),
      s("k-factuur", "post", "document", "Factuur sturen", "oplever", 1),
    ],
  },
  {
    id: "commercial-groot", naam: "Commercial — groot", icoon: "🎬", standaardDoorlooptijd: 28,
    omschrijving: "Meerdere draaidagen, volledige crew, casting, externe geluidsstudio en meerdere versies.",
    stappen: [
      s("g-offerte", "pre", "document", "Offerte en begroting opstellen", "draai", -35),
      s("g-akkoord", "pre", "regelen", "Akkoord klant + aanbetaling", "draai", -30),
      s("g-planning", "pre", "document", "Productieplanning / tijdlijn opstellen", "draai", -28),
      s("g-regie", "pre", "persoon", "Regisseur en DOP vastleggen", "draai", -28),
      s("g-treatment", "pre", "document", "Treatment, script en storyboard", "draai", -21),
      s("g-vergunning", "pre", "regelen", "Draaivergunning / toestemming gemeente aanvragen", "draai", -21),
      s("g-casting", "pre", "persoon", "Casting organiseren en cast boeken", "draai", -21),
      s("g-crew", "pre", "persoon", "Crew boeken (gaffer, geluid, styling, MUA, runner)", "draai", -18),
      s("g-locatie", "pre", "regelen", "Locatiescout + locatiecontract", "draai", -18),
      s("g-studio", "pre", "persoon", "Geluidsstudio en mixer reserveren", "draai", -14),
      s("g-verzekering", "pre", "regelen", "Productieverzekering regelen", "draai", -14),
      s("g-post-crew", "pre", "persoon", "Editor en colorist inplannen", "draai", -10),
      s("g-huur", "pre", "regelen", "Camera-, licht- en griphuur reserveren", "draai", -10),
      s("g-ppm", "pre", "taak", "PPM (pre-productiemeeting) met klant", "draai", -7),
      s("g-releases", "pre", "document", "Model releases / quitclaims klaarzetten", "draai", -7),
      s("g-catering", "pre", "regelen", "Catering en vervoer regelen", "draai", -7),
      s("g-draaiboek", "pre", "document", "Draaiboek en callsheets opstellen", "draai", -3),
      s("g-callsheet-stuur", "pre", "regelen", "Callsheets doorsturen naar crew, cast en klant", "draai", -2),
      s("g-draai", "productie", "taak", "Draaidagen", "draai", 0),
      s("g-dit", "productie", "regelen", "Dagelijkse back-up / DIT", "draai", 0),
      s("g-shotlog", "productie", "document", "Shotlog / script notes bijhouden", "draai", 0),
      s("g-rushes", "productie", "regelen", "Rushes delen met regie en klant", "draai", 1),
      s("g-inladen", "post", "taak", "Footage inladen, syncen en ordenen", "draai", 2),
      s("g-muziek", "post", "regelen", "Muziek en licenties regelen", "oplever", -18),
      s("g-offline", "post", "taak", "Offline montage", "oplever", -14),
      s("g-v1", "post", "regelen", "V1 doorsturen naar klant", "oplever", -12),
      s("g-feedback2", "post", "taak", "Feedbackronde 2 verwerken", "oplever", -8),
      s("g-lock", "post", "regelen", "Picture lock laten bevestigen", "oplever", -7),
      s("g-aaf", "post", "regelen", "AAF + referentie naar geluidsstudio sturen", "oplever", -7),
      s("g-grading", "post", "taak", "Grading", "oplever", -5),
      s("g-versies", "post", "taak", "Ondertiteling, versies en formats", "oplever", -2),
      s("g-oplever", "post", "regelen", "Masters en social cut-downs opleveren", "oplever", 0),
      s("g-factuur", "post", "document", "Factuur en nacalculatie", "oplever", 2),
      s("g-archief", "post", "regelen", "Footage en project archiveren", "oplever", 7),
    ],
  },
];

// ── Hulpjes ────────────────────────────────────────────────────────
export function mediaan(getallen) {
  const g = [...(getallen || [])].filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  if (!g.length) return null;
  const m = Math.floor(g.length / 2);
  return g.length % 2 ? g[m] : Math.round((g[m - 1] + g[m]) / 2);
}

export function normaliseerStap(st, nieuwId) {
  return {
    id: st.id || nieuwId(),
    fase: FASES.some(f => f.id === st.fase) ? st.fase : "pre",
    soort: SOORTEN[st.soort] ? st.soort : "taak",
    tekst: String(st.tekst || "").trim().slice(0, 140) || "Nieuwe stap",
    anker: ANKERS.includes(st.anker) ? st.anker : "draai",
    offset: Math.max(-365, Math.min(365, Math.round(Number(st.offset) || 0))),
  };
}

// Volgorde binnen het sjabloon: per fase, en binnen een fase chronologisch.
// De opleverdatum ligt `doorloop` dagen na de draaidag (alleen om de twee
// ankers in één tijdlijn te kunnen zetten).
export function sorteerStappen(stappen, doorloop = 14) {
  const fi = (f) => FASES.findIndex(x => x.id === f);
  const t = (st) => (st.anker === "oplever" ? doorloop : 0) + st.offset;
  return [...stappen].sort((a, b) => fi(a.fase) - fi(b.fase) || t(a) - t(b));
}

export function stapDatum(st, { draaidag, opleverdatum }) {
  const anker = st.anker === "oplever" ? opleverdatum : draaidag;
  return anker ? plusDagen(anker, st.offset) : null;
}

export function offsetTekst(st) {
  const n = st.offset;
  const anker = st.anker === "oplever" ? "oplevering" : "draaidag";
  if (n === 0) return `op ${anker === "draaidag" ? "de draaidag" : "de opleverdag"}`;
  const d = Math.abs(n) === 1 ? "dag" : "dagen";
  return n < 0 ? `${-n} ${d} vóór ${anker}` : `${n} ${d} na ${anker}`;
}

// ── Project maken ──────────────────────────────────────────────────
// Elke stap wordt een taak in een nieuwe werklijst. Deadlines die al
// voorbij zijn (project laat gestart) komen standaard op vandaag te staan,
// zodat ze in Mijn dag opduiken in plaats van ongemerkt "te laat" te zijn.
export function maakProjectUitSjabloon(sjabloon, { naam, klantId = null, draaidag, opleverdatum, vandaag, verledenNaarVandaag = true, wie = null, nu = Date.now(), nieuwId }) {
  const oplever = opleverdatum || plusDagen(draaidag, sjabloon.standaardDoorlooptijd || 14);
  const items = sorteerStappen(sjabloon.stappen, dagenTussen(draaidag, oplever)).map(st => {
    const sjabloonDatum = stapDatum(st, { draaidag, opleverdatum: oplever });
    let due = sjabloonDatum;
    if (verledenNaarVandaag && due && vandaag && due < vandaag) due = vandaag;
    return {
      id: nieuwId(), name: st.tekst, checked: false, inCart: false, note: "",
      amount: 1, unit: "stuks", category: st.fase, status: null, budget: null,
      dueDate: due, herinnering: null, assignedTo: null, herhaling: null, substappen: [],
      belangrijk: false, mijnDag: null, klantId,
      soort: st.soort, sjabloonStapId: st.id, anker: st.anker, offset: st.offset, sjabloonDatum,
      addedAt: nu, addedBy: wie, lastActionBy: wie, lastActionAt: nu,
    };
  });
  return {
    id: nieuwId(), name: naam, icon: sjabloon.icoon || "🎬", type: "todo",
    categories: FASES.map(f => ({ id: f.id, label: f.label, icon: f.icon })),
    items, history: {}, favorites: [], archief: [], createdAt: nu,
    project: {
      sjabloonId: sjabloon.id, sjabloonNaam: sjabloon.naam, klantId, draaidag, opleverdatum: oplever,
      stapIds: sjabloon.stappen.map(st => st.id), gestartOp: nu, startDatum: vandaag || datumNaarStr(new Date(nu)), geleerdOp: null, afgerond: false,
    },
  };
}

export function registreerGebruik(sjablonen, sjabloonId) {
  return sjablonen.map(t => (t.id === sjabloonId ? { ...t, gebruikt: (t.gebruikt || 0) + 1 } : t));
}

// Draaidag of oplevering verschuift → alle OPEN, aan het sjabloon
// gekoppelde taken met dat anker schuiven evenveel mee.
export function verschuifProject(lijst, { draaidag, opleverdatum }) {
  const p = lijst.project;
  const dDraai = draaidag && p.draaidag ? dagenTussen(p.draaidag, draaidag) : 0;
  const dOplever = opleverdatum && p.opleverdatum ? dagenTussen(p.opleverdatum, opleverdatum) : 0;
  return {
    ...lijst,
    project: { ...p, draaidag: draaidag || p.draaidag, opleverdatum: opleverdatum || p.opleverdatum },
    items: (lijst.items || []).map(i => {
      if (i.checked || !i.dueDate || !i.anker) return i;
      const d = i.anker === "oplever" ? dOplever : dDraai;
      return d ? { ...i, dueDate: plusDagen(i.dueDate, d) } : i;
    }),
  };
}

export function projectVoortgang(lijst) {
  return FASES.map(f => {
    const items = (lijst.items || []).filter(i => i.category === f.id);
    return { ...f, klaar: items.filter(i => i.checked).length, totaal: items.length };
  });
}

// ── Leren van een project ──────────────────────────────────────────
// Geeft een lijst voorstellen terug om het sjabloon bij te werken:
//   toevoegen  — taak die je in het project zelf toevoegde
//   verwijderen — sjabloonstap die je in het project hebt weggehaald
//   wijzigen   — andere naam, soort of fase gegeven
//   timing     — je deed het structureel eerder/later dan het sjabloon zegt
export function berekenLeerVoorstellen(sjabloon, lijst) {
  const p = lijst.project || {};
  const items = lijst.items || [];
  const stapVan = Object.fromEntries((sjabloon.stappen || []).map(st => [st.id, st]));
  const voorstellen = [];

  // Toevoegen
  for (const i of items) {
    if (i.sjabloonStapId || i.bron === "mail" || !FASES.some(f => f.id === i.category)) continue;
    const anker = i.category === "post" && p.opleverdatum ? "oplever" : "draai";
    const ankerDatum = anker === "oplever" ? p.opleverdatum : p.draaidag;
    const offset = i.dueDate && ankerDatum ? dagenTussen(ankerDatum, i.dueDate) : 0;
    voorstellen.push({ id: `toevoegen:${i.id}`, type: "toevoegen", stap: { fase: i.category, soort: i.soort || "taak", tekst: i.name, anker, offset } });
  }

  // Verwijderen
  const aanwezig = new Set(items.map(i => i.sjabloonStapId).filter(Boolean));
  for (const id of p.stapIds || []) {
    if (stapVan[id] && !aanwezig.has(id)) voorstellen.push({ id: `verwijderen:${id}`, type: "verwijderen", stapId: id, tekst: stapVan[id].tekst });
  }

  // Wijzigen + timing
  for (const i of items) {
    const st = stapVan[i.sjabloonStapId];
    if (!st) continue;
    const velden = {};
    if (i.name && i.name.trim() !== st.tekst) velden.tekst = i.name.trim();
    if (i.soort && i.soort !== st.soort && SOORTEN[i.soort]) velden.soort = i.soort;
    if (i.category && i.category !== st.fase && FASES.some(f => f.id === i.category)) velden.fase = i.category;
    if (Object.keys(velden).length) voorstellen.push({ id: `wijzigen:${st.id}`, type: "wijzigen", stapId: st.id, oud: st, velden });

    const werkelijk = werkelijkeOffset(i, st, p);
    if (werkelijk == null) continue;
    const eerder = (sjabloon.geleerd?.[st.id]?.offsets || []);
    const reeks = [...eerder, werkelijk].slice(-BEWAAR_TIMINGS);
    const voorstel = mediaan(reeks);
    const verschil = voorstel - st.offset;
    const genoeg = (reeks.length >= 2 && Math.abs(verschil) >= 2) || (reeks.length === 1 && Math.abs(verschil) >= 4);
    if (genoeg) {
      voorstellen.push({ id: `timing:${st.id}`, type: "timing", stapId: st.id, tekst: velden.tekst || st.tekst, anker: st.anker, van: st.offset, naar: voorstel, aantalProjecten: reeks.length });
    }
  }
  return voorstellen;
}

// Wanneer rondde je deze stap werkelijk af, t.o.v. het anker van dít
// project? (null als de taak nog open is of geen afrondmoment heeft.)
// Niet meetellen (dat zegt niets over hoe je normaal werkt):
//  • stappen die bij de start van het project al in het verleden lagen
//    (project laat gestart → noodgedwongen later gedaan);
//  • stappen die je op de startdag zelf afvinkte (al geregeld vóór je het
//    project in de app zette).
export function werkelijkeOffset(item, stap, project) {
  if (!item.checked || !item.voltooidOp) return null;
  const voltooid = datumNaarStr(new Date(item.voltooidOp));
  if (project.startDatum && item.sjabloonDatum && item.sjabloonDatum < project.startDatum) return null;
  if (project.startDatum && voltooid === project.startDatum) return null;
  const ankerDatum = stap.anker === "oplever" ? project.opleverdatum : project.draaidag;
  if (!ankerDatum) return null;
  return dagenTussen(ankerDatum, voltooid);
}

// Past de gekozen voorstellen toe en legt ALTIJD de werkelijke timing vast
// (ook van stappen waarvoor nu geen voorstel is), zodat het sjabloon bij
// elk volgend project beter weet hoe jij werkt.
export function pasLeerVoorstellenToe(sjabloon, lijst, voorstellen, gekozenIds, nieuwId, { metTiming = true } = {}) {
  const gekozen = new Set(gekozenIds);
  const p = lijst.project || {};
  let stappen = [...sjabloon.stappen];
  const geleerd = { ...(sjabloon.geleerd || {}) };

  // metTiming=false: dit project is al eens "geleerd" — dan de timing niet
  // nóg een keer meetellen (anders weegt één project dubbel).
  for (const i of metTiming ? lijst.items || [] : []) {
    const st = stappen.find(x => x.id === i.sjabloonStapId);
    if (!st) continue;
    const w = werkelijkeOffset(i, st, p);
    if (w == null) continue;
    const vorig = geleerd[st.id]?.offsets || [];
    geleerd[st.id] = { offsets: [...vorig, w].slice(-BEWAAR_TIMINGS) };
  }

  for (const v of voorstellen) {
    if (!gekozen.has(v.id)) continue;
    if (v.type === "toevoegen") stappen.push(normaliseerStap(v.stap, nieuwId));
    if (v.type === "verwijderen") { stappen = stappen.filter(st => st.id !== v.stapId); delete geleerd[v.stapId]; }
    if (v.type === "wijzigen") stappen = stappen.map(st => (st.id === v.stapId ? normaliseerStap({ ...st, ...v.velden }, nieuwId) : st));
    if (v.type === "timing") stappen = stappen.map(st => (st.id === v.stapId ? { ...st, offset: v.naar } : st));
  }

  return {
    ...sjabloon,
    stappen: sorteerStappen(stappen, sjabloon.standaardDoorlooptijd || 14),
    geleerd,
    geleerdVan: (sjabloon.geleerdVan || 0) + (metTiming ? 1 : 0),
    bijgewerktOp: Date.now(),
  };
}

// Hint in de sjablooneditor: hoe deed je deze stap de vorige keren?
export function timingHint(sjabloon, stapId) {
  const offsets = sjabloon.geleerd?.[stapId]?.offsets || [];
  if (!offsets.length) return null;
  const m = mediaan(offsets);
  return { mediaan: m, aantal: offsets.length };
}
