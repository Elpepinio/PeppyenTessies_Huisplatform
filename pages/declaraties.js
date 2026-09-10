import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, X, Car, ParkingSquare, Bus, Receipt, Trash2, Pencil, Check, Download, Calculator } from "lucide-react";

// ── Constanten ────────────────────────────────────────────
// Belastingdienst-vrijstelling voor zakelijke kilometers met eigen vervoer.
// Op elke registratie opgeslagen (niet steeds herberekend met "het huidige
// tarief"), zodat oudere declaraties correct blijven als dit bedrag in de
// toekomst verandert.
const KM_TARIEF = 0.23;

const DECLARATIE_TYPES = [
  { id: "kilometer", label: "Kilometervergoeding", icon: "🚗", kleur: "#3D7A5C" },
  { id: "parkeren",  label: "Parkeerkosten",        icon: "🅿️", kleur: "#5B9BD5" },
  { id: "ov",        label: "OV-kosten",             icon: "🚆", kleur: "#C97D0C" },
  { id: "overig",    label: "Overige kosten",        icon: "🧾", kleur: "#8A6FB0" },
];
function typeInfo(id) {
  return DECLARATIE_TYPES.find(t => t.id === id) || DECLARATIE_TYPES[3];
}

const PERSONEN = [
  { id: "Pepijn", kleur: "#2D4A3E" },
  { id: "Tessa",  kleur: "#C86E4A" },
];
function persoonKleur(naam) {
  return PERSONEN.find(p => p.id === naam)?.kleur || "#8C8576";
}

