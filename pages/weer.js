import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, MapPin, Plus, X, RefreshCw, Compass, Play, Pause, BarChart3, Map as MapIcon, Camera as CameraIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts";
import SunCalc from "suncalc";

// ═══════════════════════════════════════════════════════════════════════════════
// Weer — volledig herzien: voorheen 3 losse pagina's (weer / weer-radar / weer-zon)
// met elk hun eigen gedupliceerde kleuren en navigatie, nu samengevoegd tot één
// samenhangende tool met tabbladen (Vandaag / Radar / Zonkompas). Alle
// onderliggende logica (KNMI-nowcast, AR-zonkompas, kledingadvies, etc.) is
// letterlijk overgenomen — dit is een herstructurering, geen herschrijving van
// de hard bevochten berekeningen zelf.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Weer-iconen op basis van Open-Meteo's WMO weathercode ───────────────
const WEERCODE_INFO = {
  0:  { label: "Helder",              icon: "☀️", nachtIcon: "🌙" },
  1:  { label: "Overwegend helder",   icon: "🌤️", nachtIcon: "🌙" },
  2:  { label: "Half bewolkt",        icon: "⛅", nachtIcon: "☁️" },
  3:  { label: "Bewolkt",             icon: "☁️" },
  45: { label: "Mist",                icon: "🌫️" },
  48: { label: "Mist met rijp",       icon: "🌫️" },
  51: { label: "Lichte motregen",     icon: "🌦️" },
  53: { label: "Motregen",            icon: "🌦️" },
  55: { label: "Dichte motregen",     icon: "🌧️" },
  61: { label: "Lichte regen",        icon: "🌧️" },
  63: { label: "Regen",               icon: "🌧️" },
  65: { label: "Zware regen",         icon: "🌧️" },
  66: { label: "IJzel",               icon: "🌨️" },
  67: { label: "Zware ijzel",         icon: "🌨️" },
  71: { label: "Lichte sneeuw",       icon: "🌨️" },
  73: { label: "Sneeuw",              icon: "❄️" },
  75: { label: "Zware sneeuw",        icon: "❄️" },
  77: { label: "Sneeuwkorrels",       icon: "🌨️" },
  80: { label: "Lichte buien",        icon: "🌦️" },
  81: { label: "Buien",               icon: "🌧️" },
  82: { label: "Zware buien",         icon: "⛈️" },
  85: { label: "Sneeuwbuien",         icon: "🌨️" },
  86: { label: "Zware sneeuwbuien",   icon: "❄️" },
  95: { label: "Onweer",              icon: "⛈️" },
  96: { label: "Onweer met hagel",    icon: "⛈️" },
  99: { label: "Zwaar onweer met hagel", icon: "⛈️" },
};
// Open-Meteo gebruikt dezelfde weercode voor dag én nacht (bv. code 0
// "Helder" 's nachts net zo goed als overdag) — zonder het losse is_day-veld
// erbij te betrekken laat je 's nachts dus een zonnetje zien, wat natuurlijk
// niet kan. Voor codes waar dat visueel uitmaakt (helder/overwegend
// helder/half bewolkt) tonen we 's nachts een maan i.p.v. een zon; voor de
// rest (bewolkt, regen, sneeuw, onweer, mist) maakt dag/nacht niets uit.
function weerInfo(code, isDay = 1) {
  const info = WEERCODE_INFO[code] || { label: "Onbekend", icon: "❓" };
  if (!isDay && info.nachtIcon) return { ...info, icon: info.nachtIcon };
  return info;
}

const POLLEN_TYPES = [
  { id: "grass_pollen",   label: "Gras" },
  { id: "birch_pollen",   label: "Berk" },
  { id: "alder_pollen",   label: "Els" },
  { id: "mugwort_pollen", label: "Bijvoet" },
  { id: "olive_pollen",   label: "Olijf" },
  { id: "ragweed_pollen", label: "Ambrosia" },
];
const LUCHTKWALITEIT_NIVEAUS = [
  { max: 20,  label: "Goed",        kleur: "#2D6A4F" },
  { max: 40,  label: "Redelijk",    kleur: "#4C9A2A" },
  { max: 60,  label: "Matig",       kleur: "#C97D0C" },
  { max: 80,  label: "Onvoldoende", kleur: "#E06A1F" },
  { max: 100, label: "Slecht",      kleur: "#D6273C" },
  { max: Infinity, label: "Zeer slecht", kleur: "#8B1A2B" },
];
function luchtkwaliteitNiveau(waarde) {
  return LUCHTKWALITEIT_NIVEAUS.find(n => waarde <= n.max) || LUCHTKWALITEIT_NIVEAUS[LUCHTKWALITEIT_NIVEAUS.length-1];
}
const UV_NIVEAUS = [
  { max: 2,  label: "Laag",       kleur: "#2D6A4F" },
  { max: 5,  label: "Matig",      kleur: "#C97D0C" },
  { max: 7,  label: "Hoog",       kleur: "#E06A1F" },
  { max: 10, label: "Zeer hoog",  kleur: "#D6273C" },
  { max: Infinity, label: "Extreem", kleur: "#8B1A2B" },
];
function uvNiveau(waarde) {
  return UV_NIVEAUS.find(n => waarde <= n.max) || UV_NIVEAUS[UV_NIVEAUS.length-1];
}

function windrichting(graden) {
  const richtingen = ["N","NNO","NO","ONO","O","OZO","ZO","ZZO","Z","ZZW","ZW","WZW","W","WNW","NW","NNW"];
  return richtingen[Math.round(graden / 22.5) % 16];
}

// ── Datumhelpers — nooit toISOString(), die schuift rond middernacht ────
function vandaagStr() {
  const nu = new Date();
  return `${nu.getFullYear()}-${String(nu.getMonth()+1).padStart(2,"0")}-${String(nu.getDate()).padStart(2,"0")}`;
}

// ── Maanfase — via suncalc (mourner/suncalc, 3,4k sterren op GitHub, BSD-
//    licentie, geschreven door Leaflet's maker) i.p.v. een eigen formule.
const MAANFASEN = [
  { max: 0.033, label: "Nieuwe maan",      emoji: "🌑" },
  { max: 0.216, label: "Wassende sikkel",  emoji: "🌒" },
  { max: 0.283, label: "Eerste kwartier",  emoji: "🌓" },
  { max: 0.466, label: "Wassende maan",    emoji: "🌔" },
  { max: 0.533, label: "Volle maan",       emoji: "🌕" },
  { max: 0.716, label: "Afnemende maan",   emoji: "🌖" },
  { max: 0.783, label: "Laatste kwartier", emoji: "🌗" },
  { max: 0.966, label: "Afnemende sikkel", emoji: "🌘" },
  { max: 1,     label: "Nieuwe maan",      emoji: "🌑" },
];
function berekenMaanfase(datum = new Date()) {
  const { fraction, phase } = SunCalc.getMoonIllumination(datum);
  const fase = MAANFASEN.find(f => phase <= f.max) || MAANFASEN[MAANFASEN.length - 1];
  return { label: fase.label, emoji: fase.emoji, illuminatie: Math.round(fraction * 100) };
}

