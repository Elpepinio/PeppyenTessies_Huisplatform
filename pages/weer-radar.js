import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Play, Pause } from "lucide-react";

const C = { bg: "#0F1B2D", accent: "#5B9BD5", accentDark: "#F2A93B", text: "#F2F4F8", muted: "#8FA0BD" };

// Radar-tegelformaat: 512px op scherpe (retina) schermen, anders 256px —
// zelfde aanpak als RainViewer's eigen voorbeeldcode.
const TILE_SIZE = typeof window !== "undefined" && window.devicePixelRatio >= 2 ? 512 : 256;

export default function WeerRadarApp() {
  const [positie, setPositie] = useState(null);
  const [apiData, setApiData] = useState(null); // ruwe RainViewer-respons
  const [frameIdx, setFrameIdx] = useState(0);
  const [afspelen, setAfspelen] = useState(false);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState(null);

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

  // ── RainViewer-tijdlijn ophalen ───────────────────────────────
  useEffect(() => {
    fetch("https://api.rainviewer.com/public/weather-maps.json")
      .then(r => r.json())
      .then(data => {
        setApiData(data);
        // Start op het meest recente "nu"-frame (laatste past-frame), niet
        // op het allereerste (dat zou 2 uur geleden zijn).
        const past = data.radar?.past || [];
        setFrameIdx(Math.max(0, past.length - 1));
        setLaden(false);
      })
      .catch(() => { setFout("Kon de radardata niet ophalen bij RainViewer."); setLaden(false); });
  }, []);

  const alleFrames = apiData ? [...(apiData.radar?.past || []), ...(apiData.radar?.nowcast || [])] : [];
  const huidigFrame = alleFrames[frameIdx];
  const aantalPastFrames = apiData?.radar?.past?.length || 0;

  // ── Leaflet-kaart opzetten (zelfde laad-patroon als de Places-tool) ────
  useEffect(() => {
    if (typeof window === "undefined" || !positie) return;

    function initMap() {
      if (mapInstanceRef.current || !mapRef.current) return;
      const map = window.L.map(mapRef.current, {
        zoomControl: true,
        dragging: true,        // heen en weer slepen
        touchZoom: true,       // knijp-zoomen op een touchscreen
        scrollWheelZoom: true, // scrollwiel-zoomen op desktop
        doubleClickZoom: true,
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
    if (!map || !apiData || !huidigFrame || !window.L) return;
    if (radarLayerRef.current) map.removeLayer(radarLayerRef.current);
    const laag = window.L.tileLayer(
      `${apiData.host}${huidigFrame.path}/${TILE_SIZE}/{z}/{x}/{y}/2/1_1.png`,
      { opacity: 0.75, zIndex: 5 }
    );
    laag.addTo(map);
    radarLayerRef.current = laag;
  }, [apiData, huidigFrame]);

  // ── Animatie (automatisch doorlopen van de frames) ─────────────────────
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
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
      <header style={{ padding: "20px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/weer" style={{ color: C.muted, fontSize: 12, textTransform: "uppercase", fontWeight: 600, textDecoration: "none" }}>
          <ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> Terug
        </Link>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>🌧️ Regenradar</h1>
        <div style={{ width: 50 }} />
      </header>

      {fout && <p style={{ textAlign: "center", color: "#E0684F", fontSize: 13, padding: "0 20px" }}>{fout}</p>}
      {laden && <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 20 }}>Radar laden…</p>}

      <div ref={mapRef} style={{ width: "100%", height: "56vh", background: "#1B2B45" }} />

      {alleFrames.length > 0 && (
        <div style={{ padding: "16px 20px" }}>
          {/* Tijdlijn — zelfde idee als de "Nu / 08:00 / 09:00"-strip uit
              Buienalarm: een horizontaal doorswipebare rij met tijden, i.p.v.
              een simpele sleepbalk. Scrollt automatisch mee als je afspeelt. */}
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
        </div>
      )}

      {/* Verplichte naamsvermelding onder de gratis voorwaarden van RainViewer. */}
      <p style={{ textAlign: "center", fontSize: 10.5, color: C.muted, padding: "8px 20px 24px" }}>
        Weerdata door{" "}
        <a href="https://www.rainviewer.com" target="_blank" rel="noreferrer" style={{ color: C.accent }}>RainViewer</a>
        {" "}· kaart via OpenStreetMap
      </p>
    </div>
  );
}

// Horizontaal doorswipebare tijdlijn-strip — elk tikje is één radarframe
// (elke 10 minuten), met de tijd erbij. Scrollt automatisch mee zodat het
// geselecteerde frame (bv. tijdens het afspelen) altijd zichtbaar blijft.
function TijdlijnStrip({ alleFrames, frameIdx, aantalPastFrames, onKies, formatFrameTijd }) {
  const stripRef = useRef(null);
  const tikRefs = useRef({});

  useEffect(() => {
    const tik = tikRefs.current[frameIdx];
    const strip = stripRef.current;
    if (!tik || !strip) return;
    // Middenin beeld scrollen i.p.v. alleen "in zicht" — voorkomt dat het
    // huidige frame steeds tegen de rand aan blijft plakken tijdens afspelen.
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
          </button>
        );
      })}
    </div>
  );
}
