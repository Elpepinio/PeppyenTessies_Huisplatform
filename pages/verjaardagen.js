import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, X, ChevronLeft, Cake, Gift, Search } from "lucide-react";

// ---- Constanten ----
const RELATIES = [
  { id: "partner", label: "Partner", icon: "💞" },
  { id: "familie",  label: "Familie",  icon: "👨‍👩‍👧" },
  { id: "vriend",   label: "Vriend(in)", icon: "👫" },
  { id: "collega",  label: "Collega", icon: "💼" },
  { id: "overig",   label: "Overig",  icon: "⭐" },
];

const BINNENKORT_DAGEN = 14;
const WIE_BADGE_VENSTER_MS = 24 * 60 * 60 * 1000;

const CADEAU_STATUSSEN = ["Idee", "Gekocht", "Ingepakt", "Gegeven"];

// ---- Helpers ----
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function vandaag() {
  const d = new Date();
  return { j: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
}

// Tijdzone-veilige berekening: dagen tot de eerstvolgende verjaardag, en de
// leeftijd die de persoon op die verjaardag wordt.
function berekenVerjaardag(geboortedatum) {
  if (!geboortedatum) return { dagenTot: null, wordtLeeftijd: null, huidigeLeeftijd: null, isVandaag: false };
  const [gj, gm, gd] = geboortedatum.split("-").map(Number);
  const nu = vandaag();
  const vandaagMidnight = new Date(nu.j, nu.m, nu.d);

  let volgende = new Date(nu.j, gm - 1, gd);
  if (volgende < vandaagMidnight) volgende = new Date(nu.j + 1, gm - 1, gd);

  const dagenTot = Math.round((volgende - vandaagMidnight) / (1000 * 60 * 60 * 24));
  const wordtLeeftijd = volgende.getFullYear() - gj;

  let huidigeLeeftijd = nu.j - gj;
  const nogNietGehadDitJaar = nu.m < gm - 1 || (nu.m === gm - 1 && nu.d < gd);
  if (nogNietGehadDitJaar) huidigeLeeftijd -= 1;

  return { dagenTot, wordtLeeftijd, huidigeLeeftijd, isVandaag: dagenTot === 0 };
}

async function loadData() {
  try {
    const res = await fetch("/api/verjaardagen");
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function saveData(data) {
  try {
    await fetch("/api/verjaardagen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) { console.error("Opslaan mislukt", e); }
}

// Maakt (of hergebruikt) een cadeaulijst in de Lijsten-tool voor deze persoon.
async function startCadeaulijst(naam) {
  try {
    const res = await fetch("/api/lijsten");
    if (!res.ok) return null;
    const data = await res.json();
    const lists = data.lists || [];
    const nieuweLijst = {
      id: uid(), name: `Cadeaus voor ${naam}`, icon: "🎁", type: "cadeau",
      categories: [{ id: "cadeaus", label: "Cadeau-ideeën", icon: "🎁" }],
      items: [], history: {}, favorites: [], createdAt: Date.now(),
    };
    const nextLists = [...lists, nieuweLijst];
    await fetch("/api/lijsten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, lists: nextLists }),
    });
    return nieuweLijst.id;
  } catch (e) {
    console.error("Kon cadeaulijst niet aanmaken", e);
    return null;
  }
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
  bg: "#FDF3F6", surf: "#FFFFFF", card: "#FBE6ED",
  border: "#F3D3DF", accent: "#D6336C", accentDark: "#A3204F",
  text: "#301820", muted: "#A3808F", green: "#3A7D5C",
};

const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: C.accentDark },
  main: { padding: "4px 20px 120px" },
  inp: { background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 15, width: "100%", boxSizing: "border-box", color: C.text },
  btn: (bg=C.accent, col="#FFFFFF") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, marginBottom: 10 },
  fab: { position: "fixed", bottom: 28, right: 20, width: 52, height: 52, borderRadius: 16, background: C.accent, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px rgba(214,51,108,0.35)", zIndex: 50 },
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
  chip: (active) => ({ border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accent : "#FFFFFF", color: active ? "#FFF" : C.muted, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }),
};

export default function VerjaardagenApp() {
  const [personen, setPersonenState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [huidigeGebruiker, setHuidigeGebruiker] = useState(null);
  const lastWriteRef = useRef(0);

  const [relatieFilter, setRelatieFilter] = useState(null);
  const [zoekterm, setZoekterm] = useState("");
  const [toast, setToast] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ naam: "", geboortedatum: "", relatie: "familie", cadeauIdee: "" });

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.user) setHuidigeGebruiker(d.user);
    }).catch(() => {});
  }, []);

  const persist = useCallback((nextPersonen) => {
    lastWriteRef.current = Date.now();
    setPersonenState(nextPersonen);
    saveData({ personen: nextPersonen });
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (Date.now() - lastWriteRef.current < 5000) return;
      const data = await loadData();
      if (active && data) {
        setPersonenState(data.personen || []);
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

  function resetForm() {
    setForm({ naam: "", geboortedatum: "", relatie: "familie", cadeauIdee: "" });
    setEditId(null);
  }

  function opslaanPersoon() {
    if (!form.naam.trim() || !form.geboortedatum) return;
    if (editId) {
      persist(personen.map(p => p.id === editId ? { ...p, ...form } : p));
      showToast(`✅ ${form.naam} bijgewerkt`);
    } else {
      const nieuw = { id: uid(), ...form, cadeauLijstId: null, addedAt: Date.now(), addedBy: huidigeGebruiker };
      persist([...personen, nieuw]);
      showToast(`✅ ${form.naam} toegevoegd`);
    }
    resetForm();
    setShowAdd(false);
  }

  function bewerkPersoon(p) {
    setForm({ naam: p.naam, geboortedatum: p.geboortedatum, relatie: p.relatie, cadeauIdee: p.cadeauIdee || "" });
    setEditId(p.id);
    setShowAdd(true);
  }

  function verwijderPersoon(id) {
    if (!window.confirm("Deze persoon verwijderen?")) return;
    persist(personen.filter(p => p.id !== id));
  }

  async function handleStartCadeaulijst(p) {
    showToast("🎁 Cadeaulijst wordt aangemaakt…");
    const lijstId = await startCadeaulijst(p.naam);
    if (lijstId) {
      persist(personen.map(x => x.id === p.id ? { ...x, cadeauLijstId: lijstId } : x));
      showToast(`✅ Cadeaulijst voor ${p.naam} aangemaakt`);
    } else {
      showToast("❌ Kon cadeaulijst niet aanmaken");
    }
  }

  // ── Afgeleide data ────────────────────────────────────
  let zichtbaar = personen;
  if (relatieFilter) zichtbaar = zichtbaar.filter(p => p.relatie === relatieFilter);
  if (zoekterm.trim()) zichtbaar = zichtbaar.filter(p => p.naam.toLowerCase().includes(zoekterm.toLowerCase()));

  const metBerekening = zichtbaar
    .map(p => ({ ...p, ...berekenVerjaardag(p.geboortedatum) }))
    .sort((a, b) => (a.dagenTot ?? 9999) - (b.dagenTot ?? 9999));

  const eerstvolgende = personen
    .map(p => ({ ...p, ...berekenVerjaardag(p.geboortedatum) }))
    .filter(p => p.dagenTot !== null && p.dagenTot <= BINNENKORT_DAGEN)
    .sort((a, b) => a.dagenTot - b.dagenTot);

  if (loading) return (
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <Cake size={32} color={C.accent} />
        <p style={{ color: C.muted, fontSize: 14 }}>Verjaardagen laden…</p>
      </div>
    </div>
  );

  return (
    <div style={S.appBg}>
      {offline && (
        <div style={{ background:"#C86E4A", color:"#FFF", padding:"8px 16px", fontSize:12, fontWeight:600, textAlign:"center" }}>
          📡 Geen verbinding — je ziet de laatst opgehaalde gegevens. Wijzigen kan pas weer zodra je online bent.
        </div>
      )}
      <header style={S.header}>
        <div>
          <Link href="/" style={S.switchBtn}><ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> Terug</Link>
          <h1 style={S.title}>🎂 Verjaardagen</h1>
        </div>
      </header>

      <main style={S.main}>
        {/* Eerstvolgende verjaardagen */}
        {eerstvolgende.length > 0 && (
          <div style={{ background: C.accent, borderRadius: 16, padding: "14px 16px", marginBottom: 14, color: "#FFF" }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.9 }}>
              🎉 Binnenkort jarig
            </p>
            {eerstvolgende.map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                <span>{p.naam}</span>
                <span style={{ fontWeight: 700 }}>
                  {p.isVandaag ? "🎂 Vandaag!" : p.dagenTot === 1 ? "Morgen" : `over ${p.dagenTot} dagen`} · wordt {p.wordtLeeftijd}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Zoekbalk */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={15} color={C.muted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input style={{ ...S.inp, paddingLeft: 36 }} placeholder="Zoeken…" value={zoekterm} onChange={e => setZoekterm(e.target.value)} />
        </div>

        {/* Relatiefilter */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
          <button style={S.chip(!relatieFilter)} onClick={() => setRelatieFilter(null)}>Iedereen</button>
          {RELATIES.map(r => (
            <button key={r.id} style={S.chip(relatieFilter === r.id)} onClick={() => setRelatieFilter(r.id)}>
              {r.icon} {r.label}
            </button>
          ))}
        </div>

        {personen.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: C.accentDark, margin: "0 0 6px" }}>Nog niemand toegevoegd</p>
            <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>Tik op + om de eerste verjaardag toe te voegen.</p>
          </div>
        )}

        {zichtbaar.length === 0 && personen.length > 0 && (
          <p style={{ textAlign: "center", color: C.muted, fontSize: 14, padding: "20px 0" }}>Niks gevonden.</p>
        )}

        {metBerekening.map(p => {
          const relatie = RELATIES.find(r => r.id === p.relatie);
          const binnenkort = p.dagenTot !== null && p.dagenTot <= BINNENKORT_DAGEN;
          return (
            <div key={p.id} style={{ ...S.card, border: binnenkort ? `1.5px solid ${C.accent}` : `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }} onClick={() => bewerkPersoon(p)}>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{p.naam}</span>
                    <WieBadge persoon={p.addedBy} tijdstip={p.addedAt} />
                    {p.isVandaag && (
                      <span style={{ fontSize: 10, background: `${C.accent}22`, color: C.accentDark, padding: "2px 7px", borderRadius: 8, fontWeight: 700 }}>
                        🎂 Vandaag!
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                    {relatie?.icon} {relatie?.label} · wordt {p.wordtLeeftijd} jaar
                    {p.dagenTot !== null && ` · ${p.isVandaag ? "vandaag" : p.dagenTot === 1 ? "morgen" : `over ${p.dagenTot} dagen`}`}
                  </div>
                  {p.cadeauIdee && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", marginTop: 3 }}>🎁 {p.cadeauIdee}</div>}
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <button style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }} onClick={() => verwijderPersoon(p.id)}>
                    <X size={16} />
                  </button>
                  {p.cadeauLijstId ? (
                    <Link href={`/lijsten?lijst=${p.cadeauLijstId}`} style={{ ...S.btn(C.green), padding: "6px 10px", fontSize: 11, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Gift size={12} /> Cadeaulijst
                    </Link>
                  ) : (
                    <button style={{ ...S.btn(), padding: "6px 10px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }} onClick={() => handleStartCadeaulijst(p)}>
                      <Gift size={12} /> Cadeaulijst starten
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </main>

      <button style={S.fab} onClick={() => { resetForm(); setShowAdd(true); }} aria-label="Verjaardag toevoegen">
        <Plus size={24} color="#FFFFFF" />
      </button>

      {/* Toevoeg/bewerk-paneel */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => { setShowAdd(false); resetForm(); }}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "85vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>{editId ? "Bewerken" : "Verjaardag toevoegen"}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => { setShowAdd(false); resetForm(); }}>
                <X size={20} color={C.muted} />
              </button>
            </div>

            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Naam" value={form.naam}
              onChange={e => setForm(f => ({ ...f, naam: e.target.value }))} autoFocus />

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>
              Geboortedatum
            </label>
            <input style={{ ...S.inp, marginBottom: 10 }} type="date" value={form.geboortedatum}
              onChange={e => setForm(f => ({ ...f, geboortedatum: e.target.value }))} />

            <select style={{ ...S.inp, marginBottom: 10 }} value={form.relatie} onChange={e => setForm(f => ({ ...f, relatie: e.target.value }))}>
              {RELATIES.map(r => <option key={r.id} value={r.id}>{r.icon} {r.label}</option>)}
            </select>

            <input style={{ ...S.inp, marginBottom: 16 }} placeholder="Cadeau-idee (optioneel)" value={form.cadeauIdee}
              onChange={e => setForm(f => ({ ...f, cadeauIdee: e.target.value }))} />

            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15 }} onClick={opslaanPersoon}>
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
