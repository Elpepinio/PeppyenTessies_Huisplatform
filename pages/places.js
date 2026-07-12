import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, X, ChevronLeft, MapPin, Star, Camera, Search, Filter } from "lucide-react";

// ── Constanten ─────────────────────────────────────────
const CATEGORIEEN = [
  { id: "eten",       label: "Eten & Drinken",   icon: "🍽️",  kleur: "#E8634A" },
  { id: "overnacht",  label: "Overnachten",       icon: "🏨",  kleur: "#5B8FD4" },
  { id: "natuur",     label: "Natuur",            icon: "🌿",  kleur: "#3A9E6A" },
  { id: "cultuur",    label: "Cultuur",           icon: "🏛️",  kleur: "#9B59B6" },
  { id: "winkelen",   label: "Winkelen",          icon: "🛍️",  kleur: "#F39C12" },
  { id: "activiteit", label: "Activiteiten",      icon: "🎉",  kleur: "#E84393" },
  { id: "camper",     label: "Camperplekken",     icon: "🚐",  kleur: "#2D7B8A" },
  { id: "overig",     label: "Overig",            icon: "📌",  kleur: "#7F8C8D" },
];

const STATUSSEN = [
  { id: "wil",      label: "Wil naartoe",  icon: "⭐", kleur: "#F39C12" },
  { id: "geweest",  label: "Geweest",      icon: "✅", kleur: "#3A9E6A" },
  { id: "favoriet", label: "Favoriet",     icon: "❤️", kleur: "#E84393" },
];

