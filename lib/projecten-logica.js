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
    standaardOnderdelen: ["kickoff", "callsheets", "snacks", "crew-camera-assistent", "crew-geluid", "loc-interieur"],
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
    standaardOnderdelen: ["kickoff", "ppm", "ppm-document", "callsheets", "catering", "snacks", "acteurs", "loc-exterieur", "loc-interieur", "props", "verzekering",
      "crew-regie", "crew-camera", "crew-camera-assistent", "crew-geluid", "crew-opnameleider", "crew-producer",
      "crew-productie-assistent", "crew-art-director", "crew-visagie", "crew-stylist", "crew-gripper", "crew-belichter", "crew-data-handler"],
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
    if (i.sjabloonStapId || i.onderdeelId || i.offerteNavraag || i.bron === "mail" || !FASES.some(f => f.id === i.category)) continue;
    const anker = i.category === "post" && p.opleverdatum ? "oplever" : "draai";
    const ankerDatum = anker === "oplever" ? p.opleverdatum : p.draaidag;
    const offset = i.dueDate && ankerDatum ? dagenTussen(ankerDatum, i.dueDate) : 0;
    voorstellen.push({ id: `toevoegen:${i.id}`, type: "toevoegen", stap: { fase: i.category, soort: i.soort || "taak", tekst: i.name, anker, offset } });
  }

  // Verwijderen
  const aanwezig = new Set(items.map(i => i.sjabloonStapId).filter(Boolean));
  const uitgezet = new Set(p.uitgezetteStapIds || []); // via onderdelen uitgezet ≠ "niet meer nodig"
  for (const id of p.stapIds || []) {
    if (stapVan[id] && !aanwezig.has(id) && !uitgezet.has(id)) voorstellen.push({ id: `verwijderen:${id}`, type: "verwijderen", stapId: id, tekst: stapVan[id].tekst });
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

// ════════════════════════════════════════════════════════════════════
// OFFERTES — een offerte versturen betekent nog niet dat het doorgaat.
// Een project begint daarom (optioneel) als "offerte": één terugkerende
// taak "Offerte navragen" met een wekelijkse herinnering. Vink je die af
// ("nagevraagd"), dan komt hij vanzelf een week later terug. Pas bij
// akkoord worden de productietaken uit het sjabloon aangemaakt; bij
// afwijzing gaat het project naar het archief.
//   project.status: "offerte" | "lopend" | "afgewezen"
//   (oudere projecten zonder status tellen als "lopend")
// ════════════════════════════════════════════════════════════════════
export function projectStatus(lijst) {
  return lijst?.project?.status || (lijst?.project ? "lopend" : null);
}

// Eerste navraagmoment: `weken` na versturen, maar nooit in het verleden
// (een offerte die je achteraf invoert, krijgt vandaag z'n eerste vraag).
export function eersteNavraagDatum(verstuurdOp, vandaag, weken = 1) {
  const d = plusDagen(verstuurdOp, 7 * weken);
  return d < vandaag ? vandaag : d;
}

export function maakOfferte({ naam, klantId = null, verstuurdOp, bedrag = null, notitie = "", weken = 1, tijd = "10:00", vandaag, wie = null, nu = Date.now(), nieuwId }) {
  const due = eersteNavraagDatum(verstuurdOp, vandaag, weken);
  const navraag = {
    id: nieuwId(), name: `Offerte navragen: ${naam}`, checked: false, inCart: false,
    note: [bedrag ? `Offertebedrag: € ${Number(bedrag).toLocaleString("nl-NL")}` : "", notitie].filter(Boolean).join("\n"),
    amount: 1, unit: "stuks", category: "pre", status: null, budget: null,
    dueDate: due, herinnering: `${due}T${tijd}`, assignedTo: null,
    herhaling: { freq: "week", interval: Math.max(1, Math.round(weken)) },
    substappen: [], belangrijk: false, mijnDag: null, klantId,
    soort: "regelen", offerteNavraag: true,
    addedAt: nu, addedBy: wie, lastActionBy: wie, lastActionAt: nu,
  };
  return {
    id: nieuwId(), name: naam, icon: "📨", type: "todo",
    categories: FASES.map(f => ({ id: f.id, label: f.label, icon: f.icon })),
    items: [navraag], history: {}, favorites: [], archief: [], createdAt: nu,
    project: {
      status: "offerte", klantId, afgerond: false, gestartOp: nu,
      offerte: { verstuurdOp, bedrag: bedrag ? Number(bedrag) : null, keerNagevraagd: 0 },
    },
  };
}

// Stappen die bij akkoord al gedaan zijn (offerte opstellen, akkoord
// vragen). Eigen sjablonen kunnen dat met `bijAkkoordKlaar` aangeven;
// anders herkennen we ze aan de tekst in de pre-productie.
export function isOfferteStap(st) {
  if (typeof st.bijAkkoordKlaar === "boolean") return st.bijAkkoordKlaar;
  return st.fase === "pre" && /offerte|akkoord/i.test(st.tekst || "");
}

// Akkoord! Productietaken uit het sjabloon toevoegen aan dezelfde lijst.
// De navraagtaak verdwijnt, eigen notities/taken die je tijdens de
// offertefase toevoegde blijven staan, offerte-stappen staan meteen op klaar
// (op de startdag afgevinkt → tellen niet mee voor het leren van timing).
export function offerteAkkoord(lijst, sjabloon, { draaidag, opleverdatum, akkoordOp, vandaag, verledenNaarVandaag = true, wie = null, nu = Date.now(), nieuwId }) {
  const nieuw = maakProjectUitSjabloon(sjabloon, {
    naam: lijst.name, klantId: lijst.project?.klantId || null, draaidag, opleverdatum, vandaag, verledenNaarVandaag, wie, nu, nieuwId,
  });
  const stapVan = Object.fromEntries(sjabloon.stappen.map(st => [st.id, st]));
  const taken = nieuw.items.map(i => (isOfferteStap(stapVan[i.sjabloonStapId] || {})
    ? { ...i, checked: true, voltooidOp: nu, lastActionBy: wie, lastActionAt: nu }
    : i));
  const eigen = (lijst.items || []).filter(i => !i.offerteNavraag);
  return {
    ...lijst,
    icon: sjabloon.icoon || lijst.icon,
    categories: nieuw.categories,
    items: [...taken, ...eigen],
    project: {
      ...nieuw.project,
      status: "lopend",
      offerte: { ...(lijst.project?.offerte || {}), akkoordOp: akkoordOp || vandaag },
    },
  };
}

export function offerteAfgewezen(lijst, { datum, reden = "" }) {
  return {
    ...lijst,
    items: (lijst.items || []).filter(i => !i.offerteNavraag),
    project: {
      ...lijst.project, status: "afgewezen", afgerond: true,
      offerte: { ...(lijst.project?.offerte || {}), afgewezenOp: datum, reden: String(reden || "").slice(0, 300) },
    },
  };
}

// Nagevraagd: navraagtaak schuift een periode door (zoals afvinken van
// een herhalende taak) en we tellen hoe vaak je al hebt nagevraagd.
export function offerteNagevraagd(lijst, vandaag) {
  return {
    ...lijst,
    project: { ...lijst.project, offerte: { ...(lijst.project?.offerte || {}), keerNagevraagd: (lijst.project?.offerte?.keerNagevraagd || 0) + 1, laatstNagevraagd: vandaag } },
  };
}

export function offerteStatistiek(lijsten) {
  const met = (lijsten || []).filter(l => l.project?.offerte?.verstuurdOp);
  const akkoord = met.filter(l => l.project.offerte.akkoordOp);
  const afgewezen = met.filter(l => l.project.offerte.afgewezenOp);
  const open = met.filter(l => projectStatus(l) === "offerte");
  const doorloop = akkoord.map(l => dagenTussen(l.project.offerte.verstuurdOp, l.project.offerte.akkoordOp)).filter(n => n >= 0);
  const beslist = akkoord.length + afgewezen.length;
  return {
    open: open.length, akkoord: akkoord.length, afgewezen: afgewezen.length,
    scoringPct: beslist ? Math.round((100 * akkoord.length) / beslist) : null,
    mediaanDagenTotAkkoord: mediaan(doorloop),
  };
}

// ════════════════════════════════════════════════════════════════════
// ONDERDELEN — wat er per productie nodig is, met één tik aan of uit.
// Niet elke productie heeft cast, een hotel of een gripper nodig. Wat aan
// staat wordt een taak (met deelstappen); crew wordt één taak "Crew boeken"
// met een deelstap per rol. Aan/uit kan bij de start én tijdens het project.
// Staat er in het sjabloon al een passende stap (bv. "Productieverzekering
// regelen"), dan wordt díe gebruikt in plaats van een dubbele taak.
// ════════════════════════════════════════════════════════════════════
export const ONDERDELEN = [
  { groep: "Planning", icon: "🗓️", items: [
    { id: "kickoff", label: "Kickoff-meeting", taak: "Kickoff-meeting", soort: "taak", meeting: true, geenNamen: true },
    { id: "ppm", label: "PPM (pre-productiemeeting)", taak: "PPM (pre-productiemeeting)", soort: "taak", meeting: true, geenNamen: true, matcht: /\bppm\b|pre-?productie-?meeting/i },
  ] },
  { groep: "Productie", icon: "📋", items: [
    { id: "ppm-document", label: "PPM opstellen", taak: "PPM-document opstellen", soort: "document", offset: -8, geenNamen: true,
      stappen: ["Planning en draaischema", "Cast, locaties en styling", "Shotlist / storyboard", "Naar klant sturen"] },
    { id: "callsheets", label: "Callsheets maken", taak: "Callsheets maken", soort: "document", offset: -2, geenNamen: true, matcht: /callsheet/i,
      stappen: ["Tijden en adressen", "Crew en cast met telefoonnummers", "Parkeren, catering, weer", "Doorsturen"] },
    { id: "catering", label: "Catering", taak: "Catering regelen", soort: "regelen", offset: -7, matcht: /catering/i,
      stappen: ["Aantal personen + dieetwensen", "Bestellen", "Tijden doorgeven"] },
    { id: "snacks", label: "Snacks op de set", taak: "Snacks en drinken voor op de set", soort: "regelen", offset: -1,
      stappen: ["Boodschappenlijst", "Halen of laten bezorgen"] },
  ] },
  { groep: "Cast", icon: "🎭", items: [
    { id: "acteurs", label: "Acteurs", taak: "Acteurs casten en boeken", soort: "persoon", offset: -21, matcht: /\bcast(ing)?\b/i,
      stappen: ["Castingbureau of oproep", "Selectie met regie en klant", "Boeken + contract", "Quitclaims / model releases"] },
    { id: "edelfiguranten", label: "Edelfiguranten", taak: "Edelfiguranten regelen", soort: "persoon", offset: -14,
      stappen: ["Profielen bepalen", "Selectie en boeken", "Quitclaims"] },
    { id: "figuranten", label: "Figuranten", taak: "Figuranten regelen", soort: "persoon", offset: -10,
      stappen: ["Aantal en profiel bepalen", "Oproep of bureau", "Bevestigen + callsheet sturen"] },
  ] },
  { groep: "Locaties", icon: "📍", items: [
    { id: "loc-exterieur", label: "Exterieur", taak: "Locatie exterieur regelen", soort: "regelen", offset: -21,
      stappen: ["Scouten + foto's naar klant", "Toestemming eigenaar", "Draaivergunning gemeente", "Parkeren / laden en lossen"] },
    { id: "loc-interieur", label: "Interieur", taak: "Locatie interieur regelen", soort: "regelen", offset: -14,
      stappen: ["Scouten + foto's naar klant", "Locatiecontract", "Stroom, geluid en daglicht checken"] },
  ] },
  { groep: "Art", icon: "🎨", items: [
    { id: "props", label: "Props", taak: "Props regelen", soort: "regelen", offset: -7, stappen: ["Propslijst maken", "Huren / kopen", "Ophalen en retour"] },
    { id: "decor", label: "Decor", taak: "Decor regelen", soort: "regelen", offset: -10, stappen: ["Ontwerp / referenties", "Bouw of huur", "Op- en afbouw plannen"] },
  ] },
  { groep: "Crew", icon: "👥", crew: true, items: [
    { id: "crew-regie", label: "Regie" },
    { id: "crew-camera", label: "Camera" },
    { id: "crew-camera-assistent", label: "Camera-assistent" },
    { id: "crew-geluid", label: "Geluid" },
    { id: "crew-opnameleider", label: "Opnameleider" },
    { id: "crew-producer", label: "Producer" },
    { id: "crew-productie-assistent", label: "Productie-assistent" },
    { id: "crew-art-director", label: "Art director" },
    { id: "crew-visagie", label: "Visagie" },
    { id: "crew-stylist", label: "Stylist" },
    { id: "crew-gripper", label: "Gripper" },
    { id: "crew-belichter", label: "Belichter" },
    { id: "crew-data-handler", label: "Data handler" },
  ] },
  { groep: "Overig", icon: "🧳", items: [
    { id: "hotel", label: "Hotel", taak: "Hotel boeken", soort: "regelen", offset: -14, stappen: ["Aantal kamers en nachten", "Boeken", "Gegevens in de callsheet"] },
    { id: "verzekering", label: "Productieverzekering", taak: "Productieverzekering regelen", soort: "regelen", offset: -14, matcht: /verzekering/i },
  ] },
];
const CREW_TAAK = { id: "crew", taak: "Crew boeken", soort: "persoon", offset: -14, matcht: /\bcrew\b/i };
const alleOnderdelen = () => ONDERDELEN.flatMap(g => g.items.map(i => ({ ...i, crew: !!g.crew })));
export const onderdeelVan = (id) => alleOnderdelen().find(o => o.id === id);

// Welke onderdelen staan standaard aan? Eerst wat je de vorige keer bij dit
// sjabloon koos (zelflerend), anders de vaste standaard van het sjabloon,
// anders: wat het sjabloon zelf al noemt + kickoff en PPM.
export function standaardOnderdelen(sjabloon) {
  if (Array.isArray(sjabloon?.laatsteOnderdelen)) return sjabloon.laatsteOnderdelen;
  if (Array.isArray(sjabloon?.standaardOnderdelen)) return sjabloon.standaardOnderdelen;
  const teksten = (sjabloon?.stappen || []).map(s => s.tekst).join(" | ");
  return ["kickoff", "ppm", ...alleOnderdelen().filter(o => o.matcht && o.matcht.test(teksten)).map(o => o.id)]
    .filter((id, i, a) => a.indexOf(id) === i);
}

function tijdMin(tijd, minuten) {
  const [u, m] = String(tijd || "10:00").split(":").map(Number);
  const t = Math.max(0, u * 60 + m - minuten);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
export function standaardMeetings({ draaidag, vandaag, bestaand = {} }) {
  return {
    kickoff: bestaand.kickoff || { datum: plusDagen(vandaag, 2), tijd: "10:00" },
    ppm: bestaand.ppm || { datum: draaidag ? (plusDagen(draaidag, -5) < vandaag ? vandaag : plusDagen(draaidag, -5)) : null, tijd: "10:00" },
  };
}

// Zet de gekozen onderdelen in het project om in taken (idempotent: je kunt
// dit telkens opnieuw doen met een andere keuze). Uitzetten haalt alleen
// OPEN taken weg; wat al gedaan is blijft staan.
export function pasOnderdelenToe(lijst, gekozenIds, { draaidag, vandaag, meetings = {}, verledenNaarVandaag = true, wie = null, nu = Date.now(), nieuwId }) {
  const gekozen = new Set(gekozenIds);
  const p = lijst.project || {};
  const dag = draaidag || p.draaidag;
  let items = [...(lijst.items || [])];
  const uitgezet = new Set(p.uitgezetteStapIds || []);

  // 1. Passende sjabloonstappen koppelen aan een onderdeel (eenmalig).
  for (const o of [...alleOnderdelen().filter(x => x.matcht && !x.crew), CREW_TAAK]) {
    if (items.some(i => i.onderdeelId === o.id)) continue;
    const idx = items.findIndex(i => i.sjabloonStapId && !i.onderdeelId && o.matcht.test(i.name || ""));
    if (idx >= 0) items[idx] = { ...items[idx], onderdeelId: o.id };
  }

  const datumVoor = (offset) => {
    if (!dag) return null;
    const d = plusDagen(dag, offset);
    return verledenNaarVandaag && vandaag && d < vandaag ? vandaag : d;
  };
  const maakTaak = (velden) => ({
    id: nieuwId(), checked: false, inCart: false, note: "", amount: 1, unit: "stuks", category: "pre", status: null, budget: null,
    herinnering: null, assignedTo: null, herhaling: null, substappen: [], belangrijk: false, mijnDag: null,
    klantId: p.klantId || null, addedAt: nu, addedBy: wie, lastActionBy: wie, lastActionAt: nu, ...velden,
  });
  const weg = (pred) => {
    items = items.filter(i => {
      if (!pred(i) || i.checked) return true;
      if (i.sjabloonStapId) uitgezet.add(i.sjabloonStapId);
      return false;
    });
  };

  // 2. Losse onderdelen (alles behalve crew-rollen).
  for (const o of alleOnderdelen().filter(x => !x.crew)) {
    const bestaand = items.find(i => i.onderdeelId === o.id);
    if (!gekozen.has(o.id)) { if (bestaand) weg(i => i.onderdeelId === o.id); continue; }
    if (bestaand && bestaand.sjabloonStapId) uitgezet.delete(bestaand.sjabloonStapId);
    if (o.meeting) {
      const m = meetings[o.id] || {};
      const velden = m.datum
        ? { dueDate: m.datum, herinnering: `${m.datum}T${tijdMin(m.tijd, 60)}`, note: `Om ${m.tijd || "10:00"}` }
        : { dueDate: null, herinnering: null };
      if (bestaand) items = items.map(i => (i.id === bestaand.id && !i.checked ? { ...i, ...velden } : i));
      else items.push(maakTaak({ name: o.taak, soort: o.soort, onderdeelId: o.id, ...velden }));
      continue;
    }
    if (bestaand) continue;
    items.push(maakTaak({
      name: o.taak, soort: o.soort, onderdeelId: o.id, dueDate: datumVoor(o.offset), anker: "draai", offset: o.offset,
      substappen: (o.stappen || []).map(t => ({ id: nieuwId(), tekst: t, afgevinkt: false })),
    }));
  }

  // 3. Crew: één taak, deelstap per gekozen rol (bestaande vinkjes blijven).
  const rollen = alleOnderdelen().filter(x => x.crew && gekozen.has(x.id));
  const crew = items.find(i => i.onderdeelId === "crew");
  if (!rollen.length) {
    if (crew) weg(i => i.onderdeelId === "crew");
  } else {
    const basis = crew || maakTaak({ name: CREW_TAAK.taak, soort: CREW_TAAK.soort, onderdeelId: "crew", dueDate: datumVoor(CREW_TAAK.offset), anker: "draai", offset: CREW_TAAK.offset });
    const huidig = basis.substappen || [];
    const subs = [
      ...huidig.filter(s => !s.rolId),                                   // zelf toegevoegde stappen
      ...rollen.map(r => huidig.find(s => s.rolId === r.id) || { id: nieuwId(), tekst: r.label, afgevinkt: false, rolId: r.id }),
    ];
    const bijgewerkt = { ...basis, substappen: subs };
    if (crew) { items = items.map(i => (i.id === crew.id ? bijgewerkt : i)); if (crew.sjabloonStapId) uitgezet.delete(crew.sjabloonStapId); }
    else items.push(bijgewerkt);
  }

  return {
    ...lijst,
    items,
    project: { ...p, onderdelen: [...gekozen], meetings: { ...(p.meetings || {}), ...meetings }, uitgezetteStapIds: [...uitgezet] },
  };
}

// Hoeveel open taken verdwijnen er als je deze keuze toepast? (Voor een
// waarschuwing vóór het uitzetten.)
export function telVerdwijnendeTaken(lijst, gekozenIds) {
  const gekozen = new Set(gekozenIds);
  const crewAan = alleOnderdelen().some(o => o.crew && gekozen.has(o.id));
  return (lijst.items || []).filter(i => i.onderdeelId && !i.checked && (i.onderdeelId === "crew" ? !crewAan : !gekozen.has(i.onderdeelId))).length;
}

// ════════════════════════════════════════════════════════════════════
// BEZETTING — namen per onderdeel, met status en prijsafspraak.
// Per onderdeel (of crew-rol) kunnen meerdere namen: 3 figuranten, 2
// locaties, 2 camera-mensen. Elke naam: status (optie → aangevraagd →
// bevestigd), prijs + eenheid, notitie (telefoon, e-mail…).
// Het CONTACTENBOEK onthoudt namen en de laatste prijsafspraak per rol,
// zodat de app ze bij een volgend project voorstelt (zelflerend).
// ════════════════════════════════════════════════════════════════════
export const BEZETTING_STATUS = [
  { id: "optie", label: "Optie" },
  { id: "aangevraagd", label: "Aangevraagd" },
  { id: "bevestigd", label: "Bevestigd" },
];
export const EENHEDEN = [
  { id: "dag", label: "per dag" },
  { id: "totaal", label: "totaal" },
  { id: "uur", label: "per uur" },
  { id: "stuk", label: "per stuk" },
];

export function nieuweBezetting(velden, nieuwId) {
  return { id: nieuwId(), onderdeelId: null, naam: "", status: "optie", bedrag: null, eenheid: "dag", notitie: "", contactId: null, ...velden };
}

export function leesBedragInvoer(invoer) {
  let t = String(invoer ?? "").trim().replace(/[€\s]/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

// Crew-rollen: een deelstap is "klaar" zodra er namen zijn én die allemaal
// bevestigd zijn. Zonder namen blijft een handmatig vinkje staan.
export function synchroniseerCrewStappen(item) {
  if (item.onderdeelId !== "crew") return item;
  const b = item.bezetting || [];
  return {
    ...item,
    substappen: (item.substappen || []).map(s => {
      if (!s.rolId) return s;
      const van = b.filter(x => x.onderdeelId === s.rolId && x.naam);
      return van.length ? { ...s, afgevinkt: van.every(x => x.status === "bevestigd") } : s;
    }),
  };
}

export function bezettingSamenvatting(items) {
  const alle = (items || []).flatMap(i => (i.bezetting || []).filter(b => b.naam));
  const perEenheid = {};
  for (const b of alle) if (b.bedrag != null) perEenheid[b.eenheid || "totaal"] = Math.round(((perEenheid[b.eenheid || "totaal"] || 0) + b.bedrag) * 100) / 100;
  return { aantal: alle.length, bevestigd: alle.filter(b => b.status === "bevestigd").length, perEenheid };
}

const naamSleutel = (n) => String(n || "").trim().toLowerCase().replace(/\s+/g, " ");

// Een ingevulde naam onthouden in het contactenboek (of bijwerken):
// bij welke rollen je deze persoon/dit bedrijf inzet, in welke projecten,
// en de laatste prijsafspraak per rol (+ korte historie).
export function onthoudContact(contacten, bezetting, { projectId, projectNaam, datum, nieuwId }) {
  const naam = String(bezetting.naam || "").trim();
  if (!naam) return { contacten, contactId: null };
  const lijst = [...(contacten || [])];
  let idx = lijst.findIndex(c => (bezetting.contactId && c.id === bezetting.contactId) || naamSleutel(c.naam) === naamSleutel(naam));
  const basis = idx >= 0 ? lijst[idx] : { id: nieuwId(), naam, rollen: [], projecten: [], prijzen: {}, notitie: "" };
  const prijzen = { ...(basis.prijzen || {}) };
  if (bezetting.bedrag != null && bezetting.onderdeelId) {
    const vorige = prijzen[bezetting.onderdeelId];
    const nieuw = { bedrag: bezetting.bedrag, eenheid: bezetting.eenheid || "dag", datum, project: projectNaam || null };
    const zelfde = vorige && vorige.bedrag === nieuw.bedrag && vorige.eenheid === nieuw.eenheid && vorige.project === nieuw.project;
    prijzen[bezetting.onderdeelId] = zelfde ? vorige : { ...nieuw, historie: [...(vorige?.historie || []), ...(vorige ? [{ bedrag: vorige.bedrag, eenheid: vorige.eenheid, datum: vorige.datum, project: vorige.project }] : [])].slice(-8) };
  }
  const bijgewerkt = {
    ...basis,
    naam: basis.naam || naam,
    rollen: bezetting.onderdeelId && !basis.rollen.includes(bezetting.onderdeelId) ? [...basis.rollen, bezetting.onderdeelId] : basis.rollen,
    projecten: projectId && !basis.projecten.includes(projectId) ? [...basis.projecten, projectId] : basis.projecten,
    notitie: bezetting.notitie && !basis.notitie ? bezetting.notitie : basis.notitie,
    prijzen,
    laatstGebruikt: datum,
  };
  if (idx >= 0) lijst[idx] = bijgewerkt; else lijst.push(bijgewerkt);
  return { contacten: lijst, contactId: bijgewerkt.id };
}

// Suggesties tijdens het typen: eerst wie je eerder voor DEZE rol inzette,
// dan de rest; vaker gebruikt eerst. Met de laatste prijs voor deze rol.
export function contactSuggesties(contacten, onderdeelId, zoek = "", max = 8) {
  const z = naamSleutel(zoek);
  return (contacten || [])
    .filter(c => !z || naamSleutel(c.naam).includes(z))
    .map(c => ({ ...c, zelfdeRol: (c.rollen || []).includes(onderdeelId), laatstePrijs: c.prijzen?.[onderdeelId] || null }))
    .sort((a, b) => (b.zelfdeRol - a.zelfdeRol) || ((b.projecten || []).length - (a.projecten || []).length) || a.naam.localeCompare(b.naam, "nl"))
    .slice(0, max);
}

export function prijsTekst(bedrag, eenheid) {
  if (bedrag == null) return "";
  const e = EENHEDEN.find(x => x.id === eenheid);
  return `€ ${Number(bedrag).toLocaleString("nl-NL", { minimumFractionDigits: bedrag % 1 ? 2 : 0, maximumFractionDigits: 2 })}${e && e.id !== "totaal" ? ` ${e.label}` : ""}`;
}