// ── Zonpositie — via suncalc, met een adapter voor de kompasrichting
//    (0°=zuid i.p.v. 0°=noord bij suncalc zelf, radialen i.p.v. graden). ──
function berekenZonPositie(lat, lon, datum = new Date()) {
  const pos = SunCalc.getPosition(datum, lat, lon);
  const azimutGraden = pos.azimuth * 180 / Math.PI;
  const kompasAzimut = (azimutGraden + 180 + 360) % 360;
  const elevatie = pos.altitude * 180 / Math.PI;
  return { azimut: kompasAzimut, elevatie };
}
function hoekVerschil(a, b) {
  let verschil = (a - b + 540) % 360 - 180;
  return verschil;
}

// ── Kledingadvies + fiets-regenwaarschuwing ──────────────────────────────
function kledingAdvies({ temperatuur, windkmh, uvMax, regenkansMax }) {
  const advies = [];
  if (temperatuur != null) {
    if (temperatuur < 5) advies.push("🧥 Dikke jas, muts en handschoenen — het is echt koud");
    else if (temperatuur < 12) advies.push("🧥 Warme jas aan");
    else if (temperatuur < 18) advies.push("🧶 Vest of lichte jas is genoeg");
    else if (temperatuur < 24) advies.push("👕 T-shirt-weer");
    else advies.push("🩳 Zomerkleding, het wordt warm");
  }
  if (windkmh != null && windkmh > 30) advies.push("💨 Stevige wind — houd rekening met een muts/haarelastiek");
  if (uvMax != null && uvMax >= 6) advies.push("🧴 Smeer je in — hoge zonkracht vandaag");
  if (regenkansMax != null && regenkansMax >= 50) advies.push("☂️ Neem een paraplu of regenjas mee");
  return advies;
}

// Checkt specifiek de opgegeven fietstijden (standaard 07-09u en 16-19u) op
// neerslag, en geeft een concrete, direct bruikbare waarschuwing terug —
// puur op basis van de uurlijkse voorspelling van vandaag.
function fietsWaarschuwing(hourly, vensters = [[7,9],[16,19]]) {
  if (!hourly?.time) return [];
  const waarschuwingen = [];
  vensters.forEach(([vanUur, totUur]) => {
    let maxKans = 0, maxNeerslag = 0;
    hourly.time.forEach((tijd, i) => {
      const datum = new Date(tijd);
      if (datum.toDateString() !== new Date().toDateString()) return;
      const uur = datum.getHours();
      if (uur >= vanUur && uur < totUur) {
        maxKans = Math.max(maxKans, hourly.precipitation_probability?.[i] ?? 0);
        maxNeerslag = Math.max(maxNeerslag, hourly.precipitation?.[i] ?? 0);
      }
    });
    if (maxKans >= 40 || maxNeerslag > 0.3) {
      waarschuwingen.push({
        venster: `${vanUur}:00–${totUur}:00`,
        kans: maxKans,
        tekst: `Let op: kans op regen (${maxKans}%) tussen ${vanUur}:00 en ${totUur}:00 — neem een regenjas mee als je dan op de fiets zit.`,
      });
    }
  });
  return waarschuwingen;
}

// ── Regenradar — helpers ─────────────────────────────────────────────────
const NEERSLAG_GRENZEN = { licht: 2.5, matig: 7.6 };
const TILE_SIZE = typeof window !== "undefined" && window.devicePixelRatio >= 2 ? 512 : 256;

