import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, X, ChevronLeft, Camera, Trash2, Pill, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ── Constanten ─────────────────────────────────────────
const PERSONEN = [
  { id: "Pepijn", label: "Pepijn", kleur: "#2D4A3E" },
  { id: "Tessa",  label: "Tessa",  kleur: "#C86E4A" },
  { id: "Jimmy",  label: "Jimmy",  kleur: "#4A7FB5" },
];
const PERSOON_MAP = Object.fromEntries(PERSONEN.map(p => [p.id, p]));

const KLACHT_CATEGORIEEN = [
  { id: "hoofdpijn",         label: "Hoofdpijn",           icon: "🤕" },
  { id: "verkoudheid_griep", label: "Verkoudheid/griep",   icon: "🤧" },
  { id: "buikpijn",          label: "Buikpijn/misselijk",  icon: "🤢" },
  { id: "allergie",          label: "Allergie/hooikoorts", icon: "🌸" },
  { id: "benauwdheid",       label: "Benauwdheid",         icon: "🫁" },
  { id: "koorts",            label: "Koorts",              icon: "🌡️" },
  { id: "huidklachten",      label: "Huidklachten",        icon: "🔴" },
  { id: "rugpijn_spierpijn", label: "Rug-/spierpijn",      icon: "💪" },
  { id: "vermoeidheid",      label: "Vermoeidheid",        icon: "😴" },
  { id: "slaapproblemen",    label: "Slaapproblemen",      icon: "🌙" },
  { id: "overig",            label: "Overig",              icon: "📝" },
];
const KLACHT_CAT_MAP = Object.fromEntries(KLACHT_CATEGORIEEN.map(c => [c.id, c]));

// Zelf-gerapporteerde benauwdheid-schaal (0-10) — geïnspireerd op de manier
// waarop dit klinisch vaak wordt uitgevraagd (zoals de Borg-schaal), maar
// puur als hulpmiddel om je eigen ervaring consistent te kunnen loggen —
// geen diagnostisch instrument.
const BENAUWDHEID_NIVEAUS = [
  { max: 0,  label: "Geen last",                        emoji: "😌", kleur: "#2D6A4F" },
  { max: 2,  label: "Licht kortademig",                  emoji: "🙂", kleur: "#4C9A2A" },
  { max: 4,  label: "Merkbaar benauwd",                  emoji: "😕", kleur: "#A8C700" },
  { max: 6,  label: "Duidelijk benauwd",                 emoji: "😟", kleur: "#F2C500" },
  { max: 8,  label: "Erg benauwd",                       emoji: "😰", kleur: "#E06A1F" },
  { max: 10, label: "Zeer ernstig — moeite met praten",  emoji: "🆘", kleur: "#D6273C" },
];
function benauwdheidsNiveau(score) {
  return BENAUWDHEID_NIVEAUS.find(n => score <= n.max) || BENAUWDHEID_NIVEAUS[BENAUWDHEID_NIVEAUS.length-1];
}

// Pollen-niveau in "korrels/m³" omzetten naar een leesbare indicatie —
// gangbare Europese vuistregel-drempels, dus indicatief, geen exacte
// wetenschappelijke classificatie.
const POLLEN_NIVEAUS = [
  { max: 0,   label: "Geen",       kleur: "#2D6A4F" },
  { max: 9,   label: "Laag",       kleur: "#4C9A2A" },
  { max: 49,  label: "Matig",      kleur: "#C97D0C" },
  { max: 149, label: "Hoog",       kleur: "#E06A1F" },
  { max: Infinity, label: "Zeer hoog", kleur: "#D6273C" },
];
function pollenNiveau(waarde) {
  return POLLEN_NIVEAUS.find(n => waarde <= n.max) || POLLEN_NIVEAUS[POLLEN_NIVEAUS.length-1];
}
const POLLEN_TYPES = [
  { id: "grass_pollen",   label: "Gras" },
  { id: "birch_pollen",   label: "Berk" },
  { id: "alder_pollen",   label: "Els" },
  { id: "mugwort_pollen", label: "Bijvoet" },
  { id: "olive_pollen",   label: "Olijf" },
  { id: "ragweed_pollen", label: "Ambrosia" },
];

const MAAND_NAMEN = ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];

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

// Tijdzone-veilige datumfuncties — nooit toISOString() gebruiken.
function vandaagStr() {
  const nu = new Date();
  return `${nu.getFullYear()}-${String(nu.getMonth()+1).padStart(2,"0")}-${String(nu.getDate()).padStart(2,"0")}`;
}
function formatDatum(datumStr) {
  if (!datumStr) return "";
  const [j, m, d] = datumStr.split("-").map(Number);
  return new Date(j, m - 1, d).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}
function maandVan(datumStr) {
  return +datumStr.split("-")[1] - 1; // 0-11
}
function jaarVan(datumStr) {
  return +datumStr.split("-")[0];
}

// Haalt het huidige weer + pollenniveaus op via Open-Meteo (gratis, geen
// API-key, zelfde dienst als Planten al gebruikt). Alleen zinvol voor
// VANDAAG — voor oudere datums bestaat geen betrouwbare "wat was het toen"-
// pollen-historie via deze gratis dienst, dus dan slaan we het simpelweg over.
async function haalWeerEnPollenOp() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const { latitude: lat, longitude: lon } = pos.coords;
        const [weerRes, pollenRes] = await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto`),
          fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=${POLLEN_TYPES.map(p=>p.id).join(",")}&timezone=auto`),
        ]);
        const weerData = await weerRes.json();
        const pollenData = await pollenRes.json();

        const pollenWaarden = POLLEN_TYPES.map(p => ({ type: p.id, label: p.label, waarde: pollenData.current?.[p.id] ?? 0 }));
        const hoogste = pollenWaarden.reduce((max, p) => p.waarde > max.waarde ? p : max, pollenWaarden[0]);

        resolve({
          weer: {
            temperatuur: weerData.current?.temperature_2m ?? null,
            luchtvochtigheid: weerData.current?.relative_humidity_2m ?? null,
            windkmh: weerData.current?.wind_speed_10m ?? null,
          },
          pollen: {
            waarden: pollenWaarden,
            hoogsteType: hoogste?.label ?? null,
            hoogsteWaarde: hoogste?.waarde ?? 0,
          },
          opgehaaldOp: Date.now(),
        });
      } catch { resolve(null); }
    }, () => resolve(null), { timeout: 8000 });
  });
}

function PersoonBadge({ persoon, groot }) {
  const p = PERSOON_MAP[persoon];
  if (!p) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: groot ? 24 : 16, height: groot ? 24 : 16, borderRadius: "50%",
      background: p.kleur, color: "#FAF6F0", fontSize: groot ? 11 : 8, fontWeight: 700, flexShrink: 0,
    }}>
      {p.label.charAt(0)}
    </span>
  );
}

// ── Patroonanalyse (client-side, geen AI nodig — snel en gratis) ───────────
// Groepeert klachten per categorie+maand over alle jaren heen, en meldt
// alleen categorieën die in minstens 2 verschillende jaren in dezelfde
// maand voorkwamen — dat is pas een echt patroon, geen toeval.
function berekenSeizoenspatronen(klachten) {
  const perCatMaand = {}; // "categorie|maand" -> Set van jaren
  klachten.forEach(k => {
    if (!k.datum) return;
    const sleutel = `${k.categorie}|${maandVan(k.datum)}`;
    if (!perCatMaand[sleutel]) perCatMaand[sleutel] = new Set();
    perCatMaand[sleutel].add(jaarVan(k.datum));
  });
  const patronen = [];
  Object.entries(perCatMaand).forEach(([sleutel, jaren]) => {
    if (jaren.size < 2) return; // minstens 2 verschillende jaren voor een patroon
    const [catId, maandIdx] = sleutel.split("|");
    patronen.push({ categorie: catId, maand: +maandIdx, aantalJaren: jaren.size });
  });
  return patronen.sort((a,b) => b.aantalJaren - a.aantalJaren);
}

// Simpele frequentie van de laatste 90 dagen, per categorie.
function berekenRecenteFrequentie(klachten) {
  const grens = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const perCat = {};
  klachten.forEach(k => {
    if (!k.datum) return;
    const [j,m,d] = k.datum.split("-").map(Number);
    const tijd = new Date(j, m-1, d).getTime();
    if (tijd < grens) return;
    perCat[k.categorie] = (perCat[k.categorie]||0) + 1;
  });
  return Object.entries(perCat)
    .filter(([,n]) => n >= 2)
    .map(([catId, n]) => ({ categorie: catId, aantal: n }))
    .sort((a,b) => b.aantal - a.aantal);
}

