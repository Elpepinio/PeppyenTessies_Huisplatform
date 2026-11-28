import { schuifKeten, verschuifProject, tijdMin, isVastePlanning } from "./projecten-logica";

// ════════════════════════════════════════════════════════════════════
// CALLS PER PROJECT
// Tijdens een project heb je calls (met klant, bureau, crew…). Per call:
// datum, met wie, notities — en de taken die eruit voortkomen. Die taken
// komen gewoon in het project terecht, met een verwijzing naar de call
// (`callId`), zodat je later terugziet waar een taak vandaan kwam.
// project.calls = [{ id, datum, met, notities, door, aangemaaktOp, bijgewerktOp }]
// ════════════════════════════════════════════════════════════════════

// Regels in de notities die als actiepunt bedoeld zijn:
//   "[ ] moodboard sturen", "- [ ] …", "☐ …", "-> …", "→ …", "=> …",
//   "TODO …", "Actie: …", "AP: …", "Taak: …", "Wij: …", "Ik: …"
const CALL_ACTIE_RE = /^\s*(?:[-*•]\s*)?(?:\[\s?\]|☐|□|->|→|=>|➜|todo\b[:\s-]*|actie(?:punt)?\s*[:\-]|ap\s*[:\-]|taak\s*[:\-]|(?:wij|wij doen|ik|ons|pepijn|tessa)\s*:)\s*(.+)$/i;

export function callActiepunten(notities) {
  const uit = [];
  String(notities || "").split(/\r?\n/).forEach((regel, i) => {
    const m = regel.match(CALL_ACTIE_RE);
    if (!m) return;
    const tekst = m[1].replace(/\s+/g, " ").replace(/[.;,]\s*$/, "").trim();
    if (tekst.length < 2) return;
    uit.push({ regel: i, tekst: tekst.charAt(0).toUpperCase() + tekst.slice(1) });
  });
  return uit;
}

export function callsVan(p = {}) {
  return [...(Array.isArray(p.calls) ? p.calls : [])]
    .sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")) || (b.aangemaaktOp || 0) - (a.aangemaaktOp || 0));
}

// Taken die uit een call kwamen (open + klaar).
export function callTakenVan(lijst, callId) {
  return (lijst?.items || []).filter(i => i.callId === callId);
}

export function callSamenvatting(notities, max = 90) {
  const eerste = String(notities || "").split(/\r?\n/).map(s => s.trim()).find(Boolean) || "";
  return eerste.length > max ? eerste.slice(0, max - 1) + "…" : eerste;
}

// Call bewaren (nieuw of bijgewerkt) en de nieuwe taken toevoegen.
// `taken` zijn al kant-en-klare taakobjecten; ze krijgen hier de callId.
export function bewaarCallInProject(lijst, call, taken = [], { nieuwId, wie = null, nu = Date.now() } = {}) {
  const p = lijst.project || {};
  const bestaand = (p.calls || []).find(c => c.id === call.id);
  const id = bestaand?.id || call.id || nieuwId();
  const schoon = {
    id,
    datum: call.datum || null,
    met: String(call.met || "").trim().slice(0, 120),
    notities: String(call.notities || "").slice(0, 20000),
    // Geplande calls/afspraken: tijd, onderwerp en de taak (het vaste moment)
    // in de planning waar de call bij hoort.
    tijd: call.tijd !== undefined ? (call.tijd || null) : (bestaand?.tijd || null),
    onderwerp: call.onderwerp !== undefined ? String(call.onderwerp || "").trim().slice(0, 80) : (bestaand?.onderwerp || ""),
    momentTaakId: call.momentTaakId !== undefined ? (call.momentTaakId || null) : (bestaand?.momentTaakId || null),
    door: bestaand?.door || wie,
    aangemaaktOp: bestaand?.aangemaaktOp || nu,
    bijgewerktOp: nu,
  };
  const calls = bestaand ? p.calls.map(c => (c.id === id ? schoon : c)) : [...(p.calls || []), schoon];
  const nieuweItems = taken.map(t => ({ ...t, callId: id }));
  return { ...lijst, project: { ...p, calls }, items: [...(lijst.items || []), ...nieuweItems] };
}

// Call verwijderen. De taken blijven staan (alleen de verwijzing verdwijnt).
export function verwijderCall(lijst, callId) {
  const p = lijst.project || {};
  return {
    ...lijst,
    project: { ...p, calls: (p.calls || []).filter(c => c.id !== callId) },
    items: (lijst.items || []).map(i => (i.callId === callId ? (({ callId: _weg, ...rest }) => rest)(i) : i)),
  };
}

