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

// ── Koop-/verkoop-triggers ────────────────────────────────────────────────
// Komma of punt als decimaalteken, lege invoer = null (onbekend, geen crash).
function naarGetal(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}
// "verkoop": geraakt zodra de koers OP of BOVEN de trigger komt.
// "koop": geraakt zodra de koers OP of ONDER de trigger komt (watchlist).
// Geeft null terug als koers of trigger ontbreekt: dan weten we het niet.
function isPrijsTriggerGeraakt(huidigeKoers, trigger, richting) {
  const k = naarGetal(huidigeKoers), t = naarGetal(trigger);
  if (!k || !t || k <= 0 || t <= 0) return null;
  if (richting === "verkoop") return k >= t;
  if (richting === "koop") return k <= t;
  return null;
}
function vindGeraakteTriggers(posities, watchlist) {
  const actief = (posities || []).filter(p => p.actief !== false);
  const verkoop = actief.filter(p => isPrijsTriggerGeraakt(p.huidigeKoers, p.verkoopTrigger, "verkoop") === true);
  const koop = (watchlist || []).filter(w => isPrijsTriggerGeraakt(w.huidigeKoers, w.koopTrigger, "koop") === true);
  const zonderKoers = actief.filter(p => naarGetal(p.verkoopTrigger) > 0 && !(naarGetal(p.huidigeKoers) > 0))
    .concat((watchlist || []).filter(w => naarGetal(w.koopTrigger) > 0 && !(naarGetal(w.huidigeKoers) > 0)));
  return { verkoop, koop, zonderKoers };
}

// ── 7-regels kwaliteitscheck (Mika Beumer-stijl) ─────────────────────────
const ZEVEN_REGELS = [
  { key: "cashBovenSchuld", label: "Meer cash dan schuld" },
  { key: "omzetgroeiBoven10", label: "Omzetgroei boven 10%" },
  { key: "margeBoven10", label: "Marge boven 10%" },
  { key: "omzetSnellerDanKosten", label: "Omzet groeit sneller dan kosten" },
  { key: "concurrentievoordeel", label: "Concurrentievoordeel (moat)" },
  { key: "sterkManagement", label: "Sterk management" },
  { key: "recessiebestendig", label: "Recessiebestendig" },
];
const ZEVEN_REGELS_ANTWOORDEN = ["Ja", "Deels", "Nee", "N.v.t."];
function berekenZevenRegelsScore(zevenRegels) {
  const z = zevenRegels || {};
  let ja = 0, deels = 0, nee = 0, nvt = 0;
  ZEVEN_REGELS.forEach(r => {
    const a = z[r.key];
    if (a === "Ja") ja++; else if (a === "Deels") deels++; else if (a === "Nee") nee++; else if (a === "N.v.t.") nvt++;
  });
  const ingevuld = ja + deels + nee + nvt;
  return { ja, deels, nee, nvt, ingevuld, totaal: ZEVEN_REGELS.length };
}

