import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, Camera as CameraIcon, Compass as CompassIcon } from "lucide-react";

// Zelfde, al geverifieerde zonpositie-berekening als in pages/weer.js.
function berekenZonPositie(lat, lon, datum = new Date()) {
  const rad = Math.PI / 180;
  const dagVanJaar = Math.floor((datum - new Date(datum.getFullYear(), 0, 0)) / 86400000);
  const uurUTC = datum.getUTCHours() + datum.getUTCMinutes() / 60 + datum.getUTCSeconds() / 3600;
  const gamma = (2 * Math.PI / 365) * (dagVanJaar - 1 + (uurUTC - 12) / 24);
  const eqTime = 229.18 * (0.000075 + 0.001868*Math.cos(gamma) - 0.032077*Math.sin(gamma)
    - 0.014615*Math.cos(2*gamma) - 0.040849*Math.sin(2*gamma));
  const decl = 0.006918 - 0.399912*Math.cos(gamma) + 0.070257*Math.sin(gamma)
    - 0.006758*Math.cos(2*gamma) + 0.000907*Math.sin(2*gamma)
    - 0.002697*Math.cos(3*gamma) + 0.00148*Math.sin(3*gamma);
  const tijdOffset = eqTime + 4 * lon;
  const ware_zonnetijd = (uurUTC * 60 + tijdOffset) % 1440;
  const uurhoek = (ware_zonnetijd / 4 - 180) * rad;
  const latRad = lat * rad;
  const zenithCos = Math.sin(latRad)*Math.sin(decl) + Math.cos(latRad)*Math.cos(decl)*Math.cos(uurhoek);
  const zenith = Math.acos(Math.max(-1, Math.min(1, zenithCos)));
  const elevatie = 90 - zenith / rad;
  let azimutCos = -(Math.sin(latRad)*Math.cos(zenith) - Math.sin(decl)) / (Math.cos(latRad)*Math.sin(zenith));
  azimutCos = Math.max(-1, Math.min(1, azimutCos));
  let azimut = Math.acos(azimutCos) / rad;
  if (uurhoek > 0) azimut = 360 - azimut;
  return { azimut, elevatie };
}

// Hoekverschil tussen twee kompasrichtingen, resultaat tussen -180 en 180.
function hoekVerschil(a, b) {
  let verschil = (a - b + 540) % 360 - 180;
  return verschil;
}

const C = { bg: "#0F1B2D", accent: "#5B9BD5", accentDark: "#F2A93B", text: "#F2F4F8", muted: "#8FA0BD" };