// Aantal registraties per maand, laatste 12 maanden — voor de trendgrafiek.
function berekenTrendData(klachten) {
  const nu = new Date();
  const maanden = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
    maanden.push({ sleutel: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`, label: MAAND_NAMEN[d.getMonth()].slice(0,3) });
  }
  const perMaand = {};
  klachten.forEach(k => {
    if (!k.datum) return;
    const sleutel = k.datum.slice(0,7);
    perMaand[sleutel] = (perMaand[sleutel]||0) + 1;
  });
  return maanden.map(m => ({ naam: m.label, aantal: perMaand[m.sleutel] || 0 }));
}

// Per categorie: van de klachten met bekende pollen-/weerdata, hoeveel
// vielen op een dag met hoog/zeer hoog pollen, en wat was de gemiddelde
// temperatuur? Puur beschrijvende statistiek — geen causaal verband,
// alleen een aanwijzing om zelf verder op te letten.
function berekenWeerCorrelatie(klachten) {
  const perCat = {};
  klachten.forEach(k => {
    if (!k.pollen && !k.weer) return;
    if (!perCat[k.categorie]) perCat[k.categorie] = { metPollen: 0, hoogPollen: 0, temperaturen: [] };
    if (k.pollen) {
      perCat[k.categorie].metPollen++;
      const niveau = pollenNiveau(k.pollen.hoogsteWaarde||0);
      if (niveau.label === "Hoog" || niveau.label === "Zeer hoog") perCat[k.categorie].hoogPollen++;
    }
    if (k.weer?.temperatuur != null) perCat[k.categorie].temperaturen.push(k.weer.temperatuur);
  });
  return Object.entries(perCat)
    .filter(([,d]) => d.metPollen >= 3) // pas zinvol vanaf een paar metingen
    .map(([catId, d]) => ({
      categorie: catId,
      metPollen: d.metPollen,
      hoogPollen: d.hoogPollen,
      percentage: Math.round((d.hoogPollen / d.metPollen) * 100),
      gemTemp: d.temperaturen.length ? Math.round(d.temperaturen.reduce((s,t)=>s+t,0) / d.temperaturen.length) : null,
    }))
    .sort((a,b) => b.percentage - a.percentage);
}

export default function GezondheidApp() {
  const [klachten, setKlachtenState] = useState([]);
  const [medicatie, setMedicatieState] = useState([]);
  const [afspraken, setAfsprakenState] = useState([]);
  const [contacten, setContactenState] = useState([]);
  const [allergieen, setAllergieenState] = useState([]);
  const [persoonProfielen, setPersoonProfielenState] = useState({});
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [huidigeGebruiker, setHuidigeGebruiker] = useState(null);
  const lastWriteRef = useRef(0);
  const klachtenRef = useRef([]);
  const medicatieRef = useRef([]);
  const afsprakenRef = useRef([]);
  const contactenRef = useRef([]);
  const allergieenRef = useRef([]);
  const persoonProfielenRef = useRef({});
  const laatstOpgeslagenFotoRef = useRef({}); // `${id}` -> laatst bevestigd opgeslagen fotowaarde
  const fotoInputRef = useRef(null);

  const [persoonFilter, setPersoonFilter] = useState(null);
  const [catFilter, setCatFilter] = useState(null);
  const [tab, setTab] = useState("logboek"); // "logboek" | "patronen" | "medicatie" | "afspraken"
  const [toast, setToast] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [weerLoading, setWeerLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(LEEG_FORM());
  const [showDetail, setShowDetail] = useState(null);

  const [showMedForm, setShowMedForm] = useState(false);
  const [editMedId, setEditMedId] = useState(null);
  const [medForm, setMedForm] = useState(LEEG_MED_FORM());

  const [showAfspraakForm, setShowAfspraakForm] = useState(false);
  const [editAfspraakId, setEditAfspraakId] = useState(null);
  const [afspraakForm, setAfspraakForm] = useState(LEEG_AFSPRAAK_FORM());

  const [showContactForm, setShowContactForm] = useState(false);
  const [editContactId, setEditContactId] = useState(null);
  const [contactForm, setContactForm] = useState(LEEG_CONTACT_FORM());

  const [showAllergieForm, setShowAllergieForm] = useState(false);
  const [editAllergieId, setEditAllergieId] = useState(null);
  const [allergieForm, setAllergieForm] = useState(LEEG_ALLERGIE_FORM());
  const [showNoodkaart, setShowNoodkaart] = useState(null); // persoon-id of null
  const [noodkaartBewerken, setNoodkaartBewerken] = useState(false);

  const [patronenLoading, setPatronenLoading] = useState(false);
  const [aiPatronen, setAiPatronen] = useState(null);
  const [showDokterOverzicht, setShowDokterOverzicht] = useState(null); // persoon-id of null
  const [vragenlijstLoading, setVragenlijstLoading] = useState(false);
  const [vragenlijst, setVragenlijst] = useState(null); // { persoon, vragen }

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.user) setHuidigeGebruiker(d.user);
    }).catch(() => {});
  }, []);

  // Object-gebaseerde aanroep i.p.v. positionele argumenten — bij 6 losse
  // datatypes (klachten/medicatie/afspraken/contacten/allergieën/profielen)
  // wordt een lange rij positionele argumenten foutgevoelig. Geef alleen mee
  // wat je wilt wijzigen; de rest wordt uit de refs (dus altijd actueel)
  // aangevuld. Voorbeeld: persist({ klachten: nieuweLijst }).
  const persist = useCallback((overrides) => {
    lastWriteRef.current = Date.now();
    const nextKlachten = overrides.klachten ?? klachtenRef.current;
    const nextMedicatie = overrides.medicatie ?? medicatieRef.current;
    const nextAfspraken = overrides.afspraken ?? afsprakenRef.current;
    const nextContacten = overrides.contacten ?? contactenRef.current;
    const nextAllergieen = overrides.allergieen ?? allergieenRef.current;
    const nextPersoonProfielen = overrides.persoonProfielen ?? persoonProfielenRef.current;

    setKlachtenState(nextKlachten);
    setMedicatieState(nextMedicatie);
    setAfsprakenState(nextAfspraken);
    setContactenState(nextContacten);
    setAllergieenState(nextAllergieen);
    setPersoonProfielenState(nextPersoonProfielen);

    // Alleen daadwerkelijk gewijzigde foto's meesturen — zelfde les als bij
    // Maaltijdplanner: anders stuurt elke opslag de hele fotogeschiedenis
    // opnieuw mee, en loopt dat op den duur vast tegen Vercel's aanvraaglimiet.
    const klachtenOmTeVerzenden = nextKlachten.map(k => {
      const kopie = { ...k };
      if (kopie.foto === laatstOpgeslagenFotoRef.current[k.id]) delete kopie.foto;
      return kopie;
    });

    fetch("/api/gezondheid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        klachten: klachtenOmTeVerzenden, medicatie: nextMedicatie, afspraken: nextAfspraken,
        contacten: nextContacten, allergieen: nextAllergieen, persoonProfielen: nextPersoonProfielen,
      }),
    }).then(res => {
      if (!res.ok) { showToast("❌ Opslaan mislukt — probeer het nogmaals"); return; }
      nextKlachten.forEach(k => { laatstOpgeslagenFotoRef.current[k.id] = k.foto; });
    }).catch(() => showToast("❌ Opslaan mislukt — controleer je verbinding"));
  }, []);

  const laadData = useCallback(async () => {
    try {
      const res = await fetch("/api/gezondheid");
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }, []);

  useEffect(() => {
    let actief = true;
    const refresh = async () => {
      if (Date.now() - lastWriteRef.current < 5000) return;
      const aanvraagGestart = Date.now();
      const data = await laadData();
      if (lastWriteRef.current > aanvraagGestart) return;
      if (actief && data) {
        setKlachtenState(data.klachten || []);
        setMedicatieState(data.medicatie || []);
        setAfsprakenState(data.afspraken || []);
        setContactenState(data.contacten || []);
        setAllergieenState(data.allergieen || []);
        setPersoonProfielenState(data.persoonProfielen || {});
        setLoading(false);
        (data.klachten || []).forEach(k => { laatstOpgeslagenFotoRef.current[k.id] = k.foto; });
      } else if (actief) setLoading(false);
    };
    refresh();
    const poll = setInterval(refresh, 8000);
    return () => { actief = false; clearInterval(poll); };
  }, [laadData]);

  useEffect(() => { klachtenRef.current = klachten; }, [klachten]);
  useEffect(() => { medicatieRef.current = medicatie; }, [medicatie]);
  useEffect(() => { afsprakenRef.current = afspraken; }, [afspraken]);
  useEffect(() => { contactenRef.current = contacten; }, [contacten]);
  useEffect(() => { allergieenRef.current = allergieen; }, [allergieen]);
  useEffect(() => { persoonProfielenRef.current = persoonProfielen; }, [persoonProfielen]);

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
  function resetMedForm() { setMedForm(LEEG_MED_FORM()); setEditMedId(null); }
  function resetAfspraakForm() { setAfspraakForm(LEEG_AFSPRAAK_FORM()); setEditAfspraakId(null); }

  function opslaanKlacht() {
    if (!form.persoon || !form.categorie) return;
    if (editId) {
      persist({ klachten: klachtenRef.current.map(k => k.id === editId ? { ...k, ...form } : k) });
      showToast("✅ Bijgewerkt");
    } else {
      const nieuw = { id: uid(), ...form, addedAt: Date.now(), addedBy: huidigeGebruiker };
      persist({ klachten: [nieuw, ...klachtenRef.current] });
      showToast("✅ Toegevoegd aan logboek");
    }
    resetForm();
    setShowForm(false);
  }

  function bewerkKlacht(k) {
    setForm({
      persoon: k.persoon, datum: k.datum || vandaagStr(), categorie: k.categorie || "overig",
      ernst: k.ernst || 0, benauwdheidScore: k.benauwdheidScore || 0, notitie: k.notitie || "", foto: k.foto || null,
      medicatieIds: k.medicatieIds || [], hielp: k.hielp || "",
      weer: k.weer || null, pollen: k.pollen || null,
    });
    setEditId(k.id);
    setShowForm(true);
  }

  function verwijderKlacht(id) {
    if (!window.confirm("Deze registratie verwijderen?")) return;
    persist({ klachten: klachtenRef.current.filter(k => k.id !== id) });
    if (showDetail === id) setShowDetail(null);
  }

  async function handleFotoUpload(file) {
    if (!file) return;
    const compressed = await comprimeerFoto(file);
    setForm(f => ({ ...f, foto: compressed }));
  }

  async function haalWeerOp() {
    setWeerLoading(true);
    const resultaat = await haalWeerEnPollenOp();
    if (resultaat) setForm(f => ({ ...f, weer: resultaat.weer, pollen: resultaat.pollen }));
    else showToast("⚠️ Kon weer/pollen niet ophalen (locatietoegang nodig)");
    setWeerLoading(false);
  }

  // Bij het openen van een NIEUWE registratie voor vandaag automatisch het
  // huidige weer/pollenniveau erbij halen — scheelt een extra tik, en is
  // precies het moment waarop die data nog vers/betrouwbaar is. Bij het
  // bewerken van een bestaande registratie raken we dit niet aan (die
  // bewaart wat er destijds is opgehaald).
  useEffect(() => {
    if (showForm && !editId && form.datum === vandaagStr()) {
      haalWeerOp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm]);

  function opslaanMedicatie() {
    if (!medForm.persoon || !medForm.naam.trim()) return;
    if (editMedId) {
      persist({ medicatie: medicatieRef.current.map(m => m.id === editMedId ? { ...m, ...medForm } : m) });
      showToast("✅ Bijgewerkt");
    } else {
      const nieuw = { id: uid(), ...medForm, addedAt: Date.now() };
      persist({ medicatie: [nieuw, ...medicatieRef.current] });
      showToast("✅ Medicatie toegevoegd");
    }
    resetMedForm();
    setShowMedForm(false);
  }

  function bewerkMedicatie(m) {
    setMedForm({
      persoon: m.persoon, naam: m.naam || "", dosering: m.dosering || "", frequentie: m.frequentie || "",
      sinds: m.sinds || vandaagStr(), tot: m.tot || "", reden: m.reden || "", notitie: m.notitie || "",
    });
    setEditMedId(m.id);
    setShowMedForm(true);
  }

  function verwijderMedicatie(id) {
    if (!window.confirm("Deze medicatie verwijderen?")) return;
    persist({ medicatie: medicatieRef.current.filter(m => m.id !== id) });
  }

  function stopMedicatie(id) {
    persist({ medicatie: medicatieRef.current.map(m => m.id === id ? { ...m, tot: vandaagStr() } : m) });
    showToast("✅ Gestopt genoteerd");
  }

  // ── Afspraken/vaccinaties ────────────────────────────────
  function opslaanAfspraak() {
    if (!afspraakForm.persoon || !afspraakForm.omschrijving.trim()) return;
    if (editAfspraakId) {
      persist({ afspraken: afsprakenRef.current.map(a => a.id === editAfspraakId ? { ...a, ...afspraakForm } : a) });
      showToast("✅ Bijgewerkt");
    } else {
      const nieuw = { id: uid(), ...afspraakForm, addedAt: Date.now() };
      persist({ afspraken: [nieuw, ...afsprakenRef.current] });
      showToast("✅ Afspraak toegevoegd");
    }
    resetAfspraakForm();
    setShowAfspraakForm(false);
  }
  function bewerkAfspraak(a) {
    setAfspraakForm({
      persoon: a.persoon, type: a.type || "controle", omschrijving: a.omschrijving || "",
      datum: a.datum || vandaagStr(), gedaan: !!a.gedaan, notitie: a.notitie || "",
    });
    setEditAfspraakId(a.id);
    setShowAfspraakForm(true);
  }
  function verwijderAfspraak(id) {
    if (!window.confirm("Deze afspraak verwijderen?")) return;
    persist({ afspraken: afsprakenRef.current.filter(a => a.id !== id) });
  }
  function toggleAfspraakGedaan(id) {
    persist({ afspraken: afsprakenRef.current.map(a => a.id === id ? { ...a, gedaan: !a.gedaan } : a) });
  }

  // ── Contactpersonen ──────────────────────────────────────
  function opslaanContact() {
    if (!contactForm.naam.trim()) return;
    if (editContactId) {
      persist({ contacten: contactenRef.current.map(c => c.id === editContactId ? { ...c, ...contactForm } : c) });
      showToast("✅ Bijgewerkt");
    } else {
      const nieuw = { id: uid(), ...contactForm, addedAt: Date.now() };
      persist({ contacten: [nieuw, ...contactenRef.current] });
      showToast("✅ Contact toegevoegd");
    }
    resetContactForm();
    setShowContactForm(false);
  }
  function bewerkContact(c) {
    setContactForm({ naam: c.naam || "", type: c.type || "huisarts", telefoon: c.telefoon || "", adres: c.adres || "", notitie: c.notitie || "" });
    setEditContactId(c.id);
    setShowContactForm(true);
  }
  function verwijderContact(id) {
    if (!window.confirm("Dit contact verwijderen?")) return;
    persist({ contacten: contactenRef.current.filter(c => c.id !== id) });
  }
  function resetContactForm() { setContactForm(LEEG_CONTACT_FORM()); setEditContactId(null); }

  // ── Allergieën & intoleranties ────────────────────────────
  // Bewust een APARTE, permanente lijst — geen gedateerde logboek-items zoals
  // klachten, maar blijvende feiten over een persoon die je altijd snel wil
  // kunnen terugvinden (bv. voor een oppas, leerkracht, of noodgeval).
  function opslaanAllergie() {
    if (!allergieForm.naam.trim()) return;
    if (editAllergieId) {
      persist({ allergieen: allergieenRef.current.map(a => a.id === editAllergieId ? { ...a, ...allergieForm } : a) });
      showToast("✅ Bijgewerkt");
    } else {
      const nieuw = { id: uid(), ...allergieForm, addedAt: Date.now() };
      persist({ allergieen: [nieuw, ...allergieenRef.current] });
      showToast("✅ Toegevoegd");
    }
    resetAllergieForm();
    setShowAllergieForm(false);
  }
  function bewerkAllergie(a) {
    setAllergieForm({ persoon: a.persoon, naam: a.naam || "", type: a.type || "allergie", ernst: a.ernst || "matig", notitie: a.notitie || "" });
    setEditAllergieId(a.id);
    setShowAllergieForm(true);
  }
  function verwijderAllergie(id) {
    if (!window.confirm("Deze allergie/intolerantie verwijderen?")) return;
    persist({ allergieen: allergieenRef.current.filter(a => a.id !== id) });
  }
  function resetAllergieForm() { setAllergieForm(LEEG_ALLERGIE_FORM()); setEditAllergieId(null); }

  // ── Persoonsprofiel (bloedgroep, noodcontact) — voor de noodkaart ──────
  function updatePersoonProfiel(persoon, veld, waarde) {
    persist({ persoonProfielen: { ...persoonProfielenRef.current, [persoon]: { ...(persoonProfielenRef.current[persoon]||{}), [veld]: waarde } } });
  }

  // ── Overzicht voor de dokter ─────────────────────────────
  // Zet recente klachten (laatste 6 maanden) + actieve medicatie van één
  // persoon om in een deelbare tekst, zodat je niet alles hoeft na te
  // vertellen bij een afspraak.
  function bouwDokterOverzicht(persoon) {
    const zesMaandenGeleden = Date.now() - 182 * 24 * 60 * 60 * 1000;
    const relevanteKlachten = klachtenRef.current
      .filter(k => k.persoon === persoon)
      .filter(k => { const [j,m,d]=k.datum.split("-").map(Number); return new Date(j,m-1,d).getTime() >= zesMaandenGeleden; })
      .sort((a,b) => (a.datum||"").localeCompare(b.datum||""));
    const actieveMedicatie = medicatieRef.current.filter(m => m.persoon === persoon && (!m.tot || m.tot >= vandaagStr()));
    const allergieenVanPersoon = allergieenRef.current.filter(a => a.persoon === persoon);

    const regels = [`Overzicht ${persoon} — laatste 6 maanden`, ""];
    if (allergieenVanPersoon.length > 0) {
      regels.push("⚠️ Allergieën/intoleranties:");
      allergieenVanPersoon.forEach(a => regels.push(`• ${a.naam} (${ALLERGIE_ERNST_MAP[a.ernst]?.label})`));
      regels.push("");
    }
    regels.push("Klachten:");
    if (relevanteKlachten.length === 0) regels.push("  (geen geregistreerd)");
    relevanteKlachten.forEach(k => {
      const cat = KLACHT_CAT_MAP[k.categorie]?.label || k.categorie;
      const scoreText = k.categorie === "benauwdheid"
        ? ` (benauwdheid ${k.benauwdheidScore||0}/10 — ${benauwdheidsNiveau(k.benauwdheidScore||0).label})`
        : k.ernst ? ` (ernst ${k.ernst}/5)` : "";
      regels.push(`• ${formatDatum(k.datum)} — ${cat}${scoreText}${k.notitie ? `: ${k.notitie}` : ""}`);
    });
    regels.push("", "Huidige medicatie:");
    if (actieveMedicatie.length === 0) regels.push("  (geen)");
    actieveMedicatie.forEach(m => {
      regels.push(`• ${m.naam}${m.dosering ? ` — ${m.dosering}` : ""}${m.frequentie ? ` (${m.frequentie})` : ""}, sinds ${formatDatum(m.sinds)}`);
    });
    return regels.join("\n");
  }
  function deelDokterOverzicht(persoon) {
    const tekst = bouwDokterOverzicht(persoon);
    if (navigator.share) {
      navigator.share({ title: `Overzicht ${persoon}`, text: tekst }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(tekst).then(() => showToast("✅ Gekopieerd naar klembord"));
    }
  }

  // ── Exporteren van het logboek ────────────────────────────
  function exporteerCsv() {
    const kolommen = ["Persoon","Datum","Categorie","Ernst","BenauwdheidScore","Notitie","Medicatie","Hielp","Pollen(hoogste)","Temperatuur"];
    const regels = [kolommen.join(";")];
    klachtenRef.current.slice().sort((a,b)=>(a.datum||"").localeCompare(b.datum||"")).forEach(k => {
      const medNamen = (k.medicatieIds||[]).map(id => medicatieRef.current.find(m=>m.id===id)?.naam).filter(Boolean).join(", ");
      const veld = v => `"${String(v??"").replace(/"/g,'""')}"`;
      regels.push([
        veld(k.persoon), veld(k.datum), veld(KLACHT_CAT_MAP[k.categorie]?.label || k.categorie),
        veld(k.ernst||""), veld(k.categorie==="benauwdheid" ? (k.benauwdheidScore??"") : ""),
        veld(k.notitie||""), veld(medNamen), veld(k.hielp ? HIELP_MAP[k.hielp]?.label : ""),
        veld(k.pollen ? `${k.pollen.hoogsteType||""} (${k.pollen.hoogsteWaarde??""})` : ""),
        veld(k.weer?.temperatuur ?? ""),
      ].join(";"));
    });
    const blob = new Blob(["\uFEFF" + regels.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `gezondheidslogboek_${vandaagStr()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("✅ CSV gedownload");
  }

  function exporteerPrint(persoonFilterVoorPrint) {
    const relevant = (persoonFilterVoorPrint ? klachtenRef.current.filter(k=>k.persoon===persoonFilterVoorPrint) : klachtenRef.current)
      .slice().sort((a,b)=>(a.datum||"").localeCompare(b.datum||""));
    const win = window.open("", "_blank");
    if (!win) { showToast("⚠️ Kon geen printvenster openen (pop-up geblokkeerd?)"); return; }
    const rijen = relevant.map(k => {
      const medNamen = (k.medicatieIds||[]).map(id => medicatieRef.current.find(m=>m.id===id)?.naam).filter(Boolean).join(", ");
      const score = k.categorie==="benauwdheid" ? `${k.benauwdheidScore??0}/10` : (k.ernst ? `${k.ernst}/5` : "");
      return `<tr><td>${formatDatum(k.datum)}</td><td>${k.persoon}</td><td>${KLACHT_CAT_MAP[k.categorie]?.label||k.categorie}</td><td>${score}</td><td>${(k.notitie||"").replace(/</g,"&lt;")}</td><td>${medNamen}</td></tr>`;
    }).join("");
    win.document.write(`
      <html><head><title>Gezondheidslogboek</title>
      <style>
        body{font-family:-apple-system,sans-serif;padding:24px;color:#222;}
        h1{font-size:18px;} table{width:100%;border-collapse:collapse;font-size:12px;}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;} th{background:#f2f2f2;}
      </style></head><body>
      <h1>Gezondheidslogboek${persoonFilterVoorPrint ? ` — ${persoonFilterVoorPrint}` : ""}</h1>
      <p>Geëxporteerd op ${formatDatum(vandaagStr())}</p>
      <table><thead><tr><th>Datum</th><th>Persoon</th><th>Categorie</th><th>Score</th><th>Notitie</th><th>Medicatie</th></tr></thead>
      <tbody>${rijen}</tbody></table>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  async function zoekAiPatronen(persoon) {
    const vanDezePersoon = klachtenRef.current.filter(k => k.persoon === persoon);
    if (vanDezePersoon.length < 3) { showToast("⚠️ Nog te weinig registraties voor een zinvolle analyse"); return; }
    setPatronenLoading(true);
    try {
      const res = await fetch("/api/gezondheid-patronen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persoon, klachten: vanDezePersoon.map(k => ({ datum: k.datum, categorie: KLACHT_CAT_MAP[k.categorie]?.label || k.categorie, ernst: k.ernst, notitie: k.notitie })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mislukt");
      setAiPatronen({ persoon, ...data });
      if (!data.patronen.length) showToast(data.opmerking ? `ℹ️ ${data.opmerking}` : "ℹ️ Geen duidelijke patronen gevonden");
    } catch (e) {
      showToast(`❌ ${e.message || "Kon geen patronen bepalen"}`);
    }
    setPatronenLoading(false);
  }

  // Stelt een lijst voorbereidende vragen op om aan de (huis)arts te stellen,
  // op basis van de laatste 6 maanden klachten + actieve medicatie — nooit
  // een eigen diagnose/conclusie, alleen vragen die de arts zelf beantwoordt.
  async function zoekVragenVoorDokter(persoon) {
    const zesMaandenGeleden = Date.now() - 182 * 24 * 60 * 60 * 1000;
    const relevanteKlachten = klachtenRef.current
      .filter(k => k.persoon === persoon)
      .filter(k => { const [j,m,d]=k.datum.split("-").map(Number); return new Date(j,m-1,d).getTime() >= zesMaandenGeleden; });
    if (relevanteKlachten.length === 0) { showToast("⚠️ Nog geen recente klachten om een vragenlijst op te baseren"); return; }
    const actieveMedicatie = medicatieRef.current.filter(m => m.persoon === persoon && (!m.tot || m.tot >= vandaagStr()));
    setVragenlijstLoading(true);
    try {
      const res = await fetch("/api/gezondheid-vragenlijst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persoon,
          klachten: relevanteKlachten.map(k => ({ datum: k.datum, categorie: KLACHT_CAT_MAP[k.categorie]?.label || k.categorie, ernst: k.ernst, notitie: k.notitie })),
          medicatie: actieveMedicatie.map(m => ({ naam: m.naam, dosering: m.dosering, sinds: m.sinds })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mislukt");
      setVragenlijst({ persoon, vragen: data.vragen });
      if (!data.vragen.length) showToast("ℹ️ Geen specifieke vragen gevonden");
    } catch (e) {
      showToast(`❌ ${e.message || "Kon geen vragenlijst opstellen"}`);
    }
    setVragenlijstLoading(false);
  }

  // ── Afgeleide data ──────────────────────────────────────
  let zichtbaar = [...klachten];
  if (persoonFilter) zichtbaar = zichtbaar.filter(k => k.persoon === persoonFilter);
  if (catFilter) zichtbaar = zichtbaar.filter(k => k.categorie === catFilter);
  zichtbaar.sort((a,b) => (b.datum||"").localeCompare(a.datum||"") || (b.addedAt||0)-(a.addedAt||0));

  const medicatieZichtbaar = persoonFilter ? medicatie.filter(m => m.persoon === persoonFilter) : medicatie;

  if (loading) return (
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <Activity size={32} color={C.accent} />
        <p style={{ color: C.muted, fontSize: 14 }}>Gezondheid laden…</p>
      </div>
    </div>
  );

  return (
    <GezondheidView
      klachten={klachten} zichtbaar={zichtbaar} medicatie={medicatie} medicatieZichtbaar={medicatieZichtbaar}
      afspraken={afspraken}
      offline={offline} tab={tab} setTab={setTab}
      persoonFilter={persoonFilter} setPersoonFilter={setPersoonFilter}
      catFilter={catFilter} setCatFilter={setCatFilter}
      showForm={showForm} setShowForm={setShowForm} form={form} setForm={setForm}
      editId={editId} resetForm={resetForm} opslaanKlacht={opslaanKlacht}
      bewerkKlacht={bewerkKlacht} verwijderKlacht={verwijderKlacht}
      handleFotoUpload={handleFotoUpload} fotoInputRef={fotoInputRef}
      weerLoading={weerLoading} haalWeerOp={haalWeerOp}
      showDetail={showDetail} setShowDetail={setShowDetail}
      showMedForm={showMedForm} setShowMedForm={setShowMedForm} medForm={medForm} setMedForm={setMedForm}
      editMedId={editMedId} resetMedForm={resetMedForm} opslaanMedicatie={opslaanMedicatie}
      bewerkMedicatie={bewerkMedicatie} verwijderMedicatie={verwijderMedicatie} stopMedicatie={stopMedicatie}
      showAfspraakForm={showAfspraakForm} setShowAfspraakForm={setShowAfspraakForm}
      afspraakForm={afspraakForm} setAfspraakForm={setAfspraakForm} editAfspraakId={editAfspraakId}
      resetAfspraakForm={resetAfspraakForm} opslaanAfspraak={opslaanAfspraak}
      bewerkAfspraak={bewerkAfspraak} verwijderAfspraak={verwijderAfspraak} toggleAfspraakGedaan={toggleAfspraakGedaan}
      contacten={contacten} showContactForm={showContactForm} setShowContactForm={setShowContactForm}
      contactForm={contactForm} setContactForm={setContactForm} editContactId={editContactId}
      resetContactForm={resetContactForm} opslaanContact={opslaanContact}
      bewerkContact={bewerkContact} verwijderContact={verwijderContact}
      allergieen={allergieen} showAllergieForm={showAllergieForm} setShowAllergieForm={setShowAllergieForm}
      allergieForm={allergieForm} setAllergieForm={setAllergieForm} editAllergieId={editAllergieId}
      resetAllergieForm={resetAllergieForm} opslaanAllergie={opslaanAllergie}
      bewerkAllergie={bewerkAllergie} verwijderAllergie={verwijderAllergie}
      persoonProfielen={persoonProfielen} updatePersoonProfiel={updatePersoonProfiel}
      showNoodkaart={showNoodkaart} setShowNoodkaart={setShowNoodkaart}
      noodkaartBewerken={noodkaartBewerken} setNoodkaartBewerken={setNoodkaartBewerken}
      zoekAiPatronen={zoekAiPatronen} patronenLoading={patronenLoading} aiPatronen={aiPatronen}
      showDokterOverzicht={showDokterOverzicht} setShowDokterOverzicht={setShowDokterOverzicht}
      bouwDokterOverzicht={bouwDokterOverzicht} deelDokterOverzicht={deelDokterOverzicht}
      exporteerCsv={exporteerCsv} exporteerPrint={exporteerPrint}
      zoekVragenVoorDokter={zoekVragenVoorDokter} vragenlijstLoading={vragenlijstLoading} vragenlijst={vragenlijst}
      toast={toast}
    />
  );
}

function LEEG_FORM() {
  return { persoon: "Pepijn", datum: vandaagStr(), categorie: "overig", ernst: 0, benauwdheidScore: 0, notitie: "", foto: null, medicatieIds: [], hielp: "", weer: null, pollen: null };
}
function LEEG_MED_FORM() {
  return { persoon: "Pepijn", naam: "", dosering: "", frequentie: "", sinds: vandaagStr(), tot: "", reden: "", notitie: "" };
}
function LEEG_AFSPRAAK_FORM() {
  return { persoon: "Pepijn", type: "controle", omschrijving: "", datum: vandaagStr(), gedaan: false, notitie: "" };
}
const AFSPRAAK_TYPES = [
  { id: "controle",   label: "Controle",   icon: "🩺" },
  { id: "vaccinatie", label: "Vaccinatie", icon: "💉" },
  { id: "specialist", label: "Specialist", icon: "🏥" },
  { id: "overig",     label: "Overig",     icon: "📅" },
];
const AFSPRAAK_TYPE_MAP = Object.fromEntries(AFSPRAAK_TYPES.map(t => [t.id, t]));
const HIELP_OPTIES = [
  { id: "ja",    label: "Ja, hielp goed",  icon: "✅" },
  { id: "deels", label: "Deels",           icon: "🟡" },
  { id: "nee",   label: "Hielp niet",      icon: "❌" },
];
const HIELP_MAP = Object.fromEntries(HIELP_OPTIES.map(h => [h.id, h]));

function LEEG_CONTACT_FORM() {
  return { naam: "", type: "huisarts", telefoon: "", adres: "", notitie: "" };
}
const CONTACT_TYPES = [
  { id: "huisarts",   label: "Huisarts",    icon: "🩺" },
  { id: "specialist", label: "Specialist",  icon: "🏥" },
  { id: "apotheek",   label: "Apotheek",    icon: "💊" },
  { id: "tandarts",   label: "Tandarts",    icon: "🦷" },
  { id: "overig",     label: "Overig",      icon: "📇" },
];
const CONTACT_TYPE_MAP = Object.fromEntries(CONTACT_TYPES.map(t => [t.id, t]));

function LEEG_ALLERGIE_FORM() {
  return { persoon: "Pepijn", naam: "", type: "allergie", ernst: "matig", notitie: "" };
}
const ALLERGIE_ERNST = [
  { id: "licht",   label: "Licht",                    kleur: "#C97D0C" },
  { id: "matig",   label: "Matig",                     kleur: "#E06A1F" },
  { id: "ernstig", label: "Ernstig — levensbedreigend", kleur: "#D6273C" },
];
const ALLERGIE_ERNST_MAP = Object.fromEntries(ALLERGIE_ERNST.map(e => [e.id, e]));

const C = {
  bg: "#F5F6F4", surf: "#FFFFFF", card: "#EBEEEA",
  border: "#DBE0DA", accent: "#4A7A6B", accentDark: "#2E4F44",
  text: "#262A27", muted: "#8A9089", green: "#2D6A4F", red: "#C0392B", yellow: "#C97D0C", purple: "#6B5B95",
};
const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: C.accentDark },
  main: { padding: "4px 20px 120px" },
  inp: { background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 15, width: "100%", boxSizing: "border-box", color: C.text },
  btn: (bg=C.accent, col="#FFFFFF") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, marginBottom: 10 },
  fab: { position: "fixed", bottom: 28, right: 20, width: 52, height: 52, borderRadius: 16, background: C.accent, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px rgba(74,122,107,0.35)", zIndex: 50 },
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
  chip: (active, kleur=C.accent) => ({ border: `1px solid ${active ? kleur : C.border}`, background: active ? kleur : "#FFFFFF", color: active ? "#FFF" : C.muted, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }),
};

function ErnstStippen({ ernst }) {
  if (!ernst) return null;
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{ width: 5, height: 5, borderRadius: "50%", background: n <= ernst ? C.red : C.border }} />
      ))}
    </span>
  );
}

