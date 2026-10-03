import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, X, Trash2, AlertTriangle } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// Abonnementen — overzicht van alle terugkerende kosten: hypotheek-looptijd,
// sport/hobby (volwassenen én kinderen), goede doelen, en alle overige
// abonnementen (ANWB e.d.). Geïnspireerd op het sterkste patroon uit
// vergelijkbare open-source trackers (met name Renewlet): niet alleen WANNEER
// iets verlengt, maar vooral WANNEER je uiterlijk moet opzeggen.
// ═══════════════════════════════════════════════════════════════════════════════

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const euro = n => `€ ${(n || 0).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const euroRond = n => `€ ${Math.round(n || 0).toLocaleString("nl-NL")}`;

const CATEGORIEEN = [
  { id: "hypotheek",     label: "Hypotheek",            icon: "🏠" },
  { id: "sport_hobby",   label: "Sport & hobby",        icon: "⚽" },
  { id: "entertainment", label: "Entertainment & media",icon: "🎬" },
  { id: "goed_doel",     label: "Goede doelen",         icon: "❤️" },
  { id: "overig",        label: "Overig",               icon: "📄" },
];
function categorieInfo(id) {
  return CATEGORIEEN.find(c => c.id === id) || CATEGORIEEN.find(c => c.id === "overig");
}

// Veelvoorkomende abonnementen per categorie — geïnspireerd op vergelijkbare
// open-source trackers die een lijst van bekende diensten aanbieden, zodat
// je met één tik toevoegt i.p.v. zelf alles te moeten bedenken en uittypen.
// Puur een hulpmiddel bij het invullen; verder gewoon vrije tekst.
// kanAltijdOpzeggen: true staat alleen bij diensten waarvan het STANDAARD
// abonnement in Nederland maandelijks opzegbaar is, zonder minimumtermijn —
// bewust NIET bij een krant/tijdschrift, sportschool, mobiel abonnement of
// internet, want die hebben in de praktijk vaak juist wél een vaste
// looptijd met opzegtermijn (en dat verschilt sterk per aanbieder/contract).
const VEELVOORKOMENDE_ABONNEMENTEN = {
  entertainment: [
    { naam: "Netflix", domein: "netflix.com", kanAltijdOpzeggen: true },
    { naam: "HBO Max", domein: "hbomax.com", kanAltijdOpzeggen: true },
    { naam: "Videoland", domein: "videoland.com", kanAltijdOpzeggen: true },
    { naam: "Disney+", domein: "disneyplus.com", kanAltijdOpzeggen: true },
    { naam: "Amazon Prime Video", domein: "primevideo.com", kanAltijdOpzeggen: true },
    { naam: "Spotify", domein: "spotify.com", kanAltijdOpzeggen: true },
    { naam: "Apple Music", domein: "music.apple.com", kanAltijdOpzeggen: true },
    { naam: "YouTube Premium", domein: "youtube.com", kanAltijdOpzeggen: true },
    { naam: "Dagblad/krant", domein: null },
    { naam: "Tijdschrift", domein: null },
  ],
  sport_hobby: [
    { naam: "Sportschool", domein: null },
    { naam: "Zwemles", domein: null },
    { naam: "Muziekles", domein: null },
    { naam: "Dansles", domein: null },
    { naam: "Voetbalclub", domein: null },
    { naam: "Hockeyclub", domein: null },
    { naam: "Scouting", domein: null },
  ],
  overig: [
    { naam: "ANWB", domein: "anwb.nl" },
    { naam: "Mobiel abonnement", domein: null },
    { naam: "Internet", domein: null },
    { naam: "Cloud-opslag (iCloud/Google One)", domein: "google.com", kanAltijdOpzeggen: true },
  ],
};

const FREQUENTIES = [
  { id: "maandelijks",   label: "Per maand" },
  { id: "per_kwartaal",  label: "Per kwartaal" },
  { id: "jaarlijks",     label: "Per jaar" },
  { id: "eenmalig",      label: "Eenmalig" },
];

// Vaste keuze i.p.v. vrije tekst — zo kun je "wie betaalt wat" (zie
// berekenTotalenPerPersoon) betrouwbaar optellen, zonder dat bv. "pepijn"
// en "Pepijn" als twee verschillende mensen worden geteld.
const BETAALD_DOOR_OPTIES = ["Pepijn", "Tessa", "Gezamenlijke rekening"];
function frequentieLabel(id) {
  return FREQUENTIES.find(f => f.id === id)?.label || id;
}

// ── Normaliseren naar maand-/jaarbedrag, ongeacht de betaalfrequentie ────
// Eenmalige kosten tellen bewust NIET mee in het structurele maandbedrag
// (ze zijn geen terugkerende last), maar wel in het totaal van dit jaar.
function berekenMaandbedrag(bedrag, frequentie) {
  const b = +bedrag || 0;
  switch (frequentie) {
    case "jaarlijks": return b / 12;
    case "per_kwartaal": return b / 3;
    case "eenmalig": return 0;
    case "maandelijks": default: return b;
  }
}
function berekenJaarbedrag(bedrag, frequentie) {
  const b = +bedrag || 0;
  switch (frequentie) {
    case "maandelijks": return b * 12;
    case "per_kwartaal": return b * 4;
    case "eenmalig": return b;
    case "jaarlijks": default: return b;
  }
}

// ── Opzegmoment — de daadwerkelijk relevante datum, niet de verlengdatum
//    zelf. Dit is het kernidee uit de onderzochte abonnementen-trackers:
//    een reminder op de verlengdatum zelf is al te laat als er een
//    opzegtermijn geldt. ───────────────────────────────────────────────
function berekenLaatsteOpzegmoment(volgendeVerlengdatum, opzegtermijnDagen) {
  if (!volgendeVerlengdatum || !opzegtermijnDagen) return null;
  const datum = new Date(volgendeVerlengdatum);
  datum.setDate(datum.getDate() - (+opzegtermijnDagen || 0));
  return datum;
}
function berekenDagenTot(datum, vandaag = new Date()) {
  if (!datum) return null;
  const diffMs = new Date(datum).setHours(0, 0, 0, 0) - new Date(vandaag).setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// ── Totalen ───────────────────────────────────────────────────────────────
function berekenTotalenPerPersoon(abonnementen) {
  const totalen = {};
  abonnementen.filter(a => a.actief !== false).forEach(a => {
    const naam = a.betaaldDoor || "Onbekend";
    totalen[naam] = (totalen[naam] || 0) + berekenMaandbedrag(a.bedrag, a.frequentie);
  });
  return totalen;
}
// Eén totaalbedrag kan overweldigend lijken zodra de hypotheek of
// verzekeringen op dezelfde hoop liggen als Netflix — dit splitst het per
// categorie uit, zodat "abonnementen in de dagelijkse zin" (entertainment,
// sport) apart zichtbaar blijven van grote vaste lasten (hypotheek).
function berekenTotalenPerCategorie(abonnementen) {
  const totalen = {};
  CATEGORIEEN.forEach(c => { totalen[c.id] = { maand: 0, jaar: 0 }; });
  abonnementen.filter(a => a.actief !== false).forEach(a => {
    if (!totalen[a.categorie]) totalen[a.categorie] = { maand: 0, jaar: 0 };
    totalen[a.categorie].maand += berekenMaandbedrag(a.bedrag, a.frequentie);
    totalen[a.categorie].jaar += berekenJaarbedrag(a.bedrag, a.frequentie);
  });
  return totalen;
}
function groepeerPerCategorie(abonnementen) {
  const groepen = {};
  CATEGORIEEN.forEach(c => { groepen[c.id] = []; });
  abonnementen.forEach(a => {
    if (!groepen[a.categorie]) groepen[a.categorie] = [];
    groepen[a.categorie].push(a);
  });
  return groepen;
}

const C = {
  bg: "#F7F4EC", surf: "#FFFFFF", card: "#F3EFE6", border: "#E4DCCB",
  accent: "#2D4A3E", accentLicht: "#4A7A6C", text: "#2D2A26", muted: "#8C8576",
  rood: "#C0392B", groen: "#3D7A5C", oranje: "#C97D0C",
};
const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "24px 20px 8px" },
  main: { padding: "4px 20px 80px" },
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 12 },
  inp: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, width: "100%", boxSizing: "border-box", color: C.text },
  label: { fontSize: 11.5, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 },
};

// Haalt het logo rechtstreeks op bij de eigen website van de dienst (via een
// publieke favicon-dienst) i.p.v. dat wij zelf merklogo's zouden opslaan —
// dat laatste zou een auteursrecht-/merkenrechtelijk probleem zijn. Valt
// terug op het categorie-icoon als er geen domein bekend is, of als het
// ophalen een keer mislukt.
//
// Gebruikt Google's favicon-dienst, niet Clearbit: Clearbit's logo-API is
// definitief gestopt per 8 december 2025 (na de overname door HubSpot) —
// exact de reden dat er tot nu toe alleen kale categorie-icoontjes
// verschenen. Google's dienst is gratis, vereist geen account/token (in
// tegenstelling tot Clearbit's aanbevolen opvolger logo.dev) en draait al
// jarenlang stabiel.
function AbonnementLogo({ domein, categorie, grootte = 32 }) {
  const [fout, setFout] = useState(false);
  if (!domein || fout) {
    return <span style={{ fontSize: grootte * 0.6, lineHeight: 1 }}>{categorieInfo(categorie).icon}</span>;
  }
  return (
    <img src={`https://www.google.com/s2/favicons?domain=${domein}&sz=${grootte * 2}`} alt="" width={grootte} height={grootte}
      style={{ borderRadius: grootte > 20 ? 8 : 5, objectFit: "contain", background: "#FFF", border: `1px solid ${C.border}`, flexShrink: 0 }}
      onError={() => setFout(true)} />
  );
}

