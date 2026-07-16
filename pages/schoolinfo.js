import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, X, ChevronLeft, School, Search, Check, Edit2, Phone, Mail, MapPin, Repeat } from "lucide-react";

// ---- Constanten ----
const TYPES = [
  { id: "vrije_dag",   label: "Vrije dag / vakantie",   icon: "🏖️" },
  { id: "oudergesprek", label: "Oudergesprek",           icon: "🗣️" },
  { id: "uitje",        label: "Schoolreis / uitje",     icon: "🚌" },
  { id: "themadag",     label: "Verkleed-/themadag",     icon: "🎉" },
  { id: "overig",       label: "Overig",                 icon: "📌" },
];

const WEEKDAGEN = [
  { id: "maandag",   label: "Maandag" },
  { id: "dinsdag",   label: "Dinsdag" },
  { id: "woensdag",  label: "Woensdag" },
  { id: "donderdag", label: "Donderdag" },
  { id: "vrijdag",   label: "Vrijdag" },
];

const BINNENKORT_DAGEN = 7;
const WIE_BADGE_VENSTER_MS = 24 * 60 * 60 * 1000;

// ---- Helpers ----
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function vandaag() {
  const d = new Date();
  return { j: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
}

function vandaagMidnight() {
  const nu = vandaag();
  return new Date(nu.j, nu.m, nu.d);
}

// Tijdzone-veilige datumberekening: aantal dagen tussen vandaag en een
// "YYYY-MM-DD"-string. Nooit toISOString() gebruiken i.v.m. tijdzone-shift.
function dagenTotDatum(datumStr) {
  if (!datumStr) return null;
  const [j, m, d] = datumStr.split("-").map(Number);
  const doel = new Date(j, m - 1, d);
  return Math.round((doel - vandaagMidnight()) / (1000 * 60 * 60 * 24));
}

function formatDatum(datumStr, metJaar = false) {
  if (!datumStr) return "";
  const [j, m, d] = datumStr.split("-").map(Number);
  const dt = new Date(j, m - 1, d);
  return dt.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "long", ...(metJaar ? { year: "numeric" } : {}) });
}

function dagLabel(dagenTot) {
  if (dagenTot === 0) return "Vandaag";
  if (dagenTot === 1) return "Morgen";
  if (dagenTot < 0) return "Geweest";
  return `Over ${dagenTot} dagen`;
}

// Volgende kalenderdatum (YYYY-MM-DD) die op de gegeven weekdag valt, incl. vandaag.
const WEEKDAG_INDEX = { maandag: 1, dinsdag: 2, woensdag: 3, donderdag: 4, vrijdag: 5, zaterdag: 6, zondag: 0 };
function volgendeWeekdagDatum(dagId) {
  const doelIdx = WEEKDAG_INDEX[dagId];
  const nu = vandaagMidnight();
  const huidigeIdx = nu.getDay();
  let verschil = doelIdx - huidigeIdx;
  if (verschil < 0) verschil += 7;
  const doel = new Date(nu);
  doel.setDate(nu.getDate() + verschil);
  const p = (n) => String(n).padStart(2, "0");
  return `${doel.getFullYear()}-${p(doel.getMonth() + 1)}-${p(doel.getDate())}`;
}

