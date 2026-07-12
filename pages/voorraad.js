import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, X, ChevronLeft, AlertTriangle, Search, Package } from "lucide-react";

// ---- Constanten ----
const CATEGORIEEN = [
  { id: "zuivel_eieren",  label: "Zuivel & Eieren",  icon: "🥛" },
  { id: "vlees_vis",      label: "Vlees & Vis",      icon: "🥩" },
  { id: "groente_fruit",  label: "Groente & Fruit",  icon: "🥦" },
  { id: "brood_bakkerij", label: "Brood & Bakkerij", icon: "🥐" },
  { id: "houdbaar",       label: "Houdbaar",         icon: "🥫" },
  { id: "diepvries",      label: "Diepvries",        icon: "🧊" },
  { id: "drogisterij",    label: "Drogisterij",      icon: "🧴" },
  { id: "huishouden",     label: "Huishouden",       icon: "🧽" },
  { id: "dranken",        label: "Dranken",          icon: "🧃" },
  { id: "overig",         label: "Overig",           icon: "📦" },
];

const LOCATIES = [
  { id: "koelkast", label: "Koelkast", icon: "❄️" },
  { id: "vriezer",  label: "Vriezer",  icon: "🧊" },
  { id: "kast",     label: "Kast",     icon: "🗄️" },
  { id: "overig",   label: "Overig",   icon: "📦" },
];

const UNITS = ["stuks", "g", "kg", "ml", "l", "pak"];

const VERLOOPT_BINNENKORT_DAGEN = 3;
const WIE_BADGE_VENSTER_MS = 24 * 60 * 60 * 1000;

// ---- Helpers ----
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function vandaag() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function dagenTot(datumStr) {
  if (!datumStr) return null;
  const [j,m,d] = datumStr.split("-").map(Number);
  const doel = new Date(j, m-1, d);
  const nu = new Date();
  const vandaagMidnight = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate());
  return Math.round((doel - vandaagMidnight) / (1000*60*60*24));
}