function Veld({ label, value, onChange, type = "number", placeholder = "", suffix = "" }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={S.label}>{label}</label>
      <div style={{ position: "relative" }}>
        <input type={type} style={S.inp} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
        {suffix && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.muted }}>{suffix}</span>}
      </div>
    </div>
  );
}

export default function AbonnementenApp() {
  const [abonnementen, setAbonnementen] = useState([]);
  const [laden, setLaden] = useState(true);
  const [bewerkItem, setBewerkItem] = useState(null); // null = gesloten, {} = nieuw, {...} = bewerken
  const [saveFout, setSaveFout] = useState(false);
  const [meldingenStatus, setMeldingenStatus] = useState("onbekend"); // onbekend | niet-ondersteund | uit | aan | bezig | geweigerd
  const lastWriteRef = useRef(0);

  useEffect(() => {
    let actief = true;
    fetch("/api/abonnementen").then(r => r.json()).then(data => {
      if (actief) setAbonnementen(data.abonnementen || []);
    }).catch(() => {}).finally(() => { if (actief) setLaden(false); });
    return () => { actief = false; };
  }, []);

  // Checkt bij het openen van de pagina of meldingen al aanstaan op dít
  // toestel (een losse aan/uit-stand per toestel/browser, zoals gebruikelijk
  // bij pushmeldingen — niet iets wat je voor het hele huishouden in één
  // keer regelt).
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setMeldingenStatus("niet-ondersteund"); return; }
    if (Notification.permission === "denied") { setMeldingenStatus("geweigerd"); return; }
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
      setMeldingenStatus(sub ? "aan" : "uit");
    }).catch(() => setMeldingenStatus("uit"));
  }, []);

  function base64ToUint8Array(base64) {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const ruw = window.atob(b64);
    return Uint8Array.from([...ruw].map(c => c.charCodeAt(0)));
  }

  async function zetMeldingenAan() {
    setMeldingenStatus("bezig");
    try {
      const permissie = await Notification.requestPermission();
      if (permissie !== "granted") { setMeldingenStatus(permissie === "denied" ? "geweigerd" : "uit"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sleutel = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!sleutel) { window.alert("Pushmeldingen zijn nog niet geconfigureerd door de beheerder (VAPID-sleutel ontbreekt)."); setMeldingenStatus("uit"); return; }
      const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8Array(sleutel) });
      await fetch("/api/push-subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription }) });
      setMeldingenStatus("aan");
    } catch {
      setMeldingenStatus("uit");
      window.alert("Het aanzetten van meldingen is niet gelukt. Probeer het nog eens.");
    }
  }

  async function zetMeldingenUit() {
    setMeldingenStatus("bezig");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push-subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setMeldingenStatus("uit");
    } catch {
      setMeldingenStatus("aan");
    }
  }

  function persist(nieuweLijst) {
    lastWriteRef.current = Date.now();
    setAbonnementen(nieuweLijst);
    fetch("/api/abonnementen", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ abonnementen: nieuweLijst }),
    })
      .then(r => { if (!r.ok) throw new Error(); setSaveFout(false); })
      .catch(() => setSaveFout(true));
  }

  function opslaan(item) {
    if (item.id) {
      const bestaand = abonnementen.find(a => a.id === item.id);
      // Een gewijzigde verlengdatum betekent een nieuwe cyclus — eerdere
      // "al gemeld"-markeringen horen dan niet meer, anders zou dit
      // abonnement de vólgende keer stilzwijgend géén melding meer krijgen.
      const datumGewijzigd = bestaand && bestaand.volgendeVerlengdatum !== item.volgendeVerlengdatum;
      persist(abonnementen.map(a => a.id === item.id ? { ...item, gemeldeDagen: datumGewijzigd ? [] : (bestaand?.gemeldeDagen || []) } : a));
    } else {
      persist([...abonnementen, { ...item, id: uid(), gemeldeDagen: [] }]);
    }
    setBewerkItem(null);
  }
  function verwijder(id) {
    if (!window.confirm("Dit abonnement verwijderen?")) return;
    persist(abonnementen.filter(a => a.id !== id));
  }

  if (laden) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>Laden…</div>;

  const actieve = abonnementen.filter(a => a.actief !== false);
  const totaalPerMaand = actieve.reduce((s, a) => s + berekenMaandbedrag(a.bedrag, a.frequentie), 0);
  const totaalPerJaar = actieve.reduce((s, a) => s + berekenJaarbedrag(a.bedrag, a.frequentie), 0);
  const perPersoon = berekenTotalenPerPersoon(abonnementen);
  const perCategorie = berekenTotalenPerCategorie(abonnementen);
  const groepen = groepeerPerCategorie(abonnementen);

  // Aankomende opzeg-/verlengmomenten — gesorteerd op urgentie, alleen wat
  // binnen 90 dagen speelt (verder weg is nu nog niet actiegericht).
  const aankomend = actieve
    .map(a => ({ ...a, _opzegmoment: berekenLaatsteOpzegmoment(a.volgendeVerlengdatum, a.opzegtermijnDagen), _dagenTot: berekenDagenTot(berekenLaatsteOpzegmoment(a.volgendeVerlengdatum, a.opzegtermijnDagen)) }))
    .filter(a => a._opzegmoment && a._dagenTot <= 90)
    .sort((a, b) => a._dagenTot - b._dagenTot);

  return (
    <div style={S.appBg}>
      <header style={S.header}>
        <Link href="/" style={{ fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, textDecoration: "none" }}>
          <ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> Terug
        </Link>
        <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700, color: C.accent }}>📋 Abonnementen</h1>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: C.muted }}>Alle vaste lasten en opzegmomenten in één overzicht</p>
      </header>

      <main style={S.main}>
        {meldingenStatus === "uit" && (
          <div style={{ ...S.card, background: C.accent, color: "#FFF", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>🔔</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Zet meldingen aan</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.8)" }}>Krijg een melding op dit toestel 14 en 3 dagen vóór een opzegmoment</p>
            </div>
            <button onClick={zetMeldingenAan} style={{ background: "#FFF", color: C.accent, border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", flexShrink: 0 }}>Aanzetten</button>
          </div>
        )}
        {meldingenStatus === "aan" && (
          <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🔔</span>
            <p style={{ flex: 1, margin: 0, fontSize: 12, color: C.text }}>Meldingen staan aan op dit toestel</p>
            <button onClick={zetMeldingenUit} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 9, padding: "6px 12px", fontSize: 11.5, color: C.muted, cursor: "pointer" }}>Uitzetten</button>
          </div>
        )}
        {meldingenStatus === "geweigerd" && (
          <div style={{ ...S.card, background: "#FBF0E4", border: `1px solid ${C.oranje}33` }}>
            <p style={{ margin: 0, fontSize: 11.5, color: C.text }}>🔕 Meldingen zijn geblokkeerd voor deze app. Zet ze aan via de instellingen van je browser/toestel om opzeg-herinneringen te ontvangen.</p>
          </div>
        )}
        {meldingenStatus === "niet-ondersteund" && (
          <div style={{ ...S.card, background: "#FBF0E4", border: `1px solid ${C.oranje}33` }}>
            <p style={{ margin: 0, fontSize: 11.5, color: C.text }}>🔕 Dit toestel/browser ondersteunt geen pushmeldingen. Op iPhone: voeg de app eerst toe aan je beginscherm via "Zet op beginscherm", open 'm vandaaruit, en probeer het dan opnieuw.</p>
          </div>
        )}

        {saveFout && (
          <div style={{ ...S.card, background: "#FBEAEA", border: `1px solid ${C.rood}44`, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={14} color={C.rood} style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 11.5, color: C.text }}>Opslaan is niet gelukt — controleer je verbinding. Je laatste wijziging staat mogelijk nog niet vast.</p>
          </div>
        )}
        <div style={{ ...S.card, background: C.accent, color: "#FFF", display: "flex", justifyContent: "space-around", textAlign: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{euroRond(totaalPerMaand)}</p>
            <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "rgba(255,255,255,0.75)" }}>per maand</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{euroRond(totaalPerJaar)}</p>
            <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "rgba(255,255,255,0.75)" }}>per jaar</p>
          </div>
        </div>

        {Object.keys(perPersoon).length > 0 && (
          <div style={S.card}>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, fontWeight: 800, color: C.accent }}>Wie betaalt wat (per maand)</p>
            {Object.entries(perPersoon).sort((a, b) => b[1] - a[1]).map(([naam, bedrag]) => (
              <div key={naam} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                <span>{naam}</span>
                <span style={{ fontWeight: 700 }}>{euro(bedrag)}</span>
              </div>
            ))}
          </div>
        )}

        {CATEGORIEEN.some(c => perCategorie[c.id]?.maand > 0) && (
          <div style={S.card}>
            <p style={{ margin: "0 0 2px", fontSize: 12.5, fontWeight: 800, color: C.accent }}>Kosten per categorie</p>
            <p style={{ margin: "0 0 10px", fontSize: 10.5, color: C.muted }}>Zo blijft zichtbaar wat "losse abonnementen" kosten, los van grote vaste lasten zoals de hypotheek.</p>
            {CATEGORIEEN.filter(c => perCategorie[c.id]?.maand > 0).map(c => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderTop: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13 }}>{c.icon} {c.label}</span>
                <span style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{euro(perCategorie[c.id].maand)}</span>
                  <span style={{ fontSize: 10.5, color: C.muted }}> /mnd</span>
                  <span style={{ display: "block", fontSize: 10.5, color: C.accentLicht }}>{euroRond(perCategorie[c.id].jaar)} /jaar</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {aankomend.length > 0 && (
          <div style={{ ...S.card, background: "#FBF0E4", border: `1px solid ${C.oranje}33` }}>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, fontWeight: 800, color: C.text, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={14} color={C.oranje} /> Binnenkort opzeggen of verlengen
            </p>
            {aankomend.map(a => (
              <div key={a.id} onClick={() => setBewerkItem(a)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: `1px solid ${C.border}`, cursor: "pointer", gap: 10 }}>
                <AbonnementLogo domein={a.domein} categorie={a.categorie} grootte={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{a.naam}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: a._dagenTot < 0 ? C.rood : a._dagenTot <= 14 ? C.oranje : C.muted }}>
                    {a._dagenTot < 0 ? `Opzegmoment was ${Math.abs(a._dagenTot)} dagen geleden` : a._dagenTot === 0 ? "Vandaag uiterlijk opzeggen" : `Nog ${a._dagenTot} dagen om op te zeggen`}
                  </p>
                </div>
                <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>verlengt {new Date(a.volgendeVerlengdatum).toLocaleDateString("nl-NL")}</span>
              </div>
            ))}
          </div>
        )}

        {CATEGORIEEN.map(cat => (groepen[cat.id] || []).length > 0 && (
          <div key={cat.id} style={S.card}>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, fontWeight: 800, color: C.accent }}>{cat.icon} {cat.label}</p>
            {groepen[cat.id].map(a => (
              <div key={a.id} onClick={() => setBewerkItem(a)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: `1px solid ${C.border}`, cursor: "pointer", opacity: a.actief === false ? 0.45 : 1, gap: 10 }}>
                <AbonnementLogo domein={a.domein} categorie={a.categorie} grootte={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{a.naam}{a.actief === false ? " (inactief)" : ""}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>
                    {a.voorWie ? `${a.voorWie} · ` : ""}{a.betaaldDoor ? `betaald door ${a.betaaldDoor}` : ""}{a.kanAltijdOpzeggen ? " · vrij opzegbaar" : ""}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{euro(a.bedrag)}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 10.5, color: C.muted }}>{frequentieLabel(a.frequentie)}</p>
                  {a.frequentie !== "jaarlijks" && (
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: C.accentLicht }}>{euroRond(berekenJaarbedrag(a.bedrag, a.frequentie))} / jaar</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

        {abonnementen.length === 0 && (
          <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 30 }}>Nog niets toegevoegd — tik op de + om te beginnen.</p>
        )}
      </main>

      <button onClick={() => setBewerkItem({})}
        style={{ position: "fixed", bottom: 24, right: 20, width: 54, height: 54, borderRadius: "50%", background: C.accent, color: "#FFF", border: "none", boxShadow: "0 4px 14px rgba(0,0,0,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Plus size={24} />
      </button>

      {bewerkItem && (
        <AbonnementModal item={bewerkItem} onOpslaan={opslaan} onVerwijder={bewerkItem.id ? () => { verwijder(bewerkItem.id); setBewerkItem(null); } : null} onSluiten={() => setBewerkItem(null)} />
      )}
    </div>
  );
}

