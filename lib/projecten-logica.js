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
    standaardOnderdelen: ["kickoff", "callsheets", "snacks", "crew-camera-assistent", "crew-geluid", "loc-interieur",
      "edit-v1", "edit-v2", "kleurcorrectie", "afmixen"],
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
      "crew-productie-assistent", "crew-art-director", "crew-visagie", "crew-stylist", "crew-gripper", "crew-belichter", "crew-data-handler",
      "edit-v1", "edit-v2", "edit-lock", "grading", "sound-effects", "muziek-stock", "afmixen"],
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

// ── Weekend ────────────────────────────────────────────────────────
// Za en zo zijn normaal geen werkdagen. Een geplande deadline die in het
// weekend valt, schuift naar een werkdag: vóór het anker (draaidag/
// oplevering) naar de vrijdag ervoor, ná het anker naar de maandag erna.
// De draaidag en oplevering zelf kies je bewust — die blijven staan.
export function isWeekend(datum) {
  if (!datum) return false;
  const g = new Date(`${datum}T12:00:00`).getDay();
  return g === 0 || g === 6;
}
export function naarWerkdag(datum, richting = -1) {
  if (!datum) return datum;
  let d = datum;
  for (let i = 0; i < 3 && isWeekend(d); i++) d = plusDagen(d, richting < 0 ? -1 : 1);
  return d;
}
// Werkdag, maar nooit vóór vandaag (dan de eerstvolgende werkdag vanaf vandaag).
export function werkdagVanaf(datum, vandaag, richting = -1) {
  if (!datum) return datum;
  let d = naarWerkdag(datum, richting);
  if (vandaag && d < vandaag) d = datum < vandaag ? vandaag : naarWerkdag(datum, 1);
  return d;
}