async function loadData() {
  try {
    const res = await fetch("/api/schoolinfo");
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function saveData(data) {
  try {
    await fetch("/api/schoolinfo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) { console.error("Opslaan mislukt", e); }
}

function WieBadge({ persoon, tijdstip }) {
  if (!persoon || !tijdstip) return null;
  if (Date.now() - tijdstip > WIE_BADGE_VENSTER_MS) return null;
  return (
    <span
      title={`Toegevoegd door ${persoon}`}
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
  bg: "#EFF6F9", surf: "#FFFFFF", card: "#E1EFF5",
  border: "#CFE3EC", accent: "#2C6E8C", accentDark: "#1E4F65",
  text: "#1E2A2E", muted: "#7C93A0", green: "#3A7D5C", orange: "#C86E4A",
};

const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: C.accentDark },
  main: { padding: "4px 20px 120px" },
  inp: { background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 15, width: "100%", boxSizing: "border-box", color: C.text },
  btn: (bg=C.accent, col="#FFFFFF") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, marginBottom: 10 },
  fab: { position: "fixed", bottom: 28, right: 20, width: 52, height: 52, borderRadius: 16, background: C.accent, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px rgba(44,110,140,0.35)", zIndex: 50 },
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
  chip: (active) => ({ border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accent : "#FFFFFF", color: active ? "#FFF" : C.muted, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }),
  sectionTitle: { margin: "18px 0 8px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: C.muted },
};

export default function SchoolinfoApp() {
  const [schoolinfo, setSchoolinfoState] = useState(EMPTY_SCHOOLINFO());
  const [vasteWeekitems, setVasteWeekitemsState] = useState([]);
  const [items, setItemsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [huidigeGebruiker, setHuidigeGebruiker] = useState(null);
  const lastWriteRef = useRef(0);

  const [typeFilter, setTypeFilter] = useState(null);
  const [zoekterm, setZoekterm] = useState("");
  const [toonVerleden, setToonVerleden] = useState(false);
  const [toast, setToast] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(LEEG_FORM());

  const [showInfoBewerk, setShowInfoBewerk] = useState(false);
  const [infoForm, setInfoForm] = useState(EMPTY_SCHOOLINFO());

  const [showWeekitemAdd, setShowWeekitemAdd] = useState(false);
  const [weekitemForm, setWeekitemForm] = useState({ dag: "maandag", omschrijving: "" });

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.user) setHuidigeGebruiker(d.user);
    }).catch(() => {});
  }, []);

  const persist = useCallback((next) => {
    lastWriteRef.current = Date.now();
    const nextSchoolinfo = next.schoolinfo !== undefined ? next.schoolinfo : schoolinfo;
    const nextWeekitems  = next.vasteWeekitems !== undefined ? next.vasteWeekitems : vasteWeekitems;
    const nextItems      = next.items !== undefined ? next.items : items;
    if (next.schoolinfo !== undefined) setSchoolinfoState(nextSchoolinfo);
    if (next.vasteWeekitems !== undefined) setVasteWeekitemsState(nextWeekitems);
    if (next.items !== undefined) setItemsState(nextItems);
    saveData({ schoolinfo: nextSchoolinfo, vasteWeekitems: nextWeekitems, items: nextItems });
  }, [schoolinfo, vasteWeekitems, items]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (Date.now() - lastWriteRef.current < 5000) return;
      const data = await loadData();
      if (active && data) {
        setSchoolinfoState({ ...EMPTY_SCHOOLINFO(), ...(data.schoolinfo || {}) });
        setVasteWeekitemsState(data.vasteWeekitems || []);
        setItemsState(data.items || []);
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

  // ── Agenda-items CRUD ──────────────────────────────────
  function resetForm() {
    setForm(LEEG_FORM());
    setEditId(null);
  }

  function opslaanItem() {
    if (!form.titel.trim() || !form.datum) return;
    if (editId) {
      persist({ items: items.map(i => i.id === editId ? { ...i, ...form } : i) });
      showToast(`✅ ${form.titel} bijgewerkt`);
    } else {
      const nieuw = {
        id: uid(), ...form,
        meenemen: form.meenemenTekst
          ? form.meenemenTekst.split(",").map(t => t.trim()).filter(Boolean).map(t => ({ id: uid(), tekst: t, gedaan: false }))
          : [],
        addedAt: Date.now(), addedBy: huidigeGebruiker,
      };
      delete nieuw.meenemenTekst;
      persist({ items: [...items, nieuw] });
      showToast(`✅ ${form.titel} toegevoegd`);
    }
    resetForm();
    setShowAdd(false);
  }

  function bewerkItem(i) {
    setForm({
      titel: i.titel, type: i.type, datum: i.datum, einddatum: i.einddatum || "",
      tijd: i.tijd || "", notities: i.notities || "", meenemenTekst: "",
    });
    setEditId(i.id);
    setShowAdd(true);
  }

  function verwijderItem(id) {
    if (!window.confirm("Dit agenda-item verwijderen?")) return;
    persist({ items: items.filter(i => i.id !== id) });
  }

  function toggleMeenemen(itemId, meenemenId) {
    persist({
      items: items.map(i => i.id !== itemId ? i : {
        ...i,
        meenemen: i.meenemen.map(m => m.id === meenemenId ? { ...m, gedaan: !m.gedaan } : m),
      }),
    });
  }

  // ── Schoolinfo-kaart ────────────────────────────────────
  function opslaanInfo() {
    persist({ schoolinfo: infoForm });
    setShowInfoBewerk(false);
    showToast("✅ Schoolinfo bijgewerkt");
  }

  // ── Vaste weekitems ─────────────────────────────────────
  function opslaanWeekitem() {
    if (!weekitemForm.omschrijving.trim()) return;
    const nieuw = { id: uid(), ...weekitemForm, addedAt: Date.now(), addedBy: huidigeGebruiker };
    persist({ vasteWeekitems: [...vasteWeekitems, nieuw] });
    setWeekitemForm({ dag: "maandag", omschrijving: "" });
    setShowWeekitemAdd(false);
    showToast("✅ Wekelijks item toegevoegd");
  }

  function verwijderWeekitem(id) {
    persist({ vasteWeekitems: vasteWeekitems.filter(w => w.id !== id) });
  }

  // ── Afgeleide data ────────────────────────────────────
  let zichtbaar = items.map(i => ({ ...i, dagenTot: dagenTotDatum(i.datum) }));
  if (!toonVerleden) zichtbaar = zichtbaar.filter(i => {
    const eindeDagenTot = i.einddatum ? dagenTotDatum(i.einddatum) : i.dagenTot;
    return eindeDagenTot === null || eindeDagenTot >= 0;
  });
  if (typeFilter) zichtbaar = zichtbaar.filter(i => i.type === typeFilter);
  if (zoekterm.trim()) zichtbaar = zichtbaar.filter(i => i.titel.toLowerCase().includes(zoekterm.toLowerCase()));
  zichtbaar.sort((a, b) => (a.dagenTot ?? 9999) - (b.dagenTot ?? 9999));

  // Komende 7 dagen: eenmalige items + eerstvolgende voorkomens van vaste weekitems
  const eenmaligBinnenkort = items
    .map(i => ({ ...i, dagenTot: dagenTotDatum(i.datum), soort: "item" }))
    .filter(i => i.dagenTot !== null && i.dagenTot >= 0 && i.dagenTot <= BINNENKORT_DAGEN);

  const weekBinnenkort = vasteWeekitems.map(w => {
    const datum = volgendeWeekdagDatum(w.dag);
    return { ...w, datum, dagenTot: dagenTotDatum(datum), soort: "week" };
  }).filter(w => w.dagenTot <= BINNENKORT_DAGEN);

  const binnenkort = [...eenmaligBinnenkort, ...weekBinnenkort].sort((a, b) => a.dagenTot - b.dagenTot);

  if (loading) return (
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <School size={32} color={C.accent} />
        <p style={{ color: C.muted, fontSize: 14 }}>Schoolinfo laden…</p>
      </div>
    </div>
  );

  return (
    <SchoolinfoView
      schoolinfo={schoolinfo} vasteWeekitems={vasteWeekitems} items={items}
      offline={offline} typeFilter={typeFilter} setTypeFilter={setTypeFilter}
      zoekterm={zoekterm} setZoekterm={setZoekterm}
      toonVerleden={toonVerleden} setToonVerleden={setToonVerleden}
      zichtbaar={zichtbaar} binnenkort={binnenkort}
      showAdd={showAdd} setShowAdd={setShowAdd} form={form} setForm={setForm}
      editId={editId} resetForm={resetForm} opslaanItem={opslaanItem}
      bewerkItem={bewerkItem} verwijderItem={verwijderItem} toggleMeenemen={toggleMeenemen}
      showInfoBewerk={showInfoBewerk} setShowInfoBewerk={setShowInfoBewerk}
      infoForm={infoForm} setInfoForm={setInfoForm} opslaanInfo={opslaanInfo}
      showWeekitemAdd={showWeekitemAdd} setShowWeekitemAdd={setShowWeekitemAdd}
      weekitemForm={weekitemForm} setWeekitemForm={setWeekitemForm}
      opslaanWeekitem={opslaanWeekitem} verwijderWeekitem={verwijderWeekitem}
      toast={toast}
    />
  );
}

function EMPTY_SCHOOLINFO() {
  return { schoolnaam: "", groep: "", leerkracht: "", telefoon: "", email: "", adres: "" };
}

function LEEG_FORM() {
  return { titel: "", type: "vrije_dag", datum: "", einddatum: "", tijd: "", notities: "", meenemenTekst: "" };
}

function SchoolinfoView({
  schoolinfo, vasteWeekitems, offline, typeFilter, setTypeFilter,
  zoekterm, setZoekterm, toonVerleden, setToonVerleden, zichtbaar, binnenkort,
  showAdd, setShowAdd, form, setForm, editId, resetForm, opslaanItem,
  bewerkItem, verwijderItem, toggleMeenemen,
  showInfoBewerk, setShowInfoBewerk, infoForm, setInfoForm, opslaanInfo,
  showWeekitemAdd, setShowWeekitemAdd, weekitemForm, setWeekitemForm,
  opslaanWeekitem, verwijderWeekitem, toast,
}) {
  const heeftSchoolinfo = schoolinfo.schoolnaam || schoolinfo.leerkracht || schoolinfo.telefoon;

  return (
    <div style={S.appBg}>
      {offline && (
        <div style={{ background: C.orange, color: "#FFF", padding: "8px 16px", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
          📡 Geen verbinding — je ziet de laatst opgehaalde gegevens. Wijzigen kan pas weer zodra je online bent.
        </div>
      )}
      <header style={S.header}>
        <div>
          <Link href="/" style={S.switchBtn}><ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> Terug</Link>
          <h1 style={S.title}>🏫 Schoolinfo</h1>
        </div>
      </header>

      <main style={S.main}>
        {/* Schoolinfo-kaart */}
        <div style={{ ...S.card, background: C.accent, color: "#FFF", border: "none" }}>
          {heeftSchoolinfo ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700 }}>{schoolinfo.schoolnaam || "School"}</p>
                  {schoolinfo.groep && <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>Groep {schoolinfo.groep}{schoolinfo.leerkracht ? ` · ${schoolinfo.leerkracht}` : ""}</p>}
                </div>
                <button style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                  onClick={() => { setInfoForm(schoolinfo); setShowInfoBewerk(true); }}>
                  <Edit2 size={14} color="#FFF" />
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, fontSize: 12 }}>
                {schoolinfo.telefoon && (
                  <a href={`tel:${schoolinfo.telefoon}`} style={{ color: "#FFF", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                    <Phone size={12} /> {schoolinfo.telefoon}
                  </a>
                )}
                {schoolinfo.email && (
                  <a href={`mailto:${schoolinfo.email}`} style={{ color: "#FFF", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                    <Mail size={12} /> {schoolinfo.email}
                  </a>
                )}
                {schoolinfo.adres && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {schoolinfo.adres}</span>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.95 }}>Nog geen schoolgegevens ingevuld</p>
              <button style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 10, padding: "8px 12px", color: "#FFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                onClick={() => { setInfoForm(schoolinfo); setShowInfoBewerk(true); }}>
                Invullen
              </button>
            </div>
          )}
        </div>

        {/* Binnenkort */}
        {binnenkort.length > 0 && (
          <div style={{ background: C.accentDark, borderRadius: 16, padding: "14px 16px", marginTop: 12, color: "#FFF" }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.9 }}>
              📅 Komende 7 dagen
            </p>
            {binnenkort.map(b => (
              <div key={`${b.soort}-${b.id}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                <span>{b.soort === "week" ? <Repeat size={11} style={{ verticalAlign: "middle", marginRight: 4 }} /> : null}{b.soort === "week" ? b.omschrijving : b.titel}</span>
                <span style={{ fontWeight: 700 }}>{dagLabel(b.dagenTot)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Vaste weekitems */}
        <p style={S.sectionTitle}>Elke week</p>
        {vasteWeekitems.length === 0 && !showWeekitemAdd && (
          <p style={{ fontSize: 13, color: C.muted, margin: "0 0 8px" }}>Nog geen vaste weekitems, zoals "gymtas mee op woensdag".</p>
        )}
        {vasteWeekitems.map(w => (
          <div key={w.id} style={{ ...S.card, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13 }}>
              <strong>{WEEKDAGEN.find(d => d.id === w.dag)?.label}</strong> · {w.omschrijving}
            </span>
            <button style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }} onClick={() => verwijderWeekitem(w.id)}>
              <X size={15} />
            </button>
          </div>
        ))}
        {showWeekitemAdd ? (
          <div style={{ ...S.card }}>
            <select style={{ ...S.inp, marginBottom: 8 }} value={weekitemForm.dag} onChange={e => setWeekitemForm(f => ({ ...f, dag: e.target.value }))}>
              {WEEKDAGEN.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <input style={{ ...S.inp, marginBottom: 8 }} placeholder="Bijv. Gymtas mee" value={weekitemForm.omschrijving}
              onChange={e => setWeekitemForm(f => ({ ...f, omschrijving: e.target.value }))} autoFocus />
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn("#E4EEF3", C.accentDark), flex: 1, padding: "10px 0" }} onClick={() => setShowWeekitemAdd(false)}>Annuleer</button>
              <button style={{ ...S.btn(), flex: 1, padding: "10px 0" }} onClick={opslaanWeekitem}>Toevoegen</button>
            </div>
          </div>
        ) : (
          <button style={{ ...S.btn("#FFFFFF", C.accent), border: `1px dashed ${C.border}`, width: "100%", padding: "10px 0", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            onClick={() => setShowWeekitemAdd(true)}>
            <Plus size={14} /> Wekelijks item toevoegen
          </button>
        )}

        {/* Agenda */}
        <p style={S.sectionTitle}>Agenda</p>

        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={15} color={C.muted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input style={{ ...S.inp, paddingLeft: 36 }} placeholder="Zoeken…" value={zoekterm} onChange={e => setZoekterm(e.target.value)} />
        </div>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10, paddingBottom: 2 }}>
          <button style={S.chip(!typeFilter)} onClick={() => setTypeFilter(null)}>Alles</button>
          {TYPES.map(t => (
            <button key={t.id} style={S.chip(typeFilter === t.id)} onClick={() => setTypeFilter(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted, marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={toonVerleden} onChange={e => setToonVerleden(e.target.checked)} />
          Toon ook geweest
        </label>

        {zichtbaar.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: C.accentDark, margin: "0 0 6px" }}>Niets gevonden</p>
            <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>Tik op + om een agenda-item toe te voegen.</p>
          </div>
        )}

        {zichtbaar.map(i => {
          const type = TYPES.find(t => t.id === i.type);
          const binnenkortItem = i.dagenTot !== null && i.dagenTot >= 0 && i.dagenTot <= BINNENKORT_DAGEN;
          const geweest = i.dagenTot !== null && i.dagenTot < 0;
          return (
            <div key={i.id} style={{ ...S.card, border: binnenkortItem ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`, opacity: geweest ? 0.6 : 1 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }} onClick={() => bewerkItem(i)}>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{type?.icon} {i.titel}</span>
                    <WieBadge persoon={i.addedBy} tijdstip={i.addedAt} />
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                    {formatDatum(i.datum)}{i.einddatum ? ` t/m ${formatDatum(i.einddatum)}` : ""}{i.tijd ? ` · ${i.tijd}` : ""}
                    {i.dagenTot !== null && ` · ${dagLabel(i.dagenTot)}`}
                  </div>
                  {i.notities && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", marginTop: 3 }}>{i.notities}</div>}
                </div>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }} onClick={() => verwijderItem(i.id)}>
                  <X size={16} />
                </button>
              </div>

              {i.meenemen && i.meenemen.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.03em" }}>Mee te nemen</p>
                  {i.meenemen.map(m => (
                    <div key={m.id} onClick={() => toggleMeenemen(i.id, m.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer" }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${m.gedaan ? C.green : C.border}`,
                        background: m.gedaan ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        {m.gedaan && <Check size={12} color="#FFF" />}
                      </span>
                      <span style={{ fontSize: 13, textDecoration: m.gedaan ? "line-through" : "none", color: m.gedaan ? C.muted : C.text }}>{m.tekst}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </main>

      <button style={S.fab} onClick={() => { resetForm(); setShowAdd(true); }} aria-label="Agenda-item toevoegen">
        <Plus size={24} color="#FFFFFF" />
      </button>

      {/* Toevoeg/bewerk-paneel agenda-item */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => { setShowAdd(false); resetForm(); }}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "85vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>{editId ? "Bewerken" : "Agenda-item toevoegen"}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => { setShowAdd(false); resetForm(); }}>
                <X size={20} color={C.muted} />
              </button>
            </div>

            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Titel" value={form.titel}
              onChange={e => setForm(f => ({ ...f, titel: e.target.value }))} autoFocus />

            <select style={{ ...S.inp, marginBottom: 10 }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Datum</label>
            <input style={{ ...S.inp, marginBottom: 10 }} type="date" value={form.datum}
              onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} />

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Einddatum (optioneel, bijv. bij vakantie)</label>
            <input style={{ ...S.inp, marginBottom: 10 }} type="date" value={form.einddatum}
              onChange={e => setForm(f => ({ ...f, einddatum: e.target.value }))} />

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Tijd (optioneel)</label>
            <input style={{ ...S.inp, marginBottom: 10 }} type="time" value={form.tijd}
              onChange={e => setForm(f => ({ ...f, tijd: e.target.value }))} />

            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Notities (optioneel)" value={form.notities}
              onChange={e => setForm(f => ({ ...f, notities: e.target.value }))} />

            {!editId && (
              <>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Mee te nemen (komma-gescheiden, optioneel)
                </label>
                <input style={{ ...S.inp, marginBottom: 16 }} placeholder="Bijv. Traktatie, verkleedkleren" value={form.meenemenTekst}
                  onChange={e => setForm(f => ({ ...f, meenemenTekst: e.target.value }))} />
              </>
            )}

            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15, marginTop: editId ? 6 : 0 }} onClick={opslaanItem}>
              {editId ? "Opslaan" : "Toevoegen"}
            </button>
          </div>
        </div>
      )}

      {/* Schoolinfo bewerken */}
      {showInfoBewerk && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => setShowInfoBewerk(false)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "85vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>Schoolgegevens</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowInfoBewerk(false)}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Naam school" value={infoForm.schoolnaam}
              onChange={e => setInfoForm(f => ({ ...f, schoolnaam: e.target.value }))} autoFocus />
            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Groep" value={infoForm.groep}
              onChange={e => setInfoForm(f => ({ ...f, groep: e.target.value }))} />
            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Leerkracht" value={infoForm.leerkracht}
              onChange={e => setInfoForm(f => ({ ...f, leerkracht: e.target.value }))} />
            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Telefoonnummer" value={infoForm.telefoon}
              onChange={e => setInfoForm(f => ({ ...f, telefoon: e.target.value }))} />
            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="E-mailadres" value={infoForm.email}
              onChange={e => setInfoForm(f => ({ ...f, email: e.target.value }))} />
            <input style={{ ...S.inp, marginBottom: 16 }} placeholder="Adres" value={infoForm.adres}
              onChange={e => setInfoForm(f => ({ ...f, adres: e.target.value }))} />
            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15 }} onClick={opslaanInfo}>
              Opslaan
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
