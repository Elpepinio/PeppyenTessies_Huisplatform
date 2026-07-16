import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, X, ChevronLeft, AlertCircle, Check, Clock } from "lucide-react";

const OBJECT_ICONEN = ["🏠","🚐","🚗","🔧","❄️","🌡️","💧","⚡","🌿","📦","🛁","🍳","🔑","🏊","📺","💻"];
const INTERVALLEN = [
  { label: "Wekelijks",     dagen: 7   },
  { label: "Maandelijks",   dagen: 30  },
  { label: "Per kwartaal",  dagen: 90  },
  { label: "Halfjaarlijks", dagen: 180 },
  { label: "Jaarlijks",     dagen: 365 },
  { label: "2-jaarlijks",   dagen: 730 },
  { label: "Eenmalig",      dagen: 0   },
];

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function dagPlus(datum, dagen) {
  const d = new Date(datum);
  d.setDate(d.getDate() + dagen);
  return d;
}
function dagVerschil(a, b) {
  return Math.round((new Date(a) - new Date(b)) / 86400000);
}
function fmtDatum(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
}

// ── Werkdagen-helpers (optioneel per project) ──────────────────────────────
function isWeekend(datum) {
  const dag = new Date(datum).getDay();
  return dag === 0 || dag === 6; // zondag = 0, zaterdag = 6
}
// Schuift een datum die op een weekend valt door naar de eerstvolgende maandag.
function naarWerkdag(datum) {
  const d = new Date(datum);
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  return d;
}
// Telt een aantal WERKdagen op bij een datum (weekend telt niet mee).
function werkdagPlus(datum, aantalWerkdagen) {
  let d = naarWerkdag(datum);
  let geteld = 0;
  while (geteld < aantalWerkdagen) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) geteld++;
  }
  return d;
}
// Telt een aantal WERKdagen af van een datum (achterwaarts, voor het
// kritiek-pad-algoritme).
function werkdagMin(datum, aantalWerkdagen) {
  let d = naarWerkdag(datum);
  let geteld = 0;
  while (geteld < aantalWerkdagen) {
    d.setDate(d.getDate() - 1);
    if (!isWeekend(d)) geteld++;
  }
  return d;
}

// ════════════════════════════════════════════════════════
// PLANNINGSALGORITME — de kern van "als er iets uitloopt, schuift de rest
// automatisch mee". Werkt als een vereenvoudigde CPM-planning (Critical Path
// Method): elke taak start pas zodra AL zijn afhankelijkheden klaar zijn.
//
// - Nog niet gestarte/afgeronde taken worden berekend op basis van geschatte
//   duur en de (eventueel al vertraagde) einddatum van hun afhankelijkheden.
// - Taken met een werkelijke start/einddatum (al gestart of al klaar)
//   gebruiken die ECHTE datums als basis in plaats van de schatting — dat is
//   precies het mechanisme waardoor vertraging automatisch doorwerkt naar
//   alles wat erna komt.
// - `actueel: false` betekent puur-op-schema-als-alles-volgens-plan-gaat,
//   gebruikt om te bepalen hoeveel vertraging een taak heeft opgelopen
//   t.o.v. de oorspronkelijke inschatting.
// - `werkdagenOnly: true` (per project instelbaar) telt weekenden niet mee:
//   een taak van "3 dagen" die op vrijdag start, is dan pas op woensdag klaar
//   in plaats van maandag, en een berekende start die op een weekend zou
//   vallen, schuift automatisch door naar de eerstvolgende maandag.
// ════════════════════════════════════════════════════════
function berekenSchema(taken, projectStart, actueel = true, werkdagenOnly = false) {
  const perId = Object.fromEntries(taken.map(t => [t.id, t]));
  const resultaat = {};

  function berekenTaak(id, bezig) {
    if (resultaat[id]) return resultaat[id];
    if (bezig.has(id)) return { start: new Date(projectStart), eind: new Date(projectStart), circulair: true };
    const taak = perId[id];
    if (!taak) return null;
    bezig.add(id);

    let start;
    if (actueel && taak.werkelijkeStart) {
      start = new Date(taak.werkelijkeStart);
    } else if (!taak.afhankelijkheden || taak.afhankelijkheden.length === 0) {
      start = new Date(projectStart);
    } else {
      let laatsteEind = new Date(projectStart);
      taak.afhankelijkheden.forEach(depId => {
        const dep = berekenTaak(depId, bezig);
        if (dep && dep.eind > laatsteEind) laatsteEind = dep.eind;
      });
      start = laatsteEind;
    }
    if (werkdagenOnly) start = naarWerkdag(start);

    let eind;
    if (actueel && taak.werkelijkEind) {
      eind = new Date(taak.werkelijkEind);
    } else {
      const duur = Math.max(1, +taak.duurDagen || 1);
      eind = werkdagenOnly ? werkdagPlus(start, duur) : dagPlus(start, duur);
    }

    const r = { start, eind };
    resultaat[id] = r;
    bezig.delete(id);
    return r;
  }

  taken.forEach(t => berekenTaak(t.id, new Set()));
  return resultaat;
}

// ════════════════════════════════════════════════════════
// KRITIEK PAD — welke taken hebben NUL speling (vertraging ervan vertraagt
// gegarandeerd de hele opleverdatum), en welke hebben nog wat marge? Dit is
// de "backward pass" van CPM: waar berekenSchema van voor naar achter werkt
// (vroegst mogelijke start/eind), rekent dit van achter naar voren terug
// vanaf de project-einddatum (laatst toelaatbare start/eind), gebaseerd op
// het huidige, actuele schema (dus inclusief eventuele al opgelopen
// vertraging).
function berekenKritiekPad(taken, schema, werkdagenOnly = false) {
  if (taken.length === 0) return {};
  const perId = Object.fromEntries(taken.map(t => [t.id, t]));
  // Wie hangt van wie af, omgekeerd opgezocht (opvolgers per taak).
  const opvolgers = {};
  taken.forEach(t => (t.afhankelijkheden || []).forEach(depId => {
    if (!opvolgers[depId]) opvolgers[depId] = [];
    opvolgers[depId].push(t.id);
  }));

  const projectEind = taken.reduce((max, t) => {
    const eind = schema[t.id]?.eind;
    return eind && eind > max ? eind : max;
  }, schema[taken[0].id]?.eind || new Date());

  const laatsteEind = {};
  function berekenLaatsteEind(id, bezig) {
    if (laatsteEind[id]) return laatsteEind[id];
    if (bezig.has(id)) return projectEind; // circulair: geen zinvolle speling te bepalen
    bezig.add(id);
    const opv = opvolgers[id] || [];
    const waarde = opv.length === 0
      ? projectEind
      : new Date(Math.min(...opv.map(opvId => {
          const opvLaatsteEind = berekenLaatsteEind(opvId, bezig);
          const opvTaak = perId[opvId];
          const opvDuur = Math.max(1, +opvTaak?.duurDagen || 1);
          return (werkdagenOnly ? werkdagMin(opvLaatsteEind, opvDuur) : dagPlus(opvLaatsteEind, -opvDuur)).getTime();
        })));
    laatsteEind[id] = waarde;
    bezig.delete(id);
    return waarde;
  }

  const speling = {};
  taken.forEach(t => {
    const le = berekenLaatsteEind(t.id, new Set());
    const werkelijkEind = schema[t.id]?.eind;
    speling[t.id] = werkelijkEind ? Math.max(0, dagVerschil(fmtDatum(le), fmtDatum(werkelijkEind))) : 0;
  });
  return speling; // { taakId: aantal dagen speling (0 = kritiek pad) }
}