// Visuele, intuïtieve benauwdheidsmeter: een gekleurde schuifbalk (0-10) met
// een groot emoji + omschrijving die live meebeweegt.
function BenauwdheidsMeter({ waarde, onChange, interactief = true }) {
  const niveau = benauwdheidsNiveau(waarde);
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 4 }}>{niveau.emoji}</div>
      <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: niveau.kleur }}>{niveau.label}</p>
      {interactief ? (
        <input type="range" min={0} max={10} step={1} value={waarde}
          onChange={e => onChange(+e.target.value)}
          style={{ width: "100%", accentColor: niveau.kleur }} />
      ) : (
        <div style={{ height: 8, borderRadius: 4, background: C.border, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, width: `${waarde*10}%`, background: niveau.kleur, borderRadius: 4 }} />
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.muted, marginTop: 4 }}>
        <span>Geen last</span><span>Zeer ernstig</span>
      </div>
    </div>
  );
}

// Kleine, visuele badges voor het opgehaalde weer + hoogste pollenniveau.
function WeerPollenBadges({ weer, pollen, groot }) {
  if (!weer && !pollen) return null;
  const pn = pollen ? pollenNiveau(pollen.hoogsteWaarde) : null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {weer?.temperatuur != null && (
        <span style={{ fontSize: groot?12:10, background: C.card, borderRadius: 8, padding: groot?"4px 8px":"2px 6px", color: C.text }}>
          🌡️ {Math.round(weer.temperatuur)}°C
        </span>
      )}
      {weer?.luchtvochtigheid != null && (
        <span style={{ fontSize: groot?12:10, background: C.card, borderRadius: 8, padding: groot?"4px 8px":"2px 6px", color: C.text }}>
          💧 {Math.round(weer.luchtvochtigheid)}%
        </span>
      )}
      {weer?.windkmh != null && (
        <span style={{ fontSize: groot?12:10, background: C.card, borderRadius: 8, padding: groot?"4px 8px":"2px 6px", color: C.text }}>
          🌬️ {Math.round(weer.windkmh)} km/u
        </span>
      )}
      {pollen && (
        <span style={{ fontSize: groot?12:10, background: `${pn.kleur}18`, color: pn.kleur, fontWeight: 700, borderRadius: 8, padding: groot?"4px 8px":"2px 6px" }}>
          🌸 Pollen: {pn.label}{groot && pollen.hoogsteType ? ` (${pollen.hoogsteType})` : ""}
        </span>
      )}
    </div>
  );
}

