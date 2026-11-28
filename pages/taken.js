// ════════════════════════════════════════════════════════════════════
// TAKEN — vervanger van Microsoft To Do (dat op 30 juni 2027 stopt).
//
// Twee ruimtes:
//  • Thuis — de gedeelde to-do-lijsten uit Lijsten (zelfde data, dus ook
//    daar gewoon zichtbaar en bewerkbaar).
//  • Werk  — per persoon, afgeschermd met een eigen pincode. Pepijn ziet
//    alleen zijn eigen werkruimte, Tessa alleen de hare.
//
// Slimme overzichten over beide ruimtes heen: Mijn dag, Belangrijk,
// Gepland en Aan mij toegewezen. Verder: herinneringen op een tijdstip
// (pushmelding), uitgebreide herhaling, klanten/projecten, snel invoeren in
// gewoon Nederlands, taken via e-mail en plakken vanuit een andere app.
// ════════════════════════════════════════════════════════════════════
import { laadPdfjs } from "../lib/pdf-worker";
import { normAfwezigheid, herkenAfwezigheid, afwezigOpDatum, komendeAfwezigheden, afwezigheidConflicten, isAfwezigOp, noemtPersoon } from "../lib/afwezigheid-logica";
import { callActiepunten, callsVan, callTakenVan, callSamenvatting, bewaarCallInProject, verwijderCall, momentTijd, callVoorMoment, isDraaiMoment, verzetMoment, faseVoorDatum, synchroniseerMomentMetCall } from "../lib/calls-logica";
import React, { useState, useEffect, useRef, useMemo, createContext, useContext } from "react";
import Link from "next/link";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  Sun, Star, CalendarDays, User, Bell, Repeat, Lock, Mail, Copy, Tag, ChevronLeft, ChevronRight,
  ChevronDown, Plus, X, Check, Mic, Square, Pencil, Trash2, Briefcase, Home, Upload, ArrowRightLeft, KeyRound, Download, Send,
} from "lucide-react";
import {
  vandaagStr, plusDagen, volgendeWerkdag, isoWeekdag, normaliseerHerhaling, herhalingLabel, vinkTaak, isInMijnDag,
  groepeerGepland, sorteerTaken, planDatum, ontleedSnelleInvoer, splitsTaken, ontleedPlakImport, nieuweTaak, isGeldigePin,
} from "../lib/taken-logica";
import {
  FASES, SOORTEN, STANDAARD_SJABLONEN, maakProjectUitSjabloon, maakLosProject, registreerGebruik, verschuifProject, projectVoortgang,
  berekenLeerVoorstellen, pasLeerVoorstellenToe, sorteerStappen, normaliseerStap, offsetTekst, timingHint, stapDatum,
  projectStatus, maakOfferte, offerteAkkoord, offerteAfgewezen, offerteNagevraagd, offerteStatistiek,
  ONDERDELEN, standaardOnderdelen, standaardMeetings, pasOnderdelenToe, telVerdwijnendeTaken,
  onderdeelVan, BEZETTING_STATUS, EENHEDEN, nieuweBezetting, leesBedragInvoer, synchroniseerCrewStappen, bezettingSamenvatting,
  onthoudContact, contactSuggesties, prijsTekst,
  DELIVERABLE_KANALEN, FORMATEN, STANDAARD_FORMATEN, normaliseerDeliverables, deliverablesTekst,
  BUYOUT_MEDIA, BUYOUT_DUUR, buyoutSoort, standaardBuyouts, buyoutEinde,
  leesPlanningUitTaken, onthoudPlanningNamen, planningSuggesties, synchroniseerBuyoutHerinneringen, buyoutStart,
  draaidagenVan, zetDraaidagen, projectBegroting, normaliseerMarge, margeStatus, kostenPlafond, bezettingKosten, kiesSjabloon,
  maakAanvraag, aanvraagNaarOfferte, zetOfferteDeadline, pasOpzetToe, standaardOpzet, PRELIGHT, postOnderdeelIds,
  isWeekend, isVrijeDag, feestdagNaam, naarWerkdag, plusWerkdagen, tijdMin, isVastePlanning, schuifPlanning,
  schuifKeten, zetAfhankelijkheid, zetWachtDagen, leidAfhankelijkhedenAf, spelingVan, opvolgersVan,
} from "../lib/projecten-logica";
import { leesIntake, herkenUitOfferte, datumKortNl } from "../lib/intake-logica";
import { offerteVersies, openVersies, gekozenVersie, vergelijkOffertes, voegOfferteVersieToe, kiesOfferteVersie, synchroniseerPlekken } from "../lib/offerte-versies-logica";
import { leesOfferte, regelsUitOffertePdf, maakKostenWerkboek, kostenBestandsnaam, compacteSpecificatie, specificatieStand, korteProjectnaam, vulBezettingUitOfferte, werkelijkUitBezetting, eigenPostSleutels, postNaamSleutel, maakNacalculatie, nacalculatieInzichten, inzichtenVoorOfferte, projectCijfers, cijferJaren } from "../lib/offerte-pdf-logica";

// Marge-doel (standaard minimaal 20%, streven 25%), overal in de projecten nodig.
const MargeContext = createContext({ minimum: 20, doel: 25, zet: () => {} });
const MARGE_KLEUR = { goed: "#2D4A3E", krap: "#C97D0C", "te-laag": "#C0392B" };
import {
  bouwCallsheet, callsheetGeheugen, samenvatting as callsheetSamenvatting, maakCallsheetWerkboek, callsheetBestandsnaam,
  datumLang,
} from "../lib/callsheet-logica";
import { dagenTussen } from "../lib/taken-logica";

// ── Stijl (zelfde palet als de rest van Ons Huishouden) ─────────────
const C = {
  bg: "#FAF6F0", kaart: "#FFFFFF", rand: "#EFE9DC", rand2: "#E4DCCB", tekst: "#2D2A26", groen: "#2D4A3E",
  terra: "#C86E4A", muted: "#8C8576", licht: "#B8B2A8", oranje: "#C97D0C", rood: "#C0392B", blauw: "#2C6E8C",
};
const S = {
  app: { minHeight: "100vh", background: C.bg, color: C.tekst, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, Roboto, sans-serif" },
  header: { padding: "22px 16px 10px", display: "flex", alignItems: "center", gap: 8, maxWidth: 720, margin: "0 auto" },
  main: { padding: "4px 16px 150px", maxWidth: 720, margin: "0 auto" },
  titel: { margin: 0, fontSize: 24, fontWeight: 700, color: C.groen, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  kaart: { background: C.kaart, border: `1px solid ${C.rand}`, borderRadius: 16, overflow: "hidden", marginBottom: 14 },
  sectieKop: { fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "18px 4px 8px", display: "flex", alignItems: "center", gap: 6 },
  rij: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: `1px solid #F3EEE3`, cursor: "pointer", background: "none", border: "none", width: "100%", textAlign: "left", font: "inherit", color: "inherit" },
  inp: { background: C.bg, border: `1px solid ${C.rand2}`, borderRadius: 12, padding: "11px 14px", fontSize: 16, width: "100%", boxSizing: "border-box", color: C.tekst, fontFamily: "inherit" },
  knop: (bg = C.groen, kl = "#FAF6F0") => ({ background: bg, color: kl, border: "none", borderRadius: 12, padding: "11px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }),
  chip: (aan) => ({ border: `1px solid ${aan ? C.groen : C.rand2}`, background: aan ? C.groen : C.bg, color: aan ? "#FAF6F0" : C.tekst, borderRadius: 999, padding: "7px 12px", fontSize: 13, cursor: "pointer", fontWeight: aan ? 700 : 400, fontFamily: "inherit", whiteSpace: "nowrap" }),
  label: { fontSize: 12, color: C.muted, fontWeight: 700, margin: "16px 0 6px", display: "flex", alignItems: "center", gap: 6 },
  sheetAchter: { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  sheet: { background: C.kaart, width: "100%", maxWidth: 720, maxHeight: "90vh", overflowY: "auto", padding: "18px 18px 34px", borderTopLeftRadius: 22, borderTopRightRadius: 22, boxSizing: "border-box" },
  hint: { fontSize: 12, color: C.muted, margin: "6px 0 0", lineHeight: 1.45 },
};
const KLANT_KLEUREN = ["#2D4A3E", "#C86E4A", "#2C6E8C", "#8A6FB0", "#C97D0C", "#4A7A6B", "#D6336C", "#7A2E3B"];
const LIJST_ICONEN = ["📋", "✅", "🏠", "🧹", "🔧", "🛠️", "💼", "📞", "🎬", "📷", "🎨", "💡", "📚", "🧾", "🚗", "🎁", "🌱", "🧒", "📥", "⭐"];
const TOEWIJSBAAR = ["Pepijn", "Tessa", "Jimmy"];
const SLIM = {
  mijndag: { label: "Mijn dag", icoon: Sun, kleur: C.oranje },
  belangrijk: { label: "Belangrijk", icoon: Star, kleur: C.terra },
  gepland: { label: "Gepland", icoon: CalendarDays, kleur: C.blauw },
  aanmij: { label: "Aan mij toegewezen", icoon: User, kleur: C.groen },
};
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function datumKort(s) {
  if (!s) return "";
  const v = vandaagStr();
  if (s === v) return "Vandaag";
  if (s === plusDagen(v, 1)) return "Morgen";
  if (s === plusDagen(v, -1)) return "Gisteren";
  const [j, m, d] = s.split("-").map(Number);
  return new Date(j, m - 1, d).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}
function herinneringKort(h) {
  if (!h) return "";
  return `${datumKort(h.slice(0, 10))} ${h.slice(11, 16)}`;
}
function nieuweLijstObject(naam, icoon, extra = {}) {
  return {
    id: uid(), name: naam, icon: icoon, type: "todo",
    categories: [{ id: "taken", label: "Taken", icon: "📌" }],
    items: [], history: {}, favorites: [], archief: [], createdAt: Date.now(), ...extra,
  };
}
async function kopieer(tekst) {
  try { await navigator.clipboard.writeText(tekst); return true; } catch {
    try {
      const t = document.createElement("textarea");
      t.value = tekst; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); return true;
    } catch { return false; }
  }
}
function base64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from([...window.atob(b64)].map(c => c.charCodeAt(0)));
}

// ════════════════════════════════════════════════════════════════════
export default function TakenApp() {
  const router = useRouter();
  const [ik, setIk] = useState(null);
  const [status, setStatus] = useState(null);
  const [thuisAlle, setThuisAlle] = useState([]);
  const [werk, setWerk] = useState(null); // { lists, klanten, instellingen }
  const [werkStaat, setWerkStaat] = useState("laden"); // laden | geen-naam | geen-pin | vergrendeld | open
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState(null);
  const [weergave, setWeergave] = useState({ soort: "overzicht" }); // | {soort:"slim", id} | {soort:"lijst", ruimte, listId}
  const [ruimteFilter, setRuimteFilter] = useState("werk"); // standaard Werk
  const [klantFilter, setKlantFilter] = useState(null);
  const [detail, setDetail] = useState(null); // { ruimte, listId, itemId }
  const [sheet, setSheet] = useState(null); // nieuweLijst | pin | mail | klanten | import | lijstMenu
  const [pinModus, setPinModus] = useState("ontgrendel");
  const [toast, setToast] = useState(null);
  const [mailInfo, setMailInfo] = useState(null);
  const [meldingen, setMeldingen] = useState("onbekend");
  const [voltooidOpen, setVoltooidOpen] = useState(false);
  const [suggestiesOpen, setSuggestiesOpen] = useState(false);
  const thuisRef = useRef([]);
  const werkRef = useRef(null);
  const lastWriteRef = useRef(0);
  const chronoRef = useRef(null);
  const deepLinkKlaar = useRef(false);
  const vandaag = vandaagStr();

  thuisRef.current = thuisAlle;
  werkRef.current = werk;

  const thuisLijsten = useMemo(() => thuisAlle.filter(l => l.type === "todo"), [thuisAlle]);
  const werkLijsten = werk?.lists || [];
  const klanten = (werk?.klanten || []).filter(k => !k.gearchiveerd);
  const klantVan = (id) => (werk?.klanten || []).find(k => k.id === id);
  // Nog nooit iets aan de sjablonen veranderd? Dan gelden de standaard-
  // sjablonen (klein/groot commercial); bij de eerste wijziging worden ze
  // als eigen kopie opgeslagen en vanaf dan aangepast/bijgeleerd.
  const sjablonen = werk?.sjablonen || STANDAARD_SJABLONEN;

  function bewaarSjablonen(next) {
    const w = { ...werkRef.current, sjablonen: next };
    werkRef.current = w; setWerk(w); lastWriteRef.current = Date.now();
    post("/api/taken/werk", { sjablonen: next });
  }
  // Na het starten van een project: gekozen onderdelen omzetten in taken en
  // de keuze bij het sjabloon onthouden (volgende keer staat dat weer aan).
  // Contactenboek: namen + prijsafspraken, onthouden over projecten heen.
  const contacten = werk?.contacten || [];
  // Afwezigheid (vakanties) van klanten, crew en cast.
  const afwezigheden = werk?.afwezigheden || [];
  function bewaarAfwezigheden(next) {
    const w = { ...werkRef.current, afwezigheden: next };
    werkRef.current = w; setWerk(w); lastWriteRef.current = Date.now();
    post("/api/taken/werk", { afwezigheden: next });
  }
  const afwezigNamen = [...new Set([
    ...contacten.map(c => c.naam), ...werkLijsten.flatMap(l => (l.project?.calls || []).map(c => c.met)),
    ...werkLijsten.flatMap(l => (l.items || []).flatMap(i => (i.bezetting || []).map(b => b.naam))),
  ].filter(Boolean).map(s => String(s).trim()))].slice(0, 200);
  function onthoud(bezetting, lijst) {
    const { contacten: next, contactId } = onthoudContact(werkRef.current?.contacten || [], bezetting, {
      projectId: lijst?.id, projectNaam: lijst?.name, datum: vandaag, nieuwId: uid,
    });
    const w = { ...werkRef.current, contacten: next };
    werkRef.current = w; setWerk(w); lastWriteRef.current = Date.now();
    post("/api/taken/werk", { contacten: next });
    return contactId;
  }
  function startMetOnderdelen(lijst, sjabloon, opties) {
    const metOnderdelen = pasOnderdelenToe(lijst, opties.onderdelen || [], {
      draaidag: opties.draaidag, opleverdatum: opties.opleverdatum, vandaag, meetings: opties.meetings || {}, deliverables: opties.deliverables || {},
      eigenPlanning: opties.eigenPlanning || [],
      verledenNaarVandaag: opties.verledenNaarVandaag, wie: ik, nieuwId: uid,
    });
    zetLijst("werk", metOnderdelen);
    bewaarSjablonen(registreerGebruik(sjablonen, sjabloon.id).map(t => (t.id === sjabloon.id
      ? onthoudPlanningNamen({ ...t, laatsteOnderdelen: opties.onderdelen || [], onderdelenBekend: metOnderdelen.project.onderdelenBekend, laatsteDeliverables: normaliseerDeliverables(opties.deliverables) }, opties.eigenPlanning)
      : t)));
    return metOnderdelen;
  }
  // ── Callsheets ────────────────────────────────────────────────────
  // Per draaidag bewaard in het project; wat per klant / per werkruimte
  // hetzelfde blijft wordt onthouden voor de volgende callsheet.
  function bewaarCallsheet(listId, dagId, opgeslagen, cs, { onthoudNotes = false } = {}) {
    wijzigLijst("werk", listId, l => ({ ...l, project: { ...l.project, callsheets: { ...(l.project.callsheets || {}), [dagId]: opgeslagen } } }));
    const geh = callsheetGeheugen(cs);
    const lijst = lijstVan("werk", listId);
    const klantId = lijst?.project?.klantId;
    let w = werkRef.current;
    if (klantId) {
      const klantenNu = (w?.klanten || []).map(k => (k.id === klantId ? { ...k, callsheet: { ...(k.callsheet || {}), ...geh.klant } } : k));
      w = { ...w, klanten: klantenNu };
      post("/api/taken/werk", { klanten: klantenNu });
    }
    const ins = { ...(w?.callsheet || {}), productieLogoId: geh.werkruimte.productieLogoId || w?.callsheet?.productieLogoId || null, ...(onthoudNotes ? { notes: opgeslagen.notes } : {}) };
    w = { ...w, callsheet: ins };
    werkRef.current = w; setWerk(w); lastWriteRef.current = Date.now();
    post("/api/taken/werk", { callsheet: ins });
  }
  const marge = normaliseerMarge(werk?.projectInstellingen?.marge);
  // Zodra de werkruimte open is: PDF-lezer en Excel-maker alvast op de
  // achtergrond laden, zodat de service worker ze bewaart en ze ook zonder
  // internet werken (op set, in het buitenland). Niet bij databesparing.
  const werkOpen = !!werk;
  useEffect(() => {
    if (!werkOpen || typeof window === "undefined" || navigator.connection?.saveData) return;
    const t = setTimeout(() => {
      laadPdfjs().then(p => fetch(p.GlobalWorkerOptions.workerSrc)).catch(() => {});
      import("exceljs").catch(() => {});
    }, 8000);
    return () => clearTimeout(t);
  }, [werkOpen]);
  function zetMarge(m) {
    const pi = { ...(werkRef.current?.projectInstellingen || {}), marge: normaliseerMarge(m) };
    const w = { ...werkRef.current, projectInstellingen: pi };
    werkRef.current = w; setWerk(w); lastWriteRef.current = Date.now();
    post("/api/taken/werk", { projectInstellingen: pi });
  }
  // Nacalculatie van een project met ingelezen offerte (werkelijk = ingevuld
  // per post, anders uit de namen + prijsafspraken; eigen werk telt niet als kosten).
  function nacalculatieVan(l) {
    const o = l?.project?.offerte;
    if (!o?.specificatie) return null;
    const werkelijk = { ...werkelijkUitBezetting(l, o.specificatie), ...(o.werkelijk || {}) };
    const eigen = eigenPostSleutels(o.specificatie, o.eigen || {}, werkRef.current?.projectInstellingen?.eigenPosten || {});
    return maakNacalculatie(o.specificatie, werkelijk, eigen, { datum: vandaag });
  }
  const inzichten = useMemo(() => nacalculatieInzichten(werk?.lists || []), [werk?.lists]);
  function zetEigenGeleerd(naamSleutel, waarde) {
    const pi = { ...(werkRef.current?.projectInstellingen || {}) };
    pi.eigenPosten = { ...(pi.eigenPosten || {}), [naamSleutel]: waarde };
    const w = { ...werkRef.current, projectInstellingen: pi };
    werkRef.current = w; setWerk(w); lastWriteRef.current = Date.now();
    post("/api/taken/werk", { projectInstellingen: pi });
  }
  function bewaarCallsheetInstellingen(velden) {
    const ins = { ...(werkRef.current?.callsheet || {}), ...velden };
    const w = { ...werkRef.current, callsheet: ins };
    werkRef.current = w; setWerk(w); lastWriteRef.current = Date.now();
    post("/api/taken/werk", { callsheet: ins });
  }
  function voegLogoToe(logo) {
    const logos = [...(werkRef.current?.logos || []), { id: uid(), ...logo }];
    const w = { ...werkRef.current, logos };
    werkRef.current = w; setWerk(w); lastWriteRef.current = Date.now();
    post("/api/taken/werk", { logos });
    return logos[logos.length - 1].id;
  }
  // Na de start: opzet (draaidagen, prelight, post) toepassen en de notities
  // van het eerste gesprek (als die bij de start zijn ingevuld) bewaren.
  function rondStartAf(lijst, opties) {
    let l = pasOpzetToe(lijst, opties.opzet || {}, { vandaag, wie: ik, nieuwId: uid });
    if (opties.intakeTekst) {
      l = { ...l, project: { ...l.project, intake: { tekst: opties.intakeTekst, datum: vandaag },
        ...(opties.budget != null && l.project.budget == null && l.project.offerte?.bedrag == null ? { budget: opties.budget } : {}),
        ...(opties.liveDatum && !l.project.liveDatum ? { liveDatum: opties.liveDatum } : {}) } };
    }
    if (l.project.offerte?.specificatie) l = vulBezettingUitOfferte(l, l.project.offerte.specificatie, { nieuwId: uid }).lijst;
    // Afhankelijkheden voorstellen op basis van de volgorde (keten-planning).
    if (l.project.sjabloonId) l = leidAfhankelijkhedenAf(l).lijst;
    zetLijst("werk", l);
    return l;
  }
  // Bestaand project: rollen uit de offerte aanzetten en open plekken maken.
  function vulPlekkenUitOfferte(listId) {
    const l0 = lijstVan("werk", listId);
    const spec = l0?.project?.offerte?.specificatie;
    if (!spec) return;
    const probeer = vulBezettingUitOfferte(l0, spec, { nieuwId: uid });
    const nodig = probeer.nodigeOnderdelen.filter(id => !(l0.project.onderdelen || []).includes(id));
    const plan = leesPlanningUitTaken(l0);
    const l1 = nodig.length
      ? pasOnderdelenToe(l0, [...(l0.project.onderdelen || []), ...nodig], { vandaag, meetings: plan.meetings, wie: ik, nieuwId: uid })
      : l0;
    const r = vulBezettingUitOfferte(l1, spec, { nieuwId: uid });
    zetLijst("werk", r.lijst);
    meld(`👥 ${r.toegevoegd} plekken klaargezet uit de offerte${nodig.length ? ` (${nodig.length} onderdelen aangezet)` : ""}`);
  }
  function maakKlant(naam) {
    const k = { id: uid(), naam: naam.trim(), kleur: KLANT_KLEUREN[(werkRef.current?.klanten || []).length % KLANT_KLEUREN.length] };
    const next = { ...werkRef.current, klanten: [...(werkRef.current?.klanten || []), k] };
    werkRef.current = next; setWerk(next); lastWriteRef.current = Date.now();
    post("/api/taken/werk", { klanten: next.klanten });
    return k.id;
  }

  function meld(tekst, ongedaan = null) {
    setToast({ tekst, ongedaan });
    clearTimeout(meld.t);
    meld.t = setTimeout(() => setToast(null), ongedaan ? 5000 : 2600);
  }

  // ── Laden + elke 5 s verversen (behalve vlak na een eigen wijziging) ──
  async function laadThuis() {
    const r = await fetch("/api/lijsten");
    if (!r.ok) throw new Error("thuis");
    const d = await r.json();
    return d.lists || [];
  }
  async function laadWerk() {
    const r = await fetch("/api/taken/werk");
    if (r.status === 423) { const d = await r.json(); return { staat: d.pinIngesteld ? "vergrendeld" : "geen-pin" }; }
    if (r.status === 403) return { staat: "geen-naam" };
    if (!r.ok) throw new Error("werk");
    return { staat: "open", data: await r.json() };
  }
  async function verversAlles(eerste = false) {
    if (!eerste && Date.now() - lastWriteRef.current < 5000) return;
    const gestart = Date.now();
    try {
      const [t, w] = await Promise.all([laadThuis(), laadWerk()]);
      if (lastWriteRef.current > gestart) return;
      setThuisAlle(t);
      setWerkStaat(w.staat);
      setWerk(w.staat === "open" ? w.data : null);
      setFout(null);
    } catch {
      if (eerste) setFout("Kon de taken niet laden. Controleer je verbinding.");
    } finally {
      if (eerste) setLaden(false);
    }
  }
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setIk(d?.user || null)).catch(() => {});
    fetch("/api/taken/status").then(r => r.json()).then(setStatus).catch(() => {});
    verversAlles(true);
    const iv = setInterval(() => verversAlles(false), 5000);
    // Datum-herkenning pas laden als de pagina er al staat (scheelt laadtijd).
    const t = setTimeout(() => { import("chrono-node").then(m => { chronoRef.current = m.nl; }).catch(() => {}); }, 300);
    if (typeof window !== "undefined") {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) setMeldingen("niet-ondersteund");
      else if (Notification.permission === "denied") setMeldingen("geweigerd");
      else navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(s => setMeldingen(s ? "aan" : "uit")).catch(() => setMeldingen("uit"));
    }
    return () => { clearInterval(iv); clearTimeout(t); };
  }, []);

  // Werkruimte open → e-mailadres alvast ophalen (staat ook op het overzicht).
  useEffect(() => {
    if (werkStaat !== "open") { setMailInfo(null); return; }
    fetch("/api/taken/mail").then(r => (r.ok ? r.json() : null)).then(d => d && setMailInfo(d)).catch(() => {});
  }, [werkStaat]);

  // Deep-links: ?weergave=mijndag, ?lijst=ID&ruimte=werk&taak=ID
  useEffect(() => {
    if (deepLinkKlaar.current || laden || !router.isReady) return;
    const { weergave: w, lijst, ruimte, taak } = router.query;
    if (typeof w === "string" && SLIM[w]) setWeergave({ soort: "slim", id: w });
    if (typeof lijst === "string") {
      const r = ruimte === "werk" ? "werk" : "thuis";
      const bron = r === "werk" ? werkLijsten : thuisLijsten;
      if (r === "werk" && werkStaat !== "open") { setPinModus(werkStaat === "geen-pin" ? "instellen" : "ontgrendel"); setSheet("pin"); return; }
      if (bron.some(l => l.id === lijst)) {
        setWeergave({ soort: "lijst", ruimte: r, listId: lijst });
        if (typeof taak === "string") setDetail({ ruimte: r, listId: lijst, itemId: taak });
      }
    }
    deepLinkKlaar.current = true;
  }, [laden, router.isReady, werkStaat, thuisLijsten, werkLijsten]);

  // ── Opslaan ───────────────────────────────────────────────────────
  // Opslaan gaat strikt één voor één, in volgorde. Anders kunnen twee snelle
  // wijzigingen (bv. "Nagevraagd" en direct daarna "Akkoord") tegelijk
  // onderweg zijn en overschrijft de oudste de nieuwste als die later aankomt.
  const opslagKetting = useRef(Promise.resolve());
  function post(url, body) {
    const stap = opslagKetting.current.then(() => postNu(url, body));
    opslagKetting.current = stap.catch(() => false);
    return stap;
  }
  async function postNu(url, body) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.status === 423) { setWerkStaat("vergrendeld"); setWerk(null); meld("🔒 Werkruimte is vergrendeld — ontgrendel opnieuw"); return false; }
      if (!r.ok) throw new Error();
      return true;
    } catch {
      meld("⚠️ Opslaan mislukt — controleer je verbinding");
      return false;
    }
  }
  function lijstVan(ruimte, listId) {
    return (ruimte === "werk" ? werkRef.current?.lists || [] : thuisRef.current).find(l => l.id === listId);
  }
  function zetLijst(ruimte, nieuwOrigineel, { verwijderd = false } = {}) {
    lastWriteRef.current = Date.now();
    // Projecten: "buy-out loopt af"-herinneringen altijd in de pas houden met
    // de namen, buy-outs en datums (een maand vóór het einde, 10:00).
    const nieuw = !verwijderd && nieuwOrigineel.project
      ? synchroniseerBuyoutHerinneringen(nieuwOrigineel, { nieuwId: uid, wie: ik })
      : nieuwOrigineel;
    // Taken die in déze wijziging zijn weggehaald expliciet meesturen; de
    // server bewaart anders taken die < 10 s geleden zijn toegevoegd (bedoeld
    // voor een ander toestel) en dan zou een net verwijderde taak terugkomen.
    const oud = lijstVan(ruimte, nieuw.id);
    const nieuweIds = new Set((nieuw.items || []).map(i => i.id));
    const deletedItemIds = verwijderd ? [] : (oud?.items || []).map(i => i.id).filter(id => !nieuweIds.has(id));
    if (ruimte === "thuis") {
      const huidig = thuisRef.current;
      const next = verwijderd ? huidig.filter(l => l.id !== nieuw.id) : huidig.some(l => l.id === nieuw.id) ? huidig.map(l => (l.id === nieuw.id ? nieuw : l)) : [...huidig, nieuw];
      thuisRef.current = next; setThuisAlle(next);
      post("/api/lijsten", verwijderd ? { lists: [], deletedListIds: [nieuw.id] } : { lists: [nieuw], deletedItemIds });
    } else {
      const w = werkRef.current || { lists: [], klanten: [] };
      const lists = verwijderd ? w.lists.filter(l => l.id !== nieuw.id) : w.lists.some(l => l.id === nieuw.id) ? w.lists.map(l => (l.id === nieuw.id ? nieuw : l)) : [...w.lists, nieuw];
      const next = { ...w, lists };
      werkRef.current = next; setWerk(next);
      post("/api/taken/werk", verwijderd ? { lists: [], deletedListIds: [nieuw.id] } : { lists: [nieuw], deletedItemIds });
    }
  }
  function wijzigLijst(ruimte, listId, fn) {
    const l = lijstVan(ruimte, listId);
    if (l) zetLijst(ruimte, fn(l));
  }
  function wijzigTaak(ruimte, listId, itemId, fn) {
    wijzigLijst(ruimte, listId, l => ({ ...l, items: (l.items || []).map(i => (i.id === itemId ? fn(i) : i)) }));
  }
  function zetVelden(ruimte, listId, itemId, velden) {
    wijzigTaak(ruimte, listId, itemId, i => ({ ...i, ...velden, lastActionBy: ik, lastActionAt: Date.now() }));
  }
  function vink(ruimte, listId, itemId) {
    const l = lijstVan(ruimte, listId);
    const i = l?.items?.find(x => x.id === itemId);
    if (!i) return;
    const herhalend = !i.checked && normaliseerHerhaling(i.herhaling);
    if (i.offerteNavraag && !i.checked) {
      // Offerte nagevraagd → volgende navraag over een week (of de gekozen periode).
      wijzigLijst(ruimte, listId, l => offerteNagevraagd({ ...l, items: l.items.map(x => (x.id === itemId ? vinkTaak(x, { wie: ik, vandaag }) : x)) }, vandaag));
      meld(`📨 Genoteerd — volgende keer navragen: ${datumKort(vinkTaak(i, { vandaag }).dueDate)}`);
      return;
    }
    wijzigTaak(ruimte, listId, itemId, x => vinkTaak(x, { wie: ik, vandaag }));
    if (herhalend) meld(`🔁 Klaar — volgende keer: ${datumKort(vinkTaak(i, { vandaag }).dueDate || vinkTaak(i, { vandaag }).herinnering?.slice(0, 10))}`);
  }
  function verwijderTaak(ruimte, listId, itemId) {
    const l = lijstVan(ruimte, listId);
    const i = l?.items?.find(x => x.id === itemId);
    if (!i) return;
    wijzigLijst(ruimte, listId, x => ({ ...x, items: x.items.filter(t => t.id !== itemId) }));
    setDetail(null);
    meld("🗑 Taak verwijderd", () => wijzigLijst(ruimte, listId, x => ({ ...x, items: [...x.items, i] })));
  }
  function verplaatsTaak(van, naar) { // { ruimte, listId, itemId } → { ruimte, listId }
    const bron = lijstVan(van.ruimte, van.listId);
    const doel = lijstVan(naar.ruimte, naar.listId);
    const taak = bron?.items?.find(i => i.id === van.itemId);
    if (!taak || !doel || (van.ruimte === naar.ruimte && van.listId === naar.listId)) return;
    const aangepast = {
      ...taak, category: doel.categories?.[0]?.id || null,
      klantId: naar.ruimte === "werk" ? taak.klantId : null,
      assignedTo: naar.ruimte === "thuis" ? taak.assignedTo : null,
    };
    zetLijst(van.ruimte, { ...bron, items: bron.items.filter(i => i.id !== taak.id) });
    zetLijst(naar.ruimte, { ...doel, items: [...(doel.items || []), aangepast] });
    setDetail({ ruimte: naar.ruimte, listId: naar.listId, itemId: taak.id });
    meld(`↪︎ Verplaatst naar ${doel.icon} ${doel.name}`);
  }
  // Standaard staat het filter op Werk; zonder (open) werkruimte → Alles.
  useEffect(() => {
    if (!["open", "laden"].includes(werkStaat) && ruimteFilter === "werk") setRuimteFilter("alles");
  }, [werkStaat]); // eslint-disable-line react-hooks/exhaustive-deps
  // Call-notities die op dit toestel staan maar (nog) niet op de server
  // (bv. opslaan mislukt zonder verbinding): bij het laden alsnog bewaren.
  const conceptenGecheckt = useRef(false);
  useEffect(() => {
    if (werkStaat !== "open" || !werk || conceptenGecheckt.current) return;
    conceptenGecheckt.current = true;
    let sleutels = [];
    try { sleutels = Object.keys(localStorage).filter(k => k.startsWith("call-concept:")); } catch { return; }
    let hersteld = 0;
    for (const k of sleutels) {
      const id = k.slice("call-concept:".length);
      const c = leesCallConcept(id);
      const weg = () => { try { localStorage.removeItem(k); } catch { /* niets */ } };
      if (!c?.listId) { weg(); continue; }
      const l = lijstVan("werk", c.listId);
      const bestaand = l?.project?.calls?.find(x => x.id === id);
      const heeftInhoud = !!(String(c.notities || "").trim() || String(c.met || "").trim());
      if (!l || (!bestaand && !heeftInhoud) || (bestaand && (bestaand.bijgewerktOp || 0) + 2000 >= c.t)) {
        if (!l || Date.now() - c.t > 2 * 86400000 || bestaand) weg();
        continue;
      }
      if (bestaand && bestaand.notities === c.notities && bestaand.met === c.met && bestaand.datum === c.datum) { weg(); continue; }
      zetLijst("werk", bewaarCallInProject(l, { id, datum: c.datum, met: c.met, notities: c.notities }, [], { nieuwId: uid, wie: ik }));
      hersteld++;
    }
    if (hersteld) meld(`📞 ${hersteld === 1 ? "Call-notities" : `${hersteld} calls`} van dit toestel alsnog bewaard`);
  }, [werkStaat, werk]); // eslint-disable-line react-hooks/exhaustive-deps
  // Alle lijsten waar je vanuit het +-paneel een taak heen kunt sturen.
  const doelen = useMemo(() => {
    // Groepen: losse werktaken (lijsten zonder project) · projecten · thuis.
    const uit = [];
    if (werkStaat === "open") {
      const los = werkLijsten.filter(l => !l.project);
      los.forEach(l => uit.push({ ruimte: "werk", groep: "werk", listId: l.id, label: `${l.icon || "💼"} ${l.name}`, lopendProject: false }));
      // Nog geen losse werklijst? Dan maakt de eerste losse taak er een aan.
      if (!los.some(l => !l.mailInbox)) uit.unshift({ ruimte: "werk", groep: "werk", listId: null, label: "💼 Taken (los)", lopendProject: false });
      werkLijsten.filter(l => l.project && !l.project.afgerond).forEach(l => {
        const st = projectStatus(l);
        uit.push({ ruimte: "werk", groep: "project", listId: l.id, label: `${l.icon || "🎬"} ${l.name}`, lopendProject: st !== "aanvraag" && st !== "offerte" });
      });
    }
    thuisLijsten.forEach(l => uit.push({ ruimte: "thuis", groep: "thuis", listId: l.id, label: `${l.icon || "✅"} ${l.name}`, lopendProject: false }));
    if (!thuisLijsten.some(l => !l.mailInbox)) uit.push({ ruimte: "thuis", groep: "thuis", listId: null, label: "✅ Taken", lopendProject: false });
    return uit;
  }, [werkLijsten, thuisLijsten, werkStaat]);
  function voegToeNaar(ruimte, listId, tekst, extra, label) {
    const id = listId || standaardLijst(ruimte).id;
    const doel = ruimte === "werk" ? lijstVan("werk", id) : null;
    if (doel?.project?.klantId && !extra.klantId) extra = { ...extra, klantId: doel.project.klantId };
    voegToe(ruimte, id, tekst, extra);
    meld(`✓ Toegevoegd aan ${label || "de lijst"}${extra?.dueDate ? ` · ${datumKort(extra.dueDate).toLowerCase()}` : ""}`);
  }
  function standaardLijst(ruimte) {
    const bron = ruimte === "werk" ? werkRef.current?.lists || [] : thuisRef.current.filter(l => l.type === "todo");
    const gewoon = bron.find(l => !l.mailInbox && !l.project);
    if (gewoon) return gewoon;
    const nieuw = nieuweLijstObject("Taken", ruimte === "werk" ? "💼" : "✅");
    zetLijst(ruimte, nieuw);
    return nieuw;
  }
  function voegToe(ruimte, listId, tekst, extraVelden = {}) {
    const slim = ontleedSnelleInvoer(tekst, chronoRef.current, new Date());
    const naam = slim.titel || tekst.trim();
    if (!naam) return;
    const doel = lijstVan(ruimte, listId);
    if (!doel) return;
    const taak = nieuweTaak({
      name: naam, category: doel.categories?.[0]?.id || null,
      dueDate: slim.dueDate, herinnering: slim.herinnering, herhaling: slim.herhaling, belangrijk: slim.belangrijk,
      ...extraVelden,
      ...(extraVelden.belangrijk || slim.belangrijk ? { belangrijk: true } : {}),
      ...(slim.dueDate && extraVelden.dueDate ? { dueDate: slim.dueDate } : {}),
    }, { wie: ik });
    zetLijst(ruimte, { ...doel, items: [...(doel.items || []), taak] });
    if (taak.herinnering && meldingen === "uit") meld("🔔 Herinnering gezet — zet meldingen aan op dit toestel om 'm te krijgen");
  }

  // ── Meldingen op dit toestel ─────────────────────────────────────
  async function zetMeldingenAan() {
    setMeldingen("bezig");
    try {
      const p = await Notification.requestPermission();
      if (p !== "granted") { setMeldingen(p === "denied" ? "geweigerd" : "uit"); return; }
      const sleutel = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!sleutel) { setMeldingen("uit"); meld("⚠️ Pushmeldingen zijn op deze deployment nog niet ingericht (VAPID-sleutels)"); return; }
      const reg = await navigator.serviceWorker.ready;
      const bestaand = await reg.pushManager.getSubscription();
      const sub = bestaand || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8Array(sleutel) });
      // Ook bij een bestaand abonnement opnieuw melden: dan weet de server
      // van wie dit toestel is (nodig voor werkherinneringen).
      await fetch("/api/push-subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub }) });
      setMeldingen("aan");
      meld("🔔 Meldingen staan aan op dit toestel");
    } catch {
      setMeldingen("uit");
      meld("⚠️ Meldingen aanzetten lukte niet");
    }
  }
  // Toestellen die al eerder (bv. via Abonnementen) meldingen aanzetten,
  // stilletjes koppelen aan de ingelogde persoon.
  useEffect(() => {
    if (meldingen !== "aan" || !ik) return;
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
      if (sub) fetch("/api/push-subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub }) });
    }).catch(() => {});
  }, [meldingen, ik]);

  // ── Alle taken met hun herkomst, voor de slimme overzichten ─────────
  const alleRegels = useMemo(() => {
    const regels = [];
    thuisLijsten.forEach(l => (l.items || []).forEach(item => regels.push({ ruimte: "thuis", lijst: l, item })));
    werkLijsten.forEach(l => (l.items || []).forEach(item => regels.push({ ruimte: "werk", lijst: l, item })));
    return regels;
  }, [thuisLijsten, werkLijsten]);
  const filterRuimte = (r) => ruimteFilter === "alles" || r.ruimte === ruimteFilter;
  const filterKlant = (r) => !klantFilter || (r.ruimte === "werk" && r.item.klantId === klantFilter);
  function regelsVoor(id) {
    const basis = alleRegels.filter(r => filterRuimte(r) && filterKlant(r));
    if (id === "mijndag") return basis.filter(r => isInMijnDag(r.item, vandaag));
    if (id === "belangrijk") return basis.filter(r => r.item.belangrijk && !r.item.checked);
    if (id === "aanmij") return basis.filter(r => r.ruimte === "thuis" && r.item.assignedTo === ik && !r.item.checked);
    if (id === "gepland") return basis.filter(r => !r.item.checked && planDatum(r.item));
    return basis;
  }
  // Aantallen op het overzicht: altijd over thuis én werk samen.
  const aantal = (id) => {
    const basis = alleRegels;
    if (id === "mijndag") return basis.filter(r => isInMijnDag(r.item, vandaag)).length;
    if (id === "belangrijk") return basis.filter(r => r.item.belangrijk && !r.item.checked).length;
    if (id === "aanmij") return basis.filter(r => r.ruimte === "thuis" && r.item.assignedTo === ik && !r.item.checked).length;
    return basis.filter(r => !r.item.checked && planDatum(r.item)).length;
  };

  // ═══════════════════════ RENDER ═══════════════════════════════════
  if (laden) {
    return <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: C.muted }}>Taken laden…</p></div>;
  }
  if (fout) {
    return (
      <div style={{ ...S.app, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
        <p style={{ fontWeight: 700, color: C.groen }}>{fout}</p>
        <button style={S.knop()} onClick={() => window.location.reload()}>Opnieuw proberen</button>
        <Link href="/" style={{ color: C.muted, fontSize: 13 }}>← Terug</Link>
      </div>
    );
  }

  const detailLijst = detail ? lijstVan(detail.ruimte, detail.listId) : null;
  const detailTaak = detailLijst?.items?.find(i => i.id === detail.itemId);

  return (
    <MargeContext.Provider value={{ ...marge, zet: zetMarge, eigenGeleerd: werk?.projectInstellingen?.eigenPosten || {}, zetEigenGeleerd, inzichten }}>
    <div style={S.app}>
      <Head><title>Taken — Ons Huishouden</title></Head>

      {weergave.soort === "overzicht" && (
        <Overzicht
          {...{ ik, status, thuisLijsten, werkLijsten, werkStaat, klanten, klantVan, mailInfo, meldingen, aantal, vandaag }}
          openNieuwProject={(sjabloonId) => setSheet({ soort: "nieuwProject", sjabloonId })}
          openLosProject={() => setSheet("losProject")}
          openOfferte={() => setSheet("offerte")}
          openAanvraag={() => setSheet("aanvraag")}
          openCijfers={() => setSheet("cijfers")}
          openBackup={() => setSheet("backup")}
          openAkkoord={(listId) => setSheet({ soort: "akkoord", listId })}
          openAfwijzen={(listId) => setSheet({ soort: "afwijzen", listId })}
          openSjablonen={() => setSheet("sjablonen")}
          open={(w) => { setKlantFilter(null); setWeergave(w); setVoltooidOpen(false); }}
          nieuweLijst={(ruimte) => setSheet({ soort: "nieuweLijst", ruimte })}
          openPin={(modus) => { setPinModus(modus); setSheet("pin"); }}
          openMail={() => setSheet("mail")}
          openKlanten={() => setSheet("klanten")}
          afwezigheden={afwezigheden}
          openAfwezigheid={(start) => setSheet({ soort: "afwezigheid", start: start || null })}
          openImport={() => setSheet("import")}
          zetMeldingenAan={zetMeldingenAan}
          vergrendel={async () => { await post("/api/taken/pin", { actie: "vergrendel" }); setWerk(null); setWerkStaat("vergrendeld"); meld("🔒 Werkruimte vergrendeld op dit toestel"); }}
          kopieerAdres={async () => { if (mailInfo?.adres && await kopieer(mailInfo.adres)) meld("📋 E-mailadres gekopieerd"); }}
        />
      )}

      {weergave.soort === "slim" && (
        <SlimOverzicht
          id={weergave.id} regels={regelsVoor(weergave.id)} alleRegels={alleRegels}
          {...{ ruimteFilter, setRuimteFilter, klantFilter, setKlantFilter, klanten, werkStaat, vandaag, suggestiesOpen, setSuggestiesOpen, klantVan, chronoRef, doelen, voegToeNaar }}
          standaardDoel={(() => {
            const r = ruimteFilter === "werk" && werkStaat === "open" ? "werk" : "thuis";
            const l = (r === "werk" ? werkLijsten : thuisLijsten).find(x => !x.mailInbox && !x.project);
            return { ruimte: r, listId: l ? l.id : null };
          })()}
          basisExtra={{
            ...(weergave.id === "mijndag" ? { mijnDag: vandaag } : weergave.id === "belangrijk" ? { belangrijk: true } : weergave.id === "aanmij" ? { assignedTo: ik } : weergave.id === "gepland" ? { dueDate: vandaag } : {}),
            ...(klantFilter ? { klantId: klantFilter } : {}),
          }}
          terug={() => setWeergave({ soort: "overzicht" })}
          vink={(r) => vink(r.ruimte, r.lijst.id, r.item.id)}
          ster={(r) => zetVelden(r.ruimte, r.lijst.id, r.item.id, { belangrijk: !r.item.belangrijk })}
          openTaak={(r) => setDetail({ ruimte: r.ruimte, listId: r.lijst.id, itemId: r.item.id })}
          naarMijnDag={(r) => { zetVelden(r.ruimte, r.lijst.id, r.item.id, { mijnDag: vandaag }); meld("☀️ Toegevoegd aan Mijn dag"); }}
          voegToe={(tekst) => {
            const ruimte = ruimteFilter === "werk" && werkStaat === "open" ? "werk" : "thuis";
            const lijst = standaardLijst(ruimte);
            const extra = weergave.id === "mijndag" ? { mijnDag: vandaag }
              : weergave.id === "belangrijk" ? { belangrijk: true }
              : weergave.id === "aanmij" ? { assignedTo: ik }
              : weergave.id === "gepland" ? { dueDate: vandaag } : {};
            if (ruimte === "werk" && klantFilter) extra.klantId = klantFilter;
            voegToe(ruimte, lijst.id, tekst, extra);
          }}
        />
      )}

      {weergave.soort === "lijst" && (() => {
        const lijst = lijstVan(weergave.ruimte, weergave.listId);
        if (!lijst) return <LegeStaat terug={() => setWeergave({ soort: "overzicht" })} tekst="Deze lijst bestaat niet meer." />;
        return (
          <LijstWeergave
            ruimte={weergave.ruimte} lijst={lijst}
            {...{ klanten, klantFilter, setKlantFilter, klantVan, voltooidOpen, setVoltooidOpen, vandaag, chronoRef, doelen, voegToeNaar }}
            sjabloon={lijst.project ? sjablonen.find(t => t.id === lijst.project.sjabloonId) : null}
            verschuif={(data) => {
              wijzigLijst(weergave.ruimte, lijst.id, l => verschuifProject(l, data));
              meld("📅 Planning verschoven — open taken schuiven mee");
            }}
            zetProject={(velden) => wijzigLijst(weergave.ruimte, lijst.id, l => ({ ...l, project: { ...l.project, ...velden } }))}
            openLeren={() => setSheet({ soort: "leren", listId: lijst.id })}
            openOnderdelen={() => setSheet({ soort: "onderdelen", listId: lijst.id })}
            openCall={(callId) => setSheet({ soort: "call", listId: lijst.id, callId: callId || uid() })}
            openPlanning={() => setSheet({ soort: "planning", listId: lijst.id })}
            afwezigheden={afwezigheden}
            zetDagen={(dagen) => { wijzigLijst(weergave.ruimte, lijst.id, l => zetDraaidagen(l, dagen, { nieuwId: uid, wie: ik })); meld("🎬 Draaidagen bijgewerkt"); }}
            openCallsheet={(dagId) => setSheet({ soort: "callsheet", listId: lijst.id, dagId })}
            openOfferteVanAanvraag={() => setSheet({ soort: "offerteVanAanvraag", listId: lijst.id })}
            meld={meld}
            vulPlekken={() => vulPlekkenUitOfferte(lijst.id)}
            openVersie={(soort) => setSheet({ soort: "offerteVersie", listId: lijst.id, versieSoort: soort })}
            zetDeadline={(datum) => { wijzigLijst("werk", lijst.id, l => zetOfferteDeadline(l, datum, { wie: ik })); meld(`📅 Offerte uiterlijk ${datumKort(datum).toLowerCase()}`); }}
            zetOpzet={(opzet) => {
              const wasExtern = lijst.project?.opzet?.postDoorOns === false;
              wijzigLijst(weergave.ruimte, lijst.id, l => pasOpzetToe(l, opzet, { vandaag, wie: ik, nieuwId: uid }));
              meld(opzet.postDoorOns && wasExtern ? "🎞️ Post weer bij ons — zet montage, grading en mix aan bij 🧩 Onderdelen" : "⚙️ Opzet bijgewerkt");
            }}
            openAkkoord={() => setSheet({ soort: "akkoord", listId: lijst.id })}
            openAfwijzen={() => setSheet({ soort: "afwijzen", listId: lijst.id })}
            nagevraagd={() => { const n = (lijst.items || []).find(i => i.offerteNavraag && !i.checked); if (n) vink("werk", lijst.id, n.id); }}
            terug={() => setWeergave({ soort: "overzicht" })}
            vink={(i) => vink(weergave.ruimte, lijst.id, i.id)}
            ster={(i) => zetVelden(weergave.ruimte, lijst.id, i.id, { belangrijk: !i.belangrijk })}
            openTaak={(i) => setDetail({ ruimte: weergave.ruimte, listId: lijst.id, itemId: i.id })}
            voegToe={(tekst, extra = {}) => voegToe(weergave.ruimte, lijst.id, tekst, {
              ...(weergave.ruimte === "werk" && (klantFilter || lijst.project?.klantId) ? { klantId: klantFilter || lijst.project.klantId } : {}),
              ...extra,
            })}
            wijzig={(velden) => wijzigLijst(weergave.ruimte, lijst.id, l => ({ ...l, ...velden }))}
            verwijder={() => {
              if (!window.confirm(`Lijst "${lijst.name}" met ${(lijst.items || []).length} taken verwijderen?`)) return;
              zetLijst(weergave.ruimte, lijst, { verwijderd: true });
              setWeergave({ soort: "overzicht" });
              meld("🗑 Lijst verwijderd");
            }}
            wisVoltooid={() => {
              const n = (lijst.items || []).filter(i => i.checked).length;
              if (!n || !window.confirm(`${n} voltooide ${n === 1 ? "taak" : "taken"} definitief weghalen?`)) return;
              wijzigLijst(weergave.ruimte, lijst.id, l => ({ ...l, items: l.items.filter(i => !i.checked) }));
            }}
          />
        );
      })()}

      {detailTaak && (
        <TaakDetail
          ruimte={detail.ruimte} lijst={detailLijst} taak={detailTaak}
          {...{ ik, klanten, status, meldingen, zetMeldingenAan, vandaag, thuisLijsten, werkLijsten, werkStaat }}
          sluit={() => setDetail(null)}
          zet={(velden) => zetVelden(detail.ruimte, detail.listId, detail.itemId, velden)}
          vink={() => vink(detail.ruimte, detail.listId, detail.itemId)}
          verwijder={() => verwijderTaak(detail.ruimte, detail.listId, detail.itemId)}
          verplaats={(naar) => verplaatsTaak(detail, naar)}
          nieuweKlant={maakKlant}
          contacten={contacten} onthoud={(b) => onthoud(b, detailLijst)}
          wijzigLaatste={(fn) => wijzigTaak(detail.ruimte, detail.listId, detail.itemId, i => ({ ...fn(i), lastActionBy: ik, lastActionAt: Date.now() }))}
        />
      )}

      {sheet?.soort === "nieuweLijst" && (
        <NieuweLijstSheet ruimte={sheet.ruimte} sluit={() => setSheet(null)} maak={(naam, icoon) => {
          const nieuw = nieuweLijstObject(naam, icoon);
          zetLijst(sheet.ruimte, nieuw);
          setSheet(null);
          setWeergave({ soort: "lijst", ruimte: sheet.ruimte, listId: nieuw.id });
        }} />
      )}
      {sheet === "pin" && (
        <PinSheet modus={pinModus} setModus={setPinModus} ik={ik} sluit={() => setSheet(null)}
          klaar={async () => { setSheet(null); lastWriteRef.current = 0; await verversAlles(true); }} />
      )}
      {sheet === "mail" && (
        <MailSheet ik={ik} info={mailInfo} setInfo={setMailInfo} sluit={() => setSheet(null)} meld={meld} />
      )}
      {sheet === "klanten" && (
        <KlantenSheet klanten={werk?.klanten || []} sluit={() => setSheet(null)} opslaan={(lijst) => {
          const next = { ...werkRef.current, klanten: lijst };
          werkRef.current = next; setWerk(next); lastWriteRef.current = Date.now();
          post("/api/taken/werk", { klanten: lijst });
        }} />
      )}
      {sheet?.soort === "offerteVersie" && (() => {
        const lijst = lijstVan("werk", sheet.listId);
        if (!lijst?.project) return null;
        return (
          <OfferteVersieSheet lijst={lijst} soort={sheet.versieSoort} vandaag={vandaag} sluit={() => setSheet(null)}
            maak={(velden) => {
              let l = voegOfferteVersieToe(lijstVan("werk", lijst.id), velden, { nieuwId: uid });
              const nieuw = l.project.offertes[l.project.offertes.length - 1];
              let extra = "";
              // Herziene offerte in een lopend project: plekken bijwerken.
              if (nieuw.status === "gekozen" && nieuw.specificatie && projectStatus(l) !== "offerte" && projectStatus(l) !== "aanvraag") {
                const r = synchroniseerPlekken(l, nieuw.specificatie, { nieuwId: uid });
                l = r.lijst;
                extra = [r.toegevoegd && `${r.toegevoegd} plekken erbij`, r.bijgewerkt && `${r.bijgewerkt} budgetten aangepast`, r.verwijderd && `${r.verwijderd} lege plekken weg`, r.vervallen && `⚠️ ${r.vervallen} met naam staan niet meer in de offerte`].filter(Boolean).join(", ");
              }
              zetLijst("werk", l);
              setSheet(null);
              meld(`${nieuw.soort === "revisie" ? "↻" : "＋"} ${nieuw.naam} vastgelegd${nieuw.wijzigingen ? ` — ${nieuw.wijzigingen.samenvatting}` : ""}${extra ? ` · ${extra}` : ""}`);
            }} />
        );
      })()}
      {sheet === "backup" && <BackupSheet sluit={() => setSheet(null)} meld={meld} naHerstel={() => { lastWriteRef.current = 0; verversAlles(true); }} />}
      {sheet === "cijfers" && <CijfersSheet lijsten={werk?.lists || []} klanten={werk?.klanten || []} sluit={() => setSheet(null)} />}
      {sheet === "losProject" && (
        <LosProjectSheet {...{ klanten }} nieuweKlant={maakKlant} sluit={() => setSheet(null)} heeftSjablonen={sjablonen.length > 0}
          naarSjabloon={() => setSheet({ soort: "nieuwProject", sjabloonId: null, offerteNietDoorMij: true })}
          maak={(velden) => {
            const lijst = maakLosProject({ ...velden, vandaag, wie: ik, nieuwId: uid });
            zetLijst("werk", lijst);
            setSheet(null);
            setKlantFilter(null);
            setWeergave({ soort: "lijst", ruimte: "werk", listId: lijst.id });
            meld(`📂 Project "${lijst.name}" aangemaakt`);
          }} />
      )}
      {sheet === "aanvraag" && (
        <AanvraagSheet {...{ klanten, vandaag }} alleKlanten={werk?.klanten || []} nieuweKlant={maakKlant} sluit={() => setSheet(null)}
          maak={({ naam, klantId, tekst, gesprekDatum, offerteUiterlijk }) => {
            const herkend = leesIntake(tekst, { vandaag, klanten: werkRef.current?.klanten || [] });
            const lijst = maakAanvraag({ naam, klantId: klantId || herkend.klantId || null, intakeTekst: tekst, herkend, vandaag, gesprekDatum, offerteUiterlijk, wie: ik, nieuwId: uid });
            zetLijst("werk", lijst);
            setSheet(null);
            setWeergave({ soort: "lijst", ruimte: "werk", listId: lijst.id });
            meld(`📞 Aanvraag "${naam}" vastgelegd — offerte uiterlijk ${datumKort(lijst.items[0].dueDate).toLowerCase()}`);
          }} />
      )}
      {sheet?.soort === "offerteVanAanvraag" && (() => {
        const lijst = lijstVan("werk", sheet.listId);
        if (!lijst) return null;
        return (
          <OfferteSheet {...{ klanten, vandaag }} vanAanvraag={lijst} nieuweKlant={maakKlant} sluit={() => setSheet(null)}
            maak={(opties) => {
              const basisNieuw = aanvraagNaarOfferte(lijstVan("werk", lijst.id), { ...opties, vandaag, wie: ik, nieuwId: uid });
              const nieuw = opties.specificatie ? { ...basisNieuw, project: { ...basisNieuw.project, offerte: { ...basisNieuw.project.offerte, specificatie: opties.specificatie, werkelijk: {} } } } : basisNieuw;
              zetLijst("werk", nieuw);
              setSheet(null);
              const nav = nieuw.items.find(i => i.offerteNavraag);
              meld(`📨 Offerte verstuurd — eerste navraag ${datumKort(nav.dueDate)} om ${nav.herinnering.slice(11)}`);
            }} />
        );
      })()}
      {sheet === "offerte" && (
        <OfferteSheet {...{ klanten, vandaag }} nieuweKlant={maakKlant} sluit={() => setSheet(null)}
          maak={(opties) => {
            const basis = maakOfferte({ ...opties, vandaag, wie: ik, nieuwId: uid });
            const lijst = { ...basis, project: { ...basis.project, deliverables: normaliseerDeliverables(opties.deliverables),
              ...(opties.specificatie ? { offerte: { ...basis.project.offerte, specificatie: opties.specificatie, werkelijk: {} } } : {}) } };
            zetLijst("werk", lijst);
            setSheet(null);
            meld(`📨 Offerte vastgelegd — eerste navraag ${datumKort(lijst.items[0].dueDate)} om ${lijst.items[0].herinnering.slice(11)}`);
          }} />
      )}
      {sheet?.soort === "akkoord" && (() => {
        const lijst = lijstVan("werk", sheet.listId);
        if (!lijst) return null;
        return (
          <NieuwProjectSheet {...{ sjablonen, klanten, vandaag }} vanOfferte={lijst} nieuweKlant={maakKlant} sluit={() => setSheet(null)}
            voorstel={(() => {
              const spec = lijst.project?.offerte?.specificatie;
              const h = spec ? herkenUitOfferte(spec, { vandaag }) : leesIntake(lijst.project?.intake?.tekst || "", { vandaag });
              const offerteBedrag = lijst.project?.offerte?.bedrag;
              return kiesSjabloon(sjablonen, werk?.lists || [], { bedrag: offerteBedrag ?? lijst.project?.budget ?? null, draaidagen: h.draaidagen || null, bron: offerteBedrag != null ? "offerte" : "budget" });
            })()}
            maak={(sjabloon, opties) => {
              const nu = Date.now();
              const basis = lijstVan("werk", lijst.id);
              const metKeuze = opties.versieId ? kiesOfferteVersie(basis, opties.versieId) : basis;
              rondStartAf(startMetOnderdelen(offerteAkkoord(metKeuze, sjabloon, { ...opties, akkoordOp: vandaag, vandaag, wie: ik, nu, nieuwId: uid }), sjabloon, opties), opties);
              setSheet(null);
              setWeergave({ soort: "lijst", ruimte: "werk", listId: lijst.id });
              meld(`🎉 Akkoord! Productie van "${lijst.name}" gestart`);
            }} />
        );
      })()}
      {sheet?.soort === "afwezigheid" && (
        <AfwezigheidSheet afwezigheden={afwezigheden} klanten={klanten.filter(k => !k.gearchiveerd)} klantVan={klantVan} namen={afwezigNamen} vandaag={vandaag}
          start={sheet.start} sluit={() => setSheet(sheet.terug || null)}
          bewaar={(next) => { bewaarAfwezigheden(next); meld("🏖️ Afwezigheid bewaard"); }} />
      )}
      {sheet?.soort === "planning" && (() => {
        const lijst = lijstVan("werk", sheet.listId);
        if (!lijst) return null;
        const klant = klantVan(lijst.project?.klantId);
        const metSuggesties = [...new Set([
          ...callsVan(lijst.project).map(c => c.met).filter(Boolean),
          ...(klant ? [klant.naam] : []),
          ...contacten.map(c => c.naam).filter(Boolean),
        ])].slice(0, 60);
        return (
          <PlanningSheet lijst={lijst} vandaag={vandaag} sluit={() => setSheet(null)} metSuggesties={metSuggesties}
            afwezigheden={afwezigheden} klantVan={klantVan}
            openAfwezigheid={() => setSheet({ soort: "afwezigheid", terug: { soort: "planning", listId: lijst.id } })}
            verzetMomentFn={(itemId, waarde, keten) => {
              const r = verzetMoment(lijstVan("werk", lijst.id), itemId, waarde, { keten });
              zetLijst("werk", r.lijst);
              return r;
            }}
            verschuifAnker={(data) => {
              const l = verschuifProject(lijstVan("werk", lijst.id), data);
              zetLijst("werk", l);
              return l;
            }}
            planCall={({ onderwerp, met, datum, tijd }) => {
              const l = lijstVan("werk", lijst.id);
              const callId = uid(), taakId = uid();
              const naam = `📞 ${onderwerp?.trim() || "Call"}${met?.trim() ? ` met ${met.trim()}` : ""}`;
              const taak = { ...nieuweTaak({
                name: naam, category: faseVoorDatum(l.project, datum), dueDate: datum,
                herinnering: tijd ? `${datum}T${tijdMin(tijd, 60)}` : null, klantId: l.project?.klantId || null, note: tijd ? `Om ${tijd}` : "",
              }, { wie: ik }), id: taakId, callMoment: true };
              zetLijst("werk", bewaarCallInProject(l, { id: callId, datum, tijd: tijd || null, met: met || "", onderwerp: onderwerp?.trim() || "Call", momentTaakId: taakId, notities: "" }, [taak], { nieuwId: uid, wie: ik }));
              return taakId;
            }}
            openMomentCall={(taak) => {
              const l = lijstVan("werk", lijst.id);
              const bestaand = callVoorMoment(l, taak);
              setSheet({
                soort: "call", listId: lijst.id, callId: bestaand?.id || uid(), terug: { soort: "planning", listId: lijst.id },
                voorinvulling: { datum: taak.dueDate, tijd: momentTijd(taak) || "", met: klant?.naam || "", onderwerp: taak.name.replace(/^📞\s*/, ""), momentTaakId: taak.id },
              });
            }}
            schuif={(itemId, datum, modus) => {
              const l = lijstVan("werk", lijst.id);
              const r = modus === "keten" ? schuifKeten(l, itemId, datum) : schuifPlanning(l, itemId, datum, { meeschuiven: modus === "alles" });
              zetLijst("werk", r.lijst);
              return r;
            }}
            koppel={(itemId, naId) => { const r = zetAfhankelijkheid(lijstVan("werk", lijst.id), itemId, naId); if (!r.fout) zetLijst("werk", r.lijst); return r; }}
            wachtDagen={(itemId, n) => { const r = zetWachtDagen(lijstVan("werk", lijst.id), itemId, n); zetLijst("werk", r.lijst); return r; }}
            stelVoor={(overschrijf) => { const r = leidAfhankelijkhedenAf(lijstVan("werk", lijst.id), { overschrijf }); zetLijst("werk", r.lijst); return r; }}
            herstel={(snapshot) => wijzigLijst("werk", lijst.id, l => ({
              ...l,
              // Project-datums en calls terug (draaidag/oplevering/geplande calls).
              ...(snapshot._project ? { project: { ...l.project, draaidag: snapshot._project.draaidag, opleverdatum: snapshot._project.opleverdatum, calls: snapshot._project.calls, ...(snapshot._project.draaidagen ? { draaidagen: snapshot._project.draaidagen } : {}) } } : {}),
              // Taken die na de momentopname zijn ingepland (geplande calls) weer weg.
              items: l.items.filter(i => snapshot[i.id] || !i.callMoment).map(i => {
                const s = snapshot[i.id];
                if (!s) return i;
                const { naId: _a, naDagen: _b, ...rest } = { ...i, dueDate: s.dueDate, herinnering: s.herinnering, note: s.note, datumHandmatig: s.datumHandmatig };
                return s.naId ? { ...rest, naId: s.naId, naDagen: s.naDagen ?? 0 } : rest;
              }),
            }))}
            zetVast={(itemId, vast) => zetVelden("werk", lijst.id, itemId, { vast: vast || false })}
            weekendWeg={(ids) => {
              wijzigLijst("werk", lijst.id, l => ({ ...l, items: l.items.map(i => {
                if (!ids.includes(i.id)) return i;
                const d = werkdagVoorTaak(i, vandaag);
                return { ...i, dueDate: d, ...(i.herinnering ? { herinnering: `${d}T${i.herinnering.slice(11, 16)}` } : {}) };
              }) }));
              meld(`📅 ${ids.length} ${ids.length === 1 ? "deadline" : "deadlines"} naar een werkdag verzet`);
            }} />
        );
      })()}
      {sheet?.soort === "call" && (() => {
        const lijst = lijstVan("werk", sheet.listId);
        if (!lijst) return null;
        const klant = klantVan(lijst.project?.klantId);
        const metSuggesties = [...new Set([
          ...callsVan(lijst.project).map(c => c.met).filter(Boolean),
          ...(klant ? [klant.naam] : []),
          ...contacten.map(c => c.naam).filter(Boolean),
        ])].slice(0, 60);
        return (
          <CallSheet key={sheet.callId} lijst={lijst} callId={sheet.callId} vandaag={vandaag} chronoRef={chronoRef} metSuggesties={metSuggesties}
            voorinvulling={sheet.voorinvulling || null}
            afwezigheden={afwezigheden} klantNaam={klant?.naam || ""}
            voegAfwezigheidToe={(a) => {
              if (!a.naam) { setSheet({ soort: "afwezigheid", start: { ...a, klantId: lijst.project?.klantId || "" }, terug: sheet }); return; }
              const isKlant = !!lijst.project?.klantId && !(lijst.items || []).some(i => (i.bezetting || []).some(b => b.naam && noemtPersoon(b.naam, a.naam)));
              bewaarAfwezigheden([...afwezigheden, normAfwezigheid({ ...a, id: uid(), klantId: isKlant ? lijst.project.klantId : null })]);
              meld(`🏖️ ${a.naam} afwezig ${periodeKort(a).toLowerCase()} — toegevoegd`);
            }}
            sluit={() => setSheet(sheet.terug || null)}
            bewaarCall={(c) => wijzigLijst("werk", lijst.id, l => synchroniseerMomentMetCall(bewaarCallInProject(l, c, [], { nieuwId: uid, wie: ik }), c))}
            voegTaakToe={(c, t) => wijzigLijst("werk", lijst.id, l => {
              const lopend = !!l.project && !["aanvraag", "offerte"].includes(projectStatus(l));
              const herkomst = `📞 Uit call van ${new Date(`${c.datum || vandaag}T12:00`).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })}${c.met?.trim() ? ` met ${c.met.trim()}` : ""}`;
              const taak = { ...nieuweTaak({
                name: t.titel, category: lopend ? (t.fase || "pre") : (l.categories?.[0]?.id || null),
                dueDate: t.dueDate || null, herinnering: t.dueDate ? t.herinnering || null : null,
                klantId: l.project?.klantId || null, note: herkomst,
              }, { wie: ik }), callBron: t.bron };
              return bewaarCallInProject(l, c, [taak], { nieuwId: uid, wie: ik });
            })}
            wijzigTaak={(itemId, velden) => zetVelden("werk", lijst.id, itemId, velden)}
            verwijderTaak={(itemId) => wijzigLijst("werk", lijst.id, l => ({ ...l, items: (l.items || []).filter(i => i.id !== itemId) }))}
            verwijder={() => { zetLijst("werk", verwijderCall(lijstVan("werk", lijst.id), sheet.callId)); setSheet(null); meld("🗑️ Call verwijderd — de taken blijven staan"); }}
          />
        );
      })()}
      {sheet?.soort === "onderdelen" && (() => {
        const lijst = lijstVan("werk", sheet.listId);
        if (!lijst) return null;
        const sjabloon = sjablonen.find(t => t.id === lijst.project?.sjabloonId);
        return (
          <OnderdelenSheet lijst={lijst} sjabloon={sjabloon} vandaag={vandaag} sluit={() => setSheet(null)}
            toepassen={(onderdelen, meetings, deliverables, eigenPlanning) => {
              zetLijst("werk", pasOnderdelenToe(lijstVan("werk", lijst.id), onderdelen, { draaidag: lijst.project.draaidag, vandaag, meetings, deliverables, eigenPlanning, wie: ik, nieuwId: uid }));
              // Nieuwe eigen afspraken onthouden bij het sjabloon (voor de suggesties).
              const oudeIds = new Set((lijst.project.eigenPlanning || []).map(e => e.id));
              const nieuwe = eigenPlanning.filter(e => !oudeIds.has(e.id));
              if (sjabloon && nieuwe.length) bewaarSjablonen(sjablonen.map(t => (t.id === sjabloon.id ? onthoudPlanningNamen(t, nieuwe) : t)));
              setSheet(null);
              meld("🧩 Onderdelen bijgewerkt");
            }} />
        );
      })()}
      {sheet?.soort === "callsheet" && (() => {
        const lijst = lijstVan("werk", sheet.listId);
        if (!lijst?.project) return null;
        return (
          <CallsheetSheet lijst={lijst} dagId={sheet.dagId} klant={klantVan(lijst.project.klantId)}
            instellingen={werk?.callsheet || {}} logos={werk?.logos || []}
            sluit={() => setSheet(null)}
            kiesDag={(dagId) => setSheet({ ...sheet, dagId })}
            bewaar={bewaarCallsheet} bewaarInstellingen={bewaarCallsheetInstellingen} voegLogoToe={voegLogoToe} meld={meld} />
        );
      })()}
      {sheet?.soort === "afwijzen" && (() => {
        const lijst = lijstVan("werk", sheet.listId);
        if (!lijst) return null;
        return (
          <AfwijzenSheet lijst={lijst} sluit={() => setSheet(null)} bevestig={(reden) => {
            zetLijst("werk", offerteAfgewezen(lijst, { datum: vandaag, reden }));
            setSheet(null);
            setWeergave({ soort: "overzicht" });
            meld("Offerte gearchiveerd als afgewezen");
          }} />
        );
      })()}
      {sheet?.soort === "nieuwProject" && (
        <NieuwProjectSheet
          {...{ sjablonen, klanten, vandaag }} startSjabloonId={sheet.sjabloonId} nieuweKlant={maakKlant} startOfferteNietDoorMij={!!sheet.offerteNietDoorMij}
          sluit={() => setSheet(null)}
          maak={(sjabloon, opties) => {
            const lijst = rondStartAf(startMetOnderdelen(maakProjectUitSjabloon(sjabloon, { ...opties, vandaag, wie: ik, nieuwId: uid }), sjabloon, opties), opties);
            setSheet(null);
            setKlantFilter(null);
            setWeergave({ soort: "lijst", ruimte: "werk", listId: lijst.id });
            meld(`🎬 Project "${lijst.name}" gestart met ${lijst.items.length} taken`);
          }}
        />
      )}
      {sheet === "sjablonen" && (
        <SjablonenSheet {...{ sjablonen }} sluit={() => setSheet(null)} bewaar={bewaarSjablonen}
          startProject={(id) => setSheet({ soort: "nieuwProject", sjabloonId: id })} meld={meld} />
      )}
      {sheet?.soort === "leren" && (() => {
        const lijst = lijstVan("werk", sheet.listId);
        const sjabloon = lijst?.project ? sjablonen.find(t => t.id === lijst.project.sjabloonId) : null;
        return (
          <LeerSheet lijst={lijst} sjabloon={sjabloon} sluit={() => setSheet(null)} nacalculatie={nacalculatieVan(lijst)}
            toepassen={(voorstellen, gekozen, afronden) => {
              if (sjabloon) {
                const nieuw = pasLeerVoorstellenToe(sjabloon, lijst, voorstellen, gekozen, uid, { metTiming: !lijst.project.geleerdOp });
                bewaarSjablonen(sjablonen.map(t => (t.id === sjabloon.id ? nieuw : t)));
              }
              wijzigLijst("werk", lijst.id, l => {
                const nac = afronden ? nacalculatieVan(l) : null;
                return { ...l, project: { ...l.project, geleerdOp: Date.now(), afgerond: afronden || l.project.afgerond, ...(nac ? { nacalculatie: nac } : {}) } };
              });
              setSheet(null);
              if (afronden) setWeergave({ soort: "overzicht" });
              meld(gekozen.length ? `🧠 Sjabloon bijgewerkt (${gekozen.length} ${gekozen.length === 1 ? "aanpassing" : "aanpassingen"})` : "🧠 Timing vastgelegd voor een volgende keer");
            }} />
        );
      })()}
      {sheet === "import" && (
        <ImportSheet
          {...{ thuisLijsten, werkLijsten, werkStaat, chronoRef, ik }}
          sluit={() => setSheet(null)}
          importeer={({ ruimte, listId, groepen, perKopje, datums }) => {
            let n = 0;
            const maakTaken = (taken, lijst) => taken.map(t => {
              const slim = datums ? ontleedSnelleInvoer(t.tekst, chronoRef.current, new Date()) : { titel: t.tekst };
              n++;
              return nieuweTaak({
                name: slim.titel || t.tekst, category: lijst.categories?.[0]?.id || null,
                dueDate: slim.dueDate || null, herinnering: slim.herinnering || null, herhaling: slim.herhaling || null, belangrijk: !!slim.belangrijk,
                substappen: t.substappen.map(s => ({ id: uid(), tekst: s, afgevinkt: false })),
              }, { wie: ik, id: uid() });
            });
            if (perKopje) {
              const doelZonderKop = listId === "__nieuw" ? null : lijstVan(ruimte, listId);
              for (const g of groepen) {
                const bestaand = g.lijstNaam ? (ruimte === "werk" ? werkRef.current?.lists || [] : thuisRef.current).find(l => l.name.toLowerCase() === g.lijstNaam.toLowerCase() && (ruimte === "werk" || l.type === "todo")) : null;
                const lijst = bestaand || (g.lijstNaam ? nieuweLijstObject(g.lijstNaam, "📋") : doelZonderKop || nieuweLijstObject("Geïmporteerd", "📥"));
                const actueel = lijstVan(ruimte, lijst.id) || lijst;
                zetLijst(ruimte, { ...actueel, items: [...(actueel.items || []), ...maakTaken(g.taken, actueel)] });
              }
            } else {
              const lijst = listId === "__nieuw" ? nieuweLijstObject("Geïmporteerd", "📥") : lijstVan(ruimte, listId);
              const alle = groepen.flatMap(g => g.taken);
              zetLijst(ruimte, { ...lijst, items: [...(lijst.items || []), ...maakTaken(alle, lijst)] });
            }
            setSheet(null);
            meld(`✅ ${n} ${n === 1 ? "taak" : "taken"} geïmporteerd`);
          }}
        />
      )}

      {toast && (
        <div role="status" style={{ position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)", background: C.tekst, color: "#FAF6F0", borderRadius: 14, padding: "10px 14px", fontSize: 14, zIndex: 300, display: "flex", gap: 12, alignItems: "center", maxWidth: "calc(100% - 32px)", boxShadow: "0 8px 24px rgba(0,0,0,.2)" }}>
          <span>{toast.tekst}</span>
          {toast.ongedaan && <button style={{ ...S.knop("transparent", "#F2C9B4"), padding: 0 }} onClick={() => { toast.ongedaan(); setToast(null); }}>Ongedaan maken</button>}
        </div>
      )}
    </div>
    </MargeContext.Provider>
  );
}

// ════════════════════════════════════════════════════════════════════
// OVERZICHT
// ════════════════════════════════════════════════════════════════════
// Lijsten per klant groeperen, met inklapbare klantkoppen. Wat je in- of
// uitklapt wordt per sectie op dit toestel onthouden. Korte lijsten (of maar
// één klant) blijven plat — dan heeft groeperen geen zin.
function leesIngeklapt(sectie) {
  try { const v = JSON.parse(localStorage.getItem(`ingeklapt:${sectie}`) || "null"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
function KlantGroepen({ sectie, items, klantVan, render, samenvatting = null, minItems = 4, standaardDicht = true }) {
  const [staat, setStaat] = useState({});
  useEffect(() => { setStaat(leesIngeklapt(sectie)); }, [sectie]);
  const groepen = [];
  const perKlant = new Map();
  for (const l of items) {
    const id = l.project?.klantId || l.klantId || "";
    if (!perKlant.has(id)) { const g = { id, klant: id ? klantVan(id) : null, items: [] }; perKlant.set(id, g); groepen.push(g); }
    perKlant.get(id).items.push(l);
  }
  // Zonder klant altijd onderaan.
  groepen.sort((a, b) => (a.id ? 0 : 1) - (b.id ? 0 : 1));
  if (groepen.length < 2 || items.length < minItems) return <>{items.map(render)}</>;
  const isDicht = (id) => (staat[id || "_geen"] ?? standaardDicht);
  function zet(nieuw) {
    setStaat(nieuw);
    try { localStorage.setItem(`ingeklapt:${sectie}`, JSON.stringify(nieuw)); } catch { /* niets */ }
  }
  const allesDicht = groepen.every(g => isDicht(g.id));
  return (
    <>
      <button onClick={() => zet(Object.fromEntries(groepen.map(g => [g.id || "_geen", !allesDicht])))}
        style={{ ...S.rij, padding: "8px 14px", justifyContent: "flex-end", color: C.muted, fontSize: 12, fontWeight: 600 }}>
        {allesDicht ? "Alles uitklappen" : "Alles inklappen"} · {groepen.length} klanten
      </button>
      {groepen.map(g => {
        const dicht = isDicht(g.id);
        const kleur = g.klant?.kleur || C.muted;
        return (
          <div key={g.id || "_geen"} data-testid={`klantgroep-${sectie}`}>
            <button onClick={() => zet({ ...staat, [g.id || "_geen"]: !dicht })} aria-expanded={!dicht}
              style={{ ...S.rij, background: dicht ? C.kaart : "#FBF8F2", padding: "11px 14px" }}>
              <ChevronDown size={16} color={C.muted} style={{ transform: dicht ? "rotate(-90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: g.klant ? kleur : C.muted }}>● {g.klant?.naam || "Zonder klant"} <span style={{ fontWeight: 500, color: C.muted }}>· {g.items.length}</span></span>
                {dicht && samenvatting && <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{samenvatting(g.items)}</span>}
              </span>
            </button>
            {!dicht && <div style={{ borderLeft: `3px solid ${g.klant ? kleur : C.rand2}`, marginLeft: 0 }}>{g.items.map(render)}</div>}
          </div>
        );
      })}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// AFWEZIGHEID — wie is er wanneer niet (vakantie, vrije dagen)
// ════════════════════════════════════════════════════════════════════
function periodeKort(a) {
  return a.van === a.tot ? datumKort(a.van) : `${datumKort(a.van)} – ${datumKort(a.tot)}`;
}
function afwStatus(a, vandaag) {
  if (a.van <= vandaag && vandaag <= a.tot) return { t: `nu afwezig · terug ${datumKort(plusDagen(a.tot, 1)).toLowerCase()}`, k: C.rood };
  const n = Math.round((new Date(`${a.van}T12:00:00`) - new Date(`${vandaag}T12:00:00`)) / 86400000);
  return { t: n === 1 ? "vanaf morgen" : `over ${n} dagen`, k: n <= 7 ? C.oranje : C.muted };
}

function AfwezigheidSheet({ afwezigheden, klanten, klantVan, namen, vandaag, sluit, bewaar, start = null }) {
  const leeg = { id: null, naam: "", klantId: "", van: "", tot: "", notitie: "" };
  const [form, setForm] = useState(start ? { ...leeg, ...start } : null);
  const [oudOpen, setOudOpen] = useState(false);
  const komend = afwezigheden.filter(a => a.tot >= vandaag).sort((a, b) => a.van.localeCompare(b.van));
  const voorbij = afwezigheden.filter(a => a.tot < vandaag).sort((a, b) => b.van.localeCompare(a.van));
  const kan = form && form.naam.trim() && form.van;
  function opslaan() {
    const a = normAfwezigheid({ ...form, id: form.id || uid(), klantId: form.klantId || null });
    bewaar(form.id ? afwezigheden.map(x => (x.id === form.id ? a : x)) : [...afwezigheden, a]);
    setForm(null);
  }
  const rij = (a) => {
    const st = afwStatus(a, vandaag);
    const k = a.klantId ? klantVan(a.klantId) : null;
    return (
      <button key={a.id} onClick={() => setForm({ ...a, klantId: a.klantId || "" })} style={{ ...S.rij, alignItems: "flex-start" }}>
        <span style={{ fontSize: 18 }}>🏖️</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>{a.naam}{k ? <span style={{ color: k.kleur || C.muted, fontWeight: 600 }}> · ● {k.naam}</span> : ""}</span>
          <span style={{ display: "block", fontSize: 13, color: C.muted }}>{periodeKort(a)}{a.notitie ? ` · ${a.notitie}` : ""}</span>
          {a.tot >= vandaag && <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: st.k, marginTop: 2 }}>{st.t}</span>}
        </span>
        <ChevronRight size={16} color={C.licht} />
      </button>
    );
  };
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()} data-testid="afwezigheid-sheet">
        <SheetKop titel="🏖️ Afwezigheid" sluit={sluit} />
        <p style={{ ...S.hint, marginTop: 0 }}>Vakanties en vrije dagen van klanten, crew en cast. Valt een kickoff, PPM, call, akkoord of draaidag in zo'n periode, dan zie je een waarschuwing in het project en de planning.</p>
        {form ? (
          <div style={{ background: C.bg, borderRadius: 14, padding: 12, marginTop: 10, display: "grid", gap: 8 }}>
            <label style={{ fontSize: 12, color: C.muted, display: "grid", gap: 4 }}>Wie
              <input aria-label="Naam afwezige" list="afw-namen" value={form.naam} onChange={e => setForm(f => ({ ...f, naam: e.target.value }))} placeholder="Bijv. Leonie Schröder" style={S.inp} autoFocus={!form.naam} />
              <datalist id="afw-namen">{namen.map(n => <option key={n} value={n} />)}</datalist>
            </label>
            <label style={{ fontSize: 12, color: C.muted, display: "grid", gap: 4 }}>Klant (als het iemand van de klant is)
              <select aria-label="Klant afwezige" value={form.klantId || ""} onChange={e => setForm(f => ({ ...f, klantId: e.target.value }))} style={S.inp}>
                <option value="">— geen (crew, cast, eigen team) —</option>
                {klanten.map(k => <option key={k.id} value={k.id}>{k.naam}</option>)}
              </select>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.muted, display: "grid", gap: 4 }}>Van
                <input type="date" aria-label="Afwezig van" value={form.van} onChange={e => setForm(f => ({ ...f, van: e.target.value, tot: !f.tot || f.tot < e.target.value ? e.target.value : f.tot }))} style={S.inp} />
              </label>
              <label style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.muted, display: "grid", gap: 4 }}>Tot en met
                <input type="date" aria-label="Afwezig tot" value={form.tot} min={form.van || undefined} onChange={e => setForm(f => ({ ...f, tot: e.target.value }))} style={S.inp} />
              </label>
            </div>
            <input aria-label="Notitie afwezigheid" value={form.notitie} onChange={e => setForm(f => ({ ...f, notitie: e.target.value }))} placeholder="Notitie (optioneel) — bv. 'vervanger: Mark'" style={S.inp} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setForm(null)} style={{ ...S.knop(C.kaart, C.tekst), border: `1px solid ${C.rand2}`, flex: 1 }}>Annuleer</button>
              <button disabled={!kan} onClick={opslaan} style={{ ...S.knop(), flex: 2, opacity: kan ? 1 : 0.5 }}>Bewaren</button>
            </div>
            {form.id && <button onClick={() => { bewaar(afwezigheden.filter(x => x.id !== form.id)); setForm(null); }} style={{ background: "none", border: "none", color: C.rood, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Verwijderen</button>}
          </div>
        ) : (
          <button onClick={() => setForm({ ...leeg })} style={{ ...S.knop(), width: "100%", marginTop: 12 }}>＋ Afwezigheid toevoegen</button>
        )}
        <p style={S.label}>Komend & nu · {komend.length}</p>
        <div style={S.kaart}>
          {komend.map(rij)}
          {!komend.length && <p style={{ ...S.hint, padding: 12 }}>Niemand afwezig gepland.</p>}
        </div>
        {voorbij.length > 0 && (
          <>
            <button onClick={() => setOudOpen(!oudOpen)} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", marginTop: 10, fontFamily: "inherit" }}>{oudOpen ? "▾" : "▸"} Voorbij ({voorbij.length})</button>
            {oudOpen && <div style={S.kaart}>{voorbij.map(rij)}</div>}
          </>
        )}
      </div>
    </div>
  );
}

// Waarschuwing in een project: wie is er afwezig tijdens momenten die ertoe doen.
function AfwezigheidMelding({ conflicten, klantVan, openPlanning, compact = false }) {
  if (!conflicten.length) return null;
  const perPersoon = new Map();
  for (const c of conflicten) {
    if (!perPersoon.has(c.afwezigheid.id)) perPersoon.set(c.afwezigheid.id, { a: c.afwezigheid, items: [] });
    perPersoon.get(c.afwezigheid.id).items.push(c.item);
  }
  return (
    <div data-testid="afwezig-melding" style={{ background: "#FFF4E5", border: "1px solid #F1D3A8", borderRadius: 12, padding: "10px 12px", margin: compact ? "0 0 8px" : "10px 0 4px" }}>
      {[...perPersoon.values()].map(({ a, items }) => {
        const k = a.klantId ? klantVan(a.klantId) : null;
        return (
          <div key={a.id} style={{ fontSize: 13, marginBottom: 4 }}>
            <b>🏖️ {a.naam}{k ? ` (${k.naam})` : ""} is afwezig {periodeKort(a).toLowerCase()}</b>
            <span style={{ display: "block", color: C.muted }}>
              Valt erin: {items.slice(0, 4).map(i => `${i.name.replace(/^📞\s*/, "")} (${datumKort(i.dueDate).toLowerCase()})`).join(", ")}{items.length > 4 ? ` en nog ${items.length - 4}` : ""}
            </span>
          </div>
        );
      })}
      {openPlanning && <button onClick={openPlanning} style={{ ...S.chip(false), padding: "4px 10px", fontSize: 12, marginTop: 4 }}>📅 Naar de planning</button>}
    </div>
  );
}

function Overzicht({ afwezigheden = [], openAfwezigheid, ik, status, thuisLijsten, werkLijsten, werkStaat, klanten, klantVan, mailInfo, meldingen, aantal, open, nieuweLijst, openPin, openMail, openKlanten, openImport, openNieuwProject, openLosProject, openSjablonen, openOfferte, openAanvraag, openCijfers, openBackup, openAkkoord, openAfwijzen, zetMeldingenAan, vergrendel, kopieerAdres }) {
  const openAantal = (l) => (l.items || []).filter(i => !i.checked).length;
  const [afgerondOpen, setAfgerondOpen] = useState(false);
  const offertes = werkLijsten.filter(l => projectStatus(l) === "offerte" && !l.project.afgerond)
    .sort((a, b) => (a.project.offerte?.verstuurdOp || "").localeCompare(b.project.offerte?.verstuurdOp || ""));
  const aanvragen = werkLijsten.filter(l => projectStatus(l) === "aanvraag" && !l.project.afgerond)
    .sort((a, b) => (a.project.gestartOp || 0) - (b.project.gestartOp || 0));
  const stat = offerteStatistiek(werkLijsten);
  const projecten = werkLijsten.filter(l => l.project && !l.project.afgerond && !["offerte", "aanvraag"].includes(projectStatus(l)))
    .sort((a, b) => (a.project.draaidag || "9999").localeCompare(b.project.draaidag || "9999"));
  const afgerond = werkLijsten.filter(l => l.project?.afgerond);
  const gewoon = werkLijsten.filter(l => !l.project);
  return (
    <>
      <header style={S.header}>
        <Link href="/" aria-label="Terug naar overzicht" style={{ display: "flex", padding: 4 }}><ChevronLeft size={22} color={C.groen} /></Link>
        <h1 style={S.titel}>Taken</h1>
        {ik && <span style={{ fontSize: 12, color: C.muted }}>👋 {ik}</span>}
      </header>
      <main style={S.main}>
        {meldingen === "uit" && (
          <button onClick={zetMeldingenAan} style={{ ...S.kaart, ...S.rij, borderBottom: `1px solid ${C.rand}`, background: "#FFF8EC" }}>
            <Bell size={18} color={C.oranje} />
            <span style={{ flex: 1, fontSize: 14 }}><strong>Meldingen aanzetten</strong> op dit toestel, zodat herinneringen binnenkomen</span>
            <ChevronRight size={16} color={C.licht} />
          </button>
        )}

        <div style={S.kaart}>
          {Object.entries(SLIM).map(([id, v]) => {
            const Icoon = v.icoon;
            const n = aantal(id);
            return (
              <button key={id} style={S.rij} onClick={() => open({ soort: "slim", id })}>
                <Icoon size={19} color={v.kleur} />
                <span style={{ flex: 1, fontSize: 15 }}>{v.label}</span>
                {n > 0 && <span style={{ fontSize: 13, color: C.muted }}>{n}</span>}
                <ChevronRight size={16} color={C.licht} />
              </button>
            );
          })}
        </div>

        <p style={S.sectieKop}><Briefcase size={13} /> Werk {ik && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— alleen voor {ik}</span>}</p>
        {werkStaat === "geen-naam" && (
          <div style={{ ...S.kaart, padding: 16 }}>
            <p style={{ margin: 0, fontSize: 14 }}>Log uit en weer in en kies daarbij je naam — dan kun je een eigen werkruimte gebruiken.</p>
          </div>
        )}
        {werkStaat === "geen-pin" && (
          <button style={{ ...S.kaart, ...S.rij, borderBottom: `1px solid ${C.rand}` }} onClick={() => openPin("instellen")}>
            <KeyRound size={20} color={C.groen} />
            <span style={{ flex: 1 }}>
              <strong style={{ fontSize: 15 }}>Werkruimte instellen</strong>
              <span style={{ display: "block", fontSize: 13, color: C.muted, marginTop: 2 }}>Kies een eigen pincode. Alleen jij ziet daarna je werktaken — ook {ik === "Tessa" ? "Pepijn" : "Tessa"} niet.</span>
            </span>
            <ChevronRight size={16} color={C.licht} />
          </button>
        )}
        {werkStaat === "vergrendeld" && (
          <button style={{ ...S.kaart, ...S.rij, borderBottom: `1px solid ${C.rand}` }} onClick={() => openPin("ontgrendel")}>
            <Lock size={20} color={C.groen} />
            <span style={{ flex: 1 }}>
              <strong style={{ fontSize: 15 }}>Werkruimte ontgrendelen</strong>
              <span style={{ display: "block", fontSize: 13, color: C.muted, marginTop: 2 }}>Eén keer per toestel, daarna blijft hij 30 dagen open.</span>
            </span>
            <ChevronRight size={16} color={C.licht} />
          </button>
        )}
        {werkStaat === "open" && (
          <>
            <button onClick={openCijfers} style={{ ...S.kaart, ...S.rij, border: `1px solid ${C.rand}`, background: C.kaart, padding: "12px 14px", marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>📊</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Cijfers <span style={{ fontWeight: 400, color: C.muted }}>— omzet, scoringskans, winst, klanten</span></span>
              <ChevronRight size={16} color={C.licht} />
            </button>
            {/* Aanvragen: eerste telefoongesprek, offerte moet nog de deur uit */}
            <p style={{ ...S.sectieKop, marginTop: 4 }}>📞 Aanvragen</p>
            <div style={S.kaart}>
              <KlantGroepen sectie="aanvragen" items={aanvragen} klantVan={klantVan}
                samenvatting={(ls) => {
                  const d = ls.map(l => (l.items || []).find(i => i.aanvraagTaak && !i.checked)?.dueDate).filter(Boolean).sort()[0];
                  return `${ls.map(l => l.name).join(", ")}${d ? ` · eerste offerte ${datumKort(d).toLowerCase()}` : ""}`;
                }}
                render={(l) => {
                const klant = klantVan(l.project.klantId);
                const taak = (l.items || []).find(i => i.aanvraagTaak && !i.checked);
                const h = leesIntake(l.project.intake?.tekst || "", { vandaag: vandaagStr(), klanten: [] });
                return (
                  <button key={l.id} onClick={() => open({ soort: "lijst", ruimte: "werk", listId: l.id })} style={{ ...S.rij, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 18 }}>📞</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: "block", fontSize: 15 }}>{l.name}</span>
                      <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 2 }}>
                        {klant && <span style={{ color: klant.kleur || C.groen, fontWeight: 700 }}>● {klant.naam} · </span>}
                        {taak ? `offerte uiterlijk ${datumKort(taak.dueDate).toLowerCase()}` : "offerte opstellen"}
                        {h.draaidag ? ` · draaien ${datumKort(h.draaidag).toLowerCase()}` : ""}
                      </span>
                    </span>
                    <ChevronRight size={16} color={C.licht} />
                  </button>
                );
              }} />
              <button style={{ ...S.rij, color: C.groen, borderBottom: "none" }} onClick={openAanvraag}>
                <Plus size={18} color={C.groen} /><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Nieuwe aanvraag — notities van het eerste gesprek</span>
              </button>
            </div>

            {/* Afwezig: wie is er binnenkort (of nu) niet */}
            {komendeAfwezigheden(afwezigheden, vandaagStr(), 30).length > 0 && (
              <>
                <p style={{ ...S.sectieKop, marginTop: 4 }}>🏖️ Afwezig</p>
                <div style={S.kaart} data-testid="afwezig-overzicht">
                  {komendeAfwezigheden(afwezigheden, vandaagStr(), 30).slice(0, 5).map(a => {
                    const st = afwStatus(a, vandaagStr());
                    const k = a.klantId ? klantVan(a.klantId) : null;
                    return (
                      <button key={a.id} style={S.rij} onClick={() => openAfwezigheid()}>
                        <span style={{ fontSize: 17 }}>🏖️</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{a.naam}{k ? <span style={{ color: k.kleur || C.muted }}> · ● {k.naam}</span> : ""}</span>
                          <span style={{ display: "block", fontSize: 12, color: C.muted }}>{periodeKort(a)} · <span style={{ color: st.k, fontWeight: 700 }}>{st.t}</span></span>
                        </span>
                        <ChevronRight size={16} color={C.licht} />
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Offertes: verstuurd, wachten op akkoord — wekelijks navragen */}
            <p style={{ ...S.sectieKop, marginTop: 4 }}>📨 Offertes uitstaand
              {(stat.akkoord + stat.afgewezen) > 0 && (
                <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                  — {stat.scoringPct}% akkoord{stat.mediaanDagenTotAkkoord != null ? `, meestal na ${stat.mediaanDagenTotAkkoord} dagen` : ""}
                </span>
              )}
            </p>
            <div style={S.kaart}>
              <KlantGroepen sectie="offertes" items={offertes} klantVan={klantVan}
                samenvatting={(ls) => {
                  const som = ls.reduce((n, l) => n + (Number(l.project.offerte?.bedrag) || 0), 0);
                  const nav = ls.map(l => (l.items || []).find(i => i.offerteNavraag && !i.checked)?.dueDate).filter(Boolean).sort()[0];
                  return `${som ? `${euro(som)} uitstaand` : ls.map(l => l.name).join(", ")}${nav ? ` · ${nav <= vandaagStr() ? "⚠️ " : ""}eerst navragen ${datumKort(nav).toLowerCase()}` : ""}`;
                }}
                render={(l) => {
                const o = l.project.offerte || {};
                const dagen = o.verstuurdOp ? dagenTussen(o.verstuurdOp, vandaagStr()) : 0;
                const navraag = (l.items || []).find(i => i.offerteNavraag && !i.checked);
                const klant = klantVan(l.project.klantId);
                return (
                  <div key={l.id} style={{ padding: "12px 14px", borderBottom: "1px solid #F3EEE3" }}>
                    <button onClick={() => open({ soort: "lijst", ruimte: "werk", listId: l.id })} style={{ background: "none", border: "none", padding: 0, textAlign: "left", width: "100%", cursor: "pointer", fontFamily: "inherit", color: "inherit" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 15, flex: 1 }}>{l.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.oranje, background: "#FCF1DE", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>⏳ Wacht op reactie</span>
                      </span>
                      <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 2 }}>
                        {klant && <span style={{ color: klant.kleur || C.groen, fontWeight: 700 }}>● {klant.naam} · </span>}
                        verstuurd {dagen === 0 ? "vandaag" : `${dagen} ${dagen === 1 ? "dag" : "dagen"} geleden`}
                        {openVersies(l.project).length > 1 ? ` · ${openVersies(l.project).length} opties: ${openVersies(l.project).map(v => (v.bedrag != null ? euro(v.bedrag) : "—")).join(" / ")}` : o.bedrag ? ` · ${euro(o.bedrag)}` : ""}
                        {navraag ? ` · navragen ${datumKort(navraag.dueDate).toLowerCase()}` : ""}
                      </span>
                    </button>
                    <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: C.muted, flex: 1, minWidth: 0 }}>Reactie binnen?</span>
                      <button style={{ ...S.chip(false), padding: "5px 11px", fontSize: 13, color: C.groen }} onClick={() => openAkkoord(l.id)}>👍 Akkoord</button>
                      <button style={{ ...S.chip(false), padding: "5px 11px", fontSize: 13 }} onClick={() => openAfwijzen(l.id)}>✕ Afgewezen</button>
                    </div>
                  </div>
                );
              }} />
              <button style={{ ...S.rij, color: C.groen, borderBottom: "none" }} onClick={openOfferte}>
                <Plus size={18} color={C.groen} /><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Offerte verstuurd — herinner me wekelijks</span>
              </button>
            </div>

            {/* Projecten (uit een sjabloon) — op volgorde van draaidag */}
            <p style={{ ...S.sectieKop, marginTop: 4 }}>🎬 Projecten</p>
            <div style={S.kaart}>
              <KlantGroepen sectie="projecten" items={projecten} klantVan={klantVan}
                samenvatting={(ls) => {
                  const d = ls.map(l => l.project.draaidag).filter(Boolean).sort().find(x => x >= vandaagStr()) || ls.map(l => l.project.draaidag).filter(Boolean).sort()[0];
                  return `${ls.map(l => l.name).join(", ")}${d ? ` · draaidag ${datumKort(d).toLowerCase()}` : ""}`;
                }}
                render={(l) => {
                const vg = projectVoortgang(l);
                const klaar = vg.reduce((n, f) => n + f.klaar, 0), totaal = vg.reduce((n, f) => n + f.totaal, 0);
                const klant = klantVan(l.project.klantId);
                return (
                  <button key={l.id} style={S.rij} onClick={() => open({ soort: "lijst", ruimte: "werk", listId: l.id })}>
                    <span style={{ fontSize: 18, width: 22, textAlign: "center" }}>{l.icon || "🎬"}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 15 }}>{l.name}</span>
                      {/* draaidag kan ontbreken bij een (oud) project zonder datum */}
                      <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 2 }}>
                        {klant && <span style={{ color: klant.kleur || C.groen, fontWeight: 700 }}>● {klant.naam} · </span>}
                        {l.project.draaidag ? `Draaidag ${datumKort(l.project.draaidag)}` : "Nog geen draaidag"}{l.project.opdrachtVia ? ` · via ${l.project.opdrachtVia}` : ""} · {klaar}/{totaal} klaar
                      </span>
                      <span style={{ display: "flex", gap: 3, marginTop: 6 }}>
                        {vg.map(f => (
                          <span key={f.id} title={`${f.label}: ${f.klaar}/${f.totaal}`} style={{ flex: Math.max(1, f.totaal), height: 4, borderRadius: 4, background: "#EFE9DC", overflow: "hidden" }}>
                            <span style={{ display: "block", height: "100%", width: `${f.totaal ? (100 * f.klaar) / f.totaal : 0}%`, background: C.groen }} />
                          </span>
                        ))}
                      </span>
                    </span>
                    <ChevronRight size={16} color={C.licht} />
                  </button>
                );
              }} />
              <button style={{ ...S.rij, color: C.groen }} onClick={() => openNieuwProject(null)}>
                <Plus size={18} color={C.groen} /><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Nieuw project uit sjabloon</span>
              </button>
              <button style={{ ...S.rij, color: C.groen }} onClick={openLosProject}>
                <Plus size={18} color={C.groen} /><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Los project <span style={{ fontWeight: 400, color: C.muted }}>— offerte niet door mij</span></span>
              </button>
              <button style={{ ...S.rij, borderBottom: "none" }} onClick={openSjablonen}>
                <span style={{ fontSize: 16, width: 18, textAlign: "center" }}>📐</span>
                <span style={{ flex: 1, fontSize: 14 }}>Sjablonen beheren</span>
                <ChevronRight size={16} color={C.licht} />
              </button>
            </div>

            <p style={{ ...S.sectieKop, marginTop: 4 }}>📋 Werklijsten</p>
            <div style={S.kaart}>
              {gewoon.map(l => (
                <button key={l.id} style={S.rij} onClick={() => open({ soort: "lijst", ruimte: "werk", listId: l.id })}>
                  <span style={{ fontSize: 18, width: 22, textAlign: "center" }}>{l.icon || "💼"}</span>
                  <span style={{ flex: 1, fontSize: 15 }}>{l.name}</span>
                  {openAantal(l) > 0 && <span style={{ fontSize: 13, color: C.muted }}>{openAantal(l)}</span>}
                  <ChevronRight size={16} color={C.licht} />
                </button>
              ))}
              <button style={{ ...S.rij, color: C.groen }} onClick={() => nieuweLijst("werk")}>
                <Plus size={18} color={C.groen} /><span style={{ fontSize: 14, fontWeight: 600 }}>Nieuwe werklijst</span>
              </button>
            </div>
            {afgerond.length > 0 && (
              <>
                <button onClick={() => setAfgerondOpen(!afgerondOpen)} style={{ ...S.sectieKop, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                  <ChevronDown size={14} style={{ transform: afgerondOpen ? "none" : "rotate(-90deg)" }} /> Afgeronde projecten · {afgerond.length}
                </button>
                {afgerondOpen && (
                  <div style={S.kaart}>
                    <KlantGroepen sectie="afgerond" items={afgerond} klantVan={klantVan}
                      samenvatting={(ls) => `${ls.filter(l => projectStatus(l) !== "afgewezen").length} gedaan · ${ls.filter(l => projectStatus(l) === "afgewezen").length} afgewezen`}
                      render={(l) => (
                      <button key={l.id} style={S.rij} onClick={() => open({ soort: "lijst", ruimte: "werk", listId: l.id })}>
                        <span style={{ fontSize: 18, width: 22, textAlign: "center", opacity: 0.6 }}>{l.icon || "🎬"}</span>
                        <span style={{ flex: 1, fontSize: 14, color: C.muted }}>{l.name} · {projectStatus(l) === "afgewezen" ? "✕ offerte afgewezen" : l.project.draaidag ? datumKort(l.project.draaidag) : "afgerond"}</span>
                        <ChevronRight size={16} color={C.licht} />
                      </button>
                    )} />
                  </div>
                )}
              </>
            )}

            {/* Het persoonlijke e-mailadres staat bewust hier, op het overzicht:
                zo is het altijd met één tik terug te vinden en te kopiëren. */}
            <div style={{ ...S.kaart, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={18} color={C.groen} />
                <strong style={{ flex: 1, fontSize: 15 }}>Taak via e-mail</strong>
                <button style={{ ...S.chip(false), padding: "5px 10px" }} onClick={openMail}>Instellingen</button>
              </div>
              {mailInfo?.adres ? (
                <>
                  <button onClick={kopieerAdres} title="Kopieer adres" style={{ marginTop: 10, width: "100%", display: "flex", alignItems: "center", gap: 8, background: C.bg, border: `1px dashed ${C.rand2}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.groen, wordBreak: "break-all", textAlign: "left" }}>{mailInfo.adres}</span>
                    <Copy size={16} color={C.muted} />
                  </button>
                  <p style={S.hint}>
                    Stuur of forward een mail hierheen: het onderwerp wordt de taak (een datum erin, zoals "vrijdag offerte", wordt herkend).
                    {!mailInfo.webhookIngericht && " ⚠️ Ontvangen staat nog niet aan — zie Instellingen."}
                    {mailInfo.webhookIngericht && !(mailInfo.toegestaneAfzenders || []).length && " ⚠️ Geef bij Instellingen nog op vanaf welke adressen je mailt."}
                  </p>
                </>
              ) : (
                <p style={S.hint}>{mailInfo && !mailInfo.domein ? "Nog één stap: vul bij Instellingen het ontvangstdomein van Resend in, dan verschijnt hier je adres." : "Adres laden…"}</p>
              )}
            </div>

            <div style={S.kaart}>
              <button style={S.rij} onClick={openKlanten}>
                <Tag size={18} color={C.groen} />
                <span style={{ flex: 1, fontSize: 15 }}>Klanten & projecten</span>
                <span style={{ fontSize: 13, color: C.muted }}>{klanten.length || ""}</span>
                <ChevronRight size={16} color={C.licht} />
              </button>
              <button style={S.rij} onClick={() => openAfwezigheid()}>
                <span style={{ fontSize: 17, width: 18, textAlign: "center" }}>🏖️</span>
                <span style={{ flex: 1, fontSize: 15 }}>Afwezigheid (vakanties)</span>
                <span style={{ fontSize: 13, color: C.muted }}>{komendeAfwezigheden(afwezigheden, vandaagStr(), 365).length || ""}</span>
                <ChevronRight size={16} color={C.licht} />
              </button>
              <button style={S.rij} onClick={openBackup}>
                <span style={{ fontSize: 17, width: 18, textAlign: "center" }}>💾</span>
                <span style={{ flex: 1, fontSize: 15 }}>Back-up</span>
                <span style={{ fontSize: 12, color: C.muted }}>dagelijks automatisch</span>
                <ChevronRight size={16} color={C.licht} />
              </button>
              <button style={S.rij} onClick={() => openPin("wijzig")}>
                <KeyRound size={18} color={C.groen} />
                <span style={{ flex: 1, fontSize: 15 }}>Pincode wijzigen</span>
                <ChevronRight size={16} color={C.licht} />
              </button>
              <button style={{ ...S.rij, borderBottom: "none" }} onClick={vergrendel}>
                <Lock size={18} color={C.groen} />
                <span style={{ flex: 1, fontSize: 15 }}>Vergrendelen op dit toestel</span>
              </button>
            </div>
          </>
        )}

        <p style={S.sectieKop}><Home size={13} /> Thuis <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— gedeeld met het huishouden</span></p>
        <div style={S.kaart}>
          {thuisLijsten.map(l => (
            <button key={l.id} style={S.rij} onClick={() => open({ soort: "lijst", ruimte: "thuis", listId: l.id })}>
              <span style={{ fontSize: 18, width: 22, textAlign: "center" }}>{l.icon || "📋"}</span>
              <span style={{ flex: 1, fontSize: 15 }}>{l.name}</span>
              {openAantal(l) > 0 && <span style={{ fontSize: 13, color: C.muted }}>{openAantal(l)}</span>}
              <ChevronRight size={16} color={C.licht} />
            </button>
          ))}
          <button style={{ ...S.rij, color: C.groen }} onClick={() => nieuweLijst("thuis")}>
            <Plus size={18} color={C.groen} /><span style={{ fontSize: 14, fontWeight: 600 }}>Nieuwe thuislijst</span>
          </button>
        </div>

        <p style={S.sectieKop}>Overzetten</p>
        <div style={S.kaart}>
          <button style={{ ...S.rij, borderBottom: "none" }} onClick={openImport}>
            <Upload size={18} color={C.groen} />
            <span style={{ flex: 1 }}>
              <span style={{ fontSize: 15 }}>Taken plakken / importeren</span>
              <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 2 }}>Bijvoorbeeld uit Microsoft To Do, Notities of een e-mail</span>
            </span>
            <ChevronRight size={16} color={C.licht} />
          </button>
        </div>

        {status && !status.herinneringenOpTijd && (
          <p style={{ ...S.hint, margin: "8px 4px" }}>
            ℹ️ Herinneringen op een exact tijdstip zijn op deze deployment nog niet ingericht (QStash). Tot die tijd krijg je elke ochtend één melding met de taken van vandaag.
          </p>
        )}
      </main>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// TAAKREGEL + INVOERBALK (gedeeld door lijst- en slimme weergaven)
// ════════════════════════════════════════════════════════════════════
function TaakRegel({ item, lijst, ruimte, toonLijst, klant, vink, ster, open, extraKnop }) {
  const verlopen = !item.checked && planDatum(item) && planDatum(item) < vandaagStr();
  const stappen = item.substappen || [];
  const meta = [];
  if (toonLijst) meta.push(<span key="l">{ruimte === "werk" ? "💼" : "🏠"} {lijst.name}</span>);
  if (item.mijnDag === vandaagStr() && !toonLijst) meta.push(<span key="md">☀️ Mijn dag</span>);
  if (item.dueDate) meta.push(<span key="d" style={{ color: verlopen ? C.rood : undefined, fontWeight: verlopen ? 700 : 400 }}>📅 {datumKort(item.dueDate)}</span>);
  if (item.herinnering) meta.push(<span key="h">🔔 {herinneringKort(item.herinnering)}</span>);
  if (normaliseerHerhaling(item.herhaling)) meta.push(<span key="r">🔁 {herhalingLabel(item.herhaling)}</span>);
  if (stappen.length) meta.push(<span key="s">{stappen.filter(s => s.afgevinkt).length}/{stappen.length} stappen</span>);
  if (klant) meta.push(<span key="k" style={{ color: klant.kleur || C.groen, fontWeight: 700 }}>● {klant.naam}</span>);
  if (item.assignedTo) meta.push(<span key="a">👤 {item.assignedTo}</span>);
  if (item.callId) meta.push(<span key="c" title="Uit een call">📞</span>);
  if (item.note) meta.push(<span key="n">📝</span>);
  const bez = (item.bezetting || []).filter(b => b.naam);
  if (bez.length) {
    const ok = bez.filter(b => b.status === "bevestigd").length;
    meta.push(<span key="b" style={{ color: ok === bez.length ? C.groen : C.oranje, fontWeight: 700 }}>👥 {ok}/{bez.length} bevestigd</span>);
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderBottom: "1px solid #F3EEE3", background: C.kaart }}>
      <button onClick={vink} aria-label={item.checked ? "Markeer als niet gedaan" : "Markeer als gedaan"}
        style={{ width: 24, height: 24, minWidth: 24, borderRadius: 999, border: `2px solid ${item.checked ? C.groen : "#CFC6B4"}`, background: item.checked ? C.groen : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
        {item.checked && <Check size={14} color="#FAF6F0" strokeWidth={3} />}
      </button>
      <button onClick={open} style={{ flex: 1, minWidth: 0, background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: 0, fontFamily: "inherit", color: "inherit" }}>
        <span style={{ display: "block", fontSize: 15, lineHeight: 1.3, color: item.checked ? C.licht : C.tekst, textDecoration: item.checked ? "line-through" : "none", wordBreak: "break-word" }}>
          {SOORTEN[item.soort] && item.soort !== "taak" && <span title={SOORTEN[item.soort].label} style={{ marginRight: 5 }}>{SOORTEN[item.soort].icon}</span>}{item.name}
        </span>
        {meta.length > 0 && (
          <span style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", fontSize: 12, color: C.muted, marginTop: 3 }}>{meta}</span>
        )}
      </button>
      {extraKnop}
      <button onClick={ster} aria-label={item.belangrijk ? "Niet meer belangrijk" : "Markeer als belangrijk"} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
        <Star size={18} color={item.belangrijk ? C.terra : "#D8D0BF"} fill={item.belangrijk ? C.terra : "none"} />
      </button>
    </div>
  );
}

// Invoerbalk onderaan: Enter = snel toevoegen (met datumherkenning in de
// tekst). De + opent een klein paneel: waar komt de taak, voor wanneer,
// eventueel een notitie. De 🎤 zet ingesproken tekst om in een taak.
function InvoerBalk({ placeholder, voegToe, chronoRef, boven = null, doelen = [], standaardDoel = null, basisExtra = {}, voegToeNaar = null, vandaag, klanten = [] }) {
  const [tekst, setTekst] = useState("");
  const [paneel, setPaneel] = useState(null); // { doel, fase, wanneer, datum, tijd, notitie }
  const [luistert, setLuistert] = useState(false);
  const [spraakHint, setSpraakHint] = useState(null);
  const herkenRef = useRef(null);
  const invoerRef = useRef(null);
  const dag0 = vandaag || vandaagStr();
  // Werk: "morgen" op vrijdag = maandag. Thuis: gewoon morgen.
  const morgenVoor = (ruimte) => (ruimte === "werk" ? volgendeWerkdag(dag0) : plusDagen(dag0, 1));
  // Meerdere taken in één keer ("taak … taak …")?
  const [weg, setWeg] = useState([]);
  const alleMeer = splitsTaken(tekst);
  const meer = alleMeer.map((t, i) => ({ i, t, v: ontleedSnelleInvoer(t, chronoRef.current, new Date()) })).filter(x => !weg.includes(x.i));
  const voorbeeld = !alleMeer.length && tekst.trim().length > 2 ? ontleedSnelleInvoer(tekst, chronoRef.current, new Date()) : null;
  const chips = [];
  if (alleMeer.length && !paneel) chips.push(`🗂️ ${meer.length} taken herkend`);
  if (!paneel) {
    if (voorbeeld?.herinnering) chips.push(`🔔 ${herinneringKort(voorbeeld.herinnering)}`);
    else if (voorbeeld?.dueDate) chips.push(`📅 ${datumKort(voorbeeld.dueDate)}`);
  }
  if (voorbeeld?.herhaling) chips.push(`🔁 ${herhalingLabel(voorbeeld.herhaling)}`);
  if (voorbeeld?.belangrijk) chips.push("⭐ Belangrijk");
  const kanUitklappen = !!voegToeNaar && doelen.length > 0;
  const sleutel = (d) => (d ? `${d.ruimte}:${d.listId}` : "");
  const doelLijst = paneel ? doelen.find(d => sleutel(d) === paneel.doel) : null;
  const isProjectDoel = !!doelLijst?.lopendProject;

  function prefill(t) {
    const v = t.trim().length > 2 && !splitsTaken(t).length ? ontleedSnelleInvoer(t, chronoRef.current, new Date()) : null;
    const datum = v?.dueDate || basisExtra.dueDate || null;
    const tijd = v?.herinnering ? v.herinnering.slice(11, 16) : "";
    const start = standaardDoel && doelen.some(d => sleutel(d) === sleutel(standaardDoel)) ? standaardDoel : doelen[0];
    return {
      doel: sleutel(start), fase: standaardDoel?.fase || "pre", klantId: basisExtra.klantId || "",
      wanneer: !datum ? "geen" : datum === dag0 ? "vandaag" : datum === morgenVoor(start?.ruimte) ? "morgen" : "datum",
      datum: datum || "", tijd, notitie: "",
    };
  }
  function openPaneel(t = tekst) { setPaneel(prefill(t)); }
  function sluitPaneel() { setPaneel(null); }

  function verstuur() {
    if (!tekst.trim()) return;
    if (alleMeer.length) {
      if (!meer.length) return;
      if (paneel && kanUitklappen) {
        const d = doelLijst || doelen[0];
        const datum = paneel.wanneer === "vandaag" ? dag0 : paneel.wanneer === "morgen" ? morgenVoor(d.ruimte) : paneel.wanneer === "datum" ? (paneel.datum || null) : null;
        meer.forEach(({ t, v }) => {
          // Een datum/tijd die je bij de taak zelf zegt, gaat vóór de keuze in het paneel.
          const dueDate = v.dueDate || datum || (paneel.tijd ? dag0 : null);
          const herinnering = v.herinnering || (dueDate && paneel.tijd ? `${dueDate}T${paneel.tijd}` : null);
          const extra = { ...basisExtra, dueDate, herinnering };
          if (v.herhaling) extra.herhaling = v.herhaling;
          if (v.belangrijk) extra.belangrijk = true;
          if (paneel.notitie.trim()) extra.note = paneel.notitie.trim();
          if (d.lopendProject) extra.category = paneel.fase;
          delete extra.klantId;
          if (d.ruimte === "werk" && d.groep !== "project" && paneel.klantId) extra.klantId = paneel.klantId;
          const titel = (v.titel || t).trim();
          voegToeNaar(d.ruimte, d.listId, titel.charAt(0).toUpperCase() + titel.slice(1), extra, `${d.label} (${meer.length} taken)`);
        });
        setPaneel(null);
      } else {
        meer.forEach(({ t }) => voegToe(t));
      }
      setTekst(""); setWeg([]);
      return;
    }
    if (paneel && kanUitklappen) {
      const d = doelLijst || doelen[0];
      const datum = paneel.wanneer === "vandaag" ? dag0 : paneel.wanneer === "morgen" ? morgenVoor(d.ruimte) : paneel.wanneer === "datum" ? (paneel.datum || null) : null;
      const dueDate = datum || (paneel.tijd ? dag0 : null);
      const titel = (voorbeeld?.titel || tekst).trim();
      const extra = { ...basisExtra, dueDate, herinnering: dueDate && paneel.tijd ? `${dueDate}T${paneel.tijd}` : null };
      if (voorbeeld?.herhaling) extra.herhaling = voorbeeld.herhaling;
      if (voorbeeld?.belangrijk) extra.belangrijk = true;
      if (paneel.notitie.trim()) extra.note = paneel.notitie.trim();
      if (d.lopendProject) extra.category = paneel.fase;
      delete extra.klantId;
      // Losse werktaak: klant uit het paneel (algemene taak voor die klant).
      // Projecttaak: de klant van het project (zie voegToeNaar).
      if (d.ruimte === "werk" && d.groep !== "project" && paneel.klantId) extra.klantId = paneel.klantId;
      voegToeNaar(d.ruimte, d.listId, titel.charAt(0).toUpperCase() + titel.slice(1), extra, d.label);
      setPaneel(null);
    } else {
      voegToe(tekst);
    }
    setTekst("");
  }

  // ── Spraak → tekst (Web Speech API; op iPhone via Safari) ──────────
  function spraak() {
    if (luistert) { try { herkenRef.current?.stop(); } catch { /* al gestopt */ } return; }
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { setSpraakHint("geen"); invoerRef.current?.focus(); return; }
    setSpraakHint(null);
    const basis = tekst.trim() ? tekst.trim() + " " : "";
    let gehoord = "";
    let r;
    try { r = new SR(); } catch { setSpraakHint("geen"); invoerRef.current?.focus(); return; }
    // Doorlopend luisteren, zodat je meerdere taken achter elkaar kunt
    // inspreken ("taak … taak …"). Na 3 s stilte stopt hij vanzelf.
    r.lang = "nl-NL"; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
    let stilte = null;
    const wachtOpStilte = () => { clearTimeout(stilte); stilte = setTimeout(() => { try { r.stop(); } catch { /* al gestopt */ } }, 3000); };
    wachtOpStilte();
    r.onresult = (e) => {
      wachtOpStilte();
      const stukken = [];
      for (let i = 0; i < e.results.length; i++) {
        const st = e.results[i][0].transcript.trim();
        if (st && st !== stukken[stukken.length - 1]) stukken.push(st); // Safari herhaalt soms een stuk
      }
      const t = stukken.join(" ");
      gehoord = t.trim();
      const zin = basis + gehoord;
      setTekst(zin.charAt(0).toUpperCase() + zin.slice(1));
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setSpraakHint("geweigerd");
      else if (e.error === "no-speech") setSpraakHint("stil");
      else if (e.error !== "aborted") setSpraakHint("fout");
    };
    r.onend = () => {
      clearTimeout(stilte);
      setLuistert(false); herkenRef.current = null;
      if (gehoord && kanUitklappen) { const zin = basis + gehoord; setPaneel(p => p || prefill(zin)); }
    };
    herkenRef.current = r;
    setLuistert(true);
    try { r.start(); } catch { setLuistert(false); setSpraakHint("fout"); }
  }
  useEffect(() => () => { try { herkenRef.current?.abort(); } catch { /* niets */ } }, []);

  const HINTS = {
    geen: "Inspreken kan hier niet rechtstreeks. Tik op de 🎤 rechtsonder op je iPhone-toetsenbord om in te spreken.",
    geweigerd: "Geen toegang tot de microfoon. Zet 'Microfoon' en 'Spraakherkenning' aan voor Safari in Instellingen › Apps › Safari, of gebruik de 🎤 op het toetsenbord.",
    stil: "Ik hoorde niets — tik nog eens op de 🎤 en spreek je taak in. Meerdere taken? Zeg 'taak' vóór elke taak.",
    fout: "Inspreken lukte niet. Probeer opnieuw, of gebruik de 🎤 op je toetsenbord.",
  };
  const klein = { ...S.chip(false), padding: "5px 10px", fontSize: 12 };
  const kleinAan = (aan) => ({ ...S.chip(aan), padding: "5px 10px", fontSize: 12 });
  const veld = { border: `1px solid ${C.rand2}`, borderRadius: 10, padding: "7px 9px", fontSize: 16, fontFamily: "inherit", background: C.bg, color: C.tekst, minWidth: 0 };

  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "10px 16px 24px", background: `linear-gradient(180deg, rgba(250,246,240,0) 0%, ${C.bg} 30%)`, zIndex: 20 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {!paneel && boven}
        {spraakHint && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FFF4E5", border: "1px solid #F1D3A8", borderRadius: 12, padding: "8px 10px", marginBottom: 6, fontSize: 13, color: C.tekst }}>
            <span style={{ flex: 1 }}>{HINTS[spraakHint]}</span>
            <button onClick={() => setSpraakHint(null)} aria-label="Sluiten" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}><X size={16} color={C.muted} /></button>
          </div>
        )}
        {paneel && kanUitklappen && (
          <div data-testid="invoer-paneel" style={{ background: C.kaart, border: `1px solid ${C.rand2}`, borderRadius: 16, padding: 12, marginBottom: 8, boxShadow: "0 6px 18px rgba(45,42,38,.10)", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10, boxSizing: "border-box", width: "100%", maxWidth: "100%", overflow: "hidden", maxHeight: "70vh", overflowY: "auto" }}>
            {alleMeer.length > 0 && (
              <div data-testid="meer-taken" style={{ background: "#2D4A3E0D", borderRadius: 12, padding: "8px 10px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.groen, marginBottom: 4 }}>🗂️ {meer.length} taken herkend</div>
                {meer.map(({ i, t, v }) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderTop: "1px solid #EAE3D4" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{v.titel || t}</span>
                    {(v.herinnering || v.dueDate) && <span style={{ fontSize: 11, color: C.groen, fontWeight: 600, whiteSpace: "nowrap" }}>{v.herinnering ? `🔔 ${herinneringKort(v.herinnering)}` : `📅 ${datumKort(v.dueDate)}`}</span>}
                    <button aria-label={`${t} weghalen`} onClick={() => setWeg(w => [...w, i])} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><X size={14} color={C.licht} /></button>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Waar en wanneer hieronder gelden voor alle taken; een datum die je bij een taak zelf zegt, gaat voor.</div>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: C.muted, width: 58, flexShrink: 0 }}>Waar</span>
              <select aria-label="Lijst" value={paneel.doel} onChange={e => setPaneel(p => ({ ...p, doel: e.target.value }))} style={{ ...veld, flex: 1, width: 0, minWidth: 0, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none", paddingRight: 28, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%238C8576' stroke-width='1.6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}>
                {[["werk", "💼 Werk — losse taken"], ["project", "🎬 Projecten"], ["thuis", "🏠 Thuis"]].map(([r, kop]) => {
                  const groep = doelen.filter(d => (d.groep || d.ruimte) === r);
                  if (!groep.length) return null;
                  return (
                    <optgroup key={r} label={kop}>
                      {groep.map(d => <option key={sleutel(d)} value={sleutel(d)}>{d.label}</option>)}
                    </optgroup>
                  );
                })}
              </select>
              <button onClick={sluitPaneel} aria-label="Paneel sluiten" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><X size={18} color={C.muted} /></button>
            </div>
            {isProjectDoel && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: C.muted, width: 58, flexShrink: 0 }}>Fase</span>
                <div style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1, minWidth: 0 }}>
                  {FASES.map(f => <button key={f.id} style={kleinAan(paneel.fase === f.id)} onClick={() => setPaneel(p => ({ ...p, fase: f.id }))}>{f.icon} {f.label}</button>)}
                </div>
              </div>
            )}
            {doelLijst?.ruimte === "werk" && doelLijst?.groep !== "project" && klanten.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: C.muted, width: 58, flexShrink: 0 }}>Klant</span>
                <select aria-label="Klant" value={paneel.klantId} onChange={e => setPaneel(p => ({ ...p, klantId: e.target.value }))} style={{ ...veld, flex: 1, width: 0, minWidth: 0, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none", paddingRight: 28, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%238C8576' stroke-width='1.6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}>
                  <option value="">Geen klant</option>
                  {klanten.map(k => <option key={k.id} value={k.id}>● {k.naam} (algemeen)</option>)}
                </select>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: C.muted, width: 58, flexShrink: 0 }}>Wanneer</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", flex: 1, minWidth: 0 }}>
                {[["geen", "Geen"], ["vandaag", "Vandaag"], ["morgen", (doelLijst?.ruimte === "werk" && morgenVoor("werk") !== plusDagen(dag0, 1)) ? "Maandag" : "Morgen"]].map(([k, l]) => (
                  <button key={k} style={kleinAan(paneel.wanneer === k)} onClick={() => setPaneel(p => ({ ...p, wanneer: k, ...(k === "geen" ? { tijd: "" } : {}) }))}>{l}</button>
                ))}
                <label style={{ ...kleinAan(paneel.wanneer === "datum"), display: "flex", alignItems: "center", gap: 4, position: "relative" }}>
                  📅 {paneel.wanneer === "datum" && paneel.datum ? datumKort(paneel.datum) : "Datum…"}
                  <input type="date" aria-label="Datum" value={paneel.datum || ""} min={dag0}
                    onChange={e => setPaneel(p => ({ ...p, datum: e.target.value, wanneer: e.target.value ? "datum" : "geen" }))}
                    style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", cursor: "pointer" }} />
                </label>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: C.muted, width: 58, flexShrink: 0 }}>Herinner</span>
              <input type="time" aria-label="Tijd herinnering" value={paneel.tijd} onChange={e => setPaneel(p => ({ ...p, tijd: e.target.value, ...(p.wanneer === "geen" && e.target.value ? { wanneer: "vandaag" } : {}) }))} style={{ ...veld, width: 104, minHeight: 38, boxSizing: "border-box" }} />
              {paneel.tijd ? <button style={klein} onClick={() => setPaneel(p => ({ ...p, tijd: "" }))}>Geen</button> : <span style={{ fontSize: 12, color: C.muted, flex: 1, minWidth: 0 }}>optioneel — met melding</span>}
            </div>
            <textarea aria-label="Notitie" value={paneel.notitie} onChange={e => setPaneel(p => ({ ...p, notitie: e.target.value }))} placeholder="Notitie (optioneel)" rows={2}
              style={{ ...veld, resize: "vertical", width: "100%", boxSizing: "border-box" }} />
            <button onClick={verstuur} disabled={!tekst.trim()} style={{ ...S.knop(), opacity: tekst.trim() ? 1 : 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
              {alleMeer.length ? `${meer.length} taken toevoegen` : "Toevoegen"}
            </button>
          </div>
        )}
        {chips.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {chips.map(c => <span key={c} style={{ fontSize: 12, background: "#2D4A3E14", color: C.groen, borderRadius: 999, padding: "4px 10px", fontWeight: 600 }}>{c}</span>)}
            {voorbeeld?.titel && <span style={{ fontSize: 12, color: C.muted, padding: "4px 2px" }}>→ "{voorbeeld.titel}"</span>}
            {alleMeer.length > 0 && <span style={{ fontSize: 12, color: C.muted, padding: "4px 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>→ {meer.map(x => x.v.titel || x.t).join(" · ")}</span>}
          </div>
        )}
        <form onSubmit={e => { e.preventDefault(); verstuur(); }} style={{ display: "flex", gap: 6, background: C.kaart, border: `1px solid ${luistert ? C.rood : C.rand2}`, borderRadius: 16, padding: 6, boxShadow: "0 6px 18px rgba(45,42,38,.08)" }}>
          <input ref={invoerRef} value={tekst} onChange={e => { setTekst(e.target.value); setWeg([]); }} placeholder={luistert ? "Ik luister…" : placeholder} aria-label="Taak toevoegen"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 16, padding: "8px 10px", background: "transparent", minWidth: 0, fontFamily: "inherit", color: C.tekst }} />
          <button type="button" onClick={spraak} aria-label={luistert ? "Stoppen met inspreken" : "Taak inspreken"} title="Taak inspreken"
            style={{ ...S.knop(luistert ? C.rood : C.bg, luistert ? "#FAF6F0" : C.groen), border: `1px solid ${luistert ? C.rood : C.rand2}`, padding: "8px 11px", display: "flex", alignItems: "center", animation: luistert ? "luisterPuls 1.2s ease-in-out infinite" : "none" }}>
            {luistert ? <Square size={16} fill="#FAF6F0" /> : <Mic size={18} />}
          </button>
          {kanUitklappen ? (
            <button type="button" onClick={() => (paneel ? sluitPaneel() : openPaneel())} aria-label={paneel ? "Opties sluiten" : "Taak toevoegen met opties"} aria-expanded={!!paneel}
              style={{ ...S.knop(), padding: "8px 12px", display: "flex", alignItems: "center" }}>
              {paneel ? <ChevronDown size={18} /> : <Plus size={18} />}
            </button>
          ) : (
            <button type="submit" aria-label="Toevoegen" style={{ ...S.knop(), padding: "8px 12px", display: "flex", alignItems: "center" }}><Plus size={18} /></button>
          )}
        </form>
        <style>{"@keyframes luisterPuls{0%,100%{box-shadow:0 0 0 0 rgba(180,60,50,.45)}50%{box-shadow:0 0 0 7px rgba(180,60,50,0)}}"}</style>
      </div>
    </div>
  );
}

function KlantFilter({ klanten, klantFilter, setKlantFilter }) {
  if (!klanten.length) return null;
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "2px 0 10px" }}>
      <button style={S.chip(!klantFilter)} onClick={() => setKlantFilter(null)}>Alle klanten</button>
      {klanten.map(k => (
        <button key={k.id} style={{ ...S.chip(klantFilter === k.id), ...(klantFilter === k.id ? { background: k.kleur || C.groen, borderColor: k.kleur || C.groen } : {}) }} onClick={() => setKlantFilter(klantFilter === k.id ? null : k.id)}>
          <span style={{ color: klantFilter === k.id ? "#FAF6F0" : (k.kleur || C.groen) }}>●</span> {k.naam}
        </button>
      ))}
    </div>
  );
}

function LegeStaat({ terug, tekst }) {
  return (
    <main style={{ ...S.main, textAlign: "center", paddingTop: 80 }}>
      <p style={{ color: C.muted }}>{tekst}</p>
      <button style={S.knop()} onClick={terug}>Terug</button>
    </main>
  );
}

// ════════════════════════════════════════════════════════════════════
// SLIMME OVERZICHTEN
// ════════════════════════════════════════════════════════════════════
function SlimOverzicht({ id, regels, alleRegels, ruimteFilter, setRuimteFilter, klantFilter, setKlantFilter, klanten, werkStaat, vandaag, suggestiesOpen, setSuggestiesOpen, klantVan, chronoRef, terug, vink, ster, openTaak, naarMijnDag, voegToe, doelen, voegToeNaar, standaardDoel, basisExtra }) {
  const v = SLIM[id];
  const Icoon = v.icoon;
  const regel = (r) => (
    <TaakRegel key={`${r.ruimte}-${r.lijst.id}-${r.item.id}`} item={r.item} lijst={r.lijst} ruimte={r.ruimte} toonLijst
      klant={r.ruimte === "werk" ? klantVan(r.item.klantId) : null}
      vink={() => vink(r)} ster={() => ster(r)} open={() => openTaak(r)} />
  );
  // Suggesties voor Mijn dag (zoals in To Do): open taken die binnenkort
  // vervallen of belangrijk zijn, maar nog niet in Mijn dag staan.
  const suggesties = id === "mijndag"
    ? alleRegels.filter(r => (ruimteFilter === "alles" || r.ruimte === ruimteFilter) && !r.item.checked && !isInMijnDag(r.item, vandaag)
        && ((planDatum(r.item) && planDatum(r.item) <= plusDagen(vandaag, 3)) || r.item.belangrijk)).slice(0, 12)
    : [];
  const datumTekst = new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <header style={S.header}>
        <button onClick={terug} aria-label="Terug" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}><ChevronLeft size={22} color={C.groen} /></button>
        <Icoon size={22} color={v.kleur} />
        <h1 style={S.titel}>{v.label}</h1>
      </header>
      <main style={S.main}>
        {id === "mijndag" && <p style={{ margin: "-4px 4px 10px", color: C.muted, fontSize: 14 }}>{datumTekst}</p>}
        {werkStaat === "open" && id !== "aanmij" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[["alles", "Alles"], ["werk", "💼 Werk"], ["thuis", "🏠 Thuis"]].map(([k, l]) => (
              <button key={k} style={S.chip(ruimteFilter === k)} onClick={() => { setRuimteFilter(k); if (k === "thuis") setKlantFilter(null); }}>{l}</button>
            ))}
          </div>
        )}
        {ruimteFilter === "werk" && <KlantFilter {...{ klanten, klantFilter, setKlantFilter }} />}

        {id === "gepland" ? (
          groepeerGepland(regels.map(r => ({ ...r.item, __r: r })), vandaag).map(g => (
            <div key={g.id}>
              <p style={{ ...S.sectieKop, color: g.id === "telaat" ? C.rood : C.muted }}>{g.label} · {g.items.length}</p>
              <div style={S.kaart}>{g.items.map(i => regel(i.__r))}</div>
            </div>
          ))
        ) : (
          regels.length > 0 && <div style={S.kaart}>{sorteerTaken(regels.map(r => ({ ...r.item, __r: r })), id === "belangrijk" ? "vervaldatum" : "handmatig").map(i => regel(i.__r))}</div>
        )}

        {regels.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>
            <Icoon size={34} color={v.kleur} style={{ opacity: 0.5 }} />
            <p style={{ fontSize: 15, marginTop: 10 }}>
              {id === "mijndag" ? "Niets meer voor vandaag. Voeg iets toe, of kies uit de suggesties." :
                id === "belangrijk" ? "Geen belangrijke taken. Tik op het sterretje bij een taak." :
                  id === "gepland" ? "Geen taken met een datum of herinnering." : "Er is niets aan jou toegewezen."}
            </p>
          </div>
        )}

        {id === "mijndag" && suggesties.length > 0 && (
          <>
            <button onClick={() => setSuggestiesOpen(!suggestiesOpen)} style={{ ...S.sectieKop, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
              <ChevronDown size={14} style={{ transform: suggestiesOpen ? "none" : "rotate(-90deg)" }} /> Suggesties · {suggesties.length}
            </button>
            {suggestiesOpen && (
              <div style={S.kaart}>
                {suggesties.map(r => (
                  <TaakRegel key={`s-${r.item.id}`} item={r.item} lijst={r.lijst} ruimte={r.ruimte} toonLijst
                    klant={r.ruimte === "werk" ? klantVan(r.item.klantId) : null}
                    vink={() => vink(r)} ster={() => ster(r)} open={() => openTaak(r)}
                    extraKnop={<button onClick={() => naarMijnDag(r)} aria-label="Toevoegen aan Mijn dag" title="Toevoegen aan Mijn dag" style={{ ...S.chip(false), padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}><Plus size={13} /><Sun size={13} color={C.oranje} /></button>} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <InvoerBalk chronoRef={chronoRef} voegToe={voegToe} {...{ doelen, voegToeNaar, standaardDoel, basisExtra, vandaag }} klanten={klanten.filter(k => !k.gearchiveerd)}
        placeholder={ruimteFilter === "werk" && werkStaat === "open"
          ? (klantFilter && klanten.find(k => k.id === klantFilter) ? `Algemene taak voor ${klanten.find(k => k.id === klantFilter).naam}…` : "Werktaak toevoegen…")
          : "Taak toevoegen — bv. 'morgen 9:00 tandarts bellen'"} />
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// ÉÉN LIJST
// ════════════════════════════════════════════════════════════════════
function LijstWeergave({ afwezigheden = [], openPlanning, openCall, doelen, voegToeNaar, vandaag, ruimte, lijst, klanten, klantFilter, setKlantFilter, klantVan, voltooidOpen, setVoltooidOpen, chronoRef, terug, vink, ster, openTaak, voegToe, wijzig, verwijder, wisVoltooid, sjabloon, verschuif, zetProject, openLeren, openAkkoord, openAfwijzen, nagevraagd, openOnderdelen, zetDagen, openCallsheet, openOfferteVanAanvraag, zetOpzet, meld, vulPlekken, zetDeadline, openVersie }) {
  const [menu, setMenu] = useState(false);
  const isAanvraag = projectStatus(lijst) === "aanvraag";
  const isOfferte = projectStatus(lijst) === "offerte" || isAanvraag;
  const isProject = !!lijst.project && !isOfferte;
  const eersteOpenFase = isProject ? (FASES.find(f => (lijst.items || []).some(i => i.category === f.id && !i.checked)) || FASES[0]).id : null;
  const [gekozenFase, setNieuweFase] = useState(eersteOpenFase);
  // Werd de lijst pas net een project (akkoord), dan was er nog geen fase gekozen.
  const nieuweFase = FASES.some(f => f.id === gekozenFase) ? gekozenFase : (eersteOpenFase || "pre");
  const [naam, setNaam] = useState(lijst.name);
  useEffect(() => setNaam(lijst.name), [lijst.id, lijst.name]);
  const sortering = lijst.takenSortering || "handmatig";
  const items = (lijst.items || []).filter(i => !klantFilter || i.klantId === klantFilter);
  const open = sorteerTaken(items.filter(i => !i.checked), sortering);
  const klaar = items.filter(i => i.checked).sort((a, b) => (b.voltooidOp || b.lastActionAt || 0) - (a.voltooidOp || a.lastActionAt || 0));
  const regel = (i) => (
    <TaakRegel key={i.id} item={i} lijst={lijst} ruimte={ruimte} klant={ruimte === "werk" ? klantVan(i.klantId) : null}
      vink={() => vink(i)} ster={() => ster(i)} open={() => openTaak(i)} />
  );
  return (
    <>
      <header style={S.header}>
        <button onClick={terug} aria-label="Terug" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}><ChevronLeft size={22} color={C.groen} /></button>
        <span style={{ fontSize: 22 }}>{lijst.icon}</span>
        <h1 style={S.titel}>{lijst.name}</h1>
        {!isProject && <span style={{ fontSize: 11, color: C.muted, border: `1px solid ${C.rand2}`, borderRadius: 999, padding: "3px 8px" }}>{ruimte === "werk" ? "💼 Werk" : "🏠 Thuis"}</span>}
        <button onClick={() => setMenu(!menu)} aria-label="Lijstopties" style={{ ...S.chip(menu), padding: "5px 10px" }}>•••</button>
      </header>
      <main style={S.main}>
        {menu && (
          <div style={{ ...S.kaart, padding: 14 }}>
            <p style={{ ...S.label, marginTop: 0 }}>Naam</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={S.inp} value={naam} onChange={e => setNaam(e.target.value)} />
              <button style={S.knop()} onClick={() => { if (naam.trim()) wijzig({ name: naam.trim() }); }}>Bewaar</button>
            </div>
            <p style={S.label}>Icoon</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {LIJST_ICONEN.map(ic => <button key={ic} onClick={() => wijzig({ icon: ic })} style={{ ...S.chip(lijst.icon === ic), padding: "6px 9px", fontSize: 17 }}>{ic}</button>)}
            </div>
            <p style={S.label}>Sorteren</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[["handmatig", "Toegevoegd"], ["vervaldatum", "Datum"], ["belangrijk", "Belangrijk eerst"], ["alfabetisch", "A–Z"]].map(([k, l]) => (
                <button key={k} style={S.chip(sortering === k)} onClick={() => wijzig({ takenSortering: k })}>{l}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <button style={S.knop(C.bg, C.tekst)} onClick={wisVoltooid}>Voltooide wissen</button>
              <button style={{ ...S.knop("#FBEDE8", C.rood), display: "flex", alignItems: "center", gap: 6 }} onClick={verwijder}><Trash2 size={15} /> Lijst verwijderen</button>
            </div>
            {ruimte === "thuis" && <p style={S.hint}>Deze lijst staat ook in Lijsten en is gedeeld met het hele huishouden.</p>}
            {lijst.mailInbox && <p style={S.hint}>📥 Hier komen taken binnen die je naar je taken-e-mailadres stuurt.</p>}
          </div>
        )}
        {isProject && <ProjectKop {...{ lijst, klanten, klantVan, sjabloon, verschuif, zetProject, openLeren, openOnderdelen, zetDagen, openCallsheet, zetOpzet, meld, vulPlekken, openVersie, openPlanning }} />}
        {isAanvraag && <AanvraagKop {...{ lijst, klanten, klantVan, zetProject, openAkkoord, openAfwijzen, openOfferteVanAanvraag, zetDeadline }} />}
        {isOfferte && !isAanvraag && <OfferteKop {...{ lijst, klanten, klantVan, zetProject, openAkkoord, openAfwijzen, nagevraagd, meld, openVersie }} />}
        {ruimte === "werk" && lijst.project && !lijst.project.afgerond && <AfwezigheidMelding conflicten={afwezigheidConflicten(lijst, afwezigheden)} klantVan={klantVan} openPlanning={openPlanning} />}
        {ruimte === "werk" && lijst.project && openCall && <CallsBlok lijst={lijst} openCall={openCall} />}
        {ruimte === "werk" && !isProject && <KlantFilter {...{ klanten, klantFilter, setKlantFilter }} />}
        {isProject && open.length > 0 ? (
          [...FASES, { id: "__overig", label: "Overig", icon: "📌" }].map(f => {
            const inFase = open.filter(i => (f.id === "__overig" ? !FASES.some(x => x.id === i.category) : i.category === f.id));
            if (!inFase.length) return null;
            const totaal = (lijst.items || []).filter(i => i.category === f.id).length;
            const klaarN = (lijst.items || []).filter(i => i.category === f.id && i.checked).length;
            return (
              <div key={f.id}>
                <p style={S.sectieKop}>{f.icon} {f.label} {f.id !== "__overig" && <span style={{ fontWeight: 400 }}>· {klaarN}/{totaal}</span>}</p>
                <div style={S.kaart}>{inFase.map(regel)}</div>
              </div>
            );
          })
        ) : open.length > 0 ? <div style={S.kaart}>{open.map(regel)}</div> : (
          <p style={{ textAlign: "center", color: C.muted, padding: "36px 20px", fontSize: 15 }}>
            {klaar.length ? "Alles gedaan! 🎉" : "Nog geen taken. Typ hieronder — bijvoorbeeld \"vrijdag 10:00 offerte sturen\"."}
          </p>
        )}
        {klaar.length > 0 && (
          <>
            <button onClick={() => setVoltooidOpen(!voltooidOpen)} style={{ ...S.sectieKop, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
              <ChevronDown size={14} style={{ transform: voltooidOpen ? "none" : "rotate(-90deg)" }} /> Voltooid · {klaar.length}
            </button>
            {voltooidOpen && <div style={S.kaart}>{klaar.map(regel)}</div>}
          </>
        )}
      </main>
      <InvoerBalk chronoRef={chronoRef} {...{ doelen, voegToeNaar, vandaag }} klanten={(klanten || []).filter(k => !k.gearchiveerd)}
        standaardDoel={{ ruimte, listId: lijst.id, fase: nieuweFase }}
        basisExtra={ruimte === "werk" && klantFilter ? { klantId: klantFilter } : {}}
        voegToe={(tekst) => voegToe(tekst, isProject ? { category: nieuweFase } : {})}
        placeholder={isProject ? `Taak toevoegen aan ${FASES.find(f => f.id === nieuweFase)?.label.toLowerCase()}…` : ruimte === "werk" ? "Werktaak toevoegen — bv. 'vrijdag offerte sturen'" : "Taak toevoegen — bv. 'morgen 9:00 tandarts bellen'"}
        boven={isProject && (
          <div style={{ display: "flex", gap: 6, marginBottom: 6, overflowX: "auto" }}>
            {FASES.map(f => <button key={f.id} style={{ ...S.chip(nieuweFase === f.id), padding: "5px 10px", fontSize: 12 }} onClick={() => setNieuweFase(f.id)}>{f.icon} {f.label}</button>)}
          </div>
        )} />
    </>
  );
}

// Projectkop: klant, draaidag, oplevering, voortgang per fase en "leren".
function ProjectKop({ lijst, klanten, klantVan, sjabloon, verschuif, zetProject, openLeren, openOnderdelen, zetDagen, openCallsheet, zetOpzet, meld, vulPlekken, openVersie, openPlanning }) {
  const p = lijst.project;
  const vg = projectVoortgang(lijst);
  const klant = klantVan(p.klantId);
  const [draai, setDraai] = useState(p.draaidag);
  const [oplever, setOplever] = useState(p.opleverdatum);
  useEffect(() => { setDraai(p.draaidag); setOplever(p.opleverdatum); }, [p.draaidag, p.opleverdatum]);
  const gewijzigd = draai !== p.draaidag || oplever !== p.opleverdatum;
  const [bezettingOpen, setBezettingOpen] = useState(false);
  const alles = vg.reduce((n, f) => n + f.totaal, 0), klaar = vg.reduce((n, f) => n + f.klaar, 0);
  return (
    <div style={{ ...S.kaart, padding: 14 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select value={p.klantId || ""} onChange={e => zetProject({ klantId: e.target.value || null })} aria-label="Klant"
          style={{ ...S.inp, width: "auto", padding: "6px 10px", fontSize: 13, color: klant?.kleur || C.tekst, fontWeight: 700 }}>
          <option value="">Geen klant</option>
          {klanten.map(k => <option key={k.id} value={k.id}>● {k.naam}</option>)}
        </select>
        <span style={{ fontSize: 12, color: C.muted }}>{p.los ? "📂 Los project" : `📐 ${sjabloon?.naam || p.sjabloonNaam || "sjabloon verwijderd"}`}{p.offerteNietDoorMij && !p.los ? " · offerte niet door mij" : ""}</span>
        {(p.los || p.offerteNietDoorMij) && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 100%", fontSize: 12, color: C.muted, fontWeight: 700 }}>🤝 VIA
            <input aria-label="Opdracht via" defaultValue={p.opdrachtVia || ""} key={p.opdrachtVia || ""} placeholder="bureau of productiehuis (optioneel)"
              onBlur={e => { const v = e.target.value.trim().slice(0, 80); if (v !== (p.opdrachtVia || "")) zetProject({ opdrachtVia: v || null }); }}
              style={{ ...S.inp, flex: 1, minWidth: 0, padding: "6px 10px", fontSize: 14, fontWeight: 400 }} />
          </label>
        )}
      </div>
      {p.deliverables && deliverablesTekst(p.deliverables) && (
        <p style={{ margin: "8px 0 0", fontSize: 13 }}>📦 <strong>Deliverables:</strong> {deliverablesTekst(p.deliverables)}</p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <label style={{ flex: 1, fontSize: 11, color: C.muted, fontWeight: 700 }}>🎬 {draaidagenVan(p).length > 1 ? "DRAAIDAG 1" : "DRAAIDAG"}
          <input type="date" value={draai || ""} onChange={e => { setDraai(e.target.value); if (!p.draaidag || !p.opleverdatum) zetProject({ draaidag: e.target.value || null }); }} style={{ ...S.inp, padding: "8px 10px", fontSize: 14, marginTop: 4 }} />
        </label>
        <label style={{ flex: 1, fontSize: 11, color: C.muted, fontWeight: 700 }}>📦 OPLEVERING
          <input type="date" value={oplever || ""} onChange={e => { setOplever(e.target.value); if (!p.draaidag || !p.opleverdatum) zetProject({ opleverdatum: e.target.value || null }); }} style={{ ...S.inp, padding: "8px 10px", fontSize: 14, marginTop: 4 }} />
        </label>
      </div>
      <DraaidagenRegel p={p} zetDagen={zetDagen} openCallsheet={openCallsheet} />
      <OpzetRegel p={p} zetOpzet={zetOpzet} />
      {/* Campagne live: startpunt van de buy-outs (leeg = opleverdatum). */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, color: C.muted, fontWeight: 700 }}>
        📡 CAMPAGNE LIVE
        <input type="date" value={p.liveDatum || ""} onChange={e => zetProject({ liveDatum: e.target.value || null })} aria-label="Campagne live"
          style={{ ...S.inp, padding: "6px 8px", fontSize: 13, width: "auto" }} />
        {!p.liveDatum && <span style={{ fontWeight: 400 }}>leeg = oplevering</span>}
      </label>
      {gewijzigd && draai && oplever && p.draaidag && p.opleverdatum && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>Open taken schuiven evenveel dagen mee.</span>
          <button style={{ ...S.knop(C.bg, C.tekst), padding: "7px 12px" }} onClick={() => { setDraai(p.draaidag); setOplever(p.opleverdatum); }}>Annuleer</button>
          <button style={{ ...S.knop(), padding: "7px 12px" }} onClick={() => verschuif({ draaidag: draai, opleverdatum: oplever })}>Planning verschuiven</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        {vg.map(f => (
          <div key={f.id} style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>{f.icon} {f.klaar}/{f.totaal}</div>
            <div style={{ height: 5, borderRadius: 5, background: "#EFE9DC", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${f.totaal ? (100 * f.klaar) / f.totaal : 0}%`, background: C.groen }} />
            </div>
          </div>
        ))}
      </div>
      {(() => {
        const sam = bezettingSamenvatting(lijst.items);
        const openPlekken = (lijst.items || []).flatMap(i => (i.bezetting || []).filter(b => !b.naam && b.offerte)).length;
        if (!sam.aantal && !openPlekken) return null;
        const bedragen = Object.entries(sam.perEenheid).map(([e, b]) => prijsTekst(b, e)).join(" + ");
        return (
          <button onClick={() => setBezettingOpen(!bezettingOpen)} style={{ ...S.rij, padding: "10px 0 0", borderBottom: "none" }}>
            <span style={{ fontSize: 13, flex: 1 }}>👥 <strong>{sam.bevestigd}/{sam.aantal + openPlekken}</strong> bevestigd{openPlekken ? <span style={{ color: C.oranje, fontWeight: 700 }}> · {openPlekken} nog te regelen</span> : ""}{bedragen ? ` · ${bedragen}` : ""}</span>
            <ChevronDown size={15} color={C.licht} style={{ transform: bezettingOpen ? "none" : "rotate(-90deg)" }} />
          </button>
        );
      })()}
      {bezettingOpen && <BezettingOverzicht lijst={lijst} />}
      {offerteVersies(p).length > 0 && <OffertesBlok lijst={lijst} openVersie={openVersie} nogVoorAkkoord={false} />}
      <SpecificatieBlok lijst={lijst} klantNaam={klant?.naam} zetProject={zetProject} meld={meld} vulPlekken={vulPlekken} />
      <BegrotingBlok lijst={lijst} zetProject={zetProject} />
      {p.intake?.tekst && <IntakeBlok intake={p.intake} zetTekst={(tekst) => zetProject({ intake: { ...p.intake, tekst } })} />}
      {projectStatus(lijst) === "lopend" && !lijst.project.afgerond && openPlanning && (() => {
        const weekendAantal = (lijst.items || []).filter(i => !i.checked && i.dueDate && isVrijeDag(i.dueDate) && !isVastePlanning(i)).length;
        return (
          <button onClick={openPlanning} style={{ ...S.knop(C.bg, C.groen), width: "100%", marginTop: 12, border: `1px solid ${C.rand2}` }}>
            📅 Planning — taken verschuiven {weekendAantal > 0 && <span style={{ fontWeight: 600, color: C.oranje }}>— ⚠️ {weekendAantal} op een vrije dag</span>}
          </button>
        );
      })()}
      {projectStatus(lijst) === "lopend" && !lijst.project.afgerond && (
        <button onClick={openOnderdelen} style={{ ...S.knop(C.bg, C.groen), width: "100%", marginTop: 12, border: `1px solid ${C.rand2}` }}>
          🧩 Onderdelen aan/uit <span style={{ fontWeight: 400, color: C.muted }}>— cast, locaties, crew, hotel…</span>
        </button>
      )}
      <button onClick={openLeren} style={{ ...S.knop(klaar === alles && alles ? C.groen : C.bg, klaar === alles && alles ? "#FAF6F0" : C.groen), width: "100%", marginTop: 12, border: `1px solid ${C.rand2}` }}>
        {p.los || !p.sjabloonId ? (p.afgerond ? "✅ Afgerond" : "✅ Project afronden") : <>🧠 {p.afgerond ? "Opnieuw leren van dit project" : klaar === alles && alles ? "Alles klaar — afronden en sjabloon laten leren" : "Afronden & sjabloon laten leren"}</>}
      </button>
    </div>
  );
}

// ── Meerdere draaidagen: extra dagen toevoegen/verwijderen + callsheet per dag ──
function DraaidagenRegel({ p, zetDagen, openCallsheet }) {
  const dagen = draaidagenVan(p);
  const [nieuw, setNieuw] = useState(false);
  if (!p.draaidag) return null;
  const voegToe = () => {
    const laatste = dagen[dagen.length - 1]?.datum || p.draaidag;
    zetDagen([...dagen, { id: uid(), datum: plusDagen(laatste, 1) }]);
  };
  return (
    <div style={{ marginTop: 8 }}>
      {dagen.length > 1 && dagen.slice(1).map((d, n) => (
        <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 700, width: 86 }}>🎬 DRAAIDAG {n + 2}</span>
          <input type="date" value={d.datum} aria-label={`Draaidag ${n + 2}`}
            onChange={e => e.target.value && zetDagen(dagen.map(x => (x.id === d.id ? { ...x, datum: e.target.value } : x)))}
            style={{ ...S.inp, padding: "6px 8px", fontSize: 14, flex: 1 }} />
          <button onClick={() => window.confirm(`Draaidag ${n + 2} weghalen?`) && zetDagen(dagen.filter(x => x.id !== d.id))} aria-label={`Draaidag ${n + 2} verwijderen`}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} color={C.licht} /></button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <button onClick={voegToe} style={{ ...S.chip(false), padding: "5px 10px", fontSize: 12 }}>+ Draaidag</button>
        {dagen.map((d, n) => (
          <button key={d.id} onClick={() => openCallsheet(d.id)} style={{ ...S.chip(false), padding: "5px 10px", fontSize: 12, borderColor: C.groen, color: C.groen, fontWeight: 700 }}>
            📋 Callsheet{dagen.length > 1 ? ` dag ${n + 1}` : ""}{p.callsheets?.[d.id] ? " ✓" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Begroting: offerte tegenover de kosten van alle namen + overige posten ──
const euro = (n) => `€ ${Number(n || 0).toLocaleString("nl-NL", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
function BegrotingBlok({ lijst, zetProject }) {
  const p = lijst.project;
  const b = projectBegroting(lijst);
  const [open, setOpen] = useState(false);
  const [budget, setBudget] = useState(p.budget != null ? String(p.budget).replace(".", ",") : "");
  if (!b.regels.length && !b.posten.length && b.offerte == null && !open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...S.rij, padding: "10px 0 0", borderBottom: "none" }}>
        <span style={{ fontSize: 13, flex: 1, color: C.muted }}>💶 Begroting — offerte tegenover kosten</span>
        <ChevronDown size={15} color={C.licht} style={{ transform: "rotate(-90deg)" }} />
      </button>
    );
  }
  const md = useContext(MargeContext);
  const status = b.overschreden ? "te-laag" : margeStatus(b.margePct, md);
  const kleur = status ? MARGE_KLEUR[status] : C.groen;
  const posten = p.kostenposten || [];
  const zetPosten = (next) => zetProject({ kostenposten: next });
  return (
    <div>
      <button onClick={() => setOpen(!open)} style={{ ...S.rij, padding: "10px 0 0", borderBottom: "none" }} aria-label="Begroting">
        <span style={{ fontSize: 13, flex: 1 }}>
          💶 <strong>{euro(b.inclOpties)}</strong> kosten{b.offerte != null ? <> van <strong>{euro(b.offerte)}</strong> · <span style={{ color: kleur, fontWeight: 700 }}>{b.overschreden ? `${euro(-b.marge)} over budget` : `marge ${euro(b.marge)} (${b.margePct}%)`}</span></> : ""}
        </span>
        <ChevronDown size={15} color={C.licht} style={{ transform: open ? "none" : "rotate(-90deg)" }} />
      </button>
      {b.overschreden && !open && <p style={{ ...S.hint, color: C.rood, fontWeight: 700 }}>⚠️ De kosten (incl. opties) zijn hoger dan de offerte.</p>}
      {!b.overschreden && status === "te-laag" && !open && <p style={{ ...S.hint, color: C.rood, fontWeight: 700 }}>⚠️ Marge {b.margePct}% — onder je minimum van {md.minimum}%.</p>}
      {open && (
        <div style={{ marginTop: 8, background: C.bg, borderRadius: 12, padding: 10 }}>
          {p.offerte?.bedrag != null ? (
            <p style={{ margin: "0 0 8px", fontSize: 13 }}>Offerte: <strong>{euro(p.offerte.bedrag)}</strong></p>
          ) : (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 8 }}>Budget / offerte €
              <input value={budget} inputMode="decimal" placeholder="bv. 25.000" aria-label="Budget"
                onChange={e => setBudget(e.target.value)} onBlur={() => zetProject({ budget: leesBedragInvoer(budget) })}
                style={{ ...S.inp, padding: "6px 8px", fontSize: 14, width: 120 }} />
            </label>
          )}
          {b.regels.map(r => (
            <div key={r.id} style={{ display: "flex", gap: 8, fontSize: 13, padding: "4px 0", borderBottom: `1px solid ${C.rand}` }}>
              <span style={{ width: 12 }}>{r.status === "bevestigd" ? "✅" : "○"}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{r.naam} <span style={{ color: C.muted }}>· {onderdeelVan(r.onderdeelId)?.label || r.taak}</span></span>
              <span style={{ whiteSpace: "nowrap", textAlign: "right", color: r.bedrag == null ? C.oranje : C.tekst }}>
                {r.bedrag == null ? "geen prijs" : euro(r.kosten.totaal)}
                {r.bedrag != null && r.eenheid !== "totaal" && <span style={{ display: "block", fontSize: 11, color: C.muted }}>{r.kosten.aantal} × {prijsTekst(r.bedrag, r.eenheid)}{r.kosten.buyouts ? ` + buy-out ${euro(r.kosten.buyouts)}` : ""}</span>}
                {r.bedrag != null && r.eenheid === "totaal" && r.kosten.buyouts > 0 && <span style={{ display: "block", fontSize: 11, color: C.muted }}>incl. buy-out {euro(r.kosten.buyouts)}</span>}
              </span>
            </div>
          ))}
          <p style={{ ...S.label, margin: "10px 0 4px" }}>Overige kosten</p>
          {posten.map(k => <KostenpostRegel key={k.id} k={k} wijzig={(v) => zetPosten(posten.map(x => (x.id === k.id ? { ...x, ...v } : x)))} verwijder={() => zetPosten(posten.filter(x => x.id !== k.id))} />)}
          <button onClick={() => zetPosten([...posten, { id: uid(), omschrijving: "", bedrag: null }])} style={{ ...S.chip(false), padding: "5px 10px", fontSize: 12 }}>+ Kostenpost (huur, reis, materiaal…)</button>
          <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ display: "flex" }}><span style={{ flex: 1 }}>Bevestigd</span><strong>{euro(b.bevestigd)}</strong></div>
            <div style={{ display: "flex" }}><span style={{ flex: 1 }}>Incl. opties / aangevraagd</span><strong>{euro(b.inclOpties)}</strong></div>
            {b.buyouts > 0 && <div style={{ display: "flex", color: C.muted }}><span style={{ flex: 1 }}>waarvan buy-outs</span>{euro(b.buyouts)}</div>}
            {b.offerte != null && <div style={{ display: "flex", color: kleur, fontWeight: 700 }}><span style={{ flex: 1 }}>{b.overschreden ? "Over budget" : "Marge"}</span>{euro(Math.abs(b.marge))} ({b.margePct}%)</div>}
          </div>
          {b.offerte != null && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.6 }}>
              <div style={{ display: "flex" }}><span style={{ flex: 1 }}>Max. kosten voor {md.minimum}% marge</span><span>{euro(kostenPlafond(b.offerte, md.minimum))}{b.inclOpties <= kostenPlafond(b.offerte, md.minimum) ? ` · nog ${euro(kostenPlafond(b.offerte, md.minimum) - b.inclOpties)} ruimte` : ""}</span></div>
              <div style={{ display: "flex" }}><span style={{ flex: 1 }}>Max. kosten voor {md.doel}% marge</span><span>{euro(kostenPlafond(b.offerte, md.doel))}</span></div>
            </div>
          )}
          <MargeDoelInstelling />
          {b.zonderPrijs > 0 && <p style={{ ...S.hint, color: C.oranje }}>{b.zonderPrijs} {b.zonderPrijs === 1 ? "naam heeft" : "namen hebben"} nog geen prijs — die tellen nog niet mee.</p>}
          <p style={S.hint}>Dagprijzen tellen × {b.draaidagen} {b.draaidagen === 1 ? "draaidag" : "draaidagen"}, tenzij je bij de naam een ander aantal invult.</p>
        </div>
      )}
    </div>
  );
}
function KostenpostRegel({ k, wijzig, verwijder }) {
  const [oms, setOms] = useState(k.omschrijving || "");
  const [bedrag, setBedrag] = useState(k.bedrag != null ? String(k.bedrag).replace(".", ",") : "");
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
      <input value={oms} placeholder="Omschrijving" aria-label="Omschrijving kostenpost" onChange={e => setOms(e.target.value)} onBlur={() => oms !== (k.omschrijving || "") && wijzig({ omschrijving: oms.trim() })}
        style={{ ...S.inp, padding: "6px 8px", fontSize: 13 }} />
      <input value={bedrag} inputMode="decimal" placeholder="€" aria-label="Bedrag kostenpost" onChange={e => setBedrag(e.target.value)} onBlur={() => wijzig({ bedrag: leesBedragInvoer(bedrag) })}
        style={{ ...S.inp, padding: "6px 8px", fontSize: 13, width: 100 }} />
      <button onClick={verwijder} aria-label="Kostenpost verwijderen" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={15} color={C.licht} /></button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// CALLSHEET — per draaidag, vooraf ingevuld uit het project; download als
// Excel in de opmaak van je eigen template.
// ════════════════════════════════════════════════════════════════════
const CS_INP = { ...S.inp, padding: "6px 8px", fontSize: 13 };
function CsRijen({ rijen, velden, zet, nieuw, toevoegTekst = "+ Regel" }) {
  return (
    <div>
      {rijen.map((r, n) => (
        <div key={n} style={{ display: "flex", gap: 5, marginBottom: 5, alignItems: "center", ...(r.geel ? { background: "#FFF8C4", borderRadius: 8, padding: 3 } : {}) }}>
          {velden.map(v => (
            <input key={v.key} value={r[v.key] || ""} placeholder={v.placeholder} aria-label={v.placeholder}
              onChange={e => zet(rijen.map((x, i) => (i === n ? { ...x, [v.key]: e.target.value } : x)))}
              style={{ ...CS_INP, ...(v.breedte ? { width: v.breedte, flexShrink: 0 } : {}) }} />
          ))}
          <button onClick={() => zet(rijen.filter((_, i) => i !== n))} aria-label="Regel verwijderen" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={14} color={C.licht} /></button>
        </div>
      ))}
      {nieuw && <button onClick={() => zet([...rijen, nieuw()])} style={{ ...S.chip(false), padding: "4px 9px", fontSize: 12 }}>{toevoegTekst}</button>}
    </div>
  );
}
function CsSectie({ titel, children, extra }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", background: "#404040", color: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}>
        <span style={{ flex: 1 }}>{titel}</span>{extra}
      </div>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}
function verkleinLogo(bestand) {
  return new Promise((ok, fout) => {
    const lezer = new FileReader();
    lezer.onerror = fout;
    lezer.onload = () => {
      const img = new Image();
      img.onerror = fout;
      img.onload = () => {
        const schaal = Math.min(1, 480 / img.width, 200 / img.height);
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * schaal)); c.height = Math.max(1, Math.round(img.height * schaal));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        ok({ dataUrl: c.toDataURL("image/png"), breedte: c.width, hoogte: c.height });
      };
      img.src = lezer.result;
    };
    lezer.readAsDataURL(bestand);
  });
}

function CallsheetSheet({ lijst, dagId, klant, instellingen, logos, sluit, kiesDag, bewaar, bewaarInstellingen, voegLogoToe, meld }) {
  const p = lijst.project;
  const dagen = draaidagenVan(p);
  const [wijz, setWijz] = useState(() => (p.callsheets || {})[dagId] || {});
  const [vuil, setVuil] = useState(false);
  const [notesOnthouden, setNotesOnthouden] = useState(false);
  const [ins, setIns] = useState({ mijnNaam: "", mijnTelefoon: "", productiebedrijf: "", ...instellingen });
  const [bezig, setBezig] = useState(false);
  const [gegevensOpen, setGegevensOpen] = useState(!instellingen.mijnNaam);
  useEffect(() => { setWijz((p.callsheets || {})[dagId] || {}); setVuil(false); }, [dagId]);
  const cs = bouwCallsheet({ ...lijst, project: { ...p, callsheets: { ...(p.callsheets || {}), [dagId]: wijz } } }, dagId, { klant, instellingen: { ...instellingen, ...ins } });
  const zet = (velden) => { setWijz(w => ({ ...w, ...velden })); setVuil(true); };
  const kanDelen = typeof navigator !== "undefined" && !!navigator.canShare;

  function opslaan() {
    if (!vuil) return;
    bewaar(lijst.id, cs.dagId, wijz, cs, { onthoudNotes: notesOnthouden && !!wijz.notes });
    setVuil(false);
  }
  function bewaarIns() {
    const velden = { mijnNaam: ins.mijnNaam.trim(), mijnTelefoon: ins.mijnTelefoon.trim(), productiebedrijf: ins.productiebedrijf.trim() };
    if (["mijnNaam", "mijnTelefoon", "productiebedrijf"].some(k => (instellingen[k] || "") !== velden[k])) bewaarInstellingen(velden);
  }
  async function maakExcel(delen) {
    setBezig(true);
    try {
      opslaan();
      const ExcelJS = (await import("exceljs")).default;
      const logoData = {};
      for (const slot of ["productie", "agency", "klant"]) {
        const l = logos.find(x => x.id === cs.logos[slot]);
        if (l) logoData[slot] = { base64: l.dataUrl.split(",")[1], extension: /jpeg/.test(l.dataUrl) ? "jpeg" : "png", breedte: l.breedte, hoogte: l.hoogte };
      }
      const wb = maakCallsheetWerkboek(cs, ExcelJS, logoData);
      const buf = await wb.xlsx.writeBuffer();
      const naam = callsheetBestandsnaam(cs);
      const type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const file = typeof File !== "undefined" ? new File([buf], naam, { type }) : null;
      if (delen && file && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: naam.replace(/\.xlsx$/, "").replace(/_/g, " ") }); } catch (e) { if (e?.name !== "AbortError") throw e; }
      } else {
        const url = URL.createObjectURL(new Blob([buf], { type }));
        const a = document.createElement("a");
        a.href = url; a.download = naam; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        meld("📋 Callsheet gedownload");
      }
    } catch (e) {
      console.error(e);
      meld("⚠️ Callsheet maken mislukt");
    } finally { setBezig(false); }
  }
  async function uploadLogo(slot, bestand) {
    if (!bestand) return;
    try {
      const l = await verkleinLogo(bestand);
      const id = voegLogoToe({ naam: bestand.name.replace(/\.[^.]+$/, "").slice(0, 60), ...l });
      zet({ logos: { ...(wijz.logos || {}), [slot]: id } });
    } catch { meld("⚠️ Dit plaatje kon niet worden gelezen"); }
  }
  const sluitEnBewaar = () => { opslaan(); bewaarIns(); sluit(); };
  const sam = callsheetSamenvatting(cs);
  const castDetails = wijz.castDetails || {};

  return (
    <div style={S.sheetAchter} onClick={sluitEnBewaar}>
      <div style={{ ...S.sheet, paddingBottom: 0 }} onClick={e => e.stopPropagation()} role="dialog" aria-label="Callsheet">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 19, flex: 1 }}>📋 Callsheet</h2>
          <button onClick={sluitEnBewaar} aria-label="Sluiten" style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}><X size={20} color={C.licht} /></button>
        </div>
        <p style={{ ...S.hint, marginTop: 2 }}>{datumLang(cs.datum)}{cs.aantalDagen > 1 ? ` · draaidag ${cs.dagNr} van ${cs.aantalDagen}` : ""}. Vooraf ingevuld uit het project — alles is aan te passen.</p>
        {dagen.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {dagen.map((d, n) => (
              <button key={d.id} onClick={() => { opslaan(); kiesDag(d.id); }} style={{ ...S.chip(d.id === cs.dagId), padding: "5px 10px", fontSize: 12 }}>Dag {n + 1}</button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 10, background: C.bg, borderRadius: 12, padding: "8px 10px", fontSize: 12, lineHeight: 1.6 }}>
          {sam.map((s, i) => <div key={i}><strong>{s.split(":")[0]}:</strong>{s.slice(s.indexOf(":") + 1)}</div>)}
        </div>

        <button onClick={() => setGegevensOpen(!gegevensOpen)} style={{ ...S.rij, padding: "10px 0 0", borderBottom: "none" }}>
          <span style={{ fontSize: 13, flex: 1, fontWeight: 700 }}>⚙️ Jouw gegevens <span style={{ fontWeight: 400, color: C.muted }}>— voor elke callsheet</span></span>
          <ChevronDown size={15} color={C.licht} style={{ transform: gegevensOpen ? "none" : "rotate(-90deg)" }} />
        </button>
        {gegevensOpen && (
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <input value={ins.mijnNaam} placeholder="Jouw naam" aria-label="Jouw naam" onChange={e => setIns({ ...ins, mijnNaam: e.target.value })} onBlur={bewaarIns} style={{ ...CS_INP, flex: "1 1 140px", width: "auto" }} />
            <input value={ins.mijnTelefoon} type="tel" placeholder="Jouw telefoon" aria-label="Jouw telefoon" onChange={e => setIns({ ...ins, mijnTelefoon: e.target.value })} onBlur={bewaarIns} style={{ ...CS_INP, flex: "1 1 120px", width: "auto" }} />
            <input value={ins.productiebedrijf} placeholder="Productiebedrijf" aria-label="Productiebedrijf" onChange={e => setIns({ ...ins, productiebedrijf: e.target.value })} onBlur={bewaarIns} style={{ ...CS_INP, flex: "1 1 140px", width: "auto" }} />
          </div>
        )}

        <CsSectie titel="KOP">
          <input value={cs.titel} aria-label="Titel" onChange={e => zet({ titel: e.target.value })} style={{ ...CS_INP, fontWeight: 700, marginBottom: 5 }} />
          <div style={{ display: "flex", gap: 5 }}>
            <input value={cs.plaats} placeholder="Plaats, bv. Ostercappeln (Duitsland)" aria-label="Plaats" onChange={e => zet({ plaats: e.target.value })} style={CS_INP} />
            <input value={cs.setTelefoon} placeholder="Set telefoon" aria-label="Set telefoon" onChange={e => zet({ setTelefoon: e.target.value })} style={CS_INP} />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {[["productie", "Productie"], ["agency", "Bureau"], ["klant", "Klant"]].map(([slot, label]) => {
              const huidig = logos.find(l => l.id === cs.logos[slot]);
              return (
                <div key={slot} style={{ flex: 1, minWidth: 0, background: C.bg, borderRadius: 10, padding: 6, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>LOGO {label.toUpperCase()}</div>
                  <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center", margin: "4px 0" }}>
                    {huidig ? <img src={huidig.dataUrl} alt={huidig.naam} style={{ maxHeight: 40, maxWidth: "100%" }} /> : <span style={{ fontSize: 11, color: C.licht }}>geen</span>}
                  </div>
                  <select value={cs.logos[slot] || ""} aria-label={`Logo ${label}`} onChange={e => { if (e.target.value === "__upload") { document.getElementById(`logo-${slot}`).click(); return; } zet({ logos: { ...(wijz.logos || {}), [slot]: e.target.value || null } }); }}
                    style={{ ...CS_INP, padding: "4px", fontSize: 11 }}>
                    <option value="">Geen</option>
                    {logos.map(l => <option key={l.id} value={l.id}>{l.naam}</option>)}
                    <option value="__upload">＋ Uploaden…</option>
                  </select>
                  <input id={`logo-${slot}`} type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={e => { uploadLogo(slot, e.target.files?.[0]); e.target.value = ""; }} />
                </div>
              );
            })}
          </div>
        </CsSectie>

        <CsSectie titel="LOCATIES">
          <CsRijen rijen={cs.locaties} zet={(locaties) => zet({ locaties })} nieuw={() => ({ label: "Locatie", naam: "", adres: "" })}
            velden={[{ key: "label", placeholder: "Soort", breedte: 92 }, { key: "naam", placeholder: "Naam" }, { key: "adres", placeholder: "Adres" }]} />
          <input value={cs.reistijd} placeholder="Reistijd, bv. Hotel → fabriek: 20 minuten rijden" aria-label="Reistijd" onChange={e => zet({ reistijd: e.target.value })} style={{ ...CS_INP, marginTop: 5 }} />
        </CsSectie>

        <CsSectie titel="PRODUCTIE">
          <CsRijen rijen={cs.productie} zet={(productie) => zet({ productie })} nieuw={() => ({ functie: "", naam: "" })}
            velden={[{ key: "functie", placeholder: "Functie", breedte: 140 }, { key: "naam", placeholder: "Naam" }]} />
          <textarea value={cs.factuur} rows={3} placeholder={"Factuurgegevens (bedrijf, adres, BTW)"} aria-label="Factuurgegevens" onChange={e => zet({ factuur: e.target.value })} style={{ ...CS_INP, marginTop: 5, resize: "vertical" }} />
          <input value={cs.po} placeholder="PO nummer" aria-label="PO nummer" onChange={e => zet({ po: e.target.value })} style={{ ...CS_INP, marginTop: 5, width: 160 }} />
        </CsSectie>

        <CsSectie titel="CALLS">
          <CsRijen rijen={cs.calls} zet={(calls) => zet({ calls })} nieuw={() => ({ wat: "", tijd: "", locatie: "" })}
            velden={[{ key: "wat", placeholder: "Call", breedte: 110 }, { key: "tijd", placeholder: "Tijd", breedte: 96 }, { key: "locatie", placeholder: "Locatie" }]} />
        </CsSectie>

        <CsSectie titel="CAST CALL">
          {cs.cast.filter(c => c.bezettingId).map(c => (
            <div key={c.bezettingId} style={{ background: c.geel ? "#FFF8C4" : C.bg, borderRadius: 10, padding: 6, marginBottom: 5 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{c.naam}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 5 }}>
                {[["calltijd", "Calltijd"], ["visagie", "Visagie"], ["kleding", "Kleding"], ["draaiklaar", "Draaiklaar"], ["rol", "Rol"]].map(([k, ph]) => (
                  <input key={k} value={c[k] || ""} placeholder={ph} aria-label={`${ph} ${c.naam}`}
                    onChange={e => zet({ castDetails: { ...castDetails, [c.bezettingId]: { ...(castDetails[c.bezettingId] || {}), [k]: e.target.value } } })} style={CS_INP} />
                ))}
              </div>
            </div>
          ))}
          <CsRijen rijen={wijz.castExtra || []} zet={(castExtra) => zet({ castExtra })} nieuw={() => ({ naam: "", calltijd: "", rol: "", geel: false })} toevoegTekst="+ Cast"
            velden={[{ key: "naam", placeholder: "Naam" }, { key: "calltijd", placeholder: "Calltijd", breedte: 80 }, { key: "rol", placeholder: "Rol", breedte: 110 }]} />
          {!cs.cast.some(c => c.bezettingId) && <p style={S.hint}>Cast-namen uit het project (acteurs, figuranten) verschijnen hier vanzelf.</p>}
        </CsSectie>

        <CsSectie titel="DRAAISCHEMA" extra={<button onClick={() => zet({ schema: [...cs.schema, { pauze: true, wat: "LUNCH", tijd: "12:30 – 13:00" }] })} style={{ background: "none", border: "1px solid #999", color: "#fff", borderRadius: 999, fontSize: 11, padding: "1px 8px", cursor: "pointer", fontFamily: "inherit" }}>+ Pauze</button>}>
          {cs.schema.map((s, n) => {
            const zetS = (v) => zet({ schema: cs.schema.map((x, i) => (i === n ? { ...x, ...v } : x)) });
            const weg = () => zet({ schema: cs.schema.filter((_, i) => i !== n) });
            return s.pauze ? (
              <div key={n} style={{ display: "flex", gap: 5, marginBottom: 5, background: "#D9D9D9", borderRadius: 8, padding: 4 }}>
                <input value={s.wat || ""} aria-label="Pauze" onChange={e => zetS({ wat: e.target.value })} style={{ ...CS_INP, fontWeight: 700, width: 110, flexShrink: 0 }} />
                <input value={s.tijd || ""} placeholder="Tijd" aria-label="Pauze tijd" onChange={e => zetS({ tijd: e.target.value })} style={CS_INP} />
                <button onClick={weg} aria-label="Regel verwijderen" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={14} color={C.muted} /></button>
              </div>
            ) : (
              <div key={n} style={{ marginBottom: 6, background: C.bg, borderRadius: 8, padding: 4 }}>
                <div style={{ display: "flex", gap: 5 }}>
                  <input value={s.tijd || ""} placeholder="08:00 – 09:00" aria-label="Tijd" onChange={e => zetS({ tijd: e.target.value })} style={{ ...CS_INP, width: 110, flexShrink: 0 }} />
                  <input value={s.wat || ""} placeholder="Wat (shot, opbouw…)" aria-label="Wat" onChange={e => zetS({ wat: e.target.value })} style={CS_INP} />
                  <button onClick={weg} aria-label="Regel verwijderen" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={14} color={C.licht} /></button>
                </div>
                <div style={{ display: "flex", gap: 5, marginTop: 4, paddingRight: 22 }}>
                  <input value={s.cast || ""} placeholder="Cast" aria-label="Cast" onChange={e => zetS({ cast: e.target.value })} style={{ ...CS_INP, width: 110, flexShrink: 0 }} />
                  <input value={s.notes || ""} placeholder="Notes" aria-label="Notes" onChange={e => zetS({ notes: e.target.value })} style={CS_INP} />
                </div>
              </div>
            );
          })}
          <button onClick={() => zet({ schema: [...cs.schema, { tijd: "", wat: "", cast: "", notes: "" }] })} style={{ ...S.chip(false), padding: "4px 9px", fontSize: 12 }}>+ Regel</button>
        </CsSectie>

        <CsSectie titel="BELANGRIJKE NOTES">
          {cs.notes.map((n, i) => (
            <div key={i} style={{ display: "flex", gap: 5, marginBottom: 5 }}>
              <input value={n} aria-label={`Note ${i + 1}`} onChange={e => zet({ notes: cs.notes.map((x, j) => (j === i ? e.target.value : x)) })} style={{ ...CS_INP, color: "#C00000", fontWeight: 700 }} />
              <button onClick={() => zet({ notes: cs.notes.filter((_, j) => j !== i) })} aria-label="Note verwijderen" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={14} color={C.licht} /></button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => zet({ notes: [...cs.notes, ""] })} style={{ ...S.chip(false), padding: "4px 9px", fontSize: 12 }}>+ Note</button>
            {wijz.notes && (
              <label style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
                <input type="checkbox" checked={notesOnthouden} onChange={e => { setNotesOnthouden(e.target.checked); setVuil(true); }} /> Als standaard gebruiken
              </label>
            )}
            {wijz.notes && <button onClick={() => { const { notes, ...rest } = wijz; setWijz(rest); setVuil(true); }} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>standaard terugzetten</button>}
          </div>
        </CsSectie>

        <CsSectie titel="CREW & KLANT">
          {cs.crew.filter(c => c.bezettingId).map(c => (
            <div key={c.bezettingId} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, padding: "5px 6px", borderRadius: 8, marginBottom: 3, background: c.geel ? "#FFF8C4" : C.bg }}>
              <span style={{ width: 110, color: C.muted, flexShrink: 0 }}>{c.functie}</span>
              <span style={{ flex: 1, fontWeight: 700 }}>{c.naam}</span>
              <span style={{ color: c.telefoon ? C.tekst : C.licht }}>{c.telefoon || "geen tel."}</span>
              <button onClick={() => zet({ afwezig: [...(wijz.afwezig || []), c.bezettingId] })} aria-label={`${c.naam} niet op deze dag`} title="Niet op deze draaidag"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={14} color={C.licht} /></button>
            </div>
          ))}
          {cs.crew.filter(c => !c.bezettingId && c.naam === (ins.mijnNaam || instellingen.mijnNaam) && !(wijz.crewExtra || []).includes(c)).map(c => (
            <div key="ik" style={{ display: "flex", gap: 6, fontSize: 13, padding: "5px 6px", borderRadius: 8, marginBottom: 3, background: C.bg }}>
              <span style={{ width: 110, color: C.muted, flexShrink: 0 }}>{c.functie}</span><span style={{ flex: 1, fontWeight: 700 }}>{c.naam}</span><span>{c.telefoon}</span>
            </div>
          ))}
          {(wijz.afwezig || []).length > 0 && (
            <button onClick={() => zet({ afwezig: [] })} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", padding: "2px 0 6px", fontFamily: "inherit", textDecoration: "underline" }}>
              {(wijz.afwezig || []).length} {(wijz.afwezig || []).length === 1 ? "naam" : "namen"} niet op deze dag — terugzetten
            </button>
          )}
          <CsRijen rijen={wijz.crewExtra || []} zet={(crewExtra) => zet({ crewExtra })} nieuw={() => ({ functie: "", naam: "", telefoon: "" })} toevoegTekst="+ Crew"
            velden={[{ key: "functie", placeholder: "Functie", breedte: 100 }, { key: "naam", placeholder: "Naam" }, { key: "telefoon", placeholder: "Telefoon", breedte: 110 }]} />
          <p style={{ ...S.label, margin: "10px 0 4px" }}>Bureau & klant op set</p>
          <CsRijen rijen={cs.klantOpSet} zet={(klantOpSet) => zet({ klantOpSet })} nieuw={() => ({ organisatie: klant?.naam || "", naam: "", telefoon: "" })} toevoegTekst="+ Persoon"
            velden={[{ key: "organisatie", placeholder: "Organisatie", breedte: 100 }, { key: "naam", placeholder: "Naam" }, { key: "telefoon", placeholder: "Telefoon", breedte: 110 }]} />
        </CsSectie>

        <CsSectie titel="CAMERA / DATA">
          <input value={cs.camera} placeholder="Camera / formaten" aria-label="Camera" onChange={e => zet({ camera: e.target.value })} style={{ ...CS_INP, marginBottom: 5 }} />
          <input value={cs.data} placeholder="Data, bv. SSD-schijven beschikbaar via productie" aria-label="Data" onChange={e => zet({ data: e.target.value })} style={CS_INP} />
        </CsSectie>
        <p style={S.hint}>Geel = nog niet bevestigd; dat blijft geel gemarkeerd in de Excel. Bureau, factuurgegevens, klant op set en logo's worden per klant onthouden.</p>

        <div style={{ position: "sticky", bottom: 0, margin: "14px -18px 0", padding: "10px 18px max(22px, env(safe-area-inset-bottom))", background: C.kaart, borderTop: `1px solid ${C.rand}`, display: "flex", gap: 8 }}>
          <button style={{ ...S.knop(C.bg, C.tekst), flex: 1, border: `1px solid ${C.rand2}` }} onClick={() => { opslaan(); meld("💾 Callsheet bewaard"); }} disabled={!vuil}>{vuil ? "Bewaren" : "Bewaard ✓"}</button>
          {kanDelen && <button style={{ ...S.knop(C.bg, C.groen), flex: 1, border: `1px solid ${C.rand2}` }} disabled={bezig} onClick={() => maakExcel(true)}>📤 Delen</button>}
          <button style={{ ...S.knop(), flex: 1.3 }} disabled={bezig} onClick={() => maakExcel(false)}>{bezig ? "Bezig…" : "⬇︎ Excel"}</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// AANVRAAG / INTAKE — notities van het eerste telefoongesprek. De app
// herkent draaidag(en), prelight, post, budget, deliverables en onderdelen
// en neemt dat mee naar offerte en productie.
// ════════════════════════════════════════════════════════════════════
function HerkendChips({ h, compact = false }) {
  if (!h?.herkend?.length) return compact ? null : <p style={S.hint}>Typ gewoon wat er besproken is: data, aantal draaidagen, prelight, wie de post doet, budget, formaten, cast, locaties, crew…</p>;
  const labels = h.herkend.filter(x => x.soort !== "onderdelen").map(x => x.label);
  const onderdelen = (h.onderdelen || []).map(id => onderdeelVan(id)?.label).filter(Boolean);
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }} aria-label="Herkend">
      <span style={{ fontSize: 11, color: C.muted, fontWeight: 700, alignSelf: "center" }}>✨ HERKEND</span>
      {labels.map(l => <span key={l} style={{ fontSize: 12, background: "#E8F0EC", color: C.groen, borderRadius: 999, padding: "3px 9px" }}>{l}</span>)}
      {onderdelen.map(l => <span key={l} style={{ fontSize: 12, background: C.bg, border: `1px solid ${C.rand2}`, borderRadius: 999, padding: "2px 8px" }}>{l}</span>)}
    </div>
  );
}

function IntakeBlok({ intake, zetTekst, standaardOpen = false }) {
  const [open, setOpen] = useState(standaardOpen);
  const [tekst, setTekst] = useState(intake.tekst || "");
  useEffect(() => setTekst(intake.tekst || ""), [intake.tekst]);
  const h = leesIntake(tekst, { vandaag: vandaagStr() });
  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={() => setOpen(!open)} style={{ ...S.rij, padding: "4px 0", borderBottom: "none" }}>
        <span style={{ fontSize: 13, flex: 1 }}>📞 <strong>Eerste gesprek</strong>{intake.datum ? <span style={{ color: C.muted }}> · {datumKort(intake.datum).toLowerCase()}</span> : ""}</span>
        <ChevronDown size={15} color={C.licht} style={{ transform: open ? "none" : "rotate(-90deg)" }} />
      </button>
      {open ? (
        <>
          <textarea value={tekst} rows={Math.min(12, Math.max(3, tekst.split("\n").reduce((n, r) => n + Math.ceil((r.length || 1) / 38), 0) + 1))} aria-label="Notities eerste gesprek"
            onChange={e => setTekst(e.target.value)} onBlur={() => tekst !== intake.tekst && zetTekst(tekst)}
            style={{ ...S.inp, fontSize: 14, marginTop: 4, resize: "vertical", lineHeight: 1.45 }} />
          <HerkendChips h={h} />
        </>
      ) : (
        <p style={{ margin: "2px 0 0", fontSize: 13, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{intake.tekst}</p>
      )}
    </div>
  );
}

function AanvraagKop({ lijst, klanten, klantVan, zetProject, openAkkoord, openAfwijzen, openOfferteVanAanvraag, zetDeadline }) {
  const p = lijst.project;
  const klant = klantVan(p.klantId);
  const taak = (lijst.items || []).find(i => i.aanvraagTaak && !i.checked);
  return (
    <div style={{ ...S.kaart, padding: 14, background: "#EEF4F1" }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.groen, letterSpacing: "0.04em" }}>📞 AANVRAAG — OFFERTE NOG VERSTUREN</p>
      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        {taak && (
          <label style={{ flex: "1 1 150px", fontSize: 11, color: C.muted, fontWeight: 700 }}>📅 OFFERTE UITERLIJK
            <input type="date" value={taak.dueDate || ""} min={vandaagStr()} aria-label="Offerte uiterlijk"
              onChange={e => e.target.value && zetDeadline(e.target.value)} style={{ ...S.inp, padding: "6px 8px", fontSize: 14, marginTop: 3 }} />
          </label>
        )}
        <label style={{ flex: "1 1 150px", fontSize: 11, color: C.muted, fontWeight: 700 }}>📞 GESPREK OP
          <input type="date" value={p.intake?.datum || ""} aria-label="Datum gesprek"
            onChange={e => e.target.value && zetProject({ intake: { ...(p.intake || { tekst: "" }), datum: e.target.value } })} style={{ ...S.inp, padding: "6px 8px", fontSize: 14, marginTop: 3 }} />
        </label>
      </div>
      {taak && <p style={{ ...S.hint, marginTop: 4 }}>Staat in je planning en Mijn dag op die datum, met een herinnering om 9:00.</p>}
      <select value={p.klantId || ""} onChange={e => zetProject({ klantId: e.target.value || null })} aria-label="Klant"
        style={{ ...S.inp, width: "auto", padding: "6px 10px", fontSize: 13, marginTop: 10, color: klant?.kleur || C.tekst, fontWeight: 700 }}>
        <option value="">Geen klant</option>
        {klanten.map(k => <option key={k.id} value={k.id}>● {k.naam}</option>)}
      </select>
      <IntakeBlok intake={p.intake || { tekst: "" }} standaardOpen zetTekst={(tekst) => {
        const h = leesIntake(tekst, { vandaag: vandaagStr() });
        zetProject({
          intake: { ...(p.intake || {}), tekst },
          ...(h.budget ? { budget: h.budget } : {}),
          ...(h.liveDatum ? { liveDatum: h.liveDatum } : {}),
          ...(Object.keys(h.deliverables || {}).length ? { deliverables: normaliseerDeliverables(h.deliverables) } : {}),
        });
      }} />
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        <button style={{ ...S.knop(), flex: "1 1 auto" }} onClick={openOfferteVanAanvraag}>📨 Offerte verstuurd</button>
        <button style={{ ...S.knop(C.bg, C.groen), border: `1px solid ${C.rand2}` }} onClick={openAkkoord}>✅ Direct akkoord</button>
        <button style={{ ...S.knop(C.bg, C.rood), border: `1px solid ${C.rand2}` }} onClick={openAfwijzen}>✕ Gaat niet door</button>
      </div>
    </div>
  );
}

// Los project: zonder offertefase, met of zonder datums, gekoppeld aan een klant.
function LosProjectSheet({ klanten, nieuweKlant, sluit, maak, naarSjabloon, heeftSjablonen }) {
  const [naam, setNaam] = useState("");
  const [klantId, setKlantId] = useState("");
  const [nieuweKlantNaam, setNieuweKlantNaam] = useState("");
  const [via, setVia] = useState("");
  const [draaidag, setDraaidag] = useState("");
  const [oplever, setOplever] = useState("");
  const [budget, setBudget] = useState("");
  const fout = draaidag && oplever && oplever < draaidag;
  const kan = naam.trim() && !fout;
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()} role="dialog" aria-label="Los project">
        <SheetKop titel="📂 Los project" sluit={sluit} />
        <p style={{ ...S.hint, marginTop: 0 }}>Voor een productie die je oppakt zonder dat jij de offerte deed. Je begint met een lege takenlijst (pre-productie, productie, post) en kunt calls, crew, callsheets en kosten gewoon gebruiken.</p>
        <p style={S.label}>Projectnaam</p>
        <input style={S.inp} autoFocus aria-label="Projectnaam los project" placeholder="Bijv. Fabrieksfilm Häcker" value={naam} onChange={e => setNaam(e.target.value)} />

        <p style={S.label}><Tag size={14} /> Klant</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button style={S.chip(!klantId)} onClick={() => setKlantId("")}>Geen</button>
          {klanten.map(k => <button key={k.id} style={{ ...S.chip(klantId === k.id), ...(klantId === k.id ? { background: k.kleur || C.groen, borderColor: k.kleur || C.groen } : {}) }} onClick={() => setKlantId(k.id)}>● {k.naam}</button>)}
        </div>
        <form onSubmit={e => { e.preventDefault(); if (nieuweKlantNaam.trim()) { setKlantId(nieuweKlant(nieuweKlantNaam)); setNieuweKlantNaam(""); } }} style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input style={{ ...S.inp, padding: "8px 12px" }} aria-label="Nieuwe klant" placeholder="+ Nieuwe klant" value={nieuweKlantNaam} onChange={e => setNieuweKlantNaam(e.target.value)} />
          {nieuweKlantNaam.trim() && <button type="submit" style={S.knop()}>Voeg toe</button>}
        </form>

        <p style={S.label}>Opdracht via <span style={{ fontWeight: 400, color: C.muted }}>(optioneel)</span></p>
        <input style={S.inp} aria-label="Opdracht via" placeholder="Bijv. bureau of productiehuis dat de offerte deed" value={via} onChange={e => setVia(e.target.value)} />

        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ flex: 1, minWidth: 0 }}><span style={S.label}>🎬 Draaidag</span>
            <input type="date" aria-label="Draaidag los project" style={S.inp} value={draaidag} onChange={e => setDraaidag(e.target.value)} />
          </label>
          <label style={{ flex: 1, minWidth: 0 }}><span style={S.label}>📦 Oplevering</span>
            <input type="date" aria-label="Oplevering los project" style={S.inp} value={oplever} onChange={e => setOplever(e.target.value)} />
          </label>
        </div>
        {fout ? <p style={{ ...S.hint, color: C.rood }}>De oplevering ligt vóór de draaidag.</p> : <p style={S.hint}>Mag leeg blijven — je kunt de datums later in het project invullen.</p>}

        <p style={S.label}>💶 Budget / jouw deel <span style={{ fontWeight: 400, color: C.muted }}>(optioneel)</span></p>
        <input style={S.inp} aria-label="Budget los project" inputMode="decimal" placeholder="€" value={budget} onChange={e => setBudget(e.target.value.replace(/[^\d.,]/g, ""))} />

        <button disabled={!kan} onClick={() => maak({ naam: naam.trim(), klantId: klantId || null, opdrachtVia: via, draaidag: draaidag || null, opleverdatum: oplever || null, budget: budget ? Number(budget.replace(/\./g, "").replace(",", ".")) : null })}
          style={{ ...S.knop(), width: "100%", marginTop: 16, opacity: kan ? 1 : 0.5 }}>📂 Project aanmaken</button>
        {heeftSjablonen && (
          <button onClick={naarSjabloon} style={{ background: "none", border: "none", color: C.groen, fontSize: 13, marginTop: 12, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>
            Liever meteen de standaardtaken? → Nieuw project uit sjabloon
          </button>
        )}
      </div>
    </div>
  );
}

function AanvraagSheet({ klanten, alleKlanten, vandaag, nieuweKlant, sluit, maak }) {
  const [naam, setNaam] = useState("");
  const [klantId, setKlantId] = useState("");
  const [nieuweKlantNaam, setNieuweKlantNaam] = useState("");
  const [tekst, setTekst] = useState("");
  const [gesprekDatum, setGesprekDatum] = useState(vandaag);
  const [deadline, setDeadline] = useState(null); // null = automatisch (notities of over 2 dagen)
  const h = leesIntake(tekst, { vandaag, klanten: alleKlanten });
  const deadlineNu = deadline || h.offerteDeadline || plusDagen(vandaag, 2);
  // Klant genoemd in de notities en nog niets gekozen? Dan die voorstellen.
  const voorgesteld = !klantId && h.klantId ? klanten.find(k => k.id === h.klantId) : null;
  const kan = naam.trim();
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()} role="dialog" aria-label="Nieuwe aanvraag">
        <SheetKop titel="📞 Nieuwe aanvraag" sluit={sluit} />
        <p style={{ ...S.hint, marginTop: 0 }}>De notitie van het eerste gesprek. Vanaf hier schuift alles door: offerte → akkoord → productie, met wat de app in je notities herkent al ingevuld.</p>
        <p style={S.label}>Projectnaam</p>
        <input style={S.inp} autoFocus placeholder="Bijv. Häcker keukencampagne" value={naam} onChange={e => setNaam(e.target.value)} aria-label="Projectnaam" />
        <p style={S.label}><Tag size={14} /> Klant</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button style={S.chip(!klantId)} onClick={() => setKlantId("")}>Geen</button>
          {klanten.map(k => <button key={k.id} style={{ ...S.chip(klantId === k.id), ...(klantId === k.id ? { background: k.kleur || C.groen, borderColor: k.kleur || C.groen } : {}) }} onClick={() => setKlantId(k.id)}>● {k.naam}</button>)}
        </div>
        {voorgesteld && <p style={S.hint}>In je notities staat <strong>{voorgesteld.naam}</strong> — die wordt gekoppeld als je niets anders kiest.</p>}
        <form onSubmit={e => { e.preventDefault(); if (nieuweKlantNaam.trim()) { setKlantId(nieuweKlant(nieuweKlantNaam)); setNieuweKlantNaam(""); } }} style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input style={{ ...S.inp, padding: "8px 12px", fontSize: 14 }} placeholder="+ Nieuwe klant" value={nieuweKlantNaam} onChange={e => setNieuweKlantNaam(e.target.value)} />
          {nieuweKlantNaam.trim() && <button type="submit" style={S.knop()}>Voeg toe</button>}
        </form>
        <p style={S.label}>📝 Notities van het gesprek</p>
        <textarea rows={7} style={{ ...S.inp, fontSize: 15, lineHeight: 1.45, resize: "vertical" }} value={tekst} onChange={e => setTekst(e.target.value)} aria-label="Notities eerste gesprek"
          placeholder={"Bijv.: Angela (Scheepens) 06 12345678 belde. 2 draaidagen begin december, prelight de dag ervoor. Post doet het bureau zelf. Budget rond 25k. Online 16:9 + 9:16. Acteur + 10 figuranten, in de fabriek, hotel nodig. Live 5 januari."} />
        <HerkendChips h={h} />
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <label style={{ flex: 1, fontSize: 11, color: C.muted, fontWeight: 700 }}>📅 OFFERTE UITERLIJK
            <input type="date" value={deadlineNu} min={vandaag} aria-label="Offerte uiterlijk" onChange={e => setDeadline(e.target.value || null)} style={{ ...S.inp, padding: "8px 10px", fontSize: 15, marginTop: 3 }} />
          </label>
          <label style={{ flex: 1, fontSize: 11, color: C.muted, fontWeight: 700 }}>📞 GESPREK OP
            <input type="date" value={gesprekDatum} max={vandaag} aria-label="Datum gesprek" onChange={e => setGesprekDatum(e.target.value || vandaag)} style={{ ...S.inp, padding: "8px 10px", fontSize: 15, marginTop: 3 }} />
          </label>
        </div>
        <p style={S.hint}>{deadline ? "Zelf gekozen." : h.offerteDeadline ? "✨ Uit je notities." : "Standaard over 2 dagen."} De offerte-taak komt op die dag in je planning, met een herinnering om 9:00.</p>
        <button disabled={!kan} onClick={() => maak({ naam: naam.trim(), klantId: klantId || h.klantId || null, tekst, gesprekDatum, offerteUiterlijk: deadlineNu })}
          style={{ ...S.knop(), width: "100%", marginTop: 16, opacity: kan ? 1 : 0.5 }}>📞 Aanvraag vastleggen</button>
      </div>
    </div>
  );
}

// ── Opzet van de productie: post door ons? aantal draaidagen? prelight? ──
function OpzetKiezer({ opzet, zet }) {
  return (
    <div style={{ background: C.bg, borderRadius: 12, padding: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, width: 110 }}>🎬 Draaidagen</span>
        <button aria-label="Minder draaidagen" onClick={() => zet({ draaidagen: Math.max(1, opzet.draaidagen - 1) })} style={{ ...S.chip(false), padding: "4px 12px" }}>−</button>
        <strong style={{ fontSize: 16, minWidth: 18, textAlign: "center" }} aria-label="Aantal draaidagen">{opzet.draaidagen}</strong>
        <button aria-label="Meer draaidagen" onClick={() => zet({ draaidagen: Math.min(30, opzet.draaidagen + 1) })} style={{ ...S.chip(false), padding: "4px 12px" }}>+</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, width: 110 }}>💡 Prelight</span>
        {PRELIGHT.map(x => <button key={x.id} aria-pressed={opzet.prelight === x.id} onClick={() => zet({ prelight: x.id })} style={{ ...S.chip(opzet.prelight === x.id), padding: "5px 10px", fontSize: 12 }}>{x.label}</button>)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, width: 110 }}>🎞️ Postproductie</span>
        <button aria-pressed={opzet.postDoorOns} onClick={() => zet({ postDoorOns: true })} style={{ ...S.chip(opzet.postDoorOns), padding: "5px 10px", fontSize: 12 }}>Doen wij</button>
        <button aria-pressed={!opzet.postDoorOns} onClick={() => zet({ postDoorOns: false })} style={{ ...S.chip(!opzet.postDoorOns), padding: "5px 10px", fontSize: 12 }}>Doet een ander</button>
      </div>
      {!opzet.postDoorOns && <p style={S.hint}>Geen montage-, grading- of mixtaken; wel "footage overdragen" de dag na het draaien.</p>}
    </div>
  );
}

function OpzetRegel({ p, zetOpzet }) {
  const [open, setOpen] = useState(false);
  const o = standaardOpzet(p);
  const pre = PRELIGHT.find(x => x.id === o.prelight);
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(!open)} style={{ ...S.rij, padding: "4px 0", borderBottom: "none" }} aria-label="Opzet productie">
        <span style={{ fontSize: 12, flex: 1, color: C.muted }}>
          ⚙️ {draaidagenVan(p).length ? `${draaidagenVan(p).length} ${draaidagenVan(p).length === 1 ? "draaidag" : "draaidagen"}` : "nog geen draaidag"} · {o.prelight === "geen" ? "geen prelight" : `prelight: ${pre?.label.toLowerCase()}`} · post {o.postDoorOns ? "door ons" : "door een ander"}
        </span>
        <ChevronDown size={14} color={C.licht} style={{ transform: open ? "none" : "rotate(-90deg)" }} />
      </button>
      {open && <OpzetKiezer opzet={{ ...o, draaidagen: draaidagenVan(p).length || 1 }} zet={(v) => zetOpzet(v)} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// OFFERTE-PDF — inlezen (op het toestel zelf, via pdf.js) en omzetten naar
// een kostenoverzicht in Excel: begroot tegenover werkelijk per post.
// ════════════════════════════════════════════════════════════════════
async function leesOffertePdfBestand(file) {
  const pdfjsLib = await laadPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const paginas = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const tc = await (await pdf.getPage(n)).getTextContent();
    paginas.push(tc.items.filter(i => i.str !== undefined).map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width })));
  }
  return leesOfferte(regelsUitOffertePdf(paginas));
}
async function deelOfDownload(buf, naam, { delen = false, meld } = {}) {
  const type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const file = typeof File !== "undefined" ? new File([buf], naam, { type }) : null;
  if (delen && file && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: naam.replace(/\.xlsx$/, "").replace(/_/g, " ") }); } catch (e) { if (e?.name !== "AbortError") throw e; }
    return;
  }
  const url = URL.createObjectURL(new Blob([buf], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = naam; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  meld?.("⬇︎ Excel gedownload");
}
async function downloadKostenoverzicht(spec, werkelijk, { projectNaam, klantNaam, delen, meld, marge, eigen }) {
  try {
    const ExcelJS = (await import("exceljs")).default;
    const wb = maakKostenWerkboek(spec, ExcelJS, { projectNaam, klantNaam, werkelijk: werkelijk || {}, marge: marge ? { minimum: marge.minimum, doel: marge.doel } : undefined, eigen });
    await deelOfDownload(await wb.xlsx.writeBuffer(), kostenBestandsnaam(spec, projectNaam), { delen, meld });
  } catch (e) { console.error(e); meld?.("⚠️ Excel maken mislukt"); }
}

function OffertePdfKnop({ onGelezen, label = "📄 Offerte-PDF inlezen", stijl = {} }) {
  const ref = useRef(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);
  async function kies(file) {
    if (!file) return;
    setBezig(true); setFout(null);
    try {
      const o = await leesOffertePdfBestand(file);
      if (!o.aantalPosten) throw new Error("geen posten");
      onGelezen(o, file.name);
    } catch (e) {
      console.error(e);
      setFout(e?.message === "geen posten" ? "Geen kostenposten gevonden in deze PDF (staat er een specificatie in met aantal, prijs en totaal?)." : "Deze PDF kon niet worden gelezen.");
    } finally { setBezig(false); }
  }
  return (
    <div>
      <button type="button" disabled={bezig} onClick={() => ref.current?.click()} style={{ ...S.knop(C.bg, C.groen), border: `1px solid ${C.rand2}`, width: "100%", ...stijl }}>
        {bezig ? "PDF lezen…" : label}
      </button>
      <input ref={ref} type="file" accept="application/pdf,.pdf" aria-label="Offerte-PDF" style={{ display: "none" }} onChange={e => { kies(e.target.files?.[0]); e.target.value = ""; }} />
      {fout && <p style={{ ...S.hint, color: C.rood }}>{fout}</p>}
    </div>
  );
}

function SpecificatieSamenvatting({ spec }) {
  return (
    <p style={{ ...S.hint, color: spec.klopt ? C.groen : C.oranje }}>
      ✓ {spec.nummer ? `Offerte ${spec.nummer} · ` : ""}{spec.kopjes.reduce((n, k) => n + k.posten.length, 0)} posten in {spec.kopjes.length} kopjes · {euro(spec.totaal)}
      {spec.klopt ? " — komt overeen met de PDF" : ` — let op: de posten tellen op tot ${euro(spec.somKopjes)}`}
    </p>
  );
}

// In de offerte- en projectkop: specificatie bekijken, werkelijke kosten
// per post invullen en het kostenoverzicht als Excel downloaden/delen.
function SpecificatieBlok({ lijst, klantNaam, zetProject, meld, vulPlekken }) {
  const p = lijst.project;
  const o = p.offerte || {};
  const spec = o.specificatie;
  const [open, setOpen] = useState(false);
  const [kopOpen, setKopOpen] = useState(null);
  const md = useContext(MargeContext);
  const kanDelen = typeof navigator !== "undefined" && !!navigator.canShare;
  const zetSpec = (nieuw) => {
    zetProject({ offerte: { ...(lijst.project.offerte || {}), specificatie: compacteSpecificatie(nieuw), werkelijk: {}, ...(o.bedrag == null ? { bedrag: nieuw.totaal } : {}) } });
    meld?.(`📄 ${nieuw.aantalPosten} posten ingelezen — ${euro(nieuw.totaal)}`);
  };
  if (!spec) return <div style={{ marginTop: 10 }}><OffertePdfKnop onGelezen={zetSpec} /></div>;
  // Werkelijk = wat je per post invult, anders wat uit de namen + prijsafspraken volgt.
  const auto = werkelijkUitBezetting(lijst, spec);
  const werkelijkAlles = { ...auto, ...(o.werkelijk || {}) };
  // Eigen werk: keuze in dit project, anders wat je eerder koos voor die postnaam, anders een gok.
  const eigen = eigenPostSleutels(spec, o.eigen || {}, md.eigenGeleerd || {});
  const st = specificatieStand(spec, werkelijkAlles, eigen);
  const zetEigen = (pp, waarde) => {
    zetProject({ offerte: { ...(lijst.project.offerte || {}), eigen: { ...(lijst.project.offerte?.eigen || {}), [pp.sleutel]: waarde } } });
    md.zetEigenGeleerd?.(postNaamSleutel(pp.naam), waarde);
  };
  const heeftPlekken = (lijst.items || []).some(i => (i.bezetting || []).some(b => b.offerte));
  const zetWerkelijk = (sleutel, bedrag) => {
    const w = { ...(lijst.project.offerte?.werkelijk || {}) };
    if (bedrag == null) delete w[sleutel]; else w[sleutel] = bedrag;
    zetProject({ offerte: { ...(lijst.project.offerte || {}), werkelijk: w } });
  };
  const status = margeStatus(st.margeIngevuldPct, md);
  const kleur = status ? MARGE_KLEUR[status] : C.groen;
  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={() => setOpen(!open)} style={{ ...S.rij, padding: "4px 0", borderBottom: "none" }} aria-label="Offerte-specificatie">
        <span style={{ fontSize: 13, flex: 1 }}>
          📄 <strong>Offerte{spec.nummer ? ` ${spec.nummer}` : ""}</strong> · {euro(st.begroot)} · winst min. <strong>{euro(st.winst)}</strong> ({String(st.winstPct).replace(".", ",")}%)
          {st.margeIngevuldPct != null && <span style={{ color: kleur, fontWeight: 700 }}> · inkoop {String(st.margeIngevuldPct).replace(".", ",")}%</span>}
        </span>
        <ChevronDown size={15} color={C.licht} style={{ transform: open ? "none" : "rotate(-90deg)" }} />
      </button>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button style={{ ...S.knop(), flex: 1, padding: "8px 10px", fontSize: 13 }} onClick={() => downloadKostenoverzicht(spec, werkelijkAlles, { projectNaam: lijst.name, klantNaam, meld, marge: md, eigen })}>⬇︎ Kostenoverzicht (Excel)</button>
        {kanDelen && <button style={{ ...S.knop(C.bg, C.groen), border: `1px solid ${C.rand2}`, padding: "8px 10px", fontSize: 13 }} onClick={() => downloadKostenoverzicht(spec, werkelijkAlles, { projectNaam: lijst.name, klantNaam, delen: true, meld, marge: md, eigen })}>📤 Delen</button>}
      </div>
      {(() => {
        const iz = inzichtenVoorOfferte(spec, md.inzichten || []);
        if (!iz.length || p.afgerond) return null;
        return (
          <div style={{ marginTop: 6, fontSize: 12, background: "#FFF8DC", borderRadius: 10, padding: "6px 10px", lineHeight: 1.5 }}>
            <strong>📊 Uit je nacalculaties:</strong>
            {iz.slice(0, 4).map(x => <div key={x.categorie}>{onderdeelVan(x.categorie)?.label || x.naam}: gemiddeld <strong style={{ color: x.gemiddeldPct > 0 ? C.rood : C.groen }}>{x.gemiddeldPct > 0 ? "+" : ""}{String(x.gemiddeldPct).replace(".", ",")}%</strong> t.o.v. begroot ({x.aantal} projecten)</div>)}
          </div>
        );
      })()}
      {vulPlekken && !heeftPlekken && (
        <button style={{ ...S.knop(C.bg, C.groen), border: `1px solid ${C.rand2}`, width: "100%", marginTop: 6, padding: "8px 10px", fontSize: 13 }} onClick={vulPlekken}>
          👥 Crew, cast en locaties uit de offerte klaarzetten
        </button>
      )}
      {open && (
        <div style={{ marginTop: 8, background: C.bg, borderRadius: 12, padding: 10 }}>
          <div style={{ display: "flex", fontSize: 11, color: C.muted, fontWeight: 700, padding: "0 0 4px" }}>
            <span style={{ flex: 1 }}>KOPJE</span><span style={{ width: 84, textAlign: "right" }}>BEGROOT</span><span style={{ width: 84, textAlign: "right" }}>WERKELIJK</span>
          </div>
          {st.kopjes.map((k, ki) => (
            <div key={ki} style={{ borderTop: `1px solid ${C.rand}` }}>
              <button onClick={() => setKopOpen(kopOpen === ki ? null : ki)} style={{ ...S.rij, padding: "7px 0", borderBottom: "none", gap: 0 }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, minWidth: 0 }}>{k.naam}{k.ingevuld > 0 && <span style={{ fontWeight: 400, color: C.muted }}> · {k.ingevuld}/{k.posten.length}</span>}</span>
                <span style={{ width: 84, textAlign: "right", fontSize: 13 }}>{euro(k.begroot)}</span>
                <span style={{ width: 84, textAlign: "right", fontSize: 13, color: k.verschil == null ? C.licht : k.verschil < 0 ? C.rood : C.groen }}>{k.werkelijk == null ? "—" : euro(k.werkelijk)}</span>
              </button>
              {kopOpen === ki && k.posten.map(pp => (
                <SpecPostRegel key={pp.sleutel} post={pp} handmatig={(o.werkelijk || {})[pp.sleutel] != null} auto={auto[pp.sleutel]} zet={(b) => zetWerkelijk(pp.sleutel, b)} zetEigen={(v) => zetEigen(pp, v)} />
              ))}
            </div>
          ))}
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, borderTop: `1px solid ${C.rand2}`, paddingTop: 6 }}>
            <div style={{ display: "flex" }}><span style={{ flex: 1 }}>Eigen werk (blijft bij jou)</span><strong>{euro(st.eigenTotaal)}</strong></div>
            <div style={{ display: "flex" }}><span style={{ flex: 1 }}>Werkelijk ingevuld ({st.ingevuld}/{st.posten})</span><strong>{euro(st.werkelijk)}</strong></div>
            {st.margeIngevuldPct != null && <div style={{ display: "flex" }}><span style={{ flex: 1 }}>Marge op inkoop (doel ≥ {md.doel}%, min. {md.minimum}%)</span><strong style={{ color: kleur }}>{String(st.margeIngevuldPct).replace(".", ",")}%</strong></div>}
            <div style={{ display: "flex" }}><span style={{ flex: 1 }}>Verwachte kosten</span><strong>{euro(st.prognose)}</strong></div>
            <div style={{ display: "flex", fontWeight: 700 }}><span style={{ flex: 1 }}>Verwachte winst (minimaal)</span><span>{euro(st.winst)} · {String(st.winstPct).replace(".", ",")}%</span></div>
          </div>
          <p style={S.hint}>Tik op een kopje om per post de werkelijke kosten in te vullen. 🔗 = automatisch uit de namen en prijsafspraken. <strong>Eigen</strong> = werk dat je zelf doet: dat kost niets extra en telt als winst (tik om te wisselen; de app onthoudt het per postnaam). Nog niet ingevulde inkoop telt voorzichtig als "kost wat begroot is".</p>
          <OffertePdfKnop label="📄 Andere PDF inlezen" stijl={{ marginTop: 8, padding: "7px 10px", fontSize: 13 }}
            onGelezen={(nieuw) => { if (!Object.keys(o.werkelijk || {}).length || window.confirm("De ingevulde werkelijke kosten worden gewist. Doorgaan?")) zetSpec(nieuw); }} />
        </div>
      )}
    </div>
  );
}
function MargeDoelInstelling() {
  const md = useContext(MargeContext);
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(String(md.minimum));
  const [doel, setDoel] = useState(String(md.doel));
  if (!open) {
    return <button onClick={() => { setMin(String(md.minimum)); setDoel(String(md.doel)); setOpen(true); }} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, padding: "6px 0 0", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>🎯 Marge-doel: minimaal {md.minimum}%, streven {md.doel}% — wijzigen</button>;
  }
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 8, fontSize: 13 }}>
      🎯 Minimaal <input value={min} inputMode="numeric" aria-label="Minimale marge" onChange={e => setMin(e.target.value)} style={{ ...S.inp, width: 52, padding: "5px 6px", fontSize: 13 }} />%
      streven <input value={doel} inputMode="numeric" aria-label="Streefmarge" onChange={e => setDoel(e.target.value)} style={{ ...S.inp, width: 52, padding: "5px 6px", fontSize: 13 }} />%
      <button style={{ ...S.knop(), padding: "6px 10px", fontSize: 12 }} onClick={() => { md.zet({ minimum: Number(min) || 0, doel: Number(doel) || 0 }); setOpen(false); }}>Bewaar</button>
    </div>
  );
}
function NacalculatieBlok({ n }) {
  const md = useContext(MargeContext);
  const st = margeStatus(n.margeInkoopPct, md);
  const opvallend = [...n.posten].filter(p => Math.abs(p.verschilPct) >= 5).sort((a, b) => Math.abs(b.verschilPct) - Math.abs(a.verschilPct)).slice(0, 5);
  return (
    <div style={{ marginTop: 14, background: C.bg, borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 1.6 }}>
      <p style={{ ...S.label, margin: "0 0 4px" }}>📊 Nacalculatie</p>
      <div style={{ display: "flex" }}><span style={{ flex: 1 }}>Offerte</span><strong>{euro(n.offerte)}</strong></div>
      <div style={{ display: "flex" }}><span style={{ flex: 1 }}>Kosten (ingevuld of begroot)</span><strong>{euro(n.kosten)}</strong></div>
      <div style={{ display: "flex", fontWeight: 700 }}><span style={{ flex: 1 }}>Winst incl. eigen werk</span><span>{euro(n.winst)} · {String(n.winstPct).replace(".", ",")}%</span></div>
      {n.margeInkoopPct != null && <div style={{ display: "flex" }}><span style={{ flex: 1 }}>Marge op inkoop</span><strong style={{ color: MARGE_KLEUR[st] }}>{String(n.margeInkoopPct).replace(".", ",")}%</strong></div>}
      {opvallend.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {opvallend.map(p => <div key={p.naam} style={{ display: "flex", fontSize: 12 }}><span style={{ flex: 1 }}>{p.naam}</span><span style={{ color: p.verschilPct > 0 ? C.rood : C.groen, fontWeight: 700 }}>{p.verschilPct > 0 ? "+" : ""}{String(p.verschilPct).replace(".", ",")}%</span></div>)}
        </div>
      )}
      <p style={{ ...S.hint, marginBottom: 0 }}>Wordt bij afronden bewaard. Posten die vaker afwijken zie je terug bij je volgende offertes.</p>
    </div>
  );
}
function SpecPostRegel({ post, zet, handmatig = false, auto, zetEigen }) {
  const begin = handmatig && post.werkelijk != null ? String(post.werkelijk).replace(".", ",") : "";
  const [w, setW] = useState(begin);
  useEffect(() => setW(begin), [post.sleutel, handmatig]);
  const verschil = post.werkelijk != null ? post.totaal - post.werkelijk : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0 4px 10px", fontSize: 12 }}>
      <button onClick={() => zetEigen?.(!post.eigen)} aria-label={`${post.naam}: ${post.eigen ? "eigen werk" : "inkoop"}`} aria-pressed={post.eigen}
        style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "2px 6px", border: `1px solid ${post.eigen ? C.groen : C.rand2}`, background: post.eigen ? C.groen : "transparent", color: post.eigen ? "#fff" : C.muted, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
        {post.eigen ? "eigen" : "inkoop"}
      </button>
      <span style={{ flex: 1, minWidth: 0 }}>
        {post.naam}
        <span style={{ display: "block", color: C.muted, fontSize: 11 }}>{post.aantal} {post.eenheid} × {euro(post.prijs)}{verschil ? ` · ${verschil > 0 ? "−" : "+"}${euro(Math.abs(verschil))}` : ""}</span>
      </span>
      <span style={{ width: 74, textAlign: "right" }}>{euro(post.totaal)}</span>
      <input value={w} inputMode="decimal" placeholder={auto != null ? `🔗 ${Number(auto).toLocaleString("nl-NL", { maximumFractionDigits: 2 })}` : "€"} aria-label={`Werkelijk ${post.naam}`} onChange={e => setW(e.target.value)}
        onBlur={() => { const b = w.trim() === "" ? null : leesBedragInvoer(w); if (b !== (handmatig ? post.werkelijk : null)) zet(b); }}
        style={{ ...S.inp, padding: "5px 6px", fontSize: 13, width: 84, textAlign: "right", background: "#FFF8DC" }} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// CIJFERS — omzet, scoringskans, winst, klanten (per jaar)
// ════════════════════════════════════════════════════════════════════
const MAAND_KORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
function CijferTegel({ label, waarde, sub, kleur }) {
  return (
    <div style={{ background: C.bg, borderRadius: 12, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: "0.03em" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, color: C.tekst }}>{waarde}</div>
      {sub && <div style={{ fontSize: 11, color: kleur || C.muted, marginTop: 1, fontWeight: kleur ? 700 : 400 }}>{sub}</div>}
    </div>
  );
}
function CijfersSheet({ lijsten, klanten, sluit }) {
  const md = useContext(MargeContext);
  const huidig = Number(vandaagStr().slice(0, 4));
  const jaren = cijferJaren(lijsten, huidig);
  const [jaar, setJaar] = useState(huidig);
  const [actief, setActief] = useState(null);
  const c = projectCijfers(lijsten, { jaar, klanten, eigenGeleerd: md.eigenGeleerd || {} });
  const max = Math.max(1, ...c.maanden.map(m => m.omzet));
  const st = margeStatus(c.winstPct, md);
  const ks = (n) => (n >= 1000 ? `€ ${Math.round(n / 1000).toLocaleString("nl-NL")}k` : euro(n));
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()} role="dialog" aria-label="Cijfers">
        <SheetKop titel="📊 Cijfers" sluit={sluit} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {jaren.map(j => <button key={j} onClick={() => { setJaar(j); setActief(null); }} style={{ ...S.chip(j === jaar), padding: "5px 12px" }}>{j}</button>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <CijferTegel label="OMZET (AKKOORD)" waarde={euro(c.omzet)} sub={`${c.akkoord} ${c.akkoord === 1 ? "project" : "projecten"}${c.gemiddeldeOfferte ? ` · gem. ${ks(c.gemiddeldeOfferte)}` : ""}`} />
          <CijferTegel label="SCORINGSKANS" waarde={c.scoringPct == null ? "—" : `${c.scoringPct}%`} sub={c.scoringPct == null ? "nog niets beslist" : `${c.akkoord} akkoord · ${c.afgewezen} afgewezen${c.scoringBedragPct != null ? ` · ${c.scoringBedragPct}% van het bedrag` : ""}`} />
          <CijferTegel label="WINST" waarde={c.winstPct == null ? "—" : euro(c.winst)} sub={c.winstPct == null ? "lees offertes in voor winstcijfers" : `${String(c.winstPct).replace(".", ",")}% · ${c.winstProjecten} ${c.winstProjecten === 1 ? "project" : "projecten"}${st === "te-laag" ? " · onder je minimum" : ""}`} kleur={c.winstPct != null && st ? MARGE_KLEUR[st] : null} />
          <CijferTegel label="OPEN OFFERTES" waarde={euro(c.openWaarde)} sub={`${c.openAantal} uitstaand`} />
        </div>

        <p style={{ ...S.label, marginTop: 16 }}>Omzet per maand (moment van akkoord)</p>
        <div style={{ position: "relative", height: 150, display: "flex", alignItems: "flex-end", gap: 3, borderBottom: `1px solid ${C.rand2}`, paddingTop: 18 }} role="img" aria-label={`Omzet per maand in ${jaar}`}>
          {c.maanden.map(m => {
            const h = m.omzet ? Math.max(4, Math.round((m.omzet / max) * 120)) : 0;
            const aan = actief === m.maand;
            return (
              <button key={m.maand} onClick={() => setActief(aan ? null : m.maand)} aria-label={`${MAAND_KORT[m.maand]}: ${euro(m.omzet)}, ${m.akkoord} akkoord, ${m.verstuurd} offertes verstuurd`}
                style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", background: "none", border: "none", padding: 0, cursor: "pointer", position: "relative" }}>
                {aan && (
                  <span style={{ position: "absolute", bottom: h + 4, left: "50%", transform: `translateX(${m.maand < 2 ? "-20%" : m.maand > 9 ? "-80%" : "-50%"})`, background: C.tekst, color: "#fff", fontSize: 11, borderRadius: 6, padding: "3px 6px", whiteSpace: "nowrap", zIndex: 1 }}>
                    {euro(m.omzet)} · {m.akkoord}× akkoord · {m.verstuurd} verstuurd
                  </span>
                )}
                <span style={{ width: "100%", maxWidth: 22, height: h, background: aan || actief == null ? C.groen : "#9DB5A9", borderRadius: "4px 4px 0 0" }} />
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {c.maanden.map(m => <span key={m.maand} style={{ flex: 1, textAlign: "center", fontSize: 10, color: C.muted, marginTop: 3 }}>{MAAND_KORT[m.maand]}</span>)}
        </div>
        <p style={S.hint}>Tik op een maand voor de details.</p>

        {c.klanten.length > 0 && <>
          <p style={{ ...S.label, marginTop: 14 }}>Klanten</p>
          <div style={{ background: C.bg, borderRadius: 12, padding: "4px 12px" }}>
            {c.klanten.map(k => (
              <div key={k.klantId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.rand}`, fontSize: 13 }}>
                <span style={{ flex: 1, fontWeight: 700 }}>{k.naam}</span>
                <span style={{ color: C.muted, fontSize: 12 }}>{k.akkoord}✓{k.afgewezen ? ` · ${k.afgewezen}✕` : ""}</span>
                <span style={{ width: 90, textAlign: "right" }}>{euro(k.omzet)}</span>
              </div>
            ))}
          </div>
        </>}

        {c.redenen.length > 0 && <>
          <p style={{ ...S.label, marginTop: 14 }}>Waarom offertes niet doorgingen</p>
          {c.redenen.map(r => <div key={r.reden} style={{ display: "flex", fontSize: 13, padding: "3px 0" }}><span style={{ flex: 1 }}>{r.reden}</span><strong>{r.aantal}×</strong></div>)}
        </>}

        {(md.inzichten || []).length > 0 && <>
          <p style={{ ...S.label, marginTop: 14 }}>Wat structureel afwijkt (nacalculaties)</p>
          {md.inzichten.slice(0, 8).map(x => (
            <div key={x.categorie} style={{ display: "flex", fontSize: 13, padding: "3px 0" }}>
              <span style={{ flex: 1 }}>{onderdeelVan(x.categorie)?.label || x.naam} <span style={{ color: C.muted }}>({x.aantal} projecten)</span></span>
              <strong>{x.gemiddeldPct > 0 ? "+" : ""}{String(x.gemiddeldPct).replace(".", ",")}%</strong>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// BACK-UP — automatische dagelijkse momentopnames (14 dagen, op de server)
// + zelf een bestand downloaden of terugzetten.
// ════════════════════════════════════════════════════════════════════
const LAATSTE_DOWNLOAD_SLEUTEL = "taken:laatste-werk-backup";
function leesLaatsteDownload() { try { return Number(localStorage.getItem(LAATSTE_DOWNLOAD_SLEUTEL)) || null; } catch { return null; } }
function BackupSheet({ sluit, meld, naHerstel }) {
  const [info, setInfo] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [laatste, setLaatste] = useState(leesLaatsteDownload());
  const bestandRef = useRef(null);
  const laad = () => fetch("/api/taken/backup").then(r => r.json()).then(setInfo).catch(() => setInfo({ fout: true }));
  useEffect(() => { laad(); }, []);
  async function download(bron) {
    setBezig(true);
    try {
      const r = await fetch(`/api/taken/backup?download=${encodeURIComponent(bron)}`);
      if (!r.ok) throw new Error((await r.json()).error);
      const tekst = await r.text();
      const naam = (r.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/)?.[1] || "werkruimte-backup.json";
      const file = typeof File !== "undefined" ? new File([tekst], naam, { type: "application/json" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: naam }); } catch (e) { if (e?.name !== "AbortError") throw e; else { setBezig(false); return; } }
      } else {
        const url = URL.createObjectURL(new Blob([tekst], { type: "application/json" }));
        const a = document.createElement("a"); a.href = url; a.download = naam; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
      if (bron === "nu") { try { localStorage.setItem(LAATSTE_DOWNLOAD_SLEUTEL, String(Date.now())); } catch { /* geen opslag */ } setLaatste(Date.now()); }
      meld("💾 Back-up opgeslagen");
    } catch (e) { meld(`⚠️ ${e.message || "Back-up mislukt"}`); }
    setBezig(false);
  }
  async function herstel(body, uitleg) {
    if (!window.confirm(`${uitleg}\n\nJe huidige stand wordt eerst apart bewaard, dus dit is terug te draaien. Doorgaan?`)) return;
    setBezig(true);
    try {
      const r = await fetch("/api/taken/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      meld(`↩️ Teruggezet (${j.lijsten} lijsten)`);
      naHerstel();
      laad();
    } catch (e) { meld(`⚠️ ${e.message || "Terugzetten mislukt"}`); }
    setBezig(false);
  }
  async function importeer(file) {
    if (!file) return;
    try { const data = JSON.parse(await file.text()); herstel({ importeer: data }, `Back-up "${file.name}" terugzetten?`); }
    catch { meld("⚠️ Dit is geen geldig back-upbestand"); }
  }
  const kb = (b) => `${Math.max(1, Math.round(b / 1024))} kB`;
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()} role="dialog" aria-label="Back-up">
        <SheetKop titel="💾 Back-up werkruimte" sluit={sluit} />
        <p style={{ ...S.hint, marginTop: 0 }}>De app bewaart elke dag automatisch een kopie van je werkruimte (projecten, offertes, contacten, sjablonen), {info?.bewaarDagen || 14} dagen lang. Download af en toe ook zelf een bestand, bijvoorbeeld naar iCloud Drive.</p>
        <button disabled={bezig} style={{ ...S.knop(), width: "100%", marginTop: 6 }} onClick={() => download("nu")}>⬇︎ Back-up nu downloaden</button>
        <p style={S.hint}>{laatste ? `Laatst zelf gedownload op dit toestel: ${new Date(laatste).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}` : "Op dit toestel nog nooit zelf gedownload."}</p>
        <p style={{ ...S.label, marginTop: 14 }}>Automatische momentopnames</p>
        {!info ? <p style={S.hint}>Laden…</p> : info.fout ? <p style={{ ...S.hint, color: C.rood }}>Kon de lijst niet laden.</p> : !info.momentopnames.length ? (
          <p style={S.hint}>Nog geen — de eerste wordt gemaakt bij je volgende wijziging.</p>
        ) : (
          <div style={{ background: C.bg, borderRadius: 12, padding: "2px 12px" }}>
            {info.momentopnames.map(m => (
              <div key={m.datum} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.rand}`, fontSize: 13 }}>
                <span style={{ flex: 1 }}>{datumKort(m.datum)} <span style={{ color: C.muted }}>· {kb(m.bytes)}</span></span>
                <button disabled={bezig} onClick={() => download(m.datum)} style={{ ...S.chip(false), padding: "4px 9px", fontSize: 12 }}>Download</button>
                <button disabled={bezig} onClick={() => herstel({ herstel: m.datum }, `Je werkruimte terugzetten naar de stand van ${datumKort(m.datum).toLowerCase()}?`)} style={{ ...S.chip(false), padding: "4px 9px", fontSize: 12 }}>Terugzetten</button>
              </div>
            ))}
          </div>
        )}
        {info?.voorHerstel && (
          <button disabled={bezig} onClick={() => herstel({ herstel: "voor-herstel" }, "De stand van vlak vóór het laatste terugzetten herstellen?")} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, padding: "8px 0", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
            ↩️ Laatste terugzetten ongedaan maken
          </button>
        )}
        <p style={{ ...S.label, marginTop: 14 }}>Bestand terugzetten</p>
        <button disabled={bezig} onClick={() => bestandRef.current?.click()} style={{ ...S.knop(C.bg, C.tekst), border: `1px solid ${C.rand2}`, width: "100%" }}>📂 Kies een back-upbestand…</button>
        <input ref={bestandRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={e => { importeer(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// OFFERTEVERSIES — meerdere offertes per aanvraag (varianten / revisies),
// wat er veranderd is, en welke akkoord werd.
// ════════════════════════════════════════════════════════════════════
const VERSIE_STATUS = {
  open: { label: "verstuurd", kleur: "#C97D0C", bg: "#FCF1DE" },
  vervangen: { label: "vervangen", kleur: "#8A8577", bg: "#EFECE4" },
  gekozen: { label: "✓ akkoord", kleur: "#2D4A3E", bg: "#E8F0EC" },
  "niet-gekozen": { label: "niet gekozen", kleur: "#8A8577", bg: "#EFECE4" },
};
function WijzigingenLijst({ w }) {
  if (!w) return null;
  const regel = (x) => `${x.naam}${x.kopje ? ` (${x.kopje})` : ""}`;
  return (
    <div style={{ fontSize: 12, lineHeight: 1.6, marginTop: 4 }}>
      {w.bedragVerschil ? <div>Bedrag: <strong style={{ color: w.bedragVerschil > 0 ? C.groen : C.rood }}>{w.bedragVerschil > 0 ? "+" : "−"}{euro(Math.abs(w.bedragVerschil))}</strong></div> : null}
      {w.toegevoegd.map(x => <div key={`t${regel(x)}`} style={{ color: C.groen }}>＋ {regel(x)} · {x.aantal} {x.eenheid} · {euro(x.totaal)}</div>)}
      {w.verwijderd.map(x => <div key={`v${regel(x)}`} style={{ color: C.rood }}>− {regel(x)} · {euro(x.totaal)}</div>)}
      {w.gewijzigd.map(x => <div key={`g${regel(x)}`}>~ {regel(x)}: {x.van.aantal} {x.van.eenheid} × {euro(x.van.prijs)} → {x.naar.aantal} {x.naar.eenheid} × {euro(x.naar.prijs)} <strong>({x.verschil > 0 ? "+" : "−"}{euro(Math.abs(x.verschil))})</strong></div>)}
      {!w.heeftPosten && <div style={{ color: C.muted }}>Lees bij beide versies de PDF in om per post te zien wat er veranderde.</div>}
    </div>
  );
}
function OffertesBlok({ lijst, openVersie, nogVoorAkkoord }) {
  const versies = offerteVersies(lijst.project);
  const [open, setOpen] = useState(null);
  if (!versies.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      {versies.length > 1 && (
        <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 12, padding: "4px 10px" }}>
          {[...versies].reverse().map(v => {
            const st = VERSIE_STATUS[v.status] || VERSIE_STATUS.open;
            const uit = open === v.id;
            return (
              <div key={v.id} style={{ borderBottom: `1px solid ${C.rand}`, padding: "7px 0" }}>
                <button onClick={() => setOpen(uit ? null : v.id)} style={{ ...S.rij, padding: 0, borderBottom: "none", gap: 8, opacity: v.status === "vervangen" || v.status === "niet-gekozen" ? 0.7 : 1 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                    <strong>{v.naam}</strong>{v.soort === "revisie" ? " ↻" : ""}
                    <span style={{ display: "block", fontSize: 11, color: C.muted }}>{v.verstuurdOp ? datumKort(v.verstuurdOp).toLowerCase() : ""}{v.wijzigingen ? ` · ${v.wijzigingen.samenvatting}` : ""}{v.specificatie ? " · 📄" : ""}</span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{v.bedrag != null ? euro(v.bedrag) : "—"}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: st.kleur, background: st.bg, borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap" }}>{st.label}</span>
                </button>
                {uit && (
                  <div style={{ padding: "4px 0 2px" }}>
                    {v.notitie && <p style={{ margin: "2px 0", fontSize: 12 }}>📝 {v.notitie}</p>}
                    {v.wijzigingen ? <WijzigingenLijst w={v.wijzigingen} /> : <p style={{ margin: 0, fontSize: 12, color: C.muted }}>{v.soort === "variant" ? "Extra optie naast de andere offerte(s)." : "Eerste versie."}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <button onClick={() => openVersie("revisie")} style={{ ...S.chip(false), padding: "5px 10px", fontSize: 12 }}>↻ Nieuwe versie (na review)</button>
        {nogVoorAkkoord && <button onClick={() => openVersie("variant")} style={{ ...S.chip(false), padding: "5px 10px", fontSize: 12 }}>＋ Extra optie</button>}
      </div>
    </div>
  );
}
function OfferteVersieSheet({ lijst, soort: startSoort, vandaag, sluit, maak }) {
  const versies = offerteVersies(lijst.project);
  const kandidaten = versies.filter(v => v.status === "open" || v.status === "gekozen");
  const naAkkoord = versies.some(v => v.status === "gekozen");
  const [soort, setSoort] = useState(naAkkoord ? "revisie" : startSoort);
  const [vervangtId, setVervangtId] = useState((kandidaten.find(v => v.status === "gekozen") || kandidaten[kandidaten.length - 1])?.id || null);
  const [naam, setNaam] = useState("");
  const [verstuurdOp, setVerstuurdOp] = useState(vandaag);
  const [bedrag, setBedrag] = useState("");
  const [notitie, setNotitie] = useState("");
  const [spec, setSpec] = useState(null);
  const bedragGetal = leesBedragInvoer(bedrag);
  const vorige = soort === "revisie" ? versies.find(v => v.id === vervangtId) : null;
  const voorbeeld = vorige && (bedragGetal != null || spec) ? vergelijkOffertes(vorige, { bedrag: bedragGetal, specificatie: spec ? compacteSpecificatie(spec) : null }) : null;
  const kan = bedragGetal != null || spec;
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()} role="dialog" aria-label="Offerteversie">
        <SheetKop titel={soort === "revisie" ? "↻ Nieuwe versie van de offerte" : "＋ Extra optie"} sluit={sluit} />
        {!naAkkoord && (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button aria-pressed={soort === "revisie"} onClick={() => setSoort("revisie")} style={{ ...S.chip(soort === "revisie"), padding: "6px 11px", fontSize: 13 }}>↻ Vervangt een versie</button>
            <button aria-pressed={soort === "variant"} onClick={() => setSoort("variant")} style={{ ...S.chip(soort === "variant"), padding: "6px 11px", fontSize: 13 }}>＋ Optie ernaast</button>
          </div>
        )}
        <p style={{ ...S.hint, marginTop: 0 }}>
          {soort === "revisie"
            ? naAkkoord ? "Bijv. meerwerk of een herziene offerte na akkoord. Deze versie wordt meteen de geldende: begroting, plekken (crew, cast…) en kostenoverzicht worden bijgewerkt." : "Na een review met de klant: de oude versie wordt 'vervangen' en de app houdt bij wat er veranderd is."
            : "Een extra optie naast de andere, bijv. '2 personen' naast '1 persoon'. Bij akkoord kies je welke het werd."}
        </p>
        {soort === "revisie" && kandidaten.length > 1 && (
          <>
            <p style={S.label}>Vervangt</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {kandidaten.map(v => <button key={v.id} aria-pressed={vervangtId === v.id} onClick={() => setVervangtId(v.id)} style={{ ...S.chip(vervangtId === v.id), padding: "5px 10px", fontSize: 12 }}>{v.naam} · {v.bedrag != null ? euro(v.bedrag) : "—"}</button>)}
            </div>
          </>
        )}
        <div style={{ marginTop: 12 }}>
          <OffertePdfKnop onGelezen={(o) => { setSpec(o); if (o.totaal != null) setBedrag(o.totaal.toLocaleString("nl-NL", { minimumFractionDigits: o.totaal % 1 ? 2 : 0, maximumFractionDigits: 2 })); }} label={spec ? "📄 Andere PDF kiezen" : "📄 PDF van deze versie inlezen"} />
          {spec && <SpecificatieSamenvatting spec={spec} />}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <label style={{ flex: 1, fontSize: 11, color: C.muted, fontWeight: 700 }}>BEDRAG (EXCL. BTW)
            <input value={bedrag} inputMode="decimal" placeholder="€" aria-label="Bedrag" onChange={e => setBedrag(e.target.value)} style={{ ...S.inp, padding: "8px 10px", fontSize: 15, marginTop: 3 }} />
          </label>
          <label style={{ flex: 1, fontSize: 11, color: C.muted, fontWeight: 700 }}>VERSTUURD OP
            <input type="date" value={verstuurdOp} aria-label="Verstuurd op" onChange={e => setVerstuurdOp(e.target.value || vandaag)} style={{ ...S.inp, padding: "8px 10px", fontSize: 15, marginTop: 3 }} />
          </label>
        </div>
        <p style={S.label}>Naam <span style={{ fontWeight: 400 }}>(optioneel)</span></p>
        <input value={naam} onChange={e => setNaam(e.target.value)} aria-label="Naam versie" placeholder={soort === "revisie" && vorige ? `${vorige.naam.replace(/\s*\(v\d+\)$/, "")} (v${versies.length + 1})` : "bijv. 2 personen"} style={S.inp} />
        <p style={S.label}>{soort === "revisie" ? "Wat is er veranderd?" : "Notitie"}</p>
        <textarea rows={2} value={notitie} onChange={e => setNotitie(e.target.value)} aria-label="Wat is er veranderd" placeholder={soort === "revisie" ? "bijv. klant wil 1 draaidag minder, geen drone" : ""} style={{ ...S.inp, fontSize: 14, resize: "vertical" }} />
        {voorbeeld && (
          <div style={{ marginTop: 10, background: C.bg, borderRadius: 12, padding: 10 }}>
            <p style={{ ...S.label, margin: 0 }}>Verschil met {vorige.naam}</p>
            <p style={{ margin: "2px 0", fontSize: 13, fontWeight: 700 }}>{voorbeeld.samenvatting}</p>
            <WijzigingenLijst w={voorbeeld} />
          </div>
        )}
        <button disabled={!kan} onClick={() => maak({ soort, vervangtId: soort === "revisie" ? vervangtId : null, naam, verstuurdOp, bedrag: bedragGetal ?? spec?.totaal ?? null, notitie: notitie.trim(), specificatie: spec ? compacteSpecificatie(spec) : null })}
          style={{ ...S.knop(), width: "100%", marginTop: 16, opacity: kan ? 1 : 0.5 }}>
          {soort === "revisie" ? "↻ Versie vastleggen" : "＋ Optie vastleggen"}
        </button>
      </div>
    </div>
  );
}
// Bij akkoord: kiezen welke offerte het werd (als er meer dan één open staat).
function AkkoordVersieKeuze({ versies, gekozen, kies }) {
  if (versies.length < 2) return null;
  return (
    <div style={{ background: "#FFF8EC", borderRadius: 12, padding: 10, marginBottom: 12 }}>
      <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700 }}>Welke offerte is akkoord gegeven?</p>
      {versies.map(v => (
        <button key={v.id} aria-pressed={gekozen === v.id} onClick={() => kies(v)} style={{ ...S.rij, padding: "8px 10px", marginBottom: 4, borderRadius: 10, border: `1.5px solid ${gekozen === v.id ? C.groen : C.rand2}`, background: gekozen === v.id ? "#E8F0EC" : "#fff" }}>
          <span style={{ fontSize: 16 }}>{gekozen === v.id ? "◉" : "○"}</span>
          <span style={{ flex: 1, fontSize: 14 }}>{v.naam}{v.specificatie ? " 📄" : ""}<span style={{ display: "block", fontSize: 11, color: C.muted }}>{v.verstuurdOp ? `verstuurd ${datumKort(v.verstuurdOp).toLowerCase()}` : ""}</span></span>
          <strong style={{ fontSize: 14 }}>{v.bedrag != null ? euro(v.bedrag) : "—"}</strong>
        </button>
      ))}
      {!gekozen && <p style={{ ...S.hint, color: C.rood, margin: "4px 0 0" }}>Kies eerst de offerte; daarop worden begroting, crew/cast en kostenoverzicht gebaseerd.</p>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TAAKDETAIL
// ════════════════════════════════════════════════════════════════════
function TaakDetail({ ruimte, lijst, taak, ik, klanten, status, meldingen, zetMeldingenAan, vandaag, thuisLijsten, werkLijsten, werkStaat, sluit, zet, vink, verwijder, verplaats, nieuweKlant, contacten = [], onthoud, wijzigLaatste }) {
  const [naam, setNaam] = useState(taak.name);
  const [notitie, setNotitie] = useState(taak.note || "");
  const [stap, setStap] = useState("");
  const [aangepast, setAangepast] = useState(false);
  const [nieuweKlantNaam, setNieuweKlantNaam] = useState("");
  const [verplaatsOpen, setVerplaatsOpen] = useState(false);
  useEffect(() => { setNaam(taak.name); setNotitie(taak.note || ""); }, [taak.id]);
  // Titel automatisch bewaren: kort na het typen én bij sluiten, zodat een
  // wijziging nooit verloren gaat (ook niet als je meteen wegtikt).
  const [titelFocus, setTitelFocus] = useState(false);
  const titelEl = useRef(null);
  // Titelveld groeit mee met de tekst (geen afgeknipte regels).
  useEffect(() => { const el = titelEl.current; if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }, [naam, titelFocus]);
  const naamRef = useRef(naam);
  naamRef.current = naam;
  const taakNaamRef = useRef(taak.name);
  taakNaamRef.current = taak.name;
  const zetRef = useRef(zet);
  zetRef.current = zet;
  const bewaarTitel = () => { const n = naamRef.current.replace(/\s+/g, " ").trim(); if (n && n !== taakNaamRef.current) zetRef.current({ name: n }); };
  useEffect(() => {
    if (naam.trim() === taak.name) return;
    const t = setTimeout(bewaarTitel, 700);
    return () => clearTimeout(t);
  }, [naam]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => bewaarTitel(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const h = normaliseerHerhaling(taak.herhaling);
  const presetId = !h ? "geen" : (h.interval === 1 && !h.dagen ? h.freq : (h.interval === 1 && h.dagen?.join() === "1,2,3,4,5" ? "werkdagen" : "aangepast"));
  const inMijnDag = taak.mijnDag === vandaag;
  const nu = new Date();
  // Werktaak op vrijdag: "morgen" = maandag.
  const morgenDag = ruimte === "werk" ? volgendeWerkdag(vandaag) : plusDagen(vandaag, 1);
  const morgenLabel = morgenDag === plusDagen(vandaag, 1) ? "Morgen" : "Maandag";
  const morgen9 = `${morgenDag}T09:00`;
  const laterVandaag = (() => {
    const d = new Date(nu.getTime() + 3 * 3600 * 1000);
    if (d.getDate() !== nu.getDate()) return null;
    return `${vandaag}T${String(d.getHours()).padStart(2, "0")}:00`;
  })();
  const volgendeMaandag = plusDagen(vandaag, ((8 - isoWeekdag(vandaag)) % 7) || 7);
  const stappen = taak.substappen || [];

  function zetHerhalingPreset(id) {
    const map = { geen: null, dag: { freq: "dag", interval: 1 }, werkdagen: { freq: "week", interval: 1, dagen: [1, 2, 3, 4, 5] }, week: { freq: "week", interval: 1 }, maand: { freq: "maand", interval: 1 }, jaar: { freq: "jaar", interval: 1 } };
    if (id === "aangepast") { setAangepast(true); if (!h) zet({ herhaling: { freq: "week", interval: 1, dagen: [isoWeekdag(taak.dueDate || vandaag)] }, dueDate: taak.dueDate || vandaag }); return; }
    setAangepast(false);
    const nieuw = map[id];
    zet({ herhaling: nieuw, dueDate: nieuw && !taak.dueDate && !taak.herinnering ? vandaag : taak.dueDate });
  }
  function wijzigAangepast(velden) {
    const basis = h || { freq: "week", interval: 1 };
    zet({ herhaling: normaliseerHerhaling({ ...basis, ...velden }), dueDate: taak.dueDate || (taak.herinnering ? null : vandaag) });
  }

  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()} role="dialog" aria-label="Taak bewerken">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <button onClick={vink} aria-label="Afvinken" style={{ width: 26, height: 26, minWidth: 26, marginTop: 6, borderRadius: 999, border: `2px solid ${taak.checked ? C.groen : "#CFC6B4"}`, background: taak.checked ? C.groen : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
            {taak.checked && <Check size={15} color="#FAF6F0" strokeWidth={3} />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <textarea ref={titelEl} value={naam} rows={1} onChange={e => setNaam(e.target.value.replace(/\n/g, ""))}
              onFocus={() => setTitelFocus(true)}
              onBlur={() => { setTitelFocus(false); if (!naam.trim()) setNaam(taak.name); else bewaarTitel(); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } if (e.key === "Escape") { setNaam(taak.name); e.currentTarget.blur(); } }}
              enterKeyHint="done"
              style={{ width: "100%", boxSizing: "border-box", overflow: "hidden", lineHeight: 1.3, fontSize: 18, fontWeight: 700, resize: "none", outline: "none", fontFamily: "inherit", color: C.tekst, padding: "4px 8px", margin: "0 -8px", borderRadius: 10,
                border: `1px solid ${titelFocus ? C.groen : "transparent"}`, background: titelFocus ? C.bg : "transparent", transition: "background .15s, border-color .15s" }} aria-label="Titel" />
            {!titelFocus && <span style={{ fontSize: 11, color: C.licht, display: "flex", alignItems: "center", gap: 4, marginTop: -2 }}><Pencil size={10} /> Tik op de tekst om te wijzigen</span>}
          </div>
          <button onClick={() => zet({ belangrijk: !taak.belangrijk })} aria-label="Belangrijk" style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
            <Star size={20} color={taak.belangrijk ? C.terra : "#D8D0BF"} fill={taak.belangrijk ? C.terra : "none"} />
          </button>
          <button onClick={sluit} aria-label="Sluiten" style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}><X size={20} color={C.licht} /></button>
        </div>
        <p style={{ margin: "0 0 0 36px", fontSize: 12, color: C.muted }}>{ruimte === "werk" ? "💼" : "🏠"}{lijst.icon && lijst.icon !== (ruimte === "werk" ? "💼" : "🏠") ? ` ${lijst.icon}` : ""} {lijst.name}</p>

        {/* Stappen */}
        <div style={{ margin: "14px 0 0" }}>
          {stappen.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <button onClick={() => zet({ substappen: stappen.map(x => (x.id === s.id ? { ...x, afgevinkt: !x.afgevinkt } : x)) })} aria-label="Stap afvinken"
                style={{ width: 18, height: 18, minWidth: 18, borderRadius: 999, border: `2px solid ${s.afgevinkt ? C.groen : "#CFC6B4"}`, background: s.afgevinkt ? C.groen : "transparent", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                {s.afgevinkt && <Check size={10} color="#FAF6F0" strokeWidth={3} />}
              </button>
              <span style={{ flex: 1, fontSize: 14, color: s.afgevinkt ? C.licht : C.tekst, textDecoration: s.afgevinkt ? "line-through" : "none" }}>{s.tekst}</span>
              <button onClick={() => zet({ substappen: stappen.filter(x => x.id !== s.id) })} aria-label="Stap verwijderen" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={14} color="#D8D0BF" /></button>
            </div>
          ))}
          <form onSubmit={e => { e.preventDefault(); if (stap.trim()) { zet({ substappen: [...stappen, { id: uid(), tekst: stap.trim(), afgevinkt: false }] }); setStap(""); } }} style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <input style={{ ...S.inp, padding: "8px 12px", fontSize: 14 }} placeholder="+ Stap toevoegen" value={stap} onChange={e => setStap(e.target.value)} />
          </form>
        </div>

        {/* Mijn dag */}
        <button onClick={() => zet({ mijnDag: inMijnDag ? null : vandaag })} style={{ ...S.rij, padding: "12px 0", marginTop: 8, borderBottom: `1px solid ${C.rand}`, color: inMijnDag ? C.oranje : C.tekst }}>
          <Sun size={18} color={C.oranje} />
          <span style={{ flex: 1, fontSize: 15, fontWeight: inMijnDag ? 700 : 400 }}>{inMijnDag ? "Staat in Mijn dag" : "Toevoegen aan Mijn dag"}</span>
          {inMijnDag && <X size={16} color={C.licht} />}
        </button>

        {/* Herinnering */}
        <p style={S.label}><Bell size={14} /> Herinnering</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="datetime-local" style={S.inp} value={taak.herinnering || ""} onChange={e => zet({ herinnering: e.target.value || null })} aria-label="Herinnering" />
          {taak.herinnering && <button style={{ ...S.chip(false), display: "flex", alignItems: "center" }} onClick={() => zet({ herinnering: null })} aria-label="Herinnering wissen"><X size={14} /></button>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {laterVandaag && <button style={S.chip(taak.herinnering === laterVandaag)} onClick={() => zet({ herinnering: laterVandaag })}>Later vandaag {laterVandaag.slice(11)}</button>}
          <button style={S.chip(taak.herinnering === morgen9)} onClick={() => zet({ herinnering: morgen9 })}>{morgenLabel} 09:00</button>
          {volgendeMaandag !== morgenDag && <button style={S.chip(taak.herinnering === `${volgendeMaandag}T09:00`)} onClick={() => zet({ herinnering: `${volgendeMaandag}T09:00` })}>Maandag 09:00</button>}
        </div>
        {taak.herinnering && meldingen !== "aan" && meldingen !== "niet-ondersteund" && (
          <p style={S.hint}>🔕 Meldingen staan uit op dit toestel. <button onClick={zetMeldingenAan} style={{ background: "none", border: "none", color: C.groen, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: 12 }}>Zet ze aan</button></p>
        )}
        {taak.herinnering && status && !status.herinneringenOpTijd && (
          <p style={S.hint}>ℹ️ Op-tijd-meldingen zijn nog niet ingericht; je krijgt deze taak 's ochtends in je dagoverzicht.</p>
        )}
        {taak.herinnering && ruimte === "thuis" && <p style={S.hint}>{taak.assignedTo ? `Melding gaat naar ${taak.assignedTo}.` : "Melding gaat naar iedereen in huis (wijs de taak toe om dat te beperken)."}</p>}

        {/* Vervaldatum */}
        <p style={S.label}><CalendarDays size={14} /> Vervaldatum</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="date" style={S.inp} value={taak.dueDate || ""} onChange={e => zet({ dueDate: e.target.value || null })} aria-label="Vervaldatum" />
          {taak.dueDate && <button style={{ ...S.chip(false), display: "flex", alignItems: "center" }} onClick={() => zet({ dueDate: null })} aria-label="Vervaldatum wissen"><X size={14} /></button>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {[["Vandaag", vandaag], [morgenLabel, morgenDag], ...(volgendeMaandag !== morgenDag ? [["Volgende week", volgendeMaandag]] : [])].map(([l, d]) => (
            <button key={l} style={S.chip(taak.dueDate === d)} onClick={() => zet({ dueDate: d })}>{l}</button>
          ))}
        </div>

        {/* Herhaling */}
        <p style={S.label}><Repeat size={14} /> Herhaling {h && <span style={{ fontWeight: 400 }}>— {herhalingLabel(h)}</span>}</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["geen", "Geen"], ["dag", "Dagelijks"], ["werkdagen", "Werkdagen"], ["week", "Wekelijks"], ["maand", "Maandelijks"], ["jaar", "Jaarlijks"], ["aangepast", "Aangepast…"]].map(([id, l]) => (
            <button key={id} style={S.chip(id === "aangepast" ? (presetId === "aangepast" || aangepast) : presetId === id && !aangepast)} onClick={() => zetHerhalingPreset(id)}>{l}</button>
          ))}
        </div>
        {(aangepast || presetId === "aangepast") && h && (
          <div style={{ background: C.bg, borderRadius: 12, padding: 12, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14 }}>Elke</span>
              <input type="number" min={1} max={365} value={h.interval} onChange={e => wijzigAangepast({ interval: e.target.value })} style={{ ...S.inp, width: 70, padding: "8px 10px" }} aria-label="Interval" />
              <select value={h.freq} onChange={e => wijzigAangepast({ freq: e.target.value, dagen: e.target.value === "week" ? h.dagen : undefined })} style={{ ...S.inp, width: "auto", padding: "8px 10px" }} aria-label="Eenheid">
                <option value="dag">dag(en)</option><option value="week">week/weken</option><option value="maand">maand(en)</option><option value="jaar">jaar</option>
              </select>
            </div>
            {h.freq === "week" && (
              <div style={{ display: "flex", gap: 5, marginTop: 10, flexWrap: "wrap" }}>
                {["ma", "di", "wo", "do", "vr", "za", "zo"].map((d, idx) => {
                  const nr = idx + 1;
                  const aan = (h.dagen || []).includes(nr);
                  return <button key={d} style={{ ...S.chip(aan), padding: "6px 10px" }} onClick={() => wijzigAangepast({ dagen: aan ? (h.dagen || []).filter(x => x !== nr) : [...(h.dagen || []), nr] })}>{d}</button>;
                })}
              </div>
            )}
          </div>
        )}

        {/* Namen, status en prijsafspraken per onderdeel / crew-rol */}
        {ruimte === "werk" && taak.onderdeelId && (taak.onderdeelId === "crew" || !onderdeelVan(taak.onderdeelId)?.geenNamen) && (
          <BezettingEditor taak={taak} wijzigLaatste={wijzigLaatste} contacten={contacten} onthoud={onthoud} project={lijst.project || {}} />
        )}

        {/* Projecttaak: fase en soort (het sjabloon leert hiervan) */}
        {lijst.project && (
          <>
            <p style={S.label}>Fase</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {FASES.map(f => <button key={f.id} style={S.chip(taak.category === f.id)} onClick={() => zet({ category: f.id })}>{f.icon} {f.label}</button>)}
            </div>
            <p style={S.label}>Soort</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(SOORTEN).map(([id, v]) => <button key={id} style={S.chip((taak.soort || "taak") === id)} onClick={() => zet({ soort: id })}>{v.icon} {v.label}</button>)}
            </div>
            {taak.sjabloonStapId && <p style={S.hint}>📐 Uit het sjabloon ({offsetTekst(taak)}). Pas je naam, fase of soort aan, dan stelt de app bij het afronden voor om dat in het sjabloon over te nemen.</p>}
          </>
        )}

        {/* Toewijzen (thuis) / klant (werk) */}
        {ruimte === "thuis" && (
          <>
            <p style={S.label}><User size={14} /> Toewijzen aan</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TOEWIJSBAAR.map(p => <button key={p} style={S.chip(taak.assignedTo === p)} onClick={() => zet({ assignedTo: taak.assignedTo === p ? null : p })}>👤 {p}{p === ik ? " (ik)" : ""}</button>)}
            </div>
          </>
        )}
        {ruimte === "werk" && (
          <>
            <p style={S.label}><Tag size={14} /> Klant / project</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button style={S.chip(!taak.klantId)} onClick={() => zet({ klantId: null })}>Geen</button>
              {klanten.map(k => (
                <button key={k.id} style={{ ...S.chip(taak.klantId === k.id), ...(taak.klantId === k.id ? { background: k.kleur || C.groen, borderColor: k.kleur || C.groen } : {}) }} onClick={() => zet({ klantId: k.id })}><span style={{ color: taak.klantId === k.id ? "#FAF6F0" : (k.kleur || C.groen) }}>●</span> {k.naam}</button>
              ))}
            </div>
            <form onSubmit={e => { e.preventDefault(); if (nieuweKlantNaam.trim()) { const id = nieuweKlant(nieuweKlantNaam); zet({ klantId: id }); setNieuweKlantNaam(""); } }} style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input style={{ ...S.inp, padding: "8px 12px", fontSize: 14 }} placeholder="+ Nieuwe klant of project" value={nieuweKlantNaam} onChange={e => setNieuweKlantNaam(e.target.value)} />
              {nieuweKlantNaam.trim() && <button type="submit" style={S.knop()}>Voeg toe</button>}
            </form>
          </>
        )}

        {/* Notitie */}
        <p style={S.label}>📝 Notitie</p>
        <textarea value={notitie} onChange={e => setNotitie(e.target.value)} onBlur={() => notitie !== (taak.note || "") && zet({ note: notitie })} rows={4}
          placeholder="Notitie, link, adres…" style={{ ...S.inp, resize: "vertical", fontSize: 14 }} />

        {/* Verplaatsen */}
        <button onClick={() => setVerplaatsOpen(!verplaatsOpen)} style={{ ...S.rij, padding: "12px 0", marginTop: 6 }}>
          <ArrowRightLeft size={17} color={C.groen} /><span style={{ flex: 1, fontSize: 14 }}>Verplaatsen naar andere lijst</span>
          <ChevronDown size={15} color={C.licht} style={{ transform: verplaatsOpen ? "none" : "rotate(-90deg)" }} />
        </button>
        {verplaatsOpen && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {thuisLijsten.filter(l => !(ruimte === "thuis" && l.id === lijst.id)).map(l => <button key={l.id} style={S.chip(false)} onClick={() => verplaats({ ruimte: "thuis", listId: l.id })}>🏠 {l.icon} {l.name}</button>)}
            {werkStaat === "open" && werkLijsten.filter(l => !(ruimte === "werk" && l.id === lijst.id)).map(l => <button key={l.id} style={S.chip(false)} onClick={() => verplaats({ ruimte: "werk", listId: l.id })}>💼 {l.icon} {l.name}</button>)}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.rand}` }}>
          <span style={{ flex: 1, fontSize: 11, color: C.licht }}>
            {taak.addedBy ? `Toegevoegd door ${taak.addedBy}` : "Toegevoegd"}{taak.addedAt ? ` op ${new Date(taak.addedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}` : ""}
            {taak.bron === "mail" ? " · via e-mail" : ""}
          </span>
          <button onClick={verwijder} style={{ ...S.knop("#FBEDE8", C.rood), display: "flex", alignItems: "center", gap: 6, padding: "9px 12px" }}><Trash2 size={15} /> Verwijderen</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// SHEETS
// ════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════
// CALLS PER PROJECT — notities + taken die uit een call komen
// ════════════════════════════════════════════════════════════════════
// Spraak → tekst (doorlopend), voor het inspreken van notities.
function useSpraak() {
  const [luistert, setLuistert] = useState(false);
  const [hint, setHint] = useState(null);
  const ref = useRef(null);
  useEffect(() => () => { try { ref.current?.abort(); } catch { /* niets */ } }, []);
  function toggle(opTekst) {
    if (luistert) { try { ref.current?.stop(); } catch { /* al gestopt */ } return; }
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { setHint("Inspreken kan hier niet rechtstreeks — gebruik de 🎤 op je iPhone-toetsenbord."); return; }
    setHint(null);
    let r;
    try { r = new SR(); } catch { setHint("Inspreken lukte niet — gebruik de 🎤 op je toetsenbord."); return; }
    r.lang = "nl-NL"; r.interimResults = true; r.continuous = true;
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      opTekst(t.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setHint("Geen toegang tot de microfoon — zet die aan voor Safari in Instellingen › Apps › Safari.");
      else if (e.error !== "aborted" && e.error !== "no-speech") setHint("Inspreken lukte niet — probeer opnieuw.");
    };
    r.onend = () => { setLuistert(false); ref.current = null; };
    ref.current = r;
    setLuistert(true);
    try { r.start(); } catch { setLuistert(false); }
  }
  return { luistert, hint, setHint, toggle };
}

function CallsBlok({ lijst, openCall }) {
  const calls = callsVan(lijst.project);
  const [alles, setAlles] = useState(false);
  const zichtbaar = alles ? calls : calls.slice(0, 3);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 4px 8px" }}>
        <p style={{ ...S.sectieKop, margin: 0, flex: 1 }}>📞 Calls{calls.length ? ` · ${calls.length}` : ""}</p>
        <button onClick={() => openCall(null)} style={{ ...S.chip(false), padding: "6px 12px", fontWeight: 700, color: C.groen }}>＋ Nieuwe call</button>
      </div>
      {calls.length > 0 && (
        <div style={S.kaart}>
          {zichtbaar.map(c => {
            const taken = callTakenVan(lijst, c.id);
            const open = taken.filter(i => !i.checked).length;
            return (
              <button key={c.id} onClick={() => openCall(c.id)} style={{ ...S.rij, borderBottom: "1px solid #F3EEE3", alignItems: "flex-start" }}>
                <span style={{ fontSize: 18, lineHeight: "22px" }}>📞</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>
                    {c.onderwerp ? `${c.onderwerp.replace(/^📞\s*/, "")} · ` : ""}{c.datum ? datumKort(c.datum) : "Call"}{c.tijd ? ` ${c.tijd}` : ""}{c.met ? ` · ${c.met}` : ""}
                    {c.datum && c.datum >= vandaagStr() && !String(c.notities || "").trim() && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: C.blauw, background: "#2C6E8C14", borderRadius: 999, padding: "2px 7px" }}>📅 gepland</span>}
                  </span>
                  {callSamenvatting(c.notities) && <span style={{ display: "block", fontSize: 13, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{callSamenvatting(c.notities)}</span>}
                  {taken.length > 0 && <span style={{ display: "block", fontSize: 12, color: open ? C.oranje : C.groen, fontWeight: 600, marginTop: 2 }}>{taken.length} {taken.length === 1 ? "taak" : "taken"}{open ? ` · ${open} open` : " · alles klaar ✓"}</span>}
                </span>
                <ChevronRight size={16} color={C.licht} style={{ marginTop: 3 }} />
              </button>
            );
          })}
          {calls.length > 3 && (
            <button onClick={() => setAlles(!alles)} style={{ ...S.rij, justifyContent: "center", color: C.groen, fontSize: 13, fontWeight: 600 }}>{alles ? "Minder tonen" : `Alle ${calls.length} calls tonen`}</button>
          )}
        </div>
      )}
    </div>
  );
}

// Alles in de call-sheet wordt automatisch bewaard: notities kort na het
// typen (en bij sluiten / app wegklikken), taken direct bij ＋. Daarnaast een
// kopie op het toestel, voor als het opslaan naar de server mislukt.
const CALL_CONCEPT = (id) => `call-concept:${id}`;
function leesCallConcept(id) {
  try { const v = JSON.parse(localStorage.getItem(CALL_CONCEPT(id)) || "null"); return v && typeof v === "object" ? v : null; } catch { return null; }
}
function schrijfCallConcept(id, v) {
  try { localStorage.setItem(CALL_CONCEPT(id), JSON.stringify({ ...v, t: Date.now() })); } catch { /* geen opslag op dit toestel */ }
}

function CallTaakRegel({ taak, lopend, vandaag, wijzig, verwijder }) {
  const [naam, setNaam] = useState(taak.name);
  useEffect(() => { setNaam(taak.name); }, [taak.name]);
  const mini = (aan) => ({ ...S.chip(aan), padding: "4px 9px", fontSize: 12 });
  const morgen = volgendeWerkdag(vandaag);
  const eigenDatum = !!taak.dueDate && taak.dueDate !== vandaag && taak.dueDate !== morgen;
  const bewaarNaam = () => { const n = naam.trim(); if (n && n !== taak.name) wijzig({ name: n }); else setNaam(taak.name); };
  return (
    <div style={{ padding: "9px 12px", borderBottom: "1px solid #F3EEE3" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ color: taak.checked ? C.groen : C.licht, width: 14 }}>{taak.checked ? "✓" : "○"}</span>
        <input aria-label="Taaknaam" value={naam} onChange={e => setNaam(e.target.value)} onBlur={bewaarNaam} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", fontSize: 16, fontFamily: "inherit", background: "transparent", color: taak.checked ? C.muted : C.tekst, textDecoration: taak.checked ? "line-through" : "none", padding: 0 }} />
        <button aria-label="Taak weghalen" onClick={verwijder} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><X size={15} color={C.licht} /></button>
      </div>
      {!taak.checked && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6, marginLeft: 22 }}>
          {lopend && FASES.map(f => <button key={f.id} title={f.label} aria-label={f.label} style={mini(taak.category === f.id)} onClick={() => wijzig({ category: f.id })}>{f.icon}</button>)}
          {[["", "Geen"], [vandaag, "Vandaag"], [morgen, morgen === plusDagen(vandaag, 1) ? "Morgen" : "Maandag"]].map(([d, l]) => (
            <button key={l} style={mini((taak.dueDate || "") === d)} onClick={() => wijzig({ dueDate: d || null, herinnering: d && taak.herinnering ? `${d}T${taak.herinnering.slice(11, 16)}` : null })}>{l}</button>
          ))}
          <label style={{ ...mini(eigenDatum), position: "relative" }}>
            📅 {eigenDatum ? datumKort(taak.dueDate) : "Datum"}
            <input type="date" aria-label="Datum taak" value={taak.dueDate || ""} onChange={e => wijzig({ dueDate: e.target.value || null, herinnering: e.target.value && taak.herinnering ? `${e.target.value}T${taak.herinnering.slice(11, 16)}` : null })} style={{ position: "absolute", inset: 0, opacity: 0, width: "100%" }} />
          </label>
          {taak.herinnering && <span style={{ fontSize: 12, color: C.muted, padding: "4px 2px" }}>🔔 {taak.herinnering.slice(11, 16)}</span>}
        </div>
      )}
    </div>
  );
}

function CallSheet({ afwezigheden = [], voegAfwezigheidToe = null, klantNaam = "", lijst, callId, vandaag, chronoRef, metSuggesties = [], voorinvulling = null, sluit, bewaarCall, voegTaakToe, wijzigTaak, verwijderTaak, verwijder }) {
  const call = (lijst.project?.calls || []).find(c => c.id === callId) || null;
  // Call bij een vast moment (kickoff, PPM, geplande call): onderwerp, tijd en koppeling.
  const extraVast = { onderwerp: call?.onderwerp || voorinvulling?.onderwerp || "", momentTaakId: call?.momentTaakId || voorinvulling?.momentTaakId || null };
  const lopend = !!lijst.project && !["aanvraag", "offerte"].includes(projectStatus(lijst));
  const standaardFase = lopend ? (FASES.find(f => (lijst.items || []).some(i => i.category === f.id && !i.checked)) || FASES[0]).id : null;
  // Startwaarden: de bewaarde call, of een nieuwere kopie op dit toestel.
  const [start] = useState(() => {
    const basis = { datum: call?.datum || voorinvulling?.datum || vandaag, met: call?.met ?? voorinvulling?.met ?? "", notities: call?.notities || "", tijd: call?.tijd || voorinvulling?.tijd || "" };
    const c = leesCallConcept(callId);
    const nieuwer = c && (!call || c.t > (call.bijgewerktOp || 0) + 2000) && (c.notities !== basis.notities || c.met !== basis.met);
    return nieuwer ? { datum: c.datum || basis.datum, met: c.met || "", notities: c.notities || "", tijd: c.tijd ?? basis.tijd, hersteld: true } : basis;
  });
  const [datum, setDatum] = useState(start.datum);
  const [tijd, setTijd] = useState(start.tijd || "");
  const [met, setMet] = useState(start.met);
  const [notities, setNotities] = useState(start.notities);
  const [invoer, setInvoer] = useState("");
  const [genegeerd, setGenegeerd] = useState([]);
  const [verwijderVraag, setVerwijderVraag] = useState(false);
  const [status, setStatus] = useState(start.hersteld ? "hersteld" : call ? "bewaard" : "leeg");
  const spraak = useSpraak();
  const spraakBasis = useRef("");
  const laatste = useRef({ datum, met, notities, tijd });
  const wachtend = useRef(!!start.hersteld);
  const timer = useRef(null);
  laatste.current = { datum, met, notities, tijd };

  const bestaatAl = !!call;
  const heeftInhoud = (v) => !!(v.notities.trim() || v.met.trim());
  function nuBewaren() {
    clearTimeout(timer.current);
    if (!wachtend.current) return;
    const v = laatste.current;
    if (!bestaatAl && !heeftInhoud(v)) { wachtend.current = false; return; }
    bewaarCall({ id: callId, ...v, ...extraVast });
    wachtend.current = false;
    setStatus("bewaard");
  }
  const nuBewarenRef = useRef(nuBewaren);
  nuBewarenRef.current = nuBewaren;
  // Bij elke wijziging: kopie op het toestel + na 0,8 s naar de server.
  function gewijzigd(velden) {
    const v = { ...laatste.current, ...velden };
    laatste.current = v;
    schrijfCallConcept(callId, { ...v, listId: lijst.id });
    wachtend.current = true;
    setStatus("bezig");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => nuBewarenRef.current(), 800);
  }
  useEffect(() => {
    if (start.hersteld) nuBewarenRef.current();
    const weg = () => nuBewarenRef.current();
    const zicht = () => { if (document.visibilityState === "hidden") weg(); };
    window.addEventListener("pagehide", weg);
    document.addEventListener("visibilitychange", zicht);
    return () => { window.removeEventListener("pagehide", weg); document.removeEventListener("visibilitychange", zicht); nuBewarenRef.current(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const taken = callTakenVan(lijst, callId);
  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const bekend = new Set([...taken.map(i => norm(i.name)), ...taken.map(i => norm(i.callBron)), ...genegeerd]);
  const suggesties = callActiepunten(notities).filter(a => !bekend.has(norm(a.tekst)) && !bekend.has(norm(ontleedSnelleInvoer(a.tekst, chronoRef.current, new Date()).titel)));

  function maakTaak(tekst) {
    const slim = ontleedSnelleInvoer(tekst, chronoRef.current, new Date());
    const titel = (slim.titel || tekst).trim();
    voegTaakToe({ id: callId, ...laatste.current, ...extraVast }, {
      titel: titel.charAt(0).toUpperCase() + titel.slice(1), bron: tekst, fase: standaardFase,
      dueDate: slim.dueDate || null, herinnering: slim.herinnering || null,
    });
    wachtend.current = false;
    setStatus("bewaard");
  }
  function voegInvoerToe() {
    if (!invoer.trim()) return;
    maakTaak(invoer.trim());
    setInvoer("");
  }
  function klaar() {
    if (invoer.trim()) voegInvoerToe();
    nuBewaren();
    sluit();
  }
  function spreekIn() {
    if (!spraak.luistert) spraakBasis.current = notities.trim() ? notities.replace(/\s+$/, "") + "\n" : "";
    spraak.toggle(t => { const n = spraakBasis.current + t; setNotities(n); gewijzigd({ notities: n }); });
  }
  const mini = (aan) => ({ ...S.chip(aan), padding: "4px 9px", fontSize: 12 });
  const STATUS = {
    leeg: { t: "Wordt automatisch bewaard", k: C.muted },
    bezig: { t: "Bewaren…", k: C.muted },
    bewaard: { t: "✓ Automatisch bewaard", k: C.groen },
    hersteld: { t: "↺ Niet-bewaarde notities teruggezet", k: C.oranje },
  }[status];

  return (
    <div style={S.sheetAchter} onClick={klaar}>
      <div style={S.sheet} onClick={e => e.stopPropagation()} data-testid="call-sheet">
        <SheetKop titel={extraVast.onderwerp ? `📞 ${extraVast.onderwerp.replace(/^📞\s*/, "")}` : bestaatAl ? "📞 Call" : "📞 Nieuwe call"} sluit={klaar} />
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: -4 }}>
          <p style={{ ...S.hint, margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lijst.icon} {lijst.name}{extraVast.momentTaakId ? " · 📌 staat in de planning" : ""}</p>
          <span data-testid="call-status" style={{ fontSize: 12, fontWeight: 600, color: STATUS.k, whiteSpace: "nowrap" }}>{STATUS.t}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: "0 0 150px" }}>
            <p style={{ ...S.label, marginTop: 8 }}>Datum</p>
            <input type="date" aria-label="Datum call" value={datum || ""} onChange={e => { setDatum(e.target.value); gewijzigd({ datum: e.target.value }); }} style={S.inp} />
          </div>
          <div style={{ flex: "0 0 96px" }}>
            <p style={{ ...S.label, marginTop: 8 }}>Tijd</p>
            <input type="time" aria-label="Tijd call" value={tijd || ""} onChange={e => { setTijd(e.target.value); gewijzigd({ tijd: e.target.value }); }} style={{ ...S.inp, padding: "10px 8px" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...S.label, marginTop: 8 }}>Met wie</p>
            <input aria-label="Met wie" list="call-met" value={met} onChange={e => { setMet(e.target.value); gewijzigd({ met: e.target.value }); }} placeholder="Bijv. Leonie (klant)" style={S.inp} />
            <datalist id="call-met">{metSuggesties.map(n => <option key={n} value={n} />)}</datalist>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <p style={{ ...S.label, flex: 1 }}>Notities</p>
          <button onClick={spreekIn} aria-label={spraak.luistert ? "Stoppen met inspreken" : "Notities inspreken"}
            style={{ ...mini(spraak.luistert), marginTop: 10, display: "flex", alignItems: "center", gap: 4, ...(spraak.luistert ? { background: C.rood, borderColor: C.rood } : {}) }}>
            {spraak.luistert ? <><Square size={11} fill="#FAF6F0" /> Stop</> : <><Mic size={13} /> Inspreken</>}
          </button>
        </div>
        {(() => {
          const weg = datum ? (met.trim() ? afwezigOpDatum(afwezigheden, datum, { naam: met }) : afwezigOpDatum(afwezigheden, datum, { klantId: lijst.project?.klantId || "__geen" })) : [];
          return weg.length ? <p style={{ ...S.hint, color: C.oranje, fontWeight: 700, marginTop: 0 }}>⚠️ {weg.map(a => `${a.naam} is op ${datumKort(datum).toLowerCase()} afwezig (${periodeKort(a).toLowerCase()})`).join(" · ")}</p> : null;
        })()}
        {spraak.hint && <p style={{ ...S.hint, color: C.oranje, marginTop: 0 }}>{spraak.hint}</p>}
        <textarea aria-label="Notities call" value={notities} onChange={e => { setNotities(e.target.value); gewijzigd({ notities: e.target.value }); }} onBlur={nuBewaren} rows={7}
          placeholder={"Wat is er besproken?\n\nTip: begin een regel met -> of [ ] en het wordt een taaksuggestie:\n-> moodboard sturen vrijdag"}
          style={{ ...S.inp, resize: "vertical", lineHeight: 1.45 }} />
        {voegAfwezigheidToe && (() => {
          const g = herkenAfwezigheid(notities, chronoRef.current, new Date());
          if (!g) return null;
          const wie = met.trim() || klantNaam || "";
          const al = afwezigheden.some(a => a.van === g.van && a.tot === g.tot && (!wie || noemtPersoon(a.naam, wie) || noemtPersoon(wie, a.naam)));
          return (
            <div data-testid="afw-gevonden" style={{ display: "flex", gap: 8, alignItems: "center", background: "#FFF4E5", border: "1px solid #F1D3A8", borderRadius: 12, padding: "8px 10px", marginTop: 8, fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 0 }}>🏖️ Afwezigheid gevonden: <b>{wie || "iemand"}</b> {periodeKort(g).toLowerCase()}</span>
              {al ? <span style={{ color: C.groen, fontWeight: 700 }}>✓ Staat erin</span>
                : <button onClick={() => voegAfwezigheidToe({ naam: wie, van: g.van, tot: g.tot, notitie: g.regel.slice(0, 120) })} style={{ ...S.chip(true), padding: "4px 10px", fontSize: 12 }}>＋ Toevoegen</button>}
            </div>
          );
        })()}

        <p style={S.label}>✅ Taken uit deze call</p>
        {suggesties.length > 0 && (
          <div style={{ background: "#2D4A3E0D", border: `1px dashed ${C.groen}55`, borderRadius: 12, padding: 10, marginBottom: 8 }} data-testid="call-suggesties">
            <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: C.groen, fontWeight: 700, flex: 1 }}>Gevonden in je notities</span>
              {suggesties.length > 1 && <button style={mini(false)} onClick={() => suggesties.forEach(a => maakTaak(a.tekst))}>Alle {suggesties.length} toevoegen</button>}
            </div>
            {suggesties.map(a => (
              <div key={a.regel} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
                <span style={{ flex: 1, fontSize: 14, minWidth: 0 }}>{a.tekst}</span>
                <button style={mini(true)} onClick={() => maakTaak(a.tekst)}>＋ Taak</button>
                <button aria-label="Negeren" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }} onClick={() => setGenegeerd(g => [...g, norm(a.tekst)])}><X size={15} color={C.licht} /></button>
              </div>
            ))}
          </div>
        )}
        {taken.length > 0 && (
          <div style={{ ...S.kaart, marginBottom: 8 }} data-testid="call-taken">
            {taken.map(t => (
              <CallTaakRegel key={t.id} taak={t} lopend={lopend} vandaag={vandaag} wijzig={(v) => wijzigTaak(t.id, v)} verwijder={() => verwijderTaak(t.id)} />
            ))}
          </div>
        )}
        <form onSubmit={e => { e.preventDefault(); voegInvoerToe(); }} style={{ display: "flex", gap: 8 }}>
          <input aria-label="Nieuwe taak uit call" value={invoer} onChange={e => setInvoer(e.target.value)} placeholder="Taak — bv. 'vrijdag moodboard sturen'" style={{ ...S.inp, flex: 1, minWidth: 0 }} />
          <button type="submit" aria-label="Taak toevoegen aan call" style={{ ...S.knop(C.bg, C.groen), border: `1px solid ${C.rand2}`, padding: "8px 12px", display: "flex", alignItems: "center" }}><Plus size={18} /></button>
        </form>
        <p style={{ ...S.hint, marginTop: 6 }}>Taken komen meteen in het project. Alles wordt automatisch bewaard — ook als je dit venster sluit.</p>

        <button onClick={klaar} style={{ ...S.knop(), width: "100%", marginTop: 12 }}>Klaar</button>
        {bestaatAl && (verwijderVraag ? (
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            <span style={{ flex: 1, fontSize: 13, color: C.muted }}>Call verwijderen? De taken blijven staan.</span>
            <button style={S.knop(C.bg, C.tekst)} onClick={() => setVerwijderVraag(false)}>Nee</button>
            <button style={S.knop("#FBEDE8", C.rood)} onClick={() => { clearTimeout(timer.current); wachtend.current = false; try { localStorage.removeItem(CALL_CONCEPT(callId)); } catch { /* niets */ } verwijder(); }}>Verwijder</button>
          </div>
        ) : (
          <button onClick={() => setVerwijderVraag(true)} style={{ background: "none", border: "none", color: C.rood, fontSize: 13, marginTop: 12, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>Call verwijderen</button>
        ))}
      </div>
    </div>
  );
}

function SheetKop({ titel, sluit }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
      <h2 style={{ margin: 0, flex: 1, fontSize: 18, color: C.groen }}>{titel}</h2>
      <button onClick={sluit} aria-label="Sluiten" style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}><X size={20} color={C.licht} /></button>
    </div>
  );
}

function NieuweLijstSheet({ ruimte, sluit, maak }) {
  const [naam, setNaam] = useState("");
  const [icoon, setIcoon] = useState(ruimte === "werk" ? "💼" : "📋");
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <SheetKop titel={ruimte === "werk" ? "Nieuwe werklijst" : "Nieuwe thuislijst"} sluit={sluit} />
        <form onSubmit={e => { e.preventDefault(); if (naam.trim()) maak(naam.trim(), icoon); }}>
          <input autoFocus style={S.inp} placeholder={ruimte === "werk" ? "Bijv. Häcker-shoot of Administratie" : "Bijv. Klusjes"} value={naam} onChange={e => setNaam(e.target.value)} />
          <p style={S.label}>Icoon</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {LIJST_ICONEN.map(ic => <button type="button" key={ic} onClick={() => setIcoon(ic)} style={{ ...S.chip(icoon === ic), padding: "6px 9px", fontSize: 17 }}>{ic}</button>)}
          </div>
          <p style={S.hint}>{ruimte === "werk" ? "Werklijsten zijn alleen voor jou zichtbaar." : "Thuislijsten zijn gedeeld en verschijnen ook in Lijsten."}</p>
          <button type="submit" style={{ ...S.knop(), width: "100%", marginTop: 16, opacity: naam.trim() ? 1 : 0.5 }} disabled={!naam.trim()}>Lijst maken</button>
        </form>
      </div>
    </div>
  );
}

function PinSheet({ modus, setModus, ik, sluit, klaar }) {
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [nieuwePin, setNieuwePin] = useState("");
  const [herstelcode, setHerstelcode] = useState("");
  const [fout, setFout] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [toonCode, setToonCode] = useState(null);
  const pinInput = (waarde, zet, label, autoFocus) => (
    <input type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]*" maxLength={8} autoFocus={autoFocus} aria-label={label} placeholder={label}
      value={waarde} onChange={e => zet(e.target.value.replace(/\D/g, ""))} style={{ ...S.inp, fontSize: 22, letterSpacing: "0.4em", textAlign: "center", marginBottom: 8 }} />
  );
  async function stuur(body) {
    setBezig(true); setFout(null);
    try {
      const r = await fetch("/api/taken/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setFout(d.error || "Dat lukte niet"); return; }
      if (d.herstelcode) setToonCode(d.herstelcode); else klaar();
    } catch { setFout("Geen verbinding"); } finally { setBezig(false); }
  }
  if (toonCode) {
    return (
      <div style={S.sheetAchter}>
        <div style={S.sheet}>
          <SheetKop titel="Bewaar je herstelcode" sluit={klaar} />
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>Ben je je pincode ooit kwijt, dan heb je deze code nodig. Hij wordt maar één keer getoond — zet hem bijvoorbeeld in je wachtwoordmanager.</p>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "0.12em", textAlign: "center", padding: 16, background: C.bg, borderRadius: 14, color: C.groen, fontFamily: "ui-monospace, Menlo, monospace" }}>{toonCode}</div>
          <button style={{ ...S.knop(C.bg, C.tekst), width: "100%", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => kopieer(toonCode)}><Copy size={15} /> Kopiëren</button>
          <button style={{ ...S.knop(), width: "100%", marginTop: 10 }} onClick={klaar}>Ik heb hem bewaard</button>
        </div>
      </div>
    );
  }
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        {modus === "instellen" && (
          <form onSubmit={e => { e.preventDefault(); if (!isGeldigePin(pin)) return setFout("Kies 6 tot 8 cijfers"); if (pin !== pin2) return setFout("De twee pincodes zijn niet gelijk"); stuur({ actie: "instellen", pin }); }}>
            <SheetKop titel={`Werkruimte voor ${ik || "jou"}`} sluit={sluit} />
            <p style={{ fontSize: 14, lineHeight: 1.5, color: C.muted, marginTop: 0 }}>Kies een pincode van 6 tot 8 cijfers. Je voert hem één keer per toestel in; daarna blijft je werkruimte daar 30 dagen open.</p>
            {pinInput(pin, setPin, "Pincode", true)}
            {pinInput(pin2, setPin2, "Herhaal pincode")}
            {fout && <p style={{ color: C.rood, fontSize: 13 }}>{fout}</p>}
            <button type="submit" disabled={bezig} style={{ ...S.knop(), width: "100%", marginTop: 6 }}>{bezig ? "Bezig…" : "Werkruimte aanmaken"}</button>
          </form>
        )}
        {modus === "ontgrendel" && (
          <form onSubmit={e => { e.preventDefault(); stuur({ actie: "ontgrendel", pin }); }}>
            <SheetKop titel="Werkruimte ontgrendelen" sluit={sluit} />
            {pinInput(pin, setPin, "Pincode", true)}
            {fout && <p style={{ color: C.rood, fontSize: 13 }}>{fout}</p>}
            <button type="submit" disabled={bezig || pin.length < 6} style={{ ...S.knop(), width: "100%", marginTop: 6, opacity: pin.length < 6 ? 0.5 : 1 }}>{bezig ? "Bezig…" : "Ontgrendelen"}</button>
            <button type="button" onClick={() => { setModus("herstel"); setFout(null); }} style={{ ...S.knop("transparent", C.muted), width: "100%", marginTop: 6, fontWeight: 400 }}>Pincode vergeten?</button>
          </form>
        )}
        {modus === "herstel" && (
          <form onSubmit={e => { e.preventDefault(); if (!isGeldigePin(nieuwePin)) return setFout("Kies 6 tot 8 cijfers"); stuur({ actie: "herstel", herstelcode, nieuwePin }); }}>
            <SheetKop titel="Pincode herstellen" sluit={sluit} />
            <p style={{ fontSize: 14, color: C.muted, marginTop: 0 }}>Vul de herstelcode in die je kreeg bij het instellen (bijv. ABCD-EFGH-JKLM) en kies een nieuwe pincode.</p>
            <input style={{ ...S.inp, textTransform: "uppercase", marginBottom: 8, fontFamily: "ui-monospace, Menlo, monospace" }} placeholder="Herstelcode" value={herstelcode} onChange={e => setHerstelcode(e.target.value)} autoFocus />
            {pinInput(nieuwePin, setNieuwePin, "Nieuwe pincode")}
            {fout && <p style={{ color: C.rood, fontSize: 13 }}>{fout}</p>}
            <button type="submit" disabled={bezig} style={{ ...S.knop(), width: "100%", marginTop: 6 }}>{bezig ? "Bezig…" : "Herstellen"}</button>
          </form>
        )}
        {modus === "wijzig" && (
          <form onSubmit={e => { e.preventDefault(); if (!isGeldigePin(nieuwePin)) return setFout("Kies 6 tot 8 cijfers"); stuur({ actie: "wijzig", pin, nieuwePin }); }}>
            <SheetKop titel="Pincode wijzigen" sluit={sluit} />
            {pinInput(pin, setPin, "Huidige pincode", true)}
            {pinInput(nieuwePin, setNieuwePin, "Nieuwe pincode")}
            <p style={S.hint}>Na het wijzigen moet je op je andere toestellen opnieuw ontgrendelen.</p>
            {fout && <p style={{ color: C.rood, fontSize: 13 }}>{fout}</p>}
            <button type="submit" disabled={bezig} style={{ ...S.knop(), width: "100%", marginTop: 10 }}>{bezig ? "Bezig…" : "Wijzigen"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

function MailSheet({ ik, info, setInfo, sluit, meld }) {
  const [afzenders, setAfzenders] = useState((info?.toegestaneAfzenders || []).join("\n"));
  const [domein, setDomein] = useState(info?.domein || "");
  const [bezig, setBezig] = useState(false);
  useEffect(() => {
    fetch("/api/taken/mail").then(r => (r.ok ? r.json() : null)).then(d => {
      if (!d) return;
      setInfo(d); setAfzenders((d.toegestaneAfzenders || []).join("\n")); setDomein(d.domein || "");
    }).catch(() => {});
  }, []);
  async function bewaar(body, melding) {
    setBezig(true);
    try {
      const r = await fetch("/api/taken/mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { meld(`⚠️ ${d.error || "Opslaan mislukt"}`); return; }
      setInfo(d); setAfzenders((d.toegestaneAfzenders || []).join("\n")); setDomein(d.domein || "");
      meld(melding);
    } finally { setBezig(false); }
  }
  function downloadContact() {
    const vcf = `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Taken – werk ${ik || ""}\r\nN:Werk ${ik || ""};Taken;;;\r\nEMAIL;TYPE=INTERNET:${info.adres}\r\nNOTE:Mail of forward hierheen om er een werktaak van te maken (Ons Huishouden → Taken).\r\nEND:VCARD\r\n`;
    const url = URL.createObjectURL(new Blob([vcf], { type: "text/vcard" }));
    const a = document.createElement("a");
    a.href = url; a.download = "taken-werk.vcf"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <SheetKop titel="Taak via e-mail" sluit={sluit} />
        {info?.adres ? (
          <>
            <p style={{ ...S.label, marginTop: 6 }}>Jouw adres</p>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.groen, background: C.bg, borderRadius: 12, padding: "12px 14px", wordBreak: "break-all" }}>{info.adres}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button style={{ ...S.knop(), display: "flex", alignItems: "center", gap: 6 }} onClick={async () => { if (await kopieer(info.adres)) meld("📋 Gekopieerd"); }}><Copy size={15} /> Kopiëren</button>
              <button style={{ ...S.knop(C.bg, C.tekst), display: "flex", alignItems: "center", gap: 6 }} onClick={downloadContact}><Download size={15} /> Zet in contacten</button>
              <a href={`mailto:${info.adres}?subject=${encodeURIComponent("Morgen 9:00 test van Taken")}`} style={{ ...S.knop(C.bg, C.tekst), display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}><Send size={15} /> Testmail</a>
            </div>
            <p style={S.hint}>Tip: met "Zet in contacten" staat het adres als <strong>Taken – werk</strong> in je adresboek, zodat je het bij forwarden gewoon kunt intypen. Dit adres staat ook altijd bovenaan bij Werk in Taken.</p>
          </>
        ) : (
          <p style={{ fontSize: 14, color: C.muted }}>Je adres verschijnt hier zodra het ontvangstdomein hieronder is ingevuld.</p>
        )}

        <p style={S.label}>Van welke adressen mail je?</p>
        <textarea rows={3} style={{ ...S.inp, fontSize: 14 }} value={afzenders} onChange={e => setAfzenders(e.target.value)} placeholder={"bijv. jouw@hotmail.com\njouw@zakelijk.nl"} />
        <p style={S.hint}>Alleen mail vanaf deze adressen wordt een taak — al het andere wordt genegeerd. Eén adres per regel.</p>
        <button disabled={bezig} style={{ ...S.knop(), marginTop: 8 }} onClick={() => bewaar({ toegestaneAfzenders: afzenders.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean) }, "✅ Afzenders bewaard")}>Afzenders bewaren</button>

        {!info?.domeinVastInVercel && (
          <>
            <p style={S.label}>Ontvangstdomein (Resend)</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...S.inp, fontSize: 14 }} placeholder="bijv. abc123.resend.app" value={domein} onChange={e => setDomein(e.target.value)} />
              <button disabled={bezig} style={S.knop()} onClick={() => bewaar({ domein }, "✅ Domein bewaard")}>Bewaar</button>
            </div>
            <p style={S.hint}>Te vinden in Resend → Emails → Receiving. Dit domein is voor het hele huishouden hetzelfde; ieders adres blijft persoonlijk.</p>
          </>
        )}

        <p style={S.label}>Status</p>
        <p style={{ fontSize: 14, margin: 0 }}>{info?.webhookIngericht ? "✅ Ontvangen is ingericht." : "⚠️ Ontvangen is nog niet ingericht: in Vercel ontbreekt RESEND_WEBHOOK_SECRET (en/of RESEND_API_KEY)."}</p>
        {(info?.log || []).length > 0 && (
          <div style={{ marginTop: 10 }}>
            <p style={{ ...S.label, marginTop: 6 }}>Laatst ontvangen</p>
            {info.log.map((r, i) => (
              <p key={i} style={{ fontSize: 12, margin: "0 0 4px", color: r.status === "taak" ? C.tekst : C.rood }}>
                {new Date(r.op).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {r.status === "taak" ? `✅ ${r.taak}` : `⛔ ${r.reden}`} <span style={{ color: C.muted }}>({r.van})</span>
              </p>
            ))}
          </div>
        )}
        {info?.adres && (
          <button disabled={bezig} onClick={() => { if (window.confirm("Nieuw adres maken? Het oude adres werkt daarna niet meer.")) bewaar({ vernieuw: true }, "🔄 Nieuw adres aangemaakt"); }}
            style={{ ...S.knop("transparent", C.muted), fontWeight: 400, padding: "12px 0 0" }}>Krijg je spam op dit adres? Maak een nieuw adres</button>
        )}
      </div>
    </div>
  );
}

function KlantenSheet({ klanten, sluit, opslaan }) {
  const [lijst, setLijst] = useState(klanten);
  const [nieuw, setNieuw] = useState("");
  const zet = (next) => { setLijst(next); opslaan(next); };
  const actief = lijst.filter(k => !k.gearchiveerd);
  const archief = lijst.filter(k => k.gearchiveerd);
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <SheetKop titel="Klanten & projecten" sluit={sluit} />
        <p style={{ ...S.hint, marginTop: 0 }}>Koppel werktaken aan een klant of project en filter er per klant op. Alleen zichtbaar in jouw werkruimte.</p>
        <form onSubmit={e => { e.preventDefault(); if (!nieuw.trim()) return; zet([...lijst, { id: uid(), naam: nieuw.trim(), kleur: KLANT_KLEUREN[lijst.length % KLANT_KLEUREN.length] }]); setNieuw(""); }} style={{ display: "flex", gap: 8, margin: "12px 0" }}>
          <input style={S.inp} placeholder="Nieuwe klant of project" value={nieuw} onChange={e => setNieuw(e.target.value)} />
          <button type="submit" style={S.knop()}>Voeg toe</button>
        </form>
        {actief.map(k => (
          <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.rand}` }}>
            <input defaultValue={k.naam} onBlur={e => e.target.value.trim() && e.target.value.trim() !== k.naam && zet(lijst.map(x => (x.id === k.id ? { ...x, naam: e.target.value.trim() } : x)))}
              style={{ ...S.inp, flex: 1, padding: "8px 10px", fontSize: 14, borderLeft: `6px solid ${k.kleur || C.groen}` }} aria-label="Naam klant" />
            <div style={{ display: "flex", gap: 3 }}>
              {KLANT_KLEUREN.slice(0, 5).map(kl => <button key={kl} aria-label="Kleur" onClick={() => zet(lijst.map(x => (x.id === k.id ? { ...x, kleur: kl } : x)))} style={{ width: 18, height: 18, borderRadius: 999, background: kl, border: k.kleur === kl ? "2px solid #000" : "none", cursor: "pointer", padding: 0 }} />)}
            </div>
            <button onClick={() => zet(lijst.map(x => (x.id === k.id ? { ...x, gearchiveerd: true } : x)))} style={{ ...S.chip(false), padding: "5px 9px", fontSize: 12 }}>Archiveer</button>
          </div>
        ))}
        {archief.length > 0 && (
          <>
            <p style={S.label}>Gearchiveerd</p>
            {archief.map(k => (
              <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                <span style={{ flex: 1, fontSize: 14, color: C.muted }}>● {k.naam}</span>
                <button onClick={() => zet(lijst.map(x => (x.id === k.id ? { ...x, gearchiveerd: false } : x)))} style={{ ...S.chip(false), padding: "5px 9px", fontSize: 12 }}>Terugzetten</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function ImportSheet({ thuisLijsten, werkLijsten, werkStaat, chronoRef, sluit, importeer }) {
  const [tekst, setTekst] = useState("");
  const [ruimte, setRuimte] = useState("thuis");
  const [listId, setListId] = useState("__nieuw");
  const [perKopje, setPerKopje] = useState(true);
  const [datums, setDatums] = useState(true);
  const resultaat = ontleedPlakImport(tekst);
  const totaal = resultaat.groepen.reduce((n, g) => n + g.taken.length, 0);
  const kopjes = resultaat.groepen.filter(g => g.lijstNaam).length;
  const lijsten = ruimte === "werk" ? werkLijsten : thuisLijsten;
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <SheetKop titel="Taken plakken" sluit={sluit} />
        <p style={{ ...S.hint, marginTop: 0 }}>
          Plak een lijst: één taak per regel. Opsommingstekens en vinkjes (☐, [ ], -, •, 1.) worden opgeruimd, afgevinkte regels ([x], ☑) overgeslagen,
          ingesprongen regels worden stappen en een regel die eindigt op ":" wordt een eigen lijst.
          Uit Microsoft To Do: gebruik daar (als je versie dat heeft) "Lijst afdrukken" of "Lijst e-mailen" en kopieer de tekst. Zodra Microsoft de beloofde export uitbrengt, kun je die tekst hier ook plakken.
        </p>
        <textarea rows={8} value={tekst} onChange={e => setTekst(e.target.value)} placeholder={"Werk:\n- Offerte Häcker vrijdag\n    draaiboek checken\n- Factuur oktober\nThuis:\n- Kliko buiten elke maandag"} style={{ ...S.inp, fontSize: 14, fontFamily: "ui-monospace, Menlo, monospace" }} />
        <p style={S.label}>Waarheen?</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button style={S.chip(ruimte === "thuis")} onClick={() => { setRuimte("thuis"); setListId("__nieuw"); }}>🏠 Thuis</button>
          {werkStaat === "open" && <button style={S.chip(ruimte === "werk")} onClick={() => { setRuimte("werk"); setListId("__nieuw"); }}>💼 Werk</button>}
        </div>
        <select value={listId} onChange={e => setListId(e.target.value)} style={{ ...S.inp, marginTop: 8, fontSize: 14 }} aria-label="Doellijst">
          <option value="__nieuw">Nieuwe lijst "Geïmporteerd"</option>
          {lijsten.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
        </select>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 14 }}>
          <input type="checkbox" checked={perKopje} onChange={e => setPerKopje(e.target.checked)} /> Kopjes ("Werk:") worden aparte lijsten {kopjes ? `(${kopjes} gevonden)` : ""}
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, fontSize: 14 }}>
          <input type="checkbox" checked={datums} onChange={e => setDatums(e.target.checked)} /> Datums en herhaling herkennen ("vrijdag", "elke maandag")
        </label>
        {totaal > 0 && (
          <div style={{ background: C.bg, borderRadius: 12, padding: 10, marginTop: 10, maxHeight: 160, overflowY: "auto", fontSize: 13 }}>
            {resultaat.groepen.map((g, gi) => (
              <div key={gi} style={{ marginBottom: 6 }}>
                {g.lijstNaam && perKopje && <strong>{g.lijstNaam}</strong>}
                {g.taken.slice(0, 30).map((t, ti) => {
                  const s = datums ? ontleedSnelleInvoer(t.tekst, chronoRef.current, new Date()) : null;
                  return <div key={ti}>• {s?.titel || t.tekst}{s?.dueDate ? ` — 📅 ${datumKort(s.dueDate)}` : ""}{s?.herhaling ? ` 🔁` : ""}{t.substappen.length ? ` (${t.substappen.length} stappen)` : ""}</div>;
                })}
              </div>
            ))}
          </div>
        )}
        {resultaat.overgeslagen > 0 && <p style={S.hint}>{resultaat.overgeslagen} afgevinkte {resultaat.overgeslagen === 1 ? "regel" : "regels"} overgeslagen.</p>}
        <button disabled={!totaal} onClick={() => importeer({ ruimte, listId, groepen: resultaat.groepen, perKopje, datums })}
          style={{ ...S.knop(), width: "100%", marginTop: 14, opacity: totaal ? 1 : 0.5 }}>
          {totaal ? `Importeer ${totaal} ${totaal === 1 ? "taak" : "taken"}` : "Plak eerst je taken"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PROJECTSJABLONEN
// ════════════════════════════════════════════════════════════════════
// Offerte in de lijstweergave: status, bedrag, wanneer de volgende navraag
// komt, en de knoppen Akkoord / Nagevraagd / Afgewezen.
function OfferteKop({ lijst, klanten, klantVan, zetProject, openAkkoord, openAfwijzen, nagevraagd, meld, openVersie }) {
  const o = lijst.project.offerte || {};
  const dagen = o.verstuurdOp ? dagenTussen(o.verstuurdOp, vandaagStr()) : 0;
  const navraag = (lijst.items || []).find(i => i.offerteNavraag && !i.checked);
  const klant = klantVan(lijst.project.klantId);
  return (
    <div style={{ ...S.kaart, padding: 14, background: "#FFF8EC" }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.oranje, letterSpacing: "0.04em" }}>📨 OFFERTE — WACHT OP AKKOORD</p>
      <p style={{ margin: "6px 0 0", fontSize: 14 }}>
        Verstuurd {datumKort(o.verstuurdOp).toLowerCase()} ({dagen} {dagen === 1 ? "dag" : "dagen"} geleden)
        {openVersies(lijst.project).length > 1 ? ` · ${openVersies(lijst.project).length} opties: ${openVersies(lijst.project).map(v => (v.bedrag != null ? euro(v.bedrag) : "—")).join(" / ")}` : o.bedrag ? ` · ${euro(o.bedrag)}` : ""}
        {o.keerNagevraagd ? ` · ${o.keerNagevraagd}× nagevraagd` : ""}
      </p>
      {lijst.project.deliverables && deliverablesTekst(lijst.project.deliverables) && <p style={{ margin: "6px 0 0", fontSize: 13 }}>📦 {deliverablesTekst(lijst.project.deliverables)}</p>}
      {lijst.project.intake?.tekst && <IntakeBlok intake={lijst.project.intake} zetTekst={(tekst) => zetProject({ intake: { ...lijst.project.intake, tekst } })} />}
      <OffertesBlok lijst={lijst} openVersie={openVersie} nogVoorAkkoord />
      <SpecificatieBlok lijst={lijst} klantNaam={klant?.naam} zetProject={zetProject} meld={meld} />
      {navraag && <p style={{ ...S.hint, marginTop: 4 }}>🔔 Volgende navraag: {herinneringKort(navraag.herinnering) || datumKort(navraag.dueDate)} — en daarna {herhalingLabel(navraag.herhaling).toLowerCase()}, tot je op Akkoord of Afgewezen tikt.</p>}
      <select value={lijst.project.klantId || ""} onChange={e => zetProject({ klantId: e.target.value || null })} aria-label="Klant"
        style={{ ...S.inp, width: "auto", padding: "6px 10px", fontSize: 13, marginTop: 10, color: klant?.kleur || C.tekst, fontWeight: 700 }}>
        <option value="">Geen klant</option>
        {klanten.map(k => <option key={k.id} value={k.id}>● {k.naam}</option>)}
      </select>
      <p style={{ margin: "12px 0 0", fontSize: 12, color: C.muted }}>Reactie van de klant binnen?</p>
      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
        <button style={{ ...S.knop(C.bg, C.groen), border: `1px solid ${C.groen}`, flex: "1 1 auto" }} onClick={openAkkoord}>👍 Akkoord gekregen — productie starten</button>
        {navraag && <button style={{ ...S.knop(C.bg, C.groen), border: `1px solid ${C.rand2}` }} onClick={nagevraagd}>Nagevraagd</button>}
        <button style={{ ...S.knop(C.bg, C.rood), border: `1px solid ${C.rand2}` }} onClick={openAfwijzen}>✕ Afgewezen</button>
      </div>
    </div>
  );
}

function OfferteSheet({ klanten, vandaag, nieuweKlant, sluit, maak, vanAanvraag = null }) {
  const [naam, setNaam] = useState(vanAanvraag?.name || "");
  const [klantId, setKlantId] = useState(vanAanvraag?.project?.klantId || "");
  const [nieuweKlantNaam, setNieuweKlantNaam] = useState("");
  const [verstuurdOp, setVerstuurdOp] = useState(vandaag);
  const [bedrag, setBedrag] = useState("");
  const [weken, setWeken] = useState(1);
  const [tijd, setTijd] = useState("10:00");
  const [notitie, setNotitie] = useState("");
  const [deliverables, setDeliverables] = useState(() => normaliseerDeliverables(vanAanvraag?.project?.deliverables || {}));
  const [spec, setSpec] = useState(null);
  function pdfGelezen(o) {
    setSpec(o);
    if (!naam.trim() && o.betreft) setNaam(korteProjectnaam(o.betreft));
    if (o.totaal != null) setBedrag(o.totaal.toLocaleString("nl-NL", { minimumFractionDigits: o.totaal % 1 ? 2 : 0, maximumFractionDigits: 2 }));
    const h = herkenUitOfferte(o, { vandaag, klanten });
    if (h.klantId && !klantId) setKlantId(h.klantId);
    if (Object.keys(h.deliverables || {}).length) setDeliverables(d => normaliseerDeliverables({ ...h.deliverables, ...Object.fromEntries(Object.entries(d).filter(([, v]) => (Array.isArray(v) ? v.length : v))) }));
  }
  const bedragGetal = bedrag ? Number(String(bedrag).replace(/\./g, "").replace(",", ".")) : null;
  const eerste = plusDagen(verstuurdOp || vandaag, 7 * weken);
  const kan = naam.trim() && verstuurdOp && (bedrag === "" || Number.isFinite(bedragGetal));
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <SheetKop titel="Offerte verstuurd" sluit={sluit} />
        <p style={{ ...S.hint, marginTop: 0 }}>De app vraagt je elke week om na te vragen hoe het ervoor staat. Bij akkoord start je met één tik de productie vanuit een sjabloon.</p>
        {vanAanvraag?.project?.budget != null && <p style={S.hint}>💶 Budget uit het eerste gesprek: € {Number(vanAanvraag.project.budget).toLocaleString("nl-NL")}</p>}
        <div style={{ marginTop: 10 }}>
          <OffertePdfKnop onGelezen={pdfGelezen} label={spec ? "📄 Andere offerte-PDF kiezen" : "📄 Offerte-PDF inlezen (vult bedrag en posten in)"} />
          {spec && <SpecificatieSamenvatting spec={spec} />}
        </div>
        <p style={S.label}>Project / offerte</p>
        <input style={S.inp} autoFocus placeholder="Bijv. Häcker voorjaarscampagne" value={naam} onChange={e => setNaam(e.target.value)} />
        <p style={S.label}><Tag size={14} /> Klant</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button style={S.chip(!klantId)} onClick={() => setKlantId("")}>Geen</button>
          {klanten.map(k => <button key={k.id} style={{ ...S.chip(klantId === k.id), ...(klantId === k.id ? { background: k.kleur || C.groen, borderColor: k.kleur || C.groen } : {}) }} onClick={() => setKlantId(k.id)}>● {k.naam}</button>)}
        </div>
        <form onSubmit={e => { e.preventDefault(); if (nieuweKlantNaam.trim()) { setKlantId(nieuweKlant(nieuweKlantNaam)); setNieuweKlantNaam(""); } }} style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input style={{ ...S.inp, padding: "8px 12px", fontSize: 14 }} placeholder="+ Nieuwe klant" value={nieuweKlantNaam} onChange={e => setNieuweKlantNaam(e.target.value)} />
          {nieuweKlantNaam.trim() && <button type="submit" style={S.knop()}>Voeg toe</button>}
        </form>
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ flex: 1 }}><span style={S.label}>Verstuurd op</span>
            <input type="date" style={S.inp} value={verstuurdOp} max={vandaag} onChange={e => setVerstuurdOp(e.target.value)} />
          </label>
          <label style={{ flex: 1 }}><span style={S.label}>Bedrag (optioneel)</span>
            <input style={S.inp} inputMode="decimal" placeholder="€" value={bedrag} onChange={e => setBedrag(e.target.value)} />
          </label>
        </div>
        <p style={S.label}><Bell size={14} /> Navragen</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {[[1, "Elke week"], [2, "Om de 2 weken"]].map(([w, l]) => <button key={w} style={S.chip(weken === w)} onClick={() => setWeken(w)}>{l}</button>)}
          <span style={{ fontSize: 14, marginLeft: 4 }}>om</span>
          <input type="time" value={tijd} onChange={e => setTijd(e.target.value || "10:00")} style={{ ...S.inp, width: 110, padding: "7px 10px" }} aria-label="Tijd van de herinnering" />
        </div>
        <p style={S.hint}>Eerste herinnering: {datumKort(eerste < vandaag ? vandaag : eerste).toLowerCase()} om {tijd}. Tik bij de melding op "Nagevraagd", dan vraagt de app het een {weken === 1 ? "week" : "2 weken"} later opnieuw.</p>
        <p style={S.label}>📦 Deliverables in de offerte</p>
        <DeliverablesKiezer waarde={deliverables} zet={setDeliverables} />
        <p style={S.label}>Notitie (optioneel)</p>
        <textarea rows={2} style={{ ...S.inp, fontSize: 14 }} placeholder="Contactpersoon, wat je hebt afgesproken…" value={notitie} onChange={e => setNotitie(e.target.value)} />
        <button disabled={!kan} onClick={() => maak({ naam: naam.trim(), klantId: klantId || null, verstuurdOp, bedrag: bedragGetal, weken, tijd, notitie: notitie.trim(), deliverables, specificatie: spec ? compacteSpecificatie(spec) : null })}
          style={{ ...S.knop(), width: "100%", marginTop: 16, opacity: kan ? 1 : 0.5 }}>📨 Offerte vastleggen</button>
      </div>
    </div>
  );
}

function AfwijzenSheet({ lijst, sluit, bevestig }) {
  const [reden, setReden] = useState("");
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <SheetKop titel={`Offerte "${lijst.name}" afgewezen`} sluit={sluit} />
        <p style={{ ...S.hint, marginTop: 0 }}>De wekelijkse herinnering stopt en de offerte gaat naar "Afgeronde projecten". Je kunt hem daar altijd terugvinden.</p>
        <p style={S.label}>Reden (optioneel, handig voor later)</p>
        <input style={S.inp} placeholder="Bijv. te duur, ander bureau, project uitgesteld" value={reden} onChange={e => setReden(e.target.value)} />
        <button style={{ ...S.knop(C.rood), width: "100%", marginTop: 16 }} onClick={() => bevestig(reden.trim())}>Markeer als afgewezen</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PLANNING PER PROJECT — tijdlijn (lijst) en tijdbalk (gantt)
// Geïnspireerd op GitHub Projects (roadmap: slepen, vaste momenten als
// lijnen, zoom) en frappe/gantt (afhankelijkheden: opvolgers schuiven mee).
// Modus 🔗 Keten: alleen taken die op de verzette taak wachten schuiven mee.
// Modus ⏩ Alles erna: alles wat later kwam (tot draaidag/oplevering).
// Modus Los: alleen de taak zelf.
// ════════════════════════════════════════════════════════════════════
const PLAN_MODI = [["keten", "🔗 Keten"], ["alles", "⏩ Alles erna"], ["los", "Los"]];
const MODUS_UITLEG = {
  keten: "Verzet je een taak, dan schuiven de taken die erop wachten mee — met hun eigen wachttijd.",
  alles: "Verzet je een taak, dan schuift alles erna mee (tot de draaidag of oplevering).",
  los: "Alleen de taak die je verzet verandert.",
};
function SpelingLabel({ n }) {
  if (n == null) return null;
  const kleur = n < 0 ? C.rood : n <= 1 ? C.oranje : C.groen;
  return <span title="Werkdagen speling tot het volgende vaste moment" style={{ fontSize: 11, fontWeight: 700, color: kleur, background: `${kleur}14`, borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap" }}>{n < 0 ? `${-n} wd te laat` : `${n} wd speling`}</span>;
}

function PlanningSheet({ afwezigheden = [], klantVan = () => null, openAfwezigheid, lijst, vandaag, sluit, schuif, herstel, zetVast, weekendWeg, koppel, wachtDagen, stelVoor, verzetMomentFn, verschuifAnker, planCall, openMomentCall, metSuggesties = [] }) {
  const p = lijst.project || {};
  const heeftKeten = (lijst.items || []).some(i => i.naId && !i.checked);
  const [modus, setModus] = useState(() => { try { return localStorage.getItem("planning-modus") || (heeftKeten ? "keten" : "alles"); } catch { return heeftKeten ? "keten" : "alles"; } });
  const [weergave, setWeergave] = useState(() => (typeof window !== "undefined" && window.innerWidth >= 900 ? "balk" : "lijst"));
  const [laatste, setLaatste] = useState(null);
  const [geraakt, setGeraakt] = useState([]);
  const [koppelOpen, setKoppelOpen] = useState(null);
  const [melding, setMelding] = useState(null);
  const [momentOpen, setMomentOpen] = useState(null); // { id, datum, tijd }
  const [planOpen, setPlanOpen] = useState(null); // { onderwerp, met, datum, tijd }
  useEffect(() => { if (!geraakt.length) return; const t = setTimeout(() => setGeraakt([]), 2500); return () => clearTimeout(t); }, [geraakt]);
  const zetModus = (m) => { setModus(m); try { localStorage.setItem("planning-modus", m); } catch { /* niets */ } };
  const open = (lijst.items || []).filter(i => !i.checked);
  const perId = new Map((lijst.items || []).map(i => [i.id, i]));
  const metDatum = open.filter(i => i.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (isVastePlanning(b) ? 1 : 0) - (isVastePlanning(a) ? 1 : 0));
  const zonder = open.filter(i => !i.dueDate);
  const inWeekend = metDatum.filter(i => isVrijeDag(i.dueDate) && !isVastePlanning(i));
  const markers = [
    ...draaidagenVan(p).map((d, n, alle) => ({ datum: d.datum, label: `🎬 Draaidag${alle.length > 1 ? ` ${n + 1}` : ""}`, kleur: C.groen, ...(n === 0 ? { anker: "draaidag" } : {}) })),
    ...(p.opleverdatum ? [{ datum: p.opleverdatum, label: "📦 Oplevering", kleur: "#2C6E8C", anker: "opleverdatum" }] : []),
  ];

  function snapshotNu() {
    return {
      ...Object.fromEntries((lijst.items || []).map(i => [i.id, { dueDate: i.dueDate || null, herinnering: i.herinnering || null, note: i.note || "", datumHandmatig: !!i.datumHandmatig, naId: i.naId || null, naDagen: i.naDagen ?? null }])),
      _project: { draaidag: p.draaidag || null, draaidagen: p.draaidagen || null, opleverdatum: p.opleverdatum || null, calls: p.calls || [] },
    };
  }
  function verzet(taak, datum, tijd) {
    if (!datum || (datum === taak.dueDate && (!tijd || tijd === momentTijd(taak)))) return;
    const snapshot = snapshotNu();
    const r = isVastMoment(taak) ? verzetMomentFn(taak.id, { datum, tijd }, modus === "keten") : schuif(taak.id, datum, modus);
    const n = r?.meegeschoven?.length || 0;
    setGeraakt([taak.id, ...(r?.meegeschoven || [])]);
    setLaatste({ snapshot, ids: Object.keys(snapshot), tekst: `"${taak.name}" → ${datumKort(datum).toLowerCase()}${tijd ? ` om ${tijd}` : ""}${r?.draaidag ? " (draaidag verzet)" : ""}${n ? ` · ${n} ${n === 1 ? "taak schoof" : "taken schoven"} mee` : ""}${r?.conflicten?.length ? ` · ⚠️ ${r.conflicten.length} vaste ${r.conflicten.length === 1 ? "taak komt" : "taken komen"} in de knel` : ""}` });
  }
  function koppelAan(taak, naId) {
    const snapshot = snapshotNu();
    const r = koppel(taak.id, naId);
    if (r?.fout) { setMelding(r.fout); return; }
    setMelding(null); setKoppelOpen(null);
    setLaatste({ snapshot, ids: Object.keys(snapshot), tekst: naId ? `"${taak.name}" wacht nu op "${perId.get(naId)?.name}"` : `"${taak.name}" is los` });
  }
  const stapKnop = { background: C.bg, border: `1px solid ${C.rand2}`, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, color: C.groen, flexShrink: 0 };
  const isVastMoment = (i) => isVastePlanning(i) && !i.vast;
  const afwConflicten = afwezigheidConflicten(lijst, afwezigheden);
  const afwVan = (id) => afwConflicten.filter(c => c.item.id === id).map(c => c.afwezigheid);
  // Relevante afwezigheden voor dit project (klant of ingeplande mensen) — voor de tijdbalk.
  const afwBanden = afwezigheden.filter(a => (a.klantId && a.klantId === p.klantId) || afwConflicten.some(c => c.afwezigheid.id === a.id));
  function verzetAnker(soort, datum) {
    if (!datum) return;
    const snapshot = snapshotNu();
    const voor = new Map((lijst.items || []).map(i => [i.id, i.dueDate]));
    const nieuw = verschuifAnker({ [soort]: datum });
    const ids = (nieuw?.items || []).filter(i => voor.get(i.id) !== i.dueDate).map(i => i.id);
    setGeraakt(ids);
    setLaatste({ snapshot, tekst: `${soort === "draaidag" ? "🎬 Draaidag" : "📦 Oplevering"} → ${datumKort(datum).toLowerCase()} · ${ids.length} ${ids.length === 1 ? "taak schoof" : "taken schoven"} mee` });
  }
  function bevestigPlan() {
    if (!planOpen?.datum) return;
    const snapshot = snapshotNu();
    const id = planCall(planOpen);
    setGeraakt(id ? [id] : []);
    setLaatste({ snapshot, tekst: `📞 ${planOpen.onderwerp || "Call"} ingepland op ${datumKort(planOpen.datum).toLowerCase()}${planOpen.tijd ? ` om ${planOpen.tijd}` : ""}` });
    setPlanOpen(null);
  }

  // Lijstweergave: weken + vaste momenten tussen de taken.
  const week = (d) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
  const regels = [];
  let vorigeWeek = null;
  [...metDatum.map(i => ({ soort: "taak", datum: i.dueDate, i })), ...markers.map(m => ({ soort: "marker", ...m }))]
    .sort((a, b) => a.datum.localeCompare(b.datum) || (a.soort === "marker" ? -1 : 1) - (b.soort === "marker" ? -1 : 1))
    .forEach(r => { const w = week(r.datum); if (w !== vorigeWeek) { regels.push({ soort: "week", w }); vorigeWeek = w; } regels.push(r); });

  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={{ ...S.sheet, maxWidth: weergave === "balk" ? 1180 : 720 }} onClick={e => e.stopPropagation()} data-testid="planning-sheet">
        <SheetKop titel="📅 Planning" sluit={sluit} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: -4 }}>
          <p style={{ ...S.hint, margin: 0, flex: 1, minWidth: 140 }}>{lijst.icon} {lijst.name}</p>
          <div role="tablist" aria-label="Weergave" style={{ display: "flex", gap: 4 }}>
            {[["lijst", "☰ Lijst"], ["balk", "▭ Tijdbalk"]].map(([k, l]) => <button key={k} role="tab" aria-selected={weergave === k} style={{ ...S.chip(weergave === k), padding: "5px 11px", fontSize: 13 }} onClick={() => setWeergave(k)}>{l}</button>)}
          </div>
        </div>

        <div style={{ background: C.bg, border: `1px solid ${C.rand2}`, borderRadius: 12, padding: "10px 12px", margin: "10px 0 8px" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }} role="radiogroup" aria-label="Meeschuiven">
            <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginRight: 2 }}>Meeschuiven:</span>
            {PLAN_MODI.map(([k, l]) => <button key={k} role="radio" aria-checked={modus === k} data-testid={`modus-${k}`} style={{ ...S.chip(modus === k), padding: "5px 11px", fontSize: 13 }} onClick={() => zetModus(k)}>{l}</button>)}
          </div>
          <p style={{ ...S.hint, margin: "6px 0 0" }}>{MODUS_UITLEG[modus]}</p>
          {modus === "keten" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: heeftKeten ? C.muted : C.oranje, flex: 1, minWidth: 160 }}>{heeftKeten ? "Tik bij een taak op ⛓ om in te stellen waar hij op wacht." : "Nog geen afhankelijkheden. Laat een voorstel maken op basis van de huidige volgorde:"}</span>
              <button onClick={() => { const snapshot = snapshotNu(); const r = stelVoor(heeftKeten); setLaatste({ snapshot, ids: Object.keys(snapshot), tekst: `${r?.gekoppeld || 0} taken gekoppeld op volgorde` }); }} style={{ ...S.chip(false), padding: "5px 11px", fontSize: 12, color: C.groen, fontWeight: 700 }}>
                {heeftKeten ? "↻ Opnieuw voorstellen" : "✨ Voorstel maken"}
              </button>
            </div>
          )}
        </div>
        {laatste && (
          <div data-testid="planning-melding" style={{ display: "flex", gap: 8, alignItems: "center", background: "#2D4A3E0D", borderRadius: 12, padding: "8px 12px", marginBottom: 8, fontSize: 13 }}>
            <span style={{ flex: 1, minWidth: 0 }}>✓ {laatste.tekst}</span>
            <button onClick={() => { herstel(laatste.snapshot); setGeraakt([]); setLaatste(null); }} style={{ ...S.chip(false), padding: "5px 10px", fontSize: 12 }}>↩︎ Ongedaan maken</button>
          </div>
        )}
        {melding && <p style={{ ...S.hint, color: C.rood, margin: "0 0 8px" }}>{melding}</p>}
        <AfwezigheidMelding conflicten={afwConflicten} klantVan={klantVan} compact />
        {inWeekend.length > 0 && (
          <div style={{ background: "#FFF4E5", border: "1px solid #F1D3A8", borderRadius: 12, padding: "10px 12px", margin: "0 0 8px", display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ flex: 1, fontSize: 13 }}>⚠️ {inWeekend.length} {inWeekend.length === 1 ? "deadline valt" : "deadlines vallen"} in het weekend of op een feestdag.</span>
            <button onClick={() => weekendWeg(inWeekend.map(i => i.id))} style={{ ...S.knop(), padding: "7px 12px", fontSize: 13 }}>Naar werkdagen</button>
          </div>
        )}

        {planOpen ? (
          <div data-testid="plan-call" style={{ background: C.bg, border: `1px solid ${C.rand2}`, borderRadius: 12, padding: 12, margin: "0 0 8px", display: "grid", gap: 8 }}>
            <b style={{ fontSize: 14 }}>📞 Call of afspraak inplannen</b>
            <input aria-label="Onderwerp" value={planOpen.onderwerp} onChange={e => setPlanOpen(v => ({ ...v, onderwerp: e.target.value }))} placeholder="Bijv. Review rough cut, Locatiebezoek, Call regisseur" style={S.inp} />
            <input aria-label="Met wie (gepland)" list="plan-met" value={planOpen.met} onChange={e => setPlanOpen(v => ({ ...v, met: e.target.value }))} placeholder="Met wie (optioneel)" style={S.inp} />
            <datalist id="plan-met">{metSuggesties.map(n => <option key={n} value={n} />)}</datalist>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="date" aria-label="Datum afspraak" value={planOpen.datum} onChange={e => setPlanOpen(v => ({ ...v, datum: e.target.value }))} style={{ ...S.inp, flex: 1, minWidth: 0 }} />
              <input type="time" aria-label="Tijd afspraak" value={planOpen.tijd} onChange={e => setPlanOpen(v => ({ ...v, tijd: e.target.value }))} style={{ ...S.inp, width: 110 }} />
            </div>
            {(() => {
              const weg = !planOpen.datum ? [] : planOpen.met?.trim() ? afwezigOpDatum(afwezigheden, planOpen.datum, { naam: planOpen.met }) : afwezigOpDatum(afwezigheden, planOpen.datum, { klantId: p.klantId || "__geen" });
              const uniek = [...new Map(weg.map(a => [a.id, a])).values()];
              return uniek.length ? <p style={{ ...S.hint, margin: 0, color: C.oranje, fontWeight: 700 }}>⚠️ {uniek.map(a => `${a.naam} is dan afwezig (${periodeKort(a).toLowerCase()})`).join(" · ")}</p> : null;
            })()}
            <p style={{ ...S.hint, margin: 0 }}>Komt als vast moment in de planning (met een melding een uur van tevoren) en bij 📞 Calls, waar je straks je notities maakt.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPlanOpen(null)} style={{ ...S.knop(C.bg, C.tekst), border: `1px solid ${C.rand2}`, flex: 1 }}>Annuleer</button>
              <button disabled={!planOpen.datum} onClick={bevestigPlan} style={{ ...S.knop(), flex: 2, opacity: planOpen.datum ? 1 : 0.5 }}>Inplannen</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setPlanOpen({ onderwerp: "", met: "", datum: plusWerkdagen(vandaag, 1), tijd: "10:00" })} style={{ ...S.rij, color: C.groen, fontWeight: 700, fontSize: 14, padding: "8px 4px", marginBottom: 4 }}>
            <Plus size={16} /> Call of afspraak inplannen
          </button>
        )}
        {openAfwezigheid && !planOpen && (
          <button onClick={openAfwezigheid} style={{ ...S.rij, color: C.muted, fontSize: 13, padding: "4px 4px 8px" }}>🏖️ Afwezigheid (vakanties) beheren{afwBanden.length ? ` · ${afwBanden.length} relevant` : ""}</button>
        )}

        {weergave === "balk" ? (
          <Tijdbalk lijst={lijst} taken={metDatum} markers={markers} vandaag={vandaag} geraakt={geraakt} verzet={verzet} isVastMoment={isVastMoment} banden={afwBanden} afwVan={afwVan} />
        ) : (
          <div style={S.kaart}>
            {regels.map((r, n) => {
              if (r.soort === "week") return <div key={`w${r.w}`} style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700, color: C.muted, background: C.bg, letterSpacing: 0.4 }}>WEEK VAN {datumKort(r.w).toUpperCase()}</div>;
              if (r.soort === "marker") return (
                <div key={`m${n}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, color: r.kleur, background: `${r.kleur}12`, borderBottom: "1px solid #F3EEE3" }}>
                  <span style={{ flex: 1 }}>{r.label} · {datumKort(r.datum)}</span>
                  {r.anker && (
                    <label style={{ position: "relative", fontSize: 12, fontWeight: 600, color: r.kleur, cursor: "pointer", border: `1px solid ${r.kleur}55`, borderRadius: 999, padding: "3px 10px", background: "#FFFFFF" }}>
                      ✏️ Verzetten
                      <input type="date" aria-label={`${r.label} verzetten`} value={r.datum} onChange={e => e.target.value && verzetAnker(r.anker, e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", cursor: "pointer" }} />
                    </label>
                  )}
                </div>
              );
              const i = r.i;
              const vast = isVastePlanning(i);
              const vastMoment = isVastMoment(i);
              const weekend = isVrijeDag(i.dueDate) && !vastMoment;
              const telaat = i.dueDate < vandaag;
              const voor = i.naId ? perId.get(i.naId) : null;
              const speling = spelingVan(lijst, i);
              return (
                <div key={i.id} data-testid="planning-regel" style={{ padding: "7px 10px", borderBottom: "1px solid #F3EEE3", background: geraakt.includes(i.id) ? "#FFF6D6" : "transparent", transition: "background .6s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button aria-label={`${i.name} een werkdag eerder`} style={stapKnop} onClick={() => verzet(i, plusWerkdagen(i.dueDate, -1))}><ChevronLeft size={16} /></button>
                    <label style={{ width: 82, flexShrink: 0, position: "relative", fontSize: 13, textAlign: "center", cursor: "pointer", color: telaat ? C.rood : weekend ? C.oranje : C.muted, fontWeight: i.datumHandmatig ? 700 : 400, borderBottom: `1px dashed ${C.rand2}` }}>
                      {datumKort(i.dueDate)}{weekend ? " ⚠️" : ""}
                      {vastMoment && momentTijd(i) && <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.groen }}>{momentTijd(i)}</span>}
                      {feestdagNaam(i.dueDate) && <span style={{ display: "block", fontSize: 10, color: C.oranje }}>{feestdagNaam(i.dueDate)}</span>}
                      <input type="date" aria-label={`Datum ${i.name}`} value={i.dueDate} onChange={e => e.target.value && verzet(i, e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", cursor: "pointer" }} />
                    </label>
                    <button aria-label={`${i.name} een werkdag later`} style={stapKnop} onClick={() => verzet(i, plusWerkdagen(i.dueDate, 1))}><ChevronRight size={16} /></button>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, marginLeft: 4 }}>{FASES.find(f => f.id === i.category)?.icon || ""} {i.name}</span>
                    {!vastMoment && (
                      <button aria-label={i.vast ? `${i.name} losmaken` : `${i.name} vastzetten`} title={i.vast ? "Vast — schuift niet mee" : "Vastzetten"} onClick={() => zetVast(i.id, !i.vast)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, fontSize: 14, opacity: i.vast ? 1 : 0.3 }}>📌</button>
                    )}
                  </div>
                  {afwVan(i.id).length > 0 && (
                    <div style={{ margin: "4px 0 0 72px", fontSize: 12, fontWeight: 700, color: C.oranje }}>
                      🏖️ {afwVan(i.id).map(a => `${a.naam} afwezig ${periodeKort(a).toLowerCase()}`).join(" · ")}
                    </div>
                  )}
                  {vastMoment && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 0 72px", flexWrap: "wrap", fontSize: 12 }}>
                      <span style={{ color: C.groen, fontWeight: 700 }}>📍 Vast moment</span>
                      {isDraaiMoment(i) ? (
                        <span style={{ color: C.muted }}>verzetten = de draaidag verzetten (planning schuift mee)</span>
                      ) : (
                        <>
                          <label style={{ display: "flex", alignItems: "center", gap: 4, color: C.muted }}>🕒
                            <input type="time" aria-label={`Tijd ${i.name}`} value={momentTijd(i) || ""} onChange={e => e.target.value && verzet(i, i.dueDate, e.target.value)} style={{ border: `1px solid ${C.rand2}`, borderRadius: 8, padding: "3px 6px", fontSize: 14, fontFamily: "inherit", background: C.kaart, color: C.tekst }} />
                          </label>
                          <button onClick={() => openMomentCall(i)} style={{ ...S.chip(!!callVoorMoment(lijst, i)), padding: "3px 10px", fontSize: 12 }}>
                            📞 {callVoorMoment(lijst, i)?.notities?.trim() ? "Call-notities" : "Notities maken"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {!vastMoment && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0 0 72px", flexWrap: "wrap" }}>
                      <button aria-label={`Afhankelijkheid ${i.name}`} onClick={() => setKoppelOpen(koppelOpen === i.id ? null : i.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, color: voor ? C.groen : C.licht, fontFamily: "inherit", textAlign: "left" }}>
                        ⛓ {voor ? <>na <b>{voor.name.length > 34 ? voor.name.slice(0, 33) + "…" : voor.name}</b>{i.naDagen ? ` +${i.naDagen} wd` : " (zelfde dag)"}</> : "wacht nergens op"}
                      </button>
                      <SpelingLabel n={speling} />
                    </div>
                  )}
                  {koppelOpen === i.id && (
                    <div data-testid="koppel-editor" style={{ margin: "8px 0 2px 34px", background: C.bg, borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
                      <label style={{ fontSize: 12, color: C.muted, display: "grid", gap: 4 }}>Wacht op
                        <select aria-label="Wacht op" value={i.naId || ""} onChange={e => koppelAan(i, e.target.value || null)} style={{ ...S.inp, padding: "8px 10px", fontSize: 15 }}>
                          <option value="">— niets (los) —</option>
                          {metDatum.filter(x => x.id !== i.id && !isVastMoment(x)).map(x => <option key={x.id} value={x.id}>{datumKort(x.dueDate)} · {x.name}</option>)}
                        </select>
                      </label>
                      {voor && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                          <span style={{ color: C.muted, flex: 1 }}>Werkdagen erna</span>
                          <button aria-label="Minder wachttijd" style={stapKnop} onClick={() => { const s = snapshotNu(); const r = wachtDagen(i.id, Math.max(0, (i.naDagen || 0) - 1)); setGeraakt([i.id, ...(r?.meegeschoven || [])]); setLaatste({ snapshot: s, ids: Object.keys(s), tekst: `Wachttijd "${i.name}" aangepast` }); }}>−</button>
                          <b style={{ minWidth: 20, textAlign: "center" }}>{i.naDagen || 0}</b>
                          <button aria-label="Meer wachttijd" style={stapKnop} onClick={() => { const s = snapshotNu(); const r = wachtDagen(i.id, (i.naDagen || 0) + 1); setGeraakt([i.id, ...(r?.meegeschoven || [])]); setLaatste({ snapshot: s, ids: Object.keys(s), tekst: `Wachttijd "${i.name}" aangepast` }); }}>+</button>
                        </div>
                      )}
                      {opvolgersVan(lijst, i.id).length > 0 && <span style={{ fontSize: 12, color: C.muted }}>Hierop wachten: {opvolgersVan(lijst, i.id).map(x => x.name).join(", ")}</span>}
                    </div>
                  )}
                </div>
              );
            })}
            {!metDatum.length && <p style={{ ...S.hint, padding: 12 }}>Nog geen taken met een datum.</p>}
          </div>
        )}
        {zonder.length > 0 && (
          <>
            <p style={S.label}>Zonder datum · {zonder.length}</p>
            <div style={S.kaart}>
              {zonder.map(i => (
                <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #F3EEE3" }}>
                  <label style={{ width: 96, flexShrink: 0, position: "relative", fontSize: 13, color: C.groen, cursor: "pointer" }}>
                    ＋ datum
                    <input type="date" aria-label={`Datum ${i.name}`} value="" onChange={e => e.target.value && schuif(i.id, e.target.value, "los")} style={{ position: "absolute", inset: 0, opacity: 0, width: "100%" }} />
                  </label>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{i.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <p style={{ ...S.hint, marginTop: 10 }}>{weergave === "balk" ? "Sleep een bolletje naar een andere dag. " : "‹ › = een werkdag eerder/later. "}Weekenden en feestdagen tellen niet mee. 📍 Vaste momenten (draaidag, kickoff, PPM, geplande calls) schuiven nooit vanzelf, maar je kunt ze wel zelf verzetten. 📌 zet een gewone taak vast.</p>
      </div>
    </div>
  );
}

// Tijdbalk: dagen horizontaal, taken als bolletjes die je sleept. Pijlen
// tonen waar een taak op wacht; draaidag/oplevering/vandaag als lijnen.
function Tijdbalk({ lijst, taken, markers, vandaag, geraakt, verzet, isVastMoment, banden = [], afwVan = () => [] }) {
  const [zoom, setZoom] = useState("week");
  const [sleep, setSleep] = useState(null); // { id, startX, dagen }
  const scrollRef = useRef(null);
  const dagB = zoom === "week" ? 34 : 14;
  const rijH = 34, kopH = 44, naamB = 210;
  const alle = [...taken.map(t => t.dueDate), ...markers.map(m => m.datum), vandaag].filter(Boolean).sort();
  const start = plusDagen(alle[0] || vandaag, -3);
  const eind = plusDagen(alle[alle.length - 1] || vandaag, 5);
  const aantal = Math.max(14, dagenTussen(start, eind) + 1);
  const dagen = Array.from({ length: aantal }, (_, n) => plusDagen(start, n));
  const x = (d) => dagenTussen(start, d) * dagB + dagB / 2;
  const rijen = [];
  for (const f of FASES) {
    const t = taken.filter(i => (i.category || "pre") === f.id);
    if (t.length) { rijen.push({ soort: "fase", f }); t.forEach(i => rijen.push({ soort: "taak", i })); }
  }
  const yVan = new Map();
  rijen.forEach((r, n) => { if (r.soort === "taak") yVan.set(r.i.id, kopH + n * rijH + rijH / 2); });
  const hoogte = kopH + rijen.length * rijH + 8;
  const breedte = aantal * dagB;
  useEffect(() => { // eerste keer: naar vandaag scrollen
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, x(vandaag) - 80);
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  function neer(e, i) {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setSleep({ id: i.id, startX: e.clientX, dagen: 0 });
  }
  function beweeg(e) { if (sleep) setSleep(s => ({ ...s, dagen: Math.round((e.clientX - s.startX) / dagB) })); }
  function los(i) {
    if (!sleep || sleep.id !== i.id) return;
    const n = sleep.dagen;
    setSleep(null);
    if (!n) return;
    let d = plusDagen(i.dueDate, n);
    if (isVrijeDag(d)) d = naarWerkdag(d, n > 0 ? 1 : -1);
    verzet(i, d);
  }
  const maandNaam = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("nl-NL", { month: "short" });

  return (
    <div data-testid="tijdbalk" style={{ border: `1px solid ${C.rand2}`, borderRadius: 14, overflow: "hidden", background: C.kaart }}>
      <div style={{ display: "flex", gap: 6, padding: "8px 10px", borderBottom: `1px solid ${C.rand2}`, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>Zoom</span>
        {[["week", "Week"], ["maand", "Maand"]].map(([k, l]) => <button key={k} style={{ ...S.chip(zoom === k), padding: "4px 10px", fontSize: 12 }} onClick={() => setZoom(k)}>{l}</button>)}
      </div>
      <div style={{ display: "flex" }}>
        <div style={{ width: naamB, flexShrink: 0, borderRight: `1px solid ${C.rand2}`, background: C.kaart }}>
          <div style={{ height: kopH, borderBottom: `1px solid ${C.rand2}` }} />
          {rijen.map((r, n) => r.soort === "fase"
            ? <div key={`f${n}`} style={{ height: rijH, display: "flex", alignItems: "center", padding: "0 10px", fontSize: 11, fontWeight: 700, color: C.muted, background: C.bg, letterSpacing: 0.4 }}>{r.f.icon} {r.f.label.toUpperCase()}</div>
            : <div key={r.i.id} title={r.i.name} style={{ height: rijH, display: "flex", alignItems: "center", gap: 6, padding: "0 10px", fontSize: 13, borderBottom: "1px solid #F6F2EA", background: geraakt.includes(r.i.id) ? "#FFF6D6" : "transparent" }}>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.i.vast ? "📌 " : ""}{r.i.name}</span>
                <SpelingLabel n={spelingVan(lijst, r.i)} />
              </div>)}
        </div>
        <div ref={scrollRef} style={{ overflowX: "auto", flex: 1, minWidth: 0 }}>
          <div style={{ position: "relative", width: breedte, height: hoogte, touchAction: sleep ? "none" : "pan-x pan-y" }} onPointerMove={beweeg}>
            {/* weekend-kolommen + kop */}
            {dagen.map((d, n) => (
              <div key={d} title={feestdagNaam(d) || undefined} style={{ position: "absolute", left: n * dagB, top: 0, width: dagB, height: hoogte, background: feestdagNaam(d) ? "#F7E6D8" : isWeekend(d) ? "#F3EEE3" : "transparent", borderLeft: new Date(`${d}T12:00:00`).getDay() === 1 ? `1px solid ${C.rand2}` : "none" }}>
                {(zoom === "week" || new Date(`${d}T12:00:00`).getDay() === 1) && (
                  <div style={{ position: "absolute", top: 20, left: 0, width: zoom === "week" ? dagB : dagB * 7, textAlign: zoom === "week" ? "center" : "left", paddingLeft: zoom === "week" ? 0 : 3, fontSize: 11, color: d === vandaag ? C.rood : C.muted, fontWeight: d === vandaag ? 700 : 400 }}>
                    {zoom === "week" ? new Date(`${d}T12:00:00`).getDate() : `${new Date(`${d}T12:00:00`).getDate()} ${maandNaam(d)}`}
                  </div>
                )}
                {(n === 0 || d.slice(8) === "01") && <div style={{ position: "absolute", top: 3, left: 3, fontSize: 11, fontWeight: 700, color: C.tekst, whiteSpace: "nowrap" }}>{new Date(`${d}T12:00:00`).toLocaleDateString("nl-NL", { month: "long", year: "numeric" })}</div>}
              </div>
            ))}
            <div style={{ position: "absolute", left: 0, right: 0, top: kopH - 1, height: 1, background: C.rand2 }} />
            {/* afwezigheid: oranje band over de periode */}
            {banden.filter(a => a.tot >= start && a.van <= eind).map((a, n) => {
              const v = a.van < start ? start : a.van, t = a.tot > eind ? eind : a.tot;
              return (
                <div key={`afw${a.id}`} title={`${a.naam} afwezig ${periodeKort(a)}`} style={{ position: "absolute", left: dagenTussen(start, v) * dagB, width: (dagenTussen(v, t) + 1) * dagB, top: kopH, height: hoogte - kopH, background: "repeating-linear-gradient(135deg, rgba(201,125,12,.10) 0 6px, rgba(201,125,12,.04) 6px 12px)", borderLeft: "2px solid rgba(201,125,12,.5)", pointerEvents: "none" }}>
                  <span style={{ position: "absolute", top: 18 + n * 16, left: 4, fontSize: 10, fontWeight: 700, color: C.oranje, whiteSpace: "nowrap", background: "#FFFFFFCC", borderRadius: 4, padding: "0 3px" }}>🏖️ {a.naam}</span>
                </div>
              );
            })}
            {/* vaste momenten + vandaag */}
            {[...markers, { datum: vandaag, label: "Vandaag", kleur: C.rood }].map((m, n) => (
              <div key={`mk${n}`} title={`${m.label} · ${datumKort(m.datum)}`} style={{ position: "absolute", left: x(m.datum) - 1, top: kopH, width: 2, height: hoogte - kopH, background: m.kleur, opacity: m.label === "Vandaag" ? 0.5 : 0.75 }}>
                <span style={{ position: "absolute", top: 2, left: 4, fontSize: 10, fontWeight: 700, color: m.kleur, whiteSpace: "nowrap", background: "#FFFFFFCC", borderRadius: 4, padding: "0 3px" }}>{m.label}</span>
              </div>
            ))}
            {/* pijlen: voorganger → taak */}
            <svg width={breedte} height={hoogte} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
              {taken.filter(i => i.naId && yVan.has(i.naId) && yVan.has(i.id)).map(i => {
                const v = taken.find(t => t.id === i.naId);
                const x1 = x(v.dueDate) + 7, y1 = yVan.get(v.id), x2 = x(i.dueDate) + (sleep?.id === i.id ? sleep.dagen * dagB : 0) - 8, y2 = yVan.get(i.id);
                const mid = Math.max(x1 + 6, Math.min(x2 - 6, x1 + 10));
                return <path key={i.id} d={`M${x1},${y1} H${mid} V${y2} H${x2}`} fill="none" stroke={C.groen} strokeOpacity="0.45" strokeWidth="1.5" markerEnd="url(#pijl)" />;
              })}
              <defs><marker id="pijl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={C.groen} fillOpacity="0.6" /></marker></defs>
            </svg>
            {/* bolletjes */}
            {taken.map(i => {
              if (!yVan.has(i.id)) return null;
              const vastMoment = isVastMoment(i);
              const vast = isVastePlanning(i);
              const dx = sleep?.id === i.id ? sleep.dagen * dagB : 0;
              const doel = sleep?.id === i.id && sleep.dagen ? plusDagen(i.dueDate, sleep.dagen) : null;
              const grootte = 16;
              return (
                <div key={i.id}>
                  <button aria-label={`${i.name} · ${datumKort(i.dueDate)}${vast ? " (vast moment)" : ""} — slepen om te verzetten`} data-testid="balk-taak" data-id={i.id}
                    onPointerDown={e => neer(e, i)} onPointerUp={() => los(i)} onPointerCancel={() => setSleep(null)}
                    style={{ position: "absolute", left: x(i.dueDate) - grootte / 2 + dx, top: yVan.get(i.id) - grootte / 2, width: grootte, height: grootte, padding: 0,
                      borderRadius: vastMoment ? 3 : 999, transform: vastMoment ? "rotate(45deg)" : "none",
                      background: vastMoment ? C.groen : i.dueDate < vandaag ? C.rood : geraakt.includes(i.id) ? "#E3A51C" : C.terra,
                      border: `2px solid ${afwVan(i.id).length ? C.oranje : i.vast ? C.tekst : "#FFFFFF"}`, outline: afwVan(i.id).length ? `2px solid ${C.oranje}55` : "none", boxShadow: "0 1px 3px rgba(0,0,0,.25)", cursor: sleep?.id === i.id ? "grabbing" : "grab", touchAction: "none", zIndex: sleep?.id === i.id ? 3 : 2 }} />
                  {doel && <span style={{ position: "absolute", left: x(i.dueDate) + dx + 12, top: yVan.get(i.id) - 22, fontSize: 11, fontWeight: 700, background: C.tekst, color: "#FAF6F0", borderRadius: 6, padding: "2px 6px", whiteSpace: "nowrap", zIndex: 4 }}>{datumKort(isVrijeDag(doel) ? naarWerkdag(doel, sleep.dagen > 0 ? 1 : -1) : doel)}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Weekenddeadline → werkdag: taken ná het anker (offset > 0, bv. post) naar
// de maandag, de rest naar de vrijdag ervoor — maar nooit vóór vandaag.
function werkdagVoorTaak(i, vandaag) {
  const richting = (Number(i.offset) || 0) > 0 ? 1 : -1;
  let d = naarWerkdag(i.dueDate, richting);
  if (d < vandaag) d = naarWerkdag(i.dueDate, 1);
  return d;
}

// Planningsoverzicht bij een nieuw project: tik op een datum om hem aan te
// passen, ✕ om een stap over te slaan. Weekenddagen zijn al vermeden.
function PlanningVoorbeeld({ voorbeeld, vandaag, verledenNaarVandaag, aanpassing, zet }) {
  const [alles, setAlles] = useState(false);
  const aantalAangepast = Object.keys(aanpassing).length;
  const zetStap = (id, v) => zet(a => { const n = { ...a }; if (v) n[id] = v; else delete n[id]; return n; });
  return (
    <div data-testid="planning-voorbeeld" style={{ background: C.bg, borderRadius: 12, padding: 10, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>📅 Planning — tik op een datum om hem te wijzigen. Za/zo worden overgeslagen.</span>
        {aantalAangepast > 0 && <button onClick={() => zet({})} style={{ ...S.chip(false), padding: "3px 9px", fontSize: 11 }}>↺ Herstel ({aantalAangepast})</button>}
      </div>
      <div style={{ maxHeight: alles ? "none" : 260, overflowY: alles ? "visible" : "auto" }}>
        {FASES.map(f => {
          const st = voorbeeld.filter(x => x.st.fase === f.id);
          if (!st.length) return null;
          return (
            <div key={f.id} style={{ marginBottom: 6 }}>
              <strong style={{ fontSize: 12 }}>{f.icon} {f.label}</strong>
              {st.map(({ st: s, d }) => {
                const a = aanpassing[s.id] || {};
                const weg = !!a.weg;
                const datum = a.datum || (verledenNaarVandaag && d && d < vandaag ? vandaag : d);
                const telaat = !a.datum && d && d < vandaag;
                const weekend = isVrijeDag(datum);
                return (
                  <div key={s.id} style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center", padding: "3px 0", color: weg ? C.licht : telaat ? C.rood : C.tekst }}>
                    <label style={{ width: 92, flexShrink: 0, position: "relative", cursor: weg ? "default" : "pointer", color: weg ? C.licht : a.datum ? C.groen : telaat ? C.rood : C.muted, fontWeight: a.datum ? 700 : 400, textDecoration: weg ? "line-through" : "none", borderBottom: weg ? "none" : `1px dashed ${C.rand2}` }}>
                      {datum ? datumKort(datum) : "—"}{weekend && !weg ? " ⚠️" : ""}
                      {!weg && <input type="date" aria-label={`Datum ${s.tekst}`} value={datum || ""} onChange={e => zetStap(s.id, e.target.value ? { datum: e.target.value } : null)}
                        style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", cursor: "pointer" }} />}
                    </label>
                    <span style={{ flex: 1, minWidth: 0, textDecoration: weg ? "line-through" : "none" }}>{SOORTEN[s.soort]?.icon} {s.tekst}</span>
                    <button aria-label={weg ? `${s.tekst} toch doen` : `${s.tekst} overslaan`} title={weg ? "Toch doen" : "Overslaan"} onClick={() => zetStap(s.id, weg ? null : { weg: true })}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: C.licht, fontSize: 13 }}>{weg ? "↺" : "✕"}</button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {voorbeeld.length > 10 && <button onClick={() => setAlles(!alles)} style={{ background: "none", border: "none", color: C.groen, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "4px 0 0", fontFamily: "inherit" }}>{alles ? "Kleiner" : `Hele planning tonen (${voorbeeld.length})`}</button>}
      <p style={{ ...S.hint, margin: "6px 0 0" }}>Later aanpassen kan ook: in het project per taak, of met 📅 Planning bovenin het project.</p>
    </div>
  );
}

function NieuwProjectSheet({ sjablonen, klanten, vandaag, startSjabloonId, nieuweKlant, sluit, maak, vanOfferte = null, voorstel = null, startOfferteNietDoorMij = false }) {
  const [offerteNietDoorMij, setOfferteNietDoorMij] = useState(startOfferteNietDoorMij);
  const [opdrachtVia, setOpdrachtVia] = useState("");
  const [sjabloonId, setSjabloonId] = useState(startSjabloonId || voorstel?.id || sjablonen[0]?.id);
  const sjabloon = sjablonen.find(t => t.id === sjabloonId) || sjablonen[0];
  const [naam, setNaam] = useState(vanOfferte?.name || "");
  const [klantId, setKlantId] = useState(vanOfferte?.project?.klantId || "");
  const [nieuweKlantNaam, setNieuweKlantNaam] = useState("");
  // Wat er in het eerste gesprek is herkend, wordt vooraf ingevuld.
  const [intakeTekst, setIntakeTekst] = useState(vanOfferte?.project?.intake?.tekst || "");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const h0 = useMemo(() => {
    const hi = leesIntake(vanOfferte?.project?.intake?.tekst || "", { vandaag, klanten });
    const spec = vanOfferte?.project?.offerte?.specificatie;
    if (!spec) return hi;
    // De offerte is concreter dan het eerste gesprek: aantal draaidagen,
    // deliverables, onderdelen en post komen daaruit; datums en prelight
    // uit het gesprek.
    const ho = herkenUitOfferte(spec, { vandaag, klanten });
    return {
      ...hi,
      draaidagen: ho.draaidagen || hi.draaidagen,
      deliverables: Object.keys(ho.deliverables || {}).length ? ho.deliverables : hi.deliverables,
      onderdelen: [...new Set([...(ho.onderdelen || []), ...(hi.onderdelen || [])])],
      postDoorOns: ho.postDoorOns ?? hi.postDoorOns,
      prelight: hi.prelight || ho.prelight,
      herkend: [...hi.herkend, ...ho.herkend],
    };
  }, []);
  const [draaidag, setDraaidag] = useState(h0.draaidag && h0.draaidag >= vandaag ? h0.draaidag : plusDagen(vandaag, 21));
  const [oplever, setOplever] = useState(h0.opleverdatum || null); // null = automatisch (draaidag + doorlooptijd)
  const [verledenNaarVandaag, setVerledenNaarVandaag] = useState(true);
  const [opzet, setOpzetState] = useState({ draaidagen: h0.draaidagen || 1, prelight: h0.prelight || "geen", postDoorOns: h0.postDoorOns !== false });
  const zonderPost = (ids, o) => (o.postDoorOns ? ids : ids.filter(id => !postOnderdeelIds().includes(id)));
  const [onderdelen, setOnderdelen] = useState(() => zonderPost([...new Set([...standaardOnderdelen(sjabloon), ...(h0.onderdelen || [])])], opzet));
  const setOpzet = (v) => { const n = { ...opzet, ...v }; setOpzetState(n); if (v.postDoorOns === false) setOnderdelen(o => zonderPost(o, n)); };
  const [deliverables, setDeliverables] = useState(() => normaliseerDeliverables(vanOfferte?.project?.deliverables || (Object.keys(h0.deliverables || {}).length ? h0.deliverables : null) || sjabloon?.laatsteDeliverables || {}));
  const hNu = leesIntake(intakeTekst, { vandaag, klanten });
  const hOpties = (hNu.draaidagOpties || hNu.opleverOpties) ? hNu : h0;
  function neemOver(h) {
    if (h.draaidag && h.draaidag >= vandaag) setDraaidag(h.draaidag);
    if (h.opleverdatum) setOplever(h.opleverdatum);
    if (h.klantId && !klantId) setKlantId(h.klantId);
    const n = { ...opzet, ...(h.draaidagen ? { draaidagen: h.draaidagen } : {}), ...(h.prelight ? { prelight: h.prelight } : {}), ...(h.postDoorOns != null ? { postDoorOns: h.postDoorOns } : {}) };
    setOpzetState(n);
    setOnderdelen(o => zonderPost([...new Set([...o, ...(h.onderdelen || [])])], n));
    if (Object.keys(h.deliverables || {}).length) setDeliverables(d => normaliseerDeliverables({ ...d, ...h.deliverables }));
  }
  const [eigenPlanning, setEigenPlanning] = useState([]);
  const [planAanpassing, setPlanAanpassing] = useState({}); // { stapId: { datum } | { weg: true } }
  const [meetings, setMeetings] = useState(() => standaardMeetings({ draaidag, vandaag }));
  const [ppmAangepast, setPpmAangepast] = useState(false);
  // PPM schuift mee met de draaidag zolang je 'm niet zelf hebt aangepast.
  useEffect(() => {
    if (!ppmAangepast) setMeetings(m => ({ ...m, ppm: { ...standaardMeetings({ draaidag, vandaag }).ppm, tijd: m.ppm?.tijd || "10:00" } }));
  }, [draaidag]);
  if (!sjabloon) {
    return (
      <div style={S.sheetAchter} onClick={sluit}><div style={S.sheet} onClick={e => e.stopPropagation()}>
        <SheetKop titel="Nieuw project" sluit={sluit} /><p>Er zijn nog geen sjablonen. Maak er eerst een bij Sjablonen beheren.</p>
      </div></div>
    );
  }
  const opleverdatum = oplever || (draaidag ? plusDagen(draaidag, sjabloon.standaardDoorlooptijd || 14) : "");
  const voorbeeld = draaidag ? sorteerStappen(sjabloon.stappen, sjabloon.standaardDoorlooptijd || 14).map(st => ({ st, d: stapDatum(st, { draaidag, opleverdatum }) })) : [];
  const teLaat = voorbeeld.filter(x => x.d < vandaag).length;
  // Meerdere offertes open? Dan eerst kiezen welke akkoord is.
  const versiesOpen = vanOfferte ? openVersies(vanOfferte.project) : [];
  const [versieId, setVersieId] = useState(versiesOpen.length === 1 ? versiesOpen[0].id : null);
  const kiesVersie = (v) => {
    setVersieId(v.id);
    if (v.specificatie) neemOver(herkenUitOfferte(v.specificatie, { vandaag, klanten }));
  };
  const kan = naam.trim() && draaidag && opleverdatum >= draaidag && (versiesOpen.length < 2 || versieId);
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <SheetKop titel={vanOfferte ? `🎉 Akkoord — "${vanOfferte.name}"` : "Nieuw project"} sluit={sluit} />
        <AkkoordVersieKeuze versies={versiesOpen} gekozen={versieId} kies={kiesVersie} />
        {vanOfferte && <p style={{ ...S.hint, marginTop: 0 }}>Kies het sjabloon en de data; de productietaken komen in dit project. Offerte- en akkoordstappen staan meteen op klaar.</p>}
        <p style={{ ...S.label, marginTop: 6 }}>Sjabloon</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {sjablonen.map(t => <button key={t.id} style={S.chip(t.id === sjabloon.id)} onClick={() => { setSjabloonId(t.id); setOplever(null); setOnderdelen(zonderPost([...new Set([...standaardOnderdelen(t), ...(h0.onderdelen || []), ...(hNu.onderdelen || [])])], opzet)); }}>{t.icoon} {t.naam}{voorstel?.reden && voorstel.id === t.id ? " ✨" : ""}</button>)}
        </div>
        {voorstel?.reden && <p style={S.hint}>✨ {sjablonen.find(t => t.id === voorstel.id)?.naam}: {voorstel.reden}.</p>}
        {sjabloon.omschrijving && <p style={S.hint}>{sjabloon.omschrijving} · {sjabloon.stappen.length} stappen{sjabloon.geleerdVan ? ` · geleerd van ${sjabloon.geleerdVan} ${sjabloon.geleerdVan === 1 ? "project" : "projecten"}` : ""}</p>}

        {!vanOfferte && <>
        <p style={S.label}>Projectnaam</p>
        <input style={S.inp} autoFocus placeholder="Bijv. Häcker keukencampagne" value={naam} onChange={e => setNaam(e.target.value)} />

        <p style={S.label}><Tag size={14} /> Klant</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button style={S.chip(!klantId)} onClick={() => setKlantId("")}>Geen</button>
          {klanten.map(k => <button key={k.id} style={{ ...S.chip(klantId === k.id), ...(klantId === k.id ? { background: k.kleur || C.groen, borderColor: k.kleur || C.groen } : {}) }} onClick={() => setKlantId(k.id)}>● {k.naam}</button>)}
        </div>
        <form onSubmit={e => { e.preventDefault(); if (nieuweKlantNaam.trim()) { setKlantId(nieuweKlant(nieuweKlantNaam)); setNieuweKlantNaam(""); } }} style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input style={{ ...S.inp, padding: "8px 12px", fontSize: 14 }} placeholder="+ Nieuwe klant" value={nieuweKlantNaam} onChange={e => setNieuweKlantNaam(e.target.value)} />
          {nieuweKlantNaam.trim() && <button type="submit" style={S.knop()}>Voeg toe</button>}
        </form>

        <p style={S.label}>📄 Offerte</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button aria-pressed={!offerteNietDoorMij} style={S.chip(!offerteNietDoorMij)} onClick={() => setOfferteNietDoorMij(false)}>📝 Doe ik zelf nog</button>
          <button aria-pressed={offerteNietDoorMij} style={S.chip(offerteNietDoorMij)} onClick={() => setOfferteNietDoorMij(true)}>⏭️ Niet door mij</button>
        </div>
        {offerteNietDoorMij && <>
          <p style={S.hint}>De offerte- en akkoordstappen uit het sjabloon staan meteen op klaar.</p>
          <input style={S.inp} aria-label="Opdracht via" placeholder="Opdracht via (optioneel) — bv. bureau of productiehuis" value={opdrachtVia} onChange={e => setOpdrachtVia(e.target.value)} />
        </>}
        </>}

        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ flex: 1 }}><span style={S.label}>🎬 (Eerste) draaidag</span>
            <input type="date" style={S.inp} value={draaidag} onChange={e => setDraaidag(e.target.value)} />
          </label>
          <label style={{ flex: 1 }}><span style={S.label}>📦 Oplevering</span>
            <input type="date" style={S.inp} value={opleverdatum} onChange={e => setOplever(e.target.value)} />
          </label>
        </div>
        {opleverdatum && draaidag && opleverdatum < draaidag && <p style={{ ...S.hint, color: C.rood }}>De oplevering ligt vóór de draaidag.</p>}
        {[["🎬 Draaidag", hOpties.draaidagOpties, draaidag, setDraaidag], ["📦 Oplevering", hOpties.opleverOpties, opleverdatum, setOplever]].map(([label, opties, huidig, zet]) => (opties || []).length > 1 && (
          <div key={label} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>{label} — opties uit het gesprek:</span>
            {opties.map(d => <button key={d} aria-pressed={huidig === d} onClick={() => zet(d)} style={{ ...S.chip(huidig === d), padding: "4px 10px", fontSize: 12 }}>{datumKortNl(d)}</button>)}
          </div>
        ))}
        {h0.herkend.length > 0 && <p style={{ ...S.hint, color: C.groen }}>✨ Ingevuld uit het eerste gesprek{vanOfferte?.project?.offerte?.specificatie ? " en de offerte" : ""} — controleer even of het klopt.</p>}

        {!vanOfferte?.project?.intake?.tekst && (
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setIntakeOpen(!intakeOpen)} style={{ ...S.chip(intakeOpen), padding: "6px 11px", fontSize: 13 }}>📞 Notities uit het eerste gesprek</button>
            {intakeOpen && (
              <>
                <textarea rows={4} value={intakeTekst} onChange={e => setIntakeTekst(e.target.value)} aria-label="Notities eerste gesprek"
                  placeholder="Typ of plak je gespreksnotities; de app vult de rest in." style={{ ...S.inp, fontSize: 14, marginTop: 6, resize: "vertical" }} />
                <HerkendChips h={hNu} />
                {hNu.herkend.length > 0 && <button onClick={() => neemOver(hNu)} style={{ ...S.knop(C.bg, C.groen), border: `1px solid ${C.rand2}`, marginTop: 8, padding: "7px 12px" }}>✨ Overnemen in dit project</button>}
              </>
            )}
          </div>
        )}

        <p style={{ ...S.sectieKop, marginTop: 18 }}>⚙️ Opzet</p>
        <OpzetKiezer opzet={opzet} zet={setOpzet} />

        {voorbeeld.length > 0 && (
          <PlanningVoorbeeld voorbeeld={voorbeeld} vandaag={vandaag} verledenNaarVandaag={verledenNaarVandaag}
            aanpassing={planAanpassing} zet={setPlanAanpassing} />
        )}
        <p style={{ ...S.sectieKop, marginTop: 18 }}>🧩 Wat is er nodig voor deze productie?</p>
        <p style={{ ...S.sectieKop, marginTop: 18 }}>📦 Deliverables</p>
        <DeliverablesKiezer waarde={deliverables} zet={setDeliverables} />
        <OnderdelenKiezer gekozen={onderdelen} setGekozen={setOnderdelen} meetings={meetings} zonderPost={!opzet.postDoorOns}
          eigenPlanning={eigenPlanning} setEigenPlanning={setEigenPlanning} suggesties={planningSuggesties(sjabloon, eigenPlanning)} draaidag={draaidag}
          setMeetings={(m) => { setMeetings(m); setPpmAangepast(true); }} />
        {teLaat > 0 && (
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 14 }}>
            <input type="checkbox" checked={verledenNaarVandaag} onChange={e => setVerledenNaarVandaag(e.target.checked)} />
            {teLaat} {teLaat === 1 ? "stap ligt" : "stappen liggen"} al in het verleden — op vandaag zetten
          </label>
        )}
        <button disabled={!kan} onClick={() => maak(sjabloon, {
          naam: naam.trim(), klantId: klantId || null, draaidag, opleverdatum, verledenNaarVandaag, onderdelen: zonderPost(onderdelen, opzet), meetings, deliverables, eigenPlanning, opzet, versieId, planAanpassing,
          ...(!vanOfferte && offerteNietDoorMij ? { offerteAlGedaan: true, opdrachtVia } : {}),
          ...(!vanOfferte?.project?.intake?.tekst && intakeTekst.trim() ? { intakeTekst: intakeTekst.trim(), budget: hNu.budget ?? null, liveDatum: hNu.liveDatum || null } : {}),
        })}
          style={{ ...S.knop(), width: "100%", marginTop: 16, opacity: kan ? 1 : 0.5 }}>
          🎬 {vanOfferte ? "Productie starten" : "Project starten"} ({sjabloon.stappen.length} taken)
        </button>
      </div>
    </div>
  );
}

function SjablonenSheet({ sjablonen, sluit, bewaar, startProject, meld }) {
  const [bewerkId, setBewerkId] = useState(null);
  const bewerk = sjablonen.find(t => t.id === bewerkId);
  if (bewerk) {
    return <SjabloonEditor sjabloon={bewerk} terug={() => setBewerkId(null)} sluit={sluit}
      bewaar={(nieuw) => { bewaar(sjablonen.map(t => (t.id === nieuw.id ? nieuw : t))); setBewerkId(null); meld("📐 Sjabloon bewaard"); }} />;
  }
  const ontbrekend = STANDAARD_SJABLONEN.filter(st => !sjablonen.some(t => t.id === st.id));
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <SheetKop titel="Projectsjablonen" sluit={sluit} />
        <p style={{ ...S.hint, marginTop: 0 }}>
          Vaste stappen voor terugkerende projecten, van pre-productie tot oplevering. Na elk project kun je de app laten leren:
          wat je toevoegde, weghaalde of op een ander moment deed, wordt (als jij dat wilt) in het sjabloon overgenomen.
        </p>
        {sjablonen.map(t => {
          const tellen = FASES.map(f => t.stappen.filter(s => s.fase === f.id).length);
          return (
            <div key={t.id} style={{ border: `1px solid ${C.rand}`, borderRadius: 14, padding: 12, marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22 }}>{t.icoon}</span>
                <strong style={{ flex: 1, fontSize: 15 }}>{t.naam}</strong>
              </div>
              <p style={{ ...S.hint, marginTop: 4 }}>
                {FASES.map((f, i) => `${f.icon} ${tellen[i]}`).join("  ")} · {t.gebruikt || 0}× gebruikt{t.geleerdVan ? ` · 🧠 geleerd van ${t.geleerdVan}` : ""}
              </p>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <button style={{ ...S.knop(), padding: "7px 12px" }} onClick={() => startProject(t.id)}>🎬 Nieuw project</button>
                <button style={{ ...S.chip(false) }} onClick={() => setBewerkId(t.id)}>Bewerken</button>
                <button style={{ ...S.chip(false) }} onClick={() => { const kopie = { ...t, id: uid(), naam: `${t.naam} (kopie)`, gebruikt: 0, geleerd: {}, geleerdVan: 0, stappen: t.stappen.map(s => ({ ...s, id: uid() })) }; bewaar([...sjablonen, kopie]); setBewerkId(kopie.id); }}>Dupliceren</button>
                <button style={{ ...S.chip(false), color: C.rood }} onClick={() => { if (window.confirm(`Sjabloon "${t.naam}" verwijderen? Lopende projecten blijven bestaan.`)) bewaar(sjablonen.filter(x => x.id !== t.id)); }}>Verwijderen</button>
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button style={S.knop(C.bg, C.groen)} onClick={() => {
            const nieuw = { id: uid(), naam: "Nieuw sjabloon", icoon: "📐", omschrijving: "", standaardDoorlooptijd: 14, stappen: [{ id: uid(), fase: "pre", soort: "taak", tekst: "Eerste stap", anker: "draai", offset: -7 }] };
            bewaar([...sjablonen, nieuw]); setBewerkId(nieuw.id);
          }}>+ Nieuw sjabloon</button>
          {ontbrekend.length > 0 && <button style={S.knop(C.bg, C.muted)} onClick={() => bewaar([...sjablonen, ...ontbrekend])}>Standaardsjablonen terugzetten</button>}
        </div>
      </div>
    </div>
  );
}

function SjabloonEditor({ sjabloon, terug, sluit, bewaar }) {
  const [t, setT] = useState(() => ({ ...sjabloon, stappen: sjabloon.stappen.map(s => ({ ...s })) }));
  const zetStap = (id, velden) => setT(x => ({ ...x, stappen: x.stappen.map(s => (s.id === id ? { ...s, ...velden } : s)) }));
  const verplaats = (id, richting) => setT(x => {
    const st = [...x.stappen];
    const i = st.findIndex(s => s.id === id);
    const j = i + richting;
    if (j < 0 || j >= st.length || st[j].fase !== st[i].fase) return x;
    [st[i], st[j]] = [st[j], st[i]];
    return { ...x, stappen: st };
  });
  function opslaan() {
    const stappen = t.stappen.map(s => normaliseerStap(s, uid));
    bewaar({ ...t, naam: t.naam.trim() || "Sjabloon", stappen: sorteerStappen(stappen, +t.standaardDoorlooptijd || 14), standaardDoorlooptijd: Math.max(0, Math.round(+t.standaardDoorlooptijd || 14)), bijgewerktOp: Date.now() });
  }
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <button onClick={terug} aria-label="Terug naar sjablonen" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}><ChevronLeft size={20} color={C.groen} /></button>
          <h2 style={{ margin: 0, flex: 1, fontSize: 18, color: C.groen }}>Sjabloon bewerken</h2>
          <button style={{ ...S.knop(), padding: "8px 14px" }} onClick={opslaan}>Bewaar</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...S.inp, width: 64, textAlign: "center", fontSize: 20, padding: 8 }} value={t.icoon} onChange={e => setT({ ...t, icoon: e.target.value.slice(0, 4) })} aria-label="Icoon" />
          <input style={S.inp} value={t.naam} onChange={e => setT({ ...t, naam: e.target.value })} aria-label="Naam sjabloon" />
        </div>
        <input style={{ ...S.inp, marginTop: 8, fontSize: 14 }} placeholder="Korte omschrijving (optioneel)" value={t.omschrijving || ""} onChange={e => setT({ ...t, omschrijving: e.target.value })} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 14 }}>
          Oplevering standaard
          <input type="number" min={0} max={365} style={{ ...S.inp, width: 74, padding: "6px 8px" }} value={t.standaardDoorlooptijd ?? 14} onChange={e => setT({ ...t, standaardDoorlooptijd: e.target.value })} />
          dagen na de draaidag
        </label>

        {FASES.map(f => (
          <div key={f.id}>
            <p style={{ ...S.sectieKop, marginTop: 18 }}>{f.icon} {f.label}</p>
            {t.stappen.filter(s => s.fase === f.id).map(s => {
              const hint = timingHint(sjabloon, s.id);
              return (
                <div key={s.id} style={{ border: `1px solid ${C.rand}`, borderRadius: 12, padding: 8, marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select value={s.soort} onChange={e => zetStap(s.id, { soort: e.target.value })} aria-label="Soort" style={{ ...S.inp, width: 52, padding: "6px 2px", fontSize: 16 }}>
                      {Object.entries(SOORTEN).map(([id, v]) => <option key={id} value={id}>{v.icon} {v.label}</option>)}
                    </select>
                    <input value={s.tekst} onChange={e => zetStap(s.id, { tekst: e.target.value })} aria-label="Stap" style={{ ...S.inp, padding: "6px 10px", fontSize: 14 }} />
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6, flexWrap: "wrap", fontSize: 13 }}>
                    <input type="number" value={Math.abs(+s.offset || 0)} min={0} max={365} onChange={e => zetStap(s.id, { offset: (+s.offset < 0 || (+s.offset === 0 && s.__voor) ? -1 : 1) * Math.abs(+e.target.value || 0) })} aria-label="Aantal dagen" style={{ ...S.inp, width: 62, padding: "5px 6px", fontSize: 13 }} />
                    <span>dagen</span>
                    <select value={+s.offset < 0 ? "voor" : "na"} onChange={e => zetStap(s.id, { offset: (e.target.value === "voor" ? -1 : 1) * Math.abs(+s.offset || 0) })} aria-label="Voor of na" style={{ ...S.inp, width: "auto", padding: "5px 6px", fontSize: 13 }}>
                      <option value="voor">vóór</option><option value="na">na / op</option>
                    </select>
                    <select value={s.anker} onChange={e => zetStap(s.id, { anker: e.target.value })} aria-label="Ten opzichte van" style={{ ...S.inp, width: "auto", padding: "5px 6px", fontSize: 13 }}>
                      <option value="draai">draaidag</option><option value="oplever">oplevering</option>
                    </select>
                    <span style={{ flex: 1 }} />
                    <button onClick={() => verplaats(s.id, -1)} aria-label="Omhoog" style={{ ...S.chip(false), padding: "3px 8px" }}>↑</button>
                    <button onClick={() => verplaats(s.id, 1)} aria-label="Omlaag" style={{ ...S.chip(false), padding: "3px 8px" }}>↓</button>
                    <button onClick={() => setT(x => ({ ...x, stappen: x.stappen.filter(y => y.id !== s.id) }))} aria-label="Stap verwijderen" style={{ ...S.chip(false), padding: "3px 8px", color: C.rood }}><Trash2 size={13} /></button>
                  </div>
                  {hint && hint.mediaan !== +s.offset && (
                    <p style={{ ...S.hint, marginTop: 4 }}>
                      🧠 {hint.aantal === 1 ? "Vorige keer deed je dit" : `De afgelopen ${hint.aantal} keer deed je dit meestal`} {offsetTekst({ offset: hint.mediaan, anker: s.anker })}.{" "}
                      <button onClick={() => zetStap(s.id, { offset: hint.mediaan })} style={{ background: "none", border: "none", color: C.groen, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 12, fontFamily: "inherit" }}>Neem over</button>
                    </p>
                  )}
                </div>
              );
            })}
            <button onClick={() => setT(x => ({ ...x, stappen: [...x.stappen, { id: uid(), fase: f.id, soort: "taak", tekst: "", anker: f.id === "post" ? "oplever" : "draai", offset: f.id === "pre" ? -7 : f.id === "post" ? -3 : 0 }] }))}
              style={{ ...S.chip(false), marginTop: 2 }}>+ Stap in {f.label.toLowerCase()}</button>
          </div>
        ))}
        <button style={{ ...S.knop(), width: "100%", marginTop: 18 }} onClick={opslaan}>Sjabloon bewaren</button>
      </div>
    </div>
  );
}

function LeerSheet({ lijst, sjabloon, sluit, toepassen, nacalculatie = null }) {
  const voorstellen = useMemo(() => (lijst && sjabloon ? berekenLeerVoorstellen(sjabloon, lijst) : []), [lijst, sjabloon]);
  const [gekozen, setGekozen] = useState(() => new Set(voorstellen.map(v => v.id)));
  const [afronden, setAfronden] = useState(!lijst?.project?.afgerond);
  if (!lijst) return null;
  const al = !!lijst.project.geleerdOp;
  const open = (lijst.items || []).filter(i => !i.checked).length;
  const beschrijf = (v) => {
    if (v.type === "toevoegen") return <>➕ <strong>{v.stap.tekst}</strong> toevoegen aan {FASES.find(f => f.id === v.stap.fase)?.label.toLowerCase()} <span style={{ color: C.muted }}>({SOORTEN[v.stap.soort]?.icon} {offsetTekst(v.stap)})</span></>;
    if (v.type === "verwijderen") return <>➖ <strong>{v.tekst}</strong> uit het sjabloon halen <span style={{ color: C.muted }}>(je haalde 'm in dit project weg)</span></>;
    if (v.type === "wijzigen") {
      const d = [];
      if (v.velden.tekst) d.push(<span key="t">naam → <strong>{v.velden.tekst}</strong></span>);
      if (v.velden.soort) d.push(<span key="s">soort → {SOORTEN[v.velden.soort].icon} {SOORTEN[v.velden.soort].label}</span>);
      if (v.velden.fase) d.push(<span key="f">fase → {FASES.find(f => f.id === v.velden.fase)?.label}</span>);
      return <>✏️ <strong>{v.oud.tekst}</strong>: {d.reduce((acc, x, i) => (i ? [...acc, ", ", x] : [x]), [])}</>;
    }
    return <>⏱ <strong>{v.tekst}</strong>: {offsetTekst({ offset: v.van, anker: v.anker })} → <strong>{offsetTekst({ offset: v.naar, anker: v.anker })}</strong> <span style={{ color: C.muted }}>(zo deed je het {v.aantalProjecten === 1 ? "dit project" : `in ${v.aantalProjecten} projecten`})</span></>;
  };
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <SheetKop titel={`Leren van "${lijst.name}"`} sluit={sluit} />
        {!sjabloon ? (
          <p style={{ fontSize: 14 }}>Het sjabloon van dit project bestaat niet meer, dus er valt niets bij te werken. Je kunt het project wel afronden.</p>
        ) : (
          <>
            <p style={{ ...S.hint, marginTop: 0 }}>
              Zo deed je dit project anders dan het sjabloon <strong>{sjabloon.naam}</strong>. Vink aan wat je volgende keer standaard wilt.
              {!al && " Wanneer je de stappen afrondde, wordt hoe dan ook onthouden: daarmee worden de deadlines steeds beter."}
            </p>
            {al && <p style={{ ...S.hint, color: C.oranje }}>Je hebt dit project al eens gebruikt om te leren; de timing telt daarom niet nog een keer mee.</p>}
            {voorstellen.length === 0 ? (
              <p style={{ fontSize: 14, background: C.bg, borderRadius: 12, padding: 12 }}>✅ Je volgde het sjabloon precies — er zijn geen aanpassingen voor te stellen.</p>
            ) : (
              <div style={{ marginTop: 8 }}>
                {voorstellen.map(v => (
                  <label key={v.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0", borderBottom: `1px solid ${C.rand}`, fontSize: 14, lineHeight: 1.4 }}>
                    <input type="checkbox" style={{ marginTop: 3 }} checked={gekozen.has(v.id)} onChange={e => { const n = new Set(gekozen); e.target.checked ? n.add(v.id) : n.delete(v.id); setGekozen(n); }} />
                    <span>{beschrijf(v)}</span>
                  </label>
                ))}
              </div>
            )}
          </>
        )}
        {nacalculatie && <NacalculatieBlok n={nacalculatie} />}
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, fontSize: 14 }}>
          <input type="checkbox" checked={afronden} onChange={e => setAfronden(e.target.checked)} />
          Project afronden (naar "Afgeronde projecten"){open ? ` — er staan nog ${open} open taken` : ""}
        </label>
        <button style={{ ...S.knop(), width: "100%", marginTop: 14 }} onClick={() => toepassen(voorstellen, [...gekozen].filter(id => voorstellen.some(v => v.id === id)), afronden)}>
          {sjabloon && gekozen.size ? `🧠 ${gekozen.size} ${gekozen.size === 1 ? "aanpassing" : "aanpassingen"} overnemen` : afronden ? "Afronden" : "Klaar"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ONDERDELEN-KIEZER — per groep chips die je met één tik aan/uit zet.
// Kickoff en PPM krijgen een datum en tijd zodra ze aan staan.
// ════════════════════════════════════════════════════════════════════
function OnderdelenKiezer({ gekozen, setGekozen, meetings, setMeetings, eigenPlanning = null, setEigenPlanning, suggesties = [], draaidag, zonderPost = false }) {
  const aan = new Set(gekozen);
  const zet = (id) => { const n = new Set(aan); n.has(id) ? n.delete(id) : n.add(id); setGekozen([...n]); };
  return (
    <div>
      {ONDERDELEN.filter(g => !(zonderPost && g.fase === "post")).map(g => {
        const ids = g.items.map(i => i.id);
        const allesAan = ids.every(id => aan.has(id));
        return (
          <div key={g.groep} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{g.icon} {g.groep}</span>
              {g.crew && (
                <button onClick={() => { const n = new Set(aan); ids.forEach(id => (allesAan ? n.delete(id) : n.add(id))); setGekozen([...n]); }}
                  style={{ background: "none", border: "none", color: C.groen, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                  {allesAan ? "Alles uit" : "Alles aan"}
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {g.items.map(o => (
                <button key={o.id} onClick={() => zet(o.id)} aria-pressed={aan.has(o.id)} style={{ ...S.chip(aan.has(o.id)), padding: "6px 11px", fontSize: 13 }}>
                  {aan.has(o.id) ? "✓ " : ""}{o.label}
                </button>
              ))}
            </div>
            {g.items.filter(o => o.meeting && aan.has(o.id)).map(o => (
              <div key={o.id} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 13, width: 72, flexShrink: 0 }}>{o.id === "ppm" ? "PPM" : "Kickoff"}</span>
                <input type="date" value={meetings?.[o.id]?.datum || ""} aria-label={`Datum ${o.label}`}
                  onChange={e => setMeetings({ ...meetings, [o.id]: { ...(meetings?.[o.id] || {}), datum: e.target.value || null } })}
                  style={{ ...S.inp, padding: "6px 8px", fontSize: 14 }} />
                <input type="time" value={meetings?.[o.id]?.tijd || "10:00"} aria-label={`Tijd ${o.label}`}
                  onChange={e => setMeetings({ ...meetings, [o.id]: { ...(meetings?.[o.id] || {}), tijd: e.target.value || "10:00" } })}
                  style={{ ...S.inp, padding: "6px 8px", fontSize: 14, width: 104 }} />
              </div>
            ))}
            {g.groep === "Planning" && eigenPlanning && (
              <EigenPlanning lijst={eigenPlanning} zet={setEigenPlanning} suggesties={suggesties} draaidag={draaidag} />
            )}
          </div>
        );
      })}
      <p style={S.hint}>Wat aan staat wordt een taak met deelstappen (crew: één taak met een stap per rol). Je kunt dit later in het project nog aan- en uitzetten.</p>
    </div>
  );
}

function OnderdelenSheet({ lijst, sjabloon, vandaag, sluit, toepassen }) {
  const p = lijst.project;
  const [gekozen, setGekozen] = useState(() => p.onderdelen || standaardOnderdelen(sjabloon));
  const uitTaken = useMemo(() => leesPlanningUitTaken(lijst), []);
  const [meetings, setMeetings] = useState(() => standaardMeetings({ draaidag: p.draaidag, vandaag, bestaand: { ...(p.meetings || {}), ...uitTaken.meetings } }));
  const [deliverables, setDeliverables] = useState(() => normaliseerDeliverables(p.deliverables || {}));
  const [eigenPlanning, setEigenPlanning] = useState(() => uitTaken.eigenPlanning);
  const weg = telVerdwijnendeTaken(lijst, gekozen);
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <SheetKop titel="Onderdelen aan/uit" sluit={sluit} />
        <p style={{ ...S.hint, marginTop: 0, marginBottom: 12 }}>Zet aan wat deze productie nodig heeft. Uitzetten haalt alleen taken weg die nog open staan; wat al gedaan is blijft staan.</p>
        <p style={{ ...S.sectieKop, marginTop: 4 }}>📦 Deliverables</p>
        <DeliverablesKiezer waarde={deliverables} zet={setDeliverables} />
        <p style={{ ...S.sectieKop, marginTop: 14 }}>🧩 Onderdelen</p>
        <OnderdelenKiezer {...{ gekozen, setGekozen, meetings, setMeetings, eigenPlanning, setEigenPlanning }} suggesties={planningSuggesties(sjabloon, eigenPlanning)} draaidag={p.draaidag} />
        {weg > 0 && <p style={{ ...S.hint, color: C.oranje }}>⚠️ {weg} open {weg === 1 ? "taak verdwijnt" : "taken verdwijnen"} uit het project.</p>}
        <button style={{ ...S.knop(), width: "100%", marginTop: 12 }} onClick={() => toepassen(gekozen, meetings, deliverables, eigenPlanning)}>Toepassen</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// BEZETTING — namen per onderdeel/crew-rol met status en prijsafspraak.
// ════════════════════════════════════════════════════════════════════
function BezettingEditor({ taak, wijzigLaatste, contacten, onthoud, project = {} }) {
  const bezetting = taak.bezetting || [];
  const secties = taak.onderdeelId === "crew"
    ? (taak.substappen || []).filter(s => s.rolId).map(s => ({ id: s.rolId, label: s.tekst }))
    : [{ id: taak.onderdeelId, label: onderdeelVan(taak.onderdeelId)?.label || "Namen" }];
  // Altijd op de LAATSTE versie van de taak werken (niet op een kopie van
  // het moment van tekenen): snelle opeenvolgende wijzigingen — naam, prijs,
  // status — mogen elkaar niet overschrijven.
  const pasAan = (fn) => wijzigLaatste(i => synchroniseerCrewStappen({ ...i, bezetting: fn(i.bezetting || []) }));
  const wijzig = (id, velden) => pasAan(lijst => lijst.map(b => (b.id === id ? { ...b, ...velden } : b)));
  const isLocatie = /^loc-/.test(taak.onderdeelId || "");
  return (
    <div style={{ marginTop: 14 }}>
      <p style={{ ...S.label, marginTop: 0 }}>👥 {taak.onderdeelId === "crew" ? "Crew — namen per rol" : isLocatie ? "Locaties" : "Namen"}</p>
      {secties.map(sec => {
        const regels = bezetting.filter(b => b.onderdeelId === sec.id);
        const ok = regels.filter(b => b.naam && b.status === "bevestigd").length;
        return (
          <div key={sec.id} style={{ background: C.bg, borderRadius: 12, padding: 10, marginBottom: 8 }}>
            {taak.onderdeelId === "crew" && (
              <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700 }}>
                {sec.label} {regels.length > 0 && <span style={{ fontWeight: 400, color: ok === regels.length ? C.groen : C.muted }}>· {ok}/{regels.length} bevestigd</span>}
              </p>
            )}
            {regels.map(b => (
              <BezettingRegel key={b.id} b={b} contacten={contacten} opleverdatum={buyoutStart(project)} aantalDagen={draaidagenVan(project).length || 1} wijzig={(v) => wijzig(b.id, v)} verwijder={() => pasAan(lijst => lijst.filter(x => x.id !== b.id))}
                onthoud={(volledig) => { const contactId = onthoud(volledig); if (contactId && contactId !== b.contactId) wijzig(b.id, { contactId }); }} />
            ))}
            <button onClick={() => pasAan(lijst => [...lijst, nieuweBezetting({ onderdeelId: sec.id, buyouts: standaardBuyouts(project.deliverables, sec.id), eenheid: isLocatie || sec.id === "hotel" || sec.id === "verzekering" || sec.id === "catering" ? "totaal" : "dag" }, uid)])}
              style={{ ...S.chip(false), padding: "5px 10px", fontSize: 13, marginTop: regels.length ? 6 : 0 }}>
              + {regels.length ? "Nog iemand" : isLocatie ? "Locatie toevoegen" : "Naam toevoegen"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function BezettingRegel({ b, contacten, wijzig, verwijder, onthoud, opleverdatum, aantalDagen = 1 }) {
  const [naam, setNaam] = useState(b.naam || "");
  const [bedrag, setBedrag] = useState(b.bedrag != null ? String(b.bedrag).replace(".", ",") : "");
  const [notitie, setNotitie] = useState(b.notitie || "");
  const [telefoon, setTelefoon] = useState(b.telefoon || "");
  const [adres, setAdres] = useState(b.adres || "");
  const [aantal, setAantal] = useState(b.aantal != null ? String(b.aantal).replace(".", ",") : "");
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    setNaam(b.naam || ""); setBedrag(b.bedrag != null ? String(b.bedrag).replace(".", ",") : ""); setNotitie(b.notitie || "");
    setTelefoon(b.telefoon || ""); setAdres(b.adres || ""); setAantal(b.aantal != null ? String(b.aantal).replace(".", ",") : "");
  }, [b.id]);
  const isPlek = /^loc-/.test(b.onderdeelId || "") || b.onderdeelId === "hotel";
  const isPersoon = /^crew-/.test(b.onderdeelId || "") || ["acteurs", "edelfiguranten", "figuranten"].includes(b.onderdeelId);
  // Actuele invoer (ook binnen een vertraagde blur-afhandeling).
  const nu = useRef({});
  const aantalGetal = aantal.trim() === "" ? null : (Number(aantal.replace(",", ".")) || null);
  nu.current = { naam: naam.trim(), bedrag: leesBedragInvoer(bedrag), notitie: notitie.trim(), telefoon: telefoon.trim(), adres: adres.trim(), aantal: aantalGetal, eenheid: b.eenheid, status: b.status };
  const suggesties = contactSuggesties(contacten, b.onderdeelId, naam).filter(c => c.naam !== naam).slice(0, 5);
  const bekend = contacten.find(c => c.naam.trim().toLowerCase() === naam.trim().toLowerCase());
  const vorige = bekend?.prijzen?.[b.onderdeelId];

  function kies(c) {
    const p = c.prijzen?.[b.onderdeelId];
    const velden = {
      naam: c.naam, contactId: c.id, notitie: notitie || c.notitie || "",
      ...(!telefoon && c.telefoon ? { telefoon: c.telefoon } : {}),
      ...(!adres && c.adres ? { adres: c.adres } : {}),
      ...(b.bedrag == null && p?.bedrag != null ? { bedrag: p.bedrag, eenheid: p.eenheid } : {}),
      // Eerdere buy-outafspraak overnemen als er nog niets is ingevuld.
      ...(p?.buyouts && !(b.buyouts || []).some(x => x.duur || x.bedrag != null) ? { buyouts: p.buyouts } : {}),
    };
    setNaam(c.naam); if (velden.bedrag != null) setBedrag(String(velden.bedrag).replace(".", ",")); setNotitie(velden.notitie);
    if (velden.telefoon) setTelefoon(velden.telefoon);
    if (velden.adres) setAdres(velden.adres);
    setFocus(false);
    wijzig(velden);
    onthoud({ ...b, ...velden });
  }
  // Alleen het veld dat je net verliet opslaan — nooit de andere velden met
  // een oude waarde overschrijven.
  function bewaarVeld(veld) {
    const waarde = nu.current[veld];
    if (waarde === (veld === "bedrag" || veld === "aantal" ? (b[veld] ?? null) : (b[veld] || ""))) return;
    wijzig({ [veld]: waarde });
    if (nu.current.naam) onthoud({ ...b, ...nu.current });
  }
  return (
    <div style={{ background: C.kaart, border: `1px solid ${C.rand}`, borderRadius: 10, padding: 8, marginBottom: 6 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", position: "relative" }}>
        <input value={naam} placeholder={b.offerte ? `Naam — ${b.offerte.label}` : "Naam (persoon, bedrijf of locatie)"} aria-label="Naam"
          onChange={e => setNaam(e.target.value)} onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => { setFocus(false); bewaarVeld("naam"); }, 150)}
          style={{ ...S.inp, padding: "7px 10px", fontSize: 14 }} />
        <button onClick={verwijder} aria-label="Naam verwijderen" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={15} color={C.licht} /></button>
        {focus && suggesties.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 30, background: C.kaart, border: `1px solid ${C.rand2}`, borderRadius: 10, boxShadow: "0 8px 20px rgba(0,0,0,.12)", zIndex: 5, marginTop: 2, overflow: "hidden" }}>
            {suggesties.map(c => (
              <button key={c.id} onMouseDown={e => e.preventDefault()} onClick={() => kies(c)}
                style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: `1px solid ${C.rand}`, padding: "8px 10px", cursor: "pointer", fontFamily: "inherit", color: C.tekst }}>
                <span style={{ fontSize: 14 }}>{c.naam}</span>
                <span style={{ display: "block", fontSize: 11, color: C.muted }}>
                  {c.zelfdeRol ? "eerder in deze rol" : "eerder ingezet"} · {(c.projecten || []).length} {(c.projecten || []).length === 1 ? "project" : "projecten"}
                  {c.laatstePrijs ? ` · ${prijsTekst(c.laatstePrijs.bedrag, c.laatstePrijs.eenheid)}` : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
        {BEZETTING_STATUS.map(st => (
          <button key={st.id} onClick={() => { wijzig({ status: st.id }); if (nu.current.naam) onthoud({ ...b, ...nu.current, status: st.id }); }}
            style={{ ...S.chip(b.status === st.id), padding: "4px 9px", fontSize: 12, ...(b.status === st.id && st.id === "bevestigd" ? { background: C.groen } : b.status === st.id ? { background: C.oranje, borderColor: C.oranje } : {}) }}>
            {st.id === "bevestigd" && b.status === st.id ? "✓ " : ""}{st.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input value={bedrag} inputMode="decimal" placeholder="€ prijs" aria-label="Prijsafspraak" onChange={e => setBedrag(e.target.value)} onBlur={() => bewaarVeld("bedrag")}
          style={{ ...S.inp, padding: "6px 8px", fontSize: 14, width: 96 }} />
        <select value={b.eenheid || "dag"} onChange={e => { wijzig({ eenheid: e.target.value }); if (nu.current.naam) onthoud({ ...b, ...nu.current, eenheid: e.target.value }); }} aria-label="Eenheid"
          style={{ ...S.inp, padding: "6px 6px", fontSize: 13, width: "auto" }}>
          {EENHEDEN.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
        {b.eenheid !== "totaal" && (
          <input value={aantal} inputMode="decimal" placeholder={`× ${b.eenheid === "dag" || !b.eenheid ? aantalDagen : 1}`} aria-label="Aantal" title="Aantal dagen / uren / stuks"
            onChange={e => setAantal(e.target.value)} onBlur={() => bewaarVeld("aantal")}
            style={{ ...S.inp, padding: "6px 6px", fontSize: 13, width: 48, textAlign: "center" }} />
        )}
      </div>
      {isPlek && (
        <input value={adres} placeholder="Adres (voor de callsheet + route)" aria-label="Adres" onChange={e => setAdres(e.target.value)} onBlur={() => bewaarVeld("adres")}
          style={{ ...S.inp, padding: "6px 8px", fontSize: 13, marginTop: 6 }} />
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        {(isPersoon || isPlek) && (
          <input value={telefoon} type="tel" placeholder="Telefoon" aria-label="Telefoon" onChange={e => setTelefoon(e.target.value)} onBlur={() => bewaarVeld("telefoon")}
            style={{ ...S.inp, padding: "6px 8px", fontSize: 13, width: 140, flexShrink: 0 }} />
        )}
        <input value={notitie} placeholder="E-mail, afspraak…" aria-label="Notitie" onChange={e => setNotitie(e.target.value)} onBlur={() => bewaarVeld("notitie")}
          style={{ ...S.inp, padding: "6px 8px", fontSize: 13 }} />
      </div>
      {b.offerte && <OffertePlekHint b={b} aantalDagen={aantalDagen} />}
      {buyoutSoort(b.onderdeelId) && (
        <BuyoutEditor b={b} opleverdatum={opleverdatum} wijzig={(buyouts) => { wijzig({ buyouts }); if (nu.current.naam) onthoud({ ...b, ...nu.current, buyouts }); }} />
      )}
      {vorige && b.bedrag == null && (
        <p style={{ ...S.hint, marginTop: 4 }}>
          Vorige keer: {prijsTekst(vorige.bedrag, vorige.eenheid)}{vorige.project ? ` (${vorige.project})` : ""}.{" "}
          <button onClick={() => { setBedrag(String(vorige.bedrag).replace(".", ",")); wijzig({ bedrag: vorige.bedrag, eenheid: vorige.eenheid }); }}
            style={{ background: "none", border: "none", color: C.groen, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 12, fontFamily: "inherit" }}>Overnemen</button>
        </p>
      )}
      {vorige && b.bedrag != null && (vorige.bedrag !== b.bedrag || vorige.eenheid !== b.eenheid) && vorige.project && (
        <p style={{ ...S.hint, marginTop: 4 }}>Vorige afspraak: {prijsTekst(vorige.bedrag, vorige.eenheid)} ({vorige.project})</p>
      )}
    </div>
  );
}

// Wat er in de offerte voor deze plek begroot is, en hoe de afspraak zich
// daartoe verhoudt (marge volgens je marge-doel).
function OffertePlekHint({ b, aantalDagen }) {
  const md = useContext(MargeContext);
  const kosten = b.bedrag != null ? bezettingKosten(b, aantalDagen).totaal : null;
  const pct = kosten != null && b.offerte.begroot ? Math.round((1000 * (b.offerte.begroot - kosten)) / b.offerte.begroot) / 10 : null;
  const st = margeStatus(pct, md);
  if (b.offerte.vervallen) {
    return <p style={{ ...S.hint, marginTop: 6, color: C.rood, fontWeight: 700 }}>⚠️ Staat niet meer in de geldende offerte (was {euro(b.offerte.begroot)}). Nog nodig? Anders afzeggen en verwijderen.</p>;
  }
  return (
    <p style={{ ...S.hint, marginTop: 6 }}>
      {b.offerte.vorigBegroot != null && <span style={{ color: C.oranje, fontWeight: 700 }}>↻ Budget aangepast in de nieuwe offerte: {euro(b.offerte.vorigBegroot)} → {euro(b.offerte.begroot)}. </span>}
      📄 Offerte: {b.offerte.tekst} = <strong>{euro(b.offerte.begroot)}</strong>
      {kosten != null && <span style={{ color: MARGE_KLEUR[st] || C.muted, fontWeight: 700 }}> · afspraak {euro(kosten)} → {pct < 0 ? `${euro(kosten - b.offerte.begroot)} boven de offerte` : `marge ${String(pct).replace(".", ",")}%`}</span>}
      {kosten == null && <span> · max. {euro(b.offerte.begroot * (1 - md.minimum / 100))} voor {md.minimum}% marge</span>}
    </p>
  );
}

function BezettingOverzicht({ lijst }) {
  const regels = (lijst.items || []).flatMap(i => (i.bezetting || []).filter(b => b.naam || b.offerte).map(b => ({ ...b, taak: i.name })));
  const groepNaam = (b) => (b.onderdeelId?.startsWith("crew-") ? `Crew · ${onderdeelVan(b.onderdeelId)?.label || ""}` : onderdeelVan(b.onderdeelId)?.label || b.taak);
  return (
    <div style={{ marginTop: 8, background: C.bg, borderRadius: 12, padding: 10 }}>
      {regels.map(b => (
        <div key={b.id} style={{ display: "flex", gap: 8, fontSize: 13, padding: "4px 0", borderBottom: `1px solid ${C.rand}` }}>
          <span style={{ width: 12 }}>{!b.naam ? "·" : b.status === "bevestigd" ? "✅" : b.status === "aangevraagd" ? "⏳" : "○"}</span>
          <span style={{ flex: 1, minWidth: 0 }}>{b.naam ? <strong>{b.naam}</strong> : <span style={{ color: C.oranje, fontWeight: 700 }}>{b.offerte?.label} — nog regelen</span>} <span style={{ color: C.muted }}>· {groepNaam(b)}</span>{b.offerte && <span style={{ display: "block", fontSize: 11, color: C.muted }}>offerte: {euro(b.offerte.begroot)}</span>}</span>
          <span style={{ color: C.muted, whiteSpace: "nowrap", textAlign: "right" }}>
            {prijsTekst(b.bedrag, b.eenheid)}
            {(b.buyouts || []).filter(x => x.duur || x.bedrag != null).map((x, i) => (
              <span key={i} style={{ display: "block", fontSize: 11 }}>
                buy-out {[...BUYOUT_MEDIA.cast, ...BUYOUT_MEDIA.fotografie].find(m => m.id === x.medium)?.label} {BUYOUT_DUUR.find(d => d.id === x.duur)?.label || ""}{x.bedrag != null ? ` · € ${Number(x.bedrag).toLocaleString("nl-NL")}` : ""}
              </span>
            ))}
          </span>
        </div>
      ))}
      <p style={{ ...S.hint, marginTop: 6 }}>Tik op een taak om namen, status of prijzen te wijzigen.</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// DELIVERABLES-KIEZER — kanaal × formaat aanklikken, plus fotografie.
// ════════════════════════════════════════════════════════════════════
function DeliverablesKiezer({ waarde, zet }) {
  const d = normaliseerDeliverables(waarde || {});
  const zetKanaal = (id) => {
    const n = { ...d };
    if (n[id]) delete n[id]; else n[id] = [...STANDAARD_FORMATEN[id]];
    zet(normaliseerDeliverables(n));
  };
  const zetFormaat = (id, f) => {
    const huidig = d[id] || [];
    zet(normaliseerDeliverables({ ...d, [id]: huidig.includes(f) ? huidig.filter(x => x !== f) : [...huidig, f] }));
  };
  return (
    <div style={{ background: C.bg, borderRadius: 12, padding: 10, marginBottom: 12 }}>
      {DELIVERABLE_KANALEN.map(k => (
        <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <button onClick={() => zetKanaal(k.id)} aria-pressed={!!d[k.id]} style={{ ...S.chip(!!d[k.id]), padding: "6px 10px", fontSize: 13, minWidth: 96 }}>
            {d[k.id] ? "✓ " : ""}{k.label}
          </button>
          {d[k.id] && FORMATEN.map(f => (
            <button key={f} onClick={() => zetFormaat(k.id, f)} aria-pressed={d[k.id].includes(f)} aria-label={`${k.label} ${f}`}
              style={{ ...S.chip(d[k.id].includes(f)), padding: "5px 8px", fontSize: 12, ...(d[k.id].includes(f) ? { background: C.blauw, borderColor: C.blauw } : {}) }}>
              {f}
            </button>
          ))}
        </div>
      ))}
      <button onClick={() => zet(normaliseerDeliverables({ ...d, fotografie: !d.fotografie }))} aria-pressed={!!d.fotografie}
        style={{ ...S.chip(!!d.fotografie), padding: "6px 10px", fontSize: 13, minWidth: 96 }}>
        {d.fotografie ? "✓ " : ""}Fotografie
      </button>
      <p style={{ ...S.hint, marginTop: 8 }}>Gaat het hele project mee: in de projectkop, de PPM, de buy-outs van cast en als afvinklijst bij het opleveren.</p>
    </div>
  );
}

// Buy-outs per naam (cast en fotograaf): per medium aan/uit, looptijd en bedrag.
function BuyoutEditor({ b, opleverdatum, wijzig }) {
  const soort = buyoutSoort(b.onderdeelId);
  const media = BUYOUT_MEDIA[soort] || [];
  const lijst = b.buyouts || [];
  const van = (m) => lijst.find(x => x.medium === m);
  const zetMedium = (m, velden) => {
    const bestaat = van(m);
    const volgende = velden === null
      ? lijst.filter(x => x.medium !== m)
      : bestaat ? lijst.map(x => (x.medium === m ? { ...x, ...velden } : x)) : [...lijst, { medium: m, duur: null, bedrag: null, ...velden }];
    wijzig(media.map(x => volgende.find(y => y.medium === x.id)).filter(Boolean));
  };
  return (
    <div style={{ marginTop: 8, borderTop: `1px dashed ${C.rand2}`, paddingTop: 8 }}>
      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: C.muted }}>🔁 Buy-out{soort === "fotografie" ? " foto's" : ""}</p>
      {media.map(m => {
        const x = van(m.id);
        const einde = x?.duur ? buyoutEinde(opleverdatum, x.duur) : null;
        return (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            <button onClick={() => zetMedium(m.id, x ? null : {})} aria-pressed={!!x} style={{ ...S.chip(!!x), padding: "4px 9px", fontSize: 12, minWidth: 88 }}>
              {x ? "✓ " : ""}{m.label}
            </button>
            {x && (
              <>
                <select value={x.duur || ""} onChange={e => zetMedium(m.id, { duur: e.target.value || null })} aria-label={`Looptijd buy-out ${m.label}`}
                  style={{ ...S.inp, width: "auto", padding: "5px 6px", fontSize: 12 }}>
                  <option value="">Hoe lang?</option>
                  {BUYOUT_DUUR.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
                <input defaultValue={x.bedrag != null ? String(x.bedrag).replace(".", ",") : ""} key={`${m.id}-${x.bedrag}`} inputMode="decimal" placeholder="€" aria-label={`Bedrag buy-out ${m.label}`}
                  onBlur={e => { const v = leesBedragInvoer(e.target.value); if (v !== x.bedrag) zetMedium(m.id, { bedrag: v }); }}
                  style={{ ...S.inp, width: 80, padding: "5px 6px", fontSize: 12 }} />
                {einde && <span style={{ fontSize: 11, color: C.muted }}>t/m ± {datumKort(einde)} {einde.slice(0, 4)}</span>}
              </>
            )}
          </div>
        );
      })}
      {lijst.some(x => x.duur) && <p style={{ ...S.hint, marginTop: 0 }}>Looptijd vanaf "campagne live" in de projectkop (of anders de oplevering). Een maand vóór het einde krijg je een herinnering.</p>}
    </div>
  );
}

// Zelf toegevoegde planning: naam + datum + tijd, met snelkeuzes van eerder.
function EigenPlanning({ lijst, zet, suggesties, draaidag }) {
  const voegToe = (naam = "") => zet([...lijst, { id: uid(), naam, datum: draaidag ? plusDagen(draaidag, -7) : null, tijd: "10:00" }]);
  const wijzig = (id, velden) => zet(lijst.map(e => (e.id === id ? { ...e, ...velden } : e)));
  return (
    <div style={{ marginTop: 10 }}>
      {lijst.map(e => (
        <div key={e.id} style={{ background: C.bg, borderRadius: 10, padding: 8, marginBottom: 6 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input value={e.naam} autoFocus={!e.naam} placeholder="Bijv. moodboardpresentatie, locatiebezoek" aria-label="Naam afspraak"
              onChange={ev => wijzig(e.id, { naam: ev.target.value })} style={{ ...S.inp, padding: "6px 8px", fontSize: 14 }} />
            <button onClick={() => zet(lijst.filter(x => x.id !== e.id))} aria-label="Afspraak verwijderen" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={15} color={C.licht} /></button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input type="date" value={e.datum || ""} aria-label={`Datum ${e.naam || "afspraak"}`} onChange={ev => wijzig(e.id, { datum: ev.target.value || null })} style={{ ...S.inp, padding: "6px 8px", fontSize: 14 }} />
            <input type="time" value={e.tijd || "10:00"} aria-label={`Tijd ${e.naam || "afspraak"}`} onChange={ev => wijzig(e.id, { tijd: ev.target.value || "10:00" })} style={{ ...S.inp, padding: "6px 8px", fontSize: 14, width: 104 }} />
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => voegToe()} style={{ ...S.chip(false), padding: "6px 11px", fontSize: 13, color: C.groen, fontWeight: 700 }}>+ Eigen planning toevoegen</button>
        {suggesties.map(n => (
          <button key={n} onClick={() => voegToe(n)} title="Eerder gebruikt" style={{ ...S.chip(false), padding: "5px 10px", fontSize: 12, borderStyle: "dashed" }}>+ {n}</button>
        ))}
      </div>
    </div>
  );
}