const LANDEN = ["Nederland","België","Duitsland","Frankrijk","Italië","Spanje","Portugal","Oostenrijk","Zwitserland","Griekenland","Kroatië","Noorwegen","Zweden","Denemarken","Schotland","Ierland","Anders"];

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ── Data helpers ─────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch("/api/places");
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function saveData(data) {
  try {
    await fetch("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) { console.error("Opslaan mislukt", e); }
}

// ── Kleuren & stijlen ─────────────────────────────────────
const C = {
  bg: "#F0F4FF", surf: "#FFFFFF", card: "#E8EEF8",
  border: "#CED8EE", blue: "#2C5F9E", accent: "#4A7FC1",
  text: "#1A2540", muted: "#5A6E8C", red: "#D63353",
  yellow: "#CC8800", green: "#2D6A4F",
};

const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: C.blue },
  main: { padding: "4px 20px 120px" },
  inp: { background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 15, width: "100%", boxSizing: "border-box", color: C.text },
  btn: (bg=C.blue, col="#FFFFFF") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 12 },
  fab: { position: "fixed", bottom: 28, right: 20, width: 52, height: 52, borderRadius: 16, background: C.blue, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px rgba(44,95,158,0.3)", zIndex: 50 },
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
  tabBtn: (active) => ({ flex: 1, border: "none", background: active ? C.blue : "transparent", color: active ? "#FFF" : C.muted, borderRadius: 9, padding: "9px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }),
};

// ════════════════════════════════════════════════════════
// KAARTCOMPONENT (lazy geladen)
// ════════════════════════════════════════════════════════
function PlacesKaart({ places, onPlaceKlik, filteredIds }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const clusterGroupRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Laad Leaflet dynamisch, en daarna de markercluster-plugin (voor het
    // samenvoegen van dichtbij elkaar liggende pins bij veel plekken).
    function laadMarkerCluster(callback) {
      if (window.L.MarkerClusterGroup) { callback(); return; }
      const css1 = document.createElement("link");
      css1.rel = "stylesheet";
      css1.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.css";
      document.head.appendChild(css1);
      const css2 = document.createElement("link");
      css2.rel = "stylesheet";
      css2.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.css";
      document.head.appendChild(css2);
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js";
      script.onload = callback;
      document.head.appendChild(script);
    }

    if (!window.L) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.onload = () => laadMarkerCluster(initMap);
      document.head.appendChild(script);
    } else {
      laadMarkerCluster(initMap);
    }

    function initMap() {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (!mapRef.current) return;

      const map = window.L.map(mapRef.current, { zoomControl: true }).setView([52.1, 5.3], 7);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      mapInstanceRef.current = map;
      updateMarkers(map);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers als places veranderen
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    updateMarkers(mapInstanceRef.current);
  }, [places, filteredIds]);

  function updateMarkers(map) {
    // Ruim zowel losse markers als een eventuele vorige clustergroep op.
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
      clusterGroupRef.current = null;
    }

    const zichtbaar = filteredIds
      ? places.filter(p => filteredIds.includes(p.id) && p.lat && p.lng)
      : places.filter(p => p.lat && p.lng);

    // Bij veel plekken (50+) clusteren we nabijgelegen pins tot één groepsicoon,
    // zodat de kaart overzichtelijk blijft. Bij minder plekken tonen we gewoon
    // losse pins, zoals voorheen.
    const gebruikCluster = zichtbaar.length > 50 && window.L.MarkerClusterGroup;
    const clusterGroup = gebruikCluster
      ? window.L.markerClusterGroup({
          maxClusterRadius: 60,
          iconCreateFunction: (cluster) => {
            const n = cluster.getChildCount();
            return window.L.divIcon({
              html: `<div style="
                width:38px;height:38px;border-radius:50%;
                background:${C.blue};color:#fff;display:flex;align-items:center;
                justify-content:center;font-weight:700;font-size:13px;
                border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);
              ">${n}</div>`,
              className: "",
              iconSize: [38, 38],
            });
          },
        })
      : null;
    if (clusterGroup) clusterGroupRef.current = clusterGroup;

    zichtbaar.forEach(place => {
      const cat = CATEGORIEEN.find(c => c.id === place.categorie);
      const kleur = cat?.kleur || C.muted;
      const status = STATUSSEN.find(s => s.id === place.status);

      // SVG pin marker
      const svgIcon = window.L.divIcon({
        className: "",
        html: `<div style="
          width:32px;height:40px;position:relative;cursor:pointer;
          filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        ">
          <svg viewBox="0 0 32 40" width="32" height="40">
            <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="${kleur}"/>
            <circle cx="16" cy="15" r="8" fill="white" opacity="0.9"/>
            <text x="16" y="19" text-anchor="middle" font-size="10">${cat?.icon || "📌"}</text>
          </svg>
          ${place.status === "geweest" ? `<div style="position:absolute;top:-4px;right:-4px;background:#3A9E6A;color:white;border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;font-size:8px;border:1px solid white;">✓</div>` : ""}
          ${place.status === "favoriet" ? `<div style="position:absolute;top:-4px;right:-4px;background:#E84393;color:white;border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;font-size:8px;border:1px solid white;">♥</div>` : ""}
        </div>`,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -40],
      });

      const marker = window.L.marker([place.lat, place.lng], { icon: svgIcon })
        .bindPopup(`
          <div style="min-width:160px;font-family:sans-serif;">
            <strong style="font-size:14px;">${place.naam}</strong><br>
            <span style="font-size:12px;color:#666;">${cat?.icon} ${cat?.label || ""}</span>
            ${place.land ? `<br><span style="font-size:11px;color:#888;">📍 ${place.land}</span>` : ""}
            ${place.beoordeling ? `<br>${"⭐".repeat(place.beoordeling)}` : ""}
          </div>
        `);

      marker.on("click", () => onPlaceKlik(place.id));

      if (clusterGroup) {
        clusterGroup.addLayer(marker);
      } else {
        marker.addTo(map);
        markersRef.current.push(marker);
      }
    });

    if (clusterGroup) {
      clusterGroup.addTo(map);
    }

    // Zoom naar markers als er zijn
    const alleMarkers = clusterGroup ? clusterGroup.getLayers() : markersRef.current;
    if (alleMarkers.length > 0 && mapInstanceRef.current) {
      const groep = window.L.featureGroup(alleMarkers);
      mapInstanceRef.current.fitBounds(groep.getBounds().pad(0.2));
    }
  }

  return (
    <div ref={mapRef} style={{ width: "100%", height: 380, borderRadius: 16, overflow: "hidden", border: `1px solid ${C.border}`, zIndex: 1 }} />
  );
}

