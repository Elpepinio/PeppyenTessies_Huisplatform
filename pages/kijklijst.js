import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, X, ChevronLeft, Search, Film, Tv, Star, Share2 } from "lucide-react";

// ---- Constanten ----
const PLATFORMS = [
  { id: "netflix",   label: "Netflix",   icon: "🔴" },
  { id: "hbo",       label: "HBO Max",   icon: "🟪" },
  { id: "npoplus",   label: "NPO Plus",  icon: "🟠" },
  { id: "bioscoop",  label: "Bioscoop",  icon: "🎬" },
  { id: "anders",    label: "Anders",    icon: "📺" },
];

const STATUSSEN = [
  { id: "wil_kijken",    label: "Wil kijken",     icon: "👀" },
  { id: "aan_het_kijken", label: "Aan het kijken", icon: "▶️" },
  { id: "gekeken",       label: "Gekeken",        icon: "✅" },
];

const WIE_BADGE_VENSTER_MS = 24 * 60 * 60 * 1000;

// ---- Helpers ----
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function loadData() {
  try {
    const res = await fetch("/api/kijklijst");
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function saveData(data) {
  try {
    await fetch("/api/kijklijst", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) { console.error("Opslaan mislukt", e); }
}

async function callAI(prompt) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens: 800, bron: "kijklijst-suggesties" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI mislukt");
  return data.text;
}

// Gemiddelde van de per-persoon beoordelingen, voor gebruik in lijstweergaves.
function weergaveBeoordeling(item) {
  const b = item.beoordelingen;
  if (!b) return 0;
  const scores = [b.Pepijn, b.Tessa].filter(n => n > 0);
  if (scores.length === 0) return 0;
  return Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10;
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
  bg: "#F7F2F5", surf: "#FFFFFF", card: "#F1E3E8",
  border: "#E8D3DB", accent: "#7A2E3B", accentDark: "#5C222C",
  text: "#2A1E21", muted: "#9A7E86", green: "#3A7D5C", gold: "#C9A227",
};

const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: C.accentDark },
  main: { padding: "4px 20px 120px" },
  inp: { background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 15, width: "100%", boxSizing: "border-box", color: C.text },
  btn: (bg=C.accent, col="#FFFFFF") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, marginBottom: 10 },
  fab: { position: "fixed", bottom: 28, right: 20, width: 52, height: 52, borderRadius: 16, background: C.accent, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px rgba(122,46,59,0.35)", zIndex: 50 },
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
  chip: (active) => ({ border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accent : "#FFFFFF", color: active ? "#FFF" : C.muted, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }),
};

