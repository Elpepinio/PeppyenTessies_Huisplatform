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