// Eén OV-declaratie bestaat vaak uit meerdere trajectdelen op één dag (trein
// heen, OV-fiets/bus heen, trein terug, bus/OV-fiets terug) — elk met een
// eigen vervoermiddel en bedrag, want prijzen per rit lopen uiteen (bv.
// spits-/daltarief), dus simpelweg verdubbelen zoals bij kilometers zou hier
// niet kloppen.
const VERVOERMIDDELEN = [
  { id: "trein",   label: "Trein",    icon: "🚆" },
  { id: "bus",     label: "Bus",      icon: "🚌" },
  { id: "tram",    label: "Tram",     icon: "🚋" },
  { id: "metro",   label: "Metro",    icon: "🚇" },
  { id: "ovfiets", label: "OV-fiets", icon: "🚲" },
  { id: "overig",  label: "Overig",   icon: "🎫" },
];
function vervoermiddelInfo(id) {
  return VERVOERMIDDELEN.find(v => v.id === id) || VERVOERMIDDELEN[5];
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ── Datum-/geldhelpers — nooit toISOString(), die schuift rond middernacht ──
function vandaagStr() {
  const nu = new Date();
  return `${nu.getFullYear()}-${String(nu.getMonth()+1).padStart(2,"0")}-${String(nu.getDate()).padStart(2,"0")}`;
}
function formatBedrag(n) {
  return `€ ${(n||0).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDatumKort(datumStr) {
  if (!datumStr) return "";
  const [j,m,d] = datumStr.split("-").map(Number);
  return new Date(j,m-1,d).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
function kwartaalVan(datumStr) {
  const maand = Number(datumStr.split("-")[1]);
  return Math.ceil(maand / 3);
}
function bedragVoorItem(item) {
  if (item.type === "kilometer") {
    const afstandsfactor = item.retour ? 2 : 1;
    return Math.round((item.km || 0) * afstandsfactor * (item.tarief ?? KM_TARIEF) * 100) / 100;
  }
  if (item.type === "ov" && item.ritten) {
    return Math.round(item.ritten.reduce((s, r) => s + (r.bedrag || 0), 0) * 100) / 100;
  }
  return item.bedrag || 0;
}

// Totale, daadwerkelijk gedeclareerde kilometers voor een item — dus de
// enkele-reis-afstand verdubbeld bij een retourtje. Los van bedragVoorItem
// omdat de kilometerlijst-weergave dit los van het bedrag wil tonen.
function kmVoorItem(item) {
  return (item.km || 0) * (item.retour ? 2 : 1);
}

// ── Periode-filter — ondersteunt de vaste presets (deze/vorige maand,
//    dit/vorig kwartaal) en een vrij te kiezen datumbereik. ──────────────
function berekenPeriodeBereik(preset, jaar) {
  const nu = new Date();
  if (preset === "deze-maand") {
    const m = nu.getMonth();
    return { van: `${jaar}-${String(m+1).padStart(2,"0")}-01`, tot: vandaagStr() };
  }
  if (preset === "vorige-maand") {
    const vorigeMaandDatum = new Date(nu.getFullYear(), nu.getMonth() - 1, 1);
    const laatsteDag = new Date(vorigeMaandDatum.getFullYear(), vorigeMaandDatum.getMonth() + 1, 0).getDate();
    const jm = `${vorigeMaandDatum.getFullYear()}-${String(vorigeMaandDatum.getMonth()+1).padStart(2,"0")}`;
    return { van: `${jm}-01`, tot: `${jm}-${String(laatsteDag).padStart(2,"0")}` };
  }
  if (preset === "dit-kwartaal") {
    const kw = Math.ceil((nu.getMonth()+1) / 3);
    const startMaand = (kw-1)*3 + 1;
    return { van: `${jaar}-${String(startMaand).padStart(2,"0")}-01`, tot: vandaagStr() };
  }
  if (preset === "vorig-kwartaal") {
    const huidigKw = Math.ceil((nu.getMonth()+1) / 3);
    let vorigKw = huidigKw - 1, kwJaar = jaar;
    if (vorigKw === 0) { vorigKw = 4; kwJaar = jaar - 1; }
    const startMaand = (vorigKw-1)*3 + 1;
    const eindMaand = startMaand + 2;
    const laatsteDag = new Date(kwJaar, eindMaand, 0).getDate();
    return { van: `${kwJaar}-${String(startMaand).padStart(2,"0")}-01`, tot: `${kwJaar}-${String(eindMaand).padStart(2,"0")}-${String(laatsteDag).padStart(2,"0")}` };
  }
  return null; // "aangepast" — van/tot worden los ingevuld
}

// ── Kilometerafstand automatisch berekenen — geocoding (Nominatim/
//    OpenStreetMap, al elders in de app gebruikt) + routing (OSRM's gratis
//    demo-server) i.p.v. de gebruiker de afstand zelf te laten opzoeken.
//    Handmatige invoer blijft altijd mogelijk als terugval — de demo-server
//    geeft geen enkele uptime-garantie. ─────────────────────────────────
// Meest gebruikte locaties/adressen voor een bepaald veld (van/naar/locatie)
// binnen een bepaald declaratietype — zodat veelgebruikte trajecten als
// snelkeuze aangeboden kunnen worden i.p.v. steeds het volledige adres
// opnieuw te moeten intypen. Gesorteerd op frequentie, dan op meest recent.
function berekenLocatieFavorieten(items, type, veld, max = 6) {
  const telling = {};
  items.forEach(i => {
    if (i.type !== type) return;
    const waarde = i[veld];
    if (!waarde) return;
    if (!telling[waarde]) telling[waarde] = { aantal: 0, laatst: 0 };
    telling[waarde].aantal++;
    telling[waarde].laatst = Math.max(telling[waarde].laatst, i.toegevoegdOp || 0);
  });
  return Object.entries(telling)
    .sort((a, b) => b[1].aantal - a[1].aantal || b[1].laatst - a[1].laatst)
    .slice(0, max)
    .map(([naam]) => naam);
}

// Zelfde idee, maar dan voor OV-trajectdelen — die zitten genest in
// item.ritten[], niet als los veld op het item zelf.
function berekenOvOmschrijvingFavorieten(items, max = 6) {
  const telling = {};
  items.forEach(i => {
    if (i.type !== "ov" || !i.ritten) return;
    i.ritten.forEach(r => {
      if (!r.omschrijving) return;
      if (!telling[r.omschrijving]) telling[r.omschrijving] = { aantal: 0, laatst: 0 };
      telling[r.omschrijving].aantal++;
      telling[r.omschrijving].laatst = Math.max(telling[r.omschrijving].laatst, i.toegevoegdOp || 0);
    });
  });
  return Object.entries(telling)
    .sort((a, b) => b[1].aantal - a[1].aantal || b[1].laatst - a[1].laatst)
    .slice(0, max)
    .map(([naam]) => naam);
}

async function berekenAfstandKm(vanAdres, naarAdres, vanCoords = null, naarCoords = null) {
  const geocode = async (adres) => {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(adres)}`);
    const data = await res.json();
    if (!data[0]) throw new Error(`Kon "${adres}" niet vinden`);
    return { lat: +data[0].lat, lon: +data[0].lon };
  };
  // Als de gebruiker het adres via een autocomplete-suggestie heeft gekozen,
  // zijn de coördinaten al bekend — dan hoeft er niet opnieuw geocodeerd te
  // worden (sneller, en scheelt een aanvraag bij Nominatim).
  const [van, naar] = await Promise.all([
    vanCoords || geocode(vanAdres),
    naarCoords || geocode(naarAdres),
  ]);
  const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${van.lon},${van.lat};${naar.lon},${naar.lat}?overview=false`);
  const routeData = await routeRes.json();
  if (!routeData.routes?.[0]) throw new Error("Kon geen route vinden tussen deze adressen");
  return Math.round(routeData.routes[0].distance / 100) / 10; // meters -> km, 1 decimaal
}

// ── Stijlen ───────────────────────────────────────────────
const C = {
  bg: "#FAF6F0", surf: "#FFFFFF", card: "#F3EFE6",
  border: "#E4DCCB", accent: "#2D4A3E", accentDark: "#1F352C",
  text: "#2D2A26", muted: "#8C8576", red: "#C0392B", green: "#3D7A5C",
};
const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { margin: "4px 0 0", fontSize: 24, fontWeight: 700, color: C.accentDark },
  main: { padding: "4px 20px 90px" },
  inp: { background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 15, width: "100%", boxSizing: "border-box", color: C.text },
  btn: (bg=C.accent, col="#FFFFFF") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  chip: (active, kleur=C.accent) => ({ border: `1px solid ${active ? kleur : C.border}`, background: active ? kleur : "#FFFFFF", color: active ? "#FFF" : C.text, borderRadius: 20, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }),
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 10 },
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  fab: { position: "fixed", bottom: 24, left: 20, background: C.accent, color: "#FFF", border: "none", borderRadius: 16, width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(45,74,62,0.35)", cursor: "pointer" },
};

function LEEG_FORM(type, persoon = "Pepijn") {
  return {
    type, persoon, datum: vandaagStr(), project: "",
    van: "", naar: "", vanCoords: null, naarCoords: null, km: "", tarief: KM_TARIEF, retour: false,
    locatie: "", omschrijving: "", bedrag: "", ritten: [],
  };
}

// Adresveld met live-autocomplete (zoals Google Maps — suggesties al terwijl
// je typt, niet pas na het volledige adres) plus favorieten-snelkeuze op
// basis van eerder gebruikte locaties. Bewaart bij een gekozen suggestie
// meteen ook de coördinaten, zodat een latere afstandsberekening die niet
// opnieuw hoeft op te zoeken.
function AdresInvoer({ waarde, onWijzig, placeholder, favorieten }) {
  const [suggesties, setSuggesties] = useState([]);
  const [toonSuggesties, setToonSuggesties] = useState(false);
  const [zoekBezig, setZoekBezig] = useState(false);
  const debounceRef = useRef(null);
  const blurTimeoutRef = useRef(null);

  function handleInput(tekst) {
    onWijzig(tekst, null);
    clearTimeout(debounceRef.current);
    if (tekst.trim().length < 3) { setSuggesties([]); return; }
    setZoekBezig(true);
    // Debounce: pas na 400ms rust een aanvraag doen, anders vuurt Nominatim
    // (gratis, geen sleutel) op elke toetsaanslag — en die vraagt om
    // redelijk gebruik.
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(tekst)}`);
        const data = await res.json();
        setSuggesties(data);
      } catch { setSuggesties([]); }
      setZoekBezig(false);
    }, 400);
  }

  function kiesSuggestie(s) {
    onWijzig(s.display_name.split(",").slice(0, 3).join(",").trim(), { lat: +s.lat, lon: +s.lon });
    setSuggesties([]);
    setToonSuggesties(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        style={S.inp} placeholder={placeholder} value={waarde}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => setToonSuggesties(true)}
        onBlur={() => { blurTimeoutRef.current = setTimeout(() => setToonSuggesties(false), 150); }}
      />
      {toonSuggesties && favorieten.length > 0 && suggesties.length === 0 && !waarde && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {favorieten.map(f => (
            <button key={f} type="button" onMouseDown={() => { onWijzig(f, null); setToonSuggesties(false); }}
              style={{ ...S.chip(false), fontSize: 12, padding: "5px 10px" }}>
              ⭐ {f}
            </button>
          ))}
        </div>
      )}
      {toonSuggesties && suggesties.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, marginTop: 4, zIndex: 20, boxShadow: "0 6px 16px rgba(0,0,0,0.12)", overflow: "hidden" }}>
          {suggesties.map((s, idx) => (
            <button key={idx} type="button" onMouseDown={() => kiesSuggestie(s)}
              style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: idx < suggesties.length-1 ? `1px solid ${C.border}` : "none", padding: "10px 12px", fontSize: 13, cursor: "pointer", color: C.text }}>
              📍 {s.display_name}
            </button>
          ))}
        </div>
      )}
      {zoekBezig && <p style={{ fontSize: 10.5, color: C.muted, margin: "4px 0 0" }}>Zoeken…</p>}
    </div>
  );
}