function AbonnementModal({ item, onOpslaan, onVerwijder, onSluiten }) {
  const [form, setForm] = useState({
    naam: item.naam || "", categorie: item.categorie || "overig", domein: item.domein || "",
    bedrag: item.bedrag ?? "", frequentie: item.frequentie || "maandelijks",
    voorWie: item.voorWie || "", betaaldDoor: item.betaaldDoor || "",
    kanAltijdOpzeggen: item.kanAltijdOpzeggen || false,
    volgendeVerlengdatum: item.volgendeVerlengdatum || "", opzegtermijnDagen: item.opzegtermijnDagen ?? "",
    notities: item.notities || "", actief: item.actief !== false,
    id: item.id || null,
  });
  function update(patch) { setForm(f => ({ ...f, ...patch })); }

  const opzegmoment = berekenLaatsteOpzegmoment(form.volgendeVerlengdatum, form.opzegtermijnDagen);

  function versturen() {
    if (!form.naam.trim() || !form.bedrag) { window.alert("Vul in elk geval een naam en een bedrag in."); return; }
    onOpslaan(form);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end" }} onClick={onSluiten}>
      <div style={{ background: C.bg, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 560, margin: "0 auto", maxHeight: "90vh", overflowY: "auto", padding: "20px 20px calc(20px + env(safe-area-inset-bottom))" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.accent }}>{form.id ? "Abonnement bewerken" : "Nieuw abonnement"}</h2>
          <button onClick={onSluiten} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.muted} /></button>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Veld label="Naam" type="text" value={form.naam} onChange={v => update({ naam: v })} placeholder="bv. ANWB, Voetbalclub, Netflix" />
          </div>
          {form.domein && (
            <div style={{ marginBottom: 10 }}><AbonnementLogo domein={form.domein} categorie={form.categorie} grootte={40} /></div>
          )}
        </div>
        <Veld label="Website (optioneel — voor een logo bij deze dienst)" type="text" value={form.domein} onChange={v => update({ domein: v })} placeholder="bv. netflix.com" />

        <label style={S.label}>Categorie</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {CATEGORIEEN.map(c => (
            <button key={c.id} onClick={() => update({ categorie: c.id })}
              style={{ padding: "8px 12px", borderRadius: 9, border: `1px solid ${C.border}`, background: form.categorie === c.id ? C.accent : C.card, color: form.categorie === c.id ? "#FFF" : C.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {!form.id && VEELVOORKOMENDE_ABONNEMENTEN[form.categorie] && (
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Veelvoorkomend in deze categorie — tik om de naam over te nemen</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {VEELVOORKOMENDE_ABONNEMENTEN[form.categorie].map(optie => (
                <button key={optie.naam} onClick={() => update({ naam: optie.naam, domein: optie.domein || "", kanAltijdOpzeggen: !!optie.kanAltijdOpzeggen, ...(optie.kanAltijdOpzeggen ? { volgendeVerlengdatum: "", opzegtermijnDagen: "" } : {}) })}
                  style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${C.border}`, background: form.naam === optie.naam ? C.accentLicht : C.surf, color: form.naam === optie.naam ? "#FFF" : C.text, fontSize: 11.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  {optie.domein && <AbonnementLogo domein={optie.domein} categorie={form.categorie} grootte={14} />}
                  {optie.naam}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Veld label="Bedrag" value={form.bedrag} onChange={v => update({ bedrag: v })} suffix="€" /></div>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Frequentie</label>
            <select style={{ ...S.inp, marginBottom: 10 }} value={form.frequentie} onChange={e => update({ frequentie: e.target.value })}>
              {FREQUENTIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
        </div>
        {+form.bedrag > 0 && form.frequentie !== "jaarlijks" && (
          <p style={{ margin: "-6px 0 12px", fontSize: 11.5, color: C.accentLicht }}>→ Dat is {euroRond(berekenJaarbedrag(form.bedrag, form.frequentie))} per jaar</p>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Veld label="Voor wie" type="text" value={form.voorWie} onChange={v => update({ voorWie: v })} placeholder="bv. Pepijn, kind, gezin" /></div>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Betaald door</label>
            <select style={{ ...S.inp, marginBottom: 10 }} value={form.betaaldDoor} onChange={e => update({ betaaldDoor: e.target.value })}>
              <option value="">Kies…</option>
              {BETAALD_DOOR_OPTIES.map(naam => <option key={naam} value={naam}>{naam}</option>)}
            </select>
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 12, background: C.card, borderRadius: 10, padding: "10px 12px" }}>
          <input type="checkbox" checked={form.kanAltijdOpzeggen} onChange={e => update({ kanAltijdOpzeggen: e.target.checked, volgendeVerlengdatum: e.target.checked ? "" : form.volgendeVerlengdatum, opzegtermijnDagen: e.target.checked ? "" : form.opzegtermijnDagen })} />
          Kan ten alle tijden worden opgezegd (geen vaste looptijd of opzegtermijn)
        </label>

        {!form.kanAltijdOpzeggen && (
          <>
            <label style={S.label}>Volgende verlengdatum (optioneel)</label>
            <input type="date" style={{ ...S.inp, marginBottom: 10 }} value={form.volgendeVerlengdatum} onChange={e => update({ volgendeVerlengdatum: e.target.value })} />
            <Veld label="Opzegtermijn (hoeveel dagen vóór de verlengdatum moet je opzeggen?)" value={form.opzegtermijnDagen} onChange={v => update({ opzegtermijnDagen: v })} suffix="dagen" />
            {opzegmoment && (
              <p style={{ margin: "-4px 0 10px", fontSize: 11.5, color: C.accentLicht }}>
                → Uiterlijk opzeggen vóór <strong>{opzegmoment.toLocaleDateString("nl-NL")}</strong>
              </p>
            )}
          </>
        )}
        {form.kanAltijdOpzeggen && (
          <p style={{ margin: "-4px 0 14px", fontSize: 11.5, color: C.groen }}>
            ✅ Dit abonnement verschijnt niet in "Binnenkort opzeggen" — je kunt het immers altijd stopzetten wanneer je wilt.
          </p>
        )}

        <label style={S.label}>Notities (optioneel)</label>
        <textarea style={{ ...S.inp, minHeight: 60, marginBottom: 12, fontFamily: "inherit" }} value={form.notities} onChange={e => update({ notities: e.target.value })} />

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 16 }}>
          <input type="checkbox" checked={form.actief} onChange={e => update({ actief: e.target.checked })} />
          Actief (telt mee in de totalen)
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          {onVerwijder && (
            <button onClick={onVerwijder} style={{ background: "none", border: `1px solid ${C.rood}55`, color: C.rood, borderRadius: 12, padding: "12px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Trash2 size={14} /> Verwijder
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onSluiten} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Annuleer</button>
          <button onClick={versturen} style={{ background: C.accent, color: "#FFF", border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Opslaan</button>
        </div>
      </div>
    </div>
  );
}