// ── Startdata aanvullen voor al opgeslagen gebruikers ────────────────────
// De opgeslagen stand in Redis kent de nieuwe velden nog niet. Deze functie
// vult ALLEEN lege velden/secties vanuit de startdata en overschrijft nooit
// iets wat al is ingevuld. startdataVersie zorgt dat het maar één keer
// gebeurt: wie een veld bewust leegmaakt, krijgt het niet terug.
const STARTDATA_VERSIE = 2;
const AANVUL_POSITIEVELDEN = ["verkoopTrigger", "aankoopdatum", "waarderingBijAankoop"];
const AANVUL_SECTIES = ["onderzochtAfgewezen", "preIpoVolgen", "bronbelasting", "bronbelastingNietOnderzocht", "openstaandeBeslissingen"];
function isLeegVeld(v) {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}
function vulStartdataAan(bestaand, seed) {
  if ((bestaand.startdataVersie || 0) >= STARTDATA_VERSIE) return { data: bestaand, gewijzigd: false };
  const next = { ...bestaand, startdataVersie: STARTDATA_VERSIE };
  AANVUL_SECTIES.forEach(sleutel => {
    if (isLeegVeld(next[sleutel]) && !isLeegVeld(seed[sleutel])) next[sleutel] = seed[sleutel];
  });
  next.posities = (bestaand.posities || []).map(p => {
    const bron = (seed.posities || []).find(x => x.ticker === p.ticker);
    if (!bron) return p;
    const patch = {};
    AANVUL_POSITIEVELDEN.forEach(v => {
      if (isLeegVeld(p[v]) && !isLeegVeld(bron[v])) patch[v] = bron[v];
    });
    return Object.keys(patch).length > 0 ? { ...p, ...patch } : p;
  });
  return { data: next, gewijzigd: true };
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
      { id: uid(), naam: "Danaher", ticker: "DHR", sector: "Life sciences tools", cluster: "Healthcare", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", verkoopTrigger: "210", notitie: "Verkoop-trigger $210,00. Bij de laatste check uit de export (datum onbekend) stond de koers op $211,74, dus de trigger was toen geraakt — vul de actuele koers in via Snel bijwerken.", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "Boston Scientific", ticker: "BSX", sector: "Medtech", cluster: "Healthcare", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "Freeman-Shor-kandidaat uit eerdere analyse, inmiddels gekocht", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "Salesforce", ticker: "CRM", sector: "Enterprise software (CRM)", cluster: "Tech/AI", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", verkoopTrigger: "226.92", notitie: "Verkoop-trigger $226,92 (was al eens actief).", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "GSK", ticker: "GSK.L", sector: "Healthcare/Pharma", cluster: "Healthcare", huidigeWaardeEur: "", aantalStuks: "36", gemAankoopprijs: "22.06", aankoopdatum: "2026-09-01", waarderingBijAankoop: "Forward P/E ~10-11x", notitie: "Vervanging voor Novo Nordisk, 1 sept 2026. ISIN GB00BN7SWP63 — let op: niet de oudere GB0009252882. Aankoopprijs in systeem is een SCHATTING, nog te verifiëren tegen de werkelijke orderbevestiging.", these: "Lage waardering (forward P/E ~10-11x) met 0% Britse bronbelasting en een gediversifieerde pijplijn (HIV, oncologie, vaccins). Management-guidance van 7-9% groei in core operating profit/EPS voor 2026 is bevestigd.", theseGebrokenTrigger: "Neerwaartse bijstelling van de 7-9% guidance, of een duidelijk versnelde HIV-patentdruk (normaal verwacht vanaf ~2028, dolutegravir).", ijkpunten: "", status: "intact", laatstGetoetst: "2026-09-01", actief: true },
      { id: uid(), naam: "Munich Re", ticker: "MUV2.DE", sector: "Financials/ESG (herverzekering)", cluster: "Klimaat/Duurzaamheid", huidigeWaardeEur: "", aantalStuks: "3", gemAankoopprijs: "521.07", aankoopdatum: "2026-09-01", waarderingBijAankoop: "P/E 9,5x", notitie: "3 stuks na 2e tranche (+1 @ €524, eigen trigger €500-510 geraakt)", these: "P/E 9,5x, 9,3%/jaar dividendgroei, klimaatverandering als structurele rugwind voor herverzekeraars.", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "2026-09-01", actief: true },
      { id: uid(), naam: "Ørsted", ticker: "ORSTED.CO", sector: "Offshore wind", cluster: "Klimaat/Duurzaamheid", huidigeWaardeEur: "", aantalStuks: "236", gemAankoopprijs: "22.19", notitie: "236 stuks na bijkoop (+48 @ €18,60). Dividendherstel gepland vanaf 2027.", these: "Operationeel sterk (EBITDA +8% H1 2026), het grootste risico (Amerikaanse bouwstops) is opgelost — 5 van 5 rechtszaken gewonnen. De -79% nettowinst in Q2 was een boekhoudkundige afwaardering, geen operationeel probleem.", theseGebrokenTrigger: "Aanhoudende operationele verslechtering, een gedwongen 'farm-down'-verkoop tegen slechte prijzen, of verdere onzekerheid rond de kredietbeoordeling (stopte samenwerking met S&P in aug 2026).", ijkpunten: "", status: "intact", laatstGetoetst: "2026-09-01", actief: true },
      { id: uid(), naam: "Veolia", ticker: "VIE.PA", sector: "Water/milieudiensten", cluster: "Klimaat/Duurzaamheid", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "Xylem", ticker: "XYL", sector: "Watertechnologie", cluster: "Klimaat/Duurzaamheid", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "ASR Nederland", ticker: "ASRNL.AS", sector: "Verzekeraar", cluster: "Financials", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", notitie: "", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
      { id: uid(), naam: "Toyota", ticker: "TM", sector: "Auto", cluster: "Overig", huidigeWaardeEur: "", aantalStuks: "", gemAankoopprijs: "", verkoopTrigger: "200", notitie: "Kleine positie. Verkoop-trigger $200,00 (was al eens actief).", these: "", theseGebrokenTrigger: "", ijkpunten: "", status: "intact", laatstGetoetst: "", actief: true },
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
    startdataVersie: STARTDATA_VERSIE,
    onderzochtAfgewezen: [
      { naam: "Linde", reden: "Grijs-gebied ESG (olie/gas-leveringen van industriële gassen) — bewust uitgesloten op eigen verzoek, wordt niet meer voorgelegd." },
      { naam: "Roche", reden: "Duur (P/E ~18x) en de slechtste fiscale lekkage die is onderzocht (35% Zwitserse bronbelasting, 20pp niet-verrekenbaar)." },
      { naam: "Nestlé", reden: "Governance-crisis (2 CEO-wissels) en controverses (babyvoeding-recall, suiker-kritiek)." },
      { naam: "EchoStar (ECHO)", reden: "Krimpende omzet, structureel verlieslatend, recente schuldherstructurering — faalt vrijwel alle 7 regels." },
      { naam: "IMAQ (International Media Acquisition Corp)", reden: "SPAC-huls zonder operaties, going-concern-waarschuwing, OTC-delisting, vrijwel onverhandelbaar (gemiddeld 2 aandelen dagvolume)." },
    ],
    preIpoVolgen: [
      { naam: "Mistral AI", status: "Privaat, Frans AI-lab. IPO als doel genoemd door de CEO, geen datum. Indirecte blootstelling via ASML (investeerder, ~11% belang) en Nvidia (chipleverancier)." },
      { naam: "Helion Energy", status: "Privaat, fusie-energie. Series G $465 mln (juni 2026), waardering $15,5 mrd. Microsoft-stroomcontract vanaf 2028." },
      { naam: "osapiens", status: "Privaat, ESG-compliance software. Series C $100 mln (jan 2026, BlackRock/Temasek), eerste Duitse unicorn van 2026." },
      { naam: "Besi", status: "WEL beursgenoteerd (NL0012866412). Sterk fundamenteel (regels 1-6 vrijwel allemaal ja), maar verdiept de bestaande AI/chip-concentratie i.p.v. te diversifiëren. Cyclisch risico (omzet -28,9% in de 2023-neergang)." },
    ],
    bronbelasting: [
      { land: "Verenigd Koninkrijk", posities: "GSK", tarief: "0%", lekkage: "Geen — het VK heft geen bronbelasting op dividend. Fiscaal gunstigste land in de portefeuille." },
      { land: "Verenigde Staten", posities: "Nvidia, Alphabet C, Danaher, Boston Scientific, Salesforce (+ BMY op de watchlist)", tarief: "30% statutair, 15% verdragstarief", lekkage: "Geen — volledig verrekenbaar via een W-8BEN-formulier bij de broker." },
      { land: "Denemarken", posities: "Ørsted (keert nu geen dividend uit)", tarief: "27% statutair, 15% verdragstarief", lekkage: "12 procentpunt niet-verrekenbaar; terug te vragen bij de Deense Skattestyrelsen, bekend als traag/bureaucratisch. Pas relevant zodra het dividend in 2027 hervat." },
      { land: "Zwitserland", posities: "Geen (Roche is overwogen, niet gekocht)", tarief: "35% statutair, 15% verdragstarief", lekkage: "20 procentpunt niet-verrekenbaar — slechtste profiel dat is onderzocht en mede-reden om Roche niet te kopen." },
    ],
    bronbelastingNietOnderzocht: "Nog niet onderzocht: Duitsland (Munich Re), Frankrijk (Veolia) en Nederland (ASML, ASR, VUSA, NT-fondsen; de Nederlandse dividendbelasting van 15% is doorgaans volledig verrekenbaar, maar er is geen aparte lekkage-analyse gemaakt).",
    openstaandeBeslissingen: [
      { onderwerp: "BMY-aankoopmoment", status: "Bewust uitgesteld i.v.m. transactiekosten bij kleine orders (€5 vast + 0,05% + 0,25% valutakosten). Wacht op de volgende kapitaalinstroom om te combineren." },
      { onderwerp: "Privé maandelijkse inleg (€100/maand, DEGIRO)", status: "Besproken, nog niet concreet: aanbeveling was één ETF (niet spreiden, DEGIRO kent geen fractionele aandelen), bij voorkeur Iers gedomicilieerd (IE-ISIN), accumulerend en strikt SRI-gescreend (bv. iShares MSCI World SRI). Nog geen DEGIRO-rekening bevestigd, nog geen fonds gekozen." },
      { onderwerp: "GSK-aankoopprijs verifiëren", status: "De aankoopprijs (€22,06) is een schatting — controleer tegen de orderbevestiging." },
      { onderwerp: "Novo Nordisk- en Vestas-verkoop aanvullen", status: "Prijs, datum en kosten van de verkopen ontbreken; voor Vestas ook de reden. Nodig voor correcte rapportage en de thesis-geschiedenis." },
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
    fetch("/api/beleggingen").then(r => r.json()).then(d => {
      if (!actief) return;
      // De server geeft bij een nog-nooit-opgeslagen stand een lege
      // structuur terug (correct 200 OK, geen netwerkfout) — dat is dus
      // GEEN moment om de .catch-fallback te raken. Een lege stand hier
      // betekent: eerste keer openen, dus de rijke startdata gebruiken
      // én meteen opslaan, zodat dit maar één keer hoeft te gebeuren.
      const isLeeg = (!d.posities || d.posities.length === 0) && (!d.watchlist || d.watchlist.length === 0) && (!d.cryptoPosities || d.cryptoPosities.length === 0);
      if (isLeeg) {
        const seed = LEEG_DATA();
        setData(seed);
        fetch("/api/beleggingen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(seed) }).catch(() => {});
      } else {
        // Bestaande gebruiker: vul nieuwe startdata (triggers, referentie-
        // secties) aan zonder iets te overschrijven, en sla dat eenmalig op.
        const { data: aangevuld, gewijzigd } = vulStartdataAan(d, LEEG_DATA());
        setData(aangevuld);
        if (gewijzigd) {
          fetch("/api/beleggingen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(aangevuld) }).catch(() => {});
        }
      }
    }).catch(() => setData(LEEG_DATA())).finally(() => { if (actief) setLaden(false); });
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
  const triggers = vindGeraakteTriggers(data.posities, data.watchlist);

  return (
    <>
      {(triggers.verkoop.length > 0 || triggers.koop.length > 0 || triggers.zonderKoers.length > 0) && (
        <div style={{ ...S.card, background: triggers.verkoop.length + triggers.koop.length > 0 ? "#FBEAEA" : "#FBF0E4", border: `1px solid ${triggers.verkoop.length + triggers.koop.length > 0 ? C.rood : C.oranje}44` }}>
          {triggers.verkoop.map(p => (
            <p key={p.id} style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: C.rood }}>🎯 Verkoop-trigger geraakt: {p.naam} (koers {p.huidigeKoers} ≥ trigger {p.verkoopTrigger})</p>
          ))}
          {triggers.koop.map(w => (
            <p key={w.id} style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: C.groen }}>🎯 Koop-trigger geraakt: {w.naam} (koers {w.huidigeKoers} ≤ trigger {w.koopTrigger})</p>
          ))}
          {triggers.zonderKoers.length > 0 && (
            <p style={{ margin: 0, fontSize: 11.5, color: C.text }}>
              ℹ️ {triggers.zonderKoers.length} {triggers.zonderKoers.length === 1 ? "trigger" : "triggers"} kan niet worden getoetst omdat de actuele koers ontbreekt ({triggers.zonderKoers.map(x => x.naam).join(", ")}) — vul die in via Posities → Snel bijwerken.
            </p>
          )}
        </div>
      )}
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

      <BeslissingenSectie data={data} />

      <div style={{ ...S.card, background: "#FBF0E4", border: `1px solid ${C.oranje}33` }}>
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.6 }}>
          ⚠️ Het dividend-cijfer (€923) stamt van 18 augustus; sindsdien zijn Novo en Vestas verkocht en GSK en een 2e Munich Re-tranche toegevoegd, dus het moet opnieuw berekend worden. Deze cijfers zijn een startpunt op basis van de laatst bekende stand (1 september 2026) — niet live. Werk ze bij zodra je een actuele stand hebt, bijvoorbeeld via een verse broker-export.
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
  const [koersen, setKoersen] = useState(() => Object.fromEntries(actief.map(p => [p.id, p.huidigeKoers || ""])));

  function opslaanAlles() {
    const bijgewerkt = posities.map(p => waardes[p.id] !== undefined
      ? { ...p, huidigeWaardeEur: waardes[p.id], huidigeKoers: koersen[p.id] ?? p.huidigeKoers ?? "" }
      : p);
    persist({ posities: bijgewerkt, laatstBijgewerkt: new Date().toISOString() });
    onKlaar();
  }

  return (
    <>
      <div style={{ ...S.card, background: C.accent, color: "#FFF" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>⚡ Snel bijwerken</p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.8)" }}>Vul de huidige waarde per positie in. Bij posities met een verkoop-trigger ook de actuele koers (in handelsvaluta) — dan toets de app de trigger voor je.</p>
      </div>

      <div style={S.card}>
        {actief.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.naam}</p>
              <p style={{ margin: 0, fontSize: 10.5, color: C.muted }}>{p.ticker}</p>
            </div>
            {naarGetal(p.verkoopTrigger) > 0 && (
              <div style={{ width: 84, flexShrink: 0 }}>
                <input type="number" placeholder={`koers (trigger ${p.verkoopTrigger})`} style={{ ...S.inp, padding: "10px 8px", fontSize: 12.5 }} value={koersen[p.id] ?? ""} onChange={e => setKoersen(k => ({ ...k, [p.id]: e.target.value }))} />
              </div>
            )}
            <div style={{ position: "relative", width: 110, flexShrink: 0 }}>
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
          {naarGetal(p.verkoopTrigger) > 0 && (
            isPrijsTriggerGeraakt(p.huidigeKoers, p.verkoopTrigger, "verkoop") === true
              ? <p style={{ margin: "6px 0 0", fontSize: 11.5, color: C.rood, fontWeight: 700 }}>🎯 Verkoop-trigger geraakt (koers {p.huidigeKoers} ≥ {p.verkoopTrigger})</p>
              : <p style={{ margin: "6px 0 0", fontSize: 11, color: C.muted }}>🎯 Verkoop-trigger {p.verkoopTrigger}{naarGetal(p.huidigeKoers) > 0 ? ` · koers ${p.huidigeKoers}, nog niet geraakt` : " · koers onbekend"}</p>
          )}
          {berekenZevenRegelsScore(p.zevenRegels).ingevuld > 0 && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: C.muted }}>✅ 7-regels: {berekenZevenRegelsScore(p.zevenRegels).ja} van {berekenZevenRegelsScore(p.zevenRegels).totaal} ja{p.esgCheck ? ` · ESG: ${p.esgCheck}` : ""}</p>
          )}
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
    aankoopdatum: item.aankoopdatum || "", waarderingBijAankoop: item.waarderingBijAankoop || "",
    huidigeKoers: item.huidigeKoers || "", verkoopTrigger: item.verkoopTrigger || "",
    esgCheck: item.esgCheck || "", zevenRegels: item.zevenRegels || {},
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
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Veld label="Aankoopdatum" type="date" value={form.aankoopdatum} onChange={v => update({ aankoopdatum: v })} /></div>
          <div style={{ flex: 1 }}><Veld label="Waardering bij aankoop" type="text" value={form.waarderingBijAankoop} onChange={v => update({ waarderingBijAankoop: v })} placeholder="bv. P/E 9,5x" /></div>
        </div>

        <div style={{ background: C.card, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 800, color: C.accent }}>🎯 Verkoop-trigger</p>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: C.muted }}>Koers en trigger in dezelfde valuta (bv. $ voor Amerikaanse aandelen).</p>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Veld label="Huidige koers" value={form.huidigeKoers} onChange={v => update({ huidigeKoers: v })} /></div>
            <div style={{ flex: 1 }}><Veld label="Verkoop-trigger" value={form.verkoopTrigger} onChange={v => update({ verkoopTrigger: v })} /></div>
          </div>
          {isPrijsTriggerGeraakt(form.huidigeKoers, form.verkoopTrigger, "verkoop") === true && (
            <p style={{ margin: 0, fontSize: 11.5, color: C.rood, fontWeight: 700 }}>⚠️ Trigger geraakt — de koers staat op of boven de verkoop-trigger.</p>
          )}
          {isPrijsTriggerGeraakt(form.huidigeKoers, form.verkoopTrigger, "verkoop") === false && (
            <p style={{ margin: 0, fontSize: 11, color: C.muted }}>Trigger nog niet geraakt.</p>
          )}
        </div>

        <div style={{ background: C.card, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 800, color: C.accent }}>✅ 7-regels kwaliteitscheck · {berekenZevenRegelsScore(form.zevenRegels).ja}/{ZEVEN_REGELS.length} ja</p>
          {ZEVEN_REGELS.map(regel => (
            <div key={regel.key} style={{ marginBottom: 8 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11.5 }}>{regel.label}</p>
              <div style={{ display: "flex", gap: 5 }}>
                {ZEVEN_REGELS_ANTWOORDEN.map(a => (
                  <button key={a} onClick={() => update({ zevenRegels: { ...form.zevenRegels, [regel.key]: form.zevenRegels[regel.key] === a ? "" : a } })}
                    style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: `1px solid ${C.border}`, background: form.zevenRegels[regel.key] === a ? C.accent : C.surf, color: form.zevenRegels[regel.key] === a ? "#FFF" : C.text, fontSize: 10.5, fontWeight: 600, cursor: "pointer" }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <label style={S.label}>ESG-check (geen fossiel/wapens/tabak/gokken)</label>
          <div style={{ display: "flex", gap: 5 }}>
            {["Ja", "Nee"].map(a => (
              <button key={a} onClick={() => update({ esgCheck: form.esgCheck === a ? "" : a })}
                style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: `1px solid ${C.border}`, background: form.esgCheck === a ? C.accent : C.surf, color: form.esgCheck === a ? "#FFF" : C.text, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                {a}
              </button>
            ))}
          </div>
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
          {naarGetal(w.koopTrigger) > 0 && (
            isPrijsTriggerGeraakt(w.huidigeKoers, w.koopTrigger, "koop") === true
              ? <p style={{ margin: "0 0 6px", fontSize: 11.5, color: C.groen, fontWeight: 700 }}>🎯 Koop-trigger geraakt (koers {w.huidigeKoers} ≤ {w.koopTrigger})</p>
              : <p style={{ margin: "0 0 6px", fontSize: 11, color: C.muted }}>🎯 Koop-trigger {w.koopTrigger}{naarGetal(w.huidigeKoers) > 0 ? ` · koers ${w.huidigeKoers}, nog niet geraakt` : " · koers onbekend"}</p>
          )}
          {w.these && <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>{w.these}</p>}
          {w.ijkpunten && <p style={{ margin: "6px 0 0", fontSize: 11, color: C.accentLicht }}>📍 {w.ijkpunten}</p>}
        </div>
      ))}

      {watchlist.length === 0 && <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 30 }}>Nog niets op de watchlist.</p>}

      <ReferentieLijst titel="🚫 Onderzocht, maar afgewezen" kleur={C.muted} items={data.onderzochtAfgewezen} tekstVeld="reden" />
      <ReferentieLijst titel="🔭 Pre-IPO / te volgen" kleur={C.accent} items={data.preIpoVolgen} tekstVeld="status" />

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
    huidigeKoers: item.huidigeKoers || "", koopTrigger: item.koopTrigger || "",
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

        <div style={{ background: C.card, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 800, color: C.accent }}>🎯 Koop-trigger</p>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Veld label="Huidige koers" value={form.huidigeKoers} onChange={v => update({ huidigeKoers: v })} /></div>
            <div style={{ flex: 1 }}><Veld label="Koop-trigger" value={form.koopTrigger} onChange={v => update({ koopTrigger: v })} /></div>
          </div>
          {isPrijsTriggerGeraakt(form.huidigeKoers, form.koopTrigger, "koop") === true && (
            <p style={{ margin: 0, fontSize: 11.5, color: C.groen, fontWeight: 700 }}>✅ Trigger geraakt — de koers staat op of onder de koop-trigger.</p>
          )}
        </div>

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