export function stapDatum(st, { draaidag, opleverdatum }) {
  const anker = st.anker === "oplever" ? opleverdatum : draaidag;
  if (!anker) return null;
  const d = plusDagen(anker, st.offset);
  return st.offset ? naarWerkdag(d, st.offset < 0 ? -1 : 1) : d;
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
// `planAanpassing`: { [stapId]: { datum } | { weg: true } } — zelf aangepaste
// datums of overgeslagen stappen uit het planningsoverzicht.
export function maakProjectUitSjabloon(sjabloon, { naam, klantId = null, draaidag, opleverdatum, vandaag, verledenNaarVandaag = true, offerteAlGedaan = false, opdrachtVia = "", planAanpassing = {}, wie = null, nu = Date.now(), nieuwId }) {
  const oplever = opleverdatum || plusDagen(draaidag, sjabloon.standaardDoorlooptijd || 14);
  const items = sorteerStappen(sjabloon.stappen, dagenTussen(draaidag, oplever)).filter(st => !planAanpassing?.[st.id]?.weg).map(st => {
    const sjabloonDatum = stapDatum(st, { draaidag, opleverdatum: oplever });
    const eigen = planAanpassing?.[st.id]?.datum || null;
    let due = eigen || sjabloonDatum;
    if (!eigen && verledenNaarVandaag && due && vandaag && due < vandaag) due = vandaag;
    return {
      id: nieuwId(), name: st.tekst, checked: false, inCart: false, note: "",
      amount: 1, unit: "stuks", category: st.fase, status: null, budget: null,
      dueDate: due, herinnering: null, assignedTo: null, herhaling: null, substappen: [],
      belangrijk: false, mijnDag: null, klantId,
      soort: st.soort, sjabloonStapId: st.id, anker: st.anker, offset: st.offset, sjabloonDatum,
      ...(eigen ? { datumHandmatig: true } : {}),
      addedAt: nu, addedBy: wie, lastActionBy: wie, lastActionAt: nu,
      // Offerte niet door mij gedaan → offerte-/akkoordstappen staan al op klaar.
      ...(offerteAlGedaan && isOfferteStap(st) ? { checked: true, voltooidOp: nu } : {}),
    };
  });
  return {
    id: nieuwId(), name: naam, icon: sjabloon.icoon || "🎬", type: "todo",
    categories: FASES.map(f => ({ id: f.id, label: f.label, icon: f.icon })),
    items, history: {}, favorites: [], archief: [], createdAt: nu,
    project: {
      sjabloonId: sjabloon.id, sjabloonNaam: sjabloon.naam, klantId, draaidag, opleverdatum: oplever,
      stapIds: sjabloon.stappen.map(st => st.id), gestartOp: nu, startDatum: vandaag || datumNaarStr(new Date(nu)), geleerdOp: null, afgerond: false,
      ...(offerteAlGedaan ? { offerteNietDoorMij: true } : {}),
      ...(String(opdrachtVia || "").trim() ? { opdrachtVia: String(opdrachtVia).trim().slice(0, 80) } : {}),
    },
  };
}

// Los project: zonder sjabloon en zonder offertefase (bv. een productie die
// je oppakt terwijl iemand anders de offerte deed). Datums mogen leeg zijn.
export function maakLosProject({ naam, klantId = null, draaidag = null, opleverdatum = null, opdrachtVia = "", budget = null, vandaag, wie = null, nu = Date.now(), nieuwId }) {
  const b = budget === "" || budget == null || !Number.isFinite(Number(budget)) ? null : Number(budget);
  return {
    id: nieuwId(), name: String(naam || "").trim() || "Nieuw project", icon: "📂", type: "todo",
    categories: FASES.map(f => ({ id: f.id, label: f.label, icon: f.icon })),
    items: [], history: {}, favorites: [], archief: [], createdAt: nu,
    project: {
      los: true, sjabloonId: null, sjabloonNaam: null, klantId: klantId || null,
      draaidag: draaidag || null, opleverdatum: opleverdatum && (!draaidag || opleverdatum >= draaidag) ? opleverdatum : null,
      stapIds: [], gestartOp: nu, startDatum: vandaag || datumNaarStr(new Date(nu)), geleerdOp: null, afgerond: false,
      status: "lopend", offerteNietDoorMij: true,
      ...(String(opdrachtVia || "").trim() ? { opdrachtVia: String(opdrachtVia).trim().slice(0, 80) } : {}),
      ...(b != null && b > 0 ? { budget: b } : {}),
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
    project: {
      ...p, draaidag: draaidag || p.draaidag, opleverdatum: opleverdatum || p.opleverdatum,
      // Meerdere draaidagen schuiven als blok mee met de eerste.
      ...(Array.isArray(p.draaidagen) && dDraai ? { draaidagen: p.draaidagen.map(d => ({ ...d, datum: plusDagen(d.datum, dDraai) })) } : {}),
    },
    items: (lijst.items || []).map(i => {
      if (i.checked || !i.dueDate || !i.anker) return i;
      const d = i.anker === "oplever" ? dOplever : dDraai;
      if (!d) return i;
      const oudAnker = i.anker === "oplever" ? p.opleverdatum : p.draaidag;
      const nieuwAnker = i.anker === "oplever" ? (opleverdatum || p.opleverdatum) : (draaidag || p.draaidag);
      const off = Number(i.offset) || 0;
      const reken = (a) => (off ? naarWerkdag(plusDagen(a, off), off < 0 ? -1 : 1) : a);
      // Nog op de berekende datum → opnieuw berekenen vanaf het nieuwe anker
      // (dan klopt ook de weekendcorrectie). Zelf aangepast → evenveel mee.
      if (!i.datumHandmatig && oudAnker && (i.dueDate === reken(oudAnker) || i.dueDate === plusDagen(oudAnker, off))) return { ...i, dueDate: reken(nieuwAnker) };
      return { ...i, dueDate: off ? naarWerkdag(plusDagen(i.dueDate, d), off < 0 ? -1 : 1) : plusDagen(i.dueDate, d) };
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
    if (i.sjabloonStapId || i.onderdeelId || i.eigenPlanningId || i.buyoutKey || i.offerteNavraag || i.draaidagId || i.opzetTaak || i.aanvraagTaak || i.bron === "mail" || !FASES.some(f => f.id === i.category)) continue;
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
    // "Draaidag 1/2…" is een automatische naam bij meerdere draaidagen, geen hernoeming.
    if (i.name && i.name.trim() !== st.tekst && !i.draaidagId) velden.tekst = i.name.trim();
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
  const d = naarWerkdag(plusDagen(verstuurdOp, 7 * weken), 1);
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
  const eigen = (lijst.items || []).filter(i => !i.offerteNavraag)
    .map(i => (i.aanvraagTaak && !i.checked ? { ...i, checked: true, voltooidOp: nu, lastActionBy: wie, lastActionAt: nu } : i));
  const oudP = lijst.project || {};
  return {
    ...lijst,
    icon: sjabloon.icoon || lijst.icon,
    categories: nieuw.categories,
    items: [...taken, ...eigen],
    project: {
      ...nieuw.project,
      ...(oudP.intake ? { intake: oudP.intake } : {}),
      ...(oudP.budget != null ? { budget: oudP.budget } : {}),
      ...(oudP.liveDatum ? { liveDatum: oudP.liveDatum } : {}),
      ...(Array.isArray(oudP.offertes) ? { offertes: oudP.offertes } : {}),
      status: "lopend",
      offerte: { ...(lijst.project?.offerte || {}), akkoordOp: akkoordOp || vandaag },
    },
  };
}

export function offerteAfgewezen(lijst, { datum, reden = "" }) {
  return {
    ...lijst,
    items: (lijst.items || []).filter(i => !i.offerteNavraag && !(i.aanvraagTaak && !i.checked)),
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
      stappen: ["Planning en draaischema", "Cast, locaties en styling", "Shotlist / storyboard", "Deliverables en buy-outs doornemen", "Naar klant sturen"] },
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
    { id: "crew-fotografie", label: "Fotograaf" },
    { id: "crew-drone", label: "Drone (piloot + spotter)" },
  ] },
  { groep: "Overig", icon: "🧳", items: [
    { id: "hotel", label: "Hotel", taak: "Hotel boeken", soort: "regelen", offset: -14, stappen: ["Aantal kamers en nachten", "Boeken", "Gegevens in de callsheet"] },
    { id: "verzekering", label: "Productieverzekering", taak: "Productieverzekering regelen", soort: "regelen", offset: -14, matcht: /verzekering/i },
  ] },
  // Postproductie: deadlines rekenen terug vanaf de OPLEVERDATUM.
  { groep: "Postproductie", icon: "🎞️", fase: "post", items: [
    { id: "edit-v1", label: "Edit v1", taak: "Edit v1 maken en naar klant sturen", soort: "taak", anker: "oplever", offset: -12, matcht: /eerste montage|offline montage/i,
      stappen: ["Selectie / stringout", "Montage v1", "Exporteren + naar klant sturen"] },
    { id: "edit-v2", label: "Edit v2", taak: "Edit v2 (feedback verwerken)", soort: "taak", anker: "oplever", offset: -7, matcht: /feedback ?(verwerken|ronde)|feedbackronde/i,
      stappen: ["Feedback op een rij", "Verwerken", "V2 naar klant sturen"] },
    { id: "edit-lock", label: "Edit lock", taak: "Edit lock laten bevestigen", soort: "regelen", anker: "oplever", offset: -5, matcht: /picture lock|edit lock/i },
    { id: "animatie", label: "Animatie", taak: "Animatie / motion graphics", soort: "taak", anker: "oplever", offset: -6,
      stappen: ["Huisstijl, logo's en fonts verzamelen", "Animaties maken", "Akkoord klant"] },
    { id: "kleurcorrectie", label: "Kleurcorrectie", taak: "Kleurcorrectie", soort: "taak", anker: "oplever", offset: -4, matcht: /kleurcorrectie/i },
    { id: "grading", label: "Grading", taak: "Grading", soort: "taak", anker: "oplever", offset: -4, matcht: /\bgrading\b/i },
    { id: "sound-effects", label: "Sound effects", taak: "Sound effects / sounddesign", soort: "taak", anker: "oplever", offset: -4 },
    { id: "muziek-componeren", label: "Muziek (componeren)", taak: "Muziek laten componeren", soort: "persoon", anker: "oplever", offset: -14,
      stappen: ["Briefing + referenties naar componist", "Eerste versie beoordelen", "Definitieve versie + rechten vastleggen"] },
    { id: "muziek-stock", label: "Muziek (stock)", taak: "Stockmuziek kiezen en licentie regelen", soort: "regelen", anker: "oplever", offset: -10, matcht: /muziek/i,
      stappen: ["Opties selecteren", "Akkoord klant", "Licentie kopen (juiste media en looptijd)"] },
    { id: "afmixen", label: "Afmixen", taak: "Afmixen", soort: "regelen", anker: "oplever", offset: -3, matcht: /afmix/i,
      stappen: ["AAF + referentie naar geluidsstudio", "Mix beoordelen", "Mixen per deliverable (TV / online)"] },
  ] },
];

// ── Deliverables: welke versies/formaten er opgeleverd moeten worden.
//    Wordt bij de offerte al vastgelegd en gaat het hele project mee:
//    projectkop, PPM, buy-outs van cast en de opleverchecklist.
export const DELIVERABLE_KANALEN = [
  { id: "tvc", label: "TVC", buyout: "tv" },
  { id: "online", label: "Online", buyout: "online" },
  { id: "online-paid", label: "Online paid", buyout: "online-paid" },
];
export const FORMATEN = ["16x9", "4x5", "1x1", "9x16"];
export const STANDAARD_FORMATEN = { tvc: ["16x9"], online: ["16x9", "1x1", "9x16"], "online-paid": ["4x5", "9x16"] };

export function normaliseerDeliverables(d) {
  const uit = { fotografie: !!d?.fotografie };
  for (const k of DELIVERABLE_KANALEN) {
    const f = Array.isArray(d?.[k.id]) ? FORMATEN.filter(x => d[k.id].includes(x)) : [];
    if (f.length) uit[k.id] = f;
  }
  return uit;
}

export function deliverableRegels(d) {
  const n = normaliseerDeliverables(d);
  const regels = [];
  for (const k of DELIVERABLE_KANALEN) for (const f of n[k.id] || []) regels.push({ id: `${k.id}-${f}`, tekst: `${k.label} — ${f}` });
  if (n.fotografie) regels.push({ id: "fotografie", tekst: "Fotografie — selectie + retouche" });
  return regels;
}

export function deliverablesTekst(d) {
  const n = normaliseerDeliverables(d);
  const delen = DELIVERABLE_KANALEN.filter(k => n[k.id]).map(k => `${k.label} ${n[k.id].join("/")}`);
  if (n.fotografie) delen.push("Fotografie");
  return delen.join(" · ");
}

// ── Buy-outs: gebruiksrechten van cast (en fotograaf) per medium + looptijd.
export const BUYOUT_MEDIA = {
  cast: [{ id: "tv", label: "TV" }, { id: "online", label: "Online" }, { id: "online-paid", label: "Online paid" }],
  fotografie: [{ id: "online", label: "Online" }, { id: "online-paid", label: "Online paid" }, { id: "print", label: "Print / OOH" }],
};
export const BUYOUT_DUUR = [
  { id: "3m", label: "3 maanden", maanden: 3 }, { id: "6m", label: "6 maanden", maanden: 6 },
  { id: "1j", label: "1 jaar", maanden: 12 }, { id: "2j", label: "2 jaar", maanden: 24 },
  { id: "3j", label: "3 jaar", maanden: 36 }, { id: "5j", label: "5 jaar", maanden: 60 },
  { id: "onbeperkt", label: "Onbeperkt", maanden: null },
];
const CAST_ROLLEN = ["acteurs", "edelfiguranten", "figuranten"];
export function buyoutSoort(onderdeelId) {
  if (CAST_ROLLEN.includes(onderdeelId)) return "cast";
  if (onderdeelId === "crew-fotografie") return "fotografie";
  return null;
}
// Welke buy-outs liggen voor de hand? Afgeleid van de deliverables:
// TVC → TV, online → online, online paid → online paid (fotograaf: geen TV).
export function standaardBuyouts(deliverables, onderdeelId) {
  const soort = buyoutSoort(onderdeelId);
  if (!soort) return [];
  const n = normaliseerDeliverables(deliverables);
  const media = DELIVERABLE_KANALEN.filter(k => n[k.id]).map(k => k.buyout)
    .filter(m => BUYOUT_MEDIA[soort].some(x => x.id === m));
  return media.map(m => ({ medium: m, duur: null, bedrag: null }));
}
// Tot wanneer loopt een buy-out (vanaf de eerste uitzending/publicatie)?
export function buyoutEinde(startDatum, duurId) {
  const d = BUYOUT_DUUR.find(x => x.id === duurId);
  if (!startDatum || !d || d.maanden == null) return null;
  return plusDagen(plusMaandenExport(startDatum, d.maanden), -1);
}
function plusMaandenExport(datumStr, n) {
  const [j, m, dg] = datumStr.split("-").map(Number);
  const doel = new Date(j, m - 1 + n, 1);
  const laatste = new Date(doel.getFullYear(), doel.getMonth() + 1, 0).getDate();
  return datumNaarStr(new Date(doel.getFullYear(), doel.getMonth(), Math.min(dg, laatste)));
}
const CREW_TAAK = { id: "crew", taak: "Crew boeken", soort: "persoon", offset: -14, matcht: /\bcrew\b/i };
const alleOnderdelen = () => ONDERDELEN.flatMap(g => g.items.map(i => ({ ...i, crew: !!g.crew, fase: i.fase || g.fase })));
export const onderdeelVan = (id) => alleOnderdelen().find(o => o.id === id);

// Welke onderdelen staan standaard aan? Eerst wat je de vorige keer bij dit
// sjabloon koos (zelflerend), anders de vaste standaard van het sjabloon,
// anders: wat het sjabloon zelf al noemt + kickoff en PPM.
// Onderdelen die later zijn toegevoegd: een eerder opgeslagen keuze kende
// ze nog niet, dus daar geldt de standaard van het sjabloon (anders zouden
// bv. montage- of gradingstappen uit het sjabloon ongemerkt uit staan).
const LATER_TOEGEVOEGD = ["edit-v1", "edit-v2", "edit-lock", "animatie", "kleurcorrectie", "grading", "sound-effects", "muziek-componeren", "muziek-stock", "afmixen", "crew-fotografie", "crew-drone"];
function sjabloonStandaard(sjabloon) {
  if (Array.isArray(sjabloon?.standaardOnderdelen)) return sjabloon.standaardOnderdelen;
  const teksten = (sjabloon?.stappen || []).map(s => s.tekst).join(" | ");
  return ["kickoff", "ppm", ...alleOnderdelen().filter(o => o.matcht && o.matcht.test(teksten)).map(o => o.id)]
    .filter((id, i, a) => a.indexOf(id) === i);
}
export function standaardOnderdelen(sjabloon) {
  if (!Array.isArray(sjabloon?.laatsteOnderdelen)) return sjabloonStandaard(sjabloon);
  const bekend = new Set(sjabloon.onderdelenBekend || alleOnderdelen().map(o => o.id).filter(id => !LATER_TOEGEVOEGD.includes(id)));
  const nieuw = sjabloonStandaard(sjabloon).filter(id => !bekend.has(id));
  return [...new Set([...sjabloon.laatsteOnderdelen, ...nieuw])];
}

function tijdMin(tijd, minuten) {
  const [u, m] = String(tijd || "10:00").split(":").map(Number);
  const t = Math.max(0, u * 60 + m - minuten);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
// In welke fase hoort een afspraak? Vóór de draaidag = pre-productie, op de
// draaidag = productie, erna = postproductie.
export function planningFase(datum, draaidag, opleverdatum) {
  if (!datum || !draaidag) return "pre";
  if (datum < draaidag) return "pre";
  if (datum === draaidag) return "productie";
  return "post";
}

// Huidige planning uitlezen uit de TAKEN (niet uit wat ooit is opgeslagen):
// heb je een afspraak in de taak zelf verzet, dan gaat die nieuwe datum mee
// als je de onderdelen opnieuw opent.
export function leesPlanningUitTaken(lijst) {
  const tijdUit = (i) => (/Om (\d{2}:\d{2})/.exec(i.note || "") || [])[1] || "10:00";
  const meetings = {};
  for (const i of lijst.items || []) {
    if ((i.onderdeelId === "kickoff" || i.onderdeelId === "ppm") && !i.checked) meetings[i.onderdeelId] = { datum: i.dueDate || null, tijd: tijdUit(i) };
  }
  const eigen = (lijst.project?.eigenPlanning || []).map(e => {
    const i = (lijst.items || []).find(x => x.eigenPlanningId === e.id);
    return i ? { id: e.id, naam: i.name, datum: i.dueDate || null, tijd: tijdUit(i) } : e;
  });
  return { meetings, eigenPlanning: eigen };
}

// Namen van eigen planning onthouden per sjabloon (vaakst gebruikt eerst).
export function onthoudPlanningNamen(sjabloon, eigenPlanning) {
  const tel = { ...(sjabloon.planningNamen || {}) };
  for (const e of eigenPlanning || []) {
    const n = String(e.naam || "").trim();
    if (n) tel[n] = (tel[n] || 0) + 1;
  }
  return { ...sjabloon, planningNamen: tel };
}
export function planningSuggesties(sjabloon, alGekozen = []) {
  const bezet = new Set(alGekozen.map(e => String(e.naam || "").trim().toLowerCase()));
  return Object.entries(sjabloon?.planningNamen || {})
    .filter(([n]) => !bezet.has(n.toLowerCase()))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "nl"))
    .map(([n]) => n)
    .slice(0, 8);
}

export function standaardMeetings({ draaidag, vandaag, bestaand = {} }) {
  return {
    kickoff: bestaand.kickoff || { datum: naarWerkdag(plusDagen(vandaag, 2), 1), tijd: "10:00" },
    ppm: bestaand.ppm || { datum: draaidag ? werkdagVanaf(plusDagen(draaidag, -5), vandaag, -1) : null, tijd: "10:00" },
  };
}

// Zet de gekozen onderdelen in het project om in taken (idempotent: je kunt
// dit telkens opnieuw doen met een andere keuze). Uitzetten haalt alleen
// OPEN taken weg; wat al gedaan is blijft staan.
export function pasOnderdelenToe(lijst, gekozenIds, { draaidag, opleverdatum, vandaag, meetings = {}, deliverables, eigenPlanning, verledenNaarVandaag = true, wie = null, nu = Date.now(), nieuwId }) {
  const gekozen = new Set(gekozenIds);
  const p = lijst.project || {};
  const dag = draaidag || p.draaidag;
  const oplever = opleverdatum || p.opleverdatum;
  const deliv = deliverables !== undefined ? normaliseerDeliverables(deliverables) : (p.deliverables || null);
  let items = [...(lijst.items || [])];
  const uitgezet = new Set(p.uitgezetteStapIds || []);

  // 1. Passende sjabloonstappen koppelen aan een onderdeel (eenmalig).
  for (const o of [...alleOnderdelen().filter(x => x.matcht && !x.crew), CREW_TAAK]) {
    if (items.some(i => i.onderdeelId === o.id)) continue;
    const idx = items.findIndex(i => i.sjabloonStapId && !i.onderdeelId && o.matcht.test(i.name || ""));
    if (idx >= 0) items[idx] = { ...items[idx], onderdeelId: o.id };
  }

  const datumVoor = (offset, anker = "draai") => {
    const basis = anker === "oplever" ? oplever : dag;
    if (!basis) return null;
    const d = offset ? naarWerkdag(plusDagen(basis, offset), offset < 0 ? -1 : 1) : basis;
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
      name: o.taak, soort: o.soort, onderdeelId: o.id, category: o.fase || "pre",
      dueDate: datumVoor(o.offset, o.anker || "draai"), anker: o.anker || "draai", offset: o.offset,
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

  // 3b. Eigen planning (zelf toegevoegde afspraken: moodboardpresentatie,
  //     locatiebezoek, extra draaidag…). Elke afspraak is één taak met een
  //     herinnering een uur vooraf, in de fase die bij de datum hoort.
  if (Array.isArray(eigenPlanning)) {
    const geldig = eigenPlanning.filter(e => e && e.id && String(e.naam || "").trim());
    const ids = new Set(geldig.map(e => e.id));
    items = items.filter(i => !i.eigenPlanningId || ids.has(i.eigenPlanningId) || i.checked);
    for (const e of geldig) {
      const velden = {
        name: String(e.naam).trim(),
        dueDate: e.datum || null,
        herinnering: e.datum ? `${e.datum}T${tijdMin(e.tijd, 60)}` : null,
        note: e.datum ? `Om ${e.tijd || "10:00"}` : "",
        category: planningFase(e.datum, dag, oplever),
      };
      const bestaand = items.find(i => i.eigenPlanningId === e.id);
      if (bestaand) items = items.map(i => (i.id === bestaand.id && !i.checked ? { ...i, ...velden } : i));
      else items.push(maakTaak({ ...velden, soort: "taak", eigenPlanningId: e.id }));
    }
  }

  // 4. Deliverables: opleverchecklist met een deelstap per kanaal × formaat
  //    (+ fotografie). Hergebruikt de opleverstap uit het sjabloon.
  if (deliv) {
    let opl = items.find(i => i.onderdeelId === "deliverables");
    if (!opl) {
      const idx = items.findIndex(i => i.sjabloonStapId && !i.onderdeelId && i.category === "post" && /opleveren|oplevering/i.test(i.name || ""));
      if (idx >= 0) { items[idx] = { ...items[idx], onderdeelId: "deliverables" }; opl = items[idx]; }
    }
    const regels = deliverableRegels(deliv);
    if (regels.length || opl) {
      const basis = opl || maakTaak({ name: "Deliverables opleveren", soort: "regelen", onderdeelId: "deliverables", category: "post", dueDate: datumVoor(0, "oplever"), anker: "oplever", offset: 0 });
      const huidig = basis.substappen || [];
      const subs = [
        ...huidig.filter(s => !s.delivId),
        ...regels.map(r => huidig.find(s => s.delivId === r.id) || { id: nieuwId(), tekst: r.tekst, afgevinkt: false, delivId: r.id }),
      ];
      const bijgewerkt = { ...basis, substappen: subs };
      items = opl ? items.map(i => (i.id === opl.id ? bijgewerkt : i)) : [...items, bijgewerkt];
    }
  }

  return {
    ...lijst,
    items,
    project: {
      ...p, onderdelen: [...gekozen], meetings: { ...(p.meetings || {}), ...meetings }, uitgezetteStapIds: [...uitgezet],
      onderdelenBekend: alleOnderdelen().map(o => o.id),
      ...(Array.isArray(eigenPlanning) ? { eigenPlanning: eigenPlanning.filter(e => e && e.id && String(e.naam || "").trim()).map(({ id, naam, datum, tijd }) => ({ id, naam: String(naam).trim(), datum: datum || null, tijd: tijd || "10:00" })) } : {}),
      ...(deliv ? { deliverables: deliv } : {}),
    },
  };
}

// Hoeveel open taken verdwijnen er als je deze keuze toepast? (Voor een
// waarschuwing vóór het uitzetten.)
export function telVerdwijnendeTaken(lijst, gekozenIds) {
  const gekozen = new Set(gekozenIds);
  const crewAan = alleOnderdelen().some(o => o.crew && gekozen.has(o.id));
  return (lijst.items || []).filter(i => i.onderdeelId && i.onderdeelId !== "deliverables" && !i.checked && (i.onderdeelId === "crew" ? !crewAan : !gekozen.has(i.onderdeelId))).length;
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
  // "1.500" of "12.000" (punt als duizendtalscheiding, zonder komma) = 1500 / 12000.
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
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
  for (const b of alle) for (const bo of b.buyouts || []) if (bo.bedrag != null) perEenheid.buyout = Math.round(((perEenheid.buyout || 0) + bo.bedrag) * 100) / 100;
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
  // Buy-outafspraken (medium + looptijd + bedrag) ook onthouden per rol.
  const metBuyouts = (bezetting.buyouts || []).filter(b => b.duur || b.bedrag != null);
  if (metBuyouts.length && bezetting.onderdeelId) {
    prijzen[bezetting.onderdeelId] = { ...(prijzen[bezetting.onderdeelId] || {}), buyouts: metBuyouts.map(({ medium, duur, bedrag }) => ({ medium, duur, bedrag })) };
  }
  if (bezetting.bedrag != null && bezetting.onderdeelId) {
    const vorige = prijzen[bezetting.onderdeelId];
    const nieuw = { bedrag: bezetting.bedrag, eenheid: bezetting.eenheid || "dag", datum, project: projectNaam || null };
    const zelfde = vorige && vorige.bedrag === nieuw.bedrag && vorige.eenheid === nieuw.eenheid && vorige.project === nieuw.project;
    prijzen[bezetting.onderdeelId] = zelfde ? vorige : { ...nieuw, ...(prijzen[bezetting.onderdeelId]?.buyouts ? { buyouts: prijzen[bezetting.onderdeelId].buyouts } : {}), historie: [...(vorige?.historie || []), ...(vorige ? [{ bedrag: vorige.bedrag, eenheid: vorige.eenheid, datum: vorige.datum, project: vorige.project }] : [])].slice(-8) };
  }
  const bijgewerkt = {
    ...basis,
    naam: basis.naam || naam,
    rollen: bezetting.onderdeelId && !basis.rollen.includes(bezetting.onderdeelId) ? [...basis.rollen, bezetting.onderdeelId] : basis.rollen,
    projecten: projectId && !basis.projecten.includes(projectId) ? [...basis.projecten, projectId] : basis.projecten,
    notitie: bezetting.notitie && !basis.notitie ? bezetting.notitie : basis.notitie,
    // Telefoon en adres (voor de callsheet): laatst ingevulde waarde wint.
    ...(bezetting.telefoon ? { telefoon: bezetting.telefoon } : {}),
    ...(bezetting.adres ? { adres: bezetting.adres } : {}),
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
  if (eenheid === "buyout") return `€ ${Number(bedrag).toLocaleString("nl-NL", { maximumFractionDigits: 2 })} buy-outs`;
  const e = EENHEDEN.find(x => x.id === eenheid);
  return `€ ${Number(bedrag).toLocaleString("nl-NL", { minimumFractionDigits: bedrag % 1 ? 2 : 0, maximumFractionDigits: 2 })}${e && e.id !== "totaal" ? ` ${e.label}` : ""}`;
}

// ════════════════════════════════════════════════════════════════════
// BUY-OUT LOOPT AF — herinnering een maand van tevoren.
// Voor elke buy-out met een looptijd (niet "onbeperkt") staat er een taak
// in het project, een maand vóór de einddatum, met een herinnering om
// 10:00: verlengen of de content offline (laten) halen. De looptijd telt
// vanaf "campagne live" (project.liveDatum), of anders de oplevering.
// Idempotent: past zich aan als namen, looptijden of datums wijzigen.
// ════════════════════════════════════════════════════════════════════
export function buyoutStart(project) {
  return project?.liveDatum || project?.opleverdatum || null;
}

export function synchroniseerBuyoutHerinneringen(lijst, { nieuwId, nu = Date.now(), wie = null } = {}) {
  const p = lijst.project;
  if (!p) return lijst;
  const start = buyoutStart(p);
  const mediaLabel = (m) => [...BUYOUT_MEDIA.cast, ...BUYOUT_MEDIA.fotografie].find(x => x.id === m)?.label || m;
  const gewenst = new Map();
  for (const i of lijst.items || []) {
    for (const b of i.bezetting || []) {
      if (!b.naam) continue;
      for (const bo of b.buyouts || []) {
        const einde = buyoutEinde(start, bo.duur);
        if (!einde) continue;
        const due = plusMaandenExport(einde, -1);
        gewenst.set(`${b.id}:${bo.medium}`, {
          name: `Buy-out loopt af: ${b.naam} — ${mediaLabel(bo.medium)}`,
          dueDate: due,
          herinnering: `${due}T10:00`,
          note: `Buy-out ${mediaLabel(bo.medium)} loopt t/m ${einde.split("-").reverse().join("-")}. Verlengen (nieuwe afspraak) of de content offline (laten) halen.`,
        });
      }
    }
  }
  let veranderd = false;
  const items = [];
  for (const i of lijst.items || []) {
    if (!i.buyoutKey) { items.push(i); continue; }
    const g = gewenst.get(i.buyoutKey);
    if (!g) { if (i.checked) items.push(i); else veranderd = true; continue; }
    gewenst.delete(i.buyoutKey);
    if (i.checked || (i.name === g.name && i.dueDate === g.dueDate && i.note === g.note)) { items.push(i); continue; }
    items.push({ ...i, ...g }); veranderd = true;
  }
  for (const [key, g] of gewenst) {
    veranderd = true;
    items.push({
      id: nieuwId(), checked: false, inCart: false, amount: 1, unit: "stuks", category: "post", status: null, budget: null,
      assignedTo: null, herhaling: null, substappen: [], belangrijk: true, mijnDag: null, klantId: p.klantId || null,
      soort: "regelen", buyoutKey: key, addedAt: nu, addedBy: wie, lastActionBy: wie, lastActionAt: nu, ...g,
    });
  }
  return veranderd ? { ...lijst, items } : lijst;
}

// ════════════════════════════════════════════════════════════════════
// MEERDERE DRAAIDAGEN
// project.draaidagen = [{ id, datum }] (gesorteerd); project.draaidag blijft
// de eerste dag, zodat alle bestaande berekeningen (deadlines t.o.v. de
// draaidag) gewoon blijven werken. Elke draaidag is een taak in de fase
// productie; extra dagen hebben anker "draai" met offset = dagen na dag 1,
// zodat ze meeschuiven als de planning verschuift.
// ════════════════════════════════════════════════════════════════════
export function draaidagenVan(project) {
  if (Array.isArray(project?.draaidagen) && project.draaidagen.length) {
    return [...project.draaidagen].filter(d => d && d.datum).sort((a, b) => a.datum.localeCompare(b.datum));
  }
  return project?.draaidag ? [{ id: "dag1", datum: project.draaidag }] : [];
}

export function zetDraaidagen(lijst, dagen, { nieuwId, wie = null, nu = Date.now() } = {}) {
  const p = lijst.project || {};
  const gesorteerd = [...dagen].filter(d => d && d.datum)
    .filter((d, i, a) => a.findIndex(x => x.datum === d.datum) === i)
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .map(d => ({ id: d.id || nieuwId(), datum: d.datum }));
  if (!gesorteerd.length) return lijst;
  const eerste = gesorteerd[0].datum;
  const meer = gesorteerd.length > 1;
  let items = [...(lijst.items || [])];
  // De draaidag-stap uit het sjabloon wordt dag 1 (eenmalig koppelen).
  if (!items.some(i => i.draaidagId)) {
    const idx = items.findIndex(i => i.category === "productie" && i.sjabloonStapId && /^draaidag/i.test(i.name || ""));
    if (idx >= 0) items[idx] = { ...items[idx], draaidagId: gesorteerd[0].id };
  }
  const ids = new Set(gesorteerd.map(d => d.id));
  items = items.filter(i => !i.draaidagId || ids.has(i.draaidagId) || i.checked);
  gesorteerd.forEach((d, n) => {
    const velden = {
      dueDate: d.datum, anker: "draai", offset: dagenTussen(eerste, d.datum), category: "productie",
      ...(meer ? { name: `Draaidag ${n + 1}` } : {}),
    };
    const bestaand = items.find(i => i.draaidagId === d.id);
    if (bestaand) { if (!bestaand.checked) items = items.map(i => (i.id === bestaand.id ? { ...i, ...velden } : i)); return; }
    items.push({
      id: nieuwId(), name: meer ? `Draaidag ${n + 1}` : "Draaidag", checked: false, inCart: false, note: "", amount: 1, unit: "stuks",
      status: null, budget: null, herinnering: null, assignedTo: null, herhaling: null, substappen: [], belangrijk: false, mijnDag: null,
      klantId: p.klantId || null, soort: "taak", draaidagId: d.id, addedAt: nu, addedBy: wie, lastActionBy: wie, lastActionAt: nu, ...velden,
    });
  });
  // "Footage overdragen" hoort de dag ná de láátste draaidag.
  const naLaatste = dagenTussen(eerste, gesorteerd[gesorteerd.length - 1].datum) + 1;
  items = items.map(i => (i.opzetTaak === "overdracht" && !i.checked ? { ...i, offset: naLaatste, dueDate: naarWerkdag(plusDagen(eerste, naLaatste), 1) } : i));
  return { ...lijst, items, project: { ...p, draaidagen: gesorteerd, draaidag: eerste } };
}

// ════════════════════════════════════════════════════════════════════
// BEGROTING — offerte tegenover kosten.
// Kosten per naam = prijs × aantal (dagen / uren / stuks; "totaal" = 1×)
// + buy-outs. Aantal leeg bij een dagprijs = aantal draaidagen.
// ════════════════════════════════════════════════════════════════════
export function aantalVoor(b, aantalDraaidagen = 1) {
  if (b.eenheid === "totaal") return 1;
  if (b.aantal != null && Number.isFinite(+b.aantal)) return +b.aantal;
  return b.eenheid === "dag" ? Math.max(1, aantalDraaidagen) : 1;
}

export function bezettingKosten(b, aantalDraaidagen = 1) {
  const aantal = aantalVoor(b, aantalDraaidagen);
  const basis = b.bedrag != null ? Math.round(b.bedrag * aantal * 100) / 100 : 0;
  const buyouts = (b.buyouts || []).reduce((s, x) => s + (x.bedrag || 0), 0);
  return { aantal, basis, buyouts, totaal: Math.round((basis + buyouts) * 100) / 100 };
}

export function projectBegroting(lijst) {
  const p = lijst.project || {};
  const n = draaidagenVan(p).length || 1;
  const regels = (lijst.items || []).flatMap(i => (i.bezetting || []).filter(b => b.naam).map(b => ({ ...b, taak: i.name, kosten: bezettingKosten(b, n) })));
  const posten = (p.kostenposten || []).filter(k => k && (k.omschrijving || k.bedrag != null));
  const som = (arr) => Math.round(arr.reduce((s, x) => s + x, 0) * 100) / 100;
  const overige = som(posten.map(k => k.bedrag || 0));
  const bevestigd = som(regels.filter(b => b.status === "bevestigd").map(b => b.kosten.totaal)) + overige;
  const inclOpties = som(regels.map(b => b.kosten.totaal)) + overige;
  const offerte = p.offerte?.bedrag ?? p.budget ?? null;
  const marge = offerte != null ? Math.round((offerte - inclOpties) * 100) / 100 : null;
  return {
    regels, posten, overige,
    bevestigd: Math.round(bevestigd * 100) / 100,
    inclOpties: Math.round(inclOpties * 100) / 100,
    buyouts: som(regels.map(b => b.kosten.buyouts)),
    zonderPrijs: regels.filter(b => b.bedrag == null).length,
    offerte, marge,
    margePct: offerte ? Math.round((100 * marge) / offerte) : null,
    overschreden: offerte != null && inclOpties > offerte,
    draaidagen: n,
  };
}

// ════════════════════════════════════════════════════════════════════
// OPZET VAN DE PRODUCTIE — bij de start te kiezen, later aan te passen:
//   • postproductie door ons of extern (dan geen montage/grading-taken,
//     wel "footage overdragen")
//   • aantal draaidagen (aaneengesloten vanaf de eerste draaidag)
//   • prelight: geen / op de draaidag zelf / aparte pre-light dag
// ════════════════════════════════════════════════════════════════════
export const PRELIGHT = [
  { id: "geen", label: "Geen prelight" },
  { id: "zelfde-dag", label: "Op de draaidag" },
  { id: "aparte-dag", label: "Aparte pre-light dag" },
];
// Postproductie-stappen die óók blijven als een ander de post doet.
const BLIJFT_BIJ_EXTERNE_POST = /factuur|nacalculatie|apparatuur|archiv|rushes|back-?up/i;
export const postOnderdeelIds = () => ONDERDELEN.filter(g => g.fase === "post").flatMap(g => g.items.map(i => i.id));
export function standaardOpzet(p = {}) {
  return { postDoorOns: true, draaidagen: Math.max(1, draaidagenVan(p).length || 1), prelight: "geen", ...(p.opzet || {}) };
}

export function pasOpzetToe(lijst, opzet, { vandaag = null, wie = null, nu = Date.now(), nieuwId }) {
  const p = lijst.project || {};
  const oud = standaardOpzet(p);
  const nieuw = { ...oud, ...opzet };
  let l = lijst;
  const taak = (velden) => ({
    id: nieuwId(), checked: false, inCart: false, note: "", amount: 1, unit: "stuks", status: null, budget: null,
    herinnering: null, assignedTo: null, herhaling: null, substappen: [], belangrijk: false, mijnDag: null,
    klantId: p.klantId || null, addedAt: nu, addedBy: wie, lastActionBy: wie, lastActionAt: nu, ...velden,
  });
  const datum = (anker, offset) => {
    const basis = anker === "oplever" ? l.project.opleverdatum : l.project.draaidag;
    if (!basis) return null;
    const d = offset ? naarWerkdag(plusDagen(basis, offset), offset < 0 ? -1 : 1) : basis;
    return vandaag && d < vandaag ? vandaag : d;
  };

  // 1. Aantal draaidagen: bestaande dagen houden, aanvullen of inkorten.
  const n = Math.max(1, Math.min(30, Math.round(Number(nieuw.draaidagen) || 1)));
  nieuw.draaidagen = n;
  if (p.draaidag) {
    const dagen = draaidagenVan(p);
    if (dagen.length !== n) {
      const volgende = [...dagen.slice(0, n)];
      while (volgende.length < n) volgende.push({ id: nieuwId(), datum: plusDagen(volgende[volgende.length - 1].datum, 1) });
      l = zetDraaidagen(l, volgende, { nieuwId, wie, nu });
    }
  }

  // 2. Postproductie door ons of extern.
  let items = [...(l.items || [])];
  let bewaard = [...(p.opzet?.uitgezettePost || [])];
  const uitgezet = new Set(l.project.uitgezetteStapIds || []);
  if (!nieuw.postDoorOns && oud.postDoorOns !== false) {
    const weg = items.filter(i => !i.checked && i.category === "post" && !i.opzetTaak && !i.buyoutKey
      && (postOnderdeelIds().includes(i.onderdeelId) || (i.sjabloonStapId && !BLIJFT_BIJ_EXTERNE_POST.test(i.name || ""))));
    const wegIds = new Set(weg.map(i => i.id));
    items = items.filter(i => !wegIds.has(i.id));
    bewaard = weg;
    weg.forEach(i => i.sjabloonStapId && uitgezet.add(i.sjabloonStapId));
    if (!items.some(i => i.opzetTaak === "overdracht")) {
      const naLaatste = l.project.draaidag ? dagenTussen(l.project.draaidag, draaidagenVan(l.project).slice(-1)[0].datum) + 1 : 1;
      items.push(taak({ name: "Footage en materiaal overdragen aan postproductie", category: "post", soort: "regelen", opzetTaak: "overdracht", anker: "draai", offset: naLaatste, dueDate: datum("draai", naLaatste),
        substappen: ["Footage + back-up op schijf / via transfer", "Shotlog, script notes en geluid meesturen", "Ontvangst laten bevestigen"].map(tekst => ({ id: nieuwId(), tekst, afgevinkt: false })) }));
    }
  } else if (nieuw.postDoorOns && oud.postDoorOns === false) {
    items = items.filter(i => !(i.opzetTaak === "overdracht" && !i.checked));
    for (const i of bewaard) {
      if (items.some(x => x.id === i.id)) continue;
      items.push({ ...i, dueDate: i.anker ? datum(i.anker, i.offset || 0) : i.dueDate });
      if (i.sjabloonStapId) uitgezet.delete(i.sjabloonStapId);
    }
    bewaard = [];
  }

  // 3. Prelight.
  items = items.filter(i => !(i.opzetTaak === "prelight" && !i.checked && nieuw.prelight !== i.prelightSoort));
  if (nieuw.prelight !== "geen" && !items.some(i => i.opzetTaak === "prelight" && i.prelightSoort === nieuw.prelight)) {
    const apart = nieuw.prelight === "aparte-dag";
    items.push(taak({
      name: apart ? "Pre-light dag" : "Prelight (op de draaidag)", category: apart ? "productie" : "productie", soort: "taak",
      opzetTaak: "prelight", prelightSoort: nieuw.prelight, anker: "draai", offset: apart ? -1 : 0, dueDate: datum("draai", apart ? -1 : 0),
      note: apart ? "Licht opbouwen en afstellen de dag vóór de eerste draaidag." : "Belichting eerder op de set: aparte (vroegere) call voor licht en camera.",
      substappen: (apart ? ["Belichter + gripper geboekt voor de pre-light dag", "Toegang locatie geregeld", "Lichtplan doorgenomen met camera"] : ["Vroegere call voor licht/camera", "Toegang locatie vroeg geregeld"]).map(tekst => ({ id: nieuwId(), tekst, afgevinkt: false })),
    }));
  }

  const { uitgezettePost, ...rest } = nieuw;
  return {
    ...l, items,
    project: { ...l.project, uitgezetteStapIds: [...uitgezet], opzet: { ...rest, uitgezettePost: bewaard } },
  };
}

// ════════════════════════════════════════════════════════════════════
// AANVRAAG — de fase vóór de offerte: het eerste telefoongesprek waarin de
// vraag bij ons wordt neergelegd. Notities + wat daaruit herkend is
// (zie intake-logica) gaan mee naar de offerte en de productie.
//   aanvraag → (offerte verstuurd) → offerte → (akkoord) → lopend
// ════════════════════════════════════════════════════════════════════
export function maakAanvraag({ naam, klantId = null, intakeTekst = "", herkend = {}, vandaag, gesprekDatum = null, offerteUiterlijk = null, dagenVoorOfferte = 2, wie = null, nu = Date.now(), nieuwId }) {
  // Deadline voor de offerte: zelf gekozen, anders uit de notities, anders over 2 dagen.
  const due = offerteUiterlijk || herkend.offerteDeadline || werkdagVanaf(plusDagen(vandaag, dagenVoorOfferte), vandaag, -1);
  return {
    id: nieuwId(), name: naam, icon: "📞", type: "todo",
    categories: FASES.map(f => ({ id: f.id, label: f.label, icon: f.icon })),
    items: [{
      id: nieuwId(), name: `Offerte opstellen en versturen: ${naam}`, checked: false, inCart: false, note: "",
      amount: 1, unit: "stuks", category: "pre", status: null, budget: null, dueDate: due, herinnering: `${due}T09:00`,
      assignedTo: null, herhaling: null, substappen: [], belangrijk: true, mijnDag: null, klantId,
      soort: "document", aanvraagTaak: true, addedAt: nu, addedBy: wie, lastActionBy: wie, lastActionAt: nu,
    }],
    history: {}, favorites: [], archief: [], createdAt: nu,
    project: {
      status: "aanvraag", klantId, afgerond: false, gestartOp: nu,
      intake: { tekst: String(intakeTekst || "").slice(0, 8000), datum: gesprekDatum || vandaag },
      ...(herkend.deliverables && Object.keys(herkend.deliverables).length ? { deliverables: normaliseerDeliverables(herkend.deliverables) } : {}),
      ...(herkend.budget ? { budget: herkend.budget } : {}),
      ...(herkend.liveDatum ? { liveDatum: herkend.liveDatum } : {}),
    },
  };
}

export function aanvraagNaarOfferte(lijst, opties) {
  const o = maakOfferte({ ...opties, naam: opties.naam || lijst.name });
  const nu = opties.nu || Date.now();
  const p = lijst.project || {};
  return {
    ...lijst,
    name: opties.naam || lijst.name,
    icon: "📨",
    items: [...o.items, ...(lijst.items || []).map(i => (i.aanvraagTaak && !i.checked ? { ...i, checked: true, voltooidOp: nu, lastActionBy: opties.wie || null, lastActionAt: nu } : i))],
    project: {
      ...p, ...o.project, gestartOp: p.gestartOp || o.project.gestartOp,
      deliverables: opties.deliverables !== undefined ? normaliseerDeliverables(opties.deliverables) : p.deliverables,
    },
  };
}

// ════════════════════════════════════════════════════════════════════
// MARGE-DOEL — standaard minimaal 20%, streven 25% (aan te passen).
//   goed  ≥ doel · krap  tussen minimum en doel · te-laag < minimum
// ════════════════════════════════════════════════════════════════════
export const STANDAARD_MARGE = { minimum: 20, doel: 25 };
export function normaliseerMarge(m) {
  const min = Math.max(0, Math.min(90, Number(m?.minimum ?? STANDAARD_MARGE.minimum)));
  const doel = Math.max(min, Math.min(90, Number(m?.doel ?? STANDAARD_MARGE.doel)));
  return { minimum: min, doel };
}
export function margeStatus(pct, marge = STANDAARD_MARGE) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const m = normaliseerMarge(marge);
  return pct >= m.doel ? "goed" : pct >= m.minimum ? "krap" : "te-laag";
}
// Hoeveel je maximaal kwijt mag zijn om nog `pct` procent marge te houden.
export function kostenPlafond(offerte, pct) {
  return offerte == null ? null : Math.round(offerte * (1 - pct / 100) * 100) / 100;
}

// ════════════════════════════════════════════════════════════════════
// SJABLOON VOORSTELLEN BIJ AKKOORD
// Eerst op basis van je eigen geschiedenis: met welk sjabloon startte je
// eerdere projecten van vergelijkbare omvang (offertebedrag)? Zonder
// geschiedenis: groot vanaf € 25.000 of meer dan één draaidag.
// ════════════════════════════════════════════════════════════════════
export function kiesSjabloon(sjablonen, lijsten, { bedrag = null, draaidagen = null, bron = "offerte" } = {}) {
  if (!sjablonen?.length) return null;
  const bestaat = (id) => sjablonen.some(s => s.id === id);
  const historie = (lijsten || [])
    .filter(l => l.project?.sjabloonId && bestaat(l.project.sjabloonId) && l.project.offerte?.bedrag > 0 && l.project.status !== "afgewezen")
    .map(l => ({ id: l.project.sjabloonId, bedrag: l.project.offerte.bedrag }));
  if (bedrag > 0 && historie.length >= 3) {
    // Dichtstbijzijnde 5 projecten (op log-schaal: € 10k ↔ € 20k is even ver als € 50k ↔ € 100k).
    const buren = historie.map(h => ({ ...h, afstand: Math.abs(Math.log(h.bedrag) - Math.log(bedrag)) }))
      .sort((a, b) => a.afstand - b.afstand).slice(0, Math.min(5, Math.ceil(historie.length / 2)));
    const telling = {};
    for (const b of buren) telling[b.id] = (telling[b.id] || 0) + 1;
    const [id, n] = Object.entries(telling).sort((a, b) => b[1] - a[1])[0];
    const s = sjablonen.find(x => x.id === id);
    return { id, reden: `${n} van je ${buren.length} vergelijkbare projecten startten met "${s.naam}"` };
  }
  const groot = sjablonen.find(s => s.id === "commercial-groot");
  const klein = sjablonen.find(s => s.id === "commercial-klein");
  if (groot && klein && (bedrag != null || draaidagen != null)) {
    const isGroot = (bedrag || 0) >= 25000 || (draaidagen || 0) > 1;
    const redenen = [bedrag != null ? `${bron} € ${Math.round(bedrag).toLocaleString("nl-NL")}` : null, draaidagen ? `${draaidagen} ${draaidagen === 1 ? "draaidag" : "draaidagen"}` : null].filter(Boolean).join(", ");
    return { id: isGroot ? groot.id : klein.id, reden: `voorgesteld op basis van ${redenen}` };
  }
  return { id: sjablonen[0].id, reden: null };
}

// Offerte-deadline van een aanvraag verzetten (taak + herinnering om 9:00).
export function zetOfferteDeadline(lijst, datum, { wie = null, nu = Date.now() } = {}) {
  return {
    ...lijst,
    items: (lijst.items || []).map(i => (i.aanvraagTaak && !i.checked ? { ...i, dueDate: datum, herinnering: `${datum}T09:00`, lastActionBy: wie, lastActionAt: nu } : i)),
  };
}