// ── Vaste momenten (afspraken/calls in de planning) ─────────────────
// Tijd van een afspraak: "Om 14:00" in de notitie, anders uit de herinnering.
export function momentTijd(i) {
  const m = String(i?.note || "").match(/\bOm (\d{1,2}:\d{2})\b/);
  if (m) return m[1].padStart(5, "0");
  return i?.herinnering ? i.herinnering.slice(11, 16) : null;
}
// De call die bij een vast moment hoort (kickoff, PPM of een geplande call).
export function callVoorMoment(lijst, taak) {
  const calls = lijst?.project?.calls || [];
  return calls.find(c => c.momentTaakId === taak?.id) || (taak?.callMoment && taak.callId ? calls.find(c => c.id === taak.callId) : null) || null;
}
// Is dit een draaidag-moment? Dan verzet je de draaidag van het project.
export function isDraaiMoment(i) {
  return !!(i && (i.draaidagId || (i.anker === "draai" && Number(i.offset) === 0 && i.category === "productie")));
}
// Een vast moment verzetten (datum en eventueel tijd). Met keten volgen
// de taken die erop wachten. Een draaidag-moment verzet de hele draaidag
// (zoals in de projectkop). Een gekoppelde call krijgt de nieuwe datum/tijd.
export function verzetMoment(lijst, itemId, { datum, tijd } = {}, { keten = true } = {}) {
  const taak = (lijst.items || []).find(i => i.id === itemId);
  if (!taak || !datum) return { lijst, meegeschoven: [], conflicten: [] };
  if (isDraaiMoment(taak)) {
    const p = lijst.project || {};
    const oud = taak.dueDate;
    const delta = p.draaidag && oud ? Math.round((new Date(`${datum}T12:00:00`) - new Date(`${oud}T12:00:00`)) / 86400000) : 0;
    const nieuweDraai = p.draaidag ? new Date(new Date(`${p.draaidag}T12:00:00`).getTime() + delta * 86400000).toISOString().slice(0, 10) : datum;
    const voor = new Map((lijst.items || []).map(i => [i.id, i.dueDate]));
    const l = verschuifProject(lijst, { draaidag: nieuweDraai });
    // Taken óp de draaidag (back-up, DIT…) gaan mee naar de nieuwe dag.
    const l2 = { ...l, items: l.items.map(i => (!i.checked && isDraaiMoment(i) && i.dueDate === oud ? { ...i, dueDate: datum } : i)) };
    const meegeschoven = l2.items.filter(i => i.id !== itemId && voor.get(i.id) !== i.dueDate).map(i => i.id);
    return { lijst: l2, meegeschoven, conflicten: [], draaidag: nieuweDraai };
  }
  let r = keten ? schuifKeten(lijst, itemId, datum) : { lijst: { ...lijst, items: lijst.items.map(i => (i.id === itemId ? { ...i, dueDate: datum } : i)) }, meegeschoven: [], conflicten: [] };
  const t = tijd || momentTijd(taak);
  const items = r.lijst.items.map(i => {
    if (i.id !== itemId) return i;
    const notitie = String(i.note || "");
    const note = t ? (/\bOm \d{1,2}:\d{2}\b/.test(notitie) ? notitie.replace(/\bOm \d{1,2}:\d{2}\b/, `Om ${t}`) : (notitie ? `Om ${t} · ${notitie}` : `Om ${t}`)) : notitie;
    return { ...i, dueDate: datum, note, herinnering: t ? `${datum}T${tijdMin(t, 60)}` : i.herinnering ? `${datum}T${i.herinnering.slice(11, 16)}` : null };
  });
  let l = { ...r.lijst, items };
  const call = callVoorMoment(l, taak);
  if (call) l = { ...l, project: { ...l.project, calls: l.project.calls.map(c => (c.id === call.id ? { ...c, datum, ...(t ? { tijd: t } : {}) } : c)) } };
  return { ...r, lijst: l };
}
// Fase van een moment op datum: vóór de draaidag pre, erna post.
export function faseVoorDatum(project, datum) {
  const dagen = [...(Array.isArray(project?.draaidagen) ? project.draaidagen.map(d => d.datum) : []), project?.draaidag].filter(Boolean).sort();
  if (!dagen.length || datum < dagen[0]) return "pre";
  if (datum > dagen[dagen.length - 1]) return "post";
  return "productie";
}
// Gewijzigde datum/tijd in de call → ook het moment in de planning.
export function synchroniseerMomentMetCall(lijst, call) {
  const taakId = call?.momentTaakId || (lijst.items || []).find(i => i.callMoment && i.callId === call?.id)?.id;
  if (!taakId || !call.datum) return lijst;
  const taak = lijst.items.find(i => i.id === taakId);
  if (!taak || (taak.dueDate === call.datum && (!call.tijd || momentTijd(taak) === call.tijd))) return lijst;
  return verzetMoment(lijst, taakId, { datum: call.datum, tijd: call.tijd || undefined }).lijst;
}
