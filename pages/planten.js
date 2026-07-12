import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, X, ChevronLeft, Camera, Leaf, Droplets, Scissors, Sun, Thermometer, AlertCircle, Check } from "lucide-react";

// ── Constanten ─────────────────────────────────────────
const MAANDEN = ["Jan","Feb","Mrt","Apr","Mei","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];
const LOCATIES = ["Binnen","Buiten","Tuin","Balkon","Kas","Vensterbank"];
const CATEGORIEEN = ["Groente","Fruit","Kruiden","Bloemen","Struiken","Bomen","Kamerplanten","Cactus/Vetplanten","Klimplanten","Overig"];
const ONDERHOUD_TYPES = [
  { id: "water",    label: "Water geven",  icon: "💧", color: "#00D4FF" },
  { id: "snoei",    label: "Snoeien",      icon: "✂️", color: "#2D4A3E" },
  { id: "zaai",     label: "Zaaien",       icon: "🌱", color: "#00E096" },
  { id: "mest",     label: "Bemesten",     icon: "🌿", color: "#4A7C6A" },
  { id: "repot",    label: "Verpotten",    icon: "🪴", color: "#C86E4A" },
  { id: "oogst",    label: "Oogsten",      icon: "🍅", color: "#FF6B6B" },
  { id: "bescherm", label: "Beschermen",   icon: "🛡️", color: "#B57BFF" },
  { id: "overig",   label: "Overig",       icon: "📝", color: "#8C8576" },
];

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ── Seizoensdata per plantentype ──────────────────────
function getSeizoensAdvies(plant, maandIdx) {
  const m = maandIdx + 1; // 1-12
  const advies = [];

  // Basislogica op categorie
  if (plant.categorie === "Groente") {
    if (m >= 2 && m <= 4) advies.push({ type: "zaai", tekst: "Tijd om te zaaien (binnen)" });
    if (m >= 4 && m <= 6) advies.push({ type: "zaai", tekst: "Buitenzaaien mogelijk" });
    if (m >= 6 && m <= 10) advies.push({ type: "oogst", tekst: "Oogstperiode" });
    if (m >= 10 || m <= 2) advies.push({ type: "bescherm", tekst: "Bescherm tegen vorst" });
  }
  if (plant.categorie === "Fruit") {
    if (m >= 2 && m <= 3) advies.push({ type: "snoei", tekst: "Snoei voor nieuwe groei" });
    if (m >= 3 && m <= 5) advies.push({ type: "mest", tekst: "Bemest voor bloei" });
    if (m >= 7 && m <= 9) advies.push({ type: "oogst", tekst: "Oogstperiode" });
  }
  if (plant.categorie === "Kruiden") {
    if (m >= 3 && m <= 5) advies.push({ type: "zaai", tekst: "Zaaien of stekken" });
    if (m >= 5 && m <= 9) advies.push({ type: "oogst", tekst: "Regelmatig oogsten" });
    if (m >= 9 && m <= 10) advies.push({ type: "bescherm", tekst: "Naar binnen of inkuilen" });
  }
  if (plant.categorie === "Bloemen") {
    if (m >= 2 && m <= 4) advies.push({ type: "zaai", tekst: "Zaaien (voor)seizoen" });
    if (m >= 3 && m <= 5) advies.push({ type: "mest", tekst: "Bemest voor bloei" });
    if (m >= 8 && m <= 9) advies.push({ type: "snoei", tekst: "Deadheading voor meer bloei" });
  }
  if (plant.categorie === "Struiken" || plant.categorie === "Bomen") {
    if (m === 2 || m === 3) advies.push({ type: "snoei", tekst: "Snoei voor uitlopen" });
    if (m >= 4 && m <= 6) advies.push({ type: "mest", tekst: "Voedingsbodem aanvullen" });
    if (m === 11 || m === 12) advies.push({ type: "snoei", tekst: "Wintersnoeien mogelijk" });
  }
  if (plant.categorie === "Kamerplanten") {
    if (m >= 3 && m <= 8) advies.push({ type: "mest", tekst: "Groeiseizoen: wekelijks bemesten" });
    if (m >= 4 && m <= 9) advies.push({ type: "repot", tekst: "Goed moment om te verpotten" });
  }

  // Wateradvies op basis van locatie en seizoen
  const buiten = ["Buiten","Tuin","Balkon"].includes(plant.locatie);
  if (buiten && m >= 5 && m <= 8) advies.push({ type: "water", tekst: "Zomerhitte: dagelijks water geven" });
  else if (buiten && (m <= 2 || m >= 11)) advies.push({ type: "water", tekst: "Winter: bijna geen water nodig" });
  else advies.push({ type: "water", tekst: "Controleer de bodemvochtigheid" });

  return advies;
}

// ── Data helpers ────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch("/api/planten");
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function saveData(data) {
  try {
    await fetch("/api/planten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) { console.error("Opslaan mislukt", e); }
}

async function callAI(prompt, imageBase64 = null, imageType = "image/jpeg") {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, imageBase64, imageType, maxTokens: 1200 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI mislukt");
  return data.text;
}

// ── Stijlen ─────────────────────────────────────────────
const C = {
  bg: "#F4FAF4", surf: "#FFFFFF", card: "#EEF7EE",
  border: "#D4E8D4", green: "#2D6A4F", accent: "#52B788",
  text: "#1A2E1A", muted: "#6B8F71", red: "#D63353",
  yellow: "#CC8800", purple: "#7B52D9", blue: "#0099CC",
};
const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: C.green },
  main: { padding: "4px 20px 120px" },
  inp: { background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 15, width: "100%", boxSizing: "border-box", color: C.text },
  btn: (bg=C.green, col="#FFFFFF") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 12 },
  fab: { position: "fixed", bottom: 28, right: 20, width: 52, height: 52, borderRadius: 16, background: C.green, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px rgba(45,106,79,0.3)", zIndex: 50 },
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" },
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
};

// ════════════════════════════════════════════════════════
// HOOFD APP
// ════════════════════════════════════════════════════════
export default function PlantenApp() {
  const [planten, setPlantenState] = useState([]);
  const [onderhoudLog, setOnderhoudLogState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePlantId, setActivePlantId] = useState(null);
  const [tab, setTab] = useState("overzicht"); // overzicht | kalender | log
  const lastWriteRef = useRef(0);

  // Formulier
  const [showForm, setShowForm] = useState(false);
  const [formPlant, setFormPlant] = useState({ naam: "", soort: "", categorie: "Kamerplanten", locatie: "Binnen", aankoop: "", notitie: "", foto: null, waterInterval: 7 });

  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResultaat, setAiResultaat] = useState(null);
  const [aiTab, setAiTab] = useState(null); // "analyse" | "advies" | "info"

  // Onderhoud toevoegen
  const [showOnderhoud, setShowOnderhoud] = useState(false);
  const [onderhoudForm, setOnderhoudForm] = useState({ type: "water", notitie: "", datum: new Date().toISOString().slice(0,10) });

  // Weer
  const [weer, setWeer] = useState(null);

  const [toast, setToast] = useState(null);
  const fileRef = useRef();
  const cameraRef = useRef();

  const nu = new Date();
  const huidigeM = nu.getMonth(); // 0-11

  // ── Data ─────────────────────────────────────────────
  const persistData = useCallback((nextPlanten, nextLog) => {
    lastWriteRef.current = Date.now();
    setPlantenState(nextPlanten);
    setOnderhoudLogState(nextLog);
    saveData({ planten: nextPlanten, onderhoudLog: nextLog });
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (Date.now() - lastWriteRef.current < 5000) return;
      const data = await loadData();
      if (active && data) {
        setPlantenState(data.planten || []);
        setOnderhoudLogState(data.onderhoudLog || []);
        setLoading(false);
      } else if (active) setLoading(false);
    };
    refresh();
    const poll = setInterval(refresh, 8000);
    return () => { active = false; clearInterval(poll); };
  }, []);

  // Weersdata ophalen via Open-Meteo (geen API-key nodig)
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(async pos => {
      try {
        const { latitude: lat, longitude: lon } = pos.coords;
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7`);
        const data = await res.json();
        setWeer({
          lat, lon,
          maxTemp: data.daily.temperature_2m_max[0],
          minTemp: data.daily.temperature_2m_min[0],
          regen: data.daily.precipitation_sum.slice(0,3).reduce((s,v)=>s+v,0),
          dagen: data.daily.time.slice(0,7).map((d,i) => ({
            datum: d,
            max: data.daily.temperature_2m_max[i],
            min: data.daily.temperature_2m_min[i],
            regen: data.daily.precipitation_sum[i],
          })),
        });
      } catch { /* weer niet beschikbaar */ }
    }, () => { /* locatie geweigerd */ });
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  // ── Plant mutaties ────────────────────────────────────
  function voegPlantToe() {
    if (!formPlant.naam.trim()) return;
    const nieuw = { ...formPlant, id: uid(), aangemaaktOp: Date.now() };
    persistData([...planten, nieuw], onderhoudLog);
    setFormPlant({ naam: "", soort: "", categorie: "Kamerplanten", locatie: "Binnen", aankoop: "", notitie: "", foto: null, waterInterval: 7 });
    setShowForm(false);
    showToast(`✅ ${nieuw.naam} toegevoegd`);
  }

  function verwijderPlant(id) {
    if (!window.confirm("Plant verwijderen?")) return;
    persistData(planten.filter(p => p.id !== id), onderhoudLog.filter(l => l.plantId !== id));
    if (activePlantId === id) setActivePlantId(null);
  }

  function updatePlant(id, fields) {
    persistData(planten.map(p => p.id === id ? { ...p, ...fields } : p), onderhoudLog);
  }

  // ── Onderhoud ─────────────────────────────────────────
  function voegOnderhoudToe() {
    if (!activePlantId) return;
    const entry = { ...onderhoudForm, id: uid(), plantId: activePlantId };
    persistData(planten, [...onderhoudLog, entry]);
    setOnderhoudForm({ type: "water", notitie: "", datum: new Date().toISOString().slice(0,10) });
    setShowOnderhoud(false);
    showToast("✅ Onderhoud gelogd");
  }

  // ── AI functies ───────────────────────────────────────
  async function analyseerFoto(base64, type) {
    setAiLoading(true); setAiResultaat(null); setAiTab("analyse");
    try {
      const tekst = await callAI(
        `Analyseer deze plant/foto. Geef in het Nederlands:
1. **Plantnaam**: (Nederlandse + Latijnse naam als je die herkent)
2. **Gezondheid**: (goed/matig/slecht + uitleg)
3. **Problemen**: (ziektes, plagen, gebreken die je ziet)
4. **Directe actie**: (wat nu te doen)
Wees concreet en praktisch.`,
        base64, type
      );
      setAiResultaat(tekst);
      // Sla foto op bij actieve plant
      if (activePlantId) updatePlant(activePlantId, { foto: `data:${type};base64,${base64}` });
    } catch (e) { setAiResultaat(`❌ ${e.message}`); }
    setAiLoading(false);
  }

  async function vraagAdvies(plant) {
    setAiLoading(true); setAiResultaat(null); setAiTab("advies");
    const maand = MAANDEN[huidigeM];
    try {
      const tekst = await callAI(
        `Geef tuinadvies in het Nederlands voor:
Plant: ${plant.naam} (${plant.soort || plant.categorie})
Locatie: ${plant.locatie}
Maand: ${maand}
${weer ? `Weer komende dagen: max ${weer.maxTemp}°C, regen ${weer.regen.toFixed(0)}mm` : ""}
${plant.notitie ? `Notities eigenaar: ${plant.notitie}` : ""}

Geef:
1. **Wat nu te doen** (deze maand)
2. **Water geven**: hoe vaak, hoeveel
3. **Komende maand**: waar alvast rekening mee houden
4. **Tips** voor deze specifieke plant

Kort en praktisch, maximaal 200 woorden.`
      );
      setAiResultaat(tekst);
    } catch (e) { setAiResultaat(`❌ ${e.message}`); }
    setAiLoading(false);
  }

  async function haalInfo(plant) {
    setAiLoading(true); setAiResultaat(null); setAiTab("info");
    try {
      const tekst = await callAI(
        `Geef uitgebreide informatie over ${plant.naam} (${plant.soort || plant.categorie}) in het Nederlands:

1. **Over de plant**: herkomst, kenmerken
2. **Grond & standplaats**: welke grond, hoeveel zon
3. **Water & voeding**: frequentie, type meststof
4. **Seizoenskalender**: per seizoen wat te doen
5. **Veelgemaakte fouten**: en hoe te vermijden
6. **Leuk feitje**: iets interessants

Maximaal 300 woorden, praktisch en informatief.`
      );
      setAiResultaat(tekst);
    } catch (e) { setAiResultaat(`❌ ${e.message}`); }
    setAiLoading(false);
  }

  async function handleFotoUpload(file) {
    if (!file) return;
    // Comprimeer voor opslag
    const compressed = await new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = url;
    });
    const base64 = compressed.split(",")[1];
    await analyseerFoto(base64, "image/jpeg");
  }

  // ── Herinneringen berekenen ────────────────────────────
  function berekenHerinneringen() {
    const herinneringen = [];
    planten.forEach(plant => {
      const advies = getSeizoensAdvies(plant, huidigeM);
      const logEntries = onderhoudLog.filter(l => l.plantId === plant.id);
      advies.forEach(a => {
        // Check wanneer dit onderhoud voor het laatst is gedaan
        const laatste = logEntries
          .filter(l => l.type === a.type)
          .sort((x,y) => y.datum.localeCompare(x.datum))[0];
        const dagenGeleden = laatste
          ? Math.floor((Date.now() - new Date(laatste.datum)) / 86400000)
          : 999;
        // Gebruik plant-specifiek water-interval of standaard 3 dagen
        const waterInterval = plant.waterInterval || 3;
        if (a.type === "water" && dagenGeleden > waterInterval) {
          herinneringen.push({ plant, advies: a, dagenGeleden, urgentie: dagenGeleden > waterInterval * 2 ? "hoog" : "middel" });
        } else if (a.type !== "water" && dagenGeleden > 30) {
          herinneringen.push({ plant, advies: a, dagenGeleden, urgentie: "laag" });
        }
      });
    });
    return herinneringen.sort((a,b) => b.dagenGeleden - a.dagenGeleden);
  }

  // ── Render helpers ─────────────────────────────────────
  if (loading) return (
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <span style={{ fontSize: 40 }}>🌿</span>
        <div style={{ display: "flex", gap: 6 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, opacity: 0.3, animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}`}</style>
      </div>
    </div>
  );

  const activePlant = planten.find(p => p.id === activePlantId);
  const herinneringen = berekenHerinneringen();

  // ════════════════════════
  // PLANT DETAIL
  // ════════════════════════
  if (activePlant) {
    const plantLog = onderhoudLog.filter(l => l.plantId === activePlant.id).sort((a,b) => b.datum.localeCompare(a.datum));
    const seizoensAdvies = getSeizoensAdvies(activePlant, huidigeM);

    return (
      <div style={S.appBg}>
        {toast && <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", background:C.green, color:"#FFF", padding:"9px 20px", borderRadius:10, fontWeight:700, zIndex:999, fontSize:13 }}>{toast}</div>}

        <header style={{ ...S.header, alignItems: "center" }}>
          <button style={{ background:"none", border:"none", cursor:"pointer" }} onClick={() => { setActivePlantId(null); setAiResultaat(null); }}>
            <ChevronLeft size={20} color={C.green} />
          </button>
          <h1 style={{ ...S.title, fontSize: 20, margin: 0 }}>{activePlant.naam}</h1>
          <button style={{ ...S.iconBtn }} onClick={() => verwijderPlant(activePlant.id)}>
            <X size={18} color={C.muted} />
          </button>
        </header>

        <main style={S.main}>
          {/* Foto + basisinfo */}
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            {activePlant.foto ? (
              <img src={activePlant.foto} alt={activePlant.naam} style={{ width: "100%", height: 200, objectFit: "cover" }} />
            ) : (
              <div style={{ height: 120, background: C.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>🌱</div>
            )}
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <span style={{ background: `${C.accent}22`, color: C.green, border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{activePlant.categorie}</span>
                <span style={{ background: `${C.accent}22`, color: C.green, border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{activePlant.locatie}</span>
                {activePlant.soort && <span style={{ color: C.muted, fontSize: 12, fontStyle: "italic", padding: "3px 0" }}>{activePlant.soort}</span>}
              </div>
              {activePlant.notitie && <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{activePlant.notitie}</p>}
            </div>
          </div>

          {/* Seizoensadvies */}
          <div style={S.card}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: C.green }}>📅 {MAANDEN[huidigeM]} — Wat nu te doen</h3>
            {seizoensAdvies.length === 0
              ? <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Geen specifiek seizoensadvies voor deze maand.</p>
              : seizoensAdvies.map((a, i) => {
                  const type = ONDERHOUD_TYPES.find(t => t.id === a.type);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                      <span style={{ fontSize: 18 }}>{type?.icon || "📝"}</span>
                      <span style={{ flex: 1, fontSize: 13, color: C.text }}>{a.tekst}</span>
                      <button style={{ ...S.btn(type?.color || C.green), fontSize: 11, padding: "5px 10px" }}
                        onClick={() => { setOnderhoudForm({ type: a.type, notitie: a.tekst, datum: new Date().toISOString().slice(0,10) }); setShowOnderhoud(true); }}>
                        Log
                      </button>
                    </div>
                  );
                })}
          </div>

          {/* Weersintegratie */}
          {weer && (
            <div style={S.card}>
              <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: C.green }}>🌤 Weer komende week</h3>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                {weer.dagen.map((dag, i) => (
                  <div key={i} style={{ minWidth: 52, textAlign: "center", background: C.card, borderRadius: 10, padding: "8px 6px" }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{["Zo","Ma","Di","Wo","Do","Vr","Za"][new Date(dag.datum).getDay()]}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{Math.round(dag.max)}°</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{Math.round(dag.min)}°</div>
                    {dag.regen > 0 && <div style={{ fontSize: 10, color: C.blue }}>💧{dag.regen.toFixed(0)}</div>}
                  </div>
                ))}
              </div>
              {weer.regen < 5 && <p style={{ margin: "10px 0 0", fontSize: 12, color: C.yellow, fontWeight: 600 }}>⚠️ Weinig regen verwacht — water geven aangeraden</p>}
            </div>
          )}

          {/* AI knoppen */}
          <div style={{ ...S.card }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: C.green }}>🤖 AI Assistent</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btn(C.accent), flex: 1, fontSize: 13, padding: "10px 0" }}
                  onClick={() => fileRef.current?.click()}>
                  <Camera size={14} style={{ marginRight: 6, display: "inline" }} />
                  Foto analyseren
                </button>
                <button style={{ ...S.btn("#4A7C6A"), flex: 1, fontSize: 13, padding: "10px 0" }}
                  onClick={() => vraagAdvies(activePlant)}>
                  💡 Advies vragen
                </button>
              </div>
              <button style={{ ...S.btn(C.card, C.green), border: `1px solid ${C.border}`, fontSize: 13, padding: "10px 0" }}
                onClick={() => haalInfo(activePlant)}>
                📚 Planteninformatie
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFotoUpload(e.target.files[0])} />

            {/* AI resultaat */}
            {aiLoading && (
              <div style={{ marginTop: 12, textAlign: "center", padding: "20px 0", color: C.muted, fontSize: 13 }}>
                🌱 Even nadenken…
              </div>
            )}
            {aiResultaat && !aiLoading && (
              <div style={{ marginTop: 12, background: C.card, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {aiTab === "analyse" ? "🔍 Foto-analyse" : aiTab === "advies" ? "💡 Onderhoudsadvies" : "📚 Planteninformatie"}
                </div>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{aiResultaat}</div>
              </div>
            )}
          </div>

          {/* Onderhoud log */}
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.green }}>📋 Onderhoud log</h3>
              <button style={{ ...S.btn(), fontSize: 12, padding: "6px 14px" }} onClick={() => setShowOnderhoud(true)}>+ Log</button>
            </div>
            {plantLog.length === 0
              ? <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Nog niets gelogd.</p>
              : plantLog.slice(0, 10).map(entry => {
                  const type = ONDERHOUD_TYPES.find(t => t.id === entry.type);
                  return (
                    <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 18 }}>{type?.icon || "📝"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{type?.label || entry.type}</div>
                        {entry.notitie && <div style={{ fontSize: 12, color: C.muted }}>{entry.notitie}</div>}
                      </div>
                      <span style={{ fontSize: 12, color: C.muted }}>{entry.datum}</span>
                    </div>
                  );
                })}
          </div>
        </main>

        {/* Onderhoud toevoegen overlay */}
        {showOnderhoud && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }} onClick={() => setShowOnderhoud(false)}>
            <div style={{ background: "#FFFFFF", width: "100%", padding: "20px 20px 36px", borderTopLeftRadius: 20, borderTopRightRadius: 20 }} onClick={e => e.stopPropagation()}>
              <p style={{ margin: "0 0 14px", fontWeight: 700, fontSize: 15 }}>Onderhoud loggen</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {ONDERHOUD_TYPES.map(t => (
                  <button key={t.id}
                    style={{ ...S.btn(onderhoudForm.type === t.id ? t.color : C.card, onderhoudForm.type === t.id ? "#FFF" : C.text), border: `1px solid ${onderhoudForm.type === t.id ? t.color : C.border}`, fontSize: 12, padding: "7px 12px" }}
                    onClick={() => setOnderhoudForm(f => ({ ...f, type: t.id }))}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
              <input style={{ ...S.inp, marginBottom: 10 }} type="date" value={onderhoudForm.datum} onChange={e => setOnderhoudForm(f => ({ ...f, datum: e.target.value }))} />
              <input style={{ ...S.inp, marginBottom: 14 }} placeholder="Notitie (optioneel)" value={onderhoudForm.notitie} onChange={e => setOnderhoudForm(f => ({ ...f, notitie: e.target.value }))} />
              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ ...S.btn(C.card, C.text), border: `1px solid ${C.border}`, flex: 1 }} onClick={() => setShowOnderhoud(false)}>Annuleer</button>
                <button style={{ ...S.btn(), flex: 2 }} onClick={voegOnderhoudToe}>Opslaan</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════
  // OVERZICHT
  // ════════════════════════
  return (
    <div style={S.appBg}>
      {toast && <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", background:C.green, color:"#FFF", padding:"9px 20px", borderRadius:10, fontWeight:700, zIndex:999, fontSize:13 }}>{toast}</div>}

      <header style={S.header}>
        <div>
          <Link href="/" style={S.switchBtn}>← Overzicht</Link>
          <h1 style={S.title}>🌿 Planten & Tuin</h1>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ padding: "0 20px 12px", display: "flex", gap: 6, background: "#FFFFFF", borderRadius: 12, margin: "0 20px 16px", border: `1px solid ${C.border}`, padding: "4px" }}>
        {[["overzicht","🌱 Planten"],["kalender","📅 Kalender"],["log","📋 Log"]].map(([t,l]) => (
          <button key={t} style={{ flex: 1, border: "none", background: tab === t ? C.green : "transparent", color: tab === t ? "#FFF" : C.muted, borderRadius: 9, padding: "9px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      <main style={S.main}>
        {/* Herinneringen dashboard */}
        {herinneringen.length > 0 && (
          <div style={{ ...S.card, border: `1px solid ${C.yellow}` }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: C.yellow }}>⚠️ Aandacht nodig</h3>
            {herinneringen.slice(0, 5).map((h, i) => {
              const type = ONDERHOUD_TYPES.find(t => t.id === h.advies.type);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                  <span style={{ fontSize: 18 }}>{type?.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{h.plant.naam}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{h.advies.tekst}</div>
                  </div>
                  <span style={{ fontSize: 11, color: h.urgentie === "hoog" ? C.red : C.yellow }}>{h.dagenGeleden > 100 ? "Nooit gedaan" : `${h.dagenGeleden}d geleden`}</span>
                  <button style={{ ...S.btn(), fontSize: 11, padding: "5px 10px" }}
                    onClick={() => setActivePlantId(h.plant.id)}>
                    Bekijk
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabs inhoud */}
        {tab === "overzicht" && (
          <>
            {planten.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🌱</div>
                <p style={{ fontWeight: 700, fontSize: 17, color: C.green, margin: "0 0 6px" }}>Nog geen planten</p>
                <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>Tik + om je eerste plant toe te voegen</p>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {planten.map(plant => {
                const plantLog = onderhoudLog.filter(l => l.plantId === plant.id);
                const lastWater = plantLog.filter(l => l.type === "water").sort((a,b) => b.datum.localeCompare(a.datum))[0];
                const dagenZonderWater = lastWater
                  ? Math.floor((Date.now() - new Date(lastWater.datum)) / 86400000)
                  : null;
                return (
                  <div key={plant.id} style={{ ...S.card, cursor: "pointer", padding: 0, overflow: "hidden" }}
                    onClick={() => setActivePlantId(plant.id)}>
                    {plant.foto
                      ? <img src={plant.foto} alt={plant.naam} style={{ width: "100%", height: 100, objectFit: "cover" }} />
                      : <div style={{ height: 80, background: C.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🌱</div>}
                    <div style={{ padding: "10px 12px" }}>
                      <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: C.text }}>{plant.naam}</p>
                      <p style={{ margin: 0, fontSize: 11, color: C.muted }}>{plant.locatie} · {plant.categorie}</p>
                      {dagenZonderWater !== null && (
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: dagenZonderWater > 5 ? C.red : C.muted }}>
                          💧 {dagenZonderWater === 0 ? "Vandaag water" : `${dagenZonderWater}d geleden water`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "kalender" && (
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: C.green }}>{MAANDEN[huidigeM]} — Seizoenskalender</h3>
            <p style={{ margin: "0 0 14px", fontSize: 12, color: C.muted }}>Wat moet er deze maand gebeuren per plant</p>
            {planten.length === 0
              ? <p style={{ color: C.muted, fontSize: 14, textAlign: "center", padding: "40px 0" }}>Voeg eerst planten toe</p>
              : planten.map(plant => {
                  const advies = getSeizoensAdvies(plant, huidigeM);
                  return (
                    <div key={plant.id} style={{ ...S.card, marginBottom: 10 }} onClick={() => setActivePlantId(plant.id)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 20 }}>{plant.foto ? "🌿" : "🌱"}</span>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{plant.naam}</p>
                          <p style={{ margin: 0, fontSize: 11, color: C.muted }}>{plant.locatie}</p>
                        </div>
                      </div>
                      {advies.map((a, i) => {
                        const type = ONDERHOUD_TYPES.find(t => t.id === a.type);
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: `1px solid ${C.border}` }}>
                            <span>{type?.icon}</span>
                            <span style={{ fontSize: 12, color: C.text }}>{a.tekst}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
          </div>
        )}

        {tab === "log" && (
          <div>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: C.green }}>📋 Alle onderhoud</h3>
            {onderhoudLog.length === 0
              ? <p style={{ color: C.muted, fontSize: 14, textAlign: "center", padding: "40px 0" }}>Nog niets gelogd</p>
              : [...onderhoudLog].sort((a,b) => b.datum.localeCompare(a.datum)).map(entry => {
                  const plant = planten.find(p => p.id === entry.plantId);
                  const type = ONDERHOUD_TYPES.find(t => t.id === entry.type);
                  if (!plant) return null;
                  return (
                    <div key={entry.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{type?.icon || "📝"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{plant.naam}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{type?.label} {entry.notitie ? `· ${entry.notitie}` : ""}</div>
                      </div>
                      <span style={{ fontSize: 12, color: C.muted }}>{entry.datum}</span>
                    </div>
                  );
                })}
          </div>
        )}
      </main>

      {/* Plant toevoegen overlay */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }} onClick={() => setShowForm(false)}>
          <div style={{ background: "#FFFFFF", width: "100%", maxHeight: "90vh", overflowY: "auto", padding: "20px 20px 36px", borderTopLeftRadius: 20, borderTopRightRadius: 20, boxSizing: "border-box" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 14px", fontWeight: 700, fontSize: 16, color: C.green }}>🌱 Nieuwe plant</p>
            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Naam (bv. Tomaat, Monstera)" value={formPlant.naam} onChange={e => setFormPlant(f => ({ ...f, naam: e.target.value }))} autoFocus />
            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Soort / variëteit (optioneel)" value={formPlant.soort} onChange={e => setFormPlant(f => ({ ...f, soort: e.target.value }))} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Categorie</label>
                <select style={S.inp} value={formPlant.categorie} onChange={e => setFormPlant(f => ({ ...f, categorie: e.target.value }))}>
                  {CATEGORIEEN.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Locatie</label>
                <select style={S.inp} value={formPlant.locatie} onChange={e => setFormPlant(f => ({ ...f, locatie: e.target.value }))}>
                  {LOCATIES.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <input style={{ ...S.inp, marginBottom: 10 }} type="date" value={formPlant.aankoop} onChange={e => setFormPlant(f => ({ ...f, aankoop: e.target.value }))} />
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>💧 Water geven elke … dagen</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input style={{ ...S.inp, width: 80, textAlign: "center" }} type="number" min="1" max="365"
                  value={formPlant.waterInterval || 7}
                  onChange={e => setFormPlant(f => ({ ...f, waterInterval: +e.target.value }))} />
                <span style={{ fontSize: 13, color: C.muted }}>dagen — herinnering als te lang geen water</span>
              </div>
            </div>
            <textarea style={{ ...S.inp, height: 70, resize: "none", marginBottom: 14 }} placeholder="Notities (standplaats, bijzonderheden…)" value={formPlant.notitie} onChange={e => setFormPlant(f => ({ ...f, notitie: e.target.value }))} />
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...S.btn(C.card, C.text), border: `1px solid ${C.border}`, flex: 1 }} onClick={() => setShowForm(false)}>Annuleer</button>
              <button style={{ ...S.btn(), flex: 2 }} onClick={voegPlantToe}>Plant toevoegen</button>
            </div>
          </div>
        </div>
      )}

      <button style={S.fab} onClick={() => setShowForm(true)}>
        <Plus size={22} color="#FFFFFF" strokeWidth={2.4} />
      </button>
    </div>
  );
}
