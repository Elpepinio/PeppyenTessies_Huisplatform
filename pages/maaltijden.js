import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, X, ChevronLeft, Search, ShoppingCart, Clock, Users, Flame } from "lucide-react";

// ── Constanten ─────────────────────────────────────────
const DAGEN = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
const MAALTIJDMOMENTEN = ["Ontbijt","Lunch","Diner"];
const KEUKENS = ["Nederlands","Italiaans","Aziatisch","Mediterraan","Mexicaans","Frans","Indisch","Kamado","Overig"];
const DIEET_TAGS = ["Vegetarisch","Veganistisch","Glutenvrij","Lactosevrij"];

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Zoekt de eerste tijdsaanduiding in een bereidingsstap (bv. "20 minuten" of
// "15 min") zodat Kookmodus daar automatisch een timer voor kan voorstellen.
function minutenUitStap(tekst) {
  const match = tekst.match(/(\d+)\s*(minuten|minuut|min)\b/i);
  return match ? parseInt(match[1], 10) : null;
}

// Gemiddelde van de per-persoon beoordelingen van een recept, voor gebruik in
// lijstweergaves. Alleen personen die daadwerkelijk beoordeeld hebben tellen mee.
function weergaveReceptBeoordeling(recept) {
  const b = recept.beoordelingen;
  if (!b) return 0;
  const scores = [b.Pepijn, b.Tessa].filter(n => n > 0);
  if (scores.length === 0) return 0;
  return Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10;
}

function huidigeMaandag() {
  const nu = new Date();
  // Gebruik lokale datum om tijdzone-issues te vermijden
  const jaar = nu.getFullYear();
  const maand = String(nu.getMonth() + 1).padStart(2, "0");
  const dag = String(nu.getDate()).padStart(2, "0");
  const vandaag = `${jaar}-${maand}-${dag}`;
  // Bereken dag van de week (0=zo, 1=ma)
  const dagVdWeek = nu.getDay();
  const diff = dagVdWeek === 0 ? -6 : 1 - dagVdWeek;
  const ma = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() + diff);
  return `${ma.getFullYear()}-${String(ma.getMonth()+1).padStart(2,"0")}-${String(ma.getDate()).padStart(2,"0")}`;
}

// Tijdzone-veilige "vandaag" string
function vandaagStr() {
  const nu = new Date();
  return `${nu.getFullYear()}-${String(nu.getMonth()+1).padStart(2,"0")}-${String(nu.getDate()).padStart(2,"0")}`;
}

// Datum optellen zonder tijdzone-issues
function datumPlusDagen(datumStr, dagen) {
  const [j, m, d] = datumStr.split("-").map(Number);
  const dt = new Date(j, m - 1, d + dagen);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
}

