import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, X, ChevronLeft, Search, Camera, Trash2, ExternalLink, Palette } from "lucide-react";

// ── Constanten ─────────────────────────────────────────
const CATEGORIEEN = [
  { id: "verf",     label: "Verf",           icon: "🎨" },
  { id: "tegels",   label: "Tegels",         icon: "◻️" },
  { id: "hout",     label: "Hout",           icon: "🪵" },
  { id: "steen",    label: "Steen",          icon: "🪨" },
  { id: "textiel",  label: "Stof & textiel", icon: "🧵" },
  { id: "overig",   label: "Overig",         icon: "📦" },
];
const CAT_MAP = Object.fromEntries(CATEGORIEEN.map(c => [c.id, c]));

const TOEPASSINGEN = [
  { id: "keuken",  label: "Keuken" },
  { id: "wand",    label: "Wand" },
  { id: "gevel",   label: "Gevel" },
  { id: "vloer",   label: "Vloer" },
  { id: "kozijn",  label: "Kozijn/deur" },
  { id: "meubel",  label: "Meubel" },
];

// Veelgebruikte materiaal-/verffabrikanten, als snelkeuze bij het invullen
// van "Fabrikant" — puur de merknaam, geen verzonnen specifieke kleuren of
// kleurcodes: die vul je zelf in op basis van wat je bij de fabrikant zelf
// hebt opgezocht (staal, website, showroom).
const FABRIKANT_PRESETS = [
  "Little Greene Paint & Paper",
  "Farrow & Ball",
  "Egger",
  "Dekodur",
  "Tylko",
  "Fenix NTA",
  "Mosa",
  "Sikkens",
  "Flexa",
  "Histor",
  "Wijzonol",
  "Levis",
  "Caparol",
  "Brillux",
  "Douglas & Jones",
  "Villeroy & Boch",
  "Bruynzeel",
  "Quick-Step",
  "Haro",
  "Resopal",
];

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Comprimeert een foto naar een kleine JPEG (dataURL) voor opslag.
async function comprimeerFoto(file, max = 900) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > max || height > max) {
        if (width > height) { height = Math.round(height * max / width); width = max; }
        else { width = Math.round(width * max / height); height = max; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Kon foto niet lezen")); };
    img.src = url;
  });
}

function WieBadge({ persoon, C }) {
  if (!persoon) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 16, height: 16, borderRadius: "50%",
      background: persoon === "Pepijn" ? "#2D4A3E" : "#C86E4A",
      color: "#FAF6F0", fontSize: 8, fontWeight: 700, flexShrink: 0,
    }}>
      {persoon.charAt(0)}
    </span>
  );
}

