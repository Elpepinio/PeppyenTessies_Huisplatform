import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, X, ChevronLeft, Search, Camera, Trash2, Link2, ExternalLink, Home, Check } from "lucide-react";

// ── Constanten ─────────────────────────────────────────
const CATEGORIEEN = [
  { id: "verlichting",    label: "Verlichting",       icon: "💡" },
  { id: "tafels",         label: "Tafels",            icon: "🪵" },
  { id: "zitmeubels",     label: "Zitmeubels",        icon: "🛋️" },
  { id: "vloerkleden",    label: "Vloerkleden",       icon: "🧶" },
  { id: "kasten",         label: "Kasten & opbergen", icon: "🗄️" },
  { id: "wanddecoratie",  label: "Wanddecoratie",     icon: "🖼️" },
  { id: "planten_vazen",  label: "Planten & vazen",   icon: "🪴" },
  { id: "textiel",        label: "Textiel",           icon: "🧵" },
  { id: "keuken_tafelen", label: "Keuken & tafelen",  icon: "🍽️" },
  { id: "keukenapparatuur", label: "Keukenapparatuur", icon: "🔌" },
  { id: "buiten_tuin",    label: "Buiten & tuin",     icon: "🌿" },
  { id: "overig",         label: "Overig",            icon: "📦" },
];
const CAT_MAP = Object.fromEntries(CATEGORIEEN.map(c => [c.id, c]));

const KAMERS = [
  { id: "woonkamer",   label: "Woonkamer",         icon: "🛋️" },
  { id: "slaapkamer",  label: "Slaapkamer",        icon: "🛏️" },
  { id: "keuken",      label: "Keuken",            icon: "🍳" },
  { id: "badkamer",    label: "Badkamer",          icon: "🛁" },
  { id: "kinderkamer", label: "Kinderkamer",       icon: "🧸" },
  { id: "werkkamer",   label: "Werkkamer",         icon: "💻" },
  { id: "hal_gang",    label: "Hal & gang",        icon: "🚪" },
  { id: "tuin_balkon", label: "Tuin & balkon",     icon: "🌳" },
  { id: "overig",      label: "Overig",            icon: "📦" },
];
const KAMER_MAP = Object.fromEntries(KAMERS.map(k => [k.id, k]));

// Subtype specifiek voor de categorie Keukenapparatuur — alleen relevant en
// zichtbaar wanneer categorie === "keukenapparatuur".
const KEUKEN_TYPES = [
  { id: "koel_vries", label: "Koel/vries", icon: "🧊" },
  { id: "oven",        label: "Oven",       icon: "🔥" },
  { id: "kookplaat",   label: "Kookplaat",  icon: "🍳" },
  { id: "quooker",     label: "Quooker",    icon: "💧" },
  { id: "overig",      label: "Overig",     icon: "🔌" },
];
const KEUKEN_TYPE_MAP = Object.fromEntries(KEUKEN_TYPES.map(t => [t.id, t]));

// EU-energielabel: sinds maart 2021 A t/m G (geen plusjes meer) voor de
// meeste grote keukenapparaten. Kookplaten zelf hebben overigens vaak geen
// eigen energielabel (alleen een afzuigkap eronder) — daarom blijft dit veld
// altijd optioneel, nooit verplicht.
const ENERGIELABELS = [
  { id: "A", kleur: "#1E7B34" },
  { id: "B", kleur: "#4C9A2A" },
  { id: "C", kleur: "#A8C700" },
  { id: "D", kleur: "#F2C500" },
  { id: "E", kleur: "#F0A500" },
  { id: "F", kleur: "#E06A1F" },
  { id: "G", kleur: "#D6273C" },
];

// Veelgestelde aandachtspunten per apparaattype — als snelkeuze-chips zodat
// je niet alles zelf hoeft te bedenken/typen vóór je de winkel in gaat.
// Puur een startpunt: je kunt zelf altijd eigen punten toevoegen of chips
// weer verwijderen.
const AANDACHTSPUNT_SUGGESTIES = {
  koel_vries: ["Energielabel", "Geluidsniveau (dB)", "Inbouwmaat past?", "Vriesvak-inhoud", "No-frost?", "Garantieperiode"],
  oven: ["Energielabel", "Pyrolyse zelfreiniging", "Hetelucht + boven/onderwarmte", "Inbouwmaat (60cm?)", "Stoomfunctie", "Garantieperiode"],
  kookplaat: ["Inductie of keramisch/gas?", "Aantal kookzones", "Vermogen/boost-functie", "Pandetectie", "Inbouwmaat", "Bediening touch/knoppen"],
  quooker: ["Type reservoir (mini/pro/combi)", "Ook koud/bruisend water?", "Aansluiting waterleiding nodig?", "Onderhoudscontract/filter-kosten", "Garantieperiode"],
  overig: ["Energielabel", "Garantieperiode", "Afmetingen passen?"],
};

const STATUSSEN = [
  { id: "idee",       label: "Idee",       icon: "💭", kleur: "#7B92A8" },
  { id: "overwegen",  label: "Overwegen",  icon: "🤔", kleur: "#C97D0C" },
  { id: "gekocht",    label: "Gekocht",    icon: "✅", kleur: "#2D6A4F" },
  { id: "afgewezen",  label: "Afgewezen",  icon: "❌", kleur: "#8C8576" },
];
const STATUS_MAP = Object.fromEntries(STATUSSEN.map(s => [s.id, s]));

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
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Kon foto niet lezen")); };
    img.src = url;
  });
}

// Downloadt een externe afbeelding (bv. og:image van een productpagina) en
// zet 'm om naar dezelfde gecomprimeerde dataURL-vorm als een eigen foto,
// zodat hij op precies dezelfde manier wordt opgeslagen.
async function fotoUrlNaarDataUrl(fotoUrl, max = 900) {
  const res = await fetch(fotoUrl);
  const blob = await res.blob();
  return comprimeerFoto(blob, max);
}

function euro(n) { return n == null ? "" : `€${(+n).toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`; }

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

function gemiddeldeSterren(idee) {
  const s = idee.sterren || {};
  const waarden = [s.Pepijn, s.Tessa].filter(v => v > 0);
  if (!waarden.length) return 0;
  return waarden.reduce((a, b) => a + b, 0) / waarden.length;
}