// ════════════════════════════════════════════════════════
// HOOFD APP
// ════════════════════════════════════════════════════════
export default function PlacesApp() {
  const [places, setPlacesState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePlaceId, setActivePlaceId] = useState(null);
  const [tab, setTab] = useState("kaart"); // kaart | lijst
  const [bewerkModus, setBewerkModus] = useState(false);
  const lastWriteRef = useRef(0);

  // Filters
  const [filterCat, setFilterCat] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterLand, setFilterLand] = useState(null);
  const [zoekterm, setZoekterm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Nieuw/bewerk formulier
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    naam: "", categorie: "eten", status: "wil", land: "Nederland",
    stad: "", adres: "", lat: null, lng: null,
    beoordeling: 0, notitie: "", tips: "", fotos: [],
    bezoekdatum: "", website: "",
  });
  const [locatieLoading, setLocatieLoading] = useState(false);
  const [fotoLoading, setFotoLoading] = useState(false);
  const fotoRef = useRef();
  const [toast, setToast] = useState(null);

  // ── Data ─────────────────────────────────────────────
  const persistData = useCallback((nextPlaces) => {
    lastWriteRef.current = Date.now();
    setPlacesState(nextPlaces);
    saveData({ places: nextPlaces });
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (Date.now() - lastWriteRef.current < 5000) return;
      const data = await loadData();
      if (active && data) { setPlacesState(data.places || []); setLoading(false); }
      else if (active) setLoading(false);
    };
    refresh();
    const poll = setInterval(refresh, 8000);
    return () => { active = false; clearInterval(poll); };
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  // ── Filters ───────────────────────────────────────────
  const gefilterd = places.filter(p => {
    if (filterCat && p.categorie !== filterCat) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    if (filterLand && p.land !== filterLand) return false;
    if (zoekterm && !p.naam.toLowerCase().includes(zoekterm.toLowerCase()) &&
        !p.stad?.toLowerCase().includes(zoekterm.toLowerCase()) &&
        !p.notitie?.toLowerCase().includes(zoekterm.toLowerCase())) return false;
    return true;
  });

  const filteredIds = gefilterd.map(p => p.id);

  // ── Locatie via GPS ───────────────────────────────────
  function haalGPSLocatie() {
    setLocatieLoading(true);
    navigator.geolocation?.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      // Reverse geocoding via OpenStreetMap Nominatim
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
        const data = await res.json();
        const adres = data.address;
        setForm(f => ({
          ...f, lat, lng,
          stad: adres.city || adres.town || adres.village || adres.municipality || "",
          adres: [adres.road, adres.house_number].filter(Boolean).join(" "),
          land: adres.country || f.land,
        }));
      } catch {
        setForm(f => ({ ...f, lat, lng }));
      }
      setLocatieLoading(false);
      showToast("✅ Locatie ingevuld");
    }, () => {
      setLocatieLoading(false);
      showToast("❌ Locatie niet beschikbaar");
    });
  }

  // ── Foto's (met compressie) ───────────────────────────
  async function comprimeerFoto(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = url;
    });
  }

  async function voegFotoToe(file) {
    if (!file) return;
    setFotoLoading(true);
    try {
      const gecomprimeerd = await comprimeerFoto(file);
      setForm(f => ({ ...f, fotos: [...(f.fotos || []), gecomprimeerd] }));
    } catch (e) { showToast("❌ Foto toevoegen mislukt"); }
    setFotoLoading(false);
  }

  function verwijderFoto(idx) {
    setForm(f => ({ ...f, fotos: f.fotos.filter((_, i) => i !== idx) }));
  }

  // ── Place mutaties ────────────────────────────────────
  function voegPlaceToe() {
    if (!form.naam.trim()) return;
    const nieuw = { ...form, id: uid(), aangemaaktOp: Date.now() };
    persistData([...places, nieuw]);
    resetForm();
    setShowForm(false);
    showToast(`✅ ${nieuw.naam} opgeslagen`);
  }

  function updatePlace(id, fields) {
    persistData(places.map(p => p.id === id ? { ...p, ...fields } : p));
  }

  function verwijderPlace(id) {
    if (!window.confirm("Plek verwijderen?")) return;
    persistData(places.filter(p => p.id !== id));
    setActivePlaceId(null);
  }

  function resetForm() {
    setForm({ naam: "", categorie: "eten", status: "wil", land: "Nederland", stad: "", adres: "", lat: null, lng: null, beoordeling: 0, notitie: "", tips: "", fotos: [], bezoekdatum: "", website: "" });
  }

  function openBewerkForm(place) {
    setForm({ ...place });
    setBewerkModus(true);
    setShowForm(true);
  }

  function slaWijzigingenOp() {
    updatePlace(form.id, form);
    setShowForm(false);
    setBewerkModus(false);
    resetForm();
    showToast("✅ Wijzigingen opgeslagen");
  }

  // ── Statistieken ──────────────────────────────────────
  const stats = {
    totaal: places.length,
    wil: places.filter(p => p.status === "wil").length,
    geweest: places.filter(p => p.status === "geweest").length,
    favoriet: places.filter(p => p.status === "favoriet").length,
    landen: [...new Set(places.map(p => p.land).filter(Boolean))].length,
  };

  if (loading) return (
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <span style={{ fontSize: 40 }}>🗺️</span>
        <div style={{ display: "flex", gap: 6 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.blue, opacity: 0.3, animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}`}</style>
      </div>
    </div>
  );

  const activePlace = places.find(p => p.id === activePlaceId);

  // ════════════════════════
  // PLACE DETAIL
  // ════════════════════════
  if (activePlace) {
    const cat = CATEGORIEEN.find(c => c.id === activePlace.categorie);
    const status = STATUSSEN.find(s => s.id === activePlace.status);

    return (
      <div style={S.appBg}>
        {toast && <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", background:C.blue, color:"#FFF", padding:"9px 20px", borderRadius:10, fontWeight:700, zIndex:999, fontSize:13 }}>{toast}</div>}

        <header style={{ ...S.header, alignItems:"center" }}>
          <button style={{ background:"none", border:"none", cursor:"pointer" }} onClick={() => setActivePlaceId(null)}>
            <ChevronLeft size={20} color={C.blue} />
          </button>
          <div style={{ flex:1, textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.muted }}>{cat?.icon} {cat?.label}</div>
            <h1 style={{ ...S.title, fontSize:18, margin:0 }}>{activePlace.naam}</h1>
          </div>
          <button style={{ background: C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", color:C.blue }}
            onClick={() => openBewerkForm(activePlace)}>
            ✏️
          </button>
        </header>

        <main style={S.main}>
          {/* Foto's */}
          {activePlace.fotos?.length > 0 && (
            <div style={{ display:"flex", gap:8, overflowX:"auto", marginBottom:14, paddingBottom:4 }}>
              {activePlace.fotos.map((foto, i) => (
                <img key={i} src={foto} alt="" style={{ height:160, width:"auto", borderRadius:12, objectFit:"cover", flexShrink:0 }} />
              ))}
            </div>
          )}

          {/* Status & beoordeling */}
          <div style={{ ...S.card, display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {STATUSSEN.map(s => (
                  <button key={s.id}
                    style={{ border:`2px solid ${activePlace.status===s.id ? s.kleur : C.border}`, background:activePlace.status===s.id ? s.kleur : "transparent", color:activePlace.status===s.id ? "#FFF" : C.muted, borderRadius:20, padding:"5px 12px", fontSize:12, cursor:"pointer", fontWeight:600 }}
                    onClick={() => updatePlace(activePlace.id, { status: s.id })}>
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Beoordeling */}
          <div style={{ ...S.card, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:13, color:C.muted, flex:1 }}>Beoordeling</span>
            <div style={{ display:"flex", gap:4 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, padding:2 }}
                  onClick={() => updatePlace(activePlace.id, { beoordeling: n === activePlace.beoordeling ? 0 : n })}>
                  {n <= (activePlace.beoordeling||0) ? "⭐" : "☆"}
                </button>
              ))}
            </div>
          </div>

          {/* Locatie-info */}
          <div style={S.card}>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom: activePlace.adres ? 8 : 0 }}>
              {activePlace.stad && <span style={{ fontSize:13 }}>📍 {activePlace.stad}</span>}
              {activePlace.land && <span style={{ fontSize:13, color:C.muted }}>{activePlace.land}</span>}
              {activePlace.bezoekdatum && <span style={{ fontSize:13, color:C.muted }}>🗓 {activePlace.bezoekdatum}</span>}
            </div>
            {activePlace.adres && <p style={{ fontSize:12, color:C.muted, margin:0 }}>{activePlace.adres}</p>}
            {activePlace.website && (
              <a href={activePlace.website} target="_blank" rel="noreferrer"
                style={{ fontSize:12, color:C.blue, display:"block", marginTop:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                🔗 {activePlace.website}
              </a>
            )}
          </div>

          {/* Mini kaart als er GPS-coördinaten zijn */}
          {activePlace.lat && activePlace.lng && (
            <div style={{ marginBottom:12 }}>
              <PlacesKaart places={[activePlace]} onPlaceKlik={() => {}} filteredIds={[activePlace.id]} />
            </div>
          )}

          {/* Notities */}
          {activePlace.notitie && (
            <div style={S.card}>
              <h3 style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.blue }}>📝 Notities</h3>
              <p style={{ fontSize:14, color:C.text, margin:0, lineHeight:1.7, whiteSpace:"pre-wrap" }}>{activePlace.notitie}</p>
            </div>
          )}

          {/* Tips */}
          {activePlace.tips && (
            <div style={{ ...S.card, background:`${C.blue}10` }}>
              <h3 style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.blue }}>💡 Tips & aanbevelingen</h3>
              <p style={{ fontSize:14, color:C.text, margin:0, lineHeight:1.7, whiteSpace:"pre-wrap" }}>{activePlace.tips}</p>
            </div>
          )}

          {/* Snel notitie bijwerken */}
          <div style={S.card}>
            <h3 style={{ margin:"0 0 8px", fontSize:13, fontWeight:700 }}>📝 Notitie aanpassen</h3>
            <textarea style={{ ...S.inp, height:80, resize:"none", fontSize:13, marginBottom:8 }}
              placeholder="Wat heb je gegeten? Wat vond je ervan? Wat zou je volgende keer anders doen?"
              defaultValue={activePlace.notitie||""}
              onBlur={e => updatePlace(activePlace.id, { notitie: e.target.value })} />
            <textarea style={{ ...S.inp, height:60, resize:"none", fontSize:13 }}
              placeholder="Tips voor anderen (beste gerecht, parkeren, openingstijden…)"
              defaultValue={activePlace.tips||""}
              onBlur={e => updatePlace(activePlace.id, { tips: e.target.value })} />
          </div>

          <button style={{ ...S.btn("#FDE8EC", C.red), border:`1px solid #F5C0C8`, width:"100%", marginTop:4 }}
            onClick={() => verwijderPlace(activePlace.id)}>
            🗑 Plek verwijderen
          </button>
        </main>
      </div>
    );
  }

  // ════════════════════════
  // HOOFD OVERZICHT
  // ════════════════════════
  const uniekeLanden = [...new Set(places.map(p => p.land).filter(Boolean))].sort();

  return (
    <div style={S.appBg}>
      {toast && <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", background:C.blue, color:"#FFF", padding:"9px 20px", borderRadius:10, fontWeight:700, zIndex:999, fontSize:13 }}>{toast}</div>}

      {/* Formulier overlay */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:200, display:"flex", alignItems:"flex-end" }} onClick={() => { setShowForm(false); if (!bewerkModus) resetForm(); setBewerkModus(false); }}>
          <div style={{ background:"#FFF", width:"100%", maxHeight:"92vh", overflowY:"auto", padding:"20px 20px 40px", borderTopLeftRadius:24, borderTopRightRadius:24, boxSizing:"border-box" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin:"0 0 16px", fontWeight:700, fontSize:16, color:C.blue }}>{bewerkModus ? "✏️ Plek bewerken" : "📍 Nieuwe plek"}</p>

            {/* Naam */}
            <input style={{ ...S.inp, marginBottom:10 }} placeholder="Naam van de plek" value={form.naam} autoFocus
              onChange={e => setForm(f => ({...f, naam: e.target.value}))} />

            {/* Categorie */}
            <p style={{ fontSize:11, color:C.muted, margin:"0 0 6px" }}>Categorie</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
              {CATEGORIEEN.map(cat => (
                <button key={cat.id}
                  style={{ border:`2px solid ${form.categorie===cat.id ? cat.kleur : C.border}`, background:form.categorie===cat.id ? cat.kleur : "transparent", color:form.categorie===cat.id ? "#FFF" : C.text, borderRadius:20, padding:"6px 12px", fontSize:12, cursor:"pointer", fontWeight:form.categorie===cat.id?700:400 }}
                  onClick={() => setForm(f=>({...f, categorie: cat.id}))}>
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>

            {/* Status */}
            <p style={{ fontSize:11, color:C.muted, margin:"0 0 6px" }}>Status</p>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              {STATUSSEN.map(s => (
                <button key={s.id}
                  style={{ flex:1, border:`2px solid ${form.status===s.id ? s.kleur : C.border}`, background:form.status===s.id ? s.kleur : "transparent", color:form.status===s.id ? "#FFF" : C.muted, borderRadius:12, padding:"8px 0", fontSize:12, cursor:"pointer", fontWeight:600 }}
                  onClick={() => setForm(f=>({...f, status:s.id}))}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>

            {/* Locatie */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Land</label>
                <select style={{ ...S.inp, padding:"10px 12px" }} value={form.land} onChange={e=>setForm(f=>({...f,land:e.target.value}))}>
                  {LANDEN.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Stad / Dorp</label>
                <input style={{ ...S.inp, padding:"10px 12px" }} placeholder="bv. Amsterdam" value={form.stad||""}
                  onChange={e=>setForm(f=>({...f,stad:e.target.value}))} />
              </div>
            </div>
            <input style={{ ...S.inp, marginBottom:8 }} placeholder="Adres (optioneel)" value={form.adres||""}
              onChange={e=>setForm(f=>({...f,adres:e.target.value}))} />

            {/* GPS-knop */}
            <button style={{ ...S.btn(C.card, C.blue), border:`1px solid ${C.border}`, width:"100%", marginBottom:6, fontSize:13 }}
              onClick={haalGPSLocatie} disabled={locatieLoading}>
              {locatieLoading ? "📡 Locatie ophalen…" : "📍 Huidige locatie gebruiken (GPS)"}
            </button>

            {/* Handmatige coördinaten */}
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <input style={{ ...S.inp, flex:1, padding:"8px 10px", fontSize:12 }} placeholder="Breedtegraad (lat)"
                type="number" step="any" value={form.lat||""}
                onChange={e => setForm(f=>({...f, lat: e.target.value ? parseFloat(e.target.value) : null}))} />
              <input style={{ ...S.inp, flex:1, padding:"8px 10px", fontSize:12 }} placeholder="Lengtegraad (lng)"
                type="number" step="any" value={form.lng||""}
                onChange={e => setForm(f=>({...f, lng: e.target.value ? parseFloat(e.target.value) : null}))} />
            </div>
            {form.lat && form.lng && (
              <p style={{ fontSize:11, color:C.muted, margin:"-6px 0 10px", textAlign:"center" }}>
                📍 {form.lat.toFixed(5)}, {form.lng.toFixed(5)} — <a href={`https://www.google.com/maps?q=${form.lat},${form.lng}`} target="_blank" rel="noreferrer" style={{ color:C.blue }}>bekijk op kaart</a>
              </p>
            )}

            {/* Bezoekdatum */}
            {form.status === "geweest" && (
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Bezoekdatum</label>
                <input style={S.inp} type="date" value={form.bezoekdatum||""} onChange={e=>setForm(f=>({...f,bezoekdatum:e.target.value}))} />
              </div>
            )}

            {/* Beoordeling */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <span style={{ fontSize:13, color:C.muted }}>Beoordeling</span>
              {[1,2,3,4,5].map(n => (
                <button key={n} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, padding:2 }}
                  onClick={() => setForm(f=>({...f, beoordeling: n===f.beoordeling?0:n}))}>
                  {n <= (form.beoordeling||0) ? "⭐" : "☆"}
                </button>
              ))}
            </div>

            {/* Website */}
            <input style={{ ...S.inp, marginBottom:10 }} placeholder="Website of link (optioneel)" type="url" value={form.website||""}
              onChange={e=>setForm(f=>({...f,website:e.target.value}))} />

            {/* Notitie */}
            <textarea style={{ ...S.inp, height:70, resize:"none", marginBottom:8, fontSize:13 }}
              placeholder="Notities (wat gegeten, ervaringen, sfeer…)"
              value={form.notitie||""} onChange={e=>setForm(f=>({...f,notitie:e.target.value}))} />
            <textarea style={{ ...S.inp, height:60, resize:"none", marginBottom:12, fontSize:13 }}
              placeholder="Tips (beste gerecht, parkeren, openingstijden…)"
              value={form.tips||""} onChange={e=>setForm(f=>({...f,tips:e.target.value}))} />

            {/* Foto's */}
            <p style={{ fontSize:11, color:C.muted, margin:"0 0 8px" }}>Foto's</p>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
              {(form.fotos||[]).map((foto, i) => (
                <div key={i} style={{ position:"relative" }}>
                  <img src={foto} alt="" style={{ width:70, height:70, objectFit:"cover", borderRadius:10 }} />
                  <button style={{ position:"absolute", top:-4, right:-4, background:C.red, color:"#FFF", border:"none", borderRadius:"50%", width:18, height:18, fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                    onClick={() => verwijderFoto(i)}>×</button>
                </div>
              ))}
              <button style={{ width:70, height:70, borderRadius:10, border:`2px dashed ${C.border}`, background:C.card, cursor:"pointer", fontSize:22, display:"flex", alignItems:"center", justifyContent:"center" }}
                onClick={() => fotoRef.current?.click()}>
                {fotoLoading ? "⏳" : "📷"}
              </button>
            </div>
            <input ref={fotoRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }}
              onChange={e => voegFotoToe(e.target.files[0])} />

            <div style={{ display:"flex", gap:10, marginTop:8 }}>
              <button style={{ ...S.btn(C.card, C.text), border:`1px solid ${C.border}`, flex:1 }} onClick={() => { setShowForm(false); setBewerkModus(false); resetForm(); }}>Annuleer</button>
              <button style={{ ...S.btn(), flex:2 }} onClick={bewerkModus ? slaWijzigingenOp : voegPlaceToe}>
                {bewerkModus ? "Opslaan" : "Plek toevoegen"}
              </button>
            </div>
          </div>
        </div>
      )}

      <header style={S.header}>
        <div>
          <Link href="/" style={S.switchBtn}>← Overzicht</Link>
          <h1 style={S.title}>🗺️ Places</h1>
        </div>
      </header>

      {/* Stats strip */}
      <div style={{ display:"flex", gap:8, padding:"0 20px 12px", overflowX:"auto" }}>
        {[
          { label:"Totaal", val:stats.totaal, kleur:C.blue },
          { label:"Wil naartoe", val:stats.wil, kleur:"#F39C12" },
          { label:"Geweest", val:stats.geweest, kleur:"#3A9E6A" },
          { label:"Favoriet", val:stats.favoriet, kleur:"#E84393" },
          { label:"Landen", val:stats.landen, kleur:C.blue },
        ].map(s => (
          <div key={s.label} style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:12, padding:"8px 14px", textAlign:"center", flexShrink:0 }}>
            <div style={{ fontSize:17, fontWeight:800, color:s.kleur }}>{s.val}</div>
            <div style={{ fontSize:10, color:C.muted, whiteSpace:"nowrap" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Zoek + filter */}
      <div style={{ padding:"0 20px 10px", display:"flex", gap:8 }}>
        <input style={{ ...S.inp, flex:1, padding:"9px 14px", fontSize:14 }} placeholder="🔍 Zoek plek…"
          value={zoekterm} onChange={e => setZoekterm(e.target.value)} />
        <button style={{ ...S.btn(showFilters ? C.blue : C.card, showFilters ? "#FFF" : C.blue), border:`1px solid ${C.border}`, padding:"9px 14px", fontSize:13 }}
          onClick={() => setShowFilters(v=>!v)}>
          ▼
        </button>
      </div>

      {/* Filter paneel */}
      {showFilters && (
        <div style={{ padding:"0 20px 12px" }}>
          <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:14 }}>
            <p style={{ fontSize:11, color:C.muted, margin:"0 0 8px" }}>CATEGORIE</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
              <button style={{ border:`1px solid ${!filterCat?C.blue:C.border}`, background:!filterCat?C.blue:"transparent", color:!filterCat?"#FFF":C.muted, borderRadius:20, padding:"4px 12px", fontSize:12, cursor:"pointer" }} onClick={()=>setFilterCat(null)}>Alle</button>
              {CATEGORIEEN.map(cat => (
                <button key={cat.id} style={{ border:`1px solid ${filterCat===cat.id?cat.kleur:C.border}`, background:filterCat===cat.id?cat.kleur:"transparent", color:filterCat===cat.id?"#FFF":C.muted, borderRadius:20, padding:"4px 12px", fontSize:12, cursor:"pointer" }}
                  onClick={()=>setFilterCat(filterCat===cat.id?null:cat.id)}>
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize:11, color:C.muted, margin:"0 0 8px" }}>STATUS</p>
            <div style={{ display:"flex", gap:6, marginBottom:10 }}>
              <button style={{ border:`1px solid ${!filterStatus?C.blue:C.border}`, background:!filterStatus?C.blue:"transparent", color:!filterStatus?"#FFF":C.muted, borderRadius:20, padding:"4px 12px", fontSize:12, cursor:"pointer" }} onClick={()=>setFilterStatus(null)}>Alle</button>
              {STATUSSEN.map(s => (
                <button key={s.id} style={{ border:`1px solid ${filterStatus===s.id?s.kleur:C.border}`, background:filterStatus===s.id?s.kleur:"transparent", color:filterStatus===s.id?"#FFF":C.muted, borderRadius:20, padding:"4px 12px", fontSize:12, cursor:"pointer" }}
                  onClick={()=>setFilterStatus(filterStatus===s.id?null:s.id)}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
            {uniekeLanden.length > 1 && (
              <>
                <p style={{ fontSize:11, color:C.muted, margin:"0 0 8px" }}>LAND</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  <button style={{ border:`1px solid ${!filterLand?C.blue:C.border}`, background:!filterLand?C.blue:"transparent", color:!filterLand?"#FFF":C.muted, borderRadius:20, padding:"4px 12px", fontSize:12, cursor:"pointer" }} onClick={()=>setFilterLand(null)}>Alle</button>
                  {uniekeLanden.map(l => (
                    <button key={l} style={{ border:`1px solid ${filterLand===l?C.blue:C.border}`, background:filterLand===l?C.blue:"transparent", color:filterLand===l?"#FFF":C.muted, borderRadius:20, padding:"4px 12px", fontSize:12, cursor:"pointer" }}
                      onClick={()=>setFilterLand(filterLand===l?null:l)}>
                      {l}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, background:"#FFFFFF", borderRadius:12, margin:"0 20px 14px", border:`1px solid ${C.border}`, padding:"4px" }}>
        {[["kaart","🗺️ Kaart"],["lijst","📋 Lijst"]].map(([t,l]) => (
          <button key={t} style={S.tabBtn(tab===t)} onClick={()=>setTab(t)}>{l}</button>
        ))}
      </div>

      <main style={S.main}>
        {/* Kaart */}
        {tab === "kaart" && (
          <>
            {places.filter(p=>p.lat&&p.lng).length === 0 ? (
              <div style={{ ...S.card, textAlign:"center", padding:"30px 20px", marginBottom:14 }}>
                <p style={{ fontSize:14, color:C.muted, margin:0 }}>Nog geen plekken met GPS-locatie. Gebruik "Huidige locatie" bij het toevoegen van een plek.</p>
              </div>
            ) : (
              <div style={{ marginBottom:14 }}>
                <PlacesKaart
                  places={places}
                  onPlaceKlik={id => setActivePlaceId(id)}
                  filteredIds={filteredIds}
                />
                <p style={{ fontSize:11, color:C.muted, textAlign:"center", marginTop:6 }}>
                  {gefilterd.filter(p=>p.lat&&p.lng).length} van {places.filter(p=>p.lat&&p.lng).length} plekken zichtbaar
                </p>
              </div>
            )}
            {/* Compacte lijst onder kaart */}
            {gefilterd.slice(0,8).map(place => {
              const cat = CATEGORIEEN.find(c => c.id === place.categorie);
              const status = STATUSSEN.find(s => s.id === place.status);
              return (
                <div key={place.id} style={{ ...S.card, display:"flex", alignItems:"center", gap:12, cursor:"pointer", marginBottom:8, padding:"12px 14px" }}
                  onClick={() => setActivePlaceId(place.id)}>
                  <div style={{ width:36, height:36, borderRadius:10, background:cat?.kleur+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{cat?.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:"0 0 2px", fontWeight:700, fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{place.naam}</p>
                    <p style={{ margin:0, fontSize:11, color:C.muted }}>{place.stad}{place.stad&&place.land?" · ":""}{place.land}</p>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
                    <span style={{ fontSize:11 }}>{status?.icon}</span>
                    {place.beoordeling > 0 && <span style={{ fontSize:10, color:C.muted }}>{"⭐".repeat(place.beoordeling)}</span>}
                  </div>
                </div>
              );
            })}
            {gefilterd.length > 8 && <p style={{ fontSize:12, color:C.muted, textAlign:"center" }}>+ {gefilterd.length-8} meer — zie Lijst</p>}
          </>
        )}

        {/* Lijst */}
        {tab === "lijst" && (
          <>
            {gefilterd.length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 20px" }}>
                <div style={{ fontSize:48, marginBottom:16 }}>🗺️</div>
                <p style={{ fontWeight:700, fontSize:17, color:C.blue, margin:"0 0 6px" }}>{places.length===0?"Nog geen plekken":"Geen resultaten"}</p>
                <p style={{ fontSize:14, color:C.muted, margin:0 }}>{places.length===0?"Tik + om je eerste plek toe te voegen":"Pas de filters aan"}</p>
              </div>
            ) : (
              // Groepeer op categorie
              CATEGORIEEN.map(cat => {
                const catPlaces = gefilterd.filter(p => p.categorie === cat.id);
                if (catPlaces.length === 0) return null;
                return (
                  <div key={cat.id} style={{ marginBottom:20 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                      <span style={{ fontSize:16 }}>{cat.icon}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:C.blue, textTransform:"uppercase", letterSpacing:"0.04em" }}>{cat.label}</span>
                      <span style={{ fontSize:11, color:C.muted }}>({catPlaces.length})</span>
                    </div>
                    {catPlaces.map(place => {
                      const status = STATUSSEN.find(s => s.id === place.status);
                      return (
                        <div key={place.id} style={{ ...S.card, display:"flex", gap:12, cursor:"pointer", marginBottom:8, padding:"12px 14px" }}
                          onClick={() => setActivePlaceId(place.id)}>
                          {/* Thumbnail */}
                          <div style={{ width:52, height:52, borderRadius:10, background:cat.kleur+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0, overflow:"hidden" }}>
                            {place.fotos?.length > 0
                              ? <img src={place.fotos[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                              : cat.icon}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                              <p style={{ margin:"0 0 2px", fontWeight:700, fontSize:14 }}>{place.naam}</p>
                              <span style={{ fontSize:14, marginLeft:8 }}>{status?.icon}</span>
                            </div>
                            <p style={{ margin:"0 0 4px", fontSize:12, color:C.muted }}>
                              {[place.stad, place.land].filter(Boolean).join(", ")}
                              {place.bezoekdatum ? ` · ${place.bezoekdatum}` : ""}
                            </p>
                            {place.beoordeling > 0 && <span style={{ fontSize:11 }}>{"⭐".repeat(place.beoordeling)}</span>}
                            {place.notitie && <p style={{ margin:"4px 0 0", fontSize:11, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{place.notitie}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </>
        )}
      </main>

      <button style={S.fab} onClick={() => { resetForm(); setShowForm(true); setBewerkModus(false); }}>
        <Plus size={22} color="#FFFFFF" strokeWidth={2.4} />
      </button>
    </div>
  );
}