// Bepaalt of witte of donkere tekst leesbaarder is op een gegeven hex-kleur.
function tekstKleurVoor(hex) {
  if (!hex || !/^#?[0-9a-fA-F]{6}$/.test(hex)) return "#1A1A1A";
  const h = hex.replace("#","");
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  const helderheid = (r*299 + g*587 + b*114) / 1000;
  return helderheid > 150 ? "#1A1A1A" : "#FFFFFF";
}

export default function MoodboardApp() {
  const [stalen, setStalenState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [huidigeGebruiker, setHuidigeGebruiker] = useState(null);
  const lastWriteRef = useRef(0);
  const fotoInputRef = useRef(null);

  const [zoekterm, setZoekterm] = useState("");
  const [catFilter, setCatFilter] = useState(null);
  const [fabrikantFilter, setFabrikantFilter] = useState(null);
  const [toast, setToast] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(LEEG_FORM());
  const [showDetail, setShowDetail] = useState(null);
  const [voorbeeldenLoading, setVoorbeeldenLoading] = useState(false);
  const [toepassing, setToepassing] = useState("keuken");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.user) setHuidigeGebruiker(d.user);
    }).catch(() => {});
  }, []);

  const persist = useCallback((nextStalen) => {
    lastWriteRef.current = Date.now();
    setStalenState(nextStalen);
    fetch("/api/moodboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stalen: nextStalen }),
    }).catch(e => console.error("Opslaan mislukt", e));
  }, []);

  const laadData = useCallback(async () => {
    try {
      const res = await fetch("/api/moodboard");
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }, []);

  useEffect(() => {
    let actief = true;
    const refresh = async () => {
      if (Date.now() - lastWriteRef.current < 5000) return;
      const data = await laadData();
      if (actief && data) {
        setStalenState(data.stalen || []);
        setLoading(false);
      } else if (actief) setLoading(false);
    };
    refresh();
    const poll = setInterval(refresh, 8000);
    return () => { actief = false; clearInterval(poll); };
  }, [laadData]);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2800); }

  function resetForm() { setForm(LEEG_FORM()); setEditId(null); }

  function opslaanStaal() {
    if (!form.kleurNaam.trim()) return;
    if (editId) {
      persist(stalen.map(s => s.id === editId ? { ...s, ...form } : s));
      showToast(`✅ ${form.kleurNaam} bijgewerkt`);
    } else {
      const nieuw = { id: uid(), ...form, addedAt: Date.now(), addedBy: huidigeGebruiker };
      persist([nieuw, ...stalen]);
      showToast(`✅ ${form.kleurNaam} toegevoegd`);
    }
    resetForm();
    setShowForm(false);
  }

  function bewerkStaal(s) {
    setForm({
      kleurNaam: s.kleurNaam || "", fabrikant: s.fabrikant || "", kleurcode: s.kleurcode || "",
      hex: s.hex || "", categorie: s.categorie || "verf", notitie: s.notitie || "", foto: s.foto || null,
    });
    setEditId(s.id);
    setShowForm(true);
  }

  function verwijderStaal(id) {
    if (!window.confirm("Dit staal verwijderen?")) return;
    persist(stalen.filter(s => s.id !== id));
    if (showDetail === id) setShowDetail(null);
  }

  async function handleFotoUpload(file) {
    if (!file) return;
    const compressed = await comprimeerFoto(file);
    setForm(f => ({ ...f, foto: compressed }));
  }

  // Zoekt echte, grootschalige toepassingsvoorbeelden van deze kleur op het
  // web (bv. een hele keuken in deze kleur), zodat je beter kunt inschatten
  // wat de kleur op groot oppervlak doet dan op een klein staaltje.
  async function zoekVoorbeelden(staal, toepassingKeuze) {
    setVoorbeeldenLoading(true);
    try {
      const res = await fetch("/api/moodboard-voorbeelden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kleurNaam: staal.kleurNaam, fabrikant: staal.fabrikant, kleurcode: staal.kleurcode,
          toepassing: TOEPASSINGEN.find(t => t.id === toepassingKeuze)?.label || toepassingKeuze,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mislukt");
      persist(stalen.map(x => x.id === staal.id ? { ...x, gevondenVoorbeelden: data.resultaten, gevondenVoorbeeldenOpmerking: data.opmerking, gevondenVoorbeeldenOp: Date.now(), gevondenVoorbeeldenToepassing: toepassingKeuze } : x));
      if (!data.resultaten.length) showToast(data.opmerking ? `ℹ️ ${data.opmerking}` : "ℹ️ Niets gevonden");
      else showToast(`✅ ${data.resultaten.length} voorbeelden gevonden`);
    } catch (e) {
      showToast(`❌ ${e.message || "Kon geen voorbeelden vinden"}`);
    }
    setVoorbeeldenLoading(false);
  }

  // ── Afgeleide data ──────────────────────────────────────
  let zichtbaar = [...stalen];
  if (catFilter) zichtbaar = zichtbaar.filter(s => s.categorie === catFilter);
  if (fabrikantFilter) zichtbaar = zichtbaar.filter(s => s.fabrikant === fabrikantFilter);
  if (zoekterm.trim()) {
    const z = zoekterm.toLowerCase();
    zichtbaar = zichtbaar.filter(s =>
      (s.kleurNaam||"").toLowerCase().includes(z) ||
      (s.fabrikant||"").toLowerCase().includes(z) ||
      (s.notitie||"").toLowerCase().includes(z)
    );
  }
  zichtbaar.sort((a,b) => (b.addedAt||0) - (a.addedAt||0));

  if (loading) return (
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <Palette size={32} color={C.accent} />
        <p style={{ color: C.muted, fontSize: 14 }}>Moodboard laden…</p>
      </div>
    </div>
  );

  return (
    <MoodboardView
      stalen={stalen} zichtbaar={zichtbaar} offline={offline}
      zoekterm={zoekterm} setZoekterm={setZoekterm}
      catFilter={catFilter} setCatFilter={setCatFilter}
      fabrikantFilter={fabrikantFilter} setFabrikantFilter={setFabrikantFilter}
      showForm={showForm} setShowForm={setShowForm} form={form} setForm={setForm}
      editId={editId} resetForm={resetForm} opslaanStaal={opslaanStaal}
      bewerkStaal={bewerkStaal} verwijderStaal={verwijderStaal}
      handleFotoUpload={handleFotoUpload} fotoInputRef={fotoInputRef}
      showDetail={showDetail} setShowDetail={setShowDetail}
      zoekVoorbeelden={zoekVoorbeelden} voorbeeldenLoading={voorbeeldenLoading}
      toepassing={toepassing} setToepassing={setToepassing}
      toast={toast}
    />
  );
}