export default function WoonideeenApp() {
  const [ideeen, setIdeeenState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [huidigeGebruiker, setHuidigeGebruiker] = useState(null);
  const lastWriteRef = useRef(0);
  const fotoInputRef = useRef(null);
  const screenshotInputRef = useRef(null);

  const [zoekterm, setZoekterm] = useState("");
  const [catFilter, setCatFilter] = useState(null);
  const [kamerFilter, setKamerFilter] = useState(null);
  const [toonAfgehandeld, setToonAfgehandeld] = useState(false); // toont ook Gekocht/Afgewezen
  const [sortering, setSortering] = useState("nieuw"); // nieuw | prijs_laag | prijs_hoog | sterren
  const [toast, setToast] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(LEEG_FORM());
  const [linkLoading, setLinkLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [prijsLoading, setPrijsLoading] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [vergelijkModus, setVergelijkModus] = useState(false);
  const [vergelijkIds, setVergelijkIds] = useState([]);
  const [showVergelijk, setShowVergelijk] = useState(false);
  const [showDeel, setShowDeel] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.user) setHuidigeGebruiker(d.user);
    }).catch(() => {});
  }, []);

  const persist = useCallback((nextIdeeen) => {
    lastWriteRef.current = Date.now();
    setIdeeenState(nextIdeeen);
    fetch("/api/woonideeen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideeen: nextIdeeen }),
    }).catch(e => console.error("Opslaan mislukt", e));
  }, []);

  const laadData = useCallback(async () => {
    try {
      const res = await fetch("/api/woonideeen");
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
        setIdeeenState(data.ideeen || []);
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

  function voegAandachtspuntToe(tekst) {
    if (!tekst.trim()) return;
    setForm(f => ({ ...f, aandachtspunten: [...(f.aandachtspunten||[]), { id: uid(), tekst: tekst.trim(), afgevinkt: false }] }));
  }
  function toggleAandachtspunt(id) {
    setForm(f => ({ ...f, aandachtspunten: (f.aandachtspunten||[]).map(a => a.id === id ? { ...a, afgevinkt: !a.afgevinkt } : a) }));
  }
  function verwijderAandachtspunt(id) {
    setForm(f => ({ ...f, aandachtspunten: (f.aandachtspunten||[]).filter(a => a.id !== id) }));
  }

  function opslaanIdee() {
    if (!form.titel.trim()) return;
    const { _visueelGevondenResultaten, ...formSchoon } = form;
    const payload = { ...formSchoon, prijs: formSchoon.prijs ? +formSchoon.prijs : null };
    if (editId) {
      persist(ideeen.map(i => i.id === editId ? { ...i, ...payload } : i));
      showToast(`✅ ${form.titel} bijgewerkt`);
    } else {
      const nieuw = {
        id: uid(), ...payload, sterren: { Pepijn: 0, Tessa: 0 }, status: "idee",
        addedAt: Date.now(), addedBy: huidigeGebruiker,
        ...(_visueelGevondenResultaten?.length ? { prijsvergelijking: _visueelGevondenResultaten, prijsvergelijkingOp: Date.now() } : {}),
      };
      persist([nieuw, ...ideeen]);
      showToast(`✅ ${form.titel} toegevoegd`);
    }
    resetForm();
    setShowForm(false);
  }

  function bewerkIdee(i) {
    setForm({
      titel: i.titel || "", link: i.link || "", omschrijving: i.omschrijving || "",
      prijs: i.prijs != null ? String(i.prijs) : "", categorie: i.categorie || "overig",
      kamer: i.kamer || "overig", notitie: i.notitie || "", foto: i.foto || null,
      keukenType: i.keukenType || "overig", energielabel: i.energielabel || "", aandachtspunten: i.aandachtspunten || [],
    });
    setEditId(i.id);
    setShowForm(true);
  }

  function verwijderIdee(id) {
    if (!window.confirm("Dit woonidee verwijderen?")) return;
    persist(ideeen.filter(i => i.id !== id));
    if (showDetail === id) setShowDetail(null);
  }

  function zetStatus(id, status) {
    persist(ideeen.map(i => i.id === id ? { ...i, status } : i));
  }

  function zetSter(id, persoon, n) {
    persist(ideeen.map(i => i.id === id
      ? { ...i, sterren: { ...(i.sterren||{Pepijn:0,Tessa:0}), [persoon]: n === ((i.sterren?.[persoon])||0) ? 0 : n } }
      : i
    ));
  }

  // Voor het afvinken/toevoegen van aandachtspunten op een AL OPGESLAGEN idee
  // (bv. terwijl je met je telefoon in de winkel staat) — dit werkt op de
  // echte data, in tegenstelling tot voegAandachtspuntToe/toggleAandachtspunt
  // die alleen het formulier bijwerken vóór het opslaan.
  function toggleAandachtspuntOpIdee(ideeId, puntId) {
    persist(ideeen.map(i => i.id !== ideeId ? i : {
      ...i, aandachtspunten: (i.aandachtspunten||[]).map(a => a.id === puntId ? { ...a, afgevinkt: !a.afgevinkt } : a),
    }));
  }
  function voegAandachtspuntToeOpIdee(ideeId, tekst) {
    if (!tekst.trim()) return;
    persist(ideeen.map(i => i.id !== ideeId ? i : {
      ...i, aandachtspunten: [...(i.aandachtspunten||[]), { id: uid(), tekst: tekst.trim(), afgevinkt: false }],
    }));
  }
  function verwijderAandachtspuntOpIdee(ideeId, puntId) {
    persist(ideeen.map(i => i.id !== ideeId ? i : {
      ...i, aandachtspunten: (i.aandachtspunten||[]).filter(a => a.id !== puntId),
    }));
  }

  async function handleFotoUpload(file) {
    if (!file) return;
    const compressed = await comprimeerFoto(file);
    setForm(f => ({ ...f, foto: compressed }));
  }

  // Haalt titel/omschrijving/prijs/categorie én een voorbeeldfoto op uit een
  // geplakte link. De gebruiker kan alles nog aanpassen en de foto altijd
  // vervangen door een eigen exemplaar.
  async function haalInfoUitLink() {
    if (!form.link.trim()) return;
    setLinkLoading(true);
    try {
      const res = await fetch("/api/woonideeen-link-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.link.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mislukt");

      let fotoDataUrl = form.foto;
      if (data.foto) {
        try { fotoDataUrl = await fotoUrlNaarDataUrl(data.foto); }
        catch { /* foto ophalen kan mislukken (bv. hotlink-bescherming) — dan gewoon geen foto vooraf invullen */ }
      }

      setForm(f => ({
        ...f,
        titel: data.titel || f.titel,
        omschrijving: data.omschrijving || f.omschrijving,
        prijs: data.prijs != null ? String(data.prijs) : f.prijs,
        categorie: CATEGORIEEN.some(c=>c.id===data.categorie) ? data.categorie : f.categorie,
        foto: fotoDataUrl,
      }));
      showToast("✨ Info opgehaald — controleer en vul aan waar nodig");
    } catch (e) {
      showToast(`❌ ${e.message || "Kon info niet ophalen, vul handmatig in"}`);
    }
    setLinkLoading(false);
  }

  function bijwerkenPrijs(id, nieuwePrijs) {
    persist(ideeen.map(i => i.id === id ? { ...i, prijs: nieuwePrijs } : i));
    showToast(`✅ Prijs bijgewerkt naar ${euro(nieuwePrijs)}`);
  }

  // Werkt zoals Google Lens: herkent het product op de foto én zoekt meteen
  // op het web naar waar het te koop is en voor welke prijs (via dezelfde
  // web-search-tool als "Beste prijs elders"). Handig als de prijs niet
  // eens op de screenshot zelf te zien is, of als het een foto van een écht
  // object is (bv. iets gezien bij vrienden) i.p.v. een productpagina.
  async function scanScreenshot(file) {
    if (!file) return;
    setLinkLoading(true);
    try {
      const compressed = await comprimeerFoto(file);
      const base64 = compressed.split(",")[1];
      const res = await fetch("/api/woonideeen-visueel-zoeken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, imageType: "image/jpeg" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mislukt");

      // De goedkoopste gevonden aanbieder (resultaten staan al gesorteerd van
      // goedkoop naar duur) wordt meteen de hoofdlink — zo krijgt ook een via
      // foto toegevoegd item altijd een werkende link, net als bij de andere
      // twee manieren van toevoegen.
      const beslissingsLink = data.resultaten?.find(r => r.link)?.link || null;

      setForm(f => ({
        ...f,
        titel: data.titel || f.titel,
        omschrijving: data.omschrijving || f.omschrijving,
        prijs: data.beslissingsPrijs != null ? String(data.beslissingsPrijs) : f.prijs,
        categorie: data.categorie || f.categorie,
        link: beslissingsLink || f.link,
        foto: compressed,
        // Zet de gevonden aanbieders meteen klaar, zodat "Beste prijs elders"
        // in het detailscherm na het opslaan al gevuld is.
        _visueelGevondenResultaten: data.resultaten,
      }));
      showToast(data.resultaten?.length ? `✨ Herkend — ${data.resultaten.length} aanbieder(s) gevonden` : "✨ Herkend — controleer en vul aan waar nodig");
    } catch (e) {
      showToast(`❌ ${e.message || "Kon foto niet herkennen"}`);
    }
    setLinkLoading(false);
  }

  // Zoekt bij andere aanbieders naar dit product via Claude's web-search-
  // tool, en bewaart het resultaat + tijdstip bij het idee zelf, zodat je
  // niet elke keer opnieuw hoeft te zoeken als je het scherm weer opent.
  async function zoekBestePrijs(idee) {
    setPrijsLoading(true);
    let huidigeWinkel = null;
    if (idee.link) { try { huidigeWinkel = new URL(idee.link).hostname.replace("www.",""); } catch { /* geen geldige URL, negeren */ } }
    try {
      const res = await fetch("/api/woonideeen-prijsvergelijk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titel: idee.titel, categorie: idee.categorie, huidigePrijs: idee.prijs, huidigeWinkel, link: idee.link || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mislukt");
      persist(ideeen.map(x => x.id === idee.id ? {
        ...x, prijsvergelijking: data.resultaten, prijsvergelijkingOpmerking: data.opmerking,
        prijsvergelijkingOp: Date.now(), eigenPrijsControle: data.eigenPrijs,
      } : x));
      if (!data.resultaten.length) showToast(data.opmerking ? `ℹ️ ${data.opmerking}` : "ℹ️ Niets vergelijkbaars gevonden");
      else showToast(`✅ ${data.resultaten.length} prijzen gevonden`);
    } catch (e) {
      showToast(`❌ ${e.message || "Kon niet zoeken naar de beste prijs"}`);
    }
    setPrijsLoading(false);
  }

  // ── Afgeleide data ──────────────────────────────────────
  let zichtbaar = [...ideeen];
  if (!toonAfgehandeld) zichtbaar = zichtbaar.filter(i => i.status !== "gekocht" && i.status !== "afgewezen");
  if (catFilter) zichtbaar = zichtbaar.filter(i => i.categorie === catFilter);
  if (kamerFilter) zichtbaar = zichtbaar.filter(i => i.kamer === kamerFilter);
  if (zoekterm.trim()) {
    const z = zoekterm.toLowerCase();
    zichtbaar = zichtbaar.filter(i =>
      (i.titel||"").toLowerCase().includes(z) ||
      (i.omschrijving||"").toLowerCase().includes(z) ||
      (i.notitie||"").toLowerCase().includes(z)
    );
  }
  zichtbaar.sort((a,b) => {
    if (sortering === "prijs_laag") return (a.prijs ?? Infinity) - (b.prijs ?? Infinity);
    if (sortering === "prijs_hoog") return (b.prijs ?? -Infinity) - (a.prijs ?? -Infinity);
    if (sortering === "sterren") return gemiddeldeSterren(b) - gemiddeldeSterren(a);
    return (b.addedAt||0) - (a.addedAt||0);
  });

  if (loading) return (
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <Home size={32} color={C.accent} />
        <p style={{ color: C.muted, fontSize: 14 }}>Woonideeën laden…</p>
      </div>
    </div>
  );

  return (
    <WoonideeenView
      ideeen={ideeen} zichtbaar={zichtbaar} offline={offline}
      zoekterm={zoekterm} setZoekterm={setZoekterm}
      catFilter={catFilter} setCatFilter={setCatFilter}
      kamerFilter={kamerFilter} setKamerFilter={setKamerFilter}
      toonAfgehandeld={toonAfgehandeld} setToonAfgehandeld={setToonAfgehandeld}
      showForm={showForm} setShowForm={setShowForm} form={form} setForm={setForm}
      editId={editId} resetForm={resetForm} opslaanIdee={opslaanIdee}
      bewerkIdee={bewerkIdee} verwijderIdee={verwijderIdee}
      zetStatus={zetStatus} zetSter={zetSter}
      toggleAandachtspuntOpIdee={toggleAandachtspuntOpIdee} voegAandachtspuntToeOpIdee={voegAandachtspuntToeOpIdee} verwijderAandachtspuntOpIdee={verwijderAandachtspuntOpIdee}
      handleFotoUpload={handleFotoUpload} haalInfoUitLink={haalInfoUitLink} linkLoading={linkLoading}
      scanScreenshot={scanScreenshot} screenshotInputRef={screenshotInputRef}
      fotoInputRef={fotoInputRef}
      voegAandachtspuntToe={voegAandachtspuntToe} toggleAandachtspunt={toggleAandachtspunt} verwijderAandachtspunt={verwijderAandachtspunt}
      showDetail={showDetail} setShowDetail={setShowDetail}
      prijsLoading={prijsLoading} zoekBestePrijs={zoekBestePrijs} bijwerkenPrijs={bijwerkenPrijs}
      showBudget={showBudget} setShowBudget={setShowBudget}
      vergelijkModus={vergelijkModus} setVergelijkModus={setVergelijkModus}
      vergelijkIds={vergelijkIds} setVergelijkIds={setVergelijkIds}
      showVergelijk={showVergelijk} setShowVergelijk={setShowVergelijk}
      showDeel={showDeel} setShowDeel={setShowDeel}
      sortering={sortering} setSortering={setSortering}
      toast={toast}
    />
  );
}

function LEEG_FORM() {
  return {
    titel: "", link: "", omschrijving: "", prijs: "", categorie: "overig", kamer: "overig", notitie: "", foto: null,
    keukenType: "overig", energielabel: "", aandachtspunten: [],
  };
}
const C = {
  bg: "#F6F4F1", surf: "#FFFFFF", card: "#EDE8E0",
  border: "#DED6C8", accent: "#4A6B5A", accentDark: "#2F4739",
  text: "#2A2620", muted: "#918A78", green: "#2D6A4F", red: "#C0392B", yellow: "#C97D0C", orange: "#C97D0C",
};
const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: C.accentDark },
  main: { padding: "4px 20px 120px" },
  inp: { background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 15, width: "100%", boxSizing: "border-box", color: C.text },
  btn: (bg=C.accent, col="#FFFFFF") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, marginBottom: 10 },
  fab: { position: "fixed", bottom: 28, right: 20, width: 52, height: 52, borderRadius: 16, background: C.accent, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px rgba(74,107,90,0.35)", zIndex: 50 },
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
  chip: (active) => ({ border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accent : "#FFFFFF", color: active ? "#FFF" : C.muted, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }),
};

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.idee;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: s.kleur, background: `${s.kleur}18`, padding: "3px 8px", borderRadius: 8 }}>
      {s.icon} {s.label}
    </span>
  );
}