function ReferentieLijst({ titel, kleur, items, tekstVeld }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={S.card}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: kleur }}>{titel}</h3>
      {items.map((item, i) => (
        <div key={i} style={{ padding: "7px 0", borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700 }}>{item.naam}</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{item[tekstVeld]}</p>
        </div>
      ))}
    </div>
  );
}

function BeslissingenSectie({ data }) {
  const items = data.openstaandeBeslissingen || [];
  if (items.length === 0) return null;
  return (
    <div style={S.card}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 800, color: C.accent }}>🧭 Openstaande beslissingen</h3>
      {items.map((item, i) => (
        <div key={i} style={{ padding: "7px 0", borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700 }}>{item.onderwerp}</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{item.status}</p>
        </div>
      ))}
    </div>
  );
}

function BronbelastingSectie({ data }) {
  const landen = data.bronbelasting || [];
  if (landen.length === 0) return null;
  return (
    <div style={S.card}>
      <h3 style={{ margin: "0 0 4px", fontSize: 13.5, fontWeight: 800, color: C.accent }}>🌍 Bronbelasting per land</h3>
      <p style={{ margin: "0 0 8px", fontSize: 11, color: C.muted }}>Alleen landen die daadwerkelijk zijn onderzocht.</p>
      {landen.map((l, i) => (
        <div key={i} style={{ padding: "7px 0", borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700 }}>{l.land} <span style={{ fontWeight: 500, color: C.muted }}>· {l.tarief}</span></p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>{l.posities}</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, lineHeight: 1.5 }}>{l.lekkage}</p>
        </div>
      ))}
      {data.bronbelastingNietOnderzocht && <p style={{ margin: "8px 0 0", fontSize: 11, color: C.oranje, lineHeight: 1.5 }}>ℹ️ {data.bronbelastingNietOnderzocht}</p>}
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

      <BronbelastingSectie data={data} />
    </>
  );
}