function GezondheidView({
  klachten, zichtbaar, medicatie, medicatieZichtbaar, afspraken, offline, tab, setTab,
  persoonFilter, setPersoonFilter, catFilter, setCatFilter,
  showForm, setShowForm, form, setForm, editId, resetForm, opslaanKlacht,
  bewerkKlacht, verwijderKlacht, handleFotoUpload, fotoInputRef,
  weerLoading, haalWeerOp,
  showDetail, setShowDetail,
  showMedForm, setShowMedForm, medForm, setMedForm, editMedId, resetMedForm, opslaanMedicatie,
  bewerkMedicatie, verwijderMedicatie, stopMedicatie,
  showAfspraakForm, setShowAfspraakForm, afspraakForm, setAfspraakForm, editAfspraakId,
  resetAfspraakForm, opslaanAfspraak, bewerkAfspraak, verwijderAfspraak, toggleAfspraakGedaan,
  contacten, showContactForm, setShowContactForm, contactForm, setContactForm, editContactId,
  resetContactForm, opslaanContact, bewerkContact, verwijderContact,
  allergieen, showAllergieForm, setShowAllergieForm, allergieForm, setAllergieForm, editAllergieId,
  resetAllergieForm, opslaanAllergie, bewerkAllergie, verwijderAllergie,
  persoonProfielen, updatePersoonProfiel, showNoodkaart, setShowNoodkaart, noodkaartBewerken, setNoodkaartBewerken,
  zoekAiPatronen, patronenLoading, aiPatronen,
  showDokterOverzicht, setShowDokterOverzicht, bouwDokterOverzicht, deelDokterOverzicht,
  exporteerCsv, exporteerPrint,
  zoekVragenVoorDokter, vragenlijstLoading, vragenlijst,
  toast,
}) {
  const detailKlacht = showDetail ? klachten.find(k => k.id === showDetail) : null;
  const seizoenspatronen = berekenSeizoenspatronen(persoonFilter ? klachten.filter(k=>k.persoon===persoonFilter) : klachten);
  const recenteFrequentie = berekenRecenteFrequentie(persoonFilter ? klachten.filter(k=>k.persoon===persoonFilter) : klachten);
  const trendData = berekenTrendData(persoonFilter ? klachten.filter(k=>k.persoon===persoonFilter) : klachten);
  const weerCorrelatie = berekenWeerCorrelatie(persoonFilter ? klachten.filter(k=>k.persoon===persoonFilter) : klachten);
  const huidklachtenMetFoto = (persoonFilter ? klachten.filter(k=>k.persoon===persoonFilter) : klachten)
    .filter(k => k.categorie === "huidklachten" && k.foto)
    .slice().sort((a,b) => (a.datum||"").localeCompare(b.datum||""));
  const contactenZichtbaar = contacten;
  const allergieenZichtbaar = persoonFilter ? allergieen.filter(a=>a.persoon===persoonFilter) : allergieen;
  const afsprakenZichtbaar = (persoonFilter ? afspraken.filter(a=>a.persoon===persoonFilter) : afspraken)
    .slice().sort((a,b) => (a.gedaan===b.gedaan ? (a.datum||"").localeCompare(b.datum||"") : (a.gedaan?1:-1)));

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
          <h1 style={S.title}>🩺 Gezondheid</h1>
        </div>
      </header>

      <main style={S.main}>
        {/* Persoon-filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <button style={S.chip(!persoonFilter)} onClick={() => setPersoonFilter(null)}>Iedereen</button>
          {PERSONEN.map(p => (
            <button key={p.id} style={S.chip(persoonFilter === p.id, p.kleur)} onClick={() => setPersoonFilter(persoonFilter === p.id ? null : p.id)}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Allergie-waarschuwing — altijd zichtbaar zodra er een persoon
            geselecteerd is, ongeacht welk tabblad je op staat. Bewust niet
            weggestopt, want dit is precies het soort informatie dat je in
            één oogopslag wil kunnen zien. */}
        {persoonFilter && allergieen.filter(a=>a.persoon===persoonFilter).length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${C.red}12`, border: `1px solid ${C.red}44`, borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div style={{ flex: 1, fontSize: 12.5, color: C.text }}>
              <strong>Allergieën {persoonFilter}:</strong> {allergieen.filter(a=>a.persoon===persoonFilter).map(a => a.naam).join(", ")}
            </div>
            <button onClick={() => setShowNoodkaart(persoonFilter)} style={{ background: "none", border: "none", color: C.red, fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
              Noodkaart →
            </button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: C.card, borderRadius: 11, padding: 3, marginBottom: 14, overflowX: "auto" }}>
          {[["logboek","📋 Logboek"],["patronen","📈 Patronen"],["medicatie","💊 Medicatie"],["afspraken","📅 Afspraken"],["allergieen","⚠️ Allergieën"],["contacten","📇 Contacten"]].map(([id,label]) => (
            <button key={id} style={{ flexShrink:0, border:"none", background:tab===id?C.accent:"transparent", color:tab===id?"#FFF":C.muted, borderRadius:8, padding:"8px 12px", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}
              onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {/* ══ LOGBOEK ══ */}
        {tab === "logboek" && (
          <>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
              <button style={S.chip(!catFilter)} onClick={() => setCatFilter(null)}>Alles</button>
              {KLACHT_CATEGORIEEN.map(c => (
                <button key={c.id} style={S.chip(catFilter === c.id)} onClick={() => setCatFilter(catFilter === c.id ? null : c.id)}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>

            {zichtbaar.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: C.accentDark, margin: "0 0 6px" }}>
                  {klachten.length === 0 ? "Nog niets geregistreerd" : "Niets gevonden"}
                </p>
                <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>
                  {klachten.length === 0 ? "Tik op + om iets toe te voegen." : "Probeer een ander filter."}
                </p>
              </div>
            )}

            {zichtbaar.map(k => (
              <div key={k.id} style={{ ...S.card, display: "flex", gap: 12, cursor: "pointer" }} onClick={() => setShowDetail(k.id)}>
                {k.foto ? (
                  <img src={k.foto} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 10, background: C.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                    {KLACHT_CAT_MAP[k.categorie]?.icon || "📝"}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{KLACHT_CAT_MAP[k.categorie]?.label}</span>
                    <PersoonBadge persoon={k.persoon} />
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{formatDatum(k.datum)}</span>
                    {k.categorie === "benauwdheid" ? (
                      <span style={{ color: benauwdheidsNiveau(k.benauwdheidScore||0).kleur, fontWeight: 700 }}>
                        {benauwdheidsNiveau(k.benauwdheidScore||0).emoji} {k.benauwdheidScore||0}/10
                      </span>
                    ) : (
                      <ErnstStippen ernst={k.ernst} />
                    )}
                  </div>
                  {(k.weer || k.pollen) && <div style={{ marginTop: 4 }}><WeerPollenBadges weer={k.weer} pollen={k.pollen} /></div>}
                  {k.notitie && <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.notitie}</p>}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ══ PATRONEN ══ */}
        {tab === "patronen" && (
          <>
            <div style={S.card}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.text }}>📊 Trend — laatste 12 maanden</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="naam" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={20} />
                  <Tooltip contentStyle={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} formatter={v => [`${v}`, "registraties"]} />
                  <Bar dataKey="aantal" fill={C.accent} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ ...S.card, background: `${C.purple}10`, border: `1px solid ${C.purple}33` }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: C.purple }}>📈 Terugkerend per seizoen</p>
              <p style={{ margin: "0 0 10px", fontSize: 11, color: C.muted }}>Alleen categorieën die in minstens 2 verschillende jaren in dezelfde maand voorkwamen.</p>
              {seizoenspatronen.length === 0 && (
                <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Nog geen patroon te herkennen — dit wordt zinvoller naarmate er meer geregistreerd is over meerdere jaren.</p>
              )}
              {seizoenspatronen.map((p, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: idx>0 ? `1px solid ${C.border}` : "none", fontSize: 13 }}>
                  <span>{KLACHT_CAT_MAP[p.categorie]?.icon} {KLACHT_CAT_MAP[p.categorie]?.label} — vaak in <strong>{MAAND_NAMEN[p.maand]}</strong></span>
                  <span style={{ color: C.muted, fontSize: 11 }}>{p.aantalJaren}x verschillende jaren</span>
                </div>
              ))}
            </div>

            {recenteFrequentie.length > 0 && (
              <div style={{ ...S.card, background: `${C.yellow}10`, border: `1px solid ${C.yellow}33` }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.yellow }}>⏱ Laatste 90 dagen</p>
                {recenteFrequentie.map((f, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: idx>0 ? `1px solid ${C.border}` : "none", fontSize: 13 }}>
                    <span>{KLACHT_CAT_MAP[f.categorie]?.icon} {KLACHT_CAT_MAP[f.categorie]?.label}</span>
                    <span style={{ color: C.muted }}>{f.aantal}x</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ ...S.card }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.text }}>🔍 Diepere analyse (incl. notities)</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {PERSONEN.map(p => (
                  <button key={p.id} style={{ ...S.btn(C.card, p.kleur), border: `1px solid ${C.border}`, fontSize: 12, padding: "7px 12px" }}
                    onClick={() => zoekAiPatronen(p.id)} disabled={patronenLoading}>
                    {patronenLoading ? "Bezig…" : `Analyseer ${p.label}`}
                  </button>
                ))}
              </div>
              {aiPatronen && (
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: C.muted }}>Voor {aiPatronen.persoon}:</p>
                  {aiPatronen.patronen.length === 0 && <p style={{ fontSize: 12, color: C.muted }}>{aiPatronen.opmerking || "Niets gevonden"}</p>}
                  {aiPatronen.patronen.map((p, idx) => (
                    <p key={idx} style={{ fontSize: 13, margin: "0 0 8px", paddingLeft: 10, borderLeft: `2px solid ${C.purple}` }}>{p.observatie}</p>
                  ))}
                  <p style={{ fontSize: 10, color: C.muted, marginTop: 10 }}>Dit is geen medisch advies — bespreek opvallende patronen gerust met een (huis)arts.</p>
                </div>
              )}
            </div>

            {weerCorrelatie.length > 0 && (
              <div style={{ ...S.card, background: `${C.accent}10`, border: `1px solid ${C.accent}33` }}>
                <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: C.accentDark }}>🌸 Weer/pollen-verband</p>
                <p style={{ margin: "0 0 10px", fontSize: 11, color: C.muted }}>Van registraties met bekende pollendata — puur een aanwijzing, geen bewezen oorzaak.</p>
                {weerCorrelatie.map((w, idx) => (
                  <div key={idx} style={{ padding: "6px 0", borderTop: idx>0 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span>{KLACHT_CAT_MAP[w.categorie]?.icon} {KLACHT_CAT_MAP[w.categorie]?.label}</span>
                      <span style={{ fontWeight: 700, color: w.percentage >= 50 ? C.red : C.muted }}>{w.percentage}% bij hoge pollen</span>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: C.muted }}>
                      {w.hoogPollen} van de {w.metPollen} keer bij Hoog/Zeer hoog pollen{w.gemTemp != null ? ` · gem. ${w.gemTemp}°C` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {huidklachtenMetFoto.length > 0 && (
              <div style={S.card}>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.text }}>🔴 Huidklachten — verloop in foto's</p>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                  {huidklachtenMetFoto.map(k => (
                    <div key={k.id} style={{ flexShrink: 0, width: 84, textAlign: "center", cursor: "pointer" }} onClick={() => setShowDetail(k.id)}>
                      <img src={k.foto} alt="" style={{ width: 84, height: 84, borderRadius: 10, objectFit: "cover" }} />
                      <p style={{ margin: "4px 0 0", fontSize: 10, color: C.muted }}>{formatDatum(k.datum).replace(/ \d{4}$/,"")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={S.card}>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: C.text }}>🩺 Overzicht voor de dokter</p>
              <p style={{ margin: "0 0 10px", fontSize: 11, color: C.muted }}>Laatste 6 maanden klachten + huidige medicatie, in één keer te delen zodat je niet alles hoeft na te vertellen.</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PERSONEN.map(p => (
                  <button key={p.id} style={{ ...S.btn(C.card, p.kleur), border: `1px solid ${C.border}`, fontSize: 12, padding: "7px 12px" }}
                    onClick={() => setShowDokterOverzicht(p.id)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ ...S.card, background: `${C.purple}10`, border: `1px solid ${C.purple}33` }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: C.purple }}>❓ Vragenlijst voor de dokter</p>
              <p style={{ margin: "0 0 10px", fontSize: 11, color: C.muted }}>Op basis van je recente klachten en medicatie — alleen vragen áán de arts, geen eigen conclusies.</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PERSONEN.map(p => (
                  <button key={p.id} style={{ ...S.btn(C.card, p.kleur), border: `1px solid ${C.border}`, fontSize: 12, padding: "7px 12px" }}
                    onClick={() => zoekVragenVoorDokter(p.id)} disabled={vragenlijstLoading}>
                    {vragenlijstLoading ? "Bezig…" : p.label}
                  </button>
                ))}
              </div>
              {vragenlijst && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: C.muted }}>Voor {vragenlijst.persoon}:</p>
                  {vragenlijst.vragen.length === 0 && <p style={{ fontSize: 12, color: C.muted }}>Geen specifieke vragen gevonden.</p>}
                  <ol style={{ margin: 0, paddingLeft: 18 }}>
                    {vragenlijst.vragen.map((v, idx) => (
                      <li key={idx} style={{ fontSize: 13, marginBottom: 6, color: C.text }}>{v}</li>
                    ))}
                  </ol>
                  <p style={{ fontSize: 10, color: C.muted, marginTop: 10 }}>Dit zijn suggesties om aan de arts te vragen — geen antwoorden of medisch advies.</p>
                </div>
              )}
            </div>

            <div style={S.card}>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: C.text }}>📤 Volledig logboek exporteren</p>
              <p style={{ margin: "0 0 10px", fontSize: 11, color: C.muted }}>Voor je eigen archief, of om ergens anders te delen.</p>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={{ ...S.btn(C.card, C.accentDark), border: `1px solid ${C.border}`, flex: 1, fontSize: 12, padding: "9px 0" }} onClick={exporteerCsv}>
                  📄 CSV downloaden
                </button>
                <button style={{ ...S.btn(C.card, C.accentDark), border: `1px solid ${C.border}`, flex: 1, fontSize: 12, padding: "9px 0" }} onClick={() => exporteerPrint(persoonFilter)}>
                  🖨️ Printen / PDF
                </button>
              </div>
            </div>
          </>
        )}

        {/* ══ MEDICATIE ══ */}
        {tab === "medicatie" && (
          <>
            {medicatieZichtbaar.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: C.accentDark, margin: "0 0 6px" }}>Nog geen medicatie geregistreerd</p>
                <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>Tik op + om iets toe te voegen.</p>
              </div>
            )}
            {medicatieZichtbaar.map(m => {
              const actief = !m.tot || m.tot >= vandaagStr();
              const gebruiktVoor = klachten.filter(k => (k.medicatieIds||[]).includes(m.id));
              return (
                <div key={m.id} style={{ ...S.card }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Pill size={14} color={C.accent} />
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{m.naam}</span>
                        <PersoonBadge persoon={m.persoon} />
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>
                        {m.dosering}{m.dosering && m.frequentie ? " · " : ""}{m.frequentie}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>
                        Sinds {formatDatum(m.sinds)}{m.tot ? ` · tot ${formatDatum(m.tot)}` : ""}
                      </p>
                      {m.reden && <p style={{ margin: "4px 0 0", fontSize: 12, color: C.text }}>Reden: {m.reden}</p>}
                      {gebruiktVoor.length > 0 && (
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: C.purple }}>
                          🔗 Gekoppeld aan {gebruiktVoor.length} klacht{gebruiktVoor.length===1?"":"en"}
                          {gebruiktVoor.some(k=>k.hielp) && ` — ${gebruiktVoor.filter(k=>k.hielp==="ja").length}x hielp, ${gebruiktVoor.filter(k=>k.hielp==="nee").length}x niet`}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 8, background: actief ? `${C.green}18` : `${C.muted}18`, color: actief ? C.green : C.muted, whiteSpace: "nowrap" }}>
                      {actief ? "Actief" : "Gestopt"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    {actief && <button style={{ ...S.btn(C.card, C.yellow), border: `1px solid ${C.border}`, fontSize: 11, padding: "6px 10px" }} onClick={() => stopMedicatie(m.id)}>⏹ Stop vandaag</button>}
                    <button style={{ ...S.btn(C.card, C.text), border: `1px solid ${C.border}`, fontSize: 11, padding: "6px 10px" }} onClick={() => bewerkMedicatie(m)}>✏️ Bewerk</button>
                    <button style={{ ...S.btn(C.card, C.red), border: `1px solid ${C.border}`, fontSize: 11, padding: "6px 10px" }} onClick={() => verwijderMedicatie(m.id)}>🗑</button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ══ AFSPRAKEN ══ */}
        {tab === "afspraken" && (
          <>
            {afsprakenZichtbaar.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: C.accentDark, margin: "0 0 6px" }}>Nog geen afspraken</p>
                <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>Tik op + voor een controle, vaccinatie of specialistbezoek.</p>
              </div>
            )}
            {afsprakenZichtbaar.map(a => {
              const verlopen = !a.gedaan && a.datum < vandaagStr();
              return (
                <div key={a.id} style={{ ...S.card, opacity: a.gedaan ? 0.6 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => toggleAfspraakGedaan(a.id)}
                        style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${a.gedaan?C.green:C.border}`, background: a.gedaan?C.green:"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, marginTop:2 }}>
                        {a.gedaan && <span style={{ color:"#FFF", fontSize:12 }}>✓</span>}
                      </button>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap:"wrap" }}>
                          <span style={{ fontSize: 15, fontWeight: 700, textDecoration: a.gedaan ? "line-through" : "none" }}>
                            {AFSPRAAK_TYPE_MAP[a.type]?.icon} {a.omschrijving}
                          </span>
                          <PersoonBadge persoon={a.persoon} />
                        </div>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: verlopen ? C.red : C.muted, fontWeight: verlopen ? 700 : 400 }}>
                          {formatDatum(a.datum)}{verlopen ? " — verlopen, nog niet afgevinkt" : ""}
                        </p>
                        {a.notitie && <p style={{ margin: "4px 0 0", fontSize: 12, color: C.text }}>{a.notitie}</p>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, paddingLeft: 32 }}>
                    <button style={{ ...S.btn(C.card, C.text), border: `1px solid ${C.border}`, fontSize: 11, padding: "6px 10px" }} onClick={() => bewerkAfspraak(a)}>✏️ Bewerk</button>
                    <button style={{ ...S.btn(C.card, C.red), border: `1px solid ${C.border}`, fontSize: 11, padding: "6px 10px" }} onClick={() => verwijderAfspraak(a.id)}>🗑</button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ══ ALLERGIEËN ══ */}
        {tab === "allergieen" && (
          <>
            {allergieenZichtbaar.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: C.accentDark, margin: "0 0 6px" }}>Nog niets geregistreerd</p>
                <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>Tik op + voor een allergie of intolerantie.</p>
              </div>
            )}
            {allergieenZichtbaar.map(a => (
              <div key={a.id} style={{ ...S.card, borderLeft: `4px solid ${ALLERGIE_ERNST_MAP[a.ernst]?.kleur}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{a.naam}</span>
                      <PersoonBadge persoon={a.persoon} />
                    </div>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: C.muted }}>{a.type === "intolerantie" ? "Intolerantie" : "Allergie"}</p>
                    {a.notitie && <p style={{ margin: "4px 0 0", fontSize: 12, color: C.text }}>{a.notitie}</p>}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 8, background: `${ALLERGIE_ERNST_MAP[a.ernst]?.kleur}18`, color: ALLERGIE_ERNST_MAP[a.ernst]?.kleur, whiteSpace: "nowrap" }}>
                    {ALLERGIE_ERNST_MAP[a.ernst]?.label}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button style={{ ...S.btn(C.card, C.text), border: `1px solid ${C.border}`, fontSize: 11, padding: "6px 10px" }} onClick={() => bewerkAllergie(a)}>✏️ Bewerk</button>
                  <button style={{ ...S.btn(C.card, C.red), border: `1px solid ${C.border}`, fontSize: 11, padding: "6px 10px" }} onClick={() => verwijderAllergie(a.id)}>🗑</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ══ CONTACTEN ══ */}
        {tab === "contacten" && (
          <>
            <div style={{ ...S.card, background: `${C.red}0A`, border: `1px solid ${C.red}33` }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: C.red }}>🚨 Noodkaart</p>
              <p style={{ margin: "0 0 10px", fontSize: 11, color: C.muted }}>Alle spoedinformatie van één persoon samengevat — bloedgroep, allergieën, medicatie en noodcontact.</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PERSONEN.map(p => (
                  <button key={p.id} style={{ ...S.btn(C.card, p.kleur), border: `1px solid ${C.border}`, fontSize: 12, padding: "7px 12px" }}
                    onClick={() => { setShowNoodkaart(p.id); setNoodkaartBewerken(false); }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {contactenZichtbaar.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: C.accentDark, margin: "0 0 6px" }}>Nog geen contacten</p>
                <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>Tik op + voor je huisarts, apotheek of specialist.</p>
              </div>
            )}
            {contactenZichtbaar.map(c => (
              <div key={c.id} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{CONTACT_TYPE_MAP[c.type]?.icon} {c.naam}</span>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: C.muted }}>{CONTACT_TYPE_MAP[c.type]?.label}</p>
                    {c.telefoon && (
                      <a href={`tel:${c.telefoon.replace(/\s/g,"")}`} style={{ display: "block", margin: "6px 0 0", fontSize: 14, color: C.accent, fontWeight: 700, textDecoration: "none" }}>
                        📞 {c.telefoon}
                      </a>
                    )}
                    {c.adres && <p style={{ margin: "4px 0 0", fontSize: 12, color: C.text }}>{c.adres}</p>}
                    {c.notitie && <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>{c.notitie}</p>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button style={{ ...S.btn(C.card, C.text), border: `1px solid ${C.border}`, fontSize: 11, padding: "6px 10px" }} onClick={() => bewerkContact(c)}>✏️ Bewerk</button>
                  <button style={{ ...S.btn(C.card, C.red), border: `1px solid ${C.border}`, fontSize: 11, padding: "6px 10px" }} onClick={() => verwijderContact(c.id)}>🗑</button>
                </div>
              </div>
            ))}
          </>
        )}
      </main>

      {tab !== "patronen" && (
        <button style={S.fab} onClick={() => {
          if (tab === "medicatie") { resetMedForm(); setShowMedForm(true); }
          else if (tab === "afspraken") { resetAfspraakForm(); setShowAfspraakForm(true); }
          else if (tab === "contacten") { resetContactForm(); setShowContactForm(true); }
          else if (tab === "allergieen") { resetAllergieForm(); setShowAllergieForm(true); }
          else { resetForm(); setShowForm(true); }
        }} aria-label="Toevoegen">
          <Plus size={24} color="#FFFFFF" />
        </button>
      )}

      {/* Toevoeg/bewerk-formulier: klacht */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => { setShowForm(false); resetForm(); }}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>{editId ? "Registratie bewerken" : "Nieuwe registratie"}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => { setShowForm(false); resetForm(); }}>
                <X size={20} color={C.muted} />
              </button>
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Voor wie?</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {PERSONEN.map(p => (
                <button key={p.id} type="button" style={{ flex:1, ...S.chip(form.persoon === p.id, p.kleur), textAlign:"center", padding:"10px 0" }}
                  onClick={() => setForm(f => ({ ...f, persoon: p.id }))}>
                  {p.label}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Datum</label>
            <input style={{ ...S.inp, marginBottom: 14 }} type="date" value={form.datum}
              onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} />

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Categorie</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {KLACHT_CATEGORIEEN.map(c => (
                <button key={c.id} type="button" style={S.chip(form.categorie === c.id)}
                  onClick={() => setForm(f => ({ ...f, categorie: c.id }))}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>

            {form.categorie === "benauwdheid" ? (
              <div style={{ ...S.card, marginBottom: 14, background: C.card }}>
                <BenauwdheidsMeter waarde={form.benauwdheidScore||0} onChange={v => setForm(f => ({ ...f, benauwdheidScore: v }))} />
              </div>
            ) : (
              <>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Ernst (optioneel)</label>
                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setForm(f => ({ ...f, ernst: f.ernst === n ? 0 : n }))}
                      style={{ flex:1, height: 36, borderRadius: 8, border: `1px solid ${form.ernst >= n ? C.red : C.border}`, background: form.ernst >= n ? C.red : "#FFFFFF", cursor: "pointer" }} />
                  ))}
                </div>
              </>
            )}

            <div style={{ ...S.card, marginBottom: 14, background: `${C.accent}08` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: (form.weer||form.pollen) ? 8 : 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.accentDark }}>🌤️ Weer & pollen</span>
                <button type="button" onClick={haalWeerOp} disabled={weerLoading}
                  style={{ background: "none", border: "none", color: C.accent, fontSize: 11, fontWeight: 700, cursor: weerLoading ? "default" : "pointer" }}>
                  {weerLoading ? "Bezig…" : "🔄 Ververs"}
                </button>
              </div>
              {(form.weer || form.pollen) ? (
                <WeerPollenBadges weer={form.weer} pollen={form.pollen} groot />
              ) : (
                <p style={{ margin: 0, fontSize: 11, color: C.muted }}>
                  {form.datum === vandaagStr() ? "Nog niet opgehaald — tik op ververs (locatietoegang nodig)." : "Alleen beschikbaar voor vandaag."}
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
              {form.foto ? (
                <img src={form.foto} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover" }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 10, background: C.card, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Camera size={20} color={C.muted} />
                </div>
              )}
              <button type="button" style={{ ...S.btn(C.card, C.accentDark), border: `1px solid ${C.border}`, fontSize: 12, padding: "8px 12px" }}
                onClick={() => fotoInputRef.current?.click()}>
                Foto {form.foto ? "wijzigen" : "toevoegen"} (optioneel)
              </button>
              <input ref={fotoInputRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => { handleFotoUpload(e.target.files[0]); e.target.value = ""; }} />
            </div>

            {medicatie.filter(m => m.persoon === form.persoon).length > 0 && (
              <>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Medicatie hiervoor genomen? (optioneel)</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {medicatie.filter(m => m.persoon === form.persoon).map(m => {
                    const actief = (form.medicatieIds||[]).includes(m.id);
                    return (
                      <button key={m.id} type="button" style={S.chip(actief)}
                        onClick={() => setForm(f => ({ ...f, medicatieIds: actief ? f.medicatieIds.filter(id=>id!==m.id) : [...(f.medicatieIds||[]), m.id] }))}>
                        💊 {m.naam}
                      </button>
                    );
                  })}
                </div>
                {(form.medicatieIds||[]).length > 0 && (
                  <>
                    <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Hielp het?</label>
                    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                      {HIELP_OPTIES.map(h => (
                        <button key={h.id} type="button" style={{ flex:1, ...S.chip(form.hielp === h.id), textAlign:"center", padding:"8px 0" }}
                          onClick={() => setForm(f => ({ ...f, hielp: f.hielp === h.id ? "" : h.id }))}>
                          {h.icon} {h.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            <textarea style={{ ...S.inp, marginBottom: 16, height: 64, resize: "none", boxSizing: "border-box" }} placeholder="Notitie (optioneel — bv. mogelijke aanleiding, hoe erg, wat hielp)"
              value={form.notitie} onChange={e => setForm(f => ({ ...f, notitie: e.target.value }))} />

            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15 }} onClick={opslaanKlacht}>
              {editId ? "Opslaan" : "Toevoegen"}
            </button>
          </div>
        </div>
      )}

      {/* Detailweergave: klacht */}
      {detailKlacht && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => setShowDetail(null)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.accentDark }}>{KLACHT_CAT_MAP[detailKlacht.categorie]?.icon} {KLACHT_CAT_MAP[detailKlacht.categorie]?.label}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowDetail(null)}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            {detailKlacht.foto && <img src={detailKlacht.foto} alt="" style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 12, marginBottom: 14 }} />}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: C.muted }}>Voor wie</span><span><PersoonBadge persoon={detailKlacht.persoon} groot /> {detailKlacht.persoon}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: C.muted }}>Datum</span><span>{formatDatum(detailKlacht.datum)}</span>
              </div>
              {detailKlacht.categorie === "benauwdheid" ? (
                <div style={{ padding: "8px 0" }}>
                  <BenauwdheidsMeter waarde={detailKlacht.benauwdheidScore||0} interactief={false} />
                </div>
              ) : detailKlacht.ernst > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
                  <span style={{ color: C.muted }}>Ernst</span><ErnstStippen ernst={detailKlacht.ernst} />
                </div>
              )}
              {(detailKlacht.weer || detailKlacht.pollen) && (
                <div style={{ paddingTop: 4 }}>
                  <WeerPollenBadges weer={detailKlacht.weer} pollen={detailKlacht.pollen} groot />
                </div>
              )}
              {(detailKlacht.medicatieIds||[]).length > 0 && (
                <div style={{ fontSize: 13, marginTop: 4, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                  <span style={{ color: C.muted }}>💊 Medicatie: </span>
                  {detailKlacht.medicatieIds.map(id => medicatie.find(m=>m.id===id)?.naam).filter(Boolean).join(", ")}
                  {detailKlacht.hielp && (
                    <span style={{ marginLeft: 6, fontWeight: 700, color: HIELP_MAP[detailKlacht.hielp]?.id==="ja"?C.green:HIELP_MAP[detailKlacht.hielp]?.id==="nee"?C.red:C.yellow }}>
                      {HIELP_MAP[detailKlacht.hielp]?.icon} {HIELP_MAP[detailKlacht.hielp]?.label}
                    </span>
                  )}
                </div>
              )}
              {detailKlacht.notitie && (
                <div style={{ fontSize: 13, color: C.text, marginTop: 4, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                  📝 {detailKlacht.notitie}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn(C.card, C.accentDark), flex: 1, border: `1px solid ${C.border}` }} onClick={() => { setShowDetail(null); bewerkKlacht(detailKlacht); }}>
                Bewerken
              </button>
              <button style={{ ...S.btn(C.red), flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => verwijderKlacht(detailKlacht.id)}>
                <Trash2 size={14} /> Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toevoeg/bewerk-formulier: medicatie */}
      {showMedForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => { setShowMedForm(false); resetMedForm(); }}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>{editMedId ? "Medicatie bewerken" : "Medicatie toevoegen"}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => { setShowMedForm(false); resetMedForm(); }}>
                <X size={20} color={C.muted} />
              </button>
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Voor wie?</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {PERSONEN.map(p => (
                <button key={p.id} type="button" style={{ flex:1, ...S.chip(medForm.persoon === p.id, p.kleur), textAlign:"center", padding:"10px 0" }}
                  onClick={() => setMedForm(f => ({ ...f, persoon: p.id }))}>
                  {p.label}
                </button>
              ))}
            </div>

            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Naam medicijn" value={medForm.naam}
              onChange={e => setMedForm(f => ({ ...f, naam: e.target.value }))} autoFocus />
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input style={S.inp} placeholder="Dosering (bv. 500mg)" value={medForm.dosering}
                onChange={e => setMedForm(f => ({ ...f, dosering: e.target.value }))} />
              <input style={S.inp} placeholder="Frequentie (bv. 2x daags)" value={medForm.frequentie}
                onChange={e => setMedForm(f => ({ ...f, frequentie: e.target.value }))} />
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Sinds</label>
            <input style={{ ...S.inp, marginBottom: 10 }} type="date" value={medForm.sinds}
              onChange={e => setMedForm(f => ({ ...f, sinds: e.target.value }))} />

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Tot (leeg = nog actief)</label>
            <input style={{ ...S.inp, marginBottom: 10 }} type="date" value={medForm.tot}
              onChange={e => setMedForm(f => ({ ...f, tot: e.target.value }))} />

            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Reden (optioneel)" value={medForm.reden}
              onChange={e => setMedForm(f => ({ ...f, reden: e.target.value }))} />
            <textarea style={{ ...S.inp, marginBottom: 16, height: 56, resize: "none", boxSizing: "border-box" }} placeholder="Notitie (optioneel)"
              value={medForm.notitie} onChange={e => setMedForm(f => ({ ...f, notitie: e.target.value }))} />

            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15 }} onClick={opslaanMedicatie}>
              {editMedId ? "Opslaan" : "Toevoegen"}
            </button>
          </div>
        </div>
      )}

      {/* Toevoeg/bewerk-formulier: afspraak */}
      {showAfspraakForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => { setShowAfspraakForm(false); resetAfspraakForm(); }}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>{editAfspraakId ? "Afspraak bewerken" : "Afspraak toevoegen"}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => { setShowAfspraakForm(false); resetAfspraakForm(); }}>
                <X size={20} color={C.muted} />
              </button>
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Voor wie?</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {PERSONEN.map(p => (
                <button key={p.id} type="button" style={{ flex:1, ...S.chip(afspraakForm.persoon === p.id, p.kleur), textAlign:"center", padding:"10px 0" }}
                  onClick={() => setAfspraakForm(f => ({ ...f, persoon: p.id }))}>
                  {p.label}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Type</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {AFSPRAAK_TYPES.map(t => (
                <button key={t.id} type="button" style={S.chip(afspraakForm.type === t.id)}
                  onClick={() => setAfspraakForm(f => ({ ...f, type: t.id }))}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Omschrijving (bv. Griepprik, Controle huisarts)" value={afspraakForm.omschrijving}
              onChange={e => setAfspraakForm(f => ({ ...f, omschrijving: e.target.value }))} autoFocus />

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Datum</label>
            <input style={{ ...S.inp, marginBottom: 14 }} type="date" value={afspraakForm.datum}
              onChange={e => setAfspraakForm(f => ({ ...f, datum: e.target.value }))} />

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer" }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${afspraakForm.gedaan?C.green:C.border}`, background: afspraakForm.gedaan?C.green:"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}
                onClick={() => setAfspraakForm(f => ({ ...f, gedaan: !f.gedaan }))}>
                {afspraakForm.gedaan && <span style={{ color:"#FFF", fontSize:12 }}>✓</span>}
              </span>
              <span style={{ fontSize: 13, color: C.text }}>Al geweest/gedaan</span>
            </label>

            <textarea style={{ ...S.inp, marginBottom: 16, height: 56, resize: "none", boxSizing: "border-box" }} placeholder="Notitie (optioneel)"
              value={afspraakForm.notitie} onChange={e => setAfspraakForm(f => ({ ...f, notitie: e.target.value }))} />

            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15 }} onClick={opslaanAfspraak}>
              {editAfspraakId ? "Opslaan" : "Toevoegen"}
            </button>
          </div>
        </div>
      )}

      {/* Toevoeg/bewerk-formulier: contact */}
      {showContactForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => { setShowContactForm(false); resetContactForm(); }}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>{editContactId ? "Contact bewerken" : "Contact toevoegen"}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => { setShowContactForm(false); resetContactForm(); }}>
                <X size={20} color={C.muted} />
              </button>
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Type</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {CONTACT_TYPES.map(t => (
                <button key={t.id} type="button" style={S.chip(contactForm.type === t.id)}
                  onClick={() => setContactForm(f => ({ ...f, type: t.id }))}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Naam (bv. Huisartsenpraktijk De Linde)" value={contactForm.naam}
              onChange={e => setContactForm(f => ({ ...f, naam: e.target.value }))} autoFocus />
            <input style={{ ...S.inp, marginBottom: 10 }} type="tel" placeholder="Telefoonnummer" value={contactForm.telefoon}
              onChange={e => setContactForm(f => ({ ...f, telefoon: e.target.value }))} />
            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Adres (optioneel)" value={contactForm.adres}
              onChange={e => setContactForm(f => ({ ...f, adres: e.target.value }))} />
            <textarea style={{ ...S.inp, marginBottom: 16, height: 56, resize: "none", boxSizing: "border-box" }} placeholder="Notitie (optioneel)"
              value={contactForm.notitie} onChange={e => setContactForm(f => ({ ...f, notitie: e.target.value }))} />

            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15 }} onClick={opslaanContact}>
              {editContactId ? "Opslaan" : "Toevoegen"}
            </button>
          </div>
        </div>
      )}

      {/* Toevoeg/bewerk-formulier: allergie */}
      {showAllergieForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => { setShowAllergieForm(false); resetAllergieForm(); }}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>{editAllergieId ? "Bewerken" : "Allergie/intolerantie toevoegen"}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => { setShowAllergieForm(false); resetAllergieForm(); }}>
                <X size={20} color={C.muted} />
              </button>
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Voor wie?</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {PERSONEN.map(p => (
                <button key={p.id} type="button" style={{ flex:1, ...S.chip(allergieForm.persoon === p.id, p.kleur), textAlign:"center", padding:"10px 0" }}
                  onClick={() => setAllergieForm(f => ({ ...f, persoon: p.id }))}>
                  {p.label}
                </button>
              ))}
            </div>

            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Naam (bv. Pinda's, Penicilline, Lactose)" value={allergieForm.naam}
              onChange={e => setAllergieForm(f => ({ ...f, naam: e.target.value }))} autoFocus />

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Type</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {[["allergie","Allergie"],["intolerantie","Intolerantie"]].map(([id,label]) => (
                <button key={id} type="button" style={{ flex:1, ...S.chip(allergieForm.type === id), textAlign:"center", padding:"9px 0" }}
                  onClick={() => setAllergieForm(f => ({ ...f, type: id }))}>{label}</button>
              ))}
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Ernst</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {ALLERGIE_ERNST.map(e => (
                <button key={e.id} type="button" style={{ flex:1, border:`1px solid ${allergieForm.ernst===e.id?e.kleur:C.border}`, background:allergieForm.ernst===e.id?e.kleur:"#FFFFFF", color:allergieForm.ernst===e.id?"#FFF":C.muted, borderRadius:8, padding:"9px 4px", fontSize:11, fontWeight:600, cursor:"pointer" }}
                  onClick={() => setAllergieForm(f => ({ ...f, ernst: e.id }))}>{e.label}</button>
              ))}
            </div>

            <textarea style={{ ...S.inp, marginBottom: 16, height: 56, resize: "none", boxSizing: "border-box" }} placeholder="Notitie (optioneel — bv. reactie, wat te doen)"
              value={allergieForm.notitie} onChange={e => setAllergieForm(f => ({ ...f, notitie: e.target.value }))} />

            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15 }} onClick={opslaanAllergie}>
              {editAllergieId ? "Opslaan" : "Toevoegen"}
            </button>
          </div>
        </div>
      )}

      {/* Noodkaart */}
      {showNoodkaart && (() => {
        const profiel = persoonProfielen[showNoodkaart] || {};
        const allergieenVanPersoon = allergieen.filter(a => a.persoon === showNoodkaart);
        const medicatieVanPersoon = medicatie.filter(m => m.persoon === showNoodkaart && (!m.tot || m.tot >= vandaagStr()));
        const huisarts = contacten.find(c => c.type === "huisarts");
        const noodkaartTekst = [
          `NOODKAART — ${showNoodkaart}`,
          profiel.bloedgroep ? `Bloedgroep: ${profiel.bloedgroep}` : null,
          "",
          "Allergieën:",
          ...(allergieenVanPersoon.length ? allergieenVanPersoon.map(a => `• ${a.naam} (${ALLERGIE_ERNST_MAP[a.ernst]?.label})`) : ["  (geen bekend)"]),
          "",
          "Medicatie:",
          ...(medicatieVanPersoon.length ? medicatieVanPersoon.map(m => `• ${m.naam}${m.dosering?` — ${m.dosering}`:""}`) : ["  (geen)"]),
          "",
          profiel.noodcontactNaam ? `Noodcontact: ${profiel.noodcontactNaam}${profiel.noodcontactTelefoon?` — ${profiel.noodcontactTelefoon}`:""}` : null,
          huisarts ? `Huisarts: ${huisarts.naam}${huisarts.telefoon?` — ${huisarts.telefoon}`:""}` : null,
        ].filter(Boolean).join("\n");

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
            onClick={() => setShowNoodkaart(null)}>
            <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.red }}>🚨 Noodkaart — {showNoodkaart}</h2>
                <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowNoodkaart(null)}>
                  <X size={20} color={C.muted} />
                </button>
              </div>

              {noodkaartBewerken ? (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Bloedgroep</label>
                  <input style={{ ...S.inp, marginBottom: 10 }} placeholder="bv. O+" defaultValue={profiel.bloedgroep || ""}
                    onBlur={e => updatePersoonProfiel(showNoodkaart, "bloedgroep", e.target.value)} />
                  <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Noodcontact — naam</label>
                  <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Naam" defaultValue={profiel.noodcontactNaam || ""}
                    onBlur={e => updatePersoonProfiel(showNoodkaart, "noodcontactNaam", e.target.value)} />
                  <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Noodcontact — telefoon</label>
                  <input style={{ ...S.inp, marginBottom: 10 }} type="tel" placeholder="Telefoonnummer" defaultValue={profiel.noodcontactTelefoon || ""}
                    onBlur={e => updatePersoonProfiel(showNoodkaart, "noodcontactTelefoon", e.target.value)} />
                  <button style={{ ...S.btn(C.card, C.accentDark), border: `1px solid ${C.border}`, width: "100%", padding: "10px 0", fontSize: 13 }} onClick={() => setNoodkaartBewerken(false)}>
                    Klaar met bewerken
                  </button>
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "6px 0" }}>
                    <span style={{ color: C.muted }}>Bloedgroep</span><span>{profiel.bloedgroep || "—"}</span>
                  </div>
                  <div style={{ padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: C.red }}>⚠️ Allergieën</p>
                    {allergieenVanPersoon.length === 0 && <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Geen bekend</p>}
                    {allergieenVanPersoon.map(a => (
                      <p key={a.id} style={{ fontSize: 13, margin: "0 0 3px" }}>• {a.naam} <span style={{ color: ALLERGIE_ERNST_MAP[a.ernst]?.kleur, fontWeight: 700 }}>({ALLERGIE_ERNST_MAP[a.ernst]?.label})</span></p>
                    ))}
                  </div>
                  <div style={{ padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: C.text }}>💊 Huidige medicatie</p>
                    {medicatieVanPersoon.length === 0 && <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Geen</p>}
                    {medicatieVanPersoon.map(m => (
                      <p key={m.id} style={{ fontSize: 13, margin: "0 0 3px" }}>• {m.naam}{m.dosering ? ` — ${m.dosering}` : ""}</p>
                    ))}
                  </div>
                  <div style={{ padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: C.text }}>🚨 Noodcontact</p>
                    {profiel.noodcontactNaam ? (
                      <p style={{ fontSize: 13, margin: 0 }}>{profiel.noodcontactNaam}{profiel.noodcontactTelefoon ? ` — ${profiel.noodcontactTelefoon}` : ""}</p>
                    ) : <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Nog niet ingevuld</p>}
                    {huisarts && <p style={{ fontSize: 13, margin: "4px 0 0" }}>🩺 Huisarts: {huisarts.naam}{huisarts.telefoon ? ` — ${huisarts.telefoon}` : ""}</p>}
                  </div>
                  <button style={{ ...S.btn(C.card, C.accentDark), border: `1px solid ${C.border}`, width: "100%", padding: "9px 0", fontSize: 12, marginTop: 10 }} onClick={() => setNoodkaartBewerken(true)}>
                    ✏️ Bloedgroep/noodcontact bewerken
                  </button>
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btn(C.card, C.accentDark), flex: 1, border: `1px solid ${C.border}` }} onClick={() => setShowNoodkaart(null)}>
                  Sluiten
                </button>
                <button style={{ ...S.btn(C.red), flex: 1 }} onClick={() => {
                  if (navigator.share) navigator.share({ title: `Noodkaart ${showNoodkaart}`, text: noodkaartTekst }).catch(() => {});
                  else if (navigator.clipboard) navigator.clipboard.writeText(noodkaartTekst);
                }}>
                  📤 Delen / kopiëren
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Overzicht voor de dokter */}
      {showDokterOverzicht && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => setShowDokterOverzicht(null)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>🩺 Overzicht {showDokterOverzicht}</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setShowDokterOverzicht(null)}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            <pre style={{ background: C.card, borderRadius: 12, padding: 14, fontSize: 12, fontFamily: "inherit", whiteSpace: "pre-wrap", color: C.text, marginBottom: 16, maxHeight: "50vh", overflowY: "auto" }}>
              {bouwDokterOverzicht(showDokterOverzicht)}
            </pre>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn(C.card, C.accentDark), flex: 1, border: `1px solid ${C.border}` }} onClick={() => setShowDokterOverzicht(null)}>
                Sluiten
              </button>
              <button style={{ ...S.btn(), flex: 1 }} onClick={() => deelDokterOverzicht(showDokterOverzicht)}>
                📤 Delen / kopiëren
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