async function loadData() {
  try {
    const res = await fetch("/api/onderhoud");
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function saveData(data) {
  try {
    await fetch("/api/onderhoud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) { console.error("Opslaan mislukt", e); }
}

const C = {
  bg: "#F5F0FF", surf: "#FFFFFF", card: "#EDE8FF",
  border: "#D4C8F0", purple: "#5B3FA6", accent: "#7B5CC8",
  text: "#1A1230", muted: "#7B6FA8", red: "#D63353",
  yellow: "#CC8800", green: "#2D6A4F", orange: "#D4791A",
};

const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: C.purple },
  main: { padding: "4px 20px 120px" },
  inp: { background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 15, width: "100%", boxSizing: "border-box", color: C.text },
  btn: (bg=C.purple, col="#FFFFFF") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 12 },
  fab: { position: "fixed", bottom: 28, right: 20, width: 52, height: 52, borderRadius: 16, background: C.purple, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px rgba(91,63,166,0.3)", zIndex: 50 },
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
};

export default function OnderhoudApp() {
  const [objecten, setObjectenState] = useState([]);
  const [taken, setTakenState] = useState([]);
  const [projecten, setProjectenState] = useState([]);
  const [projectTaken, setProjectTakenState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [actieefObjectId, setActieefObjectId] = useState(null);
  const lastWriteRef = useRef(0);

  // Formulieren
  const [showObjectForm, setShowObjectForm] = useState(false);
  const [objectForm, setObjectForm] = useState({ naam: "", icoon: "🏠", notitie: "" });
  const [showTaakForm, setShowTaakForm] = useState(false);
  const [taakForm, setTaakForm] = useState({ naam: "", interval: "Jaarlijks", intervalDagen: 365, kosten: "", uitvoerder: "", notitie: "", volgende: "", laatste: "" });
  const [showLogForm, setShowLogForm] = useState(false);
  const [logTaakId, setLogTaakId] = useState(null);
  const [logForm, setLogForm] = useState({ datum: new Date().toISOString().slice(0,10), kosten: "", notitie: "", uitvoerder: "" });

  const [tab, setTab] = useState("objecten"); // objecten | overzicht | verbouwing
  const [toast, setToast] = useState(null);

  // ── Verbouwplanner ──────────────────────────────────────
  const [actieefProjectId, setActieefProjectId] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editProjectId, setEditProjectId] = useState(null);
  const [projectWeergave, setProjectWeergave] = useState("lijst"); // "lijst" | "tijdlijn"
  const [projectForm, setProjectForm] = useState({ naam: "", beschrijving: "", startDatum: new Date().toISOString().slice(0,10), werkdagenOnly: false });
  const [showProjectTaakForm, setShowProjectTaakForm] = useState(false);
  const [editProjectTaakId, setEditProjectTaakId] = useState(null);
  const [projectTaakForm, setProjectTaakForm] = useState({ naam: "", duurDagen: 1, afhankelijkheden: [], uitvoerder: "", notitie: "" });
  const [aiAdviesLoading, setAiAdviesLoading] = useState(false);
  const [aiAdviesInput, setAiAdviesInput] = useState("");
  const [showAiAdviesForm, setShowAiAdviesForm] = useState(false);
  const [showKlaarForm, setShowKlaarForm] = useState(false);
  const [klaarTaakId, setKlaarTaakId] = useState(null);
  const [klaarDatum, setKlaarDatum] = useState(new Date().toISOString().slice(0,10));
  const [mijlpalen, setMijlpalenState] = useState([]);
  const [showMijlpaalForm, setShowMijlpaalForm] = useState(false);
  const [mijlpaalForm, setMijlpaalForm] = useState({ naam: "", datum: new Date().toISOString().slice(0,10) });

  const persistData = useCallback((nextObjecten, nextTaken) => {
    lastWriteRef.current = Date.now();
    setObjectenState(nextObjecten);
    setTakenState(nextTaken);
    saveData({ objecten: nextObjecten, taken: nextTaken, projecten, projectTaken, mijlpalen });
  }, [projecten, projectTaken, mijlpalen]);

  const persistProjectData = useCallback((nextProjecten, nextProjectTaken, nextMijlpalen) => {
    lastWriteRef.current = Date.now();
    setProjectenState(nextProjecten);
    setProjectTakenState(nextProjectTaken);
    if (nextMijlpalen !== undefined) setMijlpalenState(nextMijlpalen);
    saveData({ objecten, taken, projecten: nextProjecten, projectTaken: nextProjectTaken, mijlpalen: nextMijlpalen !== undefined ? nextMijlpalen : mijlpalen });
  }, [objecten, taken, mijlpalen]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (Date.now() - lastWriteRef.current < 5000) return;
      const data = await loadData();
      if (active && data) {
        setObjectenState(data.objecten || []);
        setTakenState(data.taken || []);
        setProjectenState(data.projecten || []);
        setProjectTakenState(data.projectTaken || []);
        setMijlpalenState(data.mijlpalen || []);
        setLoading(false);
      } else if (active) setLoading(false);
    };
    refresh();
    const poll = setInterval(refresh, 8000);
    return () => { active = false; clearInterval(poll); };
  }, []);

  // ── Offline detectie ──────────────────────────────────
  useEffect(() => {
    const onOnline  = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  // ── Objecten ──────────────────────────────────────────
  function voegObjectToe() {
    if (!objectForm.naam.trim()) return;
    const nieuw = { ...objectForm, id: uid(), aangemaaktOp: Date.now() };
    persistData([...objecten, nieuw], taken);
    setObjectForm({ naam: "", icoon: "🏠", notitie: "" });
    setShowObjectForm(false);
    showToast(`✅ ${nieuw.naam} toegevoegd`);
  }

  function verwijderObject(id) {
    if (!window.confirm("Object en alle bijbehorende taken verwijderen?")) return;
    persistData(objecten.filter(o => o.id !== id), taken.filter(t => t.objectId !== id));
    if (actieefObjectId === id) setActieefObjectId(null);
  }

  // ── Taken ─────────────────────────────────────────────
  function voegTaakToe() {
    if (!taakForm.naam.trim() || !actieefObjectId) return;
    const nieuw = { ...taakForm, id: uid(), objectId: actieefObjectId, log: [], aangemaaktOp: Date.now() };
    persistData(objecten, [...taken, nieuw]);
    setTaakForm({ naam: "", interval: "Jaarlijks", intervalDagen: 365, kosten: "", uitvoerder: "", notitie: "", volgende: "", laatste: "" });
    setShowTaakForm(false);
    showToast("✅ Taak toegevoegd");
  }

  function verwijderTaak(id) {
    persistData(objecten, taken.filter(t => t.id !== id));
  }

  // ── Log (onderhoud uitvoeren) ─────────────────────────
  function logOnderhoud() {
    if (!logTaakId) return;
    const entry = { ...logForm, id: uid(), datum: logForm.datum };
    // Bereken volgende datum (tijdzone-veilig)
    const taak = taken.find(t => t.id === logTaakId);
    let volgende = "";
    if (taak && taak.intervalDagen > 0) {
      const [j, m, d] = logForm.datum.split("-").map(Number);
      const volgendeDt = new Date(j, m - 1, d + taak.intervalDagen);
      volgende = `${volgendeDt.getFullYear()}-${String(volgendeDt.getMonth()+1).padStart(2,"0")}-${String(volgendeDt.getDate()).padStart(2,"0")}`;
    }
    persistData(
      objecten,
      taken.map(t => t.id === logTaakId
        ? { ...t, log: [...(t.log || []), entry], laatste: logForm.datum, volgende }
        : t)
    );
    setLogForm({ datum: new Date().toISOString().slice(0,10), kosten: "", notitie: "", uitvoerder: "" });
    setShowLogForm(false);
    setLogTaakId(null);
    showToast("✅ Onderhoud geregistreerd");
  }

  // ── Helpers ───────────────────────────────────────────
  function dagenTotVolgende(taak) {
    if (!taak.volgende) return null;
    const d = new Date(taak.volgende);
    const nu = new Date();
    nu.setHours(0,0,0,0);
    return Math.floor((d - nu) / 86400000);
  }

  function urgentieKleur(dagen) {
    if (dagen === null) return C.muted;
    if (dagen < 0) return C.red;
    if (dagen < 30) return C.yellow;
    return C.green;
  }

  function urgentieTekst(dagen) {
    if (dagen === null) return "Nog niet gepland";
    if (dagen < 0) return `${Math.abs(dagen)} dagen over tijd`;
    if (dagen === 0) return "Vandaag";
    if (dagen === 1) return "Morgen";
    return `Over ${dagen} dagen`;
  }

  // Alle taken gesorteerd op urgentie
  function alleTakenGesorteerd() {
    return [...taken].sort((a, b) => {
      const da = dagenTotVolgende(a) ?? 9999;
      const db = dagenTotVolgende(b) ?? 9999;
      return da - db;
    });
  }

  // ── Verbouwplanner: projecten ──────────────────────────
  function voegProjectToe() {
    if (!projectForm.naam.trim()) return;
    if (editProjectId) {
      persistProjectData(projecten.map(p => p.id === editProjectId ? { ...p, ...projectForm } : p), projectTaken);
      showToast(`✅ ${projectForm.naam} bijgewerkt`);
    } else {
      const nieuw = { ...projectForm, id: uid(), status: "actief", aangemaaktOp: Date.now() };
      persistProjectData([...projecten, nieuw], projectTaken);
      setActieefProjectId(nieuw.id);
      showToast(`✅ ${nieuw.naam} aangemaakt`);
    }
    setProjectForm({ naam: "", beschrijving: "", startDatum: new Date().toISOString().slice(0,10), werkdagenOnly: false });
    setShowProjectForm(false);
    setEditProjectId(null);
  }

  function bewerkProject(project) {
    setProjectForm({ naam: project.naam, beschrijving: project.beschrijving || "", startDatum: project.startDatum, werkdagenOnly: !!project.werkdagenOnly });
    setEditProjectId(project.id);
    setShowProjectForm(true);
  }

  function verwijderProject(id) {
    if (!window.confirm("Project en alle bijbehorende taken verwijderen?")) return;
    persistProjectData(projecten.filter(p => p.id !== id), projectTaken.filter(t => t.projectId !== id), mijlpalen.filter(m => m.projectId !== id));
    if (actieefProjectId === id) setActieefProjectId(null);
  }

  // ── Verbouwplanner: taken ──────────────────────────────
  function voegProjectTaakToe() {
    if (!projectTaakForm.naam.trim() || !actieefProjectId) return;
    if (editProjectTaakId) {
      persistProjectData(projecten, projectTaken.map(t => t.id === editProjectTaakId ? { ...t, ...projectTaakForm, duurDagen: +projectTaakForm.duurDagen || 1 } : t));
      showToast("✅ Taak bijgewerkt");
    } else {
      const nieuw = {
        ...projectTaakForm, id: uid(), projectId: actieefProjectId,
        duurDagen: +projectTaakForm.duurDagen || 1,
        werkelijkeStart: null, werkelijkEind: null,
        aangemaaktOp: Date.now(),
      };
      persistProjectData(projecten, [...projectTaken, nieuw]);
      showToast("✅ Taak toegevoegd");
    }
    setProjectTaakForm({ naam: "", duurDagen: 1, afhankelijkheden: [], uitvoerder: "", notitie: "" });
    setShowProjectTaakForm(false);
    setEditProjectTaakId(null);
  }

  function bewerkProjectTaak(taak) {
    setProjectTaakForm({ naam: taak.naam, duurDagen: taak.duurDagen, afhankelijkheden: taak.afhankelijkheden || [], uitvoerder: taak.uitvoerder || "", notitie: taak.notitie || "" });
    setEditProjectTaakId(taak.id);
    setShowProjectTaakForm(true);
  }

  function verwijderProjectTaak(id) {
    // Haal deze taak ook overal als afhankelijkheid weg, anders verwijst er
    // iets naar een taak die niet meer bestaat.
    persistProjectData(
      projecten,
      projectTaken.filter(t => t.id !== id).map(t => ({ ...t, afhankelijkheden: (t.afhankelijkheden || []).filter(d => d !== id) }))
    );
  }

  // Markeert een taak als gestart — vanaf nu telt de ECHTE startdatum mee in
  // de berekening, niet meer de schatting.
  function markeerGestart(taak) {
    persistProjectData(projecten, projectTaken.map(t => t.id === taak.id ? { ...t, werkelijkeStart: fmtDatum(new Date()) } : t));
    showToast(`▶️ ${taak.naam} gestart`);
  }

  // Markeert een taak als klaar op een (evt. handmatig gekozen) datum — dit is
  // het moment waarop vertraging (of juist voorsprong) doorwerkt naar alles
  // wat van deze taak afhankelijk is.
  function markeerKlaar() {
    const taak = projectTaken.find(t => t.id === klaarTaakId);
    if (!taak) return;
    persistProjectData(projecten, projectTaken.map(t => t.id === klaarTaakId
      ? { ...t, werkelijkEind: klaarDatum, werkelijkeStart: t.werkelijkeStart || klaarDatum }
      : t));
    setShowKlaarForm(false);
    setKlaarTaakId(null);
    showToast(`✅ ${taak.naam} afgerond — planning bijgewerkt`);
  }

  function heropenTaak(taak) {
    persistProjectData(projecten, projectTaken.map(t => t.id === taak.id ? { ...t, werkelijkEind: null } : t));
  }

  // Vraagt de AI om, op basis van de taaknamen (en evt. een korte
  // beschrijving van de hele verbouwing), een logische volgorde en
  // afhankelijkheden voor te stellen — generieke bouwkennis die lastig
  // hard te coderen is, omdat elke verbouwing anders is.
  // ── Verbouwplanner: mijlpalen ───────────────────────────
  // Een mijlpaal is een losstaande belangrijke datum (bv. "Keuring gemeente"
  // of "Meubels geleverd") — niet gekoppeld aan een taakduur of
  // afhankelijkheden, gewoon een vaste datum die je op de tijdlijn wil zien.
  function voegMijlpaalToe() {
    if (!mijlpaalForm.naam.trim() || !actieefProjectId) return;
    const nieuw = { ...mijlpaalForm, id: uid(), projectId: actieefProjectId, aangemaaktOp: Date.now() };
    persistProjectData(projecten, projectTaken, [...mijlpalen, nieuw]);
    setMijlpaalForm({ naam: "", datum: new Date().toISOString().slice(0,10) });
    setShowMijlpaalForm(false);
    showToast(`🚩 ${nieuw.naam} toegevoegd`);
  }

  function verwijderMijlpaal(id) {
    persistProjectData(projecten, projectTaken, mijlpalen.filter(m => m.id !== id));
  }

  async function vraagAiAdvies() {
    const huidigeTaken = projectTaken.filter(t => t.projectId === actieefProjectId);
    if (huidigeTaken.length < 2) { showToast("⚠️ Voeg eerst minstens 2 taken toe"); return; }
    setAiAdviesLoading(true);
    try {
      const taaklijst = huidigeTaken.map(t => `- ${t.naam} (id: ${t.id})`).join("\n");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Dit zijn de taken van een verbouwing${aiAdviesInput.trim() ? `: "${aiAdviesInput.trim()}"` : ""}:\n${taaklijst}\n\n` +
            `Stel op basis van algemene bouwkennis (sloop vóór ruwbouw, leidingwerk/elektra vóór wandafwerking, vloerverwarming vóór vloerbedekking, schilderen als laatste, etc.) voor elke taak een realistische geschatte duur in dagen voor, en welke andere taken (uit deze lijst) eerst af moeten zijn (afhankelijkheden). ` +
            `Gebruik ALLEEN de gegeven id's. Geef ALLEEN geldige JSON terug, geen uitleg of markdown:\n` +
            `{"taken": [{"id": "...", "duurDagen": 3, "afhankelijkheden": ["id1","id2"]}]}`,
          bron: "onderhoud-verbouwplanner-advies",
          maxTokens: 1500,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI mislukt");
      const clean = data.text.replace(/```json|```/g, "").trim();
      const advies = JSON.parse(clean).taken || [];
      const perId = Object.fromEntries(advies.map(a => [a.id, a]));
      persistProjectData(projecten, projectTaken.map(t => perId[t.id]
        ? { ...t, duurDagen: perId[t.id].duurDagen || t.duurDagen, afhankelijkheden: (perId[t.id].afhankelijkheden || []).filter(id => huidigeTaken.some(h => h.id === id)) }
        : t));
      showToast("✨ Volgorde en duur voorgesteld — controleer en pas aan waar nodig");
      setShowAiAdviesForm(false);
      setAiAdviesInput("");
    } catch (e) {
      showToast("❌ Kon geen advies ophalen, probeer het opnieuw");
    }
    setAiAdviesLoading(false);
  }

  if (loading) return (
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <span style={{ fontSize: 40 }}>🔧</span>
        <div style={{ display: "flex", gap: 6 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.purple, opacity: 0.3, animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}`}</style>
      </div>
    </div>
  );

  const actieefObject = objecten.find(o => o.id === actieefObjectId);
  const objectTaken = taken.filter(t => t.objectId === actieefObjectId);

  // ════════════════════════
  // OBJECT DETAIL
  // ════════════════════════
  if (actieefObject) {
    return (
      <div style={S.appBg}>
        {toast && <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", background:C.purple, color:"#FFF", padding:"9px 20px", borderRadius:10, fontWeight:700, zIndex:999, fontSize:13 }}>{toast}</div>}

        {/* Log overlay */}
        {showLogForm && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:100, display:"flex", alignItems:"flex-end" }} onClick={() => setShowLogForm(false)}>
            <div style={{ background:"#FFF", width:"100%", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20 }} onClick={e => e.stopPropagation()}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <p style={{ margin:0, fontWeight:700, fontSize:15, color:C.purple }}>✅ Onderhoud registreren</p>
                <button onClick={() => setShowLogForm(false)} aria-label="Sluiten"
                  style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                  <X size={18} color={C.muted} />
                </button>
              </div>
              <p style={{ margin:"0 0 10px", fontSize:13, color:C.muted }}>{taken.find(t=>t.id===logTaakId)?.naam}</p>
              <input style={{ ...S.inp, marginBottom:10 }} type="date" value={logForm.datum} onChange={e=>setLogForm(f=>({...f,datum:e.target.value}))} />
              <input style={{ ...S.inp, marginBottom:10 }} placeholder="Kosten (€)" type="number" value={logForm.kosten} onChange={e=>setLogForm(f=>({...f,kosten:e.target.value}))} />
              <input style={{ ...S.inp, marginBottom:10 }} placeholder="Uitvoerder (zelf / bedrijf)" value={logForm.uitvoerder} onChange={e=>setLogForm(f=>({...f,uitvoerder:e.target.value}))} />
              <textarea style={{ ...S.inp, height:60, resize:"none", marginBottom:14 }} placeholder="Notities" value={logForm.notitie} onChange={e=>setLogForm(f=>({...f,notitie:e.target.value}))} />
              <div style={{ display:"flex", gap:10 }}>
                <button style={{ ...S.btn(C.card, C.text), border:`1px solid ${C.border}`, flex:1 }} onClick={() => setShowLogForm(false)}>Annuleer</button>
                <button style={{ ...S.btn(), flex:2 }} onClick={logOnderhoud}>Opslaan</button>
              </div>
            </div>
          </div>
        )}

        {/* Taak toevoegen overlay */}
        {showTaakForm && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:100, display:"flex", alignItems:"flex-end" }} onClick={() => setShowTaakForm(false)}>
            <div style={{ background:"#FFF", width:"100%", maxHeight:"85vh", overflowY:"auto", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20, boxSizing:"border-box" }} onClick={e => e.stopPropagation()}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <p style={{ margin:0, fontWeight:700, fontSize:15, color:C.purple }}>+ Nieuwe onderhoudstaak</p>
                <button onClick={() => setShowTaakForm(false)} aria-label="Sluiten"
                  style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                  <X size={18} color={C.muted} />
                </button>
              </div>
              <input style={{ ...S.inp, marginBottom:10 }} placeholder="Naam (bv. CV-ketel onderhoud)" value={taakForm.naam} onChange={e=>setTaakForm(f=>({...f,naam:e.target.value}))} autoFocus />
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Herhaalinterval</label>
                <select style={S.inp} value={taakForm.interval} onChange={e => {
                  const int = INTERVALLEN.find(i => i.label === e.target.value);
                  setTaakForm(f => ({ ...f, interval: e.target.value, intervalDagen: int?.dagen || 0 }));
                }}>
                  {INTERVALLEN.map(i => <option key={i.label}>{i.label}</option>)}
                </select>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                <div>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Laatste uitgevoerd</label>
                  <input style={S.inp} type="date" value={taakForm.laatste} onChange={e=>setTaakForm(f=>({...f,laatste:e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Volgende gepland</label>
                  <input style={S.inp} type="date" value={taakForm.volgende} onChange={e=>setTaakForm(f=>({...f,volgende:e.target.value}))} />
                </div>
              </div>
              <input style={{ ...S.inp, marginBottom:10 }} placeholder="Geschatte kosten (€)" type="number" value={taakForm.kosten} onChange={e=>setTaakForm(f=>({...f,kosten:e.target.value}))} />
              <input style={{ ...S.inp, marginBottom:10 }} placeholder="Uitvoerder (zelf / bedrijf)" value={taakForm.uitvoerder} onChange={e=>setTaakForm(f=>({...f,uitvoerder:e.target.value}))} />
              <textarea style={{ ...S.inp, height:60, resize:"none", marginBottom:14 }} placeholder="Notities" value={taakForm.notitie} onChange={e=>setTaakForm(f=>({...f,notitie:e.target.value}))} />
              <div style={{ display:"flex", gap:10 }}>
                <button style={{ ...S.btn(C.card, C.text), border:`1px solid ${C.border}`, flex:1 }} onClick={() => setShowTaakForm(false)}>Annuleer</button>
                <button style={{ ...S.btn(), flex:2 }} onClick={voegTaakToe}>Taak toevoegen</button>
              </div>
            </div>
          </div>
        )}

        <header style={{ ...S.header, alignItems:"center" }}>
          <button style={{ background:"none", border:"none", cursor:"pointer" }} onClick={() => setActieefObjectId(null)}>
            <ChevronLeft size={20} color={C.purple} />
          </button>
          <h1 style={{ ...S.title, fontSize:20, margin:0 }}>{actieefObject.icoon} {actieefObject.naam}</h1>
          <button style={{ background:"none", border:"none", cursor:"pointer" }} onClick={() => verwijderObject(actieefObject.id)}>
            <X size={18} color={C.muted} />
          </button>
        </header>

        <main style={S.main}>
          {actieefObject.notitie && (
            <p style={{ fontSize:13, color:C.muted, margin:"0 0 14px", padding:"10px 14px", background:C.card, borderRadius:12 }}>{actieefObject.notitie}</p>
          )}

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:C.purple }}>Onderhoudstaken</h3>
            <button style={{ ...S.btn(), fontSize:12, padding:"7px 14px" }} onClick={() => setShowTaakForm(true)}>+ Taak</button>
          </div>

          {objectTaken.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:C.muted }}>
              <p style={{ fontSize:14 }}>Nog geen taken — voeg je eerste toe</p>
            </div>
          ) : objectTaken.map(taak => {
            const dagen = dagenTotVolgende(taak);
            const kleur = urgentieKleur(dagen);
            const log = taak.log || [];
            return (
              <div key={taak.id} style={{ ...S.card, marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ flex:1 }}>
                    <p style={{ margin:"0 0 3px", fontWeight:700, fontSize:14 }}>{taak.naam}</p>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      <span style={{ fontSize:11, color:C.muted }}>🔄 {taak.interval}</span>
                      {taak.kosten && <span style={{ fontSize:11, color:C.muted }}>€ {taak.kosten}</span>}
                      {taak.uitvoerder && <span style={{ fontSize:11, color:C.muted }}>👤 {taak.uitvoerder}</span>}
                    </div>
                  </div>
                  <button style={{ background:"none", border:"none", cursor:"pointer", padding:4 }} onClick={() => verwijderTaak(taak.id)}>
                    <X size={14} color={C.muted} />
                  </button>
                </div>

                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderTop:`1px solid ${C.border}` }}>
                  <div>
                    {taak.laatste && <p style={{ margin:0, fontSize:12, color:C.muted }}>Laatste: {taak.laatste}</p>}
                    <p style={{ margin:0, fontSize:12, fontWeight:600, color:kleur }}>{urgentieTekst(dagen)}</p>
                  </div>
                  <button style={{ ...S.btn(), fontSize:12, padding:"7px 14px" }}
                    onClick={() => { setLogTaakId(taak.id); setShowLogForm(true); }}>
                    ✅ Klaar
                  </button>
                </div>

                {/* Log geschiedenis */}
                {log.length > 0 && (
                  <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8, marginTop:4 }}>
                    <p style={{ margin:"0 0 6px", fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.04em" }}>Historie</p>
                    {log.slice(-3).reverse().map((entry, i) => (
                      <div key={i} style={{ fontSize:12, color:C.muted, display:"flex", gap:8, padding:"3px 0" }}>
                        <span>{entry.datum}</span>
                        {entry.kosten && <span>€ {entry.kosten}</span>}
                        {entry.uitvoerder && <span>· {entry.uitvoerder}</span>}
                        {entry.notitie && <span>· {entry.notitie}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </main>

        <button style={S.fab} onClick={() => setShowTaakForm(true)}>
          <Plus size={22} color="#FFFFFF" strokeWidth={2.4} />
        </button>
      </div>
    );
  }

  // ════════════════════════
  // HOOFD OVERZICHT
  // ════════════════════════
  const spoedTaken = alleTakenGesorteerd().filter(t => {
    const d = dagenTotVolgende(t);
    return d !== null && d <= 30;
  });

  return (
    <div style={S.appBg}>
      {toast && <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", background:C.purple, color:"#FFF", padding:"9px 20px", borderRadius:10, fontWeight:700, zIndex:999, fontSize:13 }}>{toast}</div>}
      {offline && (
        <div style={{ background:"#C86E4A", color:"#FFF", padding:"8px 16px", fontSize:12, fontWeight:600, textAlign:"center" }}>
          📡 Geen verbinding — je ziet de laatst opgehaalde gegevens. Wijzigen kan pas weer zodra je online bent.
        </div>
      )}

      {/* Object toevoegen overlay */}
      {showObjectForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:100, display:"flex", alignItems:"flex-end" }} onClick={() => setShowObjectForm(false)}>
          <div style={{ background:"#FFF", width:"100%", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <p style={{ margin:0, fontWeight:700, fontSize:15, color:C.purple }}>+ Nieuw object</p>
              <button onClick={() => setShowObjectForm(false)} aria-label="Sluiten"
                style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                <X size={18} color={C.muted} />
              </button>
            </div>
            <input style={{ ...S.inp, marginBottom:10 }} placeholder="Naam (bv. Woning, Camper, Auto)" value={objectForm.naam} onChange={e=>setObjectForm(f=>({...f,naam:e.target.value}))} autoFocus />
            <p style={{ fontSize:11, color:C.muted, margin:"0 0 8px" }}>Icoon</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
              {OBJECT_ICONEN.map(ic => (
                <button key={ic} onClick={() => setObjectForm(f=>({...f,icoon:ic}))}
                  style={{ width:38, height:38, borderRadius:10, border:objectForm.icoon===ic?"2px solid "+C.purple:"1px solid "+C.border, background:objectForm.icoon===ic?"#FFFFFF":C.card, fontSize:18, cursor:"pointer" }}>
                  {ic}
                </button>
              ))}
            </div>
            <textarea style={{ ...S.inp, height:60, resize:"none", marginBottom:14 }} placeholder="Notities (bouwjaar, kenteken, etc.)" value={objectForm.notitie} onChange={e=>setObjectForm(f=>({...f,notitie:e.target.value}))} />
            <div style={{ display:"flex", gap:10 }}>
              <button style={{ ...S.btn(C.card, C.text), border:`1px solid ${C.border}`, flex:1 }} onClick={() => setShowObjectForm(false)}>Annuleer</button>
              <button style={{ ...S.btn(), flex:2 }} onClick={voegObjectToe}>Toevoegen</button>
            </div>
          </div>
        </div>
      )}

      {/* Nieuw / bewerk verbouwproject */}
      {showProjectForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:100, display:"flex", alignItems:"flex-end" }} onClick={() => { setShowProjectForm(false); setEditProjectId(null); }}>
          <div style={{ background:"#FFF", width:"100%", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <p style={{ margin:0, fontWeight:700, fontSize:15, color:C.purple }}>{editProjectId ? "✏️ Project bewerken" : "+ Nieuw verbouwproject"}</p>
              <button onClick={() => { setShowProjectForm(false); setEditProjectId(null); }} aria-label="Sluiten" style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                <X size={18} color={C.muted} />
              </button>
            </div>
            <input style={{ ...S.inp, marginBottom:10 }} placeholder="Naam (bv. Verbouwing keuken)" value={projectForm.naam} onChange={e=>setProjectForm(f=>({...f,naam:e.target.value}))} autoFocus />
            <textarea style={{ ...S.inp, height:60, resize:"none", marginBottom:10 }} placeholder="Korte beschrijving (optioneel)" value={projectForm.beschrijving} onChange={e=>setProjectForm(f=>({...f,beschrijving:e.target.value}))} />
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Startdatum</label>
            <input style={{ ...S.inp, marginBottom:6 }} type="date" value={projectForm.startDatum} onChange={e=>setProjectForm(f=>({...f,startDatum:e.target.value}))} />
            {editProjectId && (
              <p style={{ fontSize:11, color:C.muted, margin:"0 0 14px", lineHeight:1.5 }}>
                ℹ️ Alle taken zonder eigen gestarte/afgeronde datum herberekenen automatisch mee vanaf deze nieuwe startdatum.
              </p>
            )}
            <button type="button" onClick={() => setProjectForm(f => ({ ...f, werkdagenOnly: !f.werkdagenOnly }))}
              style={{ display:"flex", alignItems:"center", gap:10, width:"100%", background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"11px 14px", marginBottom:14, cursor:"pointer", textAlign:"left" }}>
              <span role="checkbox" aria-checked={projectForm.werkdagenOnly} style={{ width:20, height:20, borderRadius:6, border:`2px solid ${projectForm.werkdagenOnly?C.purple:C.border}`, background:projectForm.werkdagenOnly?C.purple:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {projectForm.werkdagenOnly && <Check size={13} color="#FFF" />}
              </span>
              <span>
                <span style={{ display:"block", fontSize:13, fontWeight:600, color:C.text }}>📅 Alleen werkdagen (ma–vr)</span>
                <span style={{ display:"block", fontSize:11, color:C.muted }}>Taken lopen niet door in het weekend</span>
              </span>
            </button>
            <div style={{ display:"flex", gap:10 }}>
              <button style={{ ...S.btn(C.card, C.text), border:`1px solid ${C.border}`, flex:1 }} onClick={() => { setShowProjectForm(false); setEditProjectId(null); }}>Annuleer</button>
              <button style={{ ...S.btn(), flex:2 }} onClick={voegProjectToe}>{editProjectId ? "Opslaan" : "Aanmaken"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Taak toevoegen/bewerken binnen een verbouwproject */}
      {showProjectTaakForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:100, display:"flex", alignItems:"flex-end" }}
          onClick={() => { setShowProjectTaakForm(false); setEditProjectTaakId(null); }}>
          <div style={{ background:"#FFF", width:"100%", maxHeight:"85vh", overflowY:"auto", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <p style={{ margin:0, fontWeight:700, fontSize:15, color:C.purple }}>{editProjectTaakId ? "Taak bewerken" : "+ Nieuwe taak"}</p>
              <button onClick={() => { setShowProjectTaakForm(false); setEditProjectTaakId(null); }} aria-label="Sluiten" style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                <X size={18} color={C.muted} />
              </button>
            </div>
            <input style={{ ...S.inp, marginBottom:10 }} placeholder="Naam (bv. Sloopwerk, Elektra, Tegelwerk)" value={projectTaakForm.naam} onChange={e=>setProjectTaakForm(f=>({...f,naam:e.target.value}))} autoFocus />
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Geschatte duur (dagen)</label>
            <input style={{ ...S.inp, marginBottom:10 }} type="number" min="1" value={projectTaakForm.duurDagen} onChange={e=>setProjectTaakForm(f=>({...f,duurDagen:e.target.value}))} />
            <input style={{ ...S.inp, marginBottom:10 }} placeholder="Uitvoerder (optioneel — jijzelf, aannemer, etc.)" value={projectTaakForm.uitvoerder} onChange={e=>setProjectTaakForm(f=>({...f,uitvoerder:e.target.value}))} />

            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>Moet eerst af zijn (afhankelijkheden)</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
              {projectTaken.filter(t => t.projectId === actieefProjectId && t.id !== editProjectTaakId).length === 0 && (
                <p style={{ fontSize:12, color:C.muted, margin:0 }}>Nog geen andere taken om aan te koppelen.</p>
              )}
              {projectTaken.filter(t => t.projectId === actieefProjectId && t.id !== editProjectTaakId).map(t => {
                const actief = (projectTaakForm.afhankelijkheden||[]).includes(t.id);
                return (
                  <button key={t.id} style={{ border:`1px solid ${actief?C.purple:C.border}`, background:actief?C.purple:"transparent", color:actief?"#FFF":C.muted, borderRadius:20, padding:"5px 12px", fontSize:12, cursor:"pointer" }}
                    onClick={() => setProjectTaakForm(f => ({ ...f, afhankelijkheden: actief ? f.afhankelijkheden.filter(id=>id!==t.id) : [...(f.afhankelijkheden||[]), t.id] }))}>
                    {t.naam}
                  </button>
                );
              })}
            </div>
            <textarea style={{ ...S.inp, height:60, resize:"none", marginBottom:14 }} placeholder="Notities (optioneel)" value={projectTaakForm.notitie} onChange={e=>setProjectTaakForm(f=>({...f,notitie:e.target.value}))} />
            <div style={{ display:"flex", gap:10 }}>
              <button style={{ ...S.btn(C.card, C.text), border:`1px solid ${C.border}`, flex:1 }} onClick={() => { setShowProjectTaakForm(false); setEditProjectTaakId(null); }}>Annuleer</button>
              <button style={{ ...S.btn(), flex:2 }} onClick={voegProjectTaakToe}>{editProjectTaakId ? "Opslaan" : "Toevoegen"}</button>
            </div>
          </div>
        </div>
      )}

      {/* AI-advies voor volgorde & duur */}
      {showAiAdviesForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:100, display:"flex", alignItems:"flex-end" }}
          onClick={() => !aiAdviesLoading && setShowAiAdviesForm(false)}>
          <div style={{ background:"#FFF", width:"100%", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <p style={{ margin:0, fontWeight:700, fontSize:15, color:C.purple }}>✨ AI-advies: volgorde &amp; duur</p>
              {!aiAdviesLoading && (
                <button onClick={() => setShowAiAdviesForm(false)} aria-label="Sluiten" style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                  <X size={18} color={C.muted} />
                </button>
              )}
            </div>
            <p style={{ fontSize:12, color:C.muted, margin:"0 0 12px", lineHeight:1.6 }}>
              De AI bekijkt je huidige taken en stelt op basis van algemene bouwkennis (sloop vóór ruwbouw, elektra vóór afwerking, etc.) een duur en logische afhankelijkheden voor. Je kunt daarna alles nog handmatig aanpassen.
            </p>
            <textarea style={{ ...S.inp, height:70, resize:"none", marginBottom:14 }} placeholder="Extra context (optioneel), bv. 'volledige renovatie van de badkamer'" value={aiAdviesInput} onChange={e=>setAiAdviesInput(e.target.value)} />
            <button style={{ ...S.btn(C.purple), width:"100%" }} onClick={vraagAiAdvies} disabled={aiAdviesLoading}>
              {aiAdviesLoading ? "🤖 Advies wordt bedacht…" : "Advies toepassen"}
            </button>
          </div>
        </div>
      )}

      {/* Taak klaar melden */}
      {showKlaarForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:100, display:"flex", alignItems:"flex-end" }}
          onClick={() => setShowKlaarForm(false)}>
          <div style={{ background:"#FFF", width:"100%", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <p style={{ margin:0, fontWeight:700, fontSize:15, color:C.green }}>✅ Taak afronden</p>
              <button onClick={() => setShowKlaarForm(false)} aria-label="Sluiten" style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                <X size={18} color={C.muted} />
              </button>
            </div>
            <p style={{ fontSize:12, color:C.muted, margin:"0 0 10px" }}>
              Op welke datum was deze taak echt klaar? Wijkt dit af van de planning, dan schuift de rest van het project automatisch mee.
            </p>
            <input style={{ ...S.inp, marginBottom:14 }} type="date" value={klaarDatum} onChange={e=>setKlaarDatum(e.target.value)} />
            <button style={{ ...S.btn(C.green), width:"100%" }} onClick={markeerKlaar}>Afronden</button>
          </div>
        </div>
      )}

      {/* Mijlpaal toevoegen */}
      {showMijlpaalForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:100, display:"flex", alignItems:"flex-end" }}
          onClick={() => setShowMijlpaalForm(false)}>
          <div style={{ background:"#FFF", width:"100%", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <p style={{ margin:0, fontWeight:700, fontSize:15, color:C.orange }}>🚩 Nieuwe mijlpaal</p>
              <button onClick={() => setShowMijlpaalForm(false)} aria-label="Sluiten" style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                <X size={18} color={C.muted} />
              </button>
            </div>
            <p style={{ fontSize:12, color:C.muted, margin:"0 0 12px" }}>
              Een losse belangrijke datum, niet gekoppeld aan een taakduur — bijvoorbeeld een keuring, levering, of de opleverdatum zelf.
            </p>
            <input style={{ ...S.inp, marginBottom:10 }} placeholder="Naam (bv. Keuring gemeente)" value={mijlpaalForm.naam} onChange={e=>setMijlpaalForm(f=>({...f,naam:e.target.value}))} autoFocus />
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Datum</label>
            <input style={{ ...S.inp, marginBottom:14 }} type="date" value={mijlpaalForm.datum} onChange={e=>setMijlpaalForm(f=>({...f,datum:e.target.value}))} />
            <button style={{ ...S.btn(C.orange), width:"100%" }} onClick={voegMijlpaalToe}>Toevoegen</button>
          </div>
        </div>
      )}

      <header style={S.header}>
        <div>
          <Link href="/" style={S.switchBtn}>← Overzicht</Link>
          <h1 style={S.title}>🔧 Onderhoudslog</h1>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:4, background:"#FFFFFF", borderRadius:12, margin:"0 20px 16px", border:`1px solid ${C.border}`, padding:"4px" }}>
        {[["objecten","🏠 Objecten"],["overzicht","📅 Planning"],["kosten","💰 Kosten"],["verbouwing","🏗️ Verbouwing"]].map(([t,l]) => (
          <button key={t} style={{ flex:"1 1 45%", border:"none", background:tab===t?C.purple:"transparent", color:tab===t?"#FFF":C.muted, borderRadius:9, padding:"9px 0", fontSize:12, fontWeight:600, cursor:"pointer" }} onClick={()=>setTab(t)}>{l}</button>
        ))}
      </div>

      <main style={S.main}>
        {tab === "objecten" && (
          <>
            {objecten.length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 20px" }}>
                <div style={{ fontSize:48, marginBottom:16 }}>🔧</div>
                <p style={{ fontWeight:700, fontSize:17, color:C.purple, margin:"0 0 6px" }}>Nog geen objecten</p>
                <p style={{ fontSize:14, color:C.muted, margin:0 }}>Voeg je woning, camper of auto toe</p>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 }}>
                {objecten.map(obj => {
                  const objTaken = taken.filter(t => t.objectId === obj.id);
                  const spoed = objTaken.filter(t => {
                    const d = dagenTotVolgende(t);
                    return d !== null && d <= 30;
                  }).length;
                  return (
                    <div key={obj.id} style={{ ...S.card, cursor:"pointer" }} onClick={() => setActieefObjectId(obj.id)}>
                      <div style={{ fontSize:32, marginBottom:10 }}>{obj.icoon}</div>
                      <p style={{ margin:"0 0 4px", fontWeight:700, fontSize:15, color:C.text }}>{obj.naam}</p>
                      <p style={{ margin:0, fontSize:12, color:C.muted }}>{objTaken.length} taken</p>
                      {spoed > 0 && <p style={{ margin:"4px 0 0", fontSize:11, color:C.yellow, fontWeight:600 }}>⚠️ {spoed} binnenkort</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "overzicht" && (
          <>
            <h3 style={{ margin:"0 0 4px", fontSize:15, fontWeight:700, color:C.purple }}>Komende 30 dagen</h3>
            <p style={{ margin:"0 0 14px", fontSize:12, color:C.muted }}>Alle taken gesorteerd op urgentie</p>
            {alleTakenGesorteerd().length === 0 ? (
              <p style={{ color:C.muted, textAlign:"center", padding:"40px 0", fontSize:14 }}>Geen taken gepland</p>
            ) : alleTakenGesorteerd().map(taak => {
              const obj = objecten.find(o => o.id === taak.objectId);
              const dagen = dagenTotVolgende(taak);
              const kleur = urgentieKleur(dagen);
              return (
                <div key={taak.id} style={{ ...S.card, display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}
                  onClick={() => setActieefObjectId(taak.objectId)}>
                  <span style={{ fontSize:24 }}>{obj?.icoon || "🔧"}</span>
                  <div style={{ flex:1 }}>
                    <p style={{ margin:"0 0 2px", fontWeight:600, fontSize:14 }}>{taak.naam}</p>
                    <p style={{ margin:0, fontSize:12, color:C.muted }}>{obj?.naam} · {taak.interval}</p>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <p style={{ margin:0, fontSize:12, fontWeight:700, color:kleur }}>{urgentieTekst(dagen)}</p>
                    {taak.kosten && <p style={{ margin:"2px 0 0", fontSize:11, color:C.muted }}>€ {taak.kosten}</p>}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === "kosten" && (() => {
          // Bereken kosten per object en totaal
          const huidigJaar = new Date().getFullYear();
          const kostenPerObject = objecten.map(obj => {
            const objTaken = taken.filter(t => t.objectId === obj.id);
            // Werkelijke kosten: uit log-entries van dit jaar
            const werkelijk = objTaken.reduce((sum, taak) => {
              const logDitJaar = (taak.log || []).filter(e => e.datum?.startsWith(String(huidigJaar)));
              return sum + logDitJaar.reduce((s, e) => s + (+e.kosten || 0), 0);
            }, 0);
            // Verwachte kosten: op basis van ingestelde kosten per taak × frequentie
            const verwacht = objTaken.reduce((sum, taak) => {
              if (!taak.kosten || !taak.intervalDagen || taak.intervalDagen === 0) return sum;
              const keerPerJaar = 365 / taak.intervalDagen;
              return sum + (+taak.kosten * keerPerJaar);
            }, 0);
            const taakDetails = objTaken
              .filter(t => t.kosten || (t.log||[]).some(e => e.kosten))
              .map(t => ({
                naam: t.naam,
                interval: t.interval,
                geschat: +t.kosten || 0,
                werkelijk: (t.log||[]).filter(e => e.datum?.startsWith(String(huidigJaar))).reduce((s,e) => s + (+e.kosten||0), 0),
              }));
            return { obj, werkelijk, verwacht, taakDetails };
          });

          const totaalWerkelijk = kostenPerObject.reduce((s,o) => s + o.werkelijk, 0);
          const totaalVerwacht = kostenPerObject.reduce((s,o) => s + o.verwacht, 0);

          return (
            <>
              <h3 style={{ margin:"0 0 4px", fontSize:15, fontWeight:700, color:C.purple }}>💰 Kostenoverzicht {huidigJaar}</h3>
              <p style={{ margin:"0 0 14px", fontSize:12, color:C.muted }}>Werkelijke kosten dit jaar + verwachte jaarkosten</p>

              {/* Totaalbalk */}
              <div style={{ ...S.card, background:`${C.purple}10`, border:`1px solid ${C.purple}44`, marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:22, fontWeight:800, color:C.purple }}>€ {totaalWerkelijk.toFixed(0)}</div>
                    <div style={{ fontSize:11, color:C.muted }}>Werkelijk {huidigJaar}</div>
                  </div>
                  <div style={{ width:1, background:C.border }} />
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:22, fontWeight:800, color:C.muted }}>€ {totaalVerwacht.toFixed(0)}</div>
                    <div style={{ fontSize:11, color:C.muted }}>Verwacht per jaar</div>
                  </div>
                </div>
              </div>

              {/* Per object */}
              {kostenPerObject.map(({ obj, werkelijk, verwacht, taakDetails }) => (
                <div key={obj.id} style={{ ...S.card, marginBottom:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                    <span style={{ fontSize:22 }}>{obj.icoon}</span>
                    <div style={{ flex:1 }}>
                      <p style={{ margin:0, fontWeight:700, fontSize:14 }}>{obj.naam}</p>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:15, fontWeight:700, color:C.purple }}>€ {werkelijk.toFixed(0)}</div>
                      <div style={{ fontSize:11, color:C.muted }}>~ € {verwacht.toFixed(0)}/jr</div>
                    </div>
                  </div>
                  {taakDetails.length > 0 && (
                    <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8 }}>
                      {taakDetails.map((t, i) => (
                        <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                          <div>
                            <span style={{ fontSize:13 }}>{t.naam}</span>
                            <span style={{ fontSize:11, color:C.muted, marginLeft:6 }}>{t.interval}</span>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            {t.werkelijk > 0 && <span style={{ fontSize:13, fontWeight:600, color:C.purple }}>€ {t.werkelijk.toFixed(0)} </span>}
                            {t.geschat > 0 && <span style={{ fontSize:11, color:C.muted }}>(€ {t.geschat}/keer)</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {taakDetails.length === 0 && (
                    <p style={{ fontSize:12, color:C.muted, margin:0, borderTop:`1px solid ${C.border}`, paddingTop:8 }}>Geen kosten geregistreerd</p>
                  )}
                </div>
              ))}

              {objecten.length === 0 && (
                <p style={{ color:C.muted, textAlign:"center", padding:"40px 0", fontSize:14 }}>Voeg eerst objecten toe</p>
              )}
            </>
          );
        })()}

        {tab === "verbouwing" && (() => {
          const project = projecten.find(p => p.id === actieefProjectId);

          // ── Projectenlijst (geen project geopend) ──
          if (!project) {
            return (
              <>
                <h3 style={{ margin:"0 0 4px", fontSize:15, fontWeight:700, color:C.purple }}>🏗️ Verbouwplanning</h3>
                <p style={{ margin:"0 0 14px", fontSize:12, color:C.muted }}>Taken met onderlinge afhankelijkheden — loopt er iets uit, dan schuift de rest automatisch mee</p>
                {projecten.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"60px 20px" }}>
                    <div style={{ fontSize:48, marginBottom:16 }}>🏗️</div>
                    <p style={{ fontWeight:700, fontSize:17, color:C.purple, margin:"0 0 6px" }}>Nog geen verbouwproject</p>
                    <p style={{ fontSize:14, color:C.muted, margin:0 }}>Tik + om je verbouwplanning te starten</p>
                  </div>
                ) : projecten.map(p => {
                  const pTaken = projectTaken.filter(t => t.projectId === p.id);
                  const klaar = pTaken.filter(t => t.werkelijkEind).length;
                  return (
                    <div key={p.id} style={{ ...S.card, cursor:"pointer" }} onClick={() => setActieefProjectId(p.id)}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div>
                          <p style={{ margin:"0 0 4px", fontWeight:700, fontSize:15, color:C.text }}>{p.naam}</p>
                          <p style={{ margin:0, fontSize:12, color:C.muted }}>{pTaken.length} taken · {klaar} klaar</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); verwijderProject(p.id); }} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", padding:4 }}>
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            );
          }

          // ── Projectdetail: tijdlijn met automatische herplanning ──
          const pTaken = projectTaken.filter(t => t.projectId === project.id);
          const pMijlpalen = mijlpalen.filter(m => m.projectId === project.id).sort((a,b) => a.datum.localeCompare(b.datum));
          const actueelSchema = berekenSchema(pTaken, project.startDatum, true, project.werkdagenOnly);
          const basisSchema = berekenSchema(pTaken, project.startDatum, false, project.werkdagenOnly);
          const speling = berekenKritiekPad(pTaken, actueelSchema, project.werkdagenOnly);
          const vandaag = fmtDatum(new Date());

          const taakInfo = pTaken.map(t => {
            const act = actueelSchema[t.id];
            const basis = basisSchema[t.id];
            const vertragingDagen = act && basis ? dagVerschil(fmtDatum(act.eind), fmtDatum(basis.eind)) : 0;
            const status = t.werkelijkEind ? "klaar" : t.werkelijkeStart ? "bezig" : "todo";
            const kritiek = status !== "klaar" && (speling[t.id] ?? 0) === 0;
            return { taak: t, start: act?.start, eind: act?.eind, vertragingDagen, status, kritiek, speling: speling[t.id] ?? 0 };
          }).sort((a,b) => (a.start||0) - (b.start||0));

          const projectEind = taakInfo.length ? taakInfo.reduce((max, ti) => ti.eind > max ? ti.eind : max, taakInfo[0].eind) : null;
          const totaalVertraging = taakInfo.length ? Math.max(...taakInfo.map(ti => ti.vertragingDagen), 0) : 0;

          return (
            <>
              <button style={{ background:"none", border:"none", color:C.muted, fontSize:12, fontWeight:600, cursor:"pointer", padding:0, marginBottom:10 }}
                onClick={() => setActieefProjectId(null)}>← Alle projecten</button>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                    <h3 style={{ margin:"0 0 4px", fontSize:17, fontWeight:800, color:C.purple }}>{project.naam}</h3>
                    {project.werkdagenOnly && (
                      <span style={{ fontSize:10, fontWeight:700, color:C.purple, background:`${C.purple}18`, borderRadius:20, padding:"2px 8px" }}>📅 werkdagen</span>
                    )}
                  </div>
                  {project.beschrijving && <p style={{ margin:"0 0 10px", fontSize:13, color:C.muted }}>{project.beschrijving}</p>}
                </div>
                <button style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:9, padding:"6px 11px", fontSize:12, fontWeight:600, color:C.text, cursor:"pointer", whiteSpace:"nowrap" }}
                  onClick={() => bewerkProject(project)}>✏️ Bewerk</button>
              </div>

              {/* Samenvattingskaart */}
              {projectEind && (
                <div style={{ ...S.card, background:`${C.purple}10`, border:`1px solid ${C.purple}44` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <p style={{ margin:"0 0 2px", fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.04em" }}>Verwachte oplevering</p>
                      <p style={{ margin:0, fontSize:18, fontWeight:800, color:C.purple }}>{fmtDatum(projectEind)}</p>
                    </div>
                    {totaalVertraging > 0 && (
                      <div style={{ textAlign:"right" }}>
                        <p style={{ margin:"0 0 2px", fontSize:11, color:C.red, fontWeight:700 }}>⚠️ {totaalVertraging}d vertraging</p>
                        <p style={{ margin:0, fontSize:10, color:C.muted }}>t.o.v. oorspronkelijke inschatting</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                <button style={{ ...S.btn(C.card, C.purple), border:`1px solid ${C.border}`, flex:1, fontSize:13 }}
                  onClick={() => setShowAiAdviesForm(true)}>
                  ✨ AI-advies
                </button>
                <button style={{ ...S.btn(C.card, C.purple), border:`1px solid ${C.border}`, flex:1, fontSize:13 }}
                  onClick={() => { setMijlpaalForm({ naam: "", datum: vandaag }); setShowMijlpaalForm(true); }}>
                  🚩 Mijlpaal
                </button>
              </div>

              {pTaken.length === 0 && (
                <p style={{ color:C.muted, textAlign:"center", padding:"30px 0", fontSize:14 }}>Nog geen taken — tik + om te beginnen</p>
              )}

              {pMijlpalen.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.04em", margin:"0 0 8px" }}>🚩 Mijlpalen</p>
                  {pMijlpalen.map(m => {
                    const dagenTot = dagVerschil(m.datum, vandaag);
                    return (
                      <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, background:`${C.orange}12`, border:`1px solid ${C.orange}44`, borderRadius:10, padding:"9px 12px", marginBottom:6 }}>
                        <span style={{ fontSize:16 }}>🚩</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ margin:0, fontWeight:700, fontSize:13, color:C.text }}>{m.naam}</p>
                          <p style={{ margin:0, fontSize:11, color:C.muted }}>
                            {m.datum}{dagenTot === 0 ? " · vandaag" : dagenTot > 0 ? ` · over ${dagenTot}d` : ` · ${Math.abs(dagenTot)}d geleden`}
                          </p>
                        </div>
                        <button onClick={() => verwijderMijlpaal(m.id)} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, padding:2 }}>
                          <X size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {pTaken.length > 0 && (
                <div style={{ display:"flex", gap:4, background:C.card, borderRadius:11, padding:3, marginBottom:14 }}>
                  <button style={{ flex:1, border:"none", background:projectWeergave==="lijst"?C.purple:"transparent", color:projectWeergave==="lijst"?"#FFF":C.muted, borderRadius:8, padding:"8px 0", fontSize:12, fontWeight:600, cursor:"pointer" }}
                    onClick={() => setProjectWeergave("lijst")}>📋 Lijst</button>
                  <button style={{ flex:1, border:"none", background:projectWeergave==="tijdlijn"?C.purple:"transparent", color:projectWeergave==="tijdlijn"?"#FFF":C.muted, borderRadius:8, padding:"8px 0", fontSize:12, fontWeight:600, cursor:"pointer" }}
                    onClick={() => setProjectWeergave("tijdlijn")}>📊 Tijdlijn</button>
                </div>
              )}

              {/* Tijdlijn (Gantt-weergave) */}
              {projectWeergave === "tijdlijn" && pTaken.length > 0 && (() => {
                const projectStart = new Date(project.startDatum);
                let laatsteEind = taakInfo.reduce((max, ti) => ti.eind > max ? ti.eind : max, taakInfo[0].eind);
                pMijlpalen.forEach(m => { if (new Date(m.datum) > laatsteEind) laatsteEind = new Date(m.datum); });
                const totaalDagen = Math.max(7, dagVerschil(fmtDatum(laatsteEind), fmtDatum(projectStart)) + 2);
                const dagBreedte = 26; // px per dag — scrollbaar, dus geen probleem op smalle schermen
                const vandaagOffset = dagVerschil(vandaag, fmtDatum(projectStart));

                // Weeklabels boven de tijdlijn (elke 7 dagen een datum)
                const weekLabels = [];
                for (let d = 0; d <= totaalDagen; d += 7) {
                  weekLabels.push({ dag: d, label: fmtDatum(dagPlus(projectStart, d)).slice(5) });
                }

                return (
                  <div style={{ ...S.card, overflowX:"auto", paddingBottom:12 }}>
                    <div style={{ position:"relative", width: totaalDagen * dagBreedte + 140, minWidth:"100%" }}>
                      {/* Datumas */}
                      <div style={{ position:"relative", height:22, marginLeft:140, marginBottom:6, borderBottom:`1px solid ${C.border}` }}>
                        {weekLabels.map(w => (
                          <span key={w.dag} style={{ position:"absolute", left:w.dag*dagBreedte, fontSize:9, color:C.muted, whiteSpace:"nowrap" }}>{w.label}</span>
                        ))}
                      </div>
                      {/* Vandaag-lijn */}
                      {vandaagOffset >= 0 && vandaagOffset <= totaalDagen && (
                        <div style={{ position:"absolute", top:22, bottom:0, left:140 + vandaagOffset*dagBreedte, width:2, background:C.red, zIndex:2 }} />
                      )}
                      {/* Mijlpaal-lijnen */}
                      {pMijlpalen.map(m => {
                        const offset = dagVerschil(m.datum, fmtDatum(projectStart));
                        if (offset < 0 || offset > totaalDagen) return null;
                        return (
                          <div key={m.id} style={{ position:"absolute", top:0, bottom:0, left:140 + offset*dagBreedte, width:2, borderLeft:`2px dashed ${C.orange}`, zIndex:2 }} title={m.naam}>
                            <span style={{ position:"absolute", top:-2, left:4, fontSize:11, whiteSpace:"nowrap" }}>🚩</span>
                          </div>
                        );
                      })}
                      {/* Taakbalken */}
                      {taakInfo.map(({ taak: t, start, eind, status, kritiek }, i) => {
                        const offsetDagen = Math.max(0, dagVerschil(fmtDatum(start), fmtDatum(projectStart)));
                        const breedteDagen = Math.max(1, dagVerschil(fmtDatum(eind), fmtDatum(start)));
                        const kleur = status === "klaar" ? C.green : status === "bezig" ? C.purple : kritiek ? C.red : C.muted;
                        return (
                          <div key={t.id} style={{ display:"flex", alignItems:"center", height:34, position:"relative" }}>
                            <div style={{ width:140, flexShrink:0, fontSize:11, fontWeight:600, color:C.text, paddingRight:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={t.naam}>
                              {kritiek && "🔥 "}{t.naam}
                            </div>
                            <div style={{ position:"absolute", left:140 + offsetDagen*dagBreedte, width:breedteDagen*dagBreedte, height:20, background:kleur, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center" }}>
                              <span style={{ fontSize:9, color:"#FFF", fontWeight:700, whiteSpace:"nowrap", padding:"0 4px" }}>{t.duurDagen}d</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display:"flex", gap:14, marginTop:14, marginLeft:4, flexWrap:"wrap" }}>
                      {[["🔴 Kritiek pad", C.red], ["🟣 Bezig", C.purple], ["🟢 Klaar", C.green], ["⚪ Speling", C.muted]].map(([label, kleur]) => (
                        <span key={label} style={{ fontSize:10, color:C.muted, display:"flex", alignItems:"center", gap:4 }}>
                          <span style={{ width:8, height:8, borderRadius:2, background:kleur, display:"inline-block" }} />{label.slice(2)}
                        </span>
                      ))}
                      {pMijlpalen.length > 0 && <span style={{ fontSize:10, color:C.muted, display:"flex", alignItems:"center", gap:4 }}>🚩 Mijlpaal</span>}
                    </div>
                  </div>
                );
              })()}

              {/* Lijstweergave */}
              {projectWeergave === "lijst" && taakInfo.map(({ taak: t, start, eind, vertragingDagen, status, kritiek }, i) => {
                const kleur = status === "klaar" ? C.green : status === "bezig" ? C.purple : vertragingDagen > 0 ? C.red : C.muted;
                const afhankelijkNamen = (t.afhankelijkheden || []).map(id => pTaken.find(x => x.id === id)?.naam).filter(Boolean);
                return (
                  <div key={t.id} style={{ display:"flex", gap:10, marginBottom:4 }}>
                    {/* Tijdlijn-lijn */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:16, flexShrink:0 }}>
                      <div style={{ width:12, height:12, borderRadius:"50%", background:kleur, marginTop:6, flexShrink:0 }} />
                      {i < taakInfo.length - 1 && <div style={{ width:2, flex:1, background:C.border, marginTop:2 }} />}
                    </div>
                    <div style={{ ...S.card, flex:1, marginBottom:14, borderLeft:`3px solid ${kleur}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ margin:"0 0 3px", fontWeight:700, fontSize:14, color:C.text }}>{t.naam}</p>
                          <p style={{ margin:0, fontSize:11, color:C.muted }}>
                            {fmtDatum(start)} → {fmtDatum(eind)} · {t.duurDagen}d
                            {vertragingDagen > 0 && <span style={{ color:C.red, fontWeight:700 }}> · +{vertragingDagen}d vertraging</span>}
                          </p>
                          {afhankelijkNamen.length > 0 && (
                            <p style={{ margin:"3px 0 0", fontSize:10, color:C.muted }}>⛓️ Na: {afhankelijkNamen.join(", ")}</p>
                          )}
                          {t.uitvoerder && <p style={{ margin:"3px 0 0", fontSize:10, color:C.muted }}>👷 {t.uitvoerder}</p>}
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                          <span style={{ fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20, background:`${kleur}22`, color:kleur, whiteSpace:"nowrap" }}>
                            {status === "klaar" ? "✅ Klaar" : status === "bezig" ? "▶️ Bezig" : "⏳ Nog te doen"}
                          </span>
                          {kritiek && (
                            <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20, background:`${C.red}22`, color:C.red, whiteSpace:"nowrap" }} title="Geen speling — vertraging hier vertraagt gegarandeerd de hele oplevering">
                              🔥 Kritiek pad
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
                        {status === "todo" && (
                          <button style={{ ...S.btn(C.purple), fontSize:11, padding:"6px 10px" }} onClick={() => markeerGestart(t)}>▶️ Start</button>
                        )}
                        {status !== "klaar" && (
                          <button style={{ ...S.btn(C.green), fontSize:11, padding:"6px 10px" }}
                            onClick={() => { setKlaarTaakId(t.id); setKlaarDatum(vandaag); setShowKlaarForm(true); }}>✅ Klaar melden</button>
                        )}
                        {status === "klaar" && (
                          <button style={{ ...S.btn(C.card, C.muted), border:`1px solid ${C.border}`, fontSize:11, padding:"6px 10px" }} onClick={() => heropenTaak(t)}>↩️ Heropen</button>
                        )}
                        <button style={{ ...S.btn(C.card, C.text), border:`1px solid ${C.border}`, fontSize:11, padding:"6px 10px" }} onClick={() => bewerkProjectTaak(t)}>✏️ Bewerk</button>
                        <button style={{ ...S.btn(C.card, C.red), border:`1px solid ${C.border}`, fontSize:11, padding:"6px 10px" }} onClick={() => verwijderProjectTaak(t.id)}>🗑</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          );
        })()}
      </main>

      <button style={S.fab} onClick={() => {
        if (tab === "verbouwing") {
          if (actieefProjectId) { setEditProjectTaakId(null); setProjectTaakForm({ naam:"", duurDagen:1, afhankelijkheden:[], uitvoerder:"", notitie:"" }); setShowProjectTaakForm(true); }
          else setShowProjectForm(true);
        } else setShowObjectForm(true);
      }}>
        <Plus size={22} color="#FFFFFF" strokeWidth={2.4} />
      </button>
    </div>
  );
}