function LEEG_FORM() {
  return { kleurNaam: "", fabrikant: "", kleurcode: "", hex: "", categorie: "verf", notitie: "", foto: null };
}
const C = {
  bg: "#F5F3EF", surf: "#FFFFFF", card: "#ECE7DD",
  border: "#DDD5C7", accent: "#9C6B4F", accentDark: "#6B4530",
  text: "#292420", muted: "#8F887A", green: "#2D6A4F", red: "#C0392B", yellow: "#C97D0C",
};
const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: C.accentDark },
  main: { padding: "4px 20px 120px" },
  inp: { background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 15, width: "100%", boxSizing: "border-box", color: C.text },
  btn: (bg=C.accent, col="#FFFFFF") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, marginBottom: 10 },
  fab: { position: "fixed", bottom: 28, right: 20, width: 52, height: 52, borderRadius: 16, background: C.accent, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px rgba(156,107,79,0.35)", zIndex: 50 },
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
  chip: (active) => ({ border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accent : "#FFFFFF", color: active ? "#FFF" : C.muted, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }),
};

function MoodboardView({
  stalen, zichtbaar, offline, zoekterm, setZoekterm, catFilter, setCatFilter,
  fabrikantFilter, setFabrikantFilter,
  showForm, setShowForm, form, setForm, editId, resetForm, opslaanStaal,
  bewerkStaal, verwijderStaal, handleFotoUpload, fotoInputRef,
  showDetail, setShowDetail, zoekVoorbeelden, voorbeeldenLoading,
  toepassing, setToepassing, toast,
}) {
  const detailStaal = showDetail ? stalen.find(s => s.id === showDetail) : null;
  const kleurVoorTegel = s => s.hex || null;

  return (
    <div style={S.appBg}>
      {offline && (
        <div style={{ background: C.yellow, color: "#FFF", padding: "8px 16px", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
          📡 Geen verbinding — je ziet de laatst opgehaalde gegevens.
        </div>
      )}
      <header style={S.header}>
        <div>
          <Link href="/" style={S.switchBtn}><ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> Terug</Link>
          <h1 style={S.title}>🎨 Moodboard</h1>
        </div>
      </header>

      <main style={S.main}>
        {/* Zoeken */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={15} color={C.muted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input style={{ ...S.inp, paddingLeft: 36 }} placeholder="Zoeken op kleur, fabrikant, notitie…" value={zoekterm} onChange={e => setZoekterm(e.target.value)} />
        </div>

        {/* Categorie-filters */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 8, paddingBottom: 2 }}>
          <button style={S.chip(!catFilter)} onClick={() => setCatFilter(null)}>Alles</button>
          {CATEGORIEEN.map(c => (
            <button key={c.id} style={S.chip(catFilter === c.id)} onClick={() => setCatFilter(catFilter === c.id ? null : c.id)}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {/* Fabrikant-filters — alleen fabrikanten die je al gebruikt */}
        {[...new Set(stalen.map(s => s.fabrikant).filter(Boolean))].length > 0 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
            <button style={S.chip(!fabrikantFilter)} onClick={() => setFabrikantFilter(null)}>Alle fabrikanten</button>
            {[...new Set(stalen.map(s => s.fabrikant).filter(Boolean))].map(f => (
              <button key={f} style={S.chip(fabrikantFilter === f)} onClick={() => setFabrikantFilter(fabrikantFilter === f ? null : f)}>{f}</button>
            ))}
          </div>
        )}

        {zichtbaar.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: C.accentDark, margin: "0 0 6px" }}>
              {stalen.length === 0 ? "Nog geen stalen" : "Niets gevonden"}
            </p>
            <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>
              {stalen.length === 0 ? "Tik op + om je eerste kleurstaal toe te voegen." : "Probeer een andere zoekterm of filter."}
            </p>
          </div>
        )}

        {/* Moodboard-grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {zichtbaar.map(s => {
            const hexKleur = kleurVoorTegel(s);
            return (
              <div key={s.id} onClick={() => setShowDetail(s.id)}
                style={{ borderRadius: 14, overflow: "hidden", cursor: "pointer", border: `1px solid ${C.border}`, background: C.surf }}>
                {s.foto ? (
                  <img src={s.foto} alt="" style={{ width: "100%", height: 100, objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: 100, background: hexKleur || C.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                    {!hexKleur && (CAT_MAP[s.categorie]?.icon || "🎨")}
                  </div>
                )}
                <div style={{ padding: "8px 10px" }}>
                  <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.kleurNaam}</p>
                  <p style={{ margin: 0, fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.fabrikant || CAT_MAP[s.categorie]?.label}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                    <WieBadge persoon={s.addedBy} C={C} />
                    {s.gevondenVoorbeelden?.length > 0 && <span style={{ fontSize: 10, color: C.accent }}>🖼️ {s.gevondenVoorbeelden.length}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <button style={S.fab} onClick={() => { resetForm(); setShowForm(true); }} aria-label="Staal toevoegen">
        <Plus size={24} color="#FFFFFF" />
      </button>

      {/* Toevoeg/bewerk-formulier */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => { setShowForm(false); resetForm(); }}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>{editId ? "Staal bewerken" : "Staal toevoegen"}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => { setShowForm(false); resetForm(); }}>
                <X size={20} color={C.muted} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
              {form.foto ? (
                <img src={form.foto} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover" }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 10, background: form.hex || C.card, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Camera size={22} color={form.hex ? tekstKleurVoor(form.hex) : C.muted} />
                </div>
              )}
              <button style={{ ...S.btn(C.card, C.accentDark), border: `1px solid ${C.border}`, fontSize: 13, padding: "9px 14px" }}
                onClick={() => fotoInputRef.current?.click()}>
                Foto van staal {form.foto ? "wijzigen" : "toevoegen"}
              </button>
              <input ref={fotoInputRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => { handleFotoUpload(e.target.files[0]); e.target.value = ""; }} />
            </div>

            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Kleurnaam (bv. Grafietgrijs)" value={form.kleurNaam}
              onChange={e => setForm(f => ({ ...f, kleurNaam: e.target.value }))} autoFocus />

            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input style={S.inp} placeholder="Fabrikant" value={form.fabrikant}
                onChange={e => setForm(f => ({ ...f, fabrikant: e.target.value }))} />
              <input style={S.inp} placeholder="Kleurcode (RAL/NCS)" value={form.kleurcode}
                onChange={e => setForm(f => ({ ...f, kleurcode: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {[...new Set([...FABRIKANT_PRESETS, ...stalen.map(s => s.fabrikant).filter(Boolean)])].sort((a,b) => a.localeCompare(b)).map(naam => (
                <button key={naam} type="button" style={S.chip(form.fabrikant === naam)}
                  onClick={() => setForm(f => ({ ...f, fabrikant: f.fabrikant === naam ? "" : naam }))}>
                  {naam}
                </button>
              ))}
            </div>
            <p style={{ margin: "-4px 0 10px", fontSize: 10, color: C.muted }}>
              Typ je hierboven een nieuw merk in en sla je het staal op? Dan staat dat merk vanaf dan ook als chip klaar — geen aparte beheerlijst nodig.
            </p>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Kleur (voor de tegel, optioneel)</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
              <input type="color" value={form.hex || "#9C6B4F"} onChange={e => setForm(f => ({ ...f, hex: e.target.value }))}
                style={{ width: 44, height: 44, borderRadius: 10, border: `1px solid ${C.border}`, padding: 2, background: "none" }} />
              <input style={S.inp} placeholder="#hexcode (optioneel)" value={form.hex}
                onChange={e => setForm(f => ({ ...f, hex: e.target.value }))} />
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Categorie</label>
            <select style={{ ...S.inp, marginBottom: 10 }} value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}>
              {CATEGORIEEN.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>

            <input style={{ ...S.inp, marginBottom: 16 }} placeholder="Notitie (optioneel)" value={form.notitie}
              onChange={e => setForm(f => ({ ...f, notitie: e.target.value }))} />

            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15 }} onClick={opslaanStaal}>
              {editId ? "Opslaan" : "Toevoegen"}
            </button>
          </div>
        </div>
      )}

      {/* Detailweergave */}
      {detailStaal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => setShowDetail(null)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.accentDark }}>{detailStaal.kleurNaam}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowDetail(null)}>
                <X size={20} color={C.muted} />
              </button>
            </div>

            {detailStaal.foto ? (
              <img src={detailStaal.foto} alt="" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 12, marginBottom: 14 }} />
            ) : detailStaal.hex && (
              <div style={{ width: "100%", height: 100, background: detailStaal.hex, borderRadius: 12, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", color: tekstKleurVoor(detailStaal.hex), fontWeight: 700, fontSize: 13 }}>
                {detailStaal.hex}
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {detailStaal.fabrikant && <span style={{ ...S.card, margin: 0, padding: "6px 12px", fontSize: 13 }}>{detailStaal.fabrikant}</span>}
              {detailStaal.kleurcode && <span style={{ ...S.card, margin: 0, padding: "6px 12px", fontSize: 13 }}>{detailStaal.kleurcode}</span>}
              <span style={{ ...S.card, margin: 0, padding: "6px 12px", fontSize: 13 }}>{CAT_MAP[detailStaal.categorie]?.icon} {CAT_MAP[detailStaal.categorie]?.label}</span>
            </div>

            {detailStaal.notitie && (
              <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic", margin: "0 0 16px" }}>📝 {detailStaal.notitie}</p>
            )}

            {/* Zoek grootschalige voorbeelden */}
            <div style={{ ...S.card, marginBottom: 16 }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: C.text }}>🖼️ Hoe oogt dit op groot oppervlak?</p>
              <p style={{ margin: "0 0 10px", fontSize: 11, color: C.muted }}>
                Een kleur op een klein staaltje oogt vaak anders dan op een hele keuken of wand — de tool zoekt echte, gerealiseerde voorbeelden op het web.
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {TOEPASSINGEN.map(t => (
                  <button key={t.id} style={S.chip(toepassing === t.id)} onClick={() => setToepassing(t.id)}>{t.label}</button>
                ))}
              </div>
              <button style={{ ...S.btn(), width: "100%", padding: "10px 0", fontSize: 13 }}
                onClick={() => zoekVoorbeelden(detailStaal, toepassing)} disabled={voorbeeldenLoading}>
                {voorbeeldenLoading ? "Zoeken…" : `🔍 Zoek voorbeelden — ${TOEPASSINGEN.find(t=>t.id===toepassing)?.label}`}
              </button>

              {detailStaal.gevondenVoorbeelden?.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {detailStaal.gevondenVoorbeelden.map((v, idx) => (
                    <a key={idx} href={v.link} target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", gap: 10, textDecoration: "none", color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, alignItems: "center" }}>
                      {v.foto ? (
                        <img src={v.foto} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 56, height: 56, borderRadius: 8, background: C.card, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <ExternalLink size={16} color={C.muted} />
                        </div>
                      )}
                      <span style={{ fontSize: 12, flex: 1 }}>{v.omschrijving}</span>
                    </a>
                  ))}
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: C.muted }}>
                    Gezocht op {new Date(detailStaal.gevondenVoorbeeldenOp).toLocaleString("nl-NL", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}
                  </p>
                </div>
              )}
              {detailStaal.gevondenVoorbeeldenOp && !detailStaal.gevondenVoorbeelden?.length && !voorbeeldenLoading && (
                <p style={{ margin: "10px 0 0", fontSize: 12, color: C.muted }}>{detailStaal.gevondenVoorbeeldenOpmerking || "Niets bruikbaars gevonden — probeer een andere toepassing."}</p>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn(C.card, C.accentDark), flex: 1, border: `1px solid ${C.border}` }} onClick={() => { setShowDetail(null); bewerkStaal(detailStaal); }}>
                Bewerken
              </button>
              <button style={{ ...S.btn(C.red), flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => verwijderStaal(detailStaal.id)}>
                <Trash2 size={14} /> Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", background: C.accentDark, color: "#FFF", padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 200, boxShadow: "0 6px 16px rgba(0,0,0,0.2)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
