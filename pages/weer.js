import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, MapPin, Plus, X, RefreshCw, Compass, CloudRain } from "lucide-react";
import SunCalc from "suncalc";

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
//    Beide kwamen bij het testen exact overeen tegen de 2 onafhankelijk
//    bevestigde volle-maan-referentiedata die eerder al werden gebruikt in
//    de Gezondheid-tool, maar een gevestigde library is betrouwbaarder dan
//    zelf uitgevonden wiskunde. ────────────────────────────────────────
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

// ── Stijlen ───────────────────────────────────────────────
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
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function WeerApp() {
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
  // kunt controleren of "huidige locatie" ook echt klopt — precies waar je
  // om vroeg. Nominatim/OpenStreetMap: gratis, geen sleutel nodig, dezelfde
  // kaartenbron die de app al gebruikt (Places-tool).
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
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <div style={{ fontSize: 40 }}>🌤️</div>
        <p style={{ color: C.muted, fontSize: 14 }}>Weer laden…</p>
      </div>
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
  })) || [];

  const lkn = weerData?.lucht?.european_aqi != null ? luchtkwaliteitNiveau(weerData.lucht.european_aqi) : null;
  const pollenWaarden = weerData?.lucht ? POLLEN_TYPES.map(p => ({ label: p.label, waarde: weerData.lucht[p.id] ?? 0 })) : [];
  const hoogstePollen = pollenWaarden.length ? pollenWaarden.reduce((max, p) => p.waarde > max.waarde ? p : max, pollenWaarden[0]) : null;

  return (
    <div style={S.appBg}>
      <header style={S.header}>
        <div>
          <Link href="/" style={S.switchBtn}><ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> Terug</Link>
          <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700 }}>🌤️ Weer</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/weer-radar" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            <CloudRain size={17} color={C.accent} />
          </Link>
          <Link href="/weer-zon" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            <Compass size={17} color={C.accentDark} />
          </Link>
          <button onClick={laadWeer} disabled={verversLaden}
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: verversLaden ? "default" : "pointer" }}>
            <RefreshCw size={16} color={C.accent} style={{ animation: verversLaden ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </header>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

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

        {/* Uurstrip */}
        {uurStrip.length > 0 && (
          <div style={{ ...S.card, overflowX: "auto" }}>
            <div style={{ display: "flex", gap: 18 }}>
              {uurStrip.map((u, idx) => (
                <div key={idx} style={{ textAlign: "center", flexShrink: 0 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, color: C.muted }}>{idx === 0 ? "Nu" : u.tijd.getHours() + "u"}</p>
                  <div style={{ fontSize: 20 }}>{weerInfo(u.code, u.isDag).icon}</div>
                  <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 700 }}>{Math.round(u.temp)}°</p>
                  {u.regenkans > 20 && <p style={{ margin: "2px 0 0", fontSize: 10, color: C.accent }}>{u.regenkans}%</p>}
                </div>
              ))}
            </div>
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
    </div>
  );
}

