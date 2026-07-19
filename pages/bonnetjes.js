import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, X, ChevronLeft, Search, Camera, Trash2, Calendar, ShieldCheck, ShieldAlert, ShieldX, Store } from "lucide-react";

// ── Constanten ─────────────────────────────────────────
const CATEGORIEEN = [
  { id: "elektronica",   label: "Elektronica",         icon: "📱" },
  { id: "huishouden",    label: "Huishoudapparaten",   icon: "🧺" },
  { id: "meubels",       label: "Meubels & wonen",     icon: "🛋️" },
  { id: "kleding",       label: "Kleding",             icon: "👕" },
  { id: "gereedschap",   label: "Gereedschap",         icon: "🔧" },
  { id: "sport",         label: "Sport & vrije tijd",  icon: "🚴" },
  { id: "speelgoed",     label: "Speelgoed",           icon: "🧸" },
  { id: "auto",          label: "Auto & camper",       icon: "🚐" },
  { id: "overig",        label: "Overig",              icon: "📦" },
];
const CAT_MAP = Object.fromEntries(CATEGORIEEN.map(c => [c.id, c]));

// Standaard garantieduur-suggesties (maanden) — puur als handig startpunt bij
// handmatige invoer; nooit een garantie voor de gebruiker, dus altijd
// aanpasbaar en nooit stilzwijgend aangenomen bij AI-herkenning tenzij zeer
// gangbaar (bv. elektronica in NL = wettelijk vaak rond de 24 maanden
// productverwachting, maar dat verschilt per winkel/fabrikant).
const GARANTIE_PRESETS = [12, 24, 36, 60];

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function callAI(prompt, imageBase64 = null, imageType = "image/jpeg", bron = "bonnetjes-overig") {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, imageBase64, imageType, maxTokens: 1000, bron }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI mislukt");
  return data.text;
}

// Comprimeert een foto naar een kleine JPEG (base64, zonder data-URL-prefix)
// voor opslag en voor AI-herkenning.
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

// Zet de eerste pagina van een PDF (bv. een factuur opgeslagen vanuit je
// mail) client-side om naar een JPEG-dataURL, op dezelfde manier behandeld
// als een gefotografeerd bonnetje. pdfjs-dist wordt dynamisch geladen (mag
// nooit server-side/tijdens SSR draaien, want het heeft canvas/document
// nodig) en de worker komt van een CDN zodat er geen extra webpack-
// configuratie nodig is om 'm mee te bundelen.
async function pdfEerstePaginaNaarFoto(file, max = 1100) {
  const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  // Render op een hoge schaal voor leesbaarheid (kleine bedragen/tekst op
  // een factuur), pas daarna comprimeren/verkleinen naar het uploadformaat.
  const viewport = page.getViewport({ scale: 2.2 });
  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = viewport.width;
  renderCanvas.height = viewport.height;
  await page.render({ canvasContext: renderCanvas.getContext("2d"), viewport }).promise;

  let { width, height } = renderCanvas;
  if (width <= max && height <= max) return renderCanvas.toDataURL("image/jpeg", 0.85);
  const schaal = width > height ? max / width : max / height;
  const kleinCanvas = document.createElement("canvas");
  kleinCanvas.width = Math.round(width * schaal);
  kleinCanvas.height = Math.round(height * schaal);
  kleinCanvas.getContext("2d").drawImage(renderCanvas, 0, 0, kleinCanvas.width, kleinCanvas.height);
  return kleinCanvas.toDataURL("image/jpeg", 0.85);
}

// Tijdzone-veilige datumfuncties — nooit toISOString() gebruiken.
function vandaagStr() {
  const nu = new Date();
  return `${nu.getFullYear()}-${String(nu.getMonth()+1).padStart(2,"0")}-${String(nu.getDate()).padStart(2,"0")}`;
}
function datumPlusMaanden(datumStr, maanden) {
  const [j, m, d] = datumStr.split("-").map(Number);
  const dt = new Date(j, m - 1 + maanden, d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
}
function dagenTot(datumStr) {
  if (!datumStr) return null;
  const [j, m, d] = datumStr.split("-").map(Number);
  const doel = new Date(j, m - 1, d);
  const nu = new Date();
  const vandaag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate());
  return Math.round((doel - vandaag) / (1000 * 60 * 60 * 24));
}
function formatDatum(datumStr) {
  if (!datumStr) return "";
  const [j, m, d] = datumStr.split("-").map(Number);
  return new Date(j, m - 1, d).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}
