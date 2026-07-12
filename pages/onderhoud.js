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
  yellow: "#CC8800", green: "#2D6A4F",
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
  const [loading, setLoading] = useState(true);
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

  const [tab, setTab] = useState("objecten"); // objecten | overzicht
  const [toast, setToast] = useState(null);

  const persistData = useCallback((nextObjecten, nextTaken) => {
    lastWriteRef.current = Date.now();
    setObjectenState(nextObjecten);
    setTakenState(nextTaken);
    saveData({ objecten: nextObjecten, taken: nextTaken });
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (Date.now() - lastWriteRef.current < 5000) return;
      const data = await loadData();
      if (active && data) {
        setObjectenState(data.objecten || []);
        setTakenState(data.taken || []);
        setLoading(false);
      } else if (active) setLoading(false);
    };
    refresh();
    const poll = setInterval(refresh, 8000);
    return () => { active = false; clearInterval(poll); };
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
              <p style={{ margin:"0 0 14px", fontWeight:700, fontSize:15, color:C.purple }}>✅ Onderhoud registreren</p>
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
              <p style={{ margin:"0 0 14px", fontWeight:700, fontSize:15, color:C.purple }}>+ Nieuwe onderhoudstaak</p>
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

      {/* Object toevoegen overlay */}
      {showObjectForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:100, display:"flex", alignItems:"flex-end" }} onClick={() => setShowObjectForm(false)}>
          <div style={{ background:"#FFF", width:"100%", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20 }} onClick={e => e.stopPropagation()}>
            <p style={{ margin:"0 0 14px", fontWeight:700, fontSize:15, color:C.purple }}>+ Nieuw object</p>
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

      <header style={S.header}>
        <div>
          <Link href="/" style={S.switchBtn}>← Overzicht</Link>
          <h1 style={S.title}>🔧 Onderhoudslog</h1>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, background:"#FFFFFF", borderRadius:12, margin:"0 20px 16px", border:`1px solid ${C.border}`, padding:"4px" }}>
        {[["objecten","🏠 Objecten"],["overzicht","📅 Planning"],["kosten","💰 Kosten"]].map(([t,l]) => (
          <button key={t} style={{ flex:1, border:"none", background:tab===t?C.purple:"transparent", color:tab===t?"#FFF":C.muted, borderRadius:9, padding:"9px 0", fontSize:12, fontWeight:600, cursor:"pointer" }} onClick={()=>setTab(t)}>{l}</button>
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
      </main>

      <button style={S.fab} onClick={() => setShowObjectForm(true)}>
        <Plus size={22} color="#FFFFFF" strokeWidth={2.4} />
      </button>
    </div>
  );
}