export default function KijklijstApp() {
  const [items, setItemsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [aiKostenMaand, setAiKostenMaand] = useState(null);

  useEffect(() => {
    fetch("/api/ai-gebruik").then(r => r.json()).then(d => {
      const nu = new Date();
      const maandStr = `${nu.getFullYear()}-${String(nu.getMonth()+1).padStart(2,"0")}`;
      const usd = (d.log||[]).filter(e => e.bron?.startsWith("kijklijst-") && e.datum.startsWith(maandStr))
        .reduce((s,e) => s + (e.kostenUsd||0), 0);
      setAiKostenMaand(usd * 0.92);
    }).catch(() => {});
  }, []);
  const [huidigeGebruiker, setHuidigeGebruiker] = useState(null);
  const lastWriteRef = useRef(0);

  const [statusFilter, setStatusFilter] = useState("wil_kijken");
  const [typeFilter, setTypeFilter] = useState(null);
  const [zoekterm, setZoekterm] = useState("");
  const [toast, setToast] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [zoekLoading, setZoekLoading] = useState(false);
  const [omdbBeschikbaar, setOmdbBeschikbaar] = useState(true);
  const [imdbLinkUrl, setImdbLinkUrl] = useState("");
  const [imdbLinkLoading, setImdbLinkLoading] = useState(false);
  const [showRecensieForm, setShowRecensieForm] = useState(false);
  const [recensieItemId, setRecensieItemId] = useState(null);
  const [recensieTekst, setRecensieTekst] = useState("");
  const [verrasMeItem, setVerrasMeItem] = useState(null);
  const [showSuggesties, setShowSuggesties] = useState(false);
  const [suggestiesLoading, setSuggestiesLoading] = useState(false);
  const [suggesties, setSuggesties] = useState(null);
  const [suggestiesFout, setSuggestiesFout] = useState(null);
  const [form, setForm] = useState({
    titel: "", type: "film", jaar: "", genre: "", imdbRating: "",
    regisseur: "", acteurs: "",
    poster: "", waarTeZien: [], status: "wil_kijken",
    beoordelingen: { Pepijn: 0, Tessa: 0 }, notitie: "",
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
    setForm({ titel: "", type: "film", jaar: "", genre: "", imdbRating: "", regisseur: "", acteurs: "", poster: "", waarTeZien: [], status: "wil_kijken", beoordelingen: { Pepijn: 0, Tessa: 0 }, notitie: "" });
    setEditId(null);
  }

  // Zoekt de titel op via de OMDb-proxy en vult jaar/type/genre/rating/poster
  // automatisch in. Handmatig aanpassen blijft altijd mogelijk.
  async function zoekOpIMDb() {
    if (!form.titel.trim()) return;
    setZoekLoading(true);
    try {
      const res = await fetch(`/api/omdb?titel=${encodeURIComponent(form.titel.trim())}`);
      const data = await res.json();
      if (data.reden === "geen_api_key") {
        setOmdbBeschikbaar(false);
        showToast("⚠️ Geen OMDb API-key ingesteld — plak in plaats daarvan een IMDb-link");
      } else if (!data.gevonden) {
        showToast("❌ Niet gevonden op IMDb, vul handmatig in");
      } else {
        setForm(f => ({
          ...f,
          titel: data.titel || f.titel,
          type: data.type || f.type,
          jaar: data.jaar || f.jaar,
          genre: data.genre || f.genre,
          regisseur: data.regisseur || f.regisseur,
          acteurs: data.acteurs || f.acteurs,
          imdbRating: data.imdbRating != null ? data.imdbRating : f.imdbRating,
          poster: data.poster || f.poster,
        }));
        showToast(`✅ Gevonden: ${data.titel} (${data.jaar})`);
      }
    } catch {
      showToast("❌ Opzoeken mislukt");
    }
    setZoekLoading(false);
  }

  // Alternatief voor de OMDb-zoekknop, zonder dat daar een API-key voor nodig
  // is: een gedeelde IMDb-link (bv. vanuit de IMDb-app) plakken en de server
  // leest de filmgegevens rechtstreeks van de pagina zelf.
  async function importeerVanImdbLink() {
    if (!imdbLinkUrl.trim()) return;
    setImdbLinkLoading(true);
    try {
      const res = await fetch("/api/imdb-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: imdbLinkUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.gevonden) {
        showToast(`❌ ${data.error || "Kon geen gegevens vinden op deze link"}`);
      } else {
        setForm(f => ({
          ...f,
          titel: data.titel || f.titel,
          type: data.type || f.type,
          jaar: data.jaar || f.jaar,
          genre: data.genre || f.genre,
          regisseur: data.regisseur || f.regisseur,
          acteurs: data.acteurs || f.acteurs,
          imdbRating: data.imdbRating != null ? data.imdbRating : f.imdbRating,
          poster: data.poster || f.poster,
        }));
        setImdbLinkUrl("");
        showToast(`✅ Gevonden: ${data.titel} (${data.jaar || "?"})`);
      }
    } catch {
      showToast("❌ Kon de link niet verwerken");
    }
    setImdbLinkLoading(false);
  }

  function opslaanItem() {
    if (!form.titel.trim()) return;
    if (editId) {
      persist(items.map(i => i.id === editId ? {
        ...i, ...form, lastActionBy: huidigeGebruiker, lastActionAt: Date.now(),
      } : i));
      showToast(`✅ ${form.titel} bijgewerkt`);
    } else {
      const nieuw = {
        id: uid(), ...form,
        addedAt: Date.now(), addedBy: huidigeGebruiker,
        lastActionBy: huidigeGebruiker, lastActionAt: Date.now(),
      };
      persist([...items, nieuw]);
      showToast(`✅ ${form.titel} toegevoegd`);
    }
    resetForm();
    setShowAdd(false);
  }

  function bewerkItem(item) {
    setForm({
      titel: item.titel, type: item.type, jaar: item.jaar || "", genre: item.genre || "",
      regisseur: item.regisseur || "", acteurs: item.acteurs || "",
      imdbRating: item.imdbRating ?? "", poster: item.poster || "", waarTeZien: item.waarTeZien || [],
      status: item.status, beoordelingen: item.beoordelingen || { Pepijn: 0, Tessa: 0 }, notitie: item.notitie || "",
    });
    setEditId(item.id);
    setShowAdd(true);
  }

  function verwijderItem(id) {
    persist(items.filter(i => i.id !== id));
  }

  function wijzigStatus(id, status) {
    if (status === "gekeken") {
      // Bij markeren als gekeken vragen we meteen om onze mening, zodat die
      // gedeeld kan worden — in plaats van de status alleen stil te wijzigen.
      const item = items.find(i => i.id === id);
      setRecensieItemId(id);
      setRecensieTekst(item?.review || "");
      setShowRecensieForm(true);
      return;
    }
    persist(items.map(i => i.id === id ? { ...i, status, lastActionBy: huidigeGebruiker, lastActionAt: Date.now() } : i));
  }

  function bevestigGekeken() {
    persist(items.map(i => i.id === recensieItemId
      ? { ...i, status: "gekeken", review: recensieTekst, lastActionBy: huidigeGebruiker, lastActionAt: Date.now() }
      : i));
    setShowRecensieForm(false);
    setRecensieItemId(null);
    setRecensieTekst("");
    showToast("✅ Verplaatst naar Gekeken");
  }

  // Deelt titel + IMDb-score + onze beoordeling + mening via de native deel-UI.
  async function deelMening(item) {
    const gem = weergaveBeoordeling(item);
    const regels = [`🎬 ${item.titel}${item.jaar ? ` (${item.jaar})` : ""}`];
    if (item.genre) regels.push(item.genre);
    if (item.imdbRating != null && item.imdbRating !== "") regels.push(`⭐ ${item.imdbRating} IMDb`);
    if (gem > 0) regels.push(`${"⭐".repeat(Math.round(gem))} onze beoordeling`);
    if (item.review) regels.push(`\n💬 ${item.review}`);
    const tekst = regels.join("\n");
    if (navigator.share) {
      try { await navigator.share({ title: item.titel, text: tekst }); } catch (e) { /* geannuleerd */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(tekst)}`, "_blank");
    }
  }

  function togglePlatform(platformId) {
    setForm(f => ({
      ...f,
      waarTeZien: f.waarTeZien.includes(platformId) ? f.waarTeZien.filter(p => p !== platformId) : [...f.waarTeZien, platformId],
    }));
  }

  // Kiest willekeurig iets uit "Wil kijken". Als er items zijn met een
  // waarTeZien-tag, geven we die voorrang (echt beschikbaar op jullie diensten).
  function verrasMe() {
    const kandidaten = items.filter(i => i.status === "wil_kijken");
    if (kandidaten.length === 0) { showToast("⚠️ Niks op de 'Wil kijken'-lijst"); return; }
    const metPlatform = kandidaten.filter(i => (i.waarTeZien || []).length > 0);
    const pool = metPlatform.length > 0 ? metPlatform : kandidaten;
    setVerrasMeItem(pool[Math.floor(Math.random() * pool.length)]);
  }

  // Stelt nieuwe titels voor op basis van wat hoog beoordeeld is (genre +
  // regisseur-patronen), en filtert al toegevoegde titels eruit.
  async function haalSuggestiesOp() {
    const favorieten = items
      .filter(i => i.status === "gekeken" && weergaveBeoordeling(i) >= 4)
      .map(i => `- ${i.titel} (${i.jaar || "?"}), genre: ${i.genre || "onbekend"}, regisseur: ${i.regisseur || "onbekend"}, onze beoordeling: ${weergaveBeoordeling(i)}/5`);

    if (favorieten.length === 0) {
      setSuggestiesFout("Nog te weinig hoog beoordeelde titels (4+ sterren) om suggesties op te baseren. Beoordeel eerst een paar gekeken films/series.");
      setSuggesties(null);
      return;
    }

    setSuggestiesLoading(true);
    setSuggestiesFout(null);
    setSuggesties(null);
    try {
      const alTitels = items.map(i => i.titel.toLowerCase());
      const tekst = await callAI(
        `Dit zijn films/series die wij hoog beoordeeld hebben:\n${favorieten.join("\n")}\n\n` +
        `Stel op basis van dit smaakpatroon (let op genre- en regisseur-overeenkomsten) 6 NIEUWE films of series voor die we nog niet gezien hebben. ` +
        `Geef voorkeur aan titels die waarschijnlijk beschikbaar zijn op Netflix, HBO Max of NPO Plus (wij wonen in Nederland), maar dat hoeft niet strikt. ` +
        `Geef ALLEEN een JSON-array terug, zonder uitleg of markdown, in dit exacte formaat: ` +
        `[{"titel":"...","jaar":"...","type":"film of serie","reden":"korte reden waarom dit bij ons past, max 15 woorden"}]`
      );
      const schoon = tekst.replace(/```json|```/g, "").trim();
      const lijst = JSON.parse(schoon);
      const nieuw = lijst.filter(s => !alTitels.includes((s.titel || "").toLowerCase()));
      setSuggesties(nieuw);
    } catch (e) {
      setSuggestiesFout("Kon geen suggesties ophalen, probeer het straks opnieuw.");
    }
    setSuggestiesLoading(false);
  }

  // Voegt een AI-suggestie direct toe aan "Wil kijken", en probeert meteen
  // de IMDb-gegevens erbij op te zoeken.
  async function voegSuggestieToe(sug) {
    let extra = {};
    try {
      const res = await fetch(`/api/omdb?titel=${encodeURIComponent(sug.titel)}`);
      const data = await res.json();
      if (data.gevonden) {
        extra = {
          jaar: data.jaar, genre: data.genre, regisseur: data.regisseur, acteurs: data.acteurs,
          imdbRating: data.imdbRating, poster: data.poster,
        };
      }
    } catch { /* IMDb-verrijking is optioneel */ }

    const nieuw = {
      id: uid(), titel: sug.titel, type: sug.type === "serie" ? "serie" : "film",
      jaar: sug.jaar || "", genre: "", regisseur: "", acteurs: "", imdbRating: "", poster: "",
      waarTeZien: [], status: "wil_kijken", beoordelingen: { Pepijn: 0, Tessa: 0 }, notitie: sug.reden || "",
      ...extra,
      addedAt: Date.now(), addedBy: huidigeGebruiker, lastActionBy: huidigeGebruiker, lastActionAt: Date.now(),
    };
    persist([...items, nieuw]);
    setSuggesties(s => s.filter(x => x.titel !== sug.titel));
    showToast(`✅ ${sug.titel} toegevoegd aan Wil kijken`);
  }

  // ── Afgeleide data ────────────────────────────────────
  let zichtbaar = items;
  if (statusFilter) zichtbaar = zichtbaar.filter(i => i.status === statusFilter);
  if (typeFilter) zichtbaar = zichtbaar.filter(i => i.type === typeFilter);
  if (zoekterm.trim()) zichtbaar = zichtbaar.filter(i => i.titel.toLowerCase().includes(zoekterm.toLowerCase()));
  zichtbaar = [...zichtbaar].sort((a, b) => (b.imdbRating || 0) - (a.imdbRating || 0));

  const aantalPerStatus = STATUSSEN.reduce((acc, s) => ({ ...acc, [s.id]: items.filter(i => i.status === s.id).length }), {});

  if (loading) return (
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <Film size={32} color={C.accent} />
        <p style={{ color: C.muted, fontSize: 14 }}>Kijklijst laden…</p>
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
      <header style={{ ...S.header, flexWrap: "wrap", rowGap: 10 }}>
        <div>
          <Link href="/" style={S.switchBtn}><ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> Terug</Link>
          <h1 style={S.title}>🎬 Kijklijst</h1>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8, marginLeft: "auto" }}>
          <button style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px", cursor: "pointer", fontSize: 13 }}
            onClick={verrasMe} title="Verras me">🎲</button>
          <button style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px", cursor: "pointer", fontSize: 13 }}
            onClick={() => { setShowSuggesties(true); haalSuggestiesOp(); }} title="Suggesties">💡</button>
        </div>
      </header>

      <main style={S.main}>
        {/* Zoekbalk */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={15} color={C.muted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input style={{ ...S.inp, paddingLeft: 36 }} placeholder="Zoeken…" value={zoekterm} onChange={e => setZoekterm(e.target.value)} />
        </div>

        {/* Status-tabs */}
        <div style={{ display: "flex", gap: 6, background: C.card, borderRadius: 12, padding: 4, marginBottom: 10 }}>
          {STATUSSEN.map(s => (
            <button key={s.id}
              style={{ flex: 1, border: "none", background: statusFilter === s.id ? C.accent : "transparent", color: statusFilter === s.id ? "#FFF" : C.muted, borderRadius: 9, padding: "9px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              onClick={() => setStatusFilter(statusFilter === s.id ? null : s.id)}>
              {s.icon} {aantalPerStatus[s.id]}
            </button>
          ))}
        </div>

        {/* Type-filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <button style={S.chip(!typeFilter)} onClick={() => setTypeFilter(null)}>Alles</button>
          <button style={S.chip(typeFilter === "film")} onClick={() => setTypeFilter(typeFilter === "film" ? null : "film")}><Film size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />Films</button>
          <button style={S.chip(typeFilter === "serie")} onClick={() => setTypeFilter(typeFilter === "serie" ? null : "serie")}><Tv size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />Series</button>
        </div>

        {items.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: C.accentDark, margin: "0 0 6px" }}>Kijklijst is leeg</p>
            <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>Tik op + om een film of serie toe te voegen.</p>
          </div>
        )}

        {zichtbaar.length === 0 && items.length > 0 && (
          <p style={{ textAlign: "center", color: C.muted, fontSize: 14, padding: "20px 0" }}>Niks gevonden.</p>
        )}

        {zichtbaar.map(item => {
          const gemBeoordeling = weergaveBeoordeling(item);
          return (
            <div key={item.id} style={S.card}>
              <div style={{ display: "flex", gap: 12 }}>
                {item.poster ? (
                  <img src={item.poster} alt="" style={{ width: 52, height: 76, objectFit: "cover", borderRadius: 8, flexShrink: 0, background: C.card }} />
                ) : (
                  <div style={{ width: 52, height: 76, borderRadius: 8, background: C.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                    {item.type === "serie" ? "📺" : "🎬"}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }} onClick={() => bewerkItem(item)}>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{item.titel}</span>
                    <WieBadge persoon={item.lastActionBy} tijdstip={item.lastActionAt} />
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    {item.jaar && `${item.jaar} · `}{item.type === "serie" ? "Serie" : "Film"}{item.genre ? ` · ${item.genre}` : ""}
                  </div>
                  {item.regisseur && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>🎬 {item.regisseur}</div>
                  )}
                  {item.acteurs && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>🎭 {item.acteurs}</div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
                    {item.imdbRating != null && item.imdbRating !== "" && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 700, color: C.gold }}>
                        <Star size={12} fill={C.gold} color={C.gold} /> {item.imdbRating} <span style={{ color: C.muted, fontWeight: 400 }}>IMDb</span>
                      </span>
                    )}
                    {gemBeoordeling > 0 && (
                      <span style={{ fontSize: 12, color: C.accent }}>{"⭐".repeat(Math.round(gemBeoordeling))} <span style={{ color: C.muted }}>ons</span></span>
                    )}
                    <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${item.titel} ${item.jaar||""} trailer`)}`}
                      target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                      style={{ fontSize: 12, color: C.accent, textDecoration: "none", fontWeight: 600 }}>
                      ▶️ Trailer
                    </a>
                  </div>
                  {(item.waarTeZien || []).length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                      {item.waarTeZien.map(pid => {
                        const p = PLATFORMS.find(x => x.id === pid);
                        return p ? (
                          <span key={pid} style={{ fontSize: 10, background: C.card, borderRadius: 8, padding: "2px 7px", color: C.text }}>
                            {p.icon} {p.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, alignSelf: "flex-start" }} onClick={() => verwijderItem(item.id)}>
                  <X size={16} />
                </button>
              </div>

              {item.status === "gekeken" && item.review && (
                <div style={{ background: C.card, borderRadius: 10, padding: "8px 10px", marginTop: 10, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <p style={{ margin: 0, fontSize: 12, color: C.text, flex: 1, lineHeight: 1.5, cursor: "pointer" }}
                    onClick={() => { setRecensieItemId(item.id); setRecensieTekst(item.review || ""); setShowRecensieForm(true); }}>
                    💬 {item.review}
                  </p>
                  <button onClick={() => deelMening(item)} title="Deel onze mening"
                    style={{ background: "none", border: "none", cursor: "pointer", color: C.accent, padding: 2, flexShrink: 0 }}>
                    <Share2 size={14} />
                  </button>
                </div>
              )}
              {item.status === "gekeken" && !item.review && (
                <button style={{ background: "none", border: `1px dashed ${C.border}`, borderRadius: 10, padding: "7px 10px", marginTop: 10, width: "100%", fontSize: 12, color: C.muted, cursor: "pointer" }}
                  onClick={() => { setRecensieItemId(item.id); setRecensieTekst(""); setShowRecensieForm(true); }}>
                  + Wat vonden we ervan?
                </button>
              )}

              {/* Statusknoppen */}
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {STATUSSEN.map(s => (
                  <button key={s.id}
                    style={{ flex: 1, border: `1px solid ${item.status === s.id ? C.accent : C.border}`, background: item.status === s.id ? C.accent : "#FFFFFF", color: item.status === s.id ? "#FFF" : C.muted, borderRadius: 8, padding: "6px 0", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                    onClick={() => wijzigStatus(item.id, s.id)}>
                    {s.icon}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </main>

      <button style={S.fab} onClick={() => { resetForm(); setShowAdd(true); }} aria-label="Film of serie toevoegen">
        <Plus size={24} color="#FFFFFF" />
      </button>

      {/* Toevoeg/bewerk-paneel */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => { setShowAdd(false); resetForm(); }}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>{editId ? "Bewerken" : "Toevoegen"}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => { setShowAdd(false); resetForm(); }}>
                <X size={20} color={C.muted} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input style={{ ...S.inp, flex: 1 }} placeholder="Titel van film of serie" value={form.titel}
                onChange={e => setForm(f => ({ ...f, titel: e.target.value }))} autoFocus />
              {omdbBeschikbaar && (
                <button style={{ ...S.btn(C.card, C.accent), border: `1px solid ${C.border}`, whiteSpace: "nowrap", fontSize: 13, padding: "0 14px" }}
                  onClick={zoekOpIMDb} disabled={zoekLoading || !form.titel.trim()}>
                  {zoekLoading ? "…" : "🔍 IMDb"}
                </button>
              )}
            </div>

            <p style={{ fontSize: 11, color: C.muted, margin: "0 0 6px" }}>
              Of plak een gedeelde IMDb-link (bv. vanuit de IMDb-app) — hiervoor is geen account of API-key nodig
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input style={{ ...S.inp, flex: 1, fontSize: 13 }} placeholder="https://www.imdb.com/title/..."
                value={imdbLinkUrl} onChange={e => setImdbLinkUrl(e.target.value)} />
              <button style={{ ...S.btn(C.card, C.accent), border: `1px solid ${C.border}`, whiteSpace: "nowrap", fontSize: 13, padding: "0 14px" }}
                onClick={importeerVanImdbLink} disabled={imdbLinkLoading || !imdbLinkUrl.trim()}>
                {imdbLinkLoading ? "…" : "Importeer"}
              </button>
            </div>

            {form.poster && (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <img src={form.poster} alt="" style={{ height: 140, borderRadius: 10 }} />
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, display: "flex", gap: 8 }}>
                {["film", "serie"].map(t => (
                  <button key={t} style={{ flex: 1, border: `2px solid ${form.type === t ? C.accent : C.border}`, background: form.type === t ? C.accent : "transparent", color: form.type === t ? "#FFF" : C.muted, borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}
                    onClick={() => setForm(f => ({ ...f, type: t }))}>
                    {t === "film" ? "🎬 Film" : "📺 Serie"}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input style={{ ...S.inp, flex: 1 }} placeholder="Jaar" value={form.jaar} onChange={e => setForm(f => ({ ...f, jaar: e.target.value }))} />
              <input style={{ ...S.inp, flex: 1 }} placeholder="IMDb-score (bv. 8.2)" type="number" step="0.1" min="0" max="10"
                value={form.imdbRating} onChange={e => setForm(f => ({ ...f, imdbRating: e.target.value }))} />
            </div>

            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Genre (optioneel)" value={form.genre}
              onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} />

            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Regisseur (optioneel)" value={form.regisseur}
              onChange={e => setForm(f => ({ ...f, regisseur: e.target.value }))} />
            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Acteurs (optioneel)" value={form.acteurs}
              onChange={e => setForm(f => ({ ...f, acteurs: e.target.value }))} />

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>Waar te zien</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {PLATFORMS.map(p => {
                const actief = form.waarTeZien.includes(p.id);
                return (
                  <button key={p.id} style={{ border: `1px solid ${actief ? C.accent : C.border}`, background: actief ? C.accent : "#FFFFFF", color: actief ? "#FFF" : C.muted, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    onClick={() => togglePlatform(p.id)}>
                    {p.icon} {p.label}
                  </button>
                );
              })}
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>Onze beoordeling</label>
            {["Pepijn","Tessa"].map(naam => (
              <div key={naam} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: C.muted, width: 52 }}>{naam}</span>
                {[1,2,3,4,5].map(n => (
                  <button key={n} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: 1 }}
                    onClick={() => setForm(f => ({ ...f, beoordelingen: { ...(f.beoordelingen||{Pepijn:0,Tessa:0}), [naam]: n === (f.beoordelingen?.[naam]||0) ? 0 : n } }))}>
                    {n <= ((form.beoordelingen?.[naam])||0) ? "⭐" : "☆"}
                  </button>
                ))}
              </div>
            ))}

            <textarea style={{ ...S.inp, marginTop: 6, marginBottom: 16, height: 60, resize: "none" }} placeholder="Notitie (optioneel, bv. wie het aanraadde)" value={form.notitie}
              onChange={e => setForm(f => ({ ...f, notitie: e.target.value }))} />

            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15 }} onClick={opslaanItem}>
              {editId ? "Opslaan" : "Toevoegen"}
            </button>
          </div>
        </div>
      )}

      {/* Recensie bij markeren als gekeken */}
      {showRecensieForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 150 }}
          onClick={() => setShowRecensieForm(false)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.accentDark }}>✅ {items.find(i=>i.id===recensieItemId)?.titel}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowRecensieForm(false)}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: C.muted, margin: "0 0 8px" }}>
              Wat vonden jullie ervan? Dit kun je straks delen met anderen.
            </p>
            <textarea autoFocus style={{ ...S.inp, height: 90, resize: "none", marginBottom: 16 }}
              placeholder="Bv. 'Spannend tot het einde, echte aanrader!'" value={recensieTekst}
              onChange={e => setRecensieTekst(e.target.value)} />
            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15 }} onClick={bevestigGekeken}>
              Verplaats naar Gekeken
            </button>
            <button style={{ ...S.btn("transparent", C.muted), width: "100%", padding: "10px 0", fontSize: 13 }} onClick={bevestigGekeken}>
              Overslaan zonder mening
            </button>
          </div>
        </div>
      )}

      {/* Verras me — willekeurige pick */}
      {verrasMeItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 24 }}
          onClick={() => setVerrasMeItem(null)}>
          <div style={{ background: C.surf, borderRadius: 20, padding: 24, maxWidth: 320, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 13, color: C.muted, margin: "0 0 10px" }}>🎲 Jullie gaan kijken:</p>
            {verrasMeItem.poster && <img src={verrasMeItem.poster} alt="" style={{ height: 160, borderRadius: 12, marginBottom: 12 }} />}
            <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 800, color: C.accentDark }}>{verrasMeItem.titel}</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: "0 0 16px" }}>
              {verrasMeItem.jaar && `${verrasMeItem.jaar} · `}{verrasMeItem.genre || (verrasMeItem.type === "serie" ? "Serie" : "Film")}
              {verrasMeItem.imdbRating ? ` · ⭐ ${verrasMeItem.imdbRating}` : ""}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn(C.card, C.text), border: `1px solid ${C.border}`, flex: 1 }} onClick={verrasMe}>🎲 Nog een keer</button>
              <button style={{ ...S.btn(), flex: 1 }} onClick={() => setVerrasMeItem(null)}>Prima!</button>
            </div>
          </div>
        </div>
      )}

      {/* AI-suggesties op basis van kijkgeschiedenis */}
      {showSuggesties && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 150 }}
          onClick={() => setShowSuggesties(false)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "85vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>💡 Suggesties voor jullie</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowSuggesties(false)}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: C.muted, margin: "0 0 4px" }}>Gebaseerd op wat jullie hoog beoordeeld hebben (4+ sterren).</p>
            {aiKostenMaand != null && aiKostenMaand > 0 && (
              <Link href="/ai-kosten" style={{ display: "block", fontSize: 10, color: C.muted, textDecoration: "none", marginBottom: 16 }}>
                💰 €{aiKostenMaand.toFixed(2)} deze maand aan AI-suggesties
              </Link>
            )}
            {(aiKostenMaand == null || aiKostenMaand === 0) && <div style={{ marginBottom: 16 }} />}

            {suggestiesLoading && <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "20px 0" }}>🤖 Aan het bedenken…</p>}
            {suggestiesFout && !suggestiesLoading && (
              <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "20px 0" }}>{suggestiesFout}</p>
            )}
            {suggesties && suggesties.length === 0 && !suggestiesLoading && (
              <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "20px 0" }}>Geen nieuwe suggesties gevonden — probeer het later opnieuw.</p>
            )}
            {suggesties && suggesties.map((sug, i) => (
              <div key={i} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 14 }}>{sug.titel} {sug.jaar ? `(${sug.jaar})` : ""}</p>
                  <p style={{ margin: 0, fontSize: 12, color: C.muted }}>{sug.reden}</p>
                </div>
                <button style={{ ...S.btn(), fontSize: 12, padding: "8px 12px", whiteSpace: "nowrap" }} onClick={() => voegSuggestieToe(sug)}>
                  + Toevoegen
                </button>
              </div>
            ))}
            {!suggestiesLoading && (
              <button style={{ ...S.btn(C.card, C.accent), border: `1px solid ${C.border}`, width: "100%", marginTop: 8 }} onClick={haalSuggestiesOp}>
                🔄 Nieuwe suggesties
              </button>
            )}
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