function euro(n) { return `€${(+n || 0).toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`; }

// Garantiestatus van een bonnetje: geen opgegeven garantie, nog geldig
// (evt. "loopt binnenkort af" binnen 30 dagen), of al verlopen.
function garantieStatus(bonnetje) {
  if (!bonnetje.garantieVervaltOp) return { status: "onbekend" };
  const dagen = dagenTot(bonnetje.garantieVervaltOp);
  if (dagen < 0) return { status: "verlopen", dagen };
  if (dagen <= 30) return { status: "binnenkort", dagen };
  return { status: "geldig", dagen };
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

export default function BonnetjesApp() {
  const [bonnetjes, setBonnetjesState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [huidigeGebruiker, setHuidigeGebruiker] = useState(null);
  const lastWriteRef = useRef(0);
  const fotoInputRef = useRef(null);
  const scanCameraRef = useRef(null);
  const scanBibliotheekRef = useRef(null);
  const scanPdfRef = useRef(null);

  const [zoekterm, setZoekterm] = useState("");
  const [catFilter, setCatFilter] = useState(null);
  const [garantieFilter, setGarantieFilter] = useState(false); // true = toon alleen actieve garanties
  const [toast, setToast] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(LEEG_FORM());
  const [scanLoading, setScanLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(null); // bonnetje-id

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.user) setHuidigeGebruiker(d.user);
    }).catch(() => {});
  }, []);

  const persist = useCallback((nextBonnetjes) => {
    lastWriteRef.current = Date.now();
    setBonnetjesState(nextBonnetjes);
    fetch("/api/bonnetjes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bonnetjes: nextBonnetjes }),
    }).catch(e => console.error("Opslaan mislukt", e));
  }, []);

  const laadData = useCallback(async () => {
    try {
      const res = await fetch("/api/bonnetjes");
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
        setBonnetjesState(data.bonnetjes || []);
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

  function opslaanBonnetje() {
    if (!form.naam.trim() || !form.aankoopdatum) return;
    const garantieVervaltOp = form.garantieMaanden
      ? datumPlusMaanden(form.aankoopdatum, +form.garantieMaanden)
      : (form.garantieVervaltOp || "");
    const payload = {
      ...form,
      garantieMaanden: form.garantieMaanden ? +form.garantieMaanden : null,
      garantieVervaltOp,
      prijs: form.prijs ? +form.prijs : null,
    };
    if (editId) {
      persist(bonnetjes.map(b => b.id === editId ? { ...b, ...payload } : b));
      showToast(`✅ ${form.naam} bijgewerkt`);
    } else {
      const nieuw = { id: uid(), ...payload, addedAt: Date.now(), addedBy: huidigeGebruiker };
      persist([nieuw, ...bonnetjes]);
      showToast(`✅ ${form.naam} toegevoegd`);
    }
    resetForm();
    setShowForm(false);
  }

  function bewerkBonnetje(b) {
    setForm({
      naam: b.naam || "", winkel: b.winkel || "", categorie: b.categorie || "overig",
      prijs: b.prijs != null ? String(b.prijs) : "", aankoopdatum: b.aankoopdatum || vandaagStr(),
      garantieMaanden: b.garantieMaanden != null ? String(b.garantieMaanden) : "",
      garantieVervaltOp: b.garantieVervaltOp || "", notitie: b.notitie || "", foto: b.foto || null,
    });
    setEditId(b.id);
    setShowForm(true);
  }

  function verwijderBonnetje(id) {
    if (!window.confirm("Dit bonnetje verwijderen?")) return;
    persist(bonnetjes.filter(b => b.id !== id));
    if (showDetail === id) setShowDetail(null);
  }

  async function handleFotoUpload(file) {
    if (!file) return;
    const compressed = await comprimeerFoto(file);
    setForm(f => ({ ...f, foto: compressed }));
  }

  // Kernlogica: stuurt een al-gecomprimeerde afbeelding (dataURL, bv. van een
  // foto óf van de eerste pagina van een geconverteerde PDF) naar de AI en
  // vult het formulier. Wordt gedeeld door de foto-scan en de PDF-import,
  // zodat een factuur-PDF straks precies hetzelfde wordt behandeld als een
  // gefotografeerde kassabon.
  async function analyseerBonAfbeelding(compressedDataUrl) {
    const base64 = compressedDataUrl.split(",")[1];
    const tekst = await callAI(
      `Bekijk deze foto/pagina van een kassabon of factuur. Geef ALLEEN een JSON-object terug, zonder uitleg, markdown of codeblok, in exact dit formaat: ` +
      `{"naam": "korte omschrijving van de belangrijkste/duurste aankoop op dit bonnetje of deze factuur", "winkel": "naam van de winkel/leverancier, leeg als onduidelijk", ` +
      `"prijs": totaalbedrag als getal zonder €-teken (of het duidelijke deelbedrag van het hoofdproduct als er meerdere producten op staan), ` +
      `"aankoopdatum": "YYYY-MM-DD zoals vermeld, leeg als onleesbaar", ` +
      `"categorie": "${CATEGORIEEN.map(c=>c.id).join("|")}", ` +
      `"garantieMaanden": alleen invullen als dit een aankoop is met een zeer gangbare standaardgarantie in Nederland (bv. grote elektronica/witgoed vaak 24, anders leeg laten — NOOIT gokken)}. ` +
      `Kies voor "categorie" de best passende optie uit de gegeven lijst.`,
      base64, "image/jpeg", "bonnetjes-scan"
    );
    const schoon = tekst.replace(/```json|```/g, "").trim();
    const resultaat = JSON.parse(schoon);
    setForm(f => ({
      ...f,
      naam: resultaat.naam || f.naam,
      winkel: resultaat.winkel || f.winkel,
      prijs: resultaat.prijs != null ? String(resultaat.prijs) : f.prijs,
      aankoopdatum: resultaat.aankoopdatum || f.aankoopdatum,
      categorie: CATEGORIEEN.some(c=>c.id===resultaat.categorie) ? resultaat.categorie : f.categorie,
      garantieMaanden: resultaat.garantieMaanden ? String(resultaat.garantieMaanden) : f.garantieMaanden,
      foto: compressedDataUrl,
    }));
  }

  // Scant een foto van een kassabon: herkent winkel, product(en), prijs,
  // aankoopdatum en categorie. Vult automatisch het toevoegformulier — de
  // gebruiker controleert en past aan waar nodig, en vult zelf garantie in
  // als de AI daar niet zeker genoeg over is.
  async function scanBonnetje(file) {
    if (!file) return;
    setScanLoading(true);
    try {
      const compressed = await comprimeerFoto(file);
      await analyseerBonAfbeelding(compressed);
      showToast("✨ Bonnetje gescand — controleer en vul aan waar nodig");
      setShowForm(true);
    } catch (e) {
      showToast("❌ Scannen mislukt, vul handmatig in");
      setForm(f => ({ ...f }));
      setShowForm(true);
    }
    setScanLoading(false);
  }

  // Een PDF-factuur (bv. opgeslagen vanuit je mail) wordt client-side omgezet
  // naar een afbeelding van de eerste pagina — daarna verloopt de AI-
  // herkenning identiek aan een gefotografeerd bonnetje. Geen aparte
  // e-mailkoppeling nodig: sla de PDF uit je mailtje op en upload 'm hier.
  async function scanBonnetjePDF(file) {
    if (!file) return;
    setScanLoading(true);
    try {
      const compressed = await pdfEerstePaginaNaarFoto(file);
      await analyseerBonAfbeelding(compressed);
      showToast("✨ PDF-factuur gescand — controleer en vul aan waar nodig");
      setShowForm(true);
    } catch (e) {
      showToast("❌ PDF inlezen mislukt — is dit een gewone (niet-gescande, niet-beveiligde) PDF?");
      setForm(f => ({ ...f }));
      setShowForm(true);
    }
    setScanLoading(false);
  }

  // ── Afgeleide data ──────────────────────────────────────
  let zichtbaar = [...bonnetjes];
  if (catFilter) zichtbaar = zichtbaar.filter(b => b.categorie === catFilter);
  if (garantieFilter) zichtbaar = zichtbaar.filter(b => garantieStatus(b).status === "geldig" || garantieStatus(b).status === "binnenkort");
  if (zoekterm.trim()) {
    const z = zoekterm.toLowerCase();
    zichtbaar = zichtbaar.filter(b =>
      (b.naam||"").toLowerCase().includes(z) ||
      (b.winkel||"").toLowerCase().includes(z) ||
      (b.notitie||"").toLowerCase().includes(z)
    );
  }
  zichtbaar.sort((a,b) => (b.aankoopdatum||"").localeCompare(a.aankoopdatum||""));

  const binnenkortVerlopend = bonnetjes.filter(b => garantieStatus(b).status === "binnenkort").sort((a,b)=>(a.garantieVervaltOp||"").localeCompare(b.garantieVervaltOp||""));

  if (loading) return (
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <Store size={32} color={C.accent} />
        <p style={{ color: C.muted, fontSize: 14 }}>Bonnetjes laden…</p>
      </div>
    </div>
  );

  return (
    <BonnetjesView
      bonnetjes={bonnetjes} zichtbaar={zichtbaar} binnenkortVerlopend={binnenkortVerlopend}
      offline={offline} zoekterm={zoekterm} setZoekterm={setZoekterm}
      catFilter={catFilter} setCatFilter={setCatFilter}
      garantieFilter={garantieFilter} setGarantieFilter={setGarantieFilter}
      showForm={showForm} setShowForm={setShowForm} form={form} setForm={setForm}
      editId={editId} resetForm={resetForm} opslaanBonnetje={opslaanBonnetje}
      bewerkBonnetje={bewerkBonnetje} verwijderBonnetje={verwijderBonnetje}
      handleFotoUpload={handleFotoUpload} scanBonnetje={scanBonnetje} scanLoading={scanLoading}
      fotoInputRef={fotoInputRef} scanCameraRef={scanCameraRef} scanBibliotheekRef={scanBibliotheekRef}
      scanPdfRef={scanPdfRef} scanBonnetjePDF={scanBonnetjePDF}
      showDetail={showDetail} setShowDetail={setShowDetail}
      toast={toast}
    />
  );
}

function LEEG_FORM() {
  return { naam: "", winkel: "", categorie: "overig", prijs: "", aankoopdatum: vandaagStr(), garantieMaanden: "", garantieVervaltOp: "", notitie: "", foto: null };
}
const C = {
  bg: "#F7F5F2", surf: "#FFFFFF", card: "#EFEBE4",
  border: "#E0D9CC", accent: "#8B5E34", accentDark: "#5E3E20",
  text: "#2A241C", muted: "#8C8576", green: "#2D6A4F", red: "#C0392B", yellow: "#C97D0C",
};
const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: C.accentDark },
  main: { padding: "4px 20px 120px" },
  inp: { background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 15, width: "100%", boxSizing: "border-box", color: C.text },
  btn: (bg=C.accent, col="#FFFFFF") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, marginBottom: 10 },
  fab: { position: "fixed", bottom: 28, right: 20, width: 52, height: 52, borderRadius: 16, background: C.accent, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px rgba(139,94,52,0.35)", zIndex: 50 },
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
  chip: (active) => ({ border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accent : "#FFFFFF", color: active ? "#FFF" : C.muted, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }),
};