export default function WeerZonApp() {
  const [modus, setModus] = useState("kompas"); // "kompas" | "camera"
  const [positie, setPositie] = useState(null);
  const [nu, setNu] = useState(new Date());
  const [heading, setHeading] = useState(null);
  const [headingBeschikbaar, setHeadingBeschikbaar] = useState(null); // null=onbekend, true/false
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraFout, setCameraFout] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setPositie({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}
    );
  }, []);

  // Tijd elke seconde bijwerken zodat de zonpositie live meebeweegt.
  useEffect(() => {
    const interval = setInterval(() => setNu(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const zonPositie = positie ? berekenZonPositie(positie.lat, positie.lon, nu) : null;

  // ── Kompas-richting (device-oriëntatie) ────────────────────────────────
  const startKompas = useCallback(async () => {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      // iOS 13+ vereist expliciete toestemming, alleen aan te vragen vanuit
      // een directe gebruikersactie (tik op een knop) — vandaar deze functie.
      try {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== "granted") { setHeadingBeschikbaar(false); return; }
      } catch { setHeadingBeschikbaar(false); return; }
    }
    const handler = e => {
      // iOS geeft een kant-en-klare kompasrichting; andere browsers moeten
      // het (minder betrouwbaar) uit alpha afleiden.
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
    // Als er na 2 seconden nog geen enkele bruikbare uitlezing is geweest,
    // ondersteunt dit toestel/deze browser het kennelijk niet.
    setTimeout(() => setHeadingBeschikbaar(h => h === null ? false : h), 2000);
    return () => {
      window.removeEventListener("deviceorientationabsolute", handler);
      window.removeEventListener("deviceorientation", handler);
    };
  }, []);

  useEffect(() => { startKompas(); }, [startKompas]);

  async function startCamera() {
    setCameraFout(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setModus("camera");
    } catch {
      setCameraFout("Kon geen toegang krijgen tot de camera — check de locatietoestemmingen van de browser in je instellingen.");
    }
  }
  useEffect(() => {
    return () => { cameraStream?.getTracks().forEach(t => t.stop()); };
  }, [cameraStream]);

  // Hoek van de zon t.o.v. waar de telefoon nu naartoe wijst — negatief =
  // zon staat links, positief = rechts. Buiten beeld (>35°) tonen we alleen
  // een pijl die kant op i.p.v. te proberen 'm precies te positioneren.
  const relatieveHoek = zonPositie && heading != null ? hoekVerschil(zonPositie.azimut, heading) : null;
  const CAMERA_FOV = 34; // halve gezichtsveld-hoek in graden, ruwe aanname voor een telefooncamera
  const zonInBeeld = relatieveHoek != null && Math.abs(relatieveHoek) <= CAMERA_FOV;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
      <header style={{ padding: "28px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/weer" style={{ color: C.muted, fontSize: 12, textTransform: "uppercase", fontWeight: 600, textDecoration: "none" }}>
          <ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> Terug
        </Link>
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.06)", borderRadius: 11, padding: 3 }}>
          <button onClick={() => setModus("kompas")} style={{ border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", background: modus==="kompas"?C.accent:"transparent", color: modus==="kompas"?"#0F1B2D":C.muted }}>
            <CompassIcon size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />Kompas
          </button>
          <button onClick={() => cameraStream ? setModus("camera") : startCamera()} style={{ border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", background: modus==="camera"?C.accent:"transparent", color: modus==="camera"?"#0F1B2D":C.muted }}>
            <CameraIcon size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />Camera
          </button>
        </div>
      </header>

      {!positie && (
        <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 20 }}>Locatie wordt bepaald…</p>
      )}

      {headingBeschikbaar === false && (
        <div style={{ margin: "0 20px 16px", background: "rgba(224,104,79,0.15)", border: "1px solid rgba(224,104,79,0.4)", borderRadius: 12, padding: 14 }}>
          <p style={{ margin: 0, fontSize: 12.5 }}>
            ⚠️ Kon geen kompasrichting van je toestel krijgen (toestemming geweigerd, of niet ondersteund door deze browser). De kaart hieronder toont de zonpositie nog wel, maar zonder aan te geven waar je telefoon zelf naartoe wijst.
          </p>
        </div>
      )}

      {modus === "kompas" && positie && zonPositie && (
        <KompasWeergave zonPositie={zonPositie} heading={heading} positie={positie} nu={nu} />
      )}

      {modus === "camera" && (
        <CameraWeergave
          videoRef={videoRef} cameraStream={cameraStream} cameraFout={cameraFout}
          zonPositie={zonPositie} relatieveHoek={relatieveHoek} zonInBeeld={zonInBeeld}
          headingBeschikbaar={headingBeschikbaar} onOpnieuw={startCamera}
        />
      )}
    </div>
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

  // Zonpad van vandaag (elke 15 min, alleen boven de horizon) — geeft een
  // idee van de hele dag, niet alleen dit moment.
  const pad = [];
  for (let m = 0; m < 24*60; m += 15) {
    const t = new Date(nu); t.setHours(0, m, 0, 0);
    const p = berekenZonPositieVoorPad(positie.lat, positie.lon, t);
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

function berekenZonPositieVoorPad(lat, lon, datum) {
  return berekenZonPositie(lat, lon, datum);
}

function CameraWeergave({ videoRef, cameraStream, cameraFout, zonPositie, relatieveHoek, zonInBeeld, headingBeschikbaar, onOpnieuw }) {
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
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 90px)", overflow: "hidden", background: "#000" }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      {/* Middenlijn = waar de telefoon nu precies naartoe wijst */}
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
        <p style={{ display: "inline-block", margin: 0, background: "rgba(0,0,0,0.55)", color: "#FFF", padding: "8px 16px", borderRadius: 20, fontSize: 12.5 }}>
          {zonPositie && `☀️ Elevatie ${Math.round(zonPositie.elevatie)}°`}
          {headingBeschikbaar === false && " · geen kompas beschikbaar op dit toestel"}
        </p>
      </div>
    </div>
  );
}