async function loadData() {
  try {
    const res = await fetch("/api/voorraad");
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function saveData(data) {
  try {
    await fetch("/api/voorraad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) { console.error("Opslaan mislukt", e); }
}

// Voegt een bijna-op item toe aan de "Boodschappen"-lijst van de Lijsten-tool
// (of maakt die aan als hij nog niet bestaat).
async function voegToeAanBoodschappenlijst(item, huidigeGebruiker) {
  try {
    const res = await fetch("/api/lijsten");
    if (!res.ok) return { ok: false };
    const data = await res.json();
    const lists = data.lists || [];
    let lijst = lists.find(l => l.type !== "cadeau" && l.name?.toLowerCase().includes("boodschap"));
    if (!lijst) lijst = lists.find(l => l.type !== "cadeau");

    const nieuwItem = {
      id: uid(), name: item.naam,
      category: item.categorie || "overig",
      amount: 1, unit: item.eenheid && item.eenheid !== "stuks" ? item.eenheid : "stuks",
      checked: false, inCart: false, note: "", status: null, budget: null,
      addedAt: Date.now(), addedBy: huidigeGebruiker,
      lastActionBy: huidigeGebruiker, lastActionAt: Date.now(),
    };

    let nextLists;
    if (lijst) {
      const bestaat = lijst.items.some(i => i.name.toLowerCase() === item.naam.toLowerCase() && !i.checked);
      if (bestaat) return { ok: true, alBestaand: true };
      nextLists = lists.map(l => l.id === lijst.id ? { ...l, items: [...l.items, nieuwItem] } : l);
    } else {
      const nieuweLijst = {
        id: uid(), name: "Boodschappen", icon: "🛒",
        categories: CATEGORIEEN.map(c => ({ id: c.id, label: c.label, icon: c.icon })),
        items: [nieuwItem], history: {}, favorites: [], createdAt: Date.now(),
      };
      nextLists = [...lists, nieuweLijst];
    }

    await fetch("/api/lijsten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, lists: nextLists }),
    });
    return { ok: true };
  } catch (e) {
    console.error("Kon niet toevoegen aan boodschappenlijst", e);
    return { ok: false };
  }
}

function WieBadge({ persoon, tijdstip }) {
  if (!persoon || !tijdstip) return null;
  if (Date.now() - tijdstip > WIE_BADGE_VENSTER_MS) return null;
  return (
    <span
      title={`Laatst gewijzigd door ${persoon}`}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 15, height: 15, borderRadius: "50%",
        background: persoon === "Pepijn" ? "#2D4A3E" : "#C86E4A",
        color: "#FAF6F0", fontSize: 8, fontWeight: 700, marginLeft: 6, flexShrink: 0,
      }}
    >
      {persoon.charAt(0)}
    </span>
  );
}

// ---- Stijlen ----
const C = {
  bg: "#FBF7EE", surf: "#FFFFFF", card: "#F5EEDA",
  border: "#E9DFC4", accent: "#B8722E", accentDark: "#8F5620",
  text: "#2A2318", muted: "#948362", red: "#C0392B", orange: "#D68A2C", green: "#3A7D5C",
};

const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: C.accentDark },
  main: { padding: "4px 20px 120px" },
  inp: { background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 15, width: "100%", boxSizing: "border-box", color: C.text },
  btn: (bg=C.accent, col="#FFFFFF") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, marginBottom: 10 },
  fab: { position: "fixed", bottom: 28, right: 20, width: 52, height: 52, borderRadius: 16, background: C.accent, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px rgba(184,114,46,0.35)", zIndex: 50 },
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
  tabBtn: (active) => ({ flex: 1, border: "none", background: active ? C.accent : "transparent", color: active ? "#FFF" : C.muted, borderRadius: 9, padding: "9px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }),
  chip: (active) => ({ border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accent : "#FFFFFF", color: active ? "#FFF" : C.muted, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }),
  amountBtn: { width: 26, height: 26, borderRadius: 8, border: `1px solid ${C.border}`, background: "#FFFFFF", color: C.accentDark, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
};

export default function VoorraadApp() {
  const [items, setItemsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [huidigeGebruiker, setHuidigeGebruiker] = useState(null);
  const lastWriteRef = useRef(0);

  const [tab, setTab] = useState("alles"); // alles | bijnaOp | verlopenBinnenkort
  const [locatieFilter, setLocatieFilter] = useState(null);
  const [zoekterm, setZoekterm] = useState("");
  const [toast, setToast] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    naam: "", categorie: "overig", locatie: "kast",
    hoeveelheid: 1, eenheid: "stuks", minimum: 1, houdbaarheidsdatum: "", notitie: "",
  });

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.user) setHuidigeGebruiker(d.user);
    }).catch(() => {});
  }, []);

  const persist = useCallback((nextItems) => {
    lastWriteRef.current = Date.now();
    setItemsState(nextItems);
    saveData({ items: nextItems });
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (Date.now() - lastWriteRef.current < 5000) return;
      const data = await loadData();
      if (active && data) {
        setItemsState(data.items || []);
        setLoading(false);
      } else if (active) setLoading(false);
    };
    refresh();
    const poll = setInterval(refresh, 8000);
    return () => { active = false; clearInterval(poll); };
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  function resetForm() {
    setForm({ naam: "", categorie: "overig", locatie: "kast", hoeveelheid: 1, eenheid: "stuks", minimum: 1, houdbaarheidsdatum: "", notitie: "" });
    setEditId(null);
  }

  function opslaanItem() {
    if (!form.naam.trim()) return;
    if (editId) {
      persist(items.map(i => i.id === editId ? {
        ...i, ...form,
        hoeveelheid: +form.hoeveelheid || 0, minimum: +form.minimum || 0,
        lastActionBy: huidigeGebruiker, lastActionAt: Date.now(),
      } : i));
      showToast(`✅ ${form.naam} bijgewerkt`);
    } else {
      const nieuw = {
        id: uid(), ...form,
        hoeveelheid: +form.hoeveelheid || 0, minimum: +form.minimum || 0,
        addedAt: Date.now(), addedBy: huidigeGebruiker,
        lastActionBy: huidigeGebruiker, lastActionAt: Date.now(),
      };
      persist([...items, nieuw]);
      showToast(`✅ ${form.naam} toegevoegd`);
    }
    resetForm();
    setShowAdd(false);
  }

  function bewerkItem(item) {
    setForm({
      naam: item.naam, categorie: item.categorie, locatie: item.locatie,
      hoeveelheid: item.hoeveelheid, eenheid: item.eenheid, minimum: item.minimum,
      houdbaarheidsdatum: item.houdbaarheidsdatum || "", notitie: item.notitie || "",
    });
    setEditId(item.id);
    setShowAdd(true);
  }

  function verwijderItem(id) {
    persist(items.filter(i => i.id !== id));
  }

  function wijzigHoeveelheid(id, delta) {
    persist(items.map(i => {
      if (i.id !== id) return i;
      const stap = i.eenheid === "g" ? 100 : ["kg","l","ml"].includes(i.eenheid) ? 0.5 : 1;
      const nieuw = Math.max(0, Math.round((i.hoeveelheid + delta * stap) * 100) / 100);
      return { ...i, hoeveelheid: nieuw, lastActionBy: huidigeGebruiker, lastActionAt: Date.now() };
    }));
  }

  async function naarBoodschappenlijst(item) {
    const result = await voegToeAanBoodschappenlijst(item, huidigeGebruiker);
    if (result.ok) {
      showToast(result.alBestaand ? "⚠️ Staat al op de boodschappenlijst" : `🛒 ${item.naam} toegevoegd aan Boodschappen`);
    } else {
      showToast("❌ Kon niet toevoegen");
    }
  }

  // ── Afgeleide data ────────────────────────────────────
  const isBijnaOp = (i) => i.minimum > 0 && i.hoeveelheid <= i.minimum;
  const isBijnaVerlopen = (i) => {
    if (!i.houdbaarheidsdatum) return false;
    const d = dagenTot(i.houdbaarheidsdatum);
    return d !== null && d <= VERLOOPT_BINNENKORT_DAGEN;
  };

  let zichtbaar = items;
  if (locatieFilter) zichtbaar = zichtbaar.filter(i => i.locatie === locatieFilter);
  if (zoekterm.trim()) zichtbaar = zichtbaar.filter(i => i.naam.toLowerCase().includes(zoekterm.toLowerCase()));
  if (tab === "bijnaOp") zichtbaar = zichtbaar.filter(isBijnaOp);
  if (tab === "verlopenBinnenkort") zichtbaar = zichtbaar.filter(isBijnaVerlopen);

  const gegroepeerd = CATEGORIEEN.map(cat => ({
    cat, items: zichtbaar.filter(i => i.categorie === cat.id),
  })).filter(g => g.items.length > 0);

  const aantalBijnaOp = items.filter(isBijnaOp).length;
  const aantalBijnaVerlopen = items.filter(isBijnaVerlopen).length;

  if (loading) return (
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <Package size={32} color={C.accent} />
        <p style={{ color: C.muted, fontSize: 14 }}>Voorraad laden…</p>
      </div>
    </div>
  );

  return (
    <div style={S.appBg}>
      <header style={S.header}>
        <div>
          <Link href="/" style={S.switchBtn}><ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> Terug</Link>
          <h1 style={S.title}>📦 Voorraad</h1>
        </div>
      </header>

      <main style={S.main}>
        {/* Zoekbalk */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={15} color={C.muted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input style={{ ...S.inp, paddingLeft: 36 }} placeholder="Zoeken…" value={zoekterm} onChange={e => setZoekterm(e.target.value)} />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, background: C.card, borderRadius: 12, padding: 4, marginBottom: 10 }}>
          <button style={S.tabBtn(tab === "alles")} onClick={() => setTab("alles")}>Alles ({items.length})</button>
          <button style={S.tabBtn(tab === "bijnaOp")} onClick={() => setTab("bijnaOp")}>Bijna op ({aantalBijnaOp})</button>
          <button style={S.tabBtn(tab === "verlopenBinnenkort")} onClick={() => setTab("verlopenBinnenkort")}>Verloopt ({aantalBijnaVerlopen})</button>
        </div>

        {/* Locatiefilter */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
          <button style={S.chip(!locatieFilter)} onClick={() => setLocatieFilter(null)}>Alle plekken</button>
          {LOCATIES.map(l => (
            <button key={l.id} style={S.chip(locatieFilter === l.id)} onClick={() => setLocatieFilter(l.id)}>
              {l.icon} {l.label}
            </button>
          ))}
        </div>

        {items.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: C.accentDark, margin: "0 0 6px" }}>Voorraad is leeg</p>
            <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>Tik op + om je eerste product toe te voegen.</p>
          </div>
        )}

        {zichtbaar.length === 0 && items.length > 0 && (
          <p style={{ textAlign: "center", color: C.muted, fontSize: 14, padding: "20px 0" }}>Niks gevonden.</p>
        )}

        {gegroepeerd.map(({ cat, items: catItems }) => (
          <section key={cat.id} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 8px 4px" }}>
              {cat.icon} {cat.label}
            </div>
            {catItems.map(item => {
              const bijnaOp = isBijnaOp(item);
              const bijnaVerlopen = isBijnaVerlopen(item);
              const dagenOver = item.houdbaarheidsdatum ? dagenTot(item.houdbaarheidsdatum) : null;
              return (
                <div key={item.id} style={S.card}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }} onClick={() => bewerkItem(item)}>
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>{item.naam}</span>
                        <WieBadge persoon={item.lastActionBy} tijdstip={item.lastActionAt} />
                        {bijnaOp && (
                          <span style={{ fontSize: 10, background: `${C.red}18`, color: C.red, padding: "2px 7px", borderRadius: 8, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <AlertTriangle size={10} /> bijna op
                          </span>
                        )}
                        {bijnaVerlopen && (
                          <span style={{ fontSize: 10, background: `${C.orange}18`, color: C.orange, padding: "2px 7px", borderRadius: 8, fontWeight: 700 }}>
                            {dagenOver < 0 ? "verlopen" : dagenOver === 0 ? "vandaag houdbaar" : `nog ${dagenOver}d houdbaar`}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                        {LOCATIES.find(l => l.id === item.locatie)?.icon} {LOCATIES.find(l => l.id === item.locatie)?.label}
                        {item.minimum > 0 && ` · min. ${item.minimum} ${item.eenheid}`}
                      </div>
                      {item.notitie && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", marginTop: 3 }}>📝 {item.notitie}</div>}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button style={S.amountBtn} onClick={() => wijzigHoeveelheid(item.id, -1)}>−</button>
                        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 44, textAlign: "center" }}>{item.hoeveelheid} {item.eenheid}</span>
                        <button style={S.amountBtn} onClick={() => wijzigHoeveelheid(item.id, 1)}>+</button>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {bijnaOp && (
                          <button style={{ ...S.btn(C.green), padding: "6px 10px", fontSize: 11 }} onClick={() => naarBoodschappenlijst(item)}>
                            🛒 Naar lijst
                          </button>
                        )}
                        <button style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }} onClick={() => verwijderItem(item.id)}>
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </main>

      <button style={S.fab} onClick={() => { resetForm(); setShowAdd(true); }} aria-label="Product toevoegen">
        <Plus size={24} color="#FFFFFF" />
      </button>

      {/* Toevoeg/bewerk-paneel */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => { setShowAdd(false); resetForm(); }}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "85vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>{editId ? "Product bewerken" : "Product toevoegen"}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => { setShowAdd(false); resetForm(); }}>
                <X size={20} color={C.muted} />
              </button>
            </div>

            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Productnaam" value={form.naam}
              onChange={e => setForm(f => ({ ...f, naam: e.target.value }))} autoFocus />

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <select style={S.inp} value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}>
                {CATEGORIEEN.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
              <select style={S.inp} value={form.locatie} onChange={e => setForm(f => ({ ...f, locatie: e.target.value }))}>
                {LOCATIES.map(l => <option key={l.id} value={l.id}>{l.icon} {l.label}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input style={S.inp} type="number" placeholder="Hoeveelheid" value={form.hoeveelheid}
                onChange={e => setForm(f => ({ ...f, hoeveelheid: e.target.value }))} />
              <select style={S.inp} value={form.eenheid} onChange={e => setForm(f => ({ ...f, eenheid: e.target.value }))}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>
              Minimum voorraad (waarschuw als het hieronder komt)
            </label>
            <input style={{ ...S.inp, marginBottom: 10 }} type="number" placeholder="Minimum" value={form.minimum}
              onChange={e => setForm(f => ({ ...f, minimum: e.target.value }))} />

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>
              Houdbaar tot (optioneel)
            </label>
            <input style={{ ...S.inp, marginBottom: 10 }} type="date" value={form.houdbaarheidsdatum} min={vandaag()}
              onChange={e => setForm(f => ({ ...f, houdbaarheidsdatum: e.target.value }))} />

            <input style={{ ...S.inp, marginBottom: 16 }} placeholder="Notitie (optioneel)" value={form.notitie}
              onChange={e => setForm(f => ({ ...f, notitie: e.target.value }))} />

            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15 }} onClick={opslaanItem}>
              {editId ? "Opslaan" : "Toevoegen"}
            </button>
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