function GarantieBadge({ bonnetje }) {
  const g = garantieStatus(bonnetje);
  if (g.status === "onbekend") return null;
  const map = {
    geldig:     { kleur: C.green,  icoon: <ShieldCheck size={12} />, tekst: `Nog ${g.dagen} dagen garantie` },
    binnenkort: { kleur: C.yellow, icoon: <ShieldAlert size={12} />, tekst: `Garantie verloopt over ${g.dagen} dagen` },
    verlopen:   { kleur: C.muted,  icoon: <ShieldX size={12} />,     tekst: "Garantie verlopen" },
  };
  const cfg = map[g.status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: cfg.kleur, background: `${cfg.kleur}18`, padding: "3px 8px", borderRadius: 8 }}>
      {cfg.icoon} {cfg.tekst}
    </span>
  );
}

function BonnetjesView({
  bonnetjes, zichtbaar, binnenkortVerlopend, offline, zoekterm, setZoekterm,
  catFilter, setCatFilter, garantieFilter, setGarantieFilter,
  showForm, setShowForm, form, setForm, editId, resetForm, opslaanBonnetje,
  bewerkBonnetje, verwijderBonnetje, handleFotoUpload, scanBonnetje, scanLoading,
  fotoInputRef, scanCameraRef, scanBibliotheekRef, scanPdfRef, scanBonnetjePDF, showDetail, setShowDetail, toast,
}) {
  const detailBonnetje = showDetail ? bonnetjes.find(b => b.id === showDetail) : null;

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
          <h1 style={S.title}>🧾 Bonnetjes</h1>
        </div>
      </header>

      <main style={S.main}>
        {/* Snel-scan knoppen */}
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button style={{ ...S.btn(), flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "13px 0", fontSize: 13 }}
            onClick={() => scanCameraRef.current?.click()} disabled={scanLoading}>
            <Camera size={15} /> {scanLoading ? "Bezig…" : "Camera"}
          </button>
          <button style={{ ...S.btn(C.card, C.accentDark), flex: 1, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "13px 0", fontSize: 13 }}
            onClick={() => scanBibliotheekRef.current?.click()} disabled={scanLoading}>
            🖼️ {scanLoading ? "Bezig…" : "Bibliotheek"}
          </button>
        </div>
        <button style={{ ...S.btn(C.card, C.accentDark), width: "100%", border: `1px dashed ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", fontSize: 13, marginBottom: 12 }}
          onClick={() => scanPdfRef.current?.click()} disabled={scanLoading}>
          📄 {scanLoading ? "Bezig…" : "PDF-factuur uploaden (bv. uit je mail)"}
        </button>
        <input ref={scanCameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
          onChange={e => { scanBonnetje(e.target.files[0]); e.target.value = ""; }} />
        <input ref={scanBibliotheekRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { scanBonnetje(e.target.files[0]); e.target.value = ""; }} />
        <input ref={scanPdfRef} type="file" accept="application/pdf" style={{ display: "none" }}
          onChange={e => { scanBonnetjePDF(e.target.files[0]); e.target.value = ""; }} />

        {/* Garantie loopt binnenkort af */}
        {binnenkortVerlopend.length > 0 && (
          <div style={{ background: `${C.yellow}18`, border: `1px solid ${C.yellow}55`, borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: C.yellow, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              ⚠️ Garantie loopt binnenkort af
            </p>
            {binnenkortVerlopend.map(b => (
              <div key={b.id} onClick={() => setShowDetail(b.id)} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", cursor: "pointer" }}>
                <span>{CAT_MAP[b.categorie]?.icon} {b.naam}</span>
                <span style={{ fontWeight: 700, color: C.yellow }}>t/m {formatDatum(b.garantieVervaltOp)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Zoeken */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={15} color={C.muted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input style={{ ...S.inp, paddingLeft: 36 }} placeholder="Zoeken op product, winkel, notitie…" value={zoekterm} onChange={e => setZoekterm(e.target.value)} />
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 8, paddingBottom: 2 }}>
          <button style={S.chip(!catFilter)} onClick={() => setCatFilter(null)}>Alles</button>
          {CATEGORIEEN.map(c => (
            <button key={c.id} style={S.chip(catFilter === c.id)} onClick={() => setCatFilter(catFilter === c.id ? null : c.id)}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted, marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={garantieFilter} onChange={e => setGarantieFilter(e.target.checked)} />
          Alleen bonnetjes met actieve garantie
        </label>

        {zichtbaar.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: C.accentDark, margin: "0 0 6px" }}>
              {bonnetjes.length === 0 ? "Nog geen bonnetjes" : "Niets gevonden"}
            </p>
            <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>
              {bonnetjes.length === 0 ? "Scan een bonnetje of tik op + om er handmatig een toe te voegen." : "Probeer een andere zoekterm of filter."}
            </p>
          </div>
        )}

        {zichtbaar.map(b => (
          <div key={b.id} style={{ ...S.card, display: "flex", gap: 12, cursor: "pointer" }} onClick={() => setShowDetail(b.id)}>
            {b.foto ? (
              <img src={b.foto} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: 10, background: C.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                {CAT_MAP[b.categorie]?.icon || "📦"}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.naam}</span>
                {b.prijs != null && <span style={{ fontSize: 14, fontWeight: 700, color: C.accentDark, flexShrink: 0 }}>{euro(b.prijs)}</span>}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {b.winkel && <span>{b.winkel} · </span>}
                <span>{formatDatum(b.aankoopdatum)}</span>
                <WieBadge persoon={b.addedBy} C={C} />
              </div>
              <div style={{ marginTop: 6 }}><GarantieBadge bonnetje={b} /></div>
            </div>
          </div>
        ))}
      </main>

      <button style={S.fab} onClick={() => { resetForm(); setShowForm(true); }} aria-label="Bonnetje toevoegen">
        <Plus size={24} color="#FFFFFF" />
      </button>

      {/* Toevoeg/bewerk-formulier */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => { setShowForm(false); resetForm(); }}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>{editId ? "Bonnetje bewerken" : "Bonnetje toevoegen"}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => { setShowForm(false); resetForm(); }}>
                <X size={20} color={C.muted} />
              </button>
            </div>

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
                Foto {form.foto ? "wijzigen" : "toevoegen"}
              </button>
              <input ref={fotoInputRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => { handleFotoUpload(e.target.files[0]); e.target.value = ""; }} />
            </div>

            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Wat heb je gekocht?" value={form.naam}
              onChange={e => setForm(f => ({ ...f, naam: e.target.value }))} autoFocus />

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input style={S.inp} placeholder="Winkel" value={form.winkel}
                onChange={e => setForm(f => ({ ...f, winkel: e.target.value }))} />
              <input style={S.inp} type="number" min="0" step="0.01" placeholder="Prijs €" value={form.prijs}
                onChange={e => setForm(f => ({ ...f, prijs: e.target.value }))} />
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Categorie</label>
            <select style={{ ...S.inp, marginBottom: 10 }} value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}>
              {CATEGORIEEN.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Aankoopdatum</label>
            <input style={{ ...S.inp, marginBottom: 10 }} type="date" value={form.aankoopdatum}
              onChange={e => setForm(f => ({ ...f, aankoopdatum: e.target.value }))} />

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Garantie (optioneel)</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              {GARANTIE_PRESETS.map(m => (
                <button key={m} type="button"
                  style={{ ...S.chip(form.garantieMaanden === String(m)), padding: "6px 12px" }}
                  onClick={() => setForm(f => ({ ...f, garantieMaanden: f.garantieMaanden === String(m) ? "" : String(m), garantieVervaltOp: "" }))}>
                  {m} mnd
                </button>
              ))}
              <button type="button" style={S.chip(form.garantieMaanden === "")} onClick={() => setForm(f => ({ ...f, garantieMaanden: "" }))}>
                Onbekend
              </button>
            </div>
            {form.garantieMaanden ? (
              <p style={{ fontSize: 12, color: C.muted, margin: "0 0 14px" }}>
                Vervalt op {formatDatum(datumPlusMaanden(form.aankoopdatum, +form.garantieMaanden))} (aankoopdatum + {form.garantieMaanden} mnd)
              </p>
            ) : (
              <>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Of vul direct een vervaldatum in als je die weet:</label>
                <input style={{ ...S.inp, marginBottom: 14 }} type="date" value={form.garantieVervaltOp}
                  onChange={e => setForm(f => ({ ...f, garantieVervaltOp: e.target.value }))} />
              </>
            )}

            <input style={{ ...S.inp, marginBottom: 16 }} placeholder="Notitie (optioneel, bv. serienummer)" value={form.notitie}
              onChange={e => setForm(f => ({ ...f, notitie: e.target.value }))} />

            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15 }} onClick={opslaanBonnetje}>
              {editId ? "Opslaan" : "Toevoegen"}
            </button>
          </div>
        </div>
      )}

      {/* Detailweergave */}
      {detailBonnetje && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => setShowDetail(null)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.accentDark }}>{detailBonnetje.naam}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowDetail(null)}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            {detailBonnetje.foto && <img src={detailBonnetje.foto} alt="" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 12, marginBottom: 14 }} />}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: C.muted }}>Categorie</span>
                <span>{CAT_MAP[detailBonnetje.categorie]?.icon} {CAT_MAP[detailBonnetje.categorie]?.label}</span>
              </div>
              {detailBonnetje.winkel && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: C.muted }}>Winkel</span><span>{detailBonnetje.winkel}</span>
                </div>
              )}
              {detailBonnetje.prijs != null && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: C.muted }}>Prijs</span><span style={{ fontWeight: 700 }}>{euro(detailBonnetje.prijs)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: C.muted }}>Aankoopdatum</span><span>{formatDatum(detailBonnetje.aankoopdatum)}</span>
              </div>
              {detailBonnetje.garantieVervaltOp && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
                  <span style={{ color: C.muted }}>Garantie</span>
                  <div style={{ textAlign: "right" }}>
                    <div>t/m {formatDatum(detailBonnetje.garantieVervaltOp)}</div>
                    <GarantieBadge bonnetje={detailBonnetje} />
                  </div>
                </div>
              )}
              {detailBonnetje.notitie && (
                <div style={{ fontSize: 13, color: C.muted, fontStyle: "italic", marginTop: 4, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                  📝 {detailBonnetje.notitie}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn(C.card, C.accentDark), flex: 1, border: `1px solid ${C.border}` }} onClick={() => { setShowDetail(null); bewerkBonnetje(detailBonnetje); }}>
                Bewerken
              </button>
              <button style={{ ...S.btn(C.red), flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => verwijderBonnetje(detailBonnetje.id)}>
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
