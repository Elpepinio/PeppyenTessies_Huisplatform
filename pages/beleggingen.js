import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, X, Trash2, AlertTriangle } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// Beleggingen — portfolio-tracker voor de zakelijke beleggingen (Ektachrome B.V.)
// en de privé-crypto. Posities met een eigen thesis-journal (Freeman-Shor
// these-intact/these-gebroken-principe), een watchlist, FIRE-voortgang, en een
// concentratie-overzicht per sector-cluster.
// ═══════════════════════════════════════════════════════════════════════════════

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const euro = n => `€ ${Math.round(n || 0).toLocaleString("nl-NL")}`;
const euroDecimaal = n => `€ ${(n || 0).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CLUSTERS = ["Tech/AI", "Healthcare", "Klimaat/Duurzaamheid", "Financials", "Overig"];
const STATUS_OPTIES = [
  { id: "intact", label: "These intact", kleur: "groen" },
  { id: "deels_gebroken", label: "Deels gebroken", kleur: "oranje" },
  { id: "gebroken", label: "These gebroken", kleur: "rood" },
  { id: "wacht_op_aankoopmoment", label: "Wacht op aankoopmoment", kleur: "muted" },
];
function statusInfo(id) {
  return STATUS_OPTIES.find(s => s.id === id) || STATUS_OPTIES[0];
}

// ── FIRE-voortgang ─────────────────────────────────────────────────────────
function berekenFireVoortgang(huidigVermogen, doel) {
  const v = +huidigVermogen || 0, d = +doel || 0;
  if (d <= 0) return { percentage: 0, nogTeGaan: 0 };
  const percentage = Math.min(100, Math.round((v / d) * 1000) / 10);
  return { percentage, nogTeGaan: Math.max(0, d - v) };
}

// ── Dividend-voortgang ───────────────────────────────────────────────────
function berekenDividendVoortgang(gerealiseerd, doel) {
  const g = +gerealiseerd || 0, d = +doel || 0;
  if (d <= 0) return { percentage: 0 };
  return { percentage: Math.round((g / d) * 1000) / 10 };
}

// ── Concentratie per sector-cluster ──────────────────────────────────────
// Alleen posities met een ingevulde huidige waarde tellen mee — zonder
// waarde kan geen percentage van de portefeuille berekend worden.
function berekenClusterConcentratie(posities) {
  const actief = (posities || []).filter(p => p.actief !== false && +p.huidigeWaardeEur > 0);
  const totaalWaarde = actief.reduce((s, p) => s + (+p.huidigeWaardeEur || 0), 0);
  const perCluster = {};
  actief.forEach(p => {
    const cluster = p.cluster || "Overig";
    if (!perCluster[cluster]) perCluster[cluster] = { waarde: 0, posities: [] };
    perCluster[cluster].waarde += +p.huidigeWaardeEur || 0;
    perCluster[cluster].posities.push(p.naam);
  });
  const resultaat = Object.entries(perCluster).map(([cluster, d]) => ({
    cluster, waarde: d.waarde, posities: d.posities,
    percentage: totaalWaarde > 0 ? Math.round((d.waarde / totaalWaarde) * 1000) / 10 : 0,
  })).sort((a, b) => b.percentage - a.percentage);
  return { totaalWaarde, perCluster: resultaat };
}

// ── Hoe lang geleden was iets, en welke posities zijn een these-check
//    toe? ───────────────────────────────────────────────────────────────
// Geïnspireerd op het "decision review"-patroon uit vergelijkbare
// portfolio-trackers: een positie die je lang niet meer bewust hebt
// getoetst, verdient een moment om de these opnieuw te bevestigen — precies
// het Freeman-Shor these-intact/these-gebroken-principe, niet alleen bij
// aankoop maar herhaaldelijk.
function berekenDagenSinds(datumStr) {
  if (!datumStr) return null;
  const nu = new Date(), toen = new Date(datumStr);
  return Math.floor((nu - toen) / (1000 * 60 * 60 * 24));
}
const THESE_CHECK_DREMPEL_DAGEN = 90;
function vindTheseCheckNodig(posities, drempelDagen = THESE_CHECK_DREMPEL_DAGEN) {
  return (posities || []).filter(p => p.actief !== false).filter(p => {
    const dagen = berekenDagenSinds(p.laatstGetoetst);
    return dagen === null || dagen > drempelDagen;
  });
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
  tab: (active) => ({ flex: 1, border: "none", borderRadius: 9, padding: "9px 4px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", background: active ? C.accent : "transparent", color: active ? "#FFF" : C.muted }),
};
const KLEUR_MAP = { groen: C.groen, oranje: C.oranje, rood: C.rood, muted: C.muted };

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
function Rij({ label, waarde, dik = false, muted = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: dik ? 13.5 : 12.5, fontWeight: dik ? 800 : 400, color: muted ? C.muted : C.text }}>
      <span>{label}</span>
      <span>{waarde}</span>
    </div>
  );
}

// ── Startdata — gebaseerd op de laatst bekende export (1 september 2026) ──
// Nadrukkelijk NIET live: geen van de huidige-waarde-velden per positie is
// hier vooringevuld, omdat alleen een ruwe schatting van het totaal en één
// los percentage (ASML ~28%) bekend waren, geen betrouwbare bedragen per
// positie. Vul deze zelf aan voor een werkend concentratie-overzicht.
function LEEG_DATA() {
  return {
    profiel: { fireDoelEur: "900000", dividenddoelEurPerJaar: "1200" },
    vermogen: { zakelijkEur: "188500" },
    cryptoPosities: [
      { id: uid(), naam: "XRP", bedragEur: "7500", notitie: "Door gebruiker zelf bestempeld als speculatief/gok, niet als investering. ~3% van totaalvermogen — binnen eigen regel 'nooit meer dan je kunt missen'.", custodyOverweging: "Custody-risico (eerdere ervaring: Bitcoin verloren bij een Ledger-overzetting, oorzaak niet achterhaald) — nog geen besluit genomen over zelfbewaring vs. custodial bij Bitvavo. Overwegingen: custodial = geen overzettingsrisico maar wel tegenpartijrisico (extra relevant na Bitvavo's banenreductie-nieuws, sept 2026); zelfbewaring = controle maar reëel uitvoeringsrisico gezien eerdere ervaring." },
    ],
    dividendGerealiseerdPerJaar: "923",
    posities: [
      { id: uid(), naam: "ASML", ticker: "ASML.AS", sector: "Halfgeleider-equipment", cluster: "Tech/AI", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "Grootste positie, ~28% van portfolio bij laatste meting — monopolie EUV-lithografie", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "Nvidia", ticker: "NVDA", sector: "AI Chips", cluster: "Tech/AI", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "Tweede grootste positie, deel van tech/AI-concentratie", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "Alphabet C", ticker: "GOOGL", sector: "Big Tech/AI", cluster: "Tech/AI", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "Danaher", ticker: "DHR", sector: "Life sciences tools", cluster: "Healthcare", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "Actieve verkoop-trigger: $210,00 — koers was $211,74 bij laatste check, trigger geraakt", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "Boston Scientific", ticker: "BSX", sector: "Medtech", cluster: "Healthcare", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "Freeman-Shor-kandidaat uit eerdere analyse, inmiddels gekocht", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "Salesforce", ticker: "CRM", sector: "Enterprise software (CRM)", cluster: "Tech/AI", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "Verkoop-trigger actief geweest: $226,92", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "GSK", ticker: "GSK.L", sector: "Healthcare/Pharma", cluster: "Healthcare", huidigeWaardeEur: "", aantalStuks: "36", gemAankoopprijs: "22.06", notitie: "Vervanging voor Novo Nordisk, 1 sept 2026. ISIN GB00BN7SWP63 — let op: niet de oudere GB0009252882. Aankoopprijs in systeem is een SCHATTING, nog te verifiëren tegen de werkelijke orderbevestiging.", these: "Lage waardering (forward P/E ~10-11x) met 0% Britse bronbelasting en een gediversifieerde pijplijn (HIV, oncologie, vaccins). Management-guidance van 7-9% groei in core operating profit/EPS voor 2026 is bevestigd.", theseGebrokenTrigger: "Neerwaartse bijstelling van de 7-9% guidance, of een duidelijk versnelde HIV-patentdruk (normaal verwacht vanaf ~2028, dolutegravir).", ijkpunten: "", status: "intact", laatstGetoetst: "2026-09-01", actief: true },
      { id: uid(), naam: "Munich Re", ticker: "MUV2.DE", sector: "Financials/ESG (herverzekering)", cluster: "Klimaat/Duurzaamheid", huidigeWaardeEur: "", aantalStuks: "3", gemAankoopprijs: "521.07", notitie: "3 stuks na 2e tranche (+1 @ €524, eigen trigger €500-510 geraakt)", these: "P/E 9,5x, 9,3%/jaar dividendgroei, klimaatverandering als structurele rugwind voor herverzekeraars.", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "2026-09-01", actief: true },
      { id: uid(), naam: "Ørsted", ticker: "ORSTED.CO", sector: "Offshore wind", cluster: "Klimaat/Duurzaamheid", huidigeWaardeEur: "", aantalStuks: "236", gemAankoopprijs: "22.19", notitie: "236 stuks na bijkoop (+48 @ €18,60). Dividendherstel gepland vanaf 2027.", these: "Operationeel sterk (EBITDA +8% H1 2026), het grootste risico (Amerikaanse bouwstops) is opgelost — 5 van 5 rechtszaken gewonnen. De -79% nettowinst in Q2 was een boekhoudkundige afwaardering, geen operationeel probleem.", theseGebrokenTrigger: "Aanhoudende operationele verslechtering, een gedwongen 'farm-down'-verkoop tegen slechte prijzen, of verdere onzekerheid rond de kredietbeoordeling (stopte samenwerking met S&P in aug 2026).", ijkpunten: "", status: "intact", laatstGetoetst: "2026-09-01", actief: true },
      { id: uid(), naam: "Veolia", ticker: "VIE.PA", sector: "Water/milieudiensten", cluster: "Klimaat/Duurzaamheid", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "Xylem", ticker: "XYL", sector: "Watertechnologie", cluster: "Klimaat/Duurzaamheid", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "ASR Nederland", ticker: "ASRNL.AS", sector: "Verzekeraar", cluster: "Financials", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "Toyota", ticker: "TM", sector: "Auto", cluster: "Overig", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "Kleine positie. Verkoop-trigger actief geweest: $200,00", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "iShares Automation & Robotics ETF", ticker: "QDVX.DE", sector: "Thematische ETF", cluster: "Tech/AI", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "VUSA (Vanguard S&P 500)", ticker: "VUSA.AS", sector: "Brede index", cluster: "Overig", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "Bewust uitgesloten uit tech/AI-clusterberekening — brede index, geen techweddenschap.", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "NT World (screened)", ticker: "NTWRLD", sector: "ESG wereldfonds", cluster: "Overig", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "NT Emerging Markets", ticker: "NTEM", sector: "ESG EM-fonds", cluster: "Overig", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "NT UCITS SmallCap", ticker: "NTSMCAP", sector: "ESG smallcap-fonds", cluster: "Overig", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "Novo Nordisk B", ticker: "NOVO-B.CO", sector: "Diabetes/obesitas", cluster: "Healthcare", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "VERKOCHT, ~augustus 2026", these: "", theseGebrokenTrigger: "CagriSema onderpresteerde t.o.v. Lilly's tirzepatide, winstwaarschuwing FY26, aantoonbaar marktaandeelverlies aan Lilly, toenemende patentdruk in China.", ijkpunten: "", status: "gebroken", laatstGetoetst: "2026-08", actief: false },
      { id: uid(), naam: "Vestas", ticker: "VWS.CO", sector: "Windenergie", cluster: "Klimaat/Duurzaamheid", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "VERKOCHT — datum/reden niet vastgelegd, nader aan te vullen", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "gebroken", laatstGetoetst: "", actief: false },
    ],
    watchlist: [
      { id: uid(), naam: "Bristol-Myers Squibb", ticker: "BMY", these: "Templeton-kans: patent cliff op Eliquis/Opdivo heeft de waardering naar ~10x P/E gedrukt ('maximum pessimism'), terwijl cashflow en dividend gezond blijven en het groeiportfolio al ~55% van de omzet uitmaakt.", ijkpunten: "FDA-besluit iberdomide, milvexian Fase 3-data", status: "wacht_op_aankoopmoment" },
      { id: uid(), naam: "Schneider Electric", ticker: "SU.PA (verifieer)", these: "Elektrificatie/energiebeheer, +14-16,5% organische groei H1 2026, marge 19,3% stijgend — sterkste nieuwe kandidaat uit recente screening, geen overlap met bestaande posities.", ijkpunten: "", status: "wacht_op_aankoopmoment" },
    ],
  };
}

export default function BeleggingenApp() {
  const [data, setData] = useState(null);
  const [laden, setLaden] = useState(true);
  const [tab, setTab] = useState("overzicht");
  const [saveFout, setSaveFout] = useState(false);

  useEffect(() => {
    let actief = true;
    fetch("/api/beleggingen").then(r => r.json()).then(d => { if (actief) setData(d); })
      .catch(() => setData(LEEG_DATA())).finally(() => { if (actief) setLaden(false); });
    return () => { actief = false; };
  }, []);

  function persist(patch) {
    setData(d => {
      const next = { ...d, ...patch };
      fetch("/api/beleggingen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) })
        .then(r => { if (!r.ok) throw new Error(); setSaveFout(false); })
        .catch(() => setSaveFout(true));
      return next;
    });
  }

  if (laden || !data) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>Laden…</div>
  );

  return (
    <div style={S.appBg}>
      <header style={S.header}>
        <Link href="/" style={{ fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, textDecoration: "none" }}>
          <ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> Terug
        </Link>
        <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700, color: C.accent }}>📈 Beleggingen</h1>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: C.muted }}>Ektachrome B.V. — posities, thesis-journal en FIRE-voortgang</p>
      </header>

      {saveFout && (
        <div style={{ margin: "0 20px 8px", background: "#FBEAEA", border: `1px solid ${C.rood}44`, borderRadius: 10, padding: "9px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} color={C.rood} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 11.5, color: C.text }}>Opslaan is niet gelukt — controleer je verbinding. Je laatste wijziging staat mogelijk nog niet vast.</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 4, background: C.card, borderRadius: 11, padding: 3, margin: "12px 20px 4px", overflowX: "auto" }}>
        <button style={{ ...S.tab(tab === "overzicht"), flexShrink: 0 }} onClick={() => setTab("overzicht")}>Overzicht</button>
        <button style={{ ...S.tab(tab === "posities"), flexShrink: 0 }} onClick={() => setTab("posities")}>Posities</button>
        <button style={{ ...S.tab(tab === "watchlist"), flexShrink: 0 }} onClick={() => setTab("watchlist")}>Watchlist</button>
        <button style={{ ...S.tab(tab === "concentratie"), flexShrink: 0 }} onClick={() => setTab("concentratie")}>Concentratie</button>
      </div>

      <main style={S.main}>
        {tab === "overzicht" && <OverzichtTab data={data} persist={persist} />}
        {tab === "posities" && <PositiesTab data={data} persist={persist} />}
        {tab === "watchlist" && <WatchlistTab data={data} persist={persist} />}
        {tab === "concentratie" && <ConcentratieTab data={data} />}
      </main>
    </div>
  );
}

function Voortgangsbalk({ percentage, kleur = C.accent }) {
  return (
    <div style={{ background: C.card, borderRadius: 8, height: 10, overflow: "hidden", margin: "6px 0 2px" }}>
      <div style={{ width: `${Math.min(100, percentage)}%`, height: "100%", background: kleur, borderRadius: 8, transition: "width 0.3s" }} />
    </div>
  );
}

function CryptoSectie({ data, persist, priveCrypto, zakelijk }) {
  const [bewerkItem, setBewerkItem] = useState(null);
  const cryptoPosities = data.cryptoPosities || [];

  function opslaan(item) {
    if (item.id) {
      persist({ cryptoPosities: cryptoPosities.map(p => p.id === item.id ? item : p) });
    } else {
      persist({ cryptoPosities: [...cryptoPosities, { ...item, id: uid() }] });
    }
    setBewerkItem(null);
  }
  function verwijder(id) {
    if (!window.confirm("Deze crypto-positie verwijderen?")) return;
    persist({ cryptoPosities: cryptoPosities.filter(p => p.id !== id) });
    setBewerkItem(null);
  }

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: C.accent }}>Privé crypto</h3>
        <button onClick={() => setBewerkItem({})} style={{ background: C.accent, color: "#FFF", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Plus size={16} />
        </button>
      </div>

      {cryptoPosities.length === 0 && <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Nog niets ingevuld.</p>}

      {cryptoPosities.map(p => (
        <div key={p.id} onClick={() => setBewerkItem(p)} style={{ padding: "8px 0", borderTop: `1px solid ${C.border}`, cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{p.naam}</p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{euro(+p.bedragEur)}</p>
          </div>
          {p.notitie && <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{p.notitie}</p>}
          {p.custodyOverweging && <p style={{ margin: "4px 0 0", fontSize: 11, color: C.oranje, lineHeight: 1.5 }}>⚠️ {p.custodyOverweging}</p>}
        </div>
      ))}

      {priveCrypto > 0 && (
        <p style={{ fontSize: 11, color: C.muted, margin: "10px 0 0", paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
          Totaal incl. crypto: {euro(zakelijk + priveCrypto)} — telt bewust niet mee in de FIRE-voortgang hierboven (privé, hoog-risico, apart gehouden).
        </p>
      )}

      {bewerkItem && <CryptoModal item={bewerkItem} onOpslaan={opslaan} onVerwijder={bewerkItem.id ? () => verwijder(bewerkItem.id) : null} onSluiten={() => setBewerkItem(null)} />}
    </div>
  );
}

function CryptoModal({ item, onOpslaan, onVerwijder, onSluiten }) {
  const [form, setForm] = useState({
    naam: item.naam || "", bedragEur: item.bedragEur || "", notitie: item.notitie || "",
    custodyOverweging: item.custodyOverweging || "", id: item.id || null,
  });
  function update(patch) { setForm(f => ({ ...f, ...patch })); }
  function versturen() {
    if (!form.naam.trim()) { window.alert("Vul in elk geval een naam in."); return; }
    onOpslaan(form);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end" }} onClick={onSluiten}>
      <div style={{ background: C.bg, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 560, margin: "0 auto", maxHeight: "90vh", overflowY: "auto", padding: "20px 20px calc(20px + env(safe-area-inset-bottom))" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.accent }}>{form.id ? "Crypto-positie bewerken" : "Nieuwe crypto-positie"}</h2>
          <button onClick={onSluiten} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.muted} /></button>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 2 }}><Veld label="Naam" type="text" value={form.naam} onChange={v => update({ naam: v })} /></div>
          <div style={{ flex: 1 }}><Veld label="Waarde" value={form.bedragEur} onChange={v => update({ bedragEur: v })} suffix="€" /></div>
        </div>
        <label style={S.label}>Notitie</label>
        <textarea style={{ ...S.inp, minHeight: 50, marginBottom: 10, fontFamily: "inherit" }} value={form.notitie} onChange={e => update({ notitie: e.target.value })} />
        <label style={S.label}>Custody-overweging (optioneel)</label>
        <textarea style={{ ...S.inp, minHeight: 50, marginBottom: 12, fontFamily: "inherit" }} value={form.custodyOverweging} onChange={e => update({ custodyOverweging: e.target.value })} />

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

function OverzichtTab({ data, persist }) {
  const profiel = data.profiel || {};
  const vermogen = data.vermogen || {};
  const zakelijk = +vermogen.zakelijkEur || 0;
  const cryptoPosities = data.cryptoPosities || [];
  const priveCrypto = cryptoPosities.reduce((s, p) => s + (+p.bedragEur || 0), 0);
  const fireDoel = +profiel.fireDoelEur || 0;

  function updateProfiel(patch) { persist({ profiel: { ...profiel, ...patch } }); }
  function updateVermogen(patch) { persist({ vermogen: { ...vermogen, ...patch } }); }

  // FIRE-voortgang rekent bewust alleen op het ZAKELIJKE vermogen, consistent
  // met hoe dit ook in de brontracker werd bijgehouden — crypto is bewust
  // apart gehouden (privé, hoog-risico, niet meegeteld richting het doel).
  const fire = berekenFireVoortgang(zakelijk, fireDoel);
  const dividend = berekenDividendVoortgang(data.dividendGerealiseerdPerJaar, profiel.dividenddoelEurPerJaar);
  const dagenSindsBijwerken = berekenDagenSinds(data.laatstBijgewerkt);
  const theseCheckNodig = vindTheseCheckNodig(data.posities);

  return (
    <>
      {(dagenSindsBijwerken !== null || theseCheckNodig.length > 0) && (
        <div style={{ ...S.card, background: "#FBF0E4", border: `1px solid ${C.oranje}33` }}>
          {dagenSindsBijwerken !== null && (
            <p style={{ margin: 0, fontSize: 11.5, color: dagenSindsBijwerken > 30 ? C.oranje : C.text }}>
              📅 Posities voor het laatst bijgewerkt: {dagenSindsBijwerken === 0 ? "vandaag" : `${dagenSindsBijwerken} dagen geleden`}
            </p>
          )}
          {theseCheckNodig.length > 0 && (
            <p style={{ margin: dagenSindsBijwerken !== null ? "4px 0 0" : 0, fontSize: 11.5, color: C.text }}>
              🔍 {theseCheckNodig.length} {theseCheckNodig.length === 1 ? "positie" : "posities"} toe aan een these-check — zie Posities.
            </p>
          )}
        </div>
      )}
      <div style={{ ...S.card, background: C.accent, color: "#FFF" }}>
        <p style={{ margin: "0 0 2px", fontSize: 11, color: "rgba(255,255,255,0.75)" }}>FIRE-voortgang (zakelijk vermogen)</p>
        <p style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>{fire.percentage}%</p>
        <Voortgangsbalk percentage={fire.percentage} kleur="#FFF" />
        <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "rgba(255,255,255,0.85)" }}>{euro(zakelijk)} van {euro(fireDoel)} — nog {euro(fire.nogTeGaan)} te gaan</p>
      </div>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 10px", fontSize: 13.5, fontWeight: 800, color: C.accent }}>Zakelijk vermogen</h3>
        <Veld label="Zakelijk vermogen (Ektachrome B.V.)" value={vermogen.zakelijkEur} onChange={v => updateVermogen({ zakelijkEur: v })} suffix="€" />
        <Veld label="FIRE-doel" value={profiel.fireDoelEur} onChange={v => updateProfiel({ fireDoelEur: v })} suffix="€" />
      </div>

      <CryptoSectie data={data} persist={persist} priveCrypto={priveCrypto} zakelijk={zakelijk} />

      <div style={S.card}>
        <h3 style={{ margin: "0 0 10px", fontSize: 13.5, fontWeight: 800, color: C.accent }}>Dividend</h3>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Veld label="Gerealiseerd per jaar" value={data.dividendGerealiseerdPerJaar} onChange={v => persist({ dividendGerealiseerdPerJaar: v })} suffix="€" /></div>
          <div style={{ flex: 1 }}><Veld label="Doel per jaar" value={profiel.dividenddoelEurPerJaar} onChange={v => updateProfiel({ dividenddoelEurPerJaar: v })} suffix="€" /></div>
        </div>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.accent }}>{dividend.percentage}%</p>
        <Voortgangsbalk percentage={dividend.percentage} kleur={C.accentLicht} />
      </div>

      <div style={{ ...S.card, background: "#FBF0E4", border: `1px solid ${C.oranje}33` }}>
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.6 }}>
          ⚠️ Deze cijfers zijn een startpunt op basis van de laatst bekende stand (1 september 2026) — niet live. Werk ze bij zodra je een actuele stand hebt, bijvoorbeeld via een verse broker-export.
        </p>
      </div>
    </>
  );
}

function StatusBadge({ status }) {
  const info = statusInfo(status);
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: "#FFF", background: KLEUR_MAP[info.kleur], borderRadius: 6, padding: "2px 7px" }}>
      {info.label}
    </span>
  );
}

function SnelBijwerkenScherm({ posities, persist, onKlaar }) {
  const actief = posities.filter(p => p.actief !== false);
  const [waardes, setWaardes] = useState(() => Object.fromEntries(actief.map(p => [p.id, p.huidigeWaardeEur || ""])));

  function opslaanAlles() {
    const bijgewerkt = posities.map(p => waardes[p.id] !== undefined ? { ...p, huidigeWaardeEur: waardes[p.id] } : p);
    persist({ posities: bijgewerkt, laatstBijgewerkt: new Date().toISOString() });
    onKlaar();
  }

  return (
    <>
      <div style={{ ...S.card, background: C.accent, color: "#FFF" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>⚡ Snel bijwerken</p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.8)" }}>Vul de huidige waarde per positie in — sla aan het einde in één keer alles op.</p>
      </div>

      <div style={S.card}>
        {actief.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.naam}</p>
              <p style={{ margin: 0, fontSize: 10.5, color: C.muted }}>{p.ticker}</p>
            </div>
            <div style={{ position: "relative", width: 130, flexShrink: 0 }}>
              <input type="number" style={S.inp} value={waardes[p.id] ?? ""} onChange={e => setWaardes(w => ({ ...w, [p.id]: e.target.value }))} />
              <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.muted }}>€</span>
            </div>
          </div>
        ))}
        {actief.length === 0 && <p style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 20 }}>Nog geen actieve posities om bij te werken.</p>}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onKlaar} style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "13px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Annuleer</button>
        <button onClick={opslaanAlles} style={{ flex: 2, background: C.accent, color: "#FFF", border: "none", borderRadius: 12, padding: "13px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Alles opslaan</button>
      </div>
    </>
  );
}

function PositiesTab({ data, persist }) {
  const [bewerkItem, setBewerkItem] = useState(null);
  const [toonInactief, setToonInactief] = useState(false);
  const [snelModus, setSnelModus] = useState(false);
  const posities = data.posities || [];
  const zichtbaar = posities.filter(p => toonInactief || p.actief !== false);
  const theseCheckNodig = vindTheseCheckNodig(posities);
  const dagenSindsBijwerken = berekenDagenSinds(data.laatstBijgewerkt);

  function opslaan(item) {
    if (item.id) {
      persist({ posities: posities.map(p => p.id === item.id ? item : p) });
    } else {
      persist({ posities: [...posities, { ...item, id: uid() }] });
    }
    setBewerkItem(null);
  }
  function verwijder(id) {
    if (!window.confirm("Deze positie definitief verwijderen? Overweeg in plaats daarvan 'actief' uit te zetten, zodat de thesis-geschiedenis bewaard blijft.")) return;
    persist({ posities: posities.filter(p => p.id !== id) });
    setBewerkItem(null);
  }

  if (snelModus) {
    return <SnelBijwerkenScherm posities={posities} persist={persist} onKlaar={() => setSnelModus(false)} />;
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setSnelModus(true)}
          style={{ flex: 1, background: C.accent, color: "#FFF", border: "none", borderRadius: 10, padding: "10px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
          ⚡ Snel bijwerken
        </button>
      </div>
      {dagenSindsBijwerken !== null && (
        <p style={{ fontSize: 11, color: dagenSindsBijwerken > 30 ? C.oranje : C.muted, margin: "0 0 10px" }}>
          Waardes voor het laatst bijgewerkt: {dagenSindsBijwerken === 0 ? "vandaag" : `${dagenSindsBijwerken} dagen geleden`}
        </p>
      )}

      {theseCheckNodig.length > 0 && (
        <div style={{ ...S.card, background: "#FBF0E4", border: `1px solid ${C.oranje}33` }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700 }}>🔍 {theseCheckNodig.length} {theseCheckNodig.length === 1 ? "positie is" : "posities zijn"} een these-check toe</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: C.muted }}>{theseCheckNodig.map(p => p.naam).join(", ")} — niet (meer recent dan {THESE_CHECK_DREMPEL_DAGEN} dagen) getoetst op het Freeman-Shor these-intact/these-gebroken-principe.</p>
        </div>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.muted, marginBottom: 10 }}>
        <input type="checkbox" checked={toonInactief} onChange={e => setToonInactief(e.target.checked)} />
        Ook verkochte/inactieve posities tonen
      </label>

      {zichtbaar.map(p => (
        <div key={p.id} onClick={() => setBewerkItem(p)} style={{ ...S.card, cursor: "pointer", opacity: p.actief === false ? 0.55 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{p.naam}{p.actief === false ? " (verkocht)" : ""}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>{p.ticker} · {p.sector || "geen sector"} · {p.cluster || "Overig"}</p>
            </div>
            <StatusBadge status={p.status} />
          </div>
          {p.huidigeWaardeEur > 0 && <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 700 }}>{euro(+p.huidigeWaardeEur)}</p>}
          {p.notitie && <p style={{ margin: "6px 0 0", fontSize: 11.5, color: C.text, lineHeight: 1.5 }}>{p.notitie}</p>}
        </div>
      ))}

      {zichtbaar.length === 0 && <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 30 }}>Nog geen posities — tik op de + om te beginnen.</p>}

      <button onClick={() => setBewerkItem({})}
        style={{ position: "fixed", bottom: 24, right: 20, width: 54, height: 54, borderRadius: "50%", background: C.accent, color: "#FFF", border: "none", boxShadow: "0 4px 14px rgba(0,0,0,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Plus size={24} />
      </button>

      {bewerkItem && <PositieModal item={bewerkItem} onOpslaan={opslaan} onVerwijder={bewerkItem.id ? () => verwijder(bewerkItem.id) : null} onSluiten={() => setBewerkItem(null)} />}
    </>
  );
}

function PositieModal({ item, onOpslaan, onVerwijder, onSluiten }) {
  const [form, setForm] = useState({
    naam: item.naam || "", ticker: item.ticker || "", sector: item.sector || "", cluster: item.cluster || "Overig",
    huidigeWaardeEur: item.huidigeWaardeEur || "", aantalStuks: item.aantalStuks || "", gemAankoopprijs: item.gemAankoopprijs || "",
    notitie: item.notitie || "", these: item.these || "", theseGebrokenTrigger: item.theseGebrokenTrigger || "",
    ijkpunten: item.ijkpunten || "", status: item.status || "intact", laatstGetoetst: item.laatstGetoetst || "",
    actief: item.actief !== false, id: item.id || null,
  });
  function update(patch) { setForm(f => ({ ...f, ...patch })); }

  function versturen() {
    if (!form.naam.trim()) { window.alert("Vul in elk geval een naam in."); return; }
    onOpslaan(form);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end" }} onClick={onSluiten}>
      <div style={{ background: C.bg, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 560, margin: "0 auto", maxHeight: "92vh", overflowY: "auto", padding: "20px 20px calc(20px + env(safe-area-inset-bottom))" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.accent }}>{form.id ? "Positie bewerken" : "Nieuwe positie"}</h2>
          <button onClick={onSluiten} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.muted} /></button>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 2 }}><Veld label="Naam" type="text" value={form.naam} onChange={v => update({ naam: v })} /></div>
          <div style={{ flex: 1 }}><Veld label="Ticker" type="text" value={form.ticker} onChange={v => update({ ticker: v })} /></div>
        </div>
        <Veld label="Sector" type="text" value={form.sector} onChange={v => update({ sector: v })} />

        <label style={S.label}>Cluster</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {CLUSTERS.map(c => (
            <button key={c} onClick={() => update({ cluster: c })}
              style={{ padding: "7px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: form.cluster === c ? C.accent : C.card, color: form.cluster === c ? "#FFF" : C.text, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
              {c}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Veld label="Huidige waarde" value={form.huidigeWaardeEur} onChange={v => update({ huidigeWaardeEur: v })} suffix="€" /></div>
          <div style={{ flex: 1 }}><Veld label="Aantal stuks" value={form.aantalStuks} onChange={v => update({ aantalStuks: v })} /></div>
          <div style={{ flex: 1 }}><Veld label="Gem. aankoopprijs" value={form.gemAankoopprijs} onChange={v => update({ gemAankoopprijs: v })} suffix="€" /></div>
        </div>

        <label style={S.label}>Notitie</label>
        <textarea style={{ ...S.inp, minHeight: 50, marginBottom: 12, fontFamily: "inherit" }} value={form.notitie} onChange={e => update({ notitie: e.target.value })} />

        <div style={{ background: C.card, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 800, color: C.accent }}>📓 Thesis-journal</p>
          <label style={S.label}>These — waarom deze positie?</label>
          <textarea style={{ ...S.inp, minHeight: 60, marginBottom: 10, fontFamily: "inherit" }} value={form.these} onChange={e => update({ these: e.target.value })} />
          <label style={S.label}>These-gebroken-trigger — wat zou dit ongeldig maken?</label>
          <textarea style={{ ...S.inp, minHeight: 50, marginBottom: 10, fontFamily: "inherit" }} value={form.theseGebrokenTrigger} onChange={e => update({ theseGebrokenTrigger: e.target.value })} />
          <label style={S.label}>IJkpunten om op te letten</label>
          <input type="text" style={{ ...S.inp, marginBottom: 10 }} value={form.ijkpunten} onChange={e => update({ ijkpunten: e.target.value })} />

          <label style={S.label}>Status</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {STATUS_OPTIES.map(s => (
              <button key={s.id} onClick={() => update({ status: s.id })}
                style={{ padding: "7px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: form.status === s.id ? KLEUR_MAP[s.kleur] : C.surf, color: form.status === s.id ? "#FFF" : C.text, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                {s.label}
              </button>
            ))}
          </div>
          <Veld label="Laatst getoetst (datum)" type="date" value={form.laatstGetoetst} onChange={v => update({ laatstGetoetst: v })} />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 16 }}>
          <input type="checkbox" checked={form.actief} onChange={e => update({ actief: e.target.checked })} />
          Actief (nog in bezit)
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

function WatchlistTab({ data, persist }) {
  const [bewerkItem, setBewerkItem] = useState(null);
  const watchlist = data.watchlist || [];

  function opslaan(item) {
    if (item.id) {
      persist({ watchlist: watchlist.map(w => w.id === item.id ? item : w) });
    } else {
      persist({ watchlist: [...watchlist, { ...item, id: uid() }] });
    }
    setBewerkItem(null);
  }
  function verwijder(id) {
    if (!window.confirm("Dit watchlist-item verwijderen?")) return;
    persist({ watchlist: watchlist.filter(w => w.id !== id) });
    setBewerkItem(null);
  }

  return (
    <>
      <div style={S.card}>
        <p style={{ margin: 0, fontSize: 11.5, color: C.muted }}>Kandidaten die nog niet gekocht zijn — met hun these alvast vastgelegd, zodat je niet achteraf hoeft te reconstrueren waarom iets interessant leek.</p>
      </div>

      {watchlist.map(w => (
        <div key={w.id} onClick={() => setBewerkItem(w)} style={{ ...S.card, cursor: "pointer" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{w.naam}</p>
          <p style={{ margin: "2px 0 6px", fontSize: 11, color: C.muted }}>{w.ticker}</p>
          {w.these && <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>{w.these}</p>}
          {w.ijkpunten && <p style={{ margin: "6px 0 0", fontSize: 11, color: C.accentLicht }}>📍 {w.ijkpunten}</p>}
        </div>
      ))}

      {watchlist.length === 0 && <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 30 }}>Nog niets op de watchlist.</p>}

      <button onClick={() => setBewerkItem({})}
        style={{ position: "fixed", bottom: 24, right: 20, width: 54, height: 54, borderRadius: "50%", background: C.accent, color: "#FFF", border: "none", boxShadow: "0 4px 14px rgba(0,0,0,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Plus size={24} />
      </button>

      {bewerkItem && <WatchlistModal item={bewerkItem} onOpslaan={opslaan} onVerwijder={bewerkItem.id ? () => verwijder(bewerkItem.id) : null} onSluiten={() => setBewerkItem(null)} />}
    </>
  );
}

function WatchlistModal({ item, onOpslaan, onVerwijder, onSluiten }) {
  const [form, setForm] = useState({
    naam: item.naam || "", ticker: item.ticker || "", these: item.these || "", ijkpunten: item.ijkpunten || "",
    status: item.status || "wacht_op_aankoopmoment", id: item.id || null,
  });
  function update(patch) { setForm(f => ({ ...f, ...patch })); }
  function versturen() {
    if (!form.naam.trim()) { window.alert("Vul in elk geval een naam in."); return; }
    onOpslaan(form);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end" }} onClick={onSluiten}>
      <div style={{ background: C.bg, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 560, margin: "0 auto", maxHeight: "90vh", overflowY: "auto", padding: "20px 20px calc(20px + env(safe-area-inset-bottom))" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.accent }}>{form.id ? "Watchlist-item bewerken" : "Nieuw watchlist-item"}</h2>
          <button onClick={onSluiten} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.muted} /></button>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 2 }}><Veld label="Naam" type="text" value={form.naam} onChange={v => update({ naam: v })} /></div>
          <div style={{ flex: 1 }}><Veld label="Ticker" type="text" value={form.ticker} onChange={v => update({ ticker: v })} /></div>
        </div>
        <label style={S.label}>These</label>
        <textarea style={{ ...S.inp, minHeight: 70, marginBottom: 10, fontFamily: "inherit" }} value={form.these} onChange={e => update({ these: e.target.value })} />
        <Veld label="IJkpunten om op te letten" type="text" value={form.ijkpunten} onChange={v => update({ ijkpunten: v })} />

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
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

function ConcentratieTab({ data }) {
  const posities = data.posities || [];
  const { totaalWaarde, perCluster } = berekenClusterConcentratie(posities);
  const ontbrekendeWaarde = posities.filter(p => p.actief !== false && !(+p.huidigeWaardeEur > 0)).length;

  return (
    <>
      <div style={S.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.accent }}>Concentratie per cluster</h3>
        <p style={{ margin: 0, fontSize: 11.5, color: C.muted }}>Gebaseerd op de ingevulde "huidige waarde" per positie — geen weddenschap tegen één sector zonder dat je het doorhebt.</p>
      </div>

      {totaalWaarde === 0 ? (
        <div style={S.card}>
          <p style={{ margin: 0, fontSize: 13, color: C.muted, textAlign: "center", padding: 10 }}>
            Nog geen enkele positie heeft een ingevulde "huidige waarde" — vul deze in bij Posities om een concentratie-overzicht te zien.
          </p>
        </div>
      ) : (
        <>
          <div style={S.card}>
            <Rij label="Totale waarde (posities met ingevulde waarde)" waarde={euro(totaalWaarde)} dik />
          </div>
          {perCluster.map(c => (
            <div key={c.cluster} style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800 }}>{c.cluster}</p>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: c.percentage >= 40 ? C.oranje : C.accent }}>{c.percentage}%</p>
              </div>
              <Voortgangsbalk percentage={c.percentage} kleur={c.percentage >= 40 ? C.oranje : C.accentLicht} />
              <p style={{ margin: "6px 0 0", fontSize: 11, color: C.muted }}>{euro(c.waarde)} — {c.posities.join(", ")}</p>
              {c.percentage >= 40 && <p style={{ margin: "4px 0 0", fontSize: 11, color: C.oranje }}>⚠️ Boven 40% van de portefeuille — geen reden om winnaars te verkopen, wel om hier niet actief bij te kopen.</p>}
            </div>
          ))}
        </>
      )}

      {ontbrekendeWaarde > 0 && (
        <div style={{ ...S.card, background: "#FBF0E4", border: `1px solid ${C.oranje}33` }}>
          <p style={{ margin: 0, fontSize: 11.5, color: C.text }}>ℹ️ {ontbrekendeWaarde} actieve {ontbrekendeWaarde === 1 ? "positie heeft" : "posities hebben"} nog geen ingevulde waarde — dit overzicht is dus nog niet compleet.</p>
        </div>
      )}
    </>
  );
}