// OV-declaratie als optelsom van losse trajectdelen (bv. trein heen,
// OV-fiets heen, trein terug, bus terug) — elk met een eigen vervoermiddel
// en bedrag, want de kosten per rit lopen uiteen.
function OvTrajectInvoer({ form, setForm, favorieten }) {
  const [nieuwVervoermiddel, setNieuwVervoermiddel] = useState("trein");
  const [nieuwOmschrijving, setNieuwOmschrijving] = useState("");
  const [nieuwBedrag, setNieuwBedrag] = useState("");

  function voegTrajectdeelToe() {
    if (!nieuwBedrag || +nieuwBedrag <= 0) return;
    setForm(f => ({
      ...f,
      ritten: [...(f.ritten||[]), { id: uid(), vervoermiddel: nieuwVervoermiddel, omschrijving: nieuwOmschrijving.trim(), bedrag: +nieuwBedrag }],
    }));
    setNieuwOmschrijving("");
    setNieuwBedrag("");
  }
  function verwijderTrajectdeel(id) {
    setForm(f => ({ ...f, ritten: (f.ritten||[]).filter(r => r.id !== id) }));
  }

  const totaal = (form.ritten||[]).reduce((s,r) => s + (r.bedrag||0), 0);

  return (
    <div>
      <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Trajectdelen</label>
      <p style={{ fontSize: 11, color: C.muted, margin: "0 0 10px" }}>
        Eén dag kan uit meerdere ritten bestaan — voeg elke rit apart toe (bv. trein heen, OV-fiets heen, trein terug, bus terug).
      </p>

      {(form.ritten||[]).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {form.ritten.map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: C.card, borderRadius: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>{vervoermiddelInfo(r.vervoermiddel).icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>{vervoermiddelInfo(r.vervoermiddel).label}{r.omschrijving ? ` · ${r.omschrijving}` : ""}</p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{formatBedrag(r.bedrag)}</span>
              <button type="button" onClick={() => verwijderTrajectdeel(r.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                <X size={13} color={C.muted} />
              </button>
            </div>
          ))}
          <p style={{ textAlign: "right", fontSize: 13, fontWeight: 700, margin: "6px 4px 0" }}>Totaal: {formatBedrag(totaal)}</p>
        </div>
      )}

      <div style={{ background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {VERVOERMIDDELEN.map(v => (
            <button key={v.id} type="button" onClick={() => setNieuwVervoermiddel(v.id)}
              style={{ ...S.chip(nieuwVervoermiddel === v.id), fontSize: 12, padding: "5px 10px" }}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
        <input style={{ ...S.inp, marginBottom: 8, fontSize: 13 }} placeholder="Omschrijving (optioneel, bv. Tilburg → Utrecht)" value={nieuwOmschrijving}
          onChange={e => setNieuwOmschrijving(e.target.value)} />
        {favorieten.length > 0 && !nieuwOmschrijving && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {favorieten.map(f => (
              <button key={f} type="button" onClick={() => setNieuwOmschrijving(f)} style={{ ...S.chip(false), fontSize: 11, padding: "4px 9px" }}>
                ⭐ {f}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" step="0.01" style={{ ...S.inp, fontSize: 13 }} placeholder="€ 0,00" value={nieuwBedrag}
            onChange={e => setNieuwBedrag(e.target.value)} />
          <button type="button" onClick={voegTrajectdeelToe}
            style={{ ...S.btn(C.accent, "#FFF"), whiteSpace: "nowrap", fontSize: 12, padding: "10px 16px" }}>
            + Toevoegen
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DeclaratiesApp() {
  const [items, setItems] = useState([]);
  const [laden, setLaden] = useState(true);
  const [jaar, setJaar] = useState(new Date().getFullYear());
  const [persoonFilter, setPersoonFilter] = useState(null); // null = iedereen
  const [laatstGebruiktePersoon, setLaatstGebruiktePersoon] = useState("Pepijn");
  const [showTypeKiezer, setShowTypeKiezer] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [afstandLaden, setAfstandLaden] = useState(false);
  const [afstandFout, setAfstandFout] = useState(null);
  const [selectieModus, setSelectieModus] = useState(false);
  const [selectiePreset, setSelectiePreset] = useState("dit-kwartaal");
  const [aangepastVan, setAangepastVan] = useState("");
  const [aangepastTot, setAangepastTot] = useState("");
  const [uitgeslotenIds, setUitgeslotenIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const lastWriteRef = useRef(0);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2600); }

  useEffect(() => {
    let actief = true;
    fetch("/api/declaraties").then(r => r.json()).then(data => {
      if (!actief) return;
      setItems(data.items || []);
      setLaden(false);
    }).catch(() => setLaden(false));

    const interval = setInterval(async () => {
      if (Date.now() - lastWriteRef.current < 5000) return;
      const aanvraagGestart = Date.now();
      try {
        const res = await fetch("/api/declaraties");
        const data = await res.json();
        if (lastWriteRef.current > aanvraagGestart) return;
        if (actief) setItems(data.items || []);
      } catch {}
    }, 8000);
    return () => { actief = false; clearInterval(interval); };
  }, []);

  function persist(nextItems) {
    lastWriteRef.current = Date.now();
    setItems(nextItems);
    fetch("/api/declaraties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: nextItems }),
    }).catch(() => {});
  }

  function kiesType(type) {
    setForm(LEEG_FORM(type, laatstGebruiktePersoon));
    setEditId(null);
    setAfstandFout(null);
    setShowTypeKiezer(false);
    setShowForm(true);
  }

  function bewerkItem(item) {
    setForm({ ...LEEG_FORM(item.type), ...item, km: item.km ? String(item.km) : "", bedrag: item.bedrag != null ? String(item.bedrag) : "" });
    setEditId(item.id);
    setAfstandFout(null);
    setShowForm(true);
  }

  function verwijderItem(id) {
    if (!window.confirm("Deze declaratie verwijderen?")) return;
    persist(items.filter(i => i.id !== id));
    showToast("🗑 Verwijderd");
  }

  function slaOp() {
    if (!form.datum || !form.project.trim()) { showToast("⚠️ Vul minimaal de datum en het project in"); return; }
    if (form.type === "kilometer" && (!form.van.trim() || !form.naar.trim() || !form.km)) {
      showToast("⚠️ Vul van, naar en het aantal kilometers in"); return;
    }
    if (form.type === "parkeren" && !form.bedrag) {
      showToast("⚠️ Vul het bedrag in"); return;
    }
    if (form.type === "ov" && (!form.ritten || form.ritten.length === 0)) {
      showToast("⚠️ Voeg minimaal één trajectdeel toe"); return;
    }
    if (form.type === "overig" && (!form.omschrijving.trim() || !form.bedrag)) {
      showToast("⚠️ Vul een omschrijving en bedrag in"); return;
    }

    const basis = {
      type: form.type, persoon: form.persoon, datum: form.datum, project: form.project.trim(),
      ingediend: false, ingediendOp: null,
    };
    let item;
    if (form.type === "kilometer") {
      item = { ...basis, van: form.van.trim(), naar: form.naar.trim(), km: +form.km, tarief: KM_TARIEF, retour: !!form.retour };
    } else if (form.type === "overig") {
      item = { ...basis, omschrijving: form.omschrijving.trim(), bedrag: +form.bedrag };
    } else if (form.type === "ov") {
      item = { ...basis, ritten: form.ritten };
    } else {
      item = { ...basis, locatie: form.locatie.trim(), bedrag: +form.bedrag };
    }

    setLaatstGebruiktePersoon(form.persoon);
    if (editId) {
      const bestaand = items.find(i => i.id === editId);
      persist(items.map(i => i.id === editId ? { ...bestaand, ...item } : i));
      showToast("✅ Bijgewerkt");
    } else {
      persist([...items, { ...item, id: uid(), toegevoegdOp: Date.now() }]);
      showToast("✅ Toegevoegd");
    }
    setShowForm(false);
    setForm(null);
    setEditId(null);
  }

  async function berekenAfstandVoorForm() {
    if (!form.van.trim() || !form.naar.trim()) { showToast("⚠️ Vul eerst van en naar in"); return; }
    setAfstandLaden(true);
    setAfstandFout(null);
    try {
      const km = await berekenAfstandKm(form.van, form.naar, form.vanCoords, form.naarCoords);
      setForm(f => ({ ...f, km: String(km) }));
    } catch (e) {
      setAfstandFout(e.message || "Kon de afstand niet berekenen — vul 'm handmatig in.");
    }
    setAfstandLaden(false);
  }

  // ── Selectie-voor-indienen ───────────────────────────────
  const periodeBereik = selectiePreset === "aangepast"
    ? (aangepastVan && aangepastTot ? { van: aangepastVan, tot: aangepastTot } : null)
    : berekenPeriodeBereik(selectiePreset, jaar);

  const nogNietIngediendDitJaar = items.filter(i => !i.ingediend && i.datum?.startsWith(String(jaar)) && (!persoonFilter || i.persoon === persoonFilter));
  const selectieItems = periodeBereik
    ? nogNietIngediendDitJaar.filter(i => i.datum >= periodeBereik.van && i.datum <= periodeBereik.tot && !uitgeslotenIds.has(i.id))
    : [];
  const selectieTotaal = selectieItems.reduce((s,i) => s + bedragVoorItem(i), 0);

  function markeerAlsIngediend() {
    if (selectieItems.length === 0) return;
    const nu = Date.now();
    const idsInSelectie = new Set(selectieItems.map(i => i.id));
    persist(items.map(i => idsInSelectie.has(i.id) ? { ...i, ingediend: true, ingediendOp: nu } : i));
    setUitgeslotenIds(new Set());
    showToast(`✅ ${selectieItems.length} declaratie${selectieItems.length===1?"":"s"} gemarkeerd als ingediend`);
  }

  function exporteerSelectieCsv() {
    const bron = selectieModus ? selectieItems : items.filter(i => i.datum?.startsWith(String(jaar)));
    const kolommen = ["Datum","Type","Project","Van","Naar","Km","Locatie/Omschrijving","Bedrag","Ingediend"];
    const veld = v => `"${String(v??"").replace(/"/g,'""')}"`;
    const regels = [kolommen.join(";")];
    bron.slice().sort((a,b)=>(a.datum||"").localeCompare(b.datum||"")).forEach(i => {
      regels.push([
        veld(i.datum), veld(typeInfo(i.type).label), veld(i.project),
        veld(i.van||""), veld(i.naar||""), veld(i.type==="kilometer"?`${kmVoorItem(i)}${i.retour?" (retour)":""}`:""),
        veld(i.type === "ov" && i.ritten ? i.ritten.map(r => `${vervoermiddelInfo(r.vervoermiddel).label}${r.omschrijving?` (${r.omschrijving})`:""}: €${r.bedrag.toFixed(2)}`).join(" + ") : (i.locatie || i.omschrijving || "")),
        veld(bedragVoorItem(i).toFixed(2)), veld(i.ingediend ? "Ja" : "Nee"),
      ].join(";"));
    });
    const blob = new Blob(["\uFEFF" + regels.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `declaraties-${selectieModus ? selectiePreset : jaar}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }



  const beschikbareJaren = [...new Set(items.map(i => Number(i.datum?.split("-")[0])).filter(Boolean))];
  if (!beschikbareJaren.includes(new Date().getFullYear())) beschikbareJaren.push(new Date().getFullYear());
  beschikbareJaren.sort((a,b) => b-a);

  const itemsDitJaar = items.filter(i => i.datum?.startsWith(String(jaar)) && (!persoonFilter || i.persoon === persoonFilter)).sort((a,b) => (b.datum||"").localeCompare(a.datum||""));
  const totaalDitJaar = itemsDitJaar.reduce((s,i) => s + bedragVoorItem(i), 0);
  const nogNietIngediendTotaal = nogNietIngediendDitJaar.reduce((s,i) => s + bedragVoorItem(i), 0);

  if (laden) return (
    <div style={S.appBg}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 12 }}>
        <div style={{ fontSize: 36 }}>🧾</div>
        <p style={{ color: C.muted, fontSize: 14 }}>Declaraties laden…</p>
      </div>
    </div>
  );

  return (
    <div style={S.appBg}>
      <header style={S.header}>
        <div>
          <Link href="/" style={S.switchBtn}><ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> Terug</Link>
          <h1 style={S.title}>🧾 Declaraties</h1>
        </div>
      </header>

      <main style={S.main}>
        {/* Jaar-kiezer */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 10 }}>
          {beschikbareJaren.map(j => (
            <button key={j} style={S.chip(jaar === j)} onClick={() => setJaar(j)}>{j}</button>
          ))}
        </div>

        {/* Persoon-filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <button style={S.chip(!persoonFilter)} onClick={() => setPersoonFilter(null)}>Beide</button>
          {PERSONEN.map(p => (
            <button key={p.id} style={S.chip(persoonFilter === p.id, p.kleur)} onClick={() => setPersoonFilter(persoonFilter === p.id ? null : p.id)}>
              {p.id}
            </button>
          ))}
        </div>

        {/* Jaaroverzicht */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div style={{ ...S.card, textAlign: "center", marginBottom: 0 }}>
            <p style={{ margin: "0 0 4px", fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Totaal {jaar}</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{formatBedrag(totaalDitJaar)}</p>
          </div>
          <div style={{ ...S.card, textAlign: "center", marginBottom: 0, background: nogNietIngediendTotaal > 0 ? "#C97D0C12" : C.surf, border: nogNietIngediendTotaal > 0 ? "1px solid #C97D0C44" : `1px solid ${C.border}` }}>
            <p style={{ margin: "0 0 4px", fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Nog niet ingediend</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: nogNietIngediendTotaal > 0 ? "#C97D0C" : C.text }}>{formatBedrag(nogNietIngediendTotaal)}</p>
          </div>
        </div>

        {/* Per-persoon-uitsplitsing — alleen relevant als je niet al op één
            persoon hebt gefilterd, anders is het overbodig dubbelop. */}
        {!persoonFilter && (
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {PERSONEN.map(p => {
              const totaal = items.filter(i => i.datum?.startsWith(String(jaar)) && i.persoon === p.id).reduce((s,i) => s + bedragVoorItem(i), 0);
              return (
                <button key={p.id} onClick={() => setPersoonFilter(p.id)}
                  style={{ flex: 1, background: C.surf, border: `1px solid ${C.border}`, borderLeft: `3px solid ${p.kleur}`, borderRadius: 12, padding: "8px 12px", textAlign: "left", cursor: "pointer" }}>
                  <p style={{ margin: 0, fontSize: 11, color: C.muted }}>{p.id}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700 }}>{formatBedrag(totaal)}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Type-samenvatting */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 14 }}>
          {DECLARATIE_TYPES.map(t => {
            const totaal = itemsDitJaar.filter(i => i.type === t.id).reduce((s,i) => s + bedragVoorItem(i), 0);
            if (totaal === 0) return null;
            return (
              <div key={t.id} style={{ flexShrink: 0, background: C.surf, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 12px" }}>
                <p style={{ margin: 0, fontSize: 11, color: C.muted }}>{t.icon} {t.label}</p>
                <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700 }}>{formatBedrag(totaal)}</p>
              </div>
            );
          })}
        </div>

        {/* Selectie-voor-indienen knop */}
        <button style={{ ...S.btn(selectieModus ? C.card : C.accent, selectieModus ? C.text : "#FFF"), width: "100%", marginBottom: 14, border: selectieModus ? `1px solid ${C.border}` : "none" }}
          onClick={() => { setSelectieModus(v => !v); setUitgeslotenIds(new Set()); }}>
          {selectieModus ? "✕ Selectie sluiten" : "📋 Selectie maken voor indienen"}
        </button>

        {selectieModus && (
          <div style={{ ...S.card, background: "#2D4A3E08" }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: C.accentDark }}>Periode</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {[["deze-maand","Deze maand"],["vorige-maand","Vorige maand"],["dit-kwartaal","Dit kwartaal"],["vorig-kwartaal","Vorig kwartaal"],["aangepast","Aangepast"]].map(([id,label]) => (
                <button key={id} style={S.chip(selectiePreset === id)} onClick={() => setSelectiePreset(id)}>{label}</button>
              ))}
            </div>
            {selectiePreset === "aangepast" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input type="date" style={S.inp} value={aangepastVan} onChange={e => setAangepastVan(e.target.value)} />
                <input type="date" style={S.inp} value={aangepastTot} onChange={e => setAangepastTot(e.target.value)} />
              </div>
            )}

            {selectieItems.length === 0 ? (
              <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Geen openstaande declaraties in deze periode.</p>
            ) : (
              <>
                {selectieItems.map(item => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 16 }}>{typeInfo(item.type).icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                        <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: persoonKleur(item.persoon), marginRight: 6 }} />
                        {item.project}
                      </p>
                      <p style={{ margin: "1px 0 0", fontSize: 11, color: C.muted }}>
                        {item.persoon} · {formatDatumKort(item.datum)}
                        {item.type==="kilometer" ? ` · ${item.van} → ${item.naar}${item.retour ? " (retour)" : ""}` : ""}
                        {item.type==="ov" && item.ritten ? ` · ${item.ritten.map(r => vervoermiddelInfo(r.vervoermiddel).icon).join("")}` : ""}
                      </p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{formatBedrag(bedragVoorItem(item))}</span>
                    <button onClick={() => setUitgeslotenIds(prev => new Set([...prev, item.id]))} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                      <X size={13} color={C.muted} />
                    </button>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: `2px solid ${C.border}` }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Totaal: {formatBedrag(selectieTotaal)}</p>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button style={{ ...S.btn(C.card, C.text), flex: 1, border: `1px solid ${C.border}`, fontSize: 12, padding: "10px 0" }} onClick={exporteerSelectieCsv}>
                    <Download size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />CSV
                  </button>
                  <button style={{ ...S.btn(), flex: 2, fontSize: 13 }} onClick={markeerAlsIngediend}>
                    <Check size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />Markeer als ingediend
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Volledige lijst */}
        {!selectieModus && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "4px 0 8px" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>Alle declaraties {jaar}</p>
              <button onClick={exporteerSelectieCsv} style={{ background: "none", border: "none", color: C.accent, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                <Download size={12} style={{ verticalAlign: "middle", marginRight: 2 }} />CSV
              </button>
            </div>
            {itemsDitJaar.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <p style={{ fontSize: 15, color: C.muted, margin: 0 }}>Nog geen declaraties voor {jaar}.</p>
              </div>
            )}
            {itemsDitJaar.map(item => {
              const info = typeInfo(item.type);
              return (
                <div key={item.id} style={S.card}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{info.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: persoonKleur(item.persoon), marginRight: 6 }} />
                          {item.project}
                        </p>
                        <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap" }}>{formatBedrag(bedragVoorItem(item))}</span>
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: C.muted }}>
                        {item.persoon} · {formatDatumKort(item.datum)} · Q{kwartaalVan(item.datum)}
                        {item.type === "kilometer" && ` · ${item.van} → ${item.naar}${item.retour ? " (retour)" : ""} · ${kmVoorItem(item)} km × €${(item.tarief??KM_TARIEF).toFixed(2)}`}
                        {item.type === "parkeren" && item.locatie && ` · ${item.locatie}`}
                        {item.type === "ov" && item.ritten && ` · ${item.ritten.map(r => vervoermiddelInfo(r.vervoermiddel).icon).join("")} (${item.ritten.length} traject${item.ritten.length===1?"":"delen"})`}
                        {item.type === "overig" && item.omschrijving && ` · ${item.omschrijving}`}
                      </p>
                      {item.ingediend && (
                        <span style={{ display: "inline-block", marginTop: 4, fontSize: 10, fontWeight: 700, color: C.green, background: `${C.green}18`, borderRadius: 8, padding: "2px 8px" }}>
                          ✓ Ingediend
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button style={{ ...S.btn(C.card, C.text), border: `1px solid ${C.border}`, fontSize: 11, padding: "6px 10px" }} onClick={() => bewerkItem(item)}>
                      <Pencil size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />Bewerk
                    </button>
                    <button style={{ ...S.btn(C.card, C.red), border: `1px solid ${C.border}`, fontSize: 11, padding: "6px 10px" }} onClick={() => verwijderItem(item.id)}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </main>

      {showTypeKiezer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => setShowTypeKiezer(false)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 32px", width: "100%" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>Wat wil je declareren?</h2>
              <button onClick={() => setShowTypeKiezer(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {DECLARATIE_TYPES.map(t => (
                <button key={t.id} onClick={() => kiesType(t.id)}
                  style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 12px", textAlign: "center", cursor: "pointer" }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{t.icon}</div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>{t.label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showForm && form && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => { setShowForm(false); setForm(null); setEditId(null); }}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>
                {typeInfo(form.type).icon} {editId ? "Bewerken" : typeInfo(form.type).label}
              </h2>
              <button onClick={() => { setShowForm(false); setForm(null); setEditId(null); }} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color={C.muted} />
              </button>
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Voor wie</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {PERSONEN.map(p => (
                <button key={p.id} type="button" style={{ flex: 1, ...S.chip(form.persoon === p.id, p.kleur), textAlign: "center", padding: "10px 0" }}
                  onClick={() => setForm(f => ({ ...f, persoon: p.id }))}>
                  {p.id}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Datum</label>
            <input type="date" style={{ ...S.inp, marginBottom: 12 }} value={form.datum}
              onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} />

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Project</label>
            <input style={{ ...S.inp, marginBottom: 12 }} placeholder="Projectnaam" value={form.project}
              onChange={e => setForm(f => ({ ...f, project: e.target.value }))} />

            {form.type === "kilometer" && (
              <>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Van</label>
                <div style={{ marginBottom: 12 }}>
                  <AdresInvoer waarde={form.van} placeholder="Vertrekadres of plaats"
                    favorieten={berekenLocatieFavorieten(items, "kilometer", "van")}
                    onWijzig={(tekst, coords) => setForm(f => ({ ...f, van: tekst, vanCoords: coords }))} />
                </div>

                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Naar</label>
                <div style={{ marginBottom: 12 }}>
                  <AdresInvoer waarde={form.naar} placeholder="Bestemmingsadres of plaats"
                    favorieten={berekenLocatieFavorieten(items, "kilometer", "naar")}
                    onWijzig={(tekst, coords) => setForm(f => ({ ...f, naar: tekst, naarCoords: coords }))} />
                </div>

                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Aantal kilometers (enkele reis)</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input type="number" style={S.inp} placeholder="bv. 42.5" value={form.km}
                    onChange={e => setForm(f => ({ ...f, km: e.target.value }))} />
                  <button type="button" onClick={berekenAfstandVoorForm} disabled={afstandLaden}
                    style={{ ...S.btn(C.card, C.accentDark), border: `1px solid ${C.border}`, whiteSpace: "nowrap", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                    <Calculator size={14} />{afstandLaden ? "Bezig…" : "Bereken"}
                  </button>
                </div>
                {afstandFout && <p style={{ fontSize: 11, color: C.red, margin: "0 0 8px" }}>{afstandFout}</p>}

                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Reistype</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <button type="button" style={{ flex: 1, ...S.chip(!form.retour), textAlign: "center", padding: "10px 0" }}
                    onClick={() => setForm(f => ({ ...f, retour: false }))}>
                    Enkele reis
                  </button>
                  <button type="button" style={{ flex: 1, ...S.chip(!!form.retour), textAlign: "center", padding: "10px 0" }}
                    onClick={() => setForm(f => ({ ...f, retour: true }))}>
                    Retour (×2)
                  </button>
                </div>
                {form.km && (
                  <p style={{ fontSize: 12, color: C.muted, margin: "8px 0 12px" }}>
                    {form.retour ? `${form.km} km × 2 (retour)` : `${form.km} km`} × €{KM_TARIEF.toFixed(2)} = <strong>{formatBedrag((+form.km||0) * (form.retour?2:1) * KM_TARIEF)}</strong>
                  </p>
                )}
              </>
            )}

            {form.type === "parkeren" && (
              <>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Waar</label>
                <div style={{ marginBottom: 12 }}>
                  <AdresInvoer waarde={form.locatie} placeholder="bv. Parkeergarage Centrum"
                    favorieten={berekenLocatieFavorieten(items, "parkeren", "locatie")}
                    onWijzig={tekst => setForm(f => ({ ...f, locatie: tekst }))} />
                </div>

                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Bedrag</label>
                <input type="number" step="0.01" style={{ ...S.inp, marginBottom: 12 }} placeholder="€ 0,00" value={form.bedrag}
                  onChange={e => setForm(f => ({ ...f, bedrag: e.target.value }))} />
              </>
            )}

            {form.type === "ov" && (
              <OvTrajectInvoer form={form} setForm={setForm} favorieten={berekenOvOmschrijvingFavorieten(items)} />
            )}

            {form.type === "overig" && (
              <>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Omschrijving</label>
                <input style={{ ...S.inp, marginBottom: 12 }} placeholder="Waar ging het om?" value={form.omschrijving}
                  onChange={e => setForm(f => ({ ...f, omschrijving: e.target.value }))} />

                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Bedrag</label>
                <input type="number" step="0.01" style={{ ...S.inp, marginBottom: 12 }} placeholder="€ 0,00" value={form.bedrag}
                  onChange={e => setForm(f => ({ ...f, bedrag: e.target.value }))} />
              </>
            )}

            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15, marginTop: 6 }} onClick={slaOp}>
              {editId ? "Opslaan" : "Toevoegen"}
            </button>
          </div>
        </div>
      )}

      <button style={S.fab} onClick={() => setShowTypeKiezer(true)}>
        <Plus size={24} color="#FFF" />
      </button>

      {toast && (
        <div style={{ position: "fixed", bottom: 90, left: 20, right: 20, background: C.accentDark, color: "#FFF", padding: "12px 18px", borderRadius: 12, textAlign: "center", fontSize: 13, fontWeight: 600, zIndex: 200 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
