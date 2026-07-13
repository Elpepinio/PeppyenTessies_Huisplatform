import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, X, ChevronLeft, MapPin, Star, Camera, Search, Filter, Share2 } from "lucide-react";

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

// Berekent een weergave-beoordeling uit de per-persoon scores. Vult terug op
// het oude losse 'beoordeling'-veld voor plekken die nog niet per persoon
// beoordeeld zijn.
function weergaveBeoordeling(place) {
  const b = place.beoordelingen;
  if (!b) return place.beoordeling || 0;
  const scores = [b.Pepijn, b.Tessa].filter(n => n > 0);
  if (scores.length === 0) return place.beoordeling || 0;
  return Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10;
}

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

async function callAI(prompt, imageBase64 = null, imageType = "image/jpeg") {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, imageBase64, imageType, maxTokens: 400, bron: "places-foto-herkenning" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI mislukt");
  return data.text;
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
            ${weergaveBeoordeling(place) ? `<br>${"⭐".repeat(Math.round(weergaveBeoordeling(place)))}` : ""}
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
// ROUTEKAART — genummerde stops in volgorde, verbonden met lijn
// ════════════════════════════════════════════════════════
function RouteKaart({ stops }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.L) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    if (!mapRef.current) return;

    const map = window.L.map(mapRef.current, { zoomControl: true }).setView([52.1, 5.3], 7);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);
    mapInstanceRef.current = map;

    const laag = window.L.layerGroup().addTo(map);
    layerRef.current = laag;

    const punten = stops.map(s => [s.lat, s.lng]);
    if (punten.length > 1) {
      window.L.polyline(punten, { color: C.blue, weight: 3, dashArray: "6 6", opacity: 0.7 }).addTo(laag);
    }
    stops.forEach((stop, i) => {
      const icon = window.L.divIcon({
        className: "",
        html: `<div style="width:28px;height:28px;border-radius:50%;background:${C.blue};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);">${i + 1}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14],
      });
      window.L.marker([stop.lat, stop.lng], { icon })
        .bindPopup(`<strong>${i + 1}. ${stop.naam}</strong>`)
        .addTo(laag);
    });

    if (punten.length > 0) {
      const groep = window.L.featureGroup(laag.getLayers());
      map.fitBounds(groep.getBounds().pad(0.25));
    }

    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [stops]);

  return <div ref={mapRef} style={{ width: "100%", height: 260, borderRadius: 16, overflow: "hidden", border: `1px solid ${C.border}`, zIndex: 1 }} />;
}

// ════════════════════════════════════════════════════════
// HOOFD APP
// ════════════════════════════════════════════════════════
export default function PlacesApp() {
  const [places, setPlacesState] = useState([]);
  const [trips, setTripsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiKostenMaand, setAiKostenMaand] = useState(null);

  useEffect(() => {
    fetch("/api/ai-gebruik").then(r => r.json()).then(d => {
      const nu = new Date();
      const maandStr = `${nu.getFullYear()}-${String(nu.getMonth()+1).padStart(2,"0")}`;
      const usd = (d.log||[]).filter(e => e.bron?.startsWith("places-") && e.datum.startsWith(maandStr))
        .reduce((s,e) => s + (e.kostenUsd||0), 0);
      setAiKostenMaand(usd * 0.92);
    }).catch(() => {});
  }, []);
  const [activePlaceId, setActivePlaceId] = useState(null);
  const [activeTripId, setActiveTripId] = useState(null);
  const [tab, setTab] = useState("kaart"); // kaart | lijst | buurt | trips
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
    beoordeling: 0, beoordelingen: { Pepijn: 0, Tessa: 0 }, notitie: "", tips: "", fotos: [],
    bezoekdatum: "", website: "", kosten: "",
  });
  const [locatieLoading, setLocatieLoading] = useState(false);
  const [fotoLoading, setFotoLoading] = useState(false);
  const fotoRef = useRef();
  const [toast, setToast] = useState(null);
  const [huidigeGebruiker, setHuidigeGebruiker] = useState(null);
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [aiFotoLoading, setAiFotoLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.user) setHuidigeGebruiker(d.user);
    }).catch(() => {});
  }, []);

  useEffect(() => { setLightboxIdx(null); }, [activePlaceId]);

  // "In de buurt"
  const [buurtLocatie, setBuurtLocatie] = useState(null);
  const [buurtLoading, setBuurtLoading] = useState(false);
  const [buurtFout, setBuurtFout] = useState(null);

  // Weer voor geopende plek
  const [weer, setWeer] = useState(null);

  // Importeren via Maps-link
  const [mapsImportUrl, setMapsImportUrl] = useState("");
  const [mapsImportLoading, setMapsImportLoading] = useState(false);

  // Trips
  const [showTripForm, setShowTripForm] = useState(false);
  const [editTripId, setEditTripId] = useState(null);
  const [tripForm, setTripForm] = useState({ naam: "", periode: "" });
  const [showLaadpaalForm, setShowLaadpaalForm] = useState(false);
  const [editLaadpaalId, setEditLaadpaalId] = useState(null);
  const [laadpaalForm, setLaadpaalForm] = useState({ naam: "", beoordeling: "goed", notitie: "", datum: "", lat: null, lng: null });
  const [laadpaalLocatieLoading, setLaadpaalLocatieLoading] = useState(false);
  const [showPlekKiezer, setShowPlekKiezer] = useState(false);

  // ── Data ─────────────────────────────────────────────
  const persistPlaces = useCallback((nextPlaces) => {
    lastWriteRef.current = Date.now();
    setPlacesState(nextPlaces);
    saveData({ places: nextPlaces, trips });
  }, [trips]);

  const persistTrips = useCallback((nextTrips) => {
    lastWriteRef.current = Date.now();
    setTripsState(nextTrips);
    saveData({ places, trips: nextTrips });
  }, [places]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (Date.now() - lastWriteRef.current < 5000) return;
      const data = await loadData();
      if (active && data) { setPlacesState(data.places || []); setTripsState(data.trips || []); setLoading(false); }
      else if (active) setLoading(false);
    };
    refresh();
    const poll = setInterval(refresh, 8000);
    return () => { active = false; clearInterval(poll); };
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  // Stelt een leesbaar deel-bericht samen voor een plek en opent de native
  // deel-UI (WhatsApp, Berichten, Mail, ...). Op toestellen/browsers zonder
  // Web Share API valt dit terug op een directe WhatsApp-link.
  async function deelPlek(place) {
    const cat = CATEGORIEEN.find(c => c.id === place.categorie);
    const regels = [`📍 ${place.naam}`];
    if (cat) regels.push(`${cat.icon} ${cat.label}`);
    if (place.stad || place.land) regels.push([place.stad, place.land].filter(Boolean).join(", "));
    const gemBeoordeling = weergaveBeoordeling(place);
    if (gemBeoordeling > 0) regels.push("⭐".repeat(Math.round(gemBeoordeling)));
    if (place.tips) regels.push(`\n💡 ${place.tips}`);
    else if (place.notitie) regels.push(`\n📝 ${place.notitie}`);
    if (place.lat && place.lng) regels.push(`\n🗺️ https://www.google.com/maps?q=${place.lat},${place.lng}`);
    else if (place.adres) regels.push(`\n🗺️ https://www.google.com/maps?q=${encodeURIComponent(place.adres)}`);
    const tekst = regels.join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ title: place.naam, text: tekst });
      } catch (e) {
        // Gebruiker annuleerde het deelvenster — geen actie nodig.
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(tekst)}`, "_blank");
    }
  }

  // Deelt een hele trip: alle gekoppelde plekken + gelogde laadpalen in
  // volgorde, als één overzichtelijk bericht.
  async function deelTrip(trip, tripPlaces) {
    const regels = [`🚗 ${trip.naam}${trip.periode ? ` (${trip.periode})` : ""}`];
    if (tripPlaces.length > 0) {
      regels.push(`\n📍 Plekken:`);
      tripPlaces.forEach(p => regels.push(`• ${p.naam}${p.stad ? ` — ${p.stad}` : ""}`));
    }
    if ((trip.laadpalen || []).length > 0) {
      const laadpaalLabel = { goed: "👍", matig: "😐", slecht: "👎" };
      regels.push(`\n🔌 Laadpalen:`);
      trip.laadpalen.forEach((l, i) => regels.push(`${i + 1}. ${l.naam} ${laadpaalLabel[l.beoordeling] || ""}`));
    }
    const tekst = regels.join("\n");

    if (navigator.share) {
      try { await navigator.share({ title: trip.naam, text: tekst }); } catch (e) { /* geannuleerd */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(tekst)}`, "_blank");
    }
  }

  // ── Weer voor de geopende plek ────────────────────────
  useEffect(() => {
    const plek = places.find(p => p.id === activePlaceId);
    if (!plek?.lat || !plek?.lng) { setWeer(null); return; }
    let actief = true;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${plek.lat}&longitude=${plek.lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto&forecast_days=5`)
      .then(r => r.json())
      .then(data => {
        if (!actief || !data?.daily) return;
        setWeer({
          dagen: data.daily.time.slice(0, 5).map((d, i) => ({
            datum: d, max: data.daily.temperature_2m_max[i], min: data.daily.temperature_2m_min[i],
            regen: data.daily.precipitation_sum[i], code: data.daily.weathercode[i],
          })),
        });
      }).catch(() => { if (actief) setWeer(null); });
    return () => { actief = false; };
  }, [activePlaceId]);

  function weerIcoon(code) {
    if (code === 0) return "☀️";
    if (code <= 2) return "🌤️";
    if (code <= 3) return "☁️";
    if (code <= 48) return "🌫️";
    if (code <= 67) return "🌧️";
    if (code <= 77) return "🌨️";
    if (code <= 82) return "🌦️";
    return "⛈️";
  }

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

  // ── "In de buurt" ──────────────────────────────────────
  function afstandKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function haalBuurtLocatie() {
    setBuurtLoading(true);
    setBuurtFout(null);
    navigator.geolocation?.getCurrentPosition(pos => {
      setBuurtLocatie({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setBuurtLoading(false);
    }, () => {
      setBuurtFout("Locatie niet beschikbaar. Geef de app toestemming voor locatie in je instellingen.");
      setBuurtLoading(false);
    });
  }

  const plekkenMetAfstand = buurtLocatie
    ? places.filter(p => p.lat && p.lng)
        .map(p => ({ ...p, afstand: afstandKm(buurtLocatie.lat, buurtLocatie.lng, p.lat, p.lng) }))
        .filter(p => p.afstand <= 50)
        .sort((a, b) => a.afstand - b.afstand)
    : [];

  // ── Locatie importeren via een gedeelde Google Maps-link ──
  // Ondersteunt zowel volledige links (.../@lat,lng,zoom of ?q=lat,lng) als
  // verkorte maps.app.goo.gl-links (die eerst server-side herleid worden).
  function parseMapsUrl(url) {
    let match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (!match) match = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (!match) return null;
    const lat = parseFloat(match[1]), lng = parseFloat(match[2]);
    const naamMatch = url.match(/\/maps\/place\/([^/@]+)/);
    const naam = naamMatch ? decodeURIComponent(naamMatch[1].replace(/\+/g, " ")) : null;
    return { lat, lng, naam };
  }

  async function importeerVanMapsLink() {
    if (!mapsImportUrl.trim()) return;
    setMapsImportLoading(true);
    try {
      let url = mapsImportUrl.trim();
      let resultaat = parseMapsUrl(url);
      if (!resultaat) {
        // Waarschijnlijk een verkorte link — laat de server de redirect volgen
        const res = await fetch("/api/resolve-link", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (data.resolvedUrl) resultaat = parseMapsUrl(data.resolvedUrl);
      }
      if (!resultaat) {
        showToast("❌ Kon geen locatie uit deze link halen");
      } else {
        setForm(f => ({ ...f, lat: resultaat.lat, lng: resultaat.lng, naam: resultaat.naam || f.naam }));
        // Reverse geocoding voor stad/land, net als bij GPS-locatie
        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${resultaat.lat}&lon=${resultaat.lng}&format=json`);
          const geoData = await geoRes.json();
          const adres = geoData.address;
          setForm(f => ({
            ...f, stad: adres.city || adres.town || adres.village || adres.municipality || f.stad,
            land: adres.country || f.land,
          }));
        } catch { /* reverse geocoding optioneel */ }
        showToast("✅ Locatie geïmporteerd uit link");
      }
    } catch {
      showToast("❌ Importeren mislukt");
    }
    setMapsImportLoading(false);
  }

  // ── Foto's (met compressie) ───────────────────────────
  // ── Trip mutaties ──────────────────────────────────────
  function resetTripForm() { setTripForm({ naam: "", periode: "" }); setEditTripId(null); }

  function voegTripToe() {
    if (!tripForm.naam.trim()) return;
    if (editTripId) {
      persistTrips(trips.map(t => t.id === editTripId ? { ...t, naam: tripForm.naam.trim(), periode: tripForm.periode } : t));
      showToast("✅ Trip bijgewerkt");
    } else {
      const nieuw = { id: uid(), naam: tripForm.naam.trim(), periode: tripForm.periode, placeIds: [], laadpalen: [], aangemaaktOp: Date.now() };
      persistTrips([...trips, nieuw]);
      showToast(`✅ ${nieuw.naam} aangemaakt`);
    }
    resetTripForm();
    setShowTripForm(false);
  }

  function openBewerkTrip(trip) {
    setTripForm({ naam: trip.naam, periode: trip.periode || "" });
    setEditTripId(trip.id);
    setShowTripForm(true);
  }

  function verwijderTrip(id) {
    if (!window.confirm("Trip verwijderen? De plekken zelf blijven bestaan.")) return;
    persistTrips(trips.filter(t => t.id !== id));
    setActiveTripId(null);
  }

  function toggleePlekInTrip(tripId, placeId) {
    persistTrips(trips.map(t => {
      if (t.id !== tripId) return t;
      const heeft = (t.placeIds || []).includes(placeId);
      return {
        ...t,
        placeIds: heeft ? t.placeIds.filter(id => id !== placeId) : [...(t.placeIds || []), placeId],
        // Als een plek uit de trip wordt gehaald, hoeft 'ie ook niet meer als bezocht te tellen.
        bezochtIds: heeft ? (t.bezochtIds || []).filter(id => id !== placeId) : (t.bezochtIds || []),
      };
    }));
  }

  // Vinkje "bezocht tijdens deze trip" — los van de algemene Wil-naartoe/
  // Geweest-status van de plek zelf, specifiek voor voortgang binnen de trip.
  function toggleBezochtInTrip(tripId, placeId) {
    persistTrips(trips.map(t => {
      if (t.id !== tripId) return t;
      const heeft = (t.bezochtIds || []).includes(placeId);
      return { ...t, bezochtIds: heeft ? t.bezochtIds.filter(id => id !== placeId) : [...(t.bezochtIds || []), placeId] };
    }));
  }

  // ── Laadpalen per trip ─────────────────────────────────
  function resetLaadpaalForm() { setLaadpaalForm({ naam: "", beoordeling: "goed", notitie: "", datum: "", lat: null, lng: null }); setEditLaadpaalId(null); }

  function haalLaadpaalLocatie() {
    setLaadpaalLocatieLoading(true);
    navigator.geolocation?.getCurrentPosition(pos => {
      setLaadpaalForm(f => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude }));
      setLaadpaalLocatieLoading(false);
      showToast("✅ Locatie ingevuld");
    }, () => {
      setLaadpaalLocatieLoading(false);
      showToast("❌ Locatie niet beschikbaar");
    });
  }

  function voegLaadpaalToe(tripId) {
    if (!laadpaalForm.naam.trim()) return;
    persistTrips(trips.map(t => {
      if (t.id !== tripId) return t;
      if (editLaadpaalId) {
        return { ...t, laadpalen: t.laadpalen.map(l => l.id === editLaadpaalId ? { ...l, ...laadpaalForm } : l) };
      }
      const nieuw = { id: uid(), ...laadpaalForm };
      return { ...t, laadpalen: [...(t.laadpalen || []), nieuw] };
    }));
    resetLaadpaalForm();
    setShowLaadpaalForm(false);
    showToast("✅ Laadpaal opgeslagen");
  }

  function openBewerkLaadpaal(laadpaal) {
    setLaadpaalForm({ naam: laadpaal.naam, beoordeling: laadpaal.beoordeling, notitie: laadpaal.notitie || "", datum: laadpaal.datum || "", lat: laadpaal.lat || null, lng: laadpaal.lng || null });
    setEditLaadpaalId(laadpaal.id);
    setShowLaadpaalForm(true);
  }

  function verwijderLaadpaal(tripId, laadpaalId) {
    persistTrips(trips.map(t => t.id === tripId
      ? { ...t, laadpalen: t.laadpalen.filter(l => l.id !== laadpaalId) } : t));
  }

  // Verplaatst een laadpaal één plek op of neer in de volgorde — dit bepaalt
  // de rijroute (van boven naar beneden).
  function verplaatsLaadpaal(tripId, laadpaalId, richting) {
    persistTrips(trips.map(t => {
      if (t.id !== tripId) return t;
      const lijst = [...(t.laadpalen || [])];
      const i = lijst.findIndex(l => l.id === laadpaalId);
      const j = i + richting;
      if (i < 0 || j < 0 || j >= lijst.length) return t;
      [lijst[i], lijst[j]] = [lijst[j], lijst[i]];
      return { ...t, laadpalen: lijst };
    }));
  }

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

  // Herkent een plek op een foto (bordje, gevel, etc.) en vult naam +
  // categorie automatisch in via de AI-proxy.
  async function herkenFotoAI(base64) {
    setAiFotoLoading(true);
    try {
      const catIds = CATEGORIEEN.map(c => c.id).join("|");
      const tekst = await callAI(
        `Bekijk deze foto van een plek (restaurant, gebouw, bezienswaardigheid, winkel, camperplek, etc). ` +
        `Geef ALLEEN een JSON-object terug, zonder uitleg, markdown of codeblok, in exact dit formaat: ` +
        `{"naam": "...", "categorie": "${catIds}"}. ` +
        `Gebruik voor "naam" de naam die je op een bordje/gevel ziet staan, of anders een korte beschrijving (max 4 woorden). ` +
        `Kies voor "categorie" de best passende uit de gegeven opties.`,
        base64.split(",")[1], "image/jpeg"
      );
      const schoon = tekst.replace(/```json|```/g, "").trim();
      const resultaat = JSON.parse(schoon);
      setForm(f => ({
        ...f,
        naam: resultaat.naam || f.naam,
        categorie: CATEGORIEEN.some(c => c.id === resultaat.categorie) ? resultaat.categorie : f.categorie,
      }));
      showToast("✨ Naam en categorie ingevuld door AI");
    } catch (e) {
      showToast("❌ AI-herkenning mislukt, vul handmatig in");
    }
    setAiFotoLoading(false);
  }

  // ── Place mutaties ────────────────────────────────────
  function voegPlaceToe() {
    if (!form.naam.trim()) return;
    const nieuw = { ...form, id: uid(), aangemaaktOp: Date.now() };
    persistPlaces([...places, nieuw]);
    resetForm();
    setShowForm(false);
    showToast(`✅ ${nieuw.naam} opgeslagen`);
  }

  function updatePlace(id, fields) {
    persistPlaces(places.map(p => p.id === id ? { ...p, ...fields } : p));
  }

  function verwijderPlace(id) {
    if (!window.confirm("Plek verwijderen?")) return;
    persistPlaces(places.filter(p => p.id !== id));
    setActivePlaceId(null);
    // Verwijder de plek ook uit eventuele trips
    persistTrips(trips.map(t => ({ ...t, placeIds: (t.placeIds || []).filter(pid => pid !== id) })));
  }

  function resetForm() {
    setForm({ naam: "", categorie: "eten", status: "wil", land: "Nederland", stad: "", adres: "", lat: null, lng: null, beoordeling: 0, beoordelingen: { Pepijn: 0, Tessa: 0 }, notitie: "", tips: "", fotos: [], bezoekdatum: "", website: "", kosten: "" });
    setMapsImportUrl("");
  }

  function openBewerkForm(place) {
    setForm({ beoordelingen: { Pepijn: 0, Tessa: 0 }, ...place });
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
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ background: C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"6px 10px", cursor:"pointer", color:C.blue, display:"flex", alignItems:"center" }}
              onClick={() => deelPlek(activePlace)} aria-label="Delen" title="Delen">
              <Share2 size={15} />
            </button>
            <button style={{ background: C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", color:C.blue }}
              onClick={() => openBewerkForm(activePlace)}>
              ✏️
            </button>
          </div>
        </header>

        <main style={S.main}>
          {/* Foto's */}
          {activePlace.fotos?.length > 0 && (
            <div style={{ display:"flex", gap:8, overflowX:"auto", marginBottom:14, paddingBottom:4 }}>
              {activePlace.fotos.map((foto, i) => (
                <img key={i} src={foto} alt="" style={{ height:160, width:"auto", borderRadius:12, objectFit:"cover", flexShrink:0, cursor:"pointer" }}
                  onClick={() => setLightboxIdx(i)} />
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

          {/* Beoordeling per persoon */}
          <div style={S.card}>
            {["Pepijn","Tessa"].map(naam => (
              <div key={naam} style={{ display:"flex", alignItems:"center", gap:10, marginBottom: naam==="Pepijn" ? 8 : 0 }}>
                <span style={{ fontSize:13, color:C.muted, width:56 }}>{naam}</span>
                <div style={{ display:"flex", gap:2 }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, padding:2 }}
                      onClick={() => updatePlace(activePlace.id, { beoordelingen: { ...(activePlace.beoordelingen||{Pepijn:0,Tessa:0}), [naam]: n === ((activePlace.beoordelingen?.[naam])||0) ? 0 : n } })}>
                      {n <= ((activePlace.beoordelingen?.[naam])||0) ? "⭐" : "☆"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Locatie-info */}
          <div style={S.card}>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom: activePlace.adres ? 8 : 0 }}>
              {activePlace.stad && <span style={{ fontSize:13 }}>📍 {activePlace.stad}</span>}
              {activePlace.land && <span style={{ fontSize:13, color:C.muted }}>{activePlace.land}</span>}
              {activePlace.bezoekdatum && <span style={{ fontSize:13, color:C.muted }}>🗓 {activePlace.bezoekdatum}</span>}
              {activePlace.kosten && <span style={{ fontSize:13, color:C.green, fontWeight:700 }}>💶 €{parseFloat(activePlace.kosten).toFixed(2)}</span>}
            </div>
            {activePlace.adres && <p style={{ fontSize:12, color:C.muted, margin:0 }}>{activePlace.adres}</p>}
            {activePlace.website && (
              <a href={activePlace.website} target="_blank" rel="noreferrer"
                style={{ fontSize:12, color:C.blue, display:"block", marginTop:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                🔗 {activePlace.website}
              </a>
            )}
            {activePlace.lat && activePlace.lng && (
              <div style={{ display:"flex", gap:8, marginTop:10 }}>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${activePlace.lat},${activePlace.lng}`} target="_blank" rel="noreferrer"
                  style={{ ...S.btn(C.blue), flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, textDecoration:"none", fontSize:13 }}>
                  🧭 Maps
                </a>
                <a href={`https://waze.com/ul?ll=${activePlace.lat},${activePlace.lng}&navigate=yes`} target="_blank" rel="noreferrer"
                  style={{ ...S.btn("#33CCFF", "#FFFFFF"), flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, textDecoration:"none", fontSize:13 }}>
                  🚗 Waze
                </a>
              </div>
            )}
          </div>

          {/* Weer voor deze plek */}
          {weer && (
            <div style={S.card}>
              <h3 style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.blue }}>🌤️ Weer</h3>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                {weer.dagen.map((dag, i) => (
                  <div key={i} style={{ textAlign:"center", flex:1 }}>
                    <p style={{ margin:"0 0 4px", fontSize:10, color:C.muted }}>
                      {i === 0 ? "Vandaag" : new Date(dag.datum).toLocaleDateString("nl-NL", { weekday:"short" })}
                    </p>
                    <p style={{ margin:"0 0 4px", fontSize:18 }}>{weerIcoon(dag.code)}</p>
                    <p style={{ margin:0, fontSize:11, color:C.text }}>{Math.round(dag.max)}°</p>
                    <p style={{ margin:0, fontSize:10, color:C.muted }}>{Math.round(dag.min)}°</p>
                  </div>
                ))}
              </div>
            </div>
          )}

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

        {/* Foto-lightbox */}
        {lightboxIdx !== null && activePlace.fotos?.[lightboxIdx] && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.92)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}
            onClick={() => setLightboxIdx(null)}>
            <button onClick={() => setLightboxIdx(null)} aria-label="Sluiten"
              style={{ position:"absolute", top:20, right:20, background:"rgba(255,255,255,.15)", border:"none", borderRadius:"50%", width:36, height:36, cursor:"pointer", color:"#FFF", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <X size={20} color="#FFF" />
            </button>
            {activePlace.fotos.length > 1 && lightboxIdx > 0 && (
              <button onClick={e => { e.stopPropagation(); setLightboxIdx(i => i - 1); }}
                style={{ position:"absolute", left:12, background:"rgba(255,255,255,.15)", border:"none", borderRadius:"50%", width:40, height:40, cursor:"pointer", color:"#FFF", fontSize:18 }}>‹</button>
            )}
            <img src={activePlace.fotos[lightboxIdx]} alt="" style={{ maxWidth:"92vw", maxHeight:"85vh", objectFit:"contain", borderRadius:8 }}
              onClick={e => e.stopPropagation()} />
            {activePlace.fotos.length > 1 && lightboxIdx < activePlace.fotos.length - 1 && (
              <button onClick={e => { e.stopPropagation(); setLightboxIdx(i => i + 1); }}
                style={{ position:"absolute", right:12, background:"rgba(255,255,255,.15)", border:"none", borderRadius:"50%", width:40, height:40, cursor:"pointer", color:"#FFF", fontSize:18 }}>›</button>
            )}
            {activePlace.fotos.length > 1 && (
              <p style={{ position:"absolute", bottom:20, color:"#FFF", fontSize:12, opacity:0.8 }}>{lightboxIdx + 1} / {activePlace.fotos.length}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  const activeTrip = trips.find(t => t.id === activeTripId);

  // ════════════════════════
  // TRIP DETAIL
  // ════════════════════════
  if (activeTrip) {
    const tripPlaces = places.filter(p => (activeTrip.placeIds || []).includes(p.id));
    const laadpaalKleur = { goed: C.green, matig: C.yellow, slecht: C.red };
    const laadpaalLabel = { goed: "👍 Goed", matig: "😐 Matig", slecht: "👎 Slecht" };

    return (
      <div style={S.appBg}>
        {toast && <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", background:C.blue, color:"#FFF", padding:"9px 20px", borderRadius:10, fontWeight:700, zIndex:999, fontSize:13 }}>{toast}</div>}

        <header style={{ ...S.header, alignItems:"center" }}>
          <button style={{ background:"none", border:"none", cursor:"pointer" }} onClick={() => setActiveTripId(null)}>
            <ChevronLeft size={20} color={C.blue} />
          </button>
          <div style={{ flex:1, textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.muted }}>{activeTrip.periode || "Trip"}</div>
            <h1 style={{ ...S.title, fontSize:18, margin:0 }}>🚗 {activeTrip.naam}</h1>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"6px 10px", cursor:"pointer", color:C.blue, display:"flex", alignItems:"center" }}
              onClick={() => deelTrip(activeTrip, tripPlaces)} aria-label="Trip delen" title="Trip delen">
              <Share2 size={15} />
            </button>
            <button style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"6px 12px", fontSize:12, cursor:"pointer" }}
              onClick={() => openBewerkTrip(activeTrip)}>✏️</button>
          </div>
        </header>

        <main style={S.main}>
          {/* Gekoppelde plekken */}
          <div style={S.card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
              <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:C.blue }}>📍 Plekken ({tripPlaces.length})</h3>
              <button style={{ background:"none", border:"none", color:C.blue, fontSize:12, fontWeight:600, cursor:"pointer" }}
                onClick={() => setShowPlekKiezer(true)}>+ Toevoegen</button>
            </div>
            {tripPlaces.length > 0 && (() => {
              const bezocht = tripPlaces.filter(p => (activeTrip.bezochtIds || []).includes(p.id)).length;
              const totaalKosten = tripPlaces.reduce((s, p) => s + (parseFloat(p.kosten) || 0), 0);
              return (
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10, fontSize:11, color:C.muted }}>
                  <span>✅ {bezocht}/{tripPlaces.length} bezocht</span>
                  {totaalKosten > 0 && <span style={{ color:C.green, fontWeight:700 }}>💶 €{totaalKosten.toFixed(2)} totaal</span>}
                </div>
              );
            })()}
            {tripPlaces.length === 0 ? (
              <p style={{ fontSize:12, color:C.muted, margin:0 }}>Nog geen plekken gekoppeld aan deze trip.</p>
            ) : tripPlaces.map(place => {
              const cat = CATEGORIEEN.find(c => c.id === place.categorie);
              const bezocht = (activeTrip.bezochtIds || []).includes(place.id);
              return (
                <div key={place.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span role="checkbox" aria-checked={bezocht} onClick={() => toggleBezochtInTrip(activeTrip.id, place.id)} title="Bezocht tijdens deze trip"
                    style={{ width:18, height:18, borderRadius:6, border:`2px solid ${bezocht?C.green:C.border}`, background:bezocht?C.green:"#FFF", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer" }}>
                    {bezocht && <span style={{ color:"#FFF", fontSize:11 }}>✓</span>}
                  </span>
                  <span style={{ fontSize:16 }}>{cat?.icon}</span>
                  <span style={{ flex:1, fontSize:13, cursor:"pointer", textDecoration: bezocht ? "line-through" : "none", color: bezocht ? C.muted : C.text }} onClick={() => setActivePlaceId(place.id)}>
                    {place.naam}{place.kosten ? ` · €${parseFloat(place.kosten).toFixed(2)}` : ""}
                  </span>
                  <button onClick={() => toggleePlekInTrip(activeTrip.id, place.id)}
                    style={{ background:"none", border:"none", cursor:"pointer", color:C.muted }}>
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Laadpalen */}
          <div style={S.card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:C.blue }}>🔌 Laadpalen ({(activeTrip.laadpalen||[]).length})</h3>
              <button style={{ background:"none", border:"none", color:C.blue, fontSize:12, fontWeight:600, cursor:"pointer" }}
                onClick={() => { resetLaadpaalForm(); setShowLaadpaalForm(true); }}>+ Toevoegen</button>
            </div>

            {(() => {
              const laadpalenMetLocatie = (activeTrip.laadpalen || []).filter(l => l.lat && l.lng);
              if (laadpalenMetLocatie.length === 0) return null;
              const routeStops = laadpalenMetLocatie.map(l => ({ naam: l.naam, lat: l.lat, lng: l.lng }));
              const routeUrl = (() => {
                if (routeStops.length === 1) {
                  return `https://www.google.com/maps/dir/?api=1&destination=${routeStops[0].lat},${routeStops[0].lng}`;
                }
                const origin = routeStops[0];
                const bestemming = routeStops[routeStops.length - 1];
                const tussenstops = routeStops.slice(1, -1).map(s => `${s.lat},${s.lng}`).join("|");
                let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${bestemming.lat},${bestemming.lng}&travelmode=driving`;
                if (tussenstops) url += `&waypoints=${tussenstops}`;
                return url;
              })();
              return (
                <div style={{ marginBottom: 12 }}>
                  <RouteKaart stops={routeStops} />
                  <a href={routeUrl} target="_blank" rel="noreferrer"
                    style={{ ...S.btn(C.blue), display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginTop:10, textDecoration:"none", fontSize:13 }}>
                    🧭 Route openen in Maps ({routeStops.length} stop{routeStops.length !== 1 ? "s" : ""})
                  </a>
                  {routeStops.length > 1 && (
                    <div style={{ marginTop:10, background:C.card, borderRadius:10, padding:"8px 12px" }}>
                      {routeStops.slice(1).map((stop, i) => {
                        const vorige = routeStops[i];
                        const km = afstandKm(vorige.lat, vorige.lng, stop.lat, stop.lng);
                        const minuten = Math.round(km / 80 * 60); // ruwe schatting o.b.v. 80 km/u gemiddeld
                        return (
                          <div key={i} style={{ fontSize:11, color:C.muted, padding:"3px 0" }}>
                            {i + 1} → {i + 2}: <strong style={{ color:C.text }}>{km.toFixed(0)} km</strong> · ~{minuten} min <span style={{ opacity:0.7 }}>(hemelsbreed, geschat)</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {routeStops.length > 1 && (
                    <p style={{ fontSize:11, color:C.muted, textAlign:"center", marginTop:6 }}>
                      Waze ondersteunt geen route met meerdere tussenstops — gebruik hiervoor de 🚗-knop per laadpaal hieronder.
                    </p>
                  )}
                  {laadpalenMetLocatie.length < (activeTrip.laadpalen||[]).length && (
                    <p style={{ fontSize:11, color:C.muted, textAlign:"center", marginTop:6 }}>
                      {(activeTrip.laadpalen||[]).length - laadpalenMetLocatie.length} laadpaal/palen zonder locatie staan niet op de kaart
                    </p>
                  )}
                </div>
              );
            })()}

            {(activeTrip.laadpalen||[]).length === 0 ? (
              <p style={{ fontSize:12, color:C.muted, margin:0 }}>Nog geen laadpalen gelogd voor deze trip.</p>
            ) : activeTrip.laadpalen.map((lp, i) => (
              <div key={lp.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", flexDirection:"column", gap:2, paddingTop:2 }}>
                  <button onClick={() => verplaatsLaadpaal(activeTrip.id, lp.id, -1)} disabled={i === 0}
                    style={{ background:"none", border:"none", cursor: i===0 ? "default" : "pointer", color: i===0 ? "#D8D8D8" : C.muted, padding:0, lineHeight:1, fontSize:12 }}>▲</button>
                  <span style={{ fontSize:10, color:C.muted, textAlign:"center" }}>{i + 1}</span>
                  <button onClick={() => verplaatsLaadpaal(activeTrip.id, lp.id, 1)} disabled={i === activeTrip.laadpalen.length - 1}
                    style={{ background:"none", border:"none", cursor: i===activeTrip.laadpalen.length-1 ? "default" : "pointer", color: i===activeTrip.laadpalen.length-1 ? "#D8D8D8" : C.muted, padding:0, lineHeight:1, fontSize:12 }}>▼</button>
                </div>
                <div style={{ flex:1, cursor:"pointer" }} onClick={() => openBewerkLaadpaal(lp)}>
                  <p style={{ margin:"0 0 3px", fontWeight:700, fontSize:13 }}>
                    {lp.naam} {lp.lat && lp.lng && <span title="Heeft locatie">📍</span>}
                  </p>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:11, fontWeight:700, color:laadpaalKleur[lp.beoordeling] }}>{laadpaalLabel[lp.beoordeling]}</span>
                    {lp.datum && <span style={{ fontSize:11, color:C.muted }}>{lp.datum}</span>}
                  </div>
                  {lp.notitie && <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>{lp.notitie}</p>}
                </div>
                {lp.lat && lp.lng && (
                  <a href={`https://waze.com/ul?ll=${lp.lat},${lp.lng}&navigate=yes`} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()} title="Navigeer met Waze"
                    style={{ background:"#33CCFF22", border:"none", borderRadius:8, padding:"5px 7px", cursor:"pointer", textDecoration:"none", fontSize:13, display:"flex", alignItems:"center" }}>
                    🚗
                  </a>
                )}
                <button onClick={() => verwijderLaadpaal(activeTrip.id, lp.id)}
                  style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, padding:2 }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <button style={{ ...S.btn("#FDE8EC", C.red), border:"1px solid #F5C0C8", width:"100%", marginTop:4 }}
            onClick={() => verwijderTrip(activeTrip.id)}>
            🗑 Trip verwijderen
          </button>
        </main>

        {/* Plekken-kiezer */}
        {showPlekKiezer && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)", zIndex:100, display:"flex", alignItems:"flex-end" }}
            onClick={() => setShowPlekKiezer(false)}>
            <div style={{ background:"#FFF", width:"100%", maxHeight:"75vh", overflowY:"auto", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20, boxSizing:"border-box" }} onClick={e => e.stopPropagation()}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <p style={{ margin:0, fontWeight:700, fontSize:15 }}>Plekken kiezen</p>
                <button onClick={() => setShowPlekKiezer(false)} aria-label="Sluiten" style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                  <X size={18} color={C.muted} />
                </button>
              </div>
              {places.length === 0 ? (
                <p style={{ fontSize:13, color:C.muted }}>Nog geen plekken opgeslagen.</p>
              ) : places.map(place => {
                const cat = CATEGORIEEN.find(c => c.id === place.categorie);
                const gekoppeld = (activeTrip.placeIds || []).includes(place.id);
                return (
                  <div key={place.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid ${C.border}`, cursor:"pointer" }}
                    onClick={() => toggleePlekInTrip(activeTrip.id, place.id)}>
                    <span role="checkbox" aria-checked={gekoppeld} style={{ width:20, height:20, borderRadius:6, border:`2px solid ${gekoppeld?C.blue:C.border}`, background:gekoppeld?C.blue:"#FFF", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {gekoppeld && <span style={{ color:"#FFF", fontSize:12 }}>✓</span>}
                    </span>
                    <span style={{ fontSize:14 }}>{cat?.icon} {place.naam}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Laadpaal toevoegen/bewerken */}
        {showLaadpaalForm && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)", zIndex:100, display:"flex", alignItems:"flex-end" }}
            onClick={() => { setShowLaadpaalForm(false); resetLaadpaalForm(); }}>
            <div style={{ background:"#FFF", width:"100%", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20 }} onClick={e => e.stopPropagation()}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <p style={{ margin:0, fontWeight:700, fontSize:15 }}>🔌 {editLaadpaalId ? "Laadpaal bewerken" : "Laadpaal toevoegen"}</p>
                <button onClick={() => { setShowLaadpaalForm(false); resetLaadpaalForm(); }} aria-label="Sluiten" style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                  <X size={18} color={C.muted} />
                </button>
              </div>
              <input style={{ ...S.inp, marginBottom:10 }} placeholder="Naam of locatie van de laadpaal" value={laadpaalForm.naam} autoFocus
                onChange={e => setLaadpaalForm(f => ({ ...f, naam: e.target.value }))} />
              <p style={{ fontSize:11, color:C.muted, margin:"0 0 6px" }}>Hoe was 'ie?</p>
              <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                {["goed","matig","slecht"].map(b => (
                  <button key={b} style={{ flex:1, border:`2px solid ${laadpaalForm.beoordeling===b ? laadpaalKleur[b] : C.border}`, background:laadpaalForm.beoordeling===b ? laadpaalKleur[b] : "transparent", color:laadpaalForm.beoordeling===b ? "#FFF" : C.muted, borderRadius:12, padding:"8px 0", fontSize:12, fontWeight:600, cursor:"pointer" }}
                    onClick={() => setLaadpaalForm(f => ({ ...f, beoordeling: b }))}>
                    {laadpaalLabel[b]}
                  </button>
                ))}
              </div>
              <input style={{ ...S.inp, marginBottom:10 }} type="date" value={laadpaalForm.datum}
                onChange={e => setLaadpaalForm(f => ({ ...f, datum: e.target.value }))} />

              <p style={{ fontSize:11, color:C.muted, margin:"0 0 6px" }}>Locatie (voor de route)</p>
              <button style={{ ...S.btn(C.card, C.blue), border:`1px solid ${C.border}`, width:"100%", marginBottom:8, fontSize:13 }}
                onClick={haalLaadpaalLocatie} disabled={laadpaalLocatieLoading}>
                {laadpaalLocatieLoading ? "📡 Locatie ophalen…" : "📍 Huidige locatie gebruiken (GPS)"}
              </button>
              <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                <input style={{ ...S.inp, flex:1, padding:"8px 10px", fontSize:12 }} placeholder="Breedtegraad (lat)"
                  type="number" step="any" value={laadpaalForm.lat || ""}
                  onChange={e => setLaadpaalForm(f => ({ ...f, lat: e.target.value ? parseFloat(e.target.value) : null }))} />
                <input style={{ ...S.inp, flex:1, padding:"8px 10px", fontSize:12 }} placeholder="Lengtegraad (lng)"
                  type="number" step="any" value={laadpaalForm.lng || ""}
                  onChange={e => setLaadpaalForm(f => ({ ...f, lng: e.target.value ? parseFloat(e.target.value) : null }))} />
              </div>

              <textarea style={{ ...S.inp, marginBottom:16, height:70, resize:"none" }} placeholder="Notitie (optioneel, bv. wachttijd, prijs, aantal palen)"
                value={laadpaalForm.notitie} onChange={e => setLaadpaalForm(f => ({ ...f, notitie: e.target.value }))} />
              <button style={{ ...S.btn(), width:"100%" }} onClick={() => voegLaadpaalToe(activeTrip.id)}>
                {editLaadpaalId ? "Opslaan" : "Toevoegen"}
              </button>
            </div>
          </div>
        )}

        {/* Trip hernoemen (ook bereikbaar vanuit dit detailscherm) */}
        {showTripForm && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)", zIndex:100, display:"flex", alignItems:"flex-end" }}
            onClick={() => { setShowTripForm(false); resetTripForm(); }}>
            <div style={{ background:"#FFF", width:"100%", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20 }} onClick={e => e.stopPropagation()}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <p style={{ margin:0, fontWeight:700, fontSize:16, color:C.blue }}>✏️ Trip bewerken</p>
                <button onClick={() => { setShowTripForm(false); resetTripForm(); }} aria-label="Sluiten"
                  style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                  <X size={20} color={C.muted} />
                </button>
              </div>
              <input style={{ ...S.inp, marginBottom:10 }} placeholder="Naam" value={tripForm.naam} autoFocus
                onChange={e => setTripForm(f => ({ ...f, naam: e.target.value }))} />
              <input style={{ ...S.inp, marginBottom:16 }} placeholder="Periode (optioneel)" value={tripForm.periode}
                onChange={e => setTripForm(f => ({ ...f, periode: e.target.value }))} />
              <button style={{ ...S.btn(), width:"100%" }} onClick={voegTripToe}>Opslaan</button>
            </div>
          </div>
        )}
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
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <p style={{ margin:0, fontWeight:700, fontSize:16, color:C.blue }}>{bewerkModus ? "✏️ Plek bewerken" : "📍 Nieuwe plek"}</p>
              <button onClick={() => { setShowForm(false); if (!bewerkModus) resetForm(); setBewerkModus(false); }} aria-label="Sluiten"
                style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                <X size={20} color={C.muted} />
              </button>
            </div>

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

            {/* Importeren via gedeelde Maps-link */}
            <p style={{ fontSize:11, color:C.muted, margin:"0 0 6px" }}>Locatie importeren uit een gedeelde link</p>
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              <input style={{ ...S.inp, flex:1, padding:"10px 12px", fontSize:13 }} placeholder="Plak een Google Maps-link…"
                value={mapsImportUrl} onChange={e => setMapsImportUrl(e.target.value)} />
              <button style={{ ...S.btn(C.card, C.blue), border:`1px solid ${C.border}`, padding:"0 14px", fontSize:13, whiteSpace:"nowrap" }}
                onClick={importeerVanMapsLink} disabled={mapsImportLoading || !mapsImportUrl.trim()}>
                {mapsImportLoading ? "…" : "Importeer"}
              </button>
            </div>

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

            {/* Kosten (bv. overnachting/camperplek) */}
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Kosten (optioneel, bv. per nacht)</label>
              <input style={S.inp} type="number" step="0.01" placeholder="€" value={form.kosten||""}
                onChange={e=>setForm(f=>({...f,kosten:e.target.value}))} />
            </div>

            {/* Beoordeling per persoon */}
            <p style={{ fontSize:11, color:C.muted, margin:"0 0 6px" }}>Beoordeling</p>
            {["Pepijn","Tessa"].map(naam => (
              <div key={naam} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                <span style={{ fontSize:12, color:C.muted, width:52 }}>{naam}</span>
                {[1,2,3,4,5].map(n => (
                  <button key={n} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, padding:1 }}
                    onClick={() => setForm(f => ({ ...f, beoordelingen: { ...(f.beoordelingen||{Pepijn:0,Tessa:0}), [naam]: n === (f.beoordelingen?.[naam]||0) ? 0 : n } }))}>
                    {n <= ((form.beoordelingen?.[naam])||0) ? "⭐" : "☆"}
                  </button>
                ))}
              </div>
            ))}
            <div style={{ marginBottom: 4 }} />

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
            <input ref={fotoRef} type="file" accept="image/*" style={{ display:"none" }}
              onChange={e => voegFotoToe(e.target.files[0])} />
            {(form.fotos||[]).length > 0 && (
              <>
                <button style={{ ...S.btn(C.card, C.blue), border:`1px solid ${C.border}`, width:"100%", fontSize:13 }}
                  onClick={() => herkenFotoAI(form.fotos[0])} disabled={aiFotoLoading}>
                  {aiFotoLoading ? "🤖 Herkennen…" : "✨ Naam & categorie herkennen met AI"}
                </button>
                {aiKostenMaand != null && aiKostenMaand > 0 && (
                  <Link href="/ai-kosten" style={{ display: "block", textAlign: "center", fontSize: 10, color: C.muted, textDecoration: "none", marginTop: 4, marginBottom: 12 }}>
                    💰 €{aiKostenMaand.toFixed(2)} deze maand aan AI-herkenning
                  </Link>
                )}
                {(aiKostenMaand == null || aiKostenMaand === 0) && <div style={{ marginBottom: 12 }} />}
              </>
            )}

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
      <div style={{ display:"flex", gap:4, background:"#FFFFFF", borderRadius:12, margin:"0 20px 14px", border:`1px solid ${C.border}`, padding:"4px", flexWrap:"wrap" }}>
        {[["kaart","🗺️ Kaart"],["lijst","📋 Lijst"],["buurt","📍 Buurt"],["trips","🚗 Trips"]].map(([t,l]) => (
          <button key={t} style={{ ...S.tabBtn(tab===t), minWidth: "45%" }} onClick={()=>setTab(t)}>{l}</button>
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
                    {weergaveBeoordeling(place) > 0 && <span style={{ fontSize:10, color:C.muted }}>{"⭐".repeat(Math.round(weergaveBeoordeling(place)))}</span>}
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
                              <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:8, flexShrink:0 }}>
                                <span style={{ fontSize:14 }}>{status?.icon}</span>
                                <button onClick={e => { e.stopPropagation(); deelPlek(place); }} aria-label="Delen"
                                  style={{ background:"none", border:"none", cursor:"pointer", padding:2, display:"flex", color:C.muted }}>
                                  <Share2 size={13} />
                                </button>
                              </div>
                            </div>
                            <p style={{ margin:"0 0 4px", fontSize:12, color:C.muted }}>
                              {[place.stad, place.land].filter(Boolean).join(", ")}
                              {place.bezoekdatum ? ` · ${place.bezoekdatum}` : ""}
                            </p>
                            {weergaveBeoordeling(place) > 0 && <span style={{ fontSize:11 }}>{"⭐".repeat(Math.round(weergaveBeoordeling(place)))}</span>}
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

        {/* In de buurt */}
        {tab === "buurt" && (
          <>
            {!buurtLocatie ? (
              <div style={{ ...S.card, textAlign:"center", padding:"30px 20px" }}>
                <p style={{ fontSize:14, color:C.text, margin:"0 0 14px" }}>Bekijk welke opgeslagen plekken dicht bij je in de buurt liggen.</p>
                <button style={{ ...S.btn(), width:"100%" }} onClick={haalBuurtLocatie} disabled={buurtLoading}>
                  {buurtLoading ? "📡 Locatie ophalen…" : "📍 Gebruik mijn locatie"}
                </button>
                {buurtFout && <p style={{ fontSize:12, color:C.red, marginTop:10 }}>{buurtFout}</p>}
              </div>
            ) : (
              <>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <p style={{ fontSize:12, color:C.muted, margin:0 }}>{plekkenMetAfstand.length} plekken binnen 50 km</p>
                  <button style={{ background:"none", border:"none", color:C.blue, fontSize:12, cursor:"pointer", fontWeight:600 }} onClick={haalBuurtLocatie}>
                    🔄 Vernieuw
                  </button>
                </div>
                {plekkenMetAfstand.length === 0 ? (
                  <div style={{ ...S.card, textAlign:"center", padding:"24px 20px" }}>
                    <p style={{ fontSize:13, color:C.muted, margin:0 }}>Geen opgeslagen plekken binnen 50 km van je huidige locatie.</p>
                  </div>
                ) : plekkenMetAfstand.map(place => {
                  const cat = CATEGORIEEN.find(c => c.id === place.categorie);
                  const status = STATUSSEN.find(s => s.id === place.status);
                  return (
                    <div key={place.id} style={{ ...S.card, display:"flex", alignItems:"center", gap:12, cursor:"pointer", padding:"12px 14px" }}
                      onClick={() => setActivePlaceId(place.id)}>
                      <div style={{ width:44, height:44, borderRadius:10, background:cat.kleur+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
                        {cat.icon}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ margin:"0 0 2px", fontWeight:700, fontSize:14 }}>{place.naam}</p>
                        <p style={{ margin:0, fontSize:12, color:C.muted }}>{[place.stad, place.land].filter(Boolean).join(", ")}</p>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <p style={{ margin:0, fontSize:13, fontWeight:700, color:C.blue }}>{place.afstand < 1 ? `${Math.round(place.afstand*1000)}m` : `${place.afstand.toFixed(1)}km`}</p>
                        <span style={{ fontSize:13 }}>{status?.icon}</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* Trips */}
        {tab === "trips" && (
          <>
            <button style={{ ...S.btn(C.card, C.blue), border:`1px solid ${C.border}`, width:"100%", marginBottom:14, fontSize:13 }}
              onClick={() => { resetTripForm(); setShowTripForm(true); }}>
              + Nieuwe trip
            </button>
            {trips.length === 0 ? (
              <div style={{ ...S.card, textAlign:"center", padding:"30px 20px" }}>
                <p style={{ fontSize:14, color:C.muted, margin:0 }}>Nog geen trips. Groepeer plekken en laadpalen per vakantie.</p>
              </div>
            ) : trips.map(trip => (
              <div key={trip.id} style={{ ...S.card, cursor:"pointer" }} onClick={() => setActiveTripId(trip.id)}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <p style={{ margin:"0 0 2px", fontWeight:700, fontSize:15 }}>🚗 {trip.naam}</p>
                    {trip.periode && <p style={{ margin:0, fontSize:12, color:C.muted }}>{trip.periode}</p>}
                  </div>
                  <button onClick={e => { e.stopPropagation(); openBewerkTrip(trip); }}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                    ✏️
                  </button>
                </div>
                <div style={{ display:"flex", gap:14, marginTop:8, fontSize:12, color:C.muted }}>
                  <span>📍 {(trip.placeIds||[]).length} plekken</span>
                  <span>🔌 {(trip.laadpalen||[]).length} laadpalen</span>
                </div>
              </div>
            ))}
          </>
        )}
      </main>

      {/* Nieuwe/bewerk trip */}
      {showTripForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)", zIndex:100, display:"flex", alignItems:"flex-end" }}
          onClick={() => { setShowTripForm(false); resetTripForm(); }}>
          <div style={{ background:"#FFF", width:"100%", padding:"20px 20px 36px", borderTopLeftRadius:20, borderTopRightRadius:20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <p style={{ margin:0, fontWeight:700, fontSize:16, color:C.blue }}>{editTripId ? "✏️ Trip bewerken" : "🚗 Nieuwe trip"}</p>
              <button onClick={() => { setShowTripForm(false); resetTripForm(); }} aria-label="Sluiten"
                style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            <input style={{ ...S.inp, marginBottom:10 }} placeholder="Naam (bv. Camper Frankrijk 2026)" value={tripForm.naam} autoFocus
              onChange={e => setTripForm(f => ({ ...f, naam: e.target.value }))} />
            <input style={{ ...S.inp, marginBottom:16 }} placeholder="Periode (optioneel, bv. juli 2026)" value={tripForm.periode}
              onChange={e => setTripForm(f => ({ ...f, periode: e.target.value }))} />
            <button style={{ ...S.btn(), width:"100%" }} onClick={voegTripToe}>{editTripId ? "Opslaan" : "Aanmaken"}</button>
          </div>
        </div>
      )}

      <button style={S.fab} onClick={() => { resetForm(); setShowForm(true); setBewerkModus(false); }}>
        <Plus size={22} color="#FFFFFF" strokeWidth={2.4} />
      </button>
    </div>
  );
}