async function loadData() {
  try {
    const res = await fetch("/api/maaltijden");
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function saveData(data) {
  try {
    await fetch("/api/maaltijden", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) { console.error("Opslaan mislukt", e); }
}

async function callAI(prompt, bron = "maaltijden-overig") {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens: 1500, bron }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI mislukt");
  return data.text;
}

// ── Stijlen ─────────────────────────────────────────────
const C = {
  bg: "#FFF8F0", surf: "#FFFFFF", card: "#FFF2E5",
  border: "#F0D9C0", orange: "#C86E4A", accent: "#E8956D",
  text: "#2D1A0E", muted: "#8C6B4A", green: "#2D6A4F",
  red: "#D63353", blue: "#0099CC", yellow: "#CC8800",
};
const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: C.orange },
  main: { padding: "4px 20px 120px" },
  inp: { background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 15, width: "100%", boxSizing: "border-box", color: C.text },
  btn: (bg=C.orange, col="#FFFFFF") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 12 },
  fab: { position: "fixed", bottom: 28, right: 20, width: 52, height: 52, borderRadius: 16, background: C.orange, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px rgba(200,110,74,0.3)", zIndex: 50 },
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
  tabBtn: (active) => ({ flex: 1, border: "none", background: active ? C.orange : "transparent", color: active ? "#FFF" : C.muted, borderRadius: 9, padding: "9px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }),
};

// ════════════════════════════════════════════════════════
// HOOFD APP
// ════════════════════════════════════════════════════════
export default function MaaltijdApp() {
  const [recepten, setReceptenState] = useState([]);
  const [weekmenu, setWeekmenuState] = useState({});
  const [aiKostenMaand, setAiKostenMaand] = useState(null);

  useEffect(() => {
    fetch("/api/ai-gebruik").then(r => r.json()).then(d => {
      const nu = new Date();
      const maandStr = `${nu.getFullYear()}-${String(nu.getMonth()+1).padStart(2,"0")}`;
      const usd = (d.log||[]).filter(e => e.bron?.startsWith("maaltijden-") && e.datum.startsWith(maandStr))
        .reduce((s,e) => s + (e.kostenUsd||0), 0);
      setAiKostenMaand(usd * 0.92);
    }).catch(() => {});
  }, []);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("week"); // week | recepten | ai
  const [actieefReceptId, setActieefReceptId] = useState(null);
  const [weekStart, setWeekStart] = useState(huidigeMaandag());
  const lastWriteRef = useRef(0);

  // Recept form
  const [showReceptForm, setShowReceptForm] = useState(false);
  const [receptForm, setReceptForm] = useState({
    naam: "", keuken: "Nederlands", bereidingstijd: "30", porties: "4",
    beschrijving: "", kcal: "", koolhydraten: "", eiwitten: "", vetten: "",
    ingredienten: [{ naam: "", hoeveelheid: "", eenheid: "g" }],
    stappen: [""], dieet: [], kamado: { temperatuur: "", hitte: "indirect", rooktijd: "" },
  });

  // Weekmenu plannen
  const [sleepDag, setSleepDag] = useState(null);
  const [sleepMoment, setSleepMoment] = useState(null);
  const [showPlanOverlay, setShowPlanOverlay] = useState(false);
  const [planDag, setPlanDag] = useState(null);
  const [planMoment, setPlanMoment] = useState(null);
  const [planZoek, setPlanZoek] = useState("");

  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResultaat, setAiResultaat] = useState(null);
  const [zoekterm, setZoekterm] = useState("");
  const [ingeklapteKeukens, setIngeklapteKeukens] = useState({});
  const [dieetFilter, setDieetFilter] = useState(null);
  const [huidigeGebruiker, setHuidigeGebruiker] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.user) setHuidigeGebruiker(d.user);
    }).catch(() => {});
  }, []);
  const [importTab, setImportTab] = useState("ai"); // ai | foto | link
  const [importUrl, setImportUrl] = useState("");
  const [importFotoLoading, setImportFotoLoading] = useState(false);
  const [importLinkLoading, setImportLinkLoading] = useState(false);
  const [importFout, setImportFout] = useState(null);
  const fotoImportRef = useRef();

  const [porties, setPorties] = useState({});
  const [bewerkReceptId, setBewerkReceptId] = useState(null); // recept-id -> porties override
  const [toast, setToast] = useState(null);
  const [kookModusActief, setKookModusActief] = useState(false);
  const [kookStapIndex, setKookStapIndex] = useState(0);
  const [kookTimerSec, setKookTimerSec] = useState(0);
  const [kookTimerLopend, setKookTimerLopend] = useState(false);
  const [showDagboekForm, setShowDagboekForm] = useState(false);
  const [dagboekNotitie, setDagboekNotitie] = useState("");
  const [showWeekSuggestie, setShowWeekSuggestie] = useState(false);
  const [weekSuggestieLoading, setWeekSuggestieLoading] = useState(false);

  // Timer-countdown voor Kookmodus
  useEffect(() => {
    if (!kookTimerLopend || kookTimerSec <= 0) return;
    const interval = setInterval(() => {
      setKookTimerSec(s => {
        if (s <= 1) {
          setKookTimerLopend(false);
          if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
          showToast("⏰ Timer afgelopen!");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [kookTimerLopend]);

  // ── Data ─────────────────────────────────────────────
  const persistData = useCallback((nextRecepten, nextWeekmenu) => {
    lastWriteRef.current = Date.now();
    setReceptenState(nextRecepten);
    setWeekmenuState(nextWeekmenu);
    saveData({ recepten: nextRecepten, weekmenu: nextWeekmenu });
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (Date.now() - lastWriteRef.current < 5000) return;
      const data = await loadData();
      if (active && data) {
        setReceptenState(data.recepten || []);
        setWeekmenuState(data.weekmenu || {});
        setLoading(false);
      } else if (active) setLoading(false);
    };
    refresh();
    const poll = setInterval(refresh, 8000);
    return () => { active = false; clearInterval(poll); };
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  // ── Recept mutaties ───────────────────────────────────
  function voegReceptToe() {
    if (!receptForm.naam.trim()) return;
    const nieuw = {
      ...receptForm,
      id: uid(),
      porties: +receptForm.porties || 4,
      bereidingstijd: +receptForm.bereidingstijd || 30,
      kcal: +receptForm.kcal || 0,
      ingredienten: receptForm.ingredienten.filter(i => i.naam.trim()),
      stappen: receptForm.stappen.filter(s => s.trim()),
      aangemaaktOp: Date.now(),
    };
    persistData([...recepten, nieuw], weekmenu);
    setReceptForm({ naam: "", keuken: "Nederlands", bereidingstijd: "30", porties: "4", beschrijving: "", kcal: "", koolhydraten: "", eiwitten: "", vetten: "", ingredienten: [{ naam: "", hoeveelheid: "", eenheid: "g" }], stappen: [""], dieet: [], kamado: { temperatuur: "", hitte: "indirect", rooktijd: "" } });
    setShowReceptForm(false);
    showToast(`✅ ${nieuw.naam} toegevoegd`);
  }

  function verwijderRecept(id) {
    if (!window.confirm("Recept verwijderen?")) return;
    const nextWeekmenu = {};
    Object.entries(weekmenu).forEach(([k, v]) => { if (v !== id) nextWeekmenu[k] = v; });
    persistData(recepten.filter(r => r.id !== id), nextWeekmenu);
    if (actieefReceptId === id) setActieefReceptId(null);
  }

  // ── Weekmenu ──────────────────────────────────────────
  function planRecept(dag, moment, receptId) {
    const key = `${weekStart}|${dag}|${moment}`;
    const next = { ...weekmenu };
    if (receptId) next[key] = receptId;
    else delete next[key];
    persistData(recepten, next);
  }

  function weekKey(dag, moment) {
    return `${weekStart}|${dag}|${moment}`;
  }

  function volgendeWeek() { setWeekStart(datumPlusDagen(weekStart, 7)); }
  function vorigeWeek()   { setWeekStart(datumPlusDagen(weekStart, -7)); }

  // ── Slimme categorie-herkenning voor boodschappen ─────
  function raadCategorie(ingredientNaam, categories) {
    const naam = ingredientNaam.toLowerCase();
    const regels = [
      { cat: "groentekraam",   woorden: ["tomaat","paprika","sla","spinazie","courgette","aubergine","ui","look","knoflook","wortel","broccoli","bloemkool","prei","bonen","erwten","mais","champignon","paddestoel","avocado","komkommer","ijsbergsla","rucola","basilicum","peterselie","koriander","tijm","rozemarijn"] },
      { cat: "viskraam",       woorden: ["zalm","tonijn","kabeljauw","garnaal","mosselen","inktvis","forel","haring","makreel","vis"] },
      { cat: "kaaskraam",      woorden: ["kaas","gouda","brie","camembert","feta","parmezaan","mozzarella","cheddar","ricotta"] },
      { cat: "zuivel_eieren",  woorden: ["melk","room","boter","yoghurt","kwark","ei","eieren","karnemelk","slagroom","creme fraiche"] },
      { cat: "vlees_vis",      woorden: ["kip","rund","varken","lam","gehakt","spek","ham","worst","biefstuk","filet","gehakt","kipfilet","lever","vlees"] },
      { cat: "brood_bakkerij", woorden: ["brood","bloem","meel","gist","baguette","beschuit","crackers","panko","paneermeel"] },
      { cat: "houdbaar",       woorden: ["pasta","rijst","noodles","blik","tomatenpuree","tomatensaus","olijfolie","zonnebloemolie","azijn","sojasaus","wokzaus","suiker","zout","peper","paprikapoeder","kerriepoeder","kurkuma","kaneel","nootmuskaat","laurier","oregano","mosterd","mayonaise","ketchup","honing","stroop","pindakaas","jam","conserven","bonen","kikkererwten","linzen","noten","amandelen","walnoten","cashew","rozijnen","gedroogd"] },
      { cat: "diepvries",      woorden: ["diepvries","frozen","ijs"] },
      { cat: "dranken",        woorden: ["wijn","bier","water","sap","cola","frisdrank","thee","koffie","melk"] },
      { cat: "drogisterij",    woorden: ["zeep","shampoo","tandpasta"] },
    ];
    for (const regel of regels) {
      if (regel.woorden.some(w => naam.includes(w))) {
        const cat = categories.find(c => c.id === regel.cat);
        if (cat) return cat.id;
      }
    }
    // Fallback: laatste categorie (Overig)
    return categories[categories.length - 1]?.id;
  }

  // ── Boodschappenlijst genereren ───────────────────────
  async function genereerBoodschappen() {
    const gepland = Object.entries(weekmenu)
      .filter(([k]) => k.startsWith(weekStart))
      .map(([,rid]) => recepten.find(r => r.id === rid))
      .filter(Boolean);

    if (gepland.length === 0) { showToast("⚠️ Geen maaltijden gepland deze week"); return; }

    // Samenvoegen van ingrediënten
    const ingredienten = {};
    gepland.forEach(r => {
      const p = porties[r.id] || r.porties || 4;
      const schaal = p / (r.porties || 4);
      (r.ingredienten || []).forEach(i => {
        const key = i.naam.toLowerCase();
        if (!ingredienten[key]) ingredienten[key] = { naam: i.naam, hoeveelheid: 0, eenheid: i.eenheid };
        ingredienten[key].hoeveelheid += (+i.hoeveelheid || 0) * schaal;
      });
    });

    // Check wat er al in Voorraad staat, en trek dat af van wat nog nodig is.
    let alInVoorraad = 0;
    try {
      const voorraadRes = await fetch("/api/voorraad");
      if (voorraadRes.ok) {
        const voorraadData = await voorraadRes.json();
        (voorraadData.items || []).forEach(vItem => {
          const key = Object.keys(ingredienten).find(k =>
            k === vItem.naam.toLowerCase().trim() || vItem.naam.toLowerCase().includes(k)
          );
          if (!key) return;
          const nodig = ingredienten[key];
          if (nodig.eenheid !== vItem.eenheid && !(nodig.eenheid === "stuks" && vItem.eenheid === "stuks")) return;
          if (vItem.hoeveelheid <= 0) return;
          const restant = Math.max(0, nodig.hoeveelheid - vItem.hoeveelheid);
          if (restant < nodig.hoeveelheid) alInVoorraad++;
          if (restant === 0) delete ingredienten[key];
          else nodig.hoeveelheid = restant;
        });
      }
    } catch (e) { /* voorraad-check is optioneel, gaat gewoon door zonder */ }

    const items = Object.values(ingredienten);
    if (items.length === 0) { showToast("✅ Alles al in voorraad, niks toe te voegen"); return; }
    // Stuur naar lijsten tool
    try {
      const res = await fetch("/api/lijsten");
      const data = await res.json();
      const boodschappenLijst = (data.lists || []).find(l => l.name.toLowerCase().includes("boodschappen"));
      if (!boodschappenLijst) { showToast("⚠️ Geen boodschappenlijst gevonden in Lijsten-tool"); return; }

      const nieuweItems = items.map(i => ({
        id: uid(),
        name: i.naam,
        category: raadCategorie(i.naam, boodschappenLijst.categories),
        amount: Math.ceil(i.hoeveelheid) || 1,
        unit: i.eenheid || "stuks",
        checked: false, inCart: false, note: "Van maaltijdplanner",
        addedAt: Date.now(),
      }));

      const updatedList = { ...boodschappenLijst, items: [...boodschappenLijst.items, ...nieuweItems] };
      const updatedLists = data.lists.map(l => l.id === boodschappenLijst.id ? updatedList : l);
      await fetch("/api/lijsten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lists: updatedLists }),
      });
      showToast(`✅ ${items.length} ingrediënten naar boodschappenlijst${alInVoorraad > 0 ? ` (${alInVoorraad} al deels in voorraad, verrekend)` : ""}`);
    } catch (e) { showToast("❌ Kon niet toevoegen aan boodschappenlijst"); }
  }

  // ── AI ────────────────────────────────────────────────
  async function vraagAI() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true); setAiResultaat(null);
    try {
      const tekst = await callAI(
        `Je bent een vriendelijke kookassistent. Antwoord altijd in het Nederlands.
Vraag van de gebruiker: ${aiPrompt}

${aiPrompt.toLowerCase().includes("recept") || aiPrompt.toLowerCase().includes("maak") || aiPrompt.toLowerCase().includes("kook")
  ? `Geef een volledig recept in dit format:
**[Naam recept]**
⏱ Bereidingstijd: [X minuten]
👥 Porties: [X personen]
🔥 Calorieën: [X kcal per portie]

**Ingrediënten:**
- [hoeveelheid] [ingrediënt]
(alle ingrediënten)

**Bereiding:**
1. [stap]
2. [stap]
(alle stappen)

**Tips:** [1-2 handige tips]`
  : "Geef een helder en praktisch antwoord."}`,
        "maaltijden-ai-kok"
      );
      setAiResultaat(tekst);
    } catch (e) { setAiResultaat(`❌ ${e.message}`); }
    setAiLoading(false);
  }

  // Stelt op basis van de bestaande receptenbibliotheek een gevarieerd
  // weekmenu voor (verschillende keukens, niet 3x hetzelfde) en plant dat
  // meteen in als diner voor de huidige week.
  async function stelWeekmenuVoor() {
    if (recepten.length < 3) { showToast("⚠️ Voeg eerst een paar recepten toe voor een zinvolle suggestie"); return; }
    setWeekSuggestieLoading(true);
    try {
      const bibliotheek = recepten.map(r => `${r.naam} (${r.keuken || "Overig"})`).join("\n");
      const tekst = await callAI(
        `Hier is een receptenbibliotheek (naam en keukentype):\n${bibliotheek}\n\n` +
        `Stel een gevarieerd weekmenu voor het diner voor, één recept per dag voor Maandag t/m Zondag, gekozen UIT bovenstaande lijst. ` +
        `Zorg voor variatie in keukentype (niet meerdere dagen achter elkaar dezelfde keuken). ` +
        `Geef ALLEEN een JSON-object terug, zonder uitleg of markdown, in dit exacte formaat: ` +
        `{"Maandag":"receptnaam","Dinsdag":"receptnaam","Woensdag":"receptnaam","Donderdag":"receptnaam","Vrijdag":"receptnaam","Zaterdag":"receptnaam","Zondag":"receptnaam"}. ` +
        `Gebruik de namen exact zoals ze in de bibliotheek staan.`,
        "maaltijden-weekmenu-suggestie"
      );
      const schoon = tekst.replace(/```json|```/g, "").trim();
      const suggestie = JSON.parse(schoon);
      const nieuweWeekmenu = { ...weekmenu };
      let aantalGepland = 0;
      DAGEN.forEach(dag => {
        const naam = suggestie[dag];
        if (!naam) return;
        const match = recepten.find(r => r.naam.toLowerCase() === naam.toLowerCase());
        if (match) {
          nieuweWeekmenu[`${weekStart}|${dag}|Diner`] = match.id;
          aantalGepland++;
        }
      });
      persistData(recepten, nieuweWeekmenu);
      showToast(`✅ ${aantalGepland} dagen ingepland`);
      setShowWeekSuggestie(false);
    } catch (e) {
      showToast("❌ Kon geen weekmenu voorstellen, probeer opnieuw");
    }
    setWeekSuggestieLoading(false);
  }

  async function importeerAIRecept() {
    if (!aiResultaat) return;
    try {
      const tekst = await callAI(
        `Zet dit recept om naar JSON. Geef ALLEEN geldige JSON terug, niets anders:
${aiResultaat}

Format:
{
  "naam": "...",
  "keuken": "...",
  "bereidingstijd": 30,
  "porties": 4,
  "kcal": 0,
  "beschrijving": "...",
  "ingredienten": [{"naam": "...", "hoeveelheid": "100", "eenheid": "g"}],
  "stappen": ["stap 1", "stap 2"]
}`,
        "maaltijden-ai-kok-import"
      );
      const clean = tekst.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      slaReceptOp(parsed);
    } catch (e) { showToast("❌ Kon recept niet importeren — kopieer handmatig"); }
  }

  // Zet elke foto (ook HEIC vanaf iPhone-bibliotheek) om naar een gecomprimeerde
  // JPEG via canvas, zodat de AI-API 'm altijd kan lezen — ongeacht bronformaat.
  async function comprimeerFoto(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1400;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Kon foto niet lezen")); };
      img.src = url;
    });
  }

  async function importeerViaFoto(file) {
    if (!file) return;
    setImportFotoLoading(true);
    setImportFout(null);
    try {
      const base64 = await comprimeerFoto(file);
      const type = "image/jpeg";

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Dit is een foto van een receptpagina uit een kookboek of tijdschrift.
Extraheer het volledige recept en geef het terug als JSON.
Geef ALLEEN geldige JSON terug, geen uitleg of markdown backticks.

Format:
{
  "naam": "naam van het recept",
  "keuken": "type keuken",
  "bereidingstijd": 30,
  "porties": 4,
  "kcal": 0,
  "beschrijving": "korte beschrijving of ondertitel",
  "ingredienten": [{"naam": "ingrediënt", "hoeveelheid": "100", "eenheid": "g"}],
  "stappen": ["stap 1", "stap 2"]
}

Als er geen leesbaar recept op de foto staat: {"fout": "Geen recept leesbaar"}`,
          imageBase64: base64,
          bron: "maaltijden-foto-import",
          imageType: type,
          maxTokens: 2000,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI mislukt");

      const clean = data.text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (parsed.fout) throw new Error(parsed.fout);
      slaReceptOp(parsed);
    } catch (e) {
      setImportFout(e.message);
    }
    setImportFotoLoading(false);
  }

  async function importeerViaLink() {
    if (!importUrl.trim()) return;
    setImportLinkLoading(true);
    setImportFout(null);
    try {
      const res = await fetch("/api/recept-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import mislukt");
      slaReceptOp(data.recept);
      setImportUrl("");
    } catch (e) {
      setImportFout(e.message);
    }
    setImportLinkLoading(false);
  }

  function slaReceptOp(parsed) {
    const nieuw = { ...parsed, id: uid(), aangemaaktOp: Date.now() };
    persistData([...recepten, nieuw], weekmenu);
    showToast(`✅ "${nieuw.naam}" toegevoegd`);
    setAiResultaat(null);
    setAiPrompt("");
    setImportFout(null);
    setTab("recepten");
  }

  // ── Recept schalen ────────────────────────────────────
  function geschaaldHoeveelheid(recept, ingredient) {
    const p = porties[recept.id] || recept.porties || 4;
    const schaal = p / (recept.porties || 4);
    const h = (+ingredient.hoeveelheid || 0) * schaal;
    return h % 1 === 0 ? h : h.toFixed(1);
  }

  // ── Recept bewerken ───────────────────────────────────
  function updateRecept(id, fields) {
    persistData(recepten.map(r => r.id === id ? { ...r, ...fields } : r), weekmenu);
  }

  // ── Voorraad-koppeling ─────────────────────────────────
  // Trekt de ingrediënten van een gemaakt recept (geschaald naar het aantal
  // porties) af van de Voorraad-tool, op basis van naam-overeenkomst.
  async function trekAfVanVoorraad(recept, aantalPorties) {
    try {
      const res = await fetch("/api/voorraad");
      if (!res.ok) return { bijgewerkt: 0 };
      const data = await res.json();
      const items = data.items || [];
      const schaal = aantalPorties / (recept.porties || 4);
      let bijgewerkt = 0;

      const nieuweItems = items.map(item => {
        const match = (recept.ingredienten || []).find(ing =>
          ing.naam.toLowerCase().trim() === item.naam.toLowerCase().trim() ||
          item.naam.toLowerCase().includes(ing.naam.toLowerCase().trim())
        );
        if (!match) return item;
        const gebruikt = (+match.hoeveelheid || 0) * schaal;
        // Alleen zinvol aftrekken als de eenheden overeenkomen of het om stuks gaat
        if (match.eenheid !== item.eenheid && !(match.eenheid === "stuks" && item.eenheid === "stuks")) return item;
        bijgewerkt++;
        return { ...item, hoeveelheid: Math.max(0, Math.round((item.hoeveelheid - gebruikt) * 100) / 100), lastActionBy: huidigeGebruiker, lastActionAt: Date.now() };
      });

      if (bijgewerkt > 0) {
        await fetch("/api/voorraad", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: nieuweItems }),
        });
      }
      return { bijgewerkt };
    } catch (e) {
      console.error("Voorraad bijwerken mislukt", e);
      return { bijgewerkt: 0 };
    }
  }

  // Markeert een gepland recept als gemaakt: logt een kookdagboek-aantekening
  // en trekt de gebruikte ingrediënten af van de Voorraad-tool.
  async function markeerGemaakt(recept, notitie = "", datum = vandaagStr()) {
    const p = porties[recept.id] || recept.porties || 4;
    const entry = { id: uid(), datum, notitie, door: huidigeGebruiker };
    updateRecept(recept.id, { dagboek: [...(recept.dagboek || []), entry] });
    const { bijgewerkt } = await trekAfVanVoorraad(recept, p);
    showToast(bijgewerkt > 0 ? `✅ Gemaakt! ${bijgewerkt} ingrediënt(en) van voorraad afgeboekt` : "✅ Gemaakt! (geen overeenkomende voorraad gevonden)");
  }

  function verwijderDagboekEntry(receptId, entryId) {
    const r = recepten.find(x => x.id === receptId);
    updateRecept(receptId, { dagboek: (r.dagboek || []).filter(e => e.id !== entryId) });
  }

  // "Vaakst gemaakt" / "lang niet gemaakt" — afgeleid uit het kookdagboek.
  function receptStats(recept) {
    const log = recept.dagboek || [];
    if (log.length === 0) return { aantal: 0, laatste: null, langNietGemaakt: false };
    const laatste = log.map(e => e.datum).sort().slice(-1)[0];
    const dagenGeleden = Math.round((new Date(vandaagStr()) - new Date(laatste)) / (1000*60*60*24));
    return { aantal: log.length, laatste, langNietGemaakt: dagenGeleden > 60 };
  }

  function updateIngredient(receptId, idx, fields) {
    const r = recepten.find(x => x.id === receptId);
    if (!r) return;
    const ing = [...(r.ingredienten || [])];
    ing[idx] = { ...ing[idx], ...fields };
    updateRecept(receptId, { ingredienten: ing });
  }

  function verwijderIngredient(receptId, idx) {
    const r = recepten.find(x => x.id === receptId);
    if (!r) return;
    const ing = (r.ingredienten || []).filter((_, i) => i !== idx);
    updateRecept(receptId, { ingredienten: ing });
  }

  function voegIngredientToe(receptId) {
    const r = recepten.find(x => x.id === receptId);
    if (!r) return;
    updateRecept(receptId, { ingredienten: [...(r.ingredienten || []), { naam: "", hoeveelheid: "", eenheid: "g" }] });
  }

  function updateStap(receptId, idx, tekst) {
    const r = recepten.find(x => x.id === receptId);
    if (!r) return;
    const stappen = [...(r.stappen || [])];
    stappen[idx] = tekst;
    updateRecept(receptId, { stappen });
  }

  function verwijderStap(receptId, idx) {
    const r = recepten.find(x => x.id === receptId);
    if (!r) return;
    updateRecept(receptId, { stappen: (r.stappen || []).filter((_, i) => i !== idx) });
  }

  function voegStapToe(receptId) {
    const r = recepten.find(x => x.id === receptId);
    if (!r) return;
    updateRecept(receptId, { stappen: [...(r.stappen || []), ""] });
  }

  if (loading) return (
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <span style={{ fontSize: 40 }}>🍽️</span>
        <div style={{ display: "flex", gap: 6 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.orange, opacity: 0.3, animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}`}</style>
      </div>
    </div>
  );

  const actieefRecept = recepten.find(r => r.id === actieefReceptId);
  let gefilterd = zoekterm
    ? recepten.filter(r => r.naam.toLowerCase().includes(zoekterm.toLowerCase()) || r.keuken?.toLowerCase().includes(zoekterm.toLowerCase()))
    : recepten;
  if (dieetFilter) gefilterd = gefilterd.filter(r => (r.dieet||[]).includes(dieetFilter));

  // Groepeer op keuken (leidende categorie), in de vaste KEUKENS-volgorde;
  // onbekende/legacy keuken-waardes komen als eigen groep achteraan.
  const bekendeKeukens = KEUKENS.filter(k => gefilterd.some(r => (r.keuken || "Overig") === k));
  const onbekendeKeukens = [...new Set(gefilterd.map(r => r.keuken || "Overig").filter(k => !KEUKENS.includes(k)))].sort();
  const receptenPerKeuken = [...bekendeKeukens, ...onbekendeKeukens].map(keuken => ({
    keuken,
    recepten: gefilterd.filter(r => (r.keuken || "Overig") === keuken),
  }));

  // ════════════════════════
  // RECEPT DETAIL
  // ════════════════════════
  if (actieefRecept) {
    const p = porties[actieefRecept.id] || actieefRecept.porties || 4;
    const bewerkModus = !!bewerkReceptId;

    return (
      <div style={S.appBg}>
        {toast && <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", background:C.orange, color:"#FFF", padding:"9px 20px", borderRadius:10, fontWeight:700, zIndex:999, fontSize:13 }}>{toast}</div>}
        <header style={{ ...S.header, alignItems: "center" }}>
          <button style={{ background:"none", border:"none", cursor:"pointer" }} onClick={() => { setActieefReceptId(null); setBewerkReceptId(null); }}>
            <ChevronLeft size={20} color={C.orange} />
          </button>
          {bewerkModus
            ? <input style={{ ...S.inp, flex:1, margin:"0 8px", fontSize:15, fontWeight:700, padding:"8px 12px" }}
                value={actieefRecept.naam}
                onChange={e => updateRecept(actieefRecept.id, { naam: e.target.value })} />
            : <h1 style={{ ...S.title, fontSize: 18, margin: 0, flex:1, textAlign:"center" }}>{actieefRecept.naam}</h1>
          }
          <button style={{ background: bewerkModus ? C.orange : C.card, color: bewerkModus ? "#FFF" : C.orange, border:`1px solid ${bewerkModus ? C.orange : C.border}`, borderRadius:10, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}
            onClick={() => { setBewerkReceptId(bewerkModus ? null : actieefRecept.id); if (bewerkModus) showToast("✅ Wijzigingen opgeslagen"); }}>
            {bewerkModus ? "Klaar" : "✏️ Bewerk"}
          </button>
        </header>

        {!bewerkModus && (
          <div style={{ display:"flex", gap:8, padding:"0 20px 12px" }}>
            <button style={{ ...S.btn(C.orange), flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, fontSize:13 }}
              onClick={() => { setKookStapIndex(0); setKookTimerSec(0); setKookTimerLopend(false); setKookModusActief(true); }}>
              🍳 Kookmodus
            </button>
            <button style={{ ...S.btn(C.card, C.green), border:`1px solid ${C.border}`, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, fontSize:13 }}
              onClick={() => { setDagboekNotitie(""); setShowDagboekForm(true); }}>
              ✅ Markeer gemaakt
            </button>
          </div>
        )}

        <main style={S.main}>
          {/* Meta — bewerkbaar */}
          {bewerkModus ? (
            <div style={{ ...S.card, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Keuken</label>
                <select style={{ ...S.inp, padding:"8px 10px" }} value={actieefRecept.keuken||""}
                  onChange={e => updateRecept(actieefRecept.id, { keuken: e.target.value })}>
                  {KEUKENS.map(k => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Bereidingstijd (min)</label>
                <input style={{ ...S.inp, padding:"8px 10px" }} type="number" value={actieefRecept.bereidingstijd||""}
                  onChange={e => updateRecept(actieefRecept.id, { bereidingstijd: +e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Porties</label>
                <input style={{ ...S.inp, padding:"8px 10px" }} type="number" value={actieefRecept.porties||""}
                  onChange={e => updateRecept(actieefRecept.id, { porties: +e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Calorieën (kcal)</label>
                <input style={{ ...S.inp, padding:"8px 10px" }} type="number" value={actieefRecept.kcal||""}
                  onChange={e => updateRecept(actieefRecept.id, { kcal: +e.target.value })} />
              </div>
              <div style={{ gridColumn:"span 2" }}>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Beschrijving</label>
                <textarea style={{ ...S.inp, height:56, resize:"none", padding:"8px 10px" }} value={actieefRecept.beschrijving||""}
                  onChange={e => updateRecept(actieefRecept.id, { beschrijving: e.target.value })} />
              </div>
              <div style={{ gridColumn:"span 2" }}>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>Dieet</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {DIEET_TAGS.map(tag => {
                    const actief = (actieefRecept.dieet||[]).includes(tag);
                    return (
                      <button key={tag} style={{ border:`2px solid ${actief?C.green:C.border}`, background:actief?C.green:"transparent", color:actief?"#FFF":C.muted, borderRadius:20, padding:"5px 12px", fontSize:12, cursor:"pointer" }}
                        onClick={() => updateRecept(actieefRecept.id, { dieet: actief ? actieefRecept.dieet.filter(t=>t!==tag) : [...(actieefRecept.dieet||[]), tag] })}>
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
              {actieefRecept.keuken === "Kamado" && (
                <div style={{ gridColumn:"span 2", background:"#FFF", borderRadius:10, padding:10 }}>
                  <p style={{ fontSize:12, fontWeight:700, color:C.orange, margin:"0 0 8px" }}>🔥 Kamado-instellingen</p>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                    <input style={{ ...S.inp, padding:"8px 10px" }} placeholder="Temperatuur (°C)" type="number"
                      value={actieefRecept.kamado?.temperatuur||""} onChange={e => updateRecept(actieefRecept.id, { kamado:{...(actieefRecept.kamado||{}),temperatuur:e.target.value} })} />
                    <input style={{ ...S.inp, padding:"8px 10px" }} placeholder="Rooktijd (min)" type="number"
                      value={actieefRecept.kamado?.rooktijd||""} onChange={e => updateRecept(actieefRecept.id, { kamado:{...(actieefRecept.kamado||{}),rooktijd:e.target.value} })} />
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    {["direct","indirect"].map(h => (
                      <button key={h} style={{ flex:1, border:`2px solid ${actieefRecept.kamado?.hitte===h?C.orange:C.border}`, background:actieefRecept.kamado?.hitte===h?C.orange:"transparent", color:actieefRecept.kamado?.hitte===h?"#FFF":C.muted, borderRadius:10, padding:"7px 0", fontSize:12, fontWeight:600, cursor:"pointer" }}
                        onClick={() => updateRecept(actieefRecept.id, { kamado:{...(actieefRecept.kamado||{}),hitte:h} })}>
                        {h === "direct" ? "🔥 Direct" : "🌡️ Indirect"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                {[
                  { icon: "⏱", val: `${actieefRecept.bereidingstijd} min` },
                  { icon: "🍽️", val: actieefRecept.keuken },
                  actieefRecept.kcal ? { icon: "🔥", val: `${actieefRecept.kcal} kcal` } : null,
                ].filter(Boolean).map((m, i) => (
                  <span key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 12px", fontSize: 12, color: C.muted }}>
                    {m.icon} {m.val}
                  </span>
                ))}
              </div>
              {(actieefRecept.dieet||[]).length > 0 && (
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                  {actieefRecept.dieet.map(tag => (
                    <span key={tag} style={{ background:`${C.green}18`, color:C.green, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{tag}</span>
                  ))}
                </div>
              )}
              {actieefRecept.keuken === "Kamado" && (actieefRecept.kamado?.temperatuur || actieefRecept.kamado?.rooktijd) && (
                <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:10, fontSize:12, color:C.muted }}>
                  {actieefRecept.kamado?.temperatuur && <span>🌡️ {actieefRecept.kamado.temperatuur}°C</span>}
                  {actieefRecept.kamado?.hitte && <span>{actieefRecept.kamado.hitte === "direct" ? "🔥 Direct" : "🌡️ Indirect"}</span>}
                  {actieefRecept.kamado?.rooktijd && <span>💨 {actieefRecept.kamado.rooktijd} min roken</span>}
                </div>
              )}
              {actieefRecept.beschrijving && <p style={{ fontSize: 14, color: C.muted, marginBottom: 14 }}>{actieefRecept.beschrijving}</p>}
            </>
          )}

          {/* Beoordeling per persoon */}
          <div style={S.card}>
            {["Pepijn","Tessa"].map(naam => (
              <div key={naam} style={{ display:"flex", alignItems:"center", gap:10, marginBottom: naam==="Pepijn" ? 8 : 0 }}>
                <span style={{ fontSize:13, color:C.muted, width:56 }}>{naam}</span>
                <div style={{ display:"flex", gap:2 }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, padding:2 }}
                      onClick={() => updateRecept(actieefRecept.id, { beoordelingen: { ...(actieefRecept.beoordelingen||{Pepijn:0,Tessa:0}), [naam]: n === ((actieefRecept.beoordelingen?.[naam])||0) ? 0 : n } })}>
                      {n <= ((actieefRecept.beoordelingen?.[naam])||0) ? "⭐" : "☆"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Porties schuif (alleen leesmodus) */}
          {!bewerkModus && (
            <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 14, marginBottom:12 }}>
              <Users size={16} color={C.muted} />
              <span style={{ fontSize: 14, flex: 1 }}>Porties</span>
              <button style={{ ...S.btn(C.card, C.text), border: `1px solid ${C.border}`, padding: "6px 14px", fontSize: 18 }}
                onClick={() => setPorties(prev => ({ ...prev, [actieefRecept.id]: Math.max(1, p - 1) }))}>−</button>
              <span style={{ fontSize: 16, fontWeight: 700, minWidth: 24, textAlign: "center" }}>{p}</span>
              <button style={{ ...S.btn(C.card, C.text), border: `1px solid ${C.border}`, padding: "6px 14px", fontSize: 18 }}
                onClick={() => setPorties(prev => ({ ...prev, [actieefRecept.id]: p + 1 }))}>+</button>
            </div>
          )}

          {/* Ingrediënten */}
          <div style={S.card}>
            <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>🛒 Ingrediënten</h3>
            {(actieefRecept.ingredienten || []).map((ing, i) => (
              bewerkModus ? (
                <div key={i} style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
                  <input style={{ ...S.inp, flex:2, padding:"7px 10px", fontSize:13 }} placeholder="Naam"
                    value={ing.naam} onChange={e => updateIngredient(actieefRecept.id, i, { naam: e.target.value })} />
                  <input style={{ ...S.inp, flex:1, padding:"7px 8px", fontSize:13 }} placeholder="Hoev." type="number"
                    value={ing.hoeveelheid} onChange={e => updateIngredient(actieefRecept.id, i, { hoeveelheid: e.target.value })} />
                  <select style={{ ...S.inp, flex:1, padding:"7px 6px", fontSize:12 }}
                    value={ing.eenheid} onChange={e => updateIngredient(actieefRecept.id, i, { eenheid: e.target.value })}>
                    {["g","kg","ml","l","el","tl","stuks","plak","teen","bos","snuf","pak"].map(u=><option key={u}>{u}</option>)}
                  </select>
                  <button style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", color:C.red, fontSize:16 }}
                    onClick={() => verwijderIngredient(actieefRecept.id, i)}>×</button>
                </div>
              ) : (
                <div key={i} style={{ display: "flex", padding: "7px 0", borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                  <span style={{ flex: 1, fontSize: 14 }}>{ing.naam}</span>
                  <span style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>
                    {geschaaldHoeveelheid(actieefRecept, ing)} {ing.eenheid}
                  </span>
                </div>
              )
            ))}
            {bewerkModus && (
              <button style={{ ...S.btn(C.card, C.orange), border:`1px solid ${C.border}`, fontSize:13, padding:"8px 14px", marginTop:4 }}
                onClick={() => voegIngredientToe(actieefRecept.id)}>
                + Ingrediënt toevoegen
              </button>
            )}
          </div>

          {/* Bereidingsstappen */}
          <div style={S.card}>
            <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>👨‍🍳 Bereiding</h3>
            {(actieefRecept.stappen || []).map((stap, i) => (
              bewerkModus ? (
                <div key={i} style={{ display:"flex", gap:8, marginBottom:8, alignItems:"flex-start" }}>
                  <div style={{ width:24, height:24, minWidth:24, borderRadius:"50%", background:C.orange, color:"#FFF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, marginTop:8 }}>{i+1}</div>
                  <textarea style={{ ...S.inp, flex:1, height:64, resize:"none", fontSize:13, padding:"8px 10px" }}
                    value={stap} onChange={e => updateStap(actieefRecept.id, i, e.target.value)} />
                  <button style={{ background:"none", border:"none", cursor:"pointer", padding:"8px 4px", color:C.red, fontSize:16 }}
                    onClick={() => verwijderStap(actieefRecept.id, i)}>×</button>
                </div>
              ) : (
                <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ width: 26, height: 26, minWidth: 26, borderRadius: "50%", background: C.orange, color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{i+1}</div>
                  <p style={{ flex: 1, fontSize: 14, margin: 0, lineHeight: 1.5 }}>{stap}</p>
                </div>
              )
            ))}
            {bewerkModus && (
              <button style={{ ...S.btn(C.card, C.orange), border:`1px solid ${C.border}`, fontSize:13, padding:"8px 14px", marginTop:4 }}
                onClick={() => voegStapToe(actieefRecept.id)}>
                + Stap toevoegen
              </button>
            )}
          </div>

          {/* Notities (bewerkbaar) */}
          {bewerkModus && (
            <div style={S.card}>
              <h3 style={{ margin:"0 0 8px", fontSize:14, fontWeight:700 }}>📝 Persoonlijke notities</h3>
              <textarea style={{ ...S.inp, height:80, resize:"none", fontSize:13 }}
                placeholder="Jouw aanpassingen, tips, variaties… (bv. 'minder zout', 'extra knoflook', 'vervang kip door tofu')"
                value={actieefRecept.notities||""}
                onChange={e => updateRecept(actieefRecept.id, { notities: e.target.value })} />
            </div>
          )}

          {/* Notities lezen */}
          {!bewerkModus && actieefRecept.notities && (
            <div style={{ ...S.card, background:`${C.orange}12`, border:`1px solid ${C.border}` }}>
              <h3 style={{ margin:"0 0 6px", fontSize:13, fontWeight:700, color:C.orange }}>📝 Mijn aanpassingen</h3>
              <p style={{ fontSize:13, color:C.text, margin:0, lineHeight:1.6 }}>{actieefRecept.notities}</p>
            </div>
          )}

          {/* Kookdagboek */}
          <div style={S.card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <h3 style={{ margin:0, fontSize:14, fontWeight:700 }}>📔 Kookdagboek</h3>
              {(() => {
                const stats = receptStats(actieefRecept);
                return stats.aantal > 0 ? (
                  <span style={{ fontSize:11, color:C.muted }}>
                    {stats.aantal}x gemaakt{stats.langNietGemaakt ? " · 💤 lang niet gemaakt" : ""}
                  </span>
                ) : null;
              })()}
            </div>
            {(actieefRecept.dagboek||[]).length === 0 ? (
              <p style={{ fontSize:12, color:C.muted, margin:0 }}>Nog geen aantekeningen. Tik "Markeer gemaakt" na het koken.</p>
            ) : [...actieefRecept.dagboek].sort((a,b) => b.datum.localeCompare(a.datum)).map(entry => (
              <div key={entry.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ flex:1 }}>
                  <p style={{ margin:"0 0 2px", fontSize:12, fontWeight:700, color:C.muted }}>
                    {entry.datum}{entry.door ? ` · ${entry.door}` : ""}
                  </p>
                  {entry.notitie && <p style={{ margin:0, fontSize:13, color:C.text }}>{entry.notitie}</p>}
                </div>
                <button onClick={() => verwijderDagboekEntry(actieefRecept.id, entry.id)}
                  style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, padding:2 }}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Verwijder knop onderaan */}
          {bewerkModus && (
            <button style={{ ...S.btn(C.card, C.red), border:`1px solid ${C.red}44`, width:"100%", marginTop:8 }}
              onClick={() => verwijderRecept(actieefRecept.id)}>
              🗑 Recept verwijderen
            </button>
          )}
        </main>

        {/* Markeer gemaakt — optionele aantekening */}
        {showDagboekForm && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)", zIndex:200, display:"flex", alignItems:"flex-end" }}
            onClick={() => setShowDagboekForm(false)}>
            <div style={{ background:"#FFF", width:"100%", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20 }} onClick={e => e.stopPropagation()}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <p style={{ margin:0, fontWeight:700, fontSize:16, color:C.green }}>✅ Markeer als gemaakt</p>
                <button onClick={() => setShowDagboekForm(false)} aria-label="Sluiten" style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                  <X size={20} color={C.muted} />
                </button>
              </div>
              <p style={{ fontSize:12, color:C.muted, margin:"0 0 8px" }}>
                Ingrediënten worden (waar mogelijk) van je Voorraad afgeboekt.
              </p>
              <textarea style={{ ...S.inp, height:70, resize:"none", marginBottom:16 }} placeholder="Aantekening (optioneel, bv. 'iets te zout, minder zout volgende keer')"
                value={dagboekNotitie} onChange={e => setDagboekNotitie(e.target.value)} autoFocus />
              <button style={{ ...S.btn(C.green), width:"100%" }}
                onClick={() => { markeerGemaakt(actieefRecept, dagboekNotitie); setShowDagboekForm(false); }}>
                Opslaan
              </button>
            </div>
          </div>
        )}

        {/* Kookmodus — stap voor stap met timer */}
        {kookModusActief && (() => {
          const stap = actieefRecept.stappen[kookStapIndex];
          const stapMinuten = minutenUitStap(stap || "");
          const laatsteStap = kookStapIndex === actieefRecept.stappen.length - 1;
          return (
            <div style={{ position:"fixed", inset:0, background:"#1A120A", zIndex:300, display:"flex", flexDirection:"column", color:"#FFF" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 20px 10px" }}>
                <span style={{ fontSize:13, opacity:0.7 }}>Stap {kookStapIndex + 1} / {actieefRecept.stappen.length}</span>
                <button onClick={() => { setKookModusActief(false); setKookTimerLopend(false); }} aria-label="Sluiten"
                  style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:"50%", width:32, height:32, cursor:"pointer", color:"#FFF" }}>
                  <X size={16} color="#FFF" style={{ margin:"auto" }} />
                </button>
              </div>

              <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 28px", textAlign:"center" }}>
                <p style={{ fontSize:22, lineHeight:1.5, fontWeight:600, margin:"0 0 24px" }}>{stap}</p>

                {stapMinuten && (
                  <div style={{ marginTop:8 }}>
                    {kookTimerSec > 0 ? (
                      <>
                        <p style={{ fontSize:44, fontWeight:800, margin:"0 0 12px", fontVariantNumeric:"tabular-nums" }}>
                          {String(Math.floor(kookTimerSec/60)).padStart(2,"0")}:{String(kookTimerSec%60).padStart(2,"0")}
                        </p>
                        <button style={{ ...S.btn(kookTimerLopend ? "#8B4513" : C.orange), padding:"10px 24px" }}
                          onClick={() => setKookTimerLopend(l => !l)}>
                          {kookTimerLopend ? "⏸ Pauzeer" : "▶️ Hervat"}
                        </button>
                      </>
                    ) : (
                      <button style={{ ...S.btn(C.orange), padding:"12px 28px", fontSize:15 }}
                        onClick={() => { setKookTimerSec(stapMinuten * 60); setKookTimerLopend(true); }}>
                        ⏱ Start timer ({stapMinuten} min)
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display:"flex", gap:10, padding:20 }}>
                <button style={{ ...S.btn("rgba(255,255,255,.12)", "#FFF"), flex:1, opacity: kookStapIndex===0 ? 0.4 : 1 }}
                  disabled={kookStapIndex===0}
                  onClick={() => { setKookStapIndex(i => i-1); setKookTimerSec(0); setKookTimerLopend(false); }}>
                  ← Vorige
                </button>
                {laatsteStap ? (
                  <button style={{ ...S.btn(C.green), flex:1 }}
                    onClick={() => { setKookModusActief(false); setKookTimerLopend(false); setDagboekNotitie(""); setShowDagboekForm(true); }}>
                    ✅ Klaar!
                  </button>
                ) : (
                  <button style={{ ...S.btn(C.orange), flex:1 }}
                    onClick={() => { setKookStapIndex(i => i+1); setKookTimerSec(0); setKookTimerLopend(false); }}>
                    Volgende →
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // ════════════════════════
  // HOOFD OVERZICHT
  // ════════════════════════
  return (
    <div style={S.appBg}>
      {toast && <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", background:C.orange, color:"#FFF", padding:"9px 20px", borderRadius:10, fontWeight:700, zIndex:999, fontSize:13 }}>{toast}</div>}

      {/* Plan-overlay */}
      {showPlanOverlay && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:100, display:"flex", alignItems:"flex-end" }} onClick={() => { setShowPlanOverlay(false); setPlanZoek(""); }}>
          <div style={{ background:"#FFF", width:"100%", maxHeight:"80vh", overflowY:"auto", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20, boxSizing:"border-box" }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
              <p style={{ margin:0, fontWeight:700, fontSize:15, color:C.orange }}>📅 {planDag} — {planMoment}</p>
              <button onClick={() => { setShowPlanOverlay(false); setPlanZoek(""); }} aria-label="Sluiten"
                style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                <X size={18} color={C.muted} />
              </button>
            </div>
            <input autoFocus style={{ ...S.inp, marginBottom:12, fontSize:14, marginTop: 8 }} placeholder="🔍 Zoek recept…"
              value={planZoek} onChange={e => setPlanZoek(e.target.value)} />
            {weekmenu[weekKey(planDag,planMoment)] && !planZoek && (
              <button style={{ ...S.btn(C.card, C.red), border:`1px solid ${C.red}`, width:"100%", marginBottom:10 }}
                onClick={() => { planRecept(planDag,planMoment,null); setShowPlanOverlay(false); setPlanZoek(""); }}>
                🗑 Verwijder uit menu
              </button>
            )}
            {recepten
              .filter(r => !planZoek || r.naam.toLowerCase().includes(planZoek.toLowerCase()) || r.keuken?.toLowerCase().includes(planZoek.toLowerCase()))
              .map(r => (
                <div key={r.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderTop:`1px solid ${C.border}`, cursor:"pointer" }}
                  onClick={() => { planRecept(planDag,planMoment,r.id); setShowPlanOverlay(false); setPlanZoek(""); showToast(`✅ ${r.naam} ingepland`); }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:C.card, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>🍽️</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600 }}>{r.naam}</div>
                    <div style={{ fontSize:12, color:C.muted }}>{r.bereidingstijd}min · {r.keuken}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* AI weekmenu-suggestie */}
      {showWeekSuggestie && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:100, display:"flex", alignItems:"flex-end" }}
          onClick={() => !weekSuggestieLoading && setShowWeekSuggestie(false)}>
          <div style={{ background:"#FFF", width:"100%", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <p style={{ margin:0, fontWeight:700, fontSize:16, color:C.orange }}>✨ Weekmenu-suggestie</p>
              {!weekSuggestieLoading && (
                <button onClick={() => setShowWeekSuggestie(false)} aria-label="Sluiten" style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                  <X size={20} color={C.muted} />
                </button>
              )}
            </div>
            <p style={{ fontSize:13, color:C.muted, margin:"0 0 16px", lineHeight:1.6 }}>
              De AI-kok kiest 7 gevarieerde diners uit je eigen receptenbibliotheek (verschillende keukens) en plant ze in als diner voor Maandag t/m Zondag van de huidige week.
              Bestaande diner-planningen voor deze week worden overschreven.
            </p>
            <button style={{ ...S.btn(C.orange), width:"100%" }} onClick={stelWeekmenuVoor} disabled={weekSuggestieLoading}>
              {weekSuggestieLoading ? "🤖 Menu wordt bedacht…" : "✨ Weekmenu voorstellen en inplannen"}
            </button>
          </div>
        </div>
      )}

      {/* Recept toevoegen overlay */}
      {showReceptForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:100, display:"flex", alignItems:"flex-end" }} onClick={() => setShowReceptForm(false)}>
          <div style={{ background:"#FFF", width:"100%", maxHeight:"90vh", overflowY:"auto", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20, boxSizing:"border-box" }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <p style={{ margin:0, fontWeight:700, fontSize:16, color:C.orange }}>🍽️ Nieuw recept</p>
              <button onClick={() => setShowReceptForm(false)} aria-label="Sluiten"
                style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                <X size={18} color={C.muted} />
              </button>
            </div>
            <input style={{ ...S.inp, marginBottom:10 }} placeholder="Naam van het recept" value={receptForm.naam} onChange={e => setReceptForm(f=>({...f,naam:e.target.value}))} autoFocus />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
              <select style={S.inp} value={receptForm.keuken} onChange={e => setReceptForm(f=>({...f,keuken:e.target.value}))}>
                {KEUKENS.map(k => <option key={k}>{k}</option>)}
              </select>
              <input style={S.inp} placeholder="Min. bereidingstijd" type="number" value={receptForm.bereidingstijd} onChange={e => setReceptForm(f=>({...f,bereidingstijd:e.target.value}))} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:10 }}>
              <input style={S.inp} placeholder="Porties" type="number" value={receptForm.porties} onChange={e=>setReceptForm(f=>({...f,porties:e.target.value}))} />
              <input style={S.inp} placeholder="Kcal" type="number" value={receptForm.kcal} onChange={e=>setReceptForm(f=>({...f,kcal:e.target.value}))} />
              <input style={S.inp} placeholder="Koolh.g" type="number" value={receptForm.koolhydraten} onChange={e=>setReceptForm(f=>({...f,koolhydraten:e.target.value}))} />
              <input style={S.inp} placeholder="Eiwit g" type="number" value={receptForm.eiwitten} onChange={e=>setReceptForm(f=>({...f,eiwitten:e.target.value}))} />
            </div>
            <textarea style={{ ...S.inp, height:60, resize:"none", marginBottom:12 }} placeholder="Korte beschrijving (optioneel)" value={receptForm.beschrijving} onChange={e=>setReceptForm(f=>({...f,beschrijving:e.target.value}))} />

            {/* Dieet-tags */}
            <p style={{ fontSize:11, color:C.muted, margin:"0 0 6px" }}>Dieet (optioneel)</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
              {DIEET_TAGS.map(tag => {
                const actief = (receptForm.dieet||[]).includes(tag);
                return (
                  <button key={tag} style={{ border:`2px solid ${actief?C.green:C.border}`, background:actief?C.green:"transparent", color:actief?"#FFF":C.muted, borderRadius:20, padding:"5px 12px", fontSize:12, cursor:"pointer", fontWeight:actief?700:400 }}
                    onClick={() => setReceptForm(f => ({ ...f, dieet: actief ? f.dieet.filter(t=>t!==tag) : [...(f.dieet||[]), tag] }))}>
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* Kamado-specifieke velden */}
            {receptForm.keuken === "Kamado" && (
              <div style={{ background:C.card, borderRadius:12, padding:12, marginBottom:12 }}>
                <p style={{ fontSize:12, fontWeight:700, color:C.orange, margin:"0 0 8px" }}>🔥 Kamado-instellingen</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                  <input style={{ ...S.inp, padding:"8px 10px" }} placeholder="Temperatuur (°C)" type="number"
                    value={receptForm.kamado?.temperatuur||""} onChange={e => setReceptForm(f=>({...f,kamado:{...(f.kamado||{}),temperatuur:e.target.value}}))} />
                  <input style={{ ...S.inp, padding:"8px 10px" }} placeholder="Rooktijd (min)" type="number"
                    value={receptForm.kamado?.rooktijd||""} onChange={e => setReceptForm(f=>({...f,kamado:{...(f.kamado||{}),rooktijd:e.target.value}}))} />
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  {["direct","indirect"].map(h => (
                    <button key={h} style={{ flex:1, border:`2px solid ${receptForm.kamado?.hitte===h?C.orange:C.border}`, background:receptForm.kamado?.hitte===h?C.orange:"transparent", color:receptForm.kamado?.hitte===h?"#FFF":C.muted, borderRadius:10, padding:"7px 0", fontSize:12, fontWeight:600, cursor:"pointer", textTransform:"capitalize" }}
                      onClick={() => setReceptForm(f=>({...f,kamado:{...(f.kamado||{}),hitte:h}}))}>
                      {h === "direct" ? "🔥 Directe hitte" : "🌡️ Indirecte hitte"}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p style={{ fontSize:13, fontWeight:700, margin:"0 0 8px" }}>Ingrediënten</p>
            {receptForm.ingredienten.map((ing, i) => (
              <div key={i} style={{ display:"flex", gap:6, marginBottom:6 }}>
                <input style={{ ...S.inp, flex:2 }} placeholder="Naam" value={ing.naam} onChange={e => { const n=[...receptForm.ingredienten]; n[i]={...n[i],naam:e.target.value}; setReceptForm(f=>({...f,ingredienten:n})); }} />
                <input style={{ ...S.inp, flex:1 }} placeholder="Hoeveel" type="number" value={ing.hoeveelheid} onChange={e => { const n=[...receptForm.ingredienten]; n[i]={...n[i],hoeveelheid:e.target.value}; setReceptForm(f=>({...f,ingredienten:n})); }} />
                <select style={{ ...S.inp, flex:1 }} value={ing.eenheid} onChange={e => { const n=[...receptForm.ingredienten]; n[i]={...n[i],eenheid:e.target.value}; setReceptForm(f=>({...f,ingredienten:n})); }}>
                  {["g","kg","ml","l","el","tl","stuks","plak","teen","bos","snuf"].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
            ))}
            <button style={{ ...S.btn(C.card, C.orange), border:`1px solid ${C.border}`, fontSize:13, marginBottom:14, padding:"8px 16px" }}
              onClick={() => setReceptForm(f=>({...f,ingredienten:[...f.ingredienten,{naam:"",hoeveelheid:"",eenheid:"g"}]}))}>
              + Ingrediënt
            </button>
            <p style={{ fontSize:13, fontWeight:700, margin:"0 0 8px" }}>Bereidingsstappen</p>
            {receptForm.stappen.map((stap, i) => (
              <div key={i} style={{ display:"flex", gap:8, marginBottom:8, alignItems:"flex-start" }}>
                <div style={{ width:26, height:26, borderRadius:"50%", background:C.orange, color:"#FFF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0, marginTop:8 }}>{i+1}</div>
                <textarea style={{ ...S.inp, flex:1, height:56, resize:"none" }} placeholder={`Stap ${i+1}`} value={stap} onChange={e => { const n=[...receptForm.stappen]; n[i]=e.target.value; setReceptForm(f=>({...f,stappen:n})); }} />
              </div>
            ))}
            <button style={{ ...S.btn(C.card, C.orange), border:`1px solid ${C.border}`, fontSize:13, marginBottom:16, padding:"8px 16px" }}
              onClick={() => setReceptForm(f=>({...f,stappen:[...f.stappen,""]}))}>
              + Stap
            </button>
            <div style={{ display:"flex", gap:10 }}>
              <button style={{ ...S.btn(C.card, C.text), border:`1px solid ${C.border}`, flex:1 }} onClick={() => setShowReceptForm(false)}>Annuleer</button>
              <button style={{ ...S.btn(), flex:2 }} onClick={voegReceptToe}>Recept opslaan</button>
            </div>
          </div>
        </div>
      )}

      <header style={S.header}>
        <div>
          <Link href="/" style={S.switchBtn}>← Overzicht</Link>
          <h1 style={S.title}>🍽️ Maaltijden</h1>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, background:"#FFFFFF", borderRadius:12, margin:"0 20px 16px", border:`1px solid ${C.border}`, padding:"4px" }}>
        {[["week","📅 Week"],["recepten","📚 Recepten"],["ai","🤖 AI Kok"]].map(([t,l]) => (
          <button key={t} style={S.tabBtn(tab===t)} onClick={()=>setTab(t)}>{l}</button>
        ))}
      </div>

      <main style={S.main}>
        {/* ── WEEKPLANNING ── */}
        {tab === "week" && (
          <>
            {/* Week navigatie */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <button style={{ ...S.btn(C.card, C.text), border:`1px solid ${C.border}`, padding:"8px 14px" }} onClick={vorigeWeek}>‹</button>
              <span style={{ fontSize:14, fontWeight:700, color:C.orange }}>Week van {weekStart}</span>
              <button style={{ ...S.btn(C.card, C.text), border:`1px solid ${C.border}`, padding:"8px 14px" }} onClick={volgendeWeek}>›</button>
            </div>

            {DAGEN.map((dag, dagIdx) => {
              const dagDatumStr = datumPlusDagen(weekStart, dagIdx);
              const isVandaag = dagDatumStr === vandaagStr();
              return (
                <div key={dag} style={{ ...S.card, border: isVandaag ? `2px solid ${C.orange}` : `1px solid ${C.border}` }}>
                  <div style={{ fontWeight:700, fontSize:14, color:isVandaag?C.orange:C.text, marginBottom:8 }}>
                    {dag} {isVandaag && <span style={{ fontSize:11, background:`${C.orange}22`, borderRadius:10, padding:"2px 8px" }}>Vandaag</span>}
                  </div>
                  {MAALTIJDMOMENTEN.map(moment => {
                    const key = weekKey(dag, moment);
                    const recept = recepten.find(r => r.id === weekmenu[key]);
                    const alGemaaktVandaag = recept && (recept.dagboek || []).some(e => e.datum === dagDatumStr);
                    return (
                      <div key={moment} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderTop:`1px solid ${C.border}` }}>
                        <span style={{ fontSize:12, color:C.muted, width:56, cursor:"pointer" }}
                          onClick={() => { setPlanDag(dag); setPlanMoment(moment); setShowPlanOverlay(true); }}>{moment}</span>
                        {recept
                          ? <span style={{ flex:1, fontSize:13, fontWeight:600, color:C.text, cursor:"pointer" }}
                              onClick={() => { setPlanDag(dag); setPlanMoment(moment); setShowPlanOverlay(true); }}>{recept.naam}</span>
                          : <span style={{ flex:1, fontSize:13, color:C.muted, cursor:"pointer", fontStyle:"italic" }}
                              onClick={() => { setPlanDag(dag); setPlanMoment(moment); setShowPlanOverlay(true); }}>+ Plannen</span>}
                        {recept && <span style={{ fontSize:11, color:C.muted }}>⏱{recept.bereidingstijd}m</span>}
                        {recept && (
                          <button onClick={() => markeerGemaakt(recept, "", dagDatumStr)} disabled={alGemaaktVandaag}
                            title={alGemaaktVandaag ? "Al gemaakt op deze dag" : "Markeer als gemaakt"}
                            style={{ background:"none", border:"none", cursor: alGemaaktVandaag ? "default" : "pointer", fontSize:16, padding:2, opacity: alGemaaktVandaag ? 1 : 0.4 }}>
                            {alGemaaktVandaag ? "✅" : "⬜"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <button style={{ ...S.btn(C.card, C.orange), border:`1px solid ${C.border}`, width:"100%", marginTop:8, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
              onClick={() => setShowWeekSuggestie(true)}>
              ✨ Stel weekmenu voor met AI
            </button>
            <button style={{ ...S.btn(), width:"100%", marginTop:8, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
              onClick={genereerBoodschappen}>
              <ShoppingCart size={16} color="#FFF" />
              Naar boodschappenlijst
            </button>
          </>
        )}

        {/* ── RECEPTEN ── */}
        {tab === "recepten" && (
          <>
            <input style={{ ...S.inp, marginBottom:10 }} placeholder="🔍 Zoek recept…" value={zoekterm} onChange={e=>setZoekterm(e.target.value)} />
            <div style={{ display:"flex", gap:6, overflowX:"auto", marginBottom:14, paddingBottom:2 }}>
              <button style={{ border:`1px solid ${!dieetFilter?C.orange:C.border}`, background:!dieetFilter?C.orange:"#FFF", color:!dieetFilter?"#FFF":C.muted, borderRadius:20, padding:"5px 12px", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}
                onClick={() => setDieetFilter(null)}>Alles</button>
              {DIEET_TAGS.map(tag => (
                <button key={tag} style={{ border:`1px solid ${dieetFilter===tag?C.green:C.border}`, background:dieetFilter===tag?C.green:"#FFF", color:dieetFilter===tag?"#FFF":C.muted, borderRadius:20, padding:"5px 12px", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}
                  onClick={() => setDieetFilter(dieetFilter===tag?null:tag)}>{tag}</button>
              ))}
            </div>
            {gefilterd.length === 0 && (
              <div style={{ textAlign:"center", padding:"50px 20px" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🍳</div>
                <p style={{ fontWeight:700, fontSize:16, color:C.orange, margin:"0 0 6px" }}>
                  {dieetFilter ? "Geen recepten met dit dieet-label" : "Nog geen recepten"}
                </p>
                <p style={{ fontSize:14, color:C.muted, margin:0 }}>Tik + of gebruik de AI-kok</p>
              </div>
            )}
            {receptenPerKeuken.map(({ keuken, recepten: keukenRecepten }) => {
              const ingeklapt = !!ingeklapteKeukens[keuken];
              return (
                <section key={keuken} style={{ marginBottom:16 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", padding:"4px 2px", marginBottom: ingeklapt ? 0 : 8 }}
                    onClick={() => setIngeklapteKeukens(prev => ({ ...prev, [keuken]: !ingeklapt }))}>
                    <span style={{ fontSize:12, fontWeight:700, color:C.orange, textTransform:"uppercase", letterSpacing:"0.04em" }}>
                      🍽️ {keuken} ({keukenRecepten.length})
                    </span>
                    <span style={{ fontSize:14, color:C.muted }}>{ingeklapt ? "▸" : "▾"}</span>
                  </div>
                  {!ingeklapt && keukenRecepten.map(r => {
                    const stats = receptStats(r);
                    const veelGemaakt = stats.aantal >= 3;
                    return (
                    <div key={r.id} style={{ ...S.card, cursor:"pointer", display:"flex", gap:12, alignItems:"center" }}
                      onClick={() => setActieefReceptId(r.id)}>
                      <div style={{ width:52, height:52, borderRadius:12, background:C.card, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0 }}>🍽️</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ margin:"0 0 3px", fontWeight:700, fontSize:15 }}>{r.naam}</p>
                        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
                          <span style={{ fontSize:12, color:C.muted }}>⏱ {r.bereidingstijd}min</span>
                          <span style={{ fontSize:12, color:C.muted }}>👥 {r.porties}p</span>
                          {r.kcal ? <span style={{ fontSize:12, color:C.muted }}>🔥{r.kcal}kcal</span> : null}
                          {weergaveReceptBeoordeling(r) > 0 && <span style={{ fontSize:11 }}>{"⭐".repeat(Math.round(weergaveReceptBeoordeling(r)))}</span>}
                          {veelGemaakt && <span title="Vaak gemaakt" style={{ fontSize:11 }}>🔥 favoriet</span>}
                          {stats.langNietGemaakt && <span title="Lang niet gemaakt" style={{ fontSize:11 }}>💤</span>}
                        </div>
                      </div>
                      <ChevronLeft size={16} color={C.muted} style={{ transform:"rotate(180deg)" }} />
                    </div>
                    );
                  })}
                </section>
              );
            })}
          </>
        )}

        {/* ── AI KOK ── */}
        {tab === "ai" && (
          <div>
            {aiKostenMaand != null && aiKostenMaand > 0 && (
              <Link href="/ai-kosten" style={{ display: "block", textAlign: "right", fontSize: 10, color: C.muted, textDecoration: "none", marginBottom: 6 }}>
                💰 €{aiKostenMaand.toFixed(2)} deze maand
              </Link>
            )}
            {/* Sub-tabs */}
            <div style={{ display:"flex", gap:4, background:"#FFFFFF", borderRadius:12, marginBottom:16, border:`1px solid ${C.border}`, padding:"4px" }}>
              {[["ai","🤖 AI Kok"],["foto","📷 Foto"],["link","🔗 Link"]].map(([t,l]) => (
                <button key={t} style={{ flex:1, border:"none", background:importTab===t?C.orange:"transparent", color:importTab===t?"#FFF":C.muted, borderRadius:9, padding:"8px 0", fontSize:12, fontWeight:600, cursor:"pointer" }}
                  onClick={() => { setImportTab(t); setImportFout(null); }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Foutmelding */}
            {importFout && (
              <div style={{ background:`${C.red}15`, border:`1px solid ${C.red}44`, borderRadius:10, padding:"10px 14px", marginBottom:12, fontSize:13, color:C.red }}>
                ❌ {importFout}
              </div>
            )}

            {/* AI Kok */}
            {importTab === "ai" && (
              <>
                <p style={{ fontSize:13, color:C.muted, marginBottom:12, lineHeight:1.5 }}>
                  Vraag de AI-kok om een recept, weekmenu-idee, vervangingen of kooktips.
                </p>
                <textarea style={{ ...S.inp, height:90, resize:"none", marginBottom:10 }}
                  placeholder="bv. 'Geef me een snel vegetarisch pasta recept voor 2 personen'"
                  value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} />
                <button style={{ ...S.btn(), width:"100%", marginBottom:14 }} onClick={vraagAI} disabled={aiLoading}>
                  {aiLoading ? "🧑‍🍳 Bezig met koken…" : "🤖 Vraag de AI-kok"}
                </button>
                {aiResultaat && (
                  <div style={{ ...S.card, border:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:13, color:C.text, lineHeight:1.8, whiteSpace:"pre-wrap", marginBottom:14 }}>{aiResultaat}</div>
                    {aiResultaat.includes("Ingrediënten") && (
                      <button style={{ ...S.btn(), width:"100%", fontSize:13 }} onClick={importeerAIRecept}>
                        ➕ Importeer als recept
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Foto import */}
            {importTab === "foto" && (
              <>
                <div style={{ ...S.card, textAlign:"center", border:`2px dashed ${C.border}`, background:C.card, cursor:"pointer" }}
                  onClick={() => fotoImportRef.current?.click()}>
                  {importFotoLoading ? (
                    <div style={{ padding:"30px 0" }}>
                      <div style={{ fontSize:32, marginBottom:10 }}>📖</div>
                      <p style={{ fontSize:14, color:C.muted, margin:0 }}>Recept wordt gelezen…</p>
                    </div>
                  ) : (
                    <div style={{ padding:"30px 0" }}>
                      <div style={{ fontSize:40, marginBottom:10 }}>📷</div>
                      <p style={{ fontSize:15, fontWeight:700, color:C.orange, margin:"0 0 6px" }}>Foto van kookboek</p>
                      <p style={{ fontSize:13, color:C.muted, margin:0 }}>Maak een foto van een receptpagina of kies een afbeelding uit je bibliotheek</p>
                    </div>
                  )}
                </div>
                <input ref={fotoImportRef} type="file" accept="image/*" style={{ display:"none" }}
                  onChange={e => importeerViaFoto(e.target.files[0])} />
                <p style={{ fontSize:12, color:C.muted, textAlign:"center", marginTop:8 }}>
                  Zorg voor goede belichting en houd de camera recht boven de pagina
                </p>
              </>
            )}

            {/* Link import */}
            {importTab === "link" && (
              <>
                <p style={{ fontSize:13, color:C.muted, marginBottom:12, lineHeight:1.5 }}>
                  Plak een link naar een receptenpagina. Werkt met de meeste Nederlandse en internationale receptsites.
                </p>
                <input style={{ ...S.inp, marginBottom:10 }}
                  placeholder="https://www.allerhande.nl/recept/..."
                  value={importUrl}
                  onChange={e => setImportUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && importeerViaLink()}
                  type="url" />
                <button style={{ ...S.btn(), width:"100%", opacity: importLinkLoading ? 0.7 : 1 }}
                  onClick={importeerViaLink}
                  disabled={importLinkLoading || !importUrl.trim()}>
                  {importLinkLoading ? "🔍 Recept ophalen…" : "🔗 Importeer recept"}
                </button>
                <p style={{ fontSize:12, color:C.muted, marginTop:12, lineHeight:1.5 }}>
                  Werkt goed met: Allerhande, Jumbo, Smulweb, Jamie Oliver, Epicurious en de meeste andere receptsites. Werkt niet bij sites die inloggen vereisen.
                </p>
              </>
            )}
          </div>
        )}
      </main>

      {tab === "recepten" && (
        <button style={S.fab} onClick={() => setShowReceptForm(true)}>
          <Plus size={22} color="#FFFFFF" strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}