function SterrenRij({ idee, zetSter, compact }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 2 : 6 }}>
      {["Pepijn","Tessa"].map(naam => (
        <div key={naam} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: C.muted, width: 46 }}>{naam}</span>
          <div style={{ display: "flex", gap: 1 }}>
            {[1,2,3,4,5].map(n => (
              <button key={n} style={{ background: "none", border: "none", cursor: "pointer", fontSize: compact ? 14 : 19, padding: 1 }}
                onClick={() => zetSter(idee.id, naam, n)}>
                {n <= ((idee.sterren?.[naam])||0) ? "⭐" : "☆"}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WoonideeenView({
  ideeen, zichtbaar, offline, zoekterm, setZoekterm,
  catFilter, setCatFilter, kamerFilter, setKamerFilter,
  toonAfgehandeld, setToonAfgehandeld,
  showForm, setShowForm, form, setForm, editId, resetForm, opslaanIdee,
  bewerkIdee, verwijderIdee, zetStatus, zetSter,
  toggleAandachtspuntOpIdee, voegAandachtspuntToeOpIdee, verwijderAandachtspuntOpIdee,
  handleFotoUpload, haalInfoUitLink, linkLoading, scanScreenshot, screenshotInputRef, fotoInputRef,
  voegAandachtspuntToe, toggleAandachtspunt, verwijderAandachtspunt,
  showDetail, setShowDetail, prijsLoading, zoekBestePrijs, bijwerkenPrijs,
  showBudget, setShowBudget, vergelijkModus, setVergelijkModus,
  vergelijkIds, setVergelijkIds, showVergelijk, setShowVergelijk,
  showDeel, setShowDeel,
  sortering, setSortering, toast,
}) {
  const detailIdee = showDetail ? ideeen.find(i => i.id === showDetail) : null;
  const [eigenAandachtspunt, setEigenAandachtspunt] = useState("");

  function deelLijst(kamerId) {
    const items = kamerId ? ideeen.filter(i => i.kamer === kamerId) : ideeen;
    const titel = kamerId ? `Woonideeën — ${KAMER_MAP[kamerId]?.label}` : "Woonideeën";
    const regels = [titel, ""];
    items.forEach(i => {
      regels.push(`• ${i.titel}${i.prijs != null ? ` — ${euro(i.prijs)}` : ""} (${STATUS_MAP[i.status]?.label || "Idee"})`);
      if (i.link) regels.push(`  ${i.link}`);
    });
    const tekst = regels.join("\n");
    if (navigator.share) {
      navigator.share({ title: titel, text: tekst }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(tekst)}`, "_blank");
    }
    setShowDeel(false);
  }

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
          <h1 style={S.title}>🏡 Woonideeën</h1>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button onClick={() => setShowBudget(true)} title="Budget per kamer"
            style={{ width: 36, height: 36, borderRadius: 10, background: C.surf, border: `1px solid ${C.border}`, fontSize: 16, cursor: "pointer" }}>💶</button>
          <button onClick={() => { setVergelijkModus(v => !v); setVergelijkIds([]); }} title="Vergelijk-modus"
            style={{ width: 36, height: 36, borderRadius: 10, background: vergelijkModus ? C.accent : C.surf, border: `1px solid ${vergelijkModus ? C.accent : C.border}`, fontSize: 16, cursor: "pointer" }}>⚖️</button>
          <button onClick={() => setShowDeel(true)} title="Delen als lijst"
            style={{ width: 36, height: 36, borderRadius: 10, background: C.surf, border: `1px solid ${C.border}`, fontSize: 16, cursor: "pointer" }}>📤</button>
        </div>
      </header>

      <main style={S.main}>
        {/* Zoeken */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={15} color={C.muted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input style={{ ...S.inp, paddingLeft: 36 }} placeholder="Zoeken op naam, omschrijving, notitie…" value={zoekterm} onChange={e => setZoekterm(e.target.value)} />
        </div>

        {vergelijkModus && (
          <div style={{ background: `${C.accent}18`, border: `1px solid ${C.accent}44`, borderRadius: 10, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: C.accentDark }}>
            ⚖️ Vergelijk-modus: tik items aan om te selecteren (max. 4), tik dan op "Vergelijk ({vergelijkIds.length})" onderaan.
          </div>
        )}

        {/* Sorteren */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.muted }}>Sorteer:</span>
          {[["nieuw","Nieuwste"],["prijs_laag","Prijs ↑"],["prijs_hoog","Prijs ↓"],["sterren","Sterren"]].map(([id,label]) => (
            <button key={id} style={S.chip(sortering===id)} onClick={() => setSortering(id)}>{label}</button>
          ))}
        </div>

        {/* Categorie-filters */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 8, paddingBottom: 2 }}>
          <button style={S.chip(!catFilter)} onClick={() => setCatFilter(null)}>Alle categorieën</button>
          {CATEGORIEEN.map(c => (
            <button key={c.id} style={S.chip(catFilter === c.id)} onClick={() => setCatFilter(catFilter === c.id ? null : c.id)}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        {/* Kamer-filters */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 8, paddingBottom: 2 }}>
          <button style={S.chip(!kamerFilter)} onClick={() => setKamerFilter(null)}>Alle kamers</button>
          {KAMERS.map(k => (
            <button key={k.id} style={S.chip(kamerFilter === k.id)} onClick={() => setKamerFilter(kamerFilter === k.id ? null : k.id)}>
              {k.icon} {k.label}
            </button>
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted, marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={toonAfgehandeld} onChange={e => setToonAfgehandeld(e.target.checked)} />
          Toon ook gekocht/afgewezen
        </label>

        {zichtbaar.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: C.accentDark, margin: "0 0 6px" }}>
              {ideeen.length === 0 ? "Nog geen woonideeën" : "Niets gevonden"}
            </p>
            <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>
              {ideeen.length === 0 ? "Tik op + om je eerste vondst toe te voegen." : "Probeer een andere zoekterm of filter."}
            </p>
          </div>
        )}

        {zichtbaar.map(i => {
          const geselecteerd = vergelijkIds.includes(i.id);
          return (
          <div key={i.id} style={{ ...S.card, display: "flex", gap: 12, cursor: "pointer", border: geselecteerd ? `2px solid ${C.accent}` : `1px solid ${C.border}` }}
            onClick={() => {
              if (!vergelijkModus) { setShowDetail(i.id); return; }
              setVergelijkIds(prev => geselecteerd ? prev.filter(id => id !== i.id) : (prev.length < 4 ? [...prev, i.id] : prev));
            }}>
            {vergelijkModus && (
              <div style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${geselecteerd ? C.accent : C.border}`, background: geselecteerd ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "center", color: "#FFF", fontSize: 13 }}>
                {geselecteerd ? "✓" : ""}
              </div>
            )}
            {i.foto ? (
              <img src={i.foto} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 10, background: C.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                {CAT_MAP[i.categorie]?.icon || "📦"}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.titel}</span>
                {i.prijs != null && <span style={{ fontSize: 14, fontWeight: 700, color: C.accentDark, flexShrink: 0 }}>{euro(i.prijs)}</span>}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span>{KAMER_MAP[i.kamer]?.icon} {KAMER_MAP[i.kamer]?.label}</span>
                <WieBadge persoon={i.addedBy} C={C} />
              </div>
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <StatusBadge status={i.status} />
                {gemiddeldeSterren(i) > 0 && (
                  <span style={{ fontSize: 11, color: C.muted }}>{"⭐".repeat(Math.round(gemiddeldeSterren(i)))}</span>
                )}
                {i.categorie === "keukenapparatuur" && i.energielabel && (
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 4, background: ENERGIELABELS.find(e => e.id === i.energielabel)?.kleur || C.muted, color: "#FFF", fontWeight: 800, fontSize: 10 }}>
                    {i.energielabel}
                  </span>
                )}
                {i.categorie === "keukenapparatuur" && (i.aandachtspunten||[]).some(a => !a.afgevinkt) && (
                  <span style={{ fontSize: 11, color: C.accent }}>📝 {(i.aandachtspunten||[]).filter(a=>!a.afgevinkt).length} open</span>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </main>

      {/* Vergelijk-balk */}
      {vergelijkModus && vergelijkIds.length > 0 && (
        <button onClick={() => setShowVergelijk(true)}
          style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: C.accentDark, color: "#FFF", border: "none", borderRadius: 30, padding: "13px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(0,0,0,0.25)", zIndex: 60 }}>
          ⚖️ Vergelijk ({vergelijkIds.length})
        </button>
      )}

      <button style={S.fab} onClick={() => { resetForm(); setShowForm(true); }} aria-label="Woonidee toevoegen">
        <Plus size={24} color="#FFFFFF" />
      </button>

      {/* Toevoeg/bewerk-formulier */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => { setShowForm(false); resetForm(); }}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>{editId ? "Woonidee bewerken" : "Woonidee toevoegen"}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => { setShowForm(false); resetForm(); }}>
                <X size={20} color={C.muted} />
              </button>
            </div>

            {!editId ? (
              <>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Link naar het product</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <Link2 size={14} color={C.muted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                    <input style={{ ...S.inp, paddingLeft: 32 }} placeholder="https://…" value={form.link}
                      onChange={e => setForm(f => ({ ...f, link: e.target.value }))} />
                  </div>
                  <button style={{ ...S.btn(), padding: "0 16px", fontSize: 13, whiteSpace: "nowrap" }} onClick={haalInfoUitLink} disabled={!form.link.trim() || linkLoading}>
                    {linkLoading ? "Bezig…" : "Info ophalen"}
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ flex: 1, height: 1, background: C.border }} />
                  <span style={{ fontSize: 11, color: C.muted }}>of</span>
                  <div style={{ flex: 1, height: 1, background: C.border }} />
                </div>
                <button style={{ ...S.btn(C.card, C.accentDark), width: "100%", border: `1px dashed ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 0", fontSize: 13, marginBottom: 4 }}
                  onClick={() => screenshotInputRef.current?.click()} disabled={linkLoading}>
                  📸 {linkLoading ? "Bezig… (herkennen + prijzen zoeken)" : "Foto herkennen — zoekt zelf prijzen bij aanbieders"}
                </button>
                <p style={{ margin: "0 0 14px", fontSize: 10, color: C.muted }}>
                  Werkt als Google Lens: ook zonder zichtbare prijs, of een foto van een echt object i.p.v. een productpagina.
                </p>
                <input ref={screenshotInputRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => { scanScreenshot(e.target.files[0]); e.target.value = ""; }} />
              </>
            ) : (
              // Bij bewerken: gewoon een link kunnen toevoegen/aanpassen — met
              // opzet géén "Info ophalen" hier, want dat zou de rest van het
              // formulier (dat je net aan het bewerken bent) overschrijven.
              <>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Link naar het product</label>
                <div style={{ position: "relative", marginBottom: 14 }}>
                  <Link2 size={14} color={C.muted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input style={{ ...S.inp, paddingLeft: 32 }} placeholder="https://… (bv. toegevoegd via Foto herkennen? Vul 'm hier alsnog aan)" value={form.link}
                    onChange={e => setForm(f => ({ ...f, link: e.target.value }))} />
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
              {form.foto ? (
                <img src={form.foto} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover" }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 10, background: C.card, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Camera size={22} color={C.muted} />
                </div>
              )}
              <button style={{ ...S.btn(C.card, C.accentDark), border: `1px solid ${C.border}`, fontSize: 13, padding: "9px 14px" }}
                onClick={() => fotoInputRef.current?.click()}>
                Eigen foto {form.foto ? "wijzigen" : "toevoegen"}
              </button>
              <input ref={fotoInputRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => { handleFotoUpload(e.target.files[0]); e.target.value = ""; }} />
            </div>

            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Wat is het?" value={form.titel}
              onChange={e => setForm(f => ({ ...f, titel: e.target.value }))} autoFocus={!!editId} />

            <textarea style={{ ...S.inp, marginBottom: 10, height: 64, resize: "none", boxSizing: "border-box" }} placeholder="Korte omschrijving (materiaal, afmeting, stijl…)"
              value={form.omschrijving} onChange={e => setForm(f => ({ ...f, omschrijving: e.target.value }))} />

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input style={S.inp} type="number" min="0" step="0.01" placeholder="Prijs €" value={form.prijs}
                onChange={e => setForm(f => ({ ...f, prijs: e.target.value }))} />
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Categorie</label>
            <select style={{ ...S.inp, marginBottom: 10 }} value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}>
              {CATEGORIEEN.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>

            {form.categorie === "keukenapparatuur" && (
              <div style={{ background: C.card, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Type apparaat</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {KEUKEN_TYPES.map(t => (
                    <button key={t.id} type="button" style={S.chip(form.keukenType === t.id)}
                      onClick={() => setForm(f => ({ ...f, keukenType: t.id }))}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Energielabel <span style={{ fontWeight: 400 }}>(optioneel — kookplaten hebben er vaak geen)</span>
                </label>
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {ENERGIELABELS.map(e => (
                    <button key={e.id} type="button" onClick={() => setForm(f => ({ ...f, energielabel: f.energielabel === e.id ? "" : e.id }))}
                      style={{ width: 34, height: 34, borderRadius: 8, border: form.energielabel === e.id ? `2px solid ${C.accentDark}` : "1px solid transparent", background: e.kleur, color: "#FFF", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                      {e.id}
                    </button>
                  ))}
                </div>

                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Aandachtspunten <span style={{ fontWeight: 400 }}>— dingen die je niet wilt vergeten te vragen in de winkel</span>
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {(AANDACHTSPUNT_SUGGESTIES[form.keukenType] || AANDACHTSPUNT_SUGGESTIES.overig)
                    .filter(sug => !(form.aandachtspunten||[]).some(a => a.tekst === sug))
                    .map(sug => (
                      <button key={sug} type="button" style={{ ...S.chip(false), fontSize: 11 }} onClick={() => voegAandachtspuntToe(sug)}>
                        + {sug}
                      </button>
                    ))}
                </div>
                {(form.aandachtspunten||[]).length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {form.aandachtspunten.map(a => (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                        <span onClick={() => toggleAandachtspunt(a.id)} style={{
                          width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${a.afgevinkt ? C.accent : C.border}`,
                          background: a.afgevinkt ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
                        }}>
                          {a.afgevinkt && <Check size={12} color="#FFF" />}
                        </span>
                        <span style={{ flex: 1, fontSize: 13, textDecoration: a.afgevinkt ? "line-through" : "none", color: a.afgevinkt ? C.muted : C.text }}>{a.tekst}</span>
                        <button onClick={() => verwijderAandachtspunt(a.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><X size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <input style={{ ...S.inp, fontSize: 13 }} placeholder="Eigen aandachtspunt…" value={eigenAandachtspunt}
                    onChange={e => setEigenAandachtspunt(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { voegAandachtspuntToe(eigenAandachtspunt); setEigenAandachtspunt(""); } }} />
                  <button type="button" style={{ ...S.btn(C.card, C.accentDark), border: `1px solid ${C.border}`, padding: "0 14px", fontSize: 13 }}
                    onClick={() => { voegAandachtspuntToe(eigenAandachtspunt); setEigenAandachtspunt(""); }}>
                    + Toevoegen
                  </button>
                </div>
              </div>
            )}

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Kamer</label>
            <select style={{ ...S.inp, marginBottom: 10 }} value={form.kamer} onChange={e => setForm(f => ({ ...f, kamer: e.target.value }))}>
              {KAMERS.map(k => <option key={k.id} value={k.id}>{k.icon} {k.label}</option>)}
            </select>

            <input style={{ ...S.inp, marginBottom: 16 }} placeholder="Notitie (optioneel)" value={form.notitie}
              onChange={e => setForm(f => ({ ...f, notitie: e.target.value }))} />

            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15 }} onClick={opslaanIdee}>
              {editId ? "Opslaan" : "Toevoegen"}
            </button>
          </div>
        </div>
      )}

      {/* Detailweergave */}
      {detailIdee && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => setShowDetail(null)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.accentDark }}>{detailIdee.titel}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowDetail(null)}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            {detailIdee.foto && <img src={detailIdee.foto} alt="" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 12, marginBottom: 14 }} />}

            {detailIdee.omschrijving && <p style={{ fontSize: 14, color: C.text, margin: "0 0 12px", lineHeight: 1.5 }}>{detailIdee.omschrijving}</p>}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {detailIdee.prijs != null && <span style={{ ...S.card, margin: 0, padding: "6px 12px", fontSize: 13, fontWeight: 700 }}>{euro(detailIdee.prijs)}</span>}
              <span style={{ ...S.card, margin: 0, padding: "6px 12px", fontSize: 13 }}>{CAT_MAP[detailIdee.categorie]?.icon} {CAT_MAP[detailIdee.categorie]?.label}</span>
              <span style={{ ...S.card, margin: 0, padding: "6px 12px", fontSize: 13 }}>{KAMER_MAP[detailIdee.kamer]?.icon} {KAMER_MAP[detailIdee.kamer]?.label}</span>
            </div>

            {detailIdee.link && (
              <a href={detailIdee.link} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.accent, marginBottom: 14, textDecoration: "none", fontWeight: 600 }}>
                <ExternalLink size={14} /> Bekijk product
              </a>
            )}

            {/* Beste prijs elders */}
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: detailIdee.prijsvergelijking?.length ? 8 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>💰 Beste prijs elders</span>
                <button onClick={() => zoekBestePrijs(detailIdee)} disabled={prijsLoading}
                  style={{ background: "none", border: "none", cursor: prijsLoading ? "default" : "pointer", color: C.accent, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ display: "inline-block", transform: prijsLoading ? "rotate(360deg)" : "none", transition: "transform 0.6s linear" }}>🔄</span>
                  {prijsLoading ? "Zoeken…" : "Ververs"}
                </button>
              </div>

              {detailIdee.eigenPrijsControle != null && detailIdee.prijs != null && detailIdee.eigenPrijsControle !== detailIdee.prijs && (
                <div style={{ background: detailIdee.eigenPrijsControle < detailIdee.prijs ? `${C.green}18` : `${C.yellow}18`, border: `1px solid ${detailIdee.eigenPrijsControle < detailIdee.prijs ? C.green : C.yellow}44`, borderRadius: 10, padding: "8px 10px", marginBottom: 8 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 12, color: C.text }}>
                    {detailIdee.eigenPrijsControle < detailIdee.prijs ? "📉 Prijs gedaald" : "📈 Prijs gestegen"} bij je eigen link: van {euro(detailIdee.prijs)} naar <strong>{euro(detailIdee.eigenPrijsControle)}</strong>
                  </p>
                  <button style={{ ...S.btn(detailIdee.eigenPrijsControle < detailIdee.prijs ? C.green : C.card, detailIdee.eigenPrijsControle < detailIdee.prijs ? "#FFF" : C.accentDark), fontSize: 12, padding: "6px 12px", border: detailIdee.eigenPrijsControle < detailIdee.prijs ? "none" : `1px solid ${C.border}` }}
                    onClick={() => bijwerkenPrijs(detailIdee.id, detailIdee.eigenPrijsControle)}>
                    Bijwerken naar {euro(detailIdee.eigenPrijsControle)}
                  </button>
                </div>
              )}

              {!detailIdee.prijsvergelijkingOp && !prijsLoading && (
                <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Nog niet gezocht — tik op "Ververs" om andere aanbieders te vergelijken.</p>
              )}
              {detailIdee.prijsvergelijking?.length > 0 && (
                <>
                  {detailIdee.prijsvergelijking.map((r, idx) => (
                    <a key={idx} href={r.link || "#"} target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: idx>0 ? `1px solid ${C.border}` : "none", textDecoration: "none", color: C.text }}>
                      <span style={{ fontSize: 13 }}>{r.winkel}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: detailIdee.prijs && r.prijs && r.prijs < detailIdee.prijs ? C.green : C.text }}>
                        {r.prijs != null ? euro(r.prijs) : "onbekend"}
                      </span>
                    </a>
                  ))}
                  <p style={{ margin: "8px 0 0", fontSize: 10, color: C.muted }}>
                    Gezocht op {new Date(detailIdee.prijsvergelijkingOp).toLocaleString("nl-NL", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })} — controleer de prijs altijd zelf voor je koopt.
                  </p>
                </>
              )}
              {detailIdee.prijsvergelijkingOp && !detailIdee.prijsvergelijking?.length && !prijsLoading && (
                <p style={{ margin: 0, fontSize: 12, color: C.muted }}>{detailIdee.prijsvergelijkingOpmerking || "Niets vergelijkbaars gevonden bij andere aanbieders."}</p>
              )}
            </div>

            {/* Keukenapparatuur: type, energielabel, aandachtspunten-checklist */}
            {detailIdee.categorie === "keukenapparatuur" && (
              <div style={{ ...S.card, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                    {KEUKEN_TYPE_MAP[detailIdee.keukenType]?.icon || "🔌"} {KEUKEN_TYPE_MAP[detailIdee.keukenType]?.label || "Keukenapparaat"}
                  </span>
                  {detailIdee.energielabel && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6,
                      background: ENERGIELABELS.find(e => e.id === detailIdee.energielabel)?.kleur || C.muted, color: "#FFF", fontWeight: 800, fontSize: 13,
                    }}>
                      {detailIdee.energielabel}
                    </span>
                  )}
                </div>

                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: C.text }}>📝 Aandachtspunten voor in de winkel</p>
                {(detailIdee.aandachtspunten||[]).length === 0 && (
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: C.muted }}>Nog niets genoteerd — voeg hieronder toe wat je niet wilt vergeten te vragen.</p>
                )}
                {(detailIdee.aandachtspunten||[]).map(a => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                    <span onClick={() => toggleAandachtspuntOpIdee(detailIdee.id, a.id)} style={{
                      width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${a.afgevinkt ? C.accent : C.border}`,
                      background: a.afgevinkt ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
                    }}>
                      {a.afgevinkt && <Check size={13} color="#FFF" />}
                    </span>
                    <span onClick={() => toggleAandachtspuntOpIdee(detailIdee.id, a.id)} style={{ flex: 1, fontSize: 14, cursor: "pointer", textDecoration: a.afgevinkt ? "line-through" : "none", color: a.afgevinkt ? C.muted : C.text }}>
                      {a.tekst}
                    </span>
                    <button onClick={() => verwijderAandachtspuntOpIdee(detailIdee.id, a.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><X size={13} /></button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input style={{ ...S.inp, fontSize: 13 }} placeholder="Nog iets vragen…" value={eigenAandachtspunt}
                    onChange={e => setEigenAandachtspunt(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { voegAandachtspuntToeOpIdee(detailIdee.id, eigenAandachtspunt); setEigenAandachtspunt(""); } }} />
                  <button style={{ ...S.btn(C.card, C.accentDark), border: `1px solid ${C.border}`, padding: "0 14px", fontSize: 13 }}
                    onClick={() => { voegAandachtspuntToeOpIdee(detailIdee.id, eigenAandachtspunt); setEigenAandachtspunt(""); }}>
                    +
                  </button>
                </div>
              </div>
            )}

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>Status</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {STATUSSEN.map(s => (
                <button key={s.id}
                  style={{ border: `1.5px solid ${detailIdee.status===s.id ? s.kleur : C.border}`, background: detailIdee.status===s.id ? s.kleur : "transparent", color: detailIdee.status===s.id ? "#FFF" : C.muted, borderRadius: 20, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                  onClick={() => zetStatus(detailIdee.id, s.id)}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 8 }}>Wat vinden jullie ervan?</label>
            <div style={{ ...S.card, marginBottom: 16 }}>
              <SterrenRij idee={detailIdee} zetSter={zetSter} />
            </div>

            {detailIdee.notitie && (
              <div style={{ fontSize: 13, color: C.muted, fontStyle: "italic", marginBottom: 16, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                📝 {detailIdee.notitie}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn(C.card, C.accentDark), flex: 1, border: `1px solid ${C.border}` }} onClick={() => { setShowDetail(null); bewerkIdee(detailIdee); }}>
                Bewerken
              </button>
              <button style={{ ...S.btn(C.red), flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => verwijderIdee(detailIdee.id)}>
                <Trash2 size={14} /> Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Budget per kamer */}
      {showBudget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => setShowBudget(false)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>💶 Budget per kamer</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowBudget(false)}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 12, color: C.muted }}>Plan = ideeën + overwegingen. Uitgegeven = alles dat op "Gekocht" staat.</p>
            {KAMERS.map(k => {
              const items = ideeen.filter(x => x.kamer === k.id);
              if (!items.length) return null;
              const plan = items.filter(x => x.status==="idee" || x.status==="overwegen").reduce((s,x)=>s+(x.prijs||0),0);
              const gekocht = items.filter(x => x.status==="gekocht").reduce((s,x)=>s+(x.prijs||0),0);
              return (
                <div key={k.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13 }}>{k.icon} {k.label} <span style={{ color: C.muted, fontSize: 11 }}>({items.length})</span></span>
                  <div style={{ textAlign: "right" }}>
                    {plan > 0 && <div style={{ fontSize: 12, color: C.muted }}>Plan: {euro(plan)}</div>}
                    {gekocht > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>Uitgegeven: {euro(gekocht)}</div>}
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", marginTop: 6, borderTop: `2px solid ${C.border}` }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Totaal</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: C.muted }}>Plan: {euro(ideeen.filter(x=>x.status==="idee"||x.status==="overwegen").reduce((s,x)=>s+(x.prijs||0),0))}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>Uitgegeven: {euro(ideeen.filter(x=>x.status==="gekocht").reduce((s,x)=>s+(x.prijs||0),0))}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vergelijk-modus resultaat */}
      {showVergelijk && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 110 }}
          onClick={() => setShowVergelijk(false)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>⚖️ Vergelijken</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowVergelijk(false)}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
              {vergelijkIds.map(id => {
                const it = ideeen.find(x => x.id === id);
                if (!it) return null;
                return (
                  <div key={id} style={{ ...S.card, minWidth: 160, maxWidth: 160, flexShrink: 0 }}>
                    {it.foto ? (
                      <img src={it.foto} alt="" style={{ width: "100%", height: 100, borderRadius: 8, objectFit: "cover", marginBottom: 8 }} />
                    ) : (
                      <div style={{ width: "100%", height: 100, borderRadius: 8, background: C.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 8 }}>
                        {CAT_MAP[it.categorie]?.icon || "📦"}
                      </div>
                    )}
                    <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{it.titel}</p>
                    {it.prijs != null && <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.accentDark }}>{euro(it.prijs)}</p>}
                    {gemiddeldeSterren(it) > 0 && <p style={{ margin: "0 0 4px", fontSize: 12 }}>{"⭐".repeat(Math.round(gemiddeldeSterren(it)))}</p>}
                    <p style={{ margin: "0 0 8px", fontSize: 11, color: C.muted }}>{KAMER_MAP[it.kamer]?.icon} {KAMER_MAP[it.kamer]?.label}</p>
                    {it.link && (
                      <a href={it.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.accent, fontWeight: 600, textDecoration: "none" }}>Bekijk product →</a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Delen als lijst */}
      {showDeel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => setShowDeel(false)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>📤 Delen als lijst</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowDeel(false)}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 12, color: C.muted }}>Kies een kamer om die lijst te delen — of deel alles.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button style={{ ...S.btn(C.card, C.accentDark), border: `1px solid ${C.border}`, textAlign: "left", padding: "12px 16px" }}
                onClick={() => deelLijst(null)}>
                🏡 Alles ({ideeen.length})
              </button>
              {KAMERS.map(k => {
                const n = ideeen.filter(x => x.kamer === k.id).length;
                if (!n) return null;
                return (
                  <button key={k.id} style={{ ...S.btn(C.card, C.accentDark), border: `1px solid ${C.border}`, textAlign: "left", padding: "12px 16px" }}
                    onClick={() => deelLijst(k.id)}>
                    {k.icon} {k.label} ({n})
                  </button>
                );
              })}
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