function windVerschuiving(lat, windSnelheidKmh, windRichtingGraden, offsetMinuten) {
  const bewegingsrichting = (windRichtingGraden + 180) % 360;
  const afstandKm = windSnelheidKmh * (offsetMinuten / 60);
  const rad = bewegingsrichting * Math.PI / 180;
  const deltaLat = (afstandKm / 111) * Math.cos(rad);
  const deltaLon = (afstandKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(rad);
  return { deltaLat, deltaLon };
}

const KNMI_WMS_URL = "https://anonymous.api.dataplatform.knmi.nl/wms/adaguc-server";
function rondAfNaarVijfMinuten(datum) {
  const afgerond = new Date(datum);
  afgerond.setSeconds(0, 0);
  afgerond.setMinutes(Math.floor(afgerond.getMinutes() / 5) * 5);
  return afgerond;
}

// ── Stijlen (gedeeld door alle tabbladen) ─────────────────────────────────
const C = {
  bg: "#0F1B2D", surf: "#1B2B45", card: "#22335020",
  border: "#33456622", accent: "#5B9BD5", accentDark: "#F2A93B",
  text: "#F2F4F8", muted: "#8FA0BD", red: "#E0684F", green: "#4C9A6A",
};
const S = {
  appBg: { minHeight: "100vh", background: `linear-gradient(180deg, #14213D 0%, #0F1B2D 100%)`, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  main: { padding: "4px 20px 60px" },
  card: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 16, marginBottom: 12 },
  btn: (bg=C.accent, col="#0F1B2D") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  chip: (active) => ({ border: `1px solid ${active ? C.accent : "rgba(255,255,255,0.15)"}`, background: active ? C.accent : "rgba(255,255,255,0.06)", color: active ? "#0F1B2D" : C.text, borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }),
  inp: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "12px 16px", fontSize: 15, width: "100%", boxSizing: "border-box", color: C.text },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  tab: (active) => ({ flex: 1, border: "none", borderRadius: 8, padding: "9px 0", fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: active ? C.accent : "transparent", color: active ? "#0F1B2D" : C.muted, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }),
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function WeerApp() {
  const [tab, setTab] = useState("vandaag"); // "vandaag" | "radar" | "zonkompas"

  return (
    <div style={S.appBg}>
      <header style={S.header}>
        <div>
          <Link href="/" style={S.switchBtn}><ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> Terug</Link>
          <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700 }}>🌤️ Weer</h1>
        </div>
      </header>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.06)", borderRadius: 11, padding: 3, margin: "0 20px 4px" }}>
        <button style={S.tab(tab==="vandaag")} onClick={() => setTab("vandaag")}>☀️ Vandaag</button>
        <button style={S.tab(tab==="radar")} onClick={() => setTab("radar")}>🌧️ Radar</button>
        <button style={S.tab(tab==="zonkompas")} onClick={() => setTab("zonkompas")}>🧭 Zonkompas</button>
      </div>

      {tab === "vandaag" && <VandaagTab />}
      {tab === "radar" && <RadarTab />}
      {tab === "zonkompas" && <ZonkompasTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// VANDAAG — huidig weer, uurstrip, wind/UV/lucht, zon&maan, kledingadvies,
// 7-daagse vooruitblik, fietswaarschuwing, locatiebeheer.
// ══════════════════════════════════════════════════════════════════════════
function VandaagTab() {
  const [locaties, setLocaties] = useState([]);
  const [huidigePositie, setHuidigePositie] = useState(null); // { lat, lon } via GPS
  const [actieveLocatieId, setActieveLocatieId] = useState("huidige"); // "huidige" of locatie.id
  const [weerData, setWeerData] = useState(null);
  const [laden, setLaden] = useState(true);
  const [verversLaden, setVerversLaden] = useState(false);
  const [fout, setFout] = useState(null);
  const [showLocatieToevoegen, setShowLocatieToevoegen] = useState(false);
  const [zoekterm, setZoekterm] = useState("");
  const [zoekresultaten, setZoekresultaten] = useState([]);
  const [zoekLaden, setZoekLaden] = useState(false);
  const [uurDetailIdx, setUurDetailIdx] = useState(null);
  const lastWriteRef = useRef(0);

  // ── Locatie-instellingen laden/opslaan ─────────────────────
  useEffect(() => {
    let actief = true;
    fetch("/api/weer").then(r => r.json()).then(data => {
      if (!actief) return;
      setLocaties(data.locaties || []);
    }).catch(() => {}).finally(() => { if (actief) setLaden(false); });
    return () => { actief = false; };
  }, []);

  function persistLocaties(nextLocaties) {
    lastWriteRef.current = Date.now();
    setLocaties(nextLocaties);
    fetch("/api/weer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locaties: nextLocaties }),
    }).catch(() => {});
  }

  // ── GPS-locatie ophalen ─────────────────────────────────────
  const [huidigePlaatsnaam, setHuidigePlaatsnaam] = useState(null);

  const haalGpsOp = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setHuidigePositie({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setFout("Kon je locatie niet bepalen — geef de app locatietoegang, of voeg handmatig een locatie toe."),
      { timeout: 10000 }
    );
  }, []);
  useEffect(() => { haalGpsOp(); }, [haalGpsOp]);

  // Plaatsnaam bij de GPS-coördinaten opzoeken (reverse geocoding), zodat je
  // kunt controleren of "huidige locatie" ook echt klopt.
  useEffect(() => {
    if (!huidigePositie) return;
    let actief = true;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${huidigePositie.lat}&lon=${huidigePositie.lon}&zoom=14`)
      .then(r => r.json())
      .then(data => {
        if (!actief) return;
        const a = data.address || {};
        setHuidigePlaatsnaam(a.city || a.town || a.village || a.municipality || data.display_name?.split(",")[0] || null);
      })
      .catch(() => {});
    return () => { actief = false; };
  }, [huidigePositie]);

  // ── Actieve locatie bepalen ──────────────────────────────────
  const actieveLocatie = actieveLocatieId === "huidige"
    ? (huidigePositie ? { naam: huidigePlaatsnaam ? `Huidige locatie (${huidigePlaatsnaam})` : "Huidige locatie", lat: huidigePositie.lat, lon: huidigePositie.lon } : null)
    : locaties.find(l => l.id === actieveLocatieId);

  // ── Weer ophalen voor de actieve locatie ─────────────────────
  const laadWeer = useCallback(async () => {
    if (!actieveLocatie) return;
    setVerversLaden(true);
    setFout(null);
    try {
      const { lat, lon } = actieveLocatie;
      const [weerRes, luchtRes] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,uv_index,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum&timezone=auto&forecast_days=7`),
        fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=${POLLEN_TYPES.map(p=>p.id).join(",")},european_aqi,pm2_5,pm10&timezone=auto`),
      ]);
      if (!weerRes.ok) throw new Error("Weerdienst gaf een fout");
      const weer = await weerRes.json();
      const lucht = luchtRes.ok ? await luchtRes.json() : null;
      setWeerData({ ...weer, lucht: lucht?.current || null });
    } catch (e) {
      setFout("Kon het weer niet ophalen. Probeer het zo nog eens.");
    }
    setVerversLaden(false);
  }, [actieveLocatie]);

  useEffect(() => { if (actieveLocatie) laadWeer(); }, [actieveLocatie, laadWeer]);

  async function zoekLocatie(naam) {
    if (!naam.trim()) { setZoekresultaten([]); return; }
    setZoekLaden(true);
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(naam)}&count=5&language=nl`);
      const data = await res.json();
      setZoekresultaten(data.results || []);
    } catch { setZoekresultaten([]); }
    setZoekLaden(false);
  }

  function voegLocatieToe(resultaat) {
    const nieuw = { id: uid(), naam: resultaat.name + (resultaat.admin1 ? `, ${resultaat.admin1}` : ""), lat: resultaat.latitude, lon: resultaat.longitude };
    persistLocaties([...locaties, nieuw]);
    setActieveLocatieId(nieuw.id);
    setShowLocatieToevoegen(false);
    setZoekterm(""); setZoekresultaten([]);
  }

  function verwijderLocatie(id) {
    if (!window.confirm("Deze locatie verwijderen?")) return;
    persistLocaties(locaties.filter(l => l.id !== id));
    if (actieveLocatieId === id) setActieveLocatieId("huidige");
  }

  if (laden) return (
    <div style={S.loadingWrap}>
      <div style={{ fontSize: 40 }}>🌤️</div>
      <p style={{ color: C.muted, fontSize: 14 }}>Weer laden…</p>
    </div>
  );

  const huidig = weerData?.current;
  const daily = weerData?.daily;
  const hourly = weerData?.hourly;
  const vandaagIdx = daily?.time?.indexOf(vandaagStr()) ?? 0;
  const maan = berekenMaanfase();
  const fietsWaarschuwingen = fietsWaarschuwing(hourly);
  const advies = daily ? kledingAdvies({
    temperatuur: huidig?.temperature_2m,
    windkmh: huidig?.wind_speed_10m,
    uvMax: daily.uv_index_max?.[vandaagIdx],
    regenkansMax: Math.max(...(hourly?.precipitation_probability || [0]).slice(0, 24)),
  }) : [];

  // Eerstvolgende 12 uur voor de uurstrip — vanaf nu, niet vanaf middernacht.
  const nu = new Date();
  const uurStartIdx = hourly?.time?.findIndex(t => new Date(t) >= nu) ?? 0;
  const uurStrip = hourly?.time?.slice(uurStartIdx, uurStartIdx + 12).map((t, i) => ({
    tijd: new Date(t), temp: hourly.temperature_2m[uurStartIdx+i], code: hourly.weather_code[uurStartIdx+i],
    regenkans: hourly.precipitation_probability[uurStartIdx+i], isDag: hourly.is_day[uurStartIdx+i],
    neerslag: hourly.precipitation[uurStartIdx+i], uv: hourly.uv_index?.[uurStartIdx+i],
  })) || [];

  const lkn = weerData?.lucht?.european_aqi != null ? luchtkwaliteitNiveau(weerData.lucht.european_aqi) : null;
  const pollenWaarden = weerData?.lucht ? POLLEN_TYPES.map(p => ({ label: p.label, waarde: weerData.lucht[p.id] ?? 0 })) : [];
  const hoogstePollen = pollenWaarden.length ? pollenWaarden.reduce((max, p) => p.waarde > max.waarde ? p : max, pollenWaarden[0]) : null;
  const uurInDetail = uurDetailIdx != null ? uurStrip[uurDetailIdx] : null;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 20px", marginBottom: 4 }}>
        <button onClick={laadWeer} disabled={verversLaden}
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: verversLaden ? "default" : "pointer" }}>
          <RefreshCw size={15} color={C.accent} style={{ animation: verversLaden ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      <main style={S.main}>
        {/* Locatie-kiezer */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
          <button style={S.chip(actieveLocatieId === "huidige")} onClick={() => setActieveLocatieId("huidige")}>
            <MapPin size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />{huidigePlaatsnaam || "Huidige locatie"}
          </button>
          {locaties.map(l => (
            <button key={l.id} style={S.chip(actieveLocatieId === l.id)} onClick={() => setActieveLocatieId(l.id)}>
              {l.naam}
            </button>
          ))}
          <button style={{ ...S.chip(false), display: "flex", alignItems: "center", gap: 2 }} onClick={() => setShowLocatieToevoegen(true)}>
            <Plus size={13} /> Locatie
          </button>
        </div>

        {actieveLocatieId !== "huidige" && (
          <button onClick={() => verwijderLocatie(actieveLocatieId)} style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", padding: 0, marginBottom: 12, display: "block" }}>
            🗑 Deze locatie verwijderen
          </button>
        )}

        {!actieveLocatie && (
          <div style={S.card}>
            <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
              {fout || "Locatie wordt bepaald…"}
            </p>
          </div>
        )}

        {fout && actieveLocatie && (
          <div style={{ ...S.card, background: `${C.red}22`, border: `1px solid ${C.red}55` }}>
            <p style={{ margin: 0, fontSize: 13 }}>{fout}</p>
          </div>
        )}

        {/* Fiets-waarschuwing — bovenaan, want dit is precies waar de
            gebruiker om vroeg en dit mag niet gemist worden. */}
        {fietsWaarschuwingen.map((w, idx) => (
          <div key={idx} style={{ ...S.card, background: `${C.red}25`, border: `1px solid ${C.red}66`, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 24 }}>🚴☔</span>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{w.tekst}</p>
          </div>
        ))}

        {huidig && (
          <div style={{ ...S.card, textAlign: "center", padding: "28px 16px" }}>
            <p style={{ margin: "0 0 2px", fontSize: 14, color: C.muted }}>{actieveLocatie?.naam}</p>
            <div style={{ fontSize: 56, margin: "4px 0" }}>{weerInfo(huidig.weather_code, huidig.is_day).icon}</div>
            <p style={{ margin: 0, fontSize: 44, fontWeight: 700 }}>{Math.round(huidig.temperature_2m)}°</p>
            <p style={{ margin: "2px 0 0", fontSize: 15, color: C.muted }}>{weerInfo(huidig.weather_code, huidig.is_day).label}</p>
            {daily && (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: C.muted }}>
                ↑{Math.round(daily.temperature_2m_max?.[vandaagIdx])}° ↓{Math.round(daily.temperature_2m_min?.[vandaagIdx])}°
              </p>
            )}
          </div>
        )}

        {/* Uurstrip — elk uur is nu aan te tikken voor een detailkaartje
            (regenkans, neerslag in mm, UV) i.p.v. alleen het kale getal. */}
        {uurStrip.length > 0 && (
          <div style={{ ...S.card, overflowX: "auto" }}>
            <div style={{ display: "flex", gap: 18 }}>
              {uurStrip.map((u, idx) => (
                <button key={idx} onClick={() => setUurDetailIdx(i => i === idx ? null : idx)}
                  style={{ textAlign: "center", flexShrink: 0, background: uurDetailIdx===idx ? "rgba(91,155,213,0.18)" : "none", border: "none", borderRadius: 10, padding: "4px 6px", cursor: "pointer" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, color: C.muted }}>{idx === 0 ? "Nu" : u.tijd.getHours() + "u"}</p>
                  <div style={{ fontSize: 20 }}>{weerInfo(u.code, u.isDag).icon}</div>
                  <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 700 }}>{Math.round(u.temp)}°</p>
                  {u.regenkans > 20 && <p style={{ margin: "2px 0 0", fontSize: 10, color: C.accent }}>{u.regenkans}%</p>}
                </button>
              ))}
            </div>
            {uurInDetail && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-around", textAlign: "center" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.accent }}>{uurInDetail.regenkans}%</p>
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: C.muted }}>Regenkans</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{uurInDetail.neerslag?.toFixed(1) ?? 0} mm</p>
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: C.muted }}>Neerslag</p>
                </div>
                {uurInDetail.uv != null && (
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: uvNiveau(uurInDetail.uv).kleur }}>{Math.round(uurInDetail.uv)}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: C.muted }}>UV-index</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Wind / UV / Luchtkwaliteit */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
          {huidig && (
            <div style={{ ...S.card, textAlign: "center", padding: 12, marginBottom: 0 }}>
              <p style={{ margin: "0 0 4px", fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Wind</p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{Math.round(huidig.wind_speed_10m)} km/u</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>{windrichting(huidig.wind_direction_10m)}</p>
            </div>
          )}
          {daily && (
            <div style={{ ...S.card, textAlign: "center", padding: 12, marginBottom: 0 }}>
              <p style={{ margin: "0 0 4px", fontSize: 10, color: C.muted, textTransform: "uppercase" }}>UV-index</p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: uvNiveau(daily.uv_index_max?.[vandaagIdx]||0).kleur }}>{Math.round(daily.uv_index_max?.[vandaagIdx]||0)}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>{uvNiveau(daily.uv_index_max?.[vandaagIdx]||0).label}</p>
            </div>
          )}
          {lkn && (
            <div style={{ ...S.card, textAlign: "center", padding: 12, marginBottom: 0 }}>
              <p style={{ margin: "0 0 4px", fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Lucht</p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: lkn.kleur }}>{lkn.label}</p>
              {hoogstePollen && hoogstePollen.waarde > 0 && <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>🌸 {hoogstePollen.label}</p>}
            </div>
          )}
        </div>

        {/* Zon & maan */}
        {daily && (
          <div style={{ ...S.card, display: "flex", justifyContent: "space-around", textAlign: "center" }}>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 20 }}>🌅</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{daily.sunrise?.[vandaagIdx]?.slice(11,16)}</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: C.muted }}>Zonsopgang</p>
            </div>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 20 }}>🌇</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{daily.sunset?.[vandaagIdx]?.slice(11,16)}</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: C.muted }}>Zonsondergang</p>
            </div>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 20 }}>{maan.emoji}</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{maan.illuminatie}%</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: C.muted }}>{maan.label}</p>
            </div>
          </div>
        )}

        {/* Kledingadvies */}
        {advies.length > 0 && (
          <div style={S.card}>
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.accentDark }}>👔 Kledingadvies</p>
            {advies.map((a, idx) => (
              <p key={idx} style={{ margin: idx > 0 ? "6px 0 0" : 0, fontSize: 13 }}>{a}</p>
            ))}
          </div>
        )}

        {/* 7-daagse vooruitblik */}
        {daily && (
          <div style={S.card}>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.accentDark }}>7 dagen</p>
            {daily.time.map((t, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: idx>0 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                <span style={{ width: 70, fontSize: 12, color: C.muted }}>
                  {idx === vandaagIdx ? "Vandaag" : new Date(t).toLocaleDateString("nl-NL", { weekday: "short" })}
                </span>
                <span style={{ fontSize: 18 }}>{weerInfo(daily.weather_code[idx]).icon}</span>
                <span style={{ flex: 1 }} />
                {daily.precipitation_sum[idx] > 0.3 && <span style={{ fontSize: 11, color: C.accent, marginRight: 8 }}>💧{daily.precipitation_sum[idx].toFixed(1)}mm</span>}
                <span style={{ fontSize: 13, color: C.muted, width: 30, textAlign: "right" }}>{Math.round(daily.temperature_2m_min[idx])}°</span>
                <span style={{ fontSize: 13, fontWeight: 700, width: 30, textAlign: "right" }}>{Math.round(daily.temperature_2m_max[idx])}°</span>
              </div>
            ))}
          </div>
        )}
      </main>

      {showLocatieToevoegen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => setShowLocatieToevoegen(false)}>
          <div style={{ background: "#1B2B45", borderRadius: "20px 20px 0 0", padding: "20px 20px 32px", width: "100%", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Locatie toevoegen</h2>
              <button onClick={() => setShowLocatieToevoegen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            <input autoFocus style={{ ...S.inp, marginBottom: 14 }} placeholder="Zoek een plaats…" value={zoekterm}
              onChange={e => { setZoekterm(e.target.value); zoekLocatie(e.target.value); }} />
            {zoekLaden && <p style={{ fontSize: 13, color: C.muted }}>Zoeken…</p>}
            {zoekresultaten.map((r, idx) => (
              <button key={idx} onClick={() => voegLocatieToe(r)}
                style={{ display: "block", width: "100%", textAlign: "left", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", marginBottom: 8, color: C.text, cursor: "pointer" }}>
                📍 {r.name}{r.admin1 ? `, ${r.admin1}` : ""} <span style={{ color: C.muted, fontSize: 12 }}>({r.country})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// RADAR — RainViewer-verleden + KNMI pySTEPS-nowcast (2 uur vooruit, per 5
// min), interactieve Leaflet-kaart met tijdlijn, en een grafiekweergave op
// basis van Open-Meteo's 15-minuten-neerslagdata.
// ══════════════════════════════════════════════════════════════════════════
function RadarTab() {
  const [positie, setPositie] = useState(null);
  const [apiData, setApiData] = useState(null); // ruwe RainViewer-respons
  const [wind, setWind] = useState(null); // { snelheid, richting } via Open-Meteo
  const [frameIdx, setFrameIdx] = useState(0);
  const [afspelen, setAfspelen] = useState(false);
  const [laden, setLaden] = useState(true);
  const [modus, setModus] = useState("kaart"); // "kaart" | "grafiek"
  const [grafiekData, setGrafiekData] = useState(null);
  const [grafiekFout, setGrafiekFout] = useState(null);
  const [fout, setFout] = useState(null);
  const [knmiFout, setKnmiFout] = useState(false);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const radarLayerRef = useRef(null);
  const afspeelTimerRef = useRef(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setPositie({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setPositie({ lat: 52.1, lon: 5.3 }) // val terug op midden-Nederland i.p.v. vastlopen
    );
  }, []);

  // ── Neerslag-grafiekdata ophalen — Open-Meteo's 15-minuten-resolutie is
  //    een betrouwbaardere bron voor "hoeveel regen komt eraan" dan
  //    RainViewer's nowcast, die in de praktijk vaak leeg blijkt te zijn.
  useEffect(() => {
    if (!positie) return;
    let actief = true;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${positie.lat}&longitude=${positie.lon}&current=wind_speed_10m,wind_direction_10m&minutely_15=precipitation&hourly=precipitation&forecast_minutely_15=32&forecast_hours=8&timezone=auto`)
      .then(async r => {
        const data = await r.json();
        if (!r.ok || data.error) throw new Error(data.reason || `Open-Meteo gaf een fout (status ${r.status})`);
        return data;
      })
      .then(data => {
        if (!actief) return;
        if (data.current) setWind({ snelheid: data.current.wind_speed_10m, richting: data.current.wind_direction_10m });

        if (data.minutely_15?.time?.length > 0) {
          setGrafiekData(data.minutely_15.time.map((t, i) => ({
            tijd: new Date(t),
            neerslag: data.minutely_15.precipitation[i] ?? 0,
          })));
        } else if (data.hourly?.time?.length > 0) {
          setGrafiekData(data.hourly.time.map((t, i) => ({
            tijd: new Date(t),
            neerslag: data.hourly.precipitation[i] ?? 0,
          })));
          setGrafiekFout("Alleen uurlijkse data beschikbaar voor deze locatie (geen 15-minuten-resolutie).");
        } else {
          setGrafiekFout("Geen neerslagvoorspelling beschikbaar voor deze locatie.");
        }
      })
      .catch(e => { if (actief) setGrafiekFout(`Kon de neerslagvoorspelling niet ophalen: ${e.message}`); });
    return () => { actief = false; };
  }, [positie]);

  // ── RainViewer-tijdlijn ophalen ───────────────────────────────
  useEffect(() => {
    fetch("https://api.rainviewer.com/public/weather-maps.json")
      .then(r => r.json())
      .then(data => {
        setApiData(data);
        const past = data.radar?.past || [];
        setFrameIdx(Math.max(0, past.length - 1));
        setLaden(false);
      })
      .catch(() => { setFout("Kon de radardata niet ophalen bij RainViewer."); setLaden(false); });
  }, []);

  const echteFrames = apiData ? [...(apiData.radar?.past || []), ...(apiData.radar?.nowcast || [])] : [];
  const laatsteEchteFrame = echteFrames[echteFrames.length - 1];
  const nu5min = rondAfNaarVijfMinuten(new Date());
  const knmiFrames = Array.from({ length: 24 }, (_, i) => {
    const tijd = new Date(nu5min.getTime() + (i + 1) * 5 * 60 * 1000); // +5 t/m +120 min
    return { time: Math.floor(tijd.getTime() / 1000), knmiNowcast: true, isoTijd: tijd.toISOString().split(".")[0] + "Z" };
  });
  const alleFrames = [...echteFrames, ...knmiFrames];
  const huidigFrame = alleFrames[frameIdx];
  const aantalPastFrames = apiData?.radar?.past?.length || 0;

  // ── Leaflet-kaart opzetten ───────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !positie) return;

    function initMap() {
      if (mapInstanceRef.current || !mapRef.current) return;
      const map = window.L.map(mapRef.current, {
        zoomControl: true,
        dragging: true, touchZoom: true, scrollWheelZoom: true, doubleClickZoom: true,
      }).setView([positie.lat, positie.lon], 8);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);
      window.L.marker([positie.lat, positie.lon]).addTo(map);
      mapInstanceRef.current = map;
    }

    if (!window.L) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, [positie]);

  // ── Radar-laag bijwerken zodra het geselecteerde frame verandert ───────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !huidigFrame || !window.L) return;
    if (radarLayerRef.current) map.removeLayer(radarLayerRef.current);

    if (huidigFrame.knmiNowcast && !knmiFout) {
      const wmsLaag = window.L.tileLayer.wms(KNMI_WMS_URL, {
        DATASET: "radar_forecast_2.0",
        layers: "precipitation_nowcast",
        styles: "rainrate-blue-to-purple/shaded",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        time: huidigFrame.isoTijd,
        opacity: 0.75, zIndex: 5,
      });
      wmsLaag.on("tileerror", () => setKnmiFout(true));
      wmsLaag.addTo(map);
      radarLayerRef.current = wmsLaag;
      return;
    }

    if (huidigFrame.knmiNowcast && knmiFout) {
      if (!apiData || !laatsteEchteFrame || !wind) return;
      const bronLaag = window.L.tileLayer(
        `${apiData.host}${laatsteEchteFrame.path}/${TILE_SIZE}/{z}/{x}/{y}/2/1_1.png`,
        { opacity: 0.55, zIndex: 5, maxNativeZoom: 7 }
      );
      const offsetMinuten = Math.round((huidigFrame.time - laatsteEchteFrame.time) / 60);
      const { deltaLat, deltaLon } = windVerschuiving(positie.lat, wind.snelheid, wind.richting, offsetMinuten);
      const zoom = map.getZoom();
      const centerPx = map.project(map.getCenter(), zoom);
      const verschovenPx = map.project(window.L.latLng(map.getCenter().lat + deltaLat, map.getCenter().lng + deltaLon), zoom);
      const tegelDx = Math.round((verschovenPx.x - centerPx.x) / 256);
      const tegelDy = Math.round((verschovenPx.y - centerPx.y) / 256);
      const originaleGetTileUrl = bronLaag.getTileUrl.bind(bronLaag);
      bronLaag.getTileUrl = coords => originaleGetTileUrl({ x: coords.x - tegelDx, y: coords.y - tegelDy, z: coords.z });
      bronLaag.addTo(map);
      radarLayerRef.current = bronLaag;
      return;
    }

    if (!apiData) return;
    const laag = window.L.tileLayer(
      `${apiData.host}${huidigFrame.path}/${TILE_SIZE}/{z}/{x}/{y}/2/1_1.png`,
      { opacity: 0.75, zIndex: 5, maxNativeZoom: 7 }
    );
    laag.addTo(map);
    radarLayerRef.current = laag;
  }, [apiData, huidigFrame, knmiFout, wind, positie, laatsteEchteFrame]);

  // ── Animatie ─────────────────────────────────────────────────
  useEffect(() => {
    if (!afspelen || alleFrames.length === 0) return;
    afspeelTimerRef.current = setInterval(() => {
      setFrameIdx(i => (i + 1) % alleFrames.length);
    }, 600);
    return () => clearInterval(afspeelTimerRef.current);
  }, [afspelen, alleFrames.length]);

  function formatFrameTijd(unixTijd) {
    return new Date(unixTijd * 1000).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <>
      <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.06)", borderRadius: 11, padding: 3, margin: "0 20px 12px" }}>
        <button onClick={() => setModus("grafiek")} style={{ flex: 1, border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", background: modus==="grafiek"?C.accent:"transparent", color: modus==="grafiek"?"#0F1B2D":C.muted }}>
          <BarChart3 size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />Grafiek
        </button>
        <button onClick={() => setModus("kaart")} style={{ flex: 1, border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", background: modus==="kaart"?C.accent:"transparent", color: modus==="kaart"?"#0F1B2D":C.muted }}>
          <MapIcon size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />Radar
        </button>
      </div>

      {modus === "grafiek" && (
        <NeerslagGrafiek data={grafiekData} fout={grafiekFout} />
      )}

      {modus === "kaart" && (
        <>
      {fout && <p style={{ textAlign: "center", color: "#E0684F", fontSize: 13, padding: "0 20px" }}>{fout}</p>}
      {laden && <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 20 }}>Radar laden…</p>}

      <div ref={mapRef} style={{ width: "100%", height: "56vh", background: "#1B2B45" }} />

      {alleFrames.length > 0 && (
        <div style={{ padding: "16px 20px" }}>
          <TijdlijnStrip alleFrames={alleFrames} frameIdx={frameIdx} aantalPastFrames={aantalPastFrames}
            onKies={idx => { setAfspelen(false); setFrameIdx(idx); }} formatFrameTijd={formatFrameTijd} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <button onClick={() => setAfspelen(a => !a)}
              style={{ background: C.accent, border: "none", borderRadius: 10, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {afspelen ? <Pause size={16} color="#0F1B2D" /> : <Play size={16} color="#0F1B2D" />}
            </button>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                {huidigFrame ? formatFrameTijd(huidigFrame.time) : "—"}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: frameIdx >= aantalPastFrames ? C.accentDark : C.muted }}>
                {frameIdx >= aantalPastFrames ? "Verwachting" : frameIdx === aantalPastFrames - 1 ? "Nu" : "Verleden"}
              </p>
            </div>
            <div style={{ width: 40 }} />
          </div>

          {huidigFrame?.knmiNowcast && !knmiFout && (
            <div style={{ marginTop: 12, background: "rgba(91,155,213,0.10)", border: "1px solid rgba(91,155,213,0.3)", borderRadius: 12, padding: 12 }}>
              <p style={{ margin: 0, fontSize: 11.5, color: C.text }}>
                🔬 Echte voorspelling van <strong>KNMI</strong> (pySTEPS-nowcast, per 5 minuten bijgewerkt). Zoals bij elke buienvoorspelling geldt: hoe verder vooruit, hoe onzekerder — buien kunnen sneller groeien, afzwakken of van richting veranderen dan voorspeld.
              </p>
            </div>
          )}
          {huidigFrame?.knmiNowcast && knmiFout && (
            <div style={{ marginTop: 12, background: "rgba(242,169,59,0.12)", border: "1px solid rgba(242,169,59,0.35)", borderRadius: 12, padding: 12 }}>
              <p style={{ margin: 0, fontSize: 11.5, color: C.text }}>
                ⚠️ KNMI's voorspellingsdienst is momenteel niet bereikbaar — dit is nu een <strong>ruwe schatting</strong>: het laatste radarbeeld verschoven op basis van windrichting ({Math.round(wind?.richting ?? 0)}°) en -snelheid ({Math.round(wind?.snelheid ?? 0)} km/u). Minder betrouwbaar dan normaal.
              </p>
            </div>
          )}
        </div>
      )}

      <p style={{ textAlign: "center", fontSize: 10.5, color: C.muted, padding: "8px 20px 24px" }}>
        Verleden: <a href="https://www.rainviewer.com" target="_blank" rel="noreferrer" style={{ color: C.accent }}>RainViewer</a>
        {" "}· Toekomst: <a href="https://www.knmi.nl" target="_blank" rel="noreferrer" style={{ color: C.accent }}>KNMI</a>
        {" "}· kaart via OpenStreetMap
      </p>
      </>
      )}
    </>
  );
}

function NeerslagGrafiek({ data, fout }) {
  if (fout && !data) return <p style={{ textAlign: "center", color: "#E0684F", fontSize: 13, padding: 20 }}>{fout}</p>;
  if (!data) return <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 20 }}>Grafiek laden…</p>;

  const chartData = data.map(d => ({
    label: d.tijd.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }),
    neerslag: Math.round(d.neerslag * 10) / 10,
  }));
  const totaalNeerslag = data.reduce((s, d) => s + d.neerslag, 0);
  const maxNeerslag = Math.max(...data.map(d => d.neerslag), NEERSLAG_GRENZEN.matig + 1);

  return (
    <div style={{ padding: "4px 20px 24px" }}>
      {fout && (
        <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "#F2A93B", background: "rgba(242,169,59,0.12)", border: "1px solid rgba(242,169,59,0.3)", borderRadius: 10, padding: "8px 12px" }}>
          ⚠️ {fout}
        </p>
      )}
      <p style={{ margin: "0 0 4px", fontSize: 13, color: C.muted }}>
        {totaalNeerslag < 0.1 ? "Geen neerslag verwacht de komende uren" : `Totaal ${totaalNeerslag.toFixed(1)} mm verwacht de komende uren`}
      </p>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 8px 6px" }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 9 }} interval={3} axisLine={false} tickLine={false} />
            <YAxis domain={[0, maxNeerslag]} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={{ background: "#1B2B45", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, fontSize: 12 }}
              formatter={v => [`${v} mm/u`, "Neerslag"]} />
            <ReferenceLine y={NEERSLAG_GRENZEN.licht} stroke="#4C9A2A" strokeDasharray="4 4" label={{ value: "Licht", position: "right", fill: "#4C9A2A", fontSize: 10 }} />
            <ReferenceLine y={NEERSLAG_GRENZEN.matig} stroke="#C97D0C" strokeDasharray="4 4" label={{ value: "Matig", position: "right", fill: "#C97D0C", fontSize: 10 }} />
            <Bar dataKey="neerslag" radius={[3,3,0,0]}>
              {chartData.map((d, idx) => (
                <Cell key={idx} fill={d.neerslag >= NEERSLAG_GRENZEN.matig ? "#E0684F" : d.neerslag >= NEERSLAG_GRENZEN.licht ? "#F2A93B" : C.accent} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p style={{ fontSize: 10.5, color: C.muted, textAlign: "center", marginTop: 10 }}>
        Neerslagvoorspelling in blokjes van 15 minuten, via Open-Meteo.
      </p>
    </div>
  );
}

function TijdlijnStrip({ alleFrames, frameIdx, aantalPastFrames, onKies, formatFrameTijd }) {
  const stripRef = useRef(null);
  const tikRefs = useRef({});

  useEffect(() => {
    const tik = tikRefs.current[frameIdx];
    const strip = stripRef.current;
    if (!tik || !strip) return;
    const doelLinks = tik.offsetLeft - strip.clientWidth / 2 + tik.clientWidth / 2;
    strip.scrollTo({ left: doelLinks, behavior: "smooth" });
  }, [frameIdx]);

  return (
    <div ref={stripRef} style={{ display: "flex", gap: 6, overflowX: "auto", scrollSnapType: "x proximity", paddingBottom: 6, WebkitOverflowScrolling: "touch" }}>
      {alleFrames.map((frame, idx) => {
        const actief = idx === frameIdx;
        const isNu = idx === aantalPastFrames - 1;
        const isVerwachting = idx >= aantalPastFrames;
        return (
          <button key={idx} ref={el => { tikRefs.current[idx] = el; }} onClick={() => onKies(idx)}
            style={{
              flexShrink: 0, scrollSnapAlign: "center", minWidth: 54, padding: "8px 4px",
              borderRadius: 10, border: actief ? `1.5px solid ${isVerwachting ? C.accentDark : C.accent}` : "1px solid rgba(255,255,255,0.1)",
              background: actief ? (isVerwachting ? "rgba(242,169,59,0.18)" : "rgba(91,155,213,0.18)") : "rgba(255,255,255,0.04)",
              color: actief ? "#FFF" : C.muted, cursor: "pointer", textAlign: "center",
            }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: actief ? 700 : 400 }}>{formatFrameTijd(frame.time)}</p>
            {isNu && <p style={{ margin: "2px 0 0", fontSize: 9, color: C.accent, fontWeight: 700 }}>NU</p>}
            {frame.knmiNowcast && <p style={{ margin: "2px 0 0", fontSize: 9, color: C.accentDark, fontWeight: 700 }}>KNMI</p>}
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ZONKOMPAS — live zonpositie, kompasweergave met dagpad, en een
// camera/AR-modus die laat zien waar de zon staat t.o.v. waar je telefoon
// naartoe wijst.
// ══════════════════════════════════════════════════════════════════════════
function ZonkompasTab() {
  const [modus, setModus] = useState("kompas"); // "kompas" | "camera"
  const [positie, setPositie] = useState(null);
  const [nu, setNu] = useState(new Date());
  const [heading, setHeading] = useState(null);
  const [headingBeschikbaar, setHeadingBeschikbaar] = useState(null); // null=onbekend, true/false
  const [kalibratieOffset, setKalibratieOffset] = useState(0);
  const [toonKalibratie, setToonKalibratie] = useState(false);
  useEffect(() => {
    try {
      const opgeslagen = window.localStorage.getItem("huisplatform_weer_kompas_offset");
      if (opgeslagen) setKalibratieOffset(+opgeslagen);
    } catch {}
  }, []);
  function wijzigKalibratie(nieuweOffset) {
    setKalibratieOffset(nieuweOffset);
    try { window.localStorage.setItem("huisplatform_weer_kompas_offset", String(nieuweOffset)); } catch {}
  }
  const gecorrigeerdeHeading = heading != null ? (heading + kalibratieOffset + 360) % 360 : null;
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraFout, setCameraFout] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setPositie({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}
    );
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNu(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const zonPositie = positie ? berekenZonPositie(positie.lat, positie.lon, nu) : null;

  // ── Kompas-richting (device-oriëntatie) ────────────────────────────────
  const zetOrientatieListener = useCallback(() => {
    const handler = e => {
      if (typeof e.webkitCompassHeading === "number") {
        setHeading(e.webkitCompassHeading);
        setHeadingBeschikbaar(true);
      } else if (e.absolute && e.alpha != null) {
        setHeading((360 - e.alpha) % 360);
        setHeadingBeschikbaar(true);
      }
    };
    window.addEventListener("deviceorientationabsolute", handler);
    window.addEventListener("deviceorientation", handler);
    setTimeout(() => setHeadingBeschikbaar(h => h === null ? false : h), 2000);
    return () => {
      window.removeEventListener("deviceorientationabsolute", handler);
      window.removeEventListener("deviceorientation", handler);
    };
  }, []);

  useEffect(() => {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      setHeadingBeschikbaar("needsPermission");
      return;
    }
    return zetOrientatieListener();
  }, [zetOrientatieListener]);

  async function vraagKompasToestemming() {
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result === "granted") zetOrientatieListener();
      else setHeadingBeschikbaar(false);
    } catch {
      setHeadingBeschikbaar(false);
    }
  }

  async function startCamera() {
    setCameraFout(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(stream);
      setModus("camera");
    } catch {
      setCameraFout("Kon geen toegang krijgen tot de camera — check de locatietoestemmingen van de browser in je instellingen.");
    }
  }
  useEffect(() => {
    if (modus === "camera" && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [modus, cameraStream]);
  useEffect(() => {
    return () => { cameraStream?.getTracks().forEach(t => t.stop()); };
  }, [cameraStream]);

  const relatieveHoek = zonPositie && gecorrigeerdeHeading != null ? hoekVerschil(zonPositie.azimut, gecorrigeerdeHeading) : null;
  const CAMERA_FOV = 34; // halve gezichtsveld-hoek in graden, ruwe aanname voor een telefooncamera
  const zonInBeeld = relatieveHoek != null && Math.abs(relatieveHoek) <= CAMERA_FOV;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center", padding: "0 20px", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.06)", borderRadius: 11, padding: 3 }}>
          <button onClick={() => setModus("kompas")} style={{ border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", background: modus==="kompas"?C.accent:"transparent", color: modus==="kompas"?"#0F1B2D":C.muted }}>
            <Compass size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />Kompas
          </button>
          <button onClick={() => cameraStream ? setModus("camera") : startCamera()} style={{ border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", background: modus==="camera"?C.accent:"transparent", color: modus==="camera"?"#0F1B2D":C.muted }}>
            <CameraIcon size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />Camera
          </button>
        </div>
      </div>

      {!positie && (
        <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 20 }}>Locatie wordt bepaald…</p>
      )}

      {headingBeschikbaar === "needsPermission" && (
        <div style={{ margin: "0 20px 16px", background: "rgba(91,155,213,0.12)", border: "1px solid rgba(91,155,213,0.4)", borderRadius: 12, padding: 14, textAlign: "center" }}>
          <p style={{ margin: "0 0 10px", fontSize: 12.5 }}>
            Voor de kompasrichting van je telefoon heeft dit toestel expliciet toestemming nodig.
          </p>
          <button onClick={vraagKompasToestemming} style={{ background: C.accent, color: "#0F1B2D", border: "none", borderRadius: 12, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            🧭 Geef kompastoegang
          </button>
        </div>
      )}

      {headingBeschikbaar === false && (
        <div style={{ margin: "0 20px 16px", background: "rgba(224,104,79,0.15)", border: "1px solid rgba(224,104,79,0.4)", borderRadius: 12, padding: 14 }}>
          <p style={{ margin: 0, fontSize: 12.5 }}>
            ⚠️ Kon geen kompasrichting van je toestel krijgen (toestemming geweigerd, of niet ondersteund door deze browser). De kaart hieronder toont de zonpositie nog wel, maar zonder aan te geven waar je telefoon zelf naartoe wijst.
          </p>
        </div>
      )}

      {modus === "kompas" && positie && zonPositie && (
        <>
          {headingBeschikbaar === true && (
            <div style={{ margin: "0 20px 12px", textAlign: "center" }}>
              <button onClick={() => setToonKalibratie(v => !v)} style={{ background: "none", border: "none", color: C.muted, fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}>
                Klopt de richting niet helemaal? Kalibreer hier
              </button>
              {toonKalibratie && (
                <div style={{ marginTop: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 14 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 12 }}>
                    Sleep tot de zon op de kaart klopt met waar je 'm daadwerkelijk ziet staan.
                  </p>
                  <input type="range" min={-30} max={30} step={1} value={kalibratieOffset}
                    onChange={e => wijzigKalibratie(+e.target.value)}
                    style={{ width: "100%", accentColor: C.accent }} />
                  <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 700 }}>{kalibratieOffset > 0 ? "+" : ""}{kalibratieOffset}°</p>
                </div>
              )}
            </div>
          )}
          <KompasWeergave zonPositie={zonPositie} heading={gecorrigeerdeHeading} positie={positie} nu={nu} />
        </>
      )}

      {modus === "camera" && (
        <CameraWeergave
          videoRef={videoRef} cameraStream={cameraStream} cameraFout={cameraFout}
          zonPositie={zonPositie} relatieveHoek={relatieveHoek} zonInBeeld={zonInBeeld}
          headingBeschikbaar={headingBeschikbaar} onOpnieuw={startCamera}
          kalibratieOffset={kalibratieOffset} wijzigKalibratie={wijzigKalibratie}
        />
      )}
    </>
  );
}

function KompasWeergave({ zonPositie, heading, positie, nu }) {
  const r = 110, cx = 140, cy = 140;
  const punt = (graden, straal) => {
    const rad = (graden - 90) * Math.PI / 180; // 0° = boven (noord)
    return { x: cx + straal * Math.cos(rad), y: cy + straal * Math.sin(rad) };
  };
  const zonPunt = punt(zonPositie.azimut, r * 0.85);
  const naaldPunt = heading != null ? punt(heading, r * 0.7) : null;

  const pad = [];
  for (let m = 0; m < 24*60; m += 15) {
    const t = new Date(nu); t.setHours(0, m, 0, 0);
    const p = berekenZonPositie(positie.lat, positie.lon, t);
    if (p.elevatie > 0) pad.push(punt(p.azimut, r * 0.85));
  }

  return (
    <div style={{ padding: 20 }}>
      <svg viewBox="0 0 280 280" style={{ width: "100%", maxWidth: 340, display: "block", margin: "0 auto" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={r*0.5} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {["N","O","Z","W"].map((l, i) => {
          const p = punt(i*90, r + 16);
          return <text key={l} x={p.x} y={p.y} fill={C.muted} fontSize="13" fontWeight="700" textAnchor="middle" dominantBaseline="middle">{l}</text>;
        })}
        {pad.length > 1 && (
          <polyline points={pad.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="rgba(242,169,59,0.35)" strokeWidth="2" />
        )}
        {naaldPunt && (
          <line x1={cx} y1={cy} x2={naaldPunt.x} y2={naaldPunt.y} stroke={C.accent} strokeWidth="2" strokeLinecap="round" />
        )}
        {zonPositie.elevatie > 0 ? (
          <circle cx={zonPunt.x} cy={zonPunt.y} r="10" fill={C.accentDark} />
        ) : (
          <circle cx={zonPunt.x} cy={zonPunt.y} r="8" fill="none" stroke={C.accentDark} strokeWidth="2" strokeDasharray="3,2" />
        )}
        <circle cx={cx} cy={cy} r="3" fill={C.text} />
      </svg>
      <div style={{ textAlign: "center", marginTop: 10 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
          ☀️ Azimut {Math.round(zonPositie.azimut)}° · Elevatie {Math.round(zonPositie.elevatie)}°
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>
          {zonPositie.elevatie > 0 ? "De zon staat nu boven de horizon" : "De zon staat nu onder de horizon"}
          {heading != null && ` · jouw telefoon wijst naar ${Math.round(heading)}°`}
        </p>
      </div>
    </div>
  );
}

function CameraWeergave({ videoRef, cameraStream, cameraFout, zonPositie, relatieveHoek, zonInBeeld, headingBeschikbaar, onOpnieuw, kalibratieOffset, wijzigKalibratie }) {
  if (cameraFout) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{cameraFout}</p>
        <button onClick={onOpnieuw} style={{ background: C.accent, color: "#0F1B2D", border: "none", borderRadius: 12, padding: "10px 20px", fontWeight: 700, cursor: "pointer" }}>
          Opnieuw proberen
        </button>
      </div>
    );
  }
  if (!cameraStream) {
    return <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 20 }}>Camera wordt gestart…</p>;
  }
  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 150px)", overflow: "hidden", background: "#000" }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "rgba(255,255,255,0.25)" }} />
      {zonInBeeld && (
        <div style={{
          position: "absolute", top: "38%", left: `${50 + (relatieveHoek / 34) * 42}%`,
          transform: "translate(-50%, -50%)", fontSize: 44, textShadow: "0 0 12px rgba(242,169,59,0.9)",
        }}>☀️</div>
      )}
      {!zonInBeeld && relatieveHoek != null && (
        <div style={{
          position: "absolute", top: "38%", [relatieveHoek < 0 ? "left" : "right"]: 16,
          transform: "translateY(-50%)", fontSize: 28, color: C.accentDark,
        }}>{relatieveHoek < 0 ? "◀" : "▶"}</div>
      )}
      <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center" }}>
        <p style={{ display: "inline-block", margin: "0 0 8px", background: "rgba(0,0,0,0.55)", color: "#FFF", padding: "8px 16px", borderRadius: 20, fontSize: 12.5 }}>
          {zonPositie && `☀️ Elevatie ${Math.round(zonPositie.elevatie)}°`}
          {headingBeschikbaar === false && " · geen kompas beschikbaar op dit toestel"}
        </p>
        {headingBeschikbaar === true && (
          <div style={{ padding: "0 40px" }}>
            <input type="range" min={-30} max={30} step={1} value={kalibratieOffset}
              onChange={e => wijzigKalibratie(+e.target.value)}
              style={{ width: "100%", accentColor: C.accentDark }} />
            <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "rgba(255,255,255,0.7)" }}>
              Klopt niet? Sleep tot de zon op de juiste plek staat ({kalibratieOffset > 0 ? "+" : ""}{kalibratieOffset}°)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
