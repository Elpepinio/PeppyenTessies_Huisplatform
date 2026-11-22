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
import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  Sun, Star, CalendarDays, User, Bell, Repeat, Lock, Mail, Copy, Tag, ChevronLeft, ChevronRight,
  ChevronDown, Plus, X, Check, Trash2, Briefcase, Home, Upload, ArrowRightLeft, KeyRound, Download, Send,
} from "lucide-react";
import {
  vandaagStr, plusDagen, isoWeekdag, normaliseerHerhaling, herhalingLabel, vinkTaak, isInMijnDag,
  groepeerGepland, sorteerTaken, planDatum, ontleedSnelleInvoer, ontleedPlakImport, nieuweTaak, isGeldigePin,
} from "../lib/taken-logica";
import {
  FASES, SOORTEN, STANDAARD_SJABLONEN, maakProjectUitSjabloon, registreerGebruik, verschuifProject, projectVoortgang,
  berekenLeerVoorstellen, pasLeerVoorstellenToe, sorteerStappen, normaliseerStap, offsetTekst, timingHint, stapDatum,
  projectStatus, maakOfferte, offerteAkkoord, offerteAfgewezen, offerteNagevraagd, offerteStatistiek,
  ONDERDELEN, standaardOnderdelen, standaardMeetings, pasOnderdelenToe, telVerdwijnendeTaken,
  onderdeelVan, BEZETTING_STATUS, EENHEDEN, nieuweBezetting, leesBedragInvoer, synchroniseerCrewStappen, bezettingSamenvatting,
  onthoudContact, contactSuggesties, prijsTekst,
} from "../lib/projecten-logica";
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
  const [ruimteFilter, setRuimteFilter] = useState("alles");
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
      draaidag: opties.draaidag, vandaag, meetings: opties.meetings || {}, verledenNaarVandaag: opties.verledenNaarVandaag, wie: ik, nieuwId: uid,
    });
    zetLijst("werk", metOnderdelen);
    bewaarSjablonen(registreerGebruik(sjablonen, sjabloon.id).map(t => (t.id === sjabloon.id ? { ...t, laatsteOnderdelen: opties.onderdelen || [] } : t)));
    return metOnderdelen;
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
  function zetLijst(ruimte, nieuw, { verwijderd = false } = {}) {
    lastWriteRef.current = Date.now();
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
  function standaardLijst(ruimte) {
    const bron = ruimte === "werk" ? werkRef.current?.lists || [] : thuisRef.current.filter(l => l.type === "todo");
    const gewoon = bron.find(l => !l.mailInbox);
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
    if (slim.herinnering && meldingen === "uit") meld("🔔 Herinnering gezet — zet meldingen aan op dit toestel om 'm te krijgen");
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
    <div style={S.app}>
      <Head><title>Taken — Ons Huishouden</title></Head>

      {weergave.soort === "overzicht" && (
        <Overzicht
          {...{ ik, status, thuisLijsten, werkLijsten, werkStaat, klanten, klantVan, mailInfo, meldingen, aantal, vandaag }}
          openNieuwProject={(sjabloonId) => setSheet({ soort: "nieuwProject", sjabloonId })}
          openOfferte={() => setSheet("offerte")}
          openAkkoord={(listId) => setSheet({ soort: "akkoord", listId })}
          openAfwijzen={(listId) => setSheet({ soort: "afwijzen", listId })}
          openSjablonen={() => setSheet("sjablonen")}
          open={(w) => { setKlantFilter(null); setWeergave(w); setVoltooidOpen(false); }}
          nieuweLijst={(ruimte) => setSheet({ soort: "nieuweLijst", ruimte })}
          openPin={(modus) => { setPinModus(modus); setSheet("pin"); }}
          openMail={() => setSheet("mail")}
          openKlanten={() => setSheet("klanten")}
          openImport={() => setSheet("import")}
          zetMeldingenAan={zetMeldingenAan}
          vergrendel={async () => { await post("/api/taken/pin", { actie: "vergrendel" }); setWerk(null); setWerkStaat("vergrendeld"); meld("🔒 Werkruimte vergrendeld op dit toestel"); }}
          kopieerAdres={async () => { if (mailInfo?.adres && await kopieer(mailInfo.adres)) meld("📋 E-mailadres gekopieerd"); }}
        />
      )}

      {weergave.soort === "slim" && (
        <SlimOverzicht
          id={weergave.id} regels={regelsVoor(weergave.id)} alleRegels={alleRegels}
          {...{ ruimteFilter, setRuimteFilter, klantFilter, setKlantFilter, klanten, werkStaat, vandaag, suggestiesOpen, setSuggestiesOpen, klantVan, chronoRef }}
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
            {...{ klanten, klantFilter, setKlantFilter, klantVan, voltooidOpen, setVoltooidOpen, vandaag, chronoRef }}
            sjabloon={lijst.project ? sjablonen.find(t => t.id === lijst.project.sjabloonId) : null}
            verschuif={(data) => {
              wijzigLijst(weergave.ruimte, lijst.id, l => verschuifProject(l, data));
              meld("📅 Planning verschoven — open taken schuiven mee");
            }}
            zetProject={(velden) => wijzigLijst(weergave.ruimte, lijst.id, l => ({ ...l, project: { ...l.project, ...velden } }))}
            openLeren={() => setSheet({ soort: "leren", listId: lijst.id })}
            openOnderdelen={() => setSheet({ soort: "onderdelen", listId: lijst.id })}
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
      {sheet === "offerte" && (
        <OfferteSheet {...{ klanten, vandaag }} nieuweKlant={maakKlant} sluit={() => setSheet(null)}
          maak={(opties) => {
            const lijst = maakOfferte({ ...opties, vandaag, wie: ik, nieuwId: uid });
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
            maak={(sjabloon, opties) => {
              const nu = Date.now();
              startMetOnderdelen(offerteAkkoord(lijstVan("werk", lijst.id), sjabloon, { ...opties, akkoordOp: vandaag, vandaag, wie: ik, nu, nieuwId: uid }), sjabloon, opties);
              setSheet(null);
              setWeergave({ soort: "lijst", ruimte: "werk", listId: lijst.id });
              meld(`🎉 Akkoord! Productie van "${lijst.name}" gestart`);
            }} />
        );
      })()}
      {sheet?.soort === "onderdelen" && (() => {
        const lijst = lijstVan("werk", sheet.listId);
        if (!lijst) return null;
        const sjabloon = sjablonen.find(t => t.id === lijst.project?.sjabloonId);
        return (
          <OnderdelenSheet lijst={lijst} sjabloon={sjabloon} vandaag={vandaag} sluit={() => setSheet(null)}
            toepassen={(onderdelen, meetings) => {
              zetLijst("werk", pasOnderdelenToe(lijstVan("werk", lijst.id), onderdelen, { draaidag: lijst.project.draaidag, vandaag, meetings, wie: ik, nieuwId: uid }));
              setSheet(null);
              meld("🧩 Onderdelen bijgewerkt");
            }} />
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
          {...{ sjablonen, klanten, vandaag }} startSjabloonId={sheet.sjabloonId} nieuweKlant={maakKlant}
          sluit={() => setSheet(null)}
          maak={(sjabloon, opties) => {
            const lijst = startMetOnderdelen(maakProjectUitSjabloon(sjabloon, { ...opties, vandaag, wie: ik, nieuwId: uid }), sjabloon, opties);
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
          <LeerSheet lijst={lijst} sjabloon={sjabloon} sluit={() => setSheet(null)}
            toepassen={(voorstellen, gekozen, afronden) => {
              if (sjabloon) {
                const nieuw = pasLeerVoorstellenToe(sjabloon, lijst, voorstellen, gekozen, uid, { metTiming: !lijst.project.geleerdOp });
                bewaarSjablonen(sjablonen.map(t => (t.id === sjabloon.id ? nieuw : t)));
              }
              wijzigLijst("werk", lijst.id, l => ({ ...l, project: { ...l.project, geleerdOp: Date.now(), afgerond: afronden || l.project.afgerond } }));
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
  );
}

// ════════════════════════════════════════════════════════════════════
// OVERZICHT
// ════════════════════════════════════════════════════════════════════
function Overzicht({ ik, status, thuisLijsten, werkLijsten, werkStaat, klanten, klantVan, mailInfo, meldingen, aantal, open, nieuweLijst, openPin, openMail, openKlanten, openImport, openNieuwProject, openSjablonen, openOfferte, openAkkoord, openAfwijzen, zetMeldingenAan, vergrendel, kopieerAdres }) {
  const openAantal = (l) => (l.items || []).filter(i => !i.checked).length;
  const [afgerondOpen, setAfgerondOpen] = useState(false);
  const offertes = werkLijsten.filter(l => projectStatus(l) === "offerte" && !l.project.afgerond)
    .sort((a, b) => (a.project.offerte?.verstuurdOp || "").localeCompare(b.project.offerte?.verstuurdOp || ""));
  const stat = offerteStatistiek(werkLijsten);
  const projecten = werkLijsten.filter(l => l.project && !l.project.afgerond && projectStatus(l) !== "offerte")
    .sort((a, b) => (a.project.draaidag || "").localeCompare(b.project.draaidag || ""));
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
            {/* Offertes: verstuurd, wachten op akkoord — wekelijks navragen */}
            <p style={{ ...S.sectieKop, marginTop: 4 }}>📨 Offertes uitstaand
              {(stat.akkoord + stat.afgewezen) > 0 && (
                <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                  — {stat.scoringPct}% akkoord{stat.mediaanDagenTotAkkoord != null ? `, meestal na ${stat.mediaanDagenTotAkkoord} dagen` : ""}
                </span>
              )}
            </p>
            <div style={S.kaart}>
              {offertes.map(l => {
                const o = l.project.offerte || {};
                const dagen = o.verstuurdOp ? dagenTussen(o.verstuurdOp, vandaagStr()) : 0;
                const navraag = (l.items || []).find(i => i.offerteNavraag && !i.checked);
                const klant = klantVan(l.project.klantId);
                return (
                  <div key={l.id} style={{ padding: "12px 14px", borderBottom: "1px solid #F3EEE3" }}>
                    <button onClick={() => open({ soort: "lijst", ruimte: "werk", listId: l.id })} style={{ background: "none", border: "none", padding: 0, textAlign: "left", width: "100%", cursor: "pointer", fontFamily: "inherit", color: "inherit" }}>
                      <span style={{ display: "block", fontSize: 15 }}>{l.name}</span>
                      <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 2 }}>
                        {klant && <span style={{ color: klant.kleur || C.groen, fontWeight: 700 }}>● {klant.naam} · </span>}
                        verstuurd {dagen === 0 ? "vandaag" : `${dagen} ${dagen === 1 ? "dag" : "dagen"} geleden`}
                        {o.bedrag ? ` · € ${Number(o.bedrag).toLocaleString("nl-NL")}` : ""}
                        {navraag ? ` · navragen ${datumKort(navraag.dueDate).toLowerCase()}` : ""}
                      </span>
                    </button>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button style={{ ...S.knop(), padding: "6px 12px", fontSize: 13 }} onClick={() => openAkkoord(l.id)}>✅ Akkoord</button>
                      <button style={{ ...S.chip(false), padding: "6px 12px", fontSize: 13 }} onClick={() => openAfwijzen(l.id)}>✕ Afgewezen</button>
                    </div>
                  </div>
                );
              })}
              <button style={{ ...S.rij, color: C.groen, borderBottom: "none" }} onClick={openOfferte}>
                <Plus size={18} color={C.groen} /><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Offerte verstuurd — herinner me wekelijks</span>
              </button>
            </div>

            {/* Projecten (uit een sjabloon) — op volgorde van draaidag */}
            <p style={{ ...S.sectieKop, marginTop: 4 }}>🎬 Projecten</p>
            <div style={S.kaart}>
              {projecten.map(l => {
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
                        Draaidag {datumKort(l.project.draaidag)} · {klaar}/{totaal} klaar
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
              })}
              <button style={{ ...S.rij, color: C.groen }} onClick={() => openNieuwProject(null)}>
                <Plus size={18} color={C.groen} /><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Nieuw project uit sjabloon</span>
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
                    {afgerond.map(l => (
                      <button key={l.id} style={S.rij} onClick={() => open({ soort: "lijst", ruimte: "werk", listId: l.id })}>
                        <span style={{ fontSize: 18, width: 22, textAlign: "center", opacity: 0.6 }}>{l.icon || "🎬"}</span>
                        <span style={{ flex: 1, fontSize: 14, color: C.muted }}>{l.name} · {projectStatus(l) === "afgewezen" ? "✕ offerte afgewezen" : datumKort(l.project.draaidag)}</span>
                        <ChevronRight size={16} color={C.licht} />
                      </button>
                    ))}
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

function InvoerBalk({ placeholder, voegToe, chronoRef, boven = null }) {
  const [tekst, setTekst] = useState("");
  const voorbeeld = tekst.trim().length > 2 ? ontleedSnelleInvoer(tekst, chronoRef.current, new Date()) : null;
  const chips = [];
  if (voorbeeld?.herinnering) chips.push(`🔔 ${herinneringKort(voorbeeld.herinnering)}`);
  else if (voorbeeld?.dueDate) chips.push(`📅 ${datumKort(voorbeeld.dueDate)}`);
  if (voorbeeld?.herhaling) chips.push(`🔁 ${herhalingLabel(voorbeeld.herhaling)}`);
  if (voorbeeld?.belangrijk) chips.push("⭐ Belangrijk");
  function verstuur() {
    if (!tekst.trim()) return;
    voegToe(tekst);
    setTekst("");
  }
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "10px 16px 24px", background: `linear-gradient(180deg, rgba(250,246,240,0) 0%, ${C.bg} 30%)`, zIndex: 20 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {boven}
        {chips.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {chips.map(c => <span key={c} style={{ fontSize: 12, background: "#2D4A3E14", color: C.groen, borderRadius: 999, padding: "4px 10px", fontWeight: 600 }}>{c}</span>)}
            {voorbeeld?.titel && <span style={{ fontSize: 12, color: C.muted, padding: "4px 2px" }}>→ "{voorbeeld.titel}"</span>}
          </div>
        )}
        <form onSubmit={e => { e.preventDefault(); verstuur(); }} style={{ display: "flex", gap: 8, background: C.kaart, border: `1px solid ${C.rand2}`, borderRadius: 16, padding: 6, boxShadow: "0 6px 18px rgba(45,42,38,.08)" }}>
          <input value={tekst} onChange={e => setTekst(e.target.value)} placeholder={placeholder} aria-label="Taak toevoegen"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 16, padding: "8px 10px", background: "transparent", minWidth: 0, fontFamily: "inherit", color: C.tekst }} />
          <button type="submit" aria-label="Toevoegen" style={{ ...S.knop(), padding: "8px 12px", display: "flex", alignItems: "center" }}><Plus size={18} /></button>
        </form>
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
function SlimOverzicht({ id, regels, alleRegels, ruimteFilter, setRuimteFilter, klantFilter, setKlantFilter, klanten, werkStaat, vandaag, suggestiesOpen, setSuggestiesOpen, klantVan, chronoRef, terug, vink, ster, openTaak, naarMijnDag, voegToe }) {
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
      <InvoerBalk chronoRef={chronoRef} voegToe={voegToe}
        placeholder={ruimteFilter === "werk" && werkStaat === "open" ? "Werktaak toevoegen…" : "Taak toevoegen — bv. 'morgen 9:00 tandarts bellen'"} />
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// ÉÉN LIJST
// ════════════════════════════════════════════════════════════════════
function LijstWeergave({ ruimte, lijst, klanten, klantFilter, setKlantFilter, klantVan, voltooidOpen, setVoltooidOpen, chronoRef, terug, vink, ster, openTaak, voegToe, wijzig, verwijder, wisVoltooid, sjabloon, verschuif, zetProject, openLeren, openAkkoord, openAfwijzen, nagevraagd, openOnderdelen }) {
  const [menu, setMenu] = useState(false);
  const isOfferte = projectStatus(lijst) === "offerte";
  const isProject = !!lijst.project && !isOfferte;
  const eersteOpenFase = isProject ? (FASES.find(f => (lijst.items || []).some(i => i.category === f.id && !i.checked)) || FASES[0]).id : null;
  const [nieuweFase, setNieuweFase] = useState(eersteOpenFase);
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
        {isProject && <ProjectKop {...{ lijst, klanten, klantVan, sjabloon, verschuif, zetProject, openLeren, openOnderdelen }} />}
        {isOfferte && <OfferteKop {...{ lijst, klanten, klantVan, zetProject, openAkkoord, openAfwijzen, nagevraagd }} />}
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
      <InvoerBalk chronoRef={chronoRef}
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
function ProjectKop({ lijst, klanten, klantVan, sjabloon, verschuif, zetProject, openLeren, openOnderdelen }) {
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
        <span style={{ fontSize: 12, color: C.muted }}>📐 {sjabloon?.naam || p.sjabloonNaam || "sjabloon verwijderd"}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <label style={{ flex: 1, fontSize: 11, color: C.muted, fontWeight: 700 }}>🎬 DRAAIDAG
          <input type="date" value={draai || ""} onChange={e => setDraai(e.target.value)} style={{ ...S.inp, padding: "8px 10px", fontSize: 14, marginTop: 4 }} />
        </label>
        <label style={{ flex: 1, fontSize: 11, color: C.muted, fontWeight: 700 }}>📦 OPLEVERING
          <input type="date" value={oplever || ""} onChange={e => setOplever(e.target.value)} style={{ ...S.inp, padding: "8px 10px", fontSize: 14, marginTop: 4 }} />
        </label>
      </div>
      {gewijzigd && draai && oplever && (
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
        if (!sam.aantal) return null;
        const bedragen = Object.entries(sam.perEenheid).map(([e, b]) => prijsTekst(b, e)).join(" + ");
        return (
          <button onClick={() => setBezettingOpen(!bezettingOpen)} style={{ ...S.rij, padding: "10px 0 0", borderBottom: "none" }}>
            <span style={{ fontSize: 13, flex: 1 }}>👥 <strong>{sam.bevestigd}/{sam.aantal}</strong> bevestigd{bedragen ? ` · ${bedragen}` : ""}</span>
            <ChevronDown size={15} color={C.licht} style={{ transform: bezettingOpen ? "none" : "rotate(-90deg)" }} />
          </button>
        );
      })()}
      {bezettingOpen && <BezettingOverzicht lijst={lijst} />}
      {projectStatus(lijst) === "lopend" && !lijst.project.afgerond && (
        <button onClick={openOnderdelen} style={{ ...S.knop(C.bg, C.groen), width: "100%", marginTop: 12, border: `1px solid ${C.rand2}` }}>
          🧩 Onderdelen aan/uit <span style={{ fontWeight: 400, color: C.muted }}>— cast, locaties, crew, hotel…</span>
        </button>
      )}
      <button onClick={openLeren} style={{ ...S.knop(klaar === alles && alles ? C.groen : C.bg, klaar === alles && alles ? "#FAF6F0" : C.groen), width: "100%", marginTop: 12, border: `1px solid ${C.rand2}` }}>
        🧠 {p.afgerond ? "Opnieuw leren van dit project" : klaar === alles && alles ? "Alles klaar — afronden en sjabloon laten leren" : "Afronden & sjabloon laten leren"}
      </button>
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
  const h = normaliseerHerhaling(taak.herhaling);
  const presetId = !h ? "geen" : (h.interval === 1 && !h.dagen ? h.freq : (h.interval === 1 && h.dagen?.join() === "1,2,3,4,5" ? "werkdagen" : "aangepast"));
  const inMijnDag = taak.mijnDag === vandaag;
  const nu = new Date();
  const morgen9 = `${plusDagen(vandaag, 1)}T09:00`;
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
          <textarea value={naam} rows={Math.min(4, Math.ceil((naam.length || 1) / 32))} onChange={e => setNaam(e.target.value)}
            onBlur={() => naam.trim() && naam.trim() !== taak.name && zet({ name: naam.trim() })}
            style={{ flex: 1, fontSize: 18, fontWeight: 700, border: "none", resize: "none", outline: "none", fontFamily: "inherit", color: C.tekst, background: "transparent", padding: "4px 0" }} aria-label="Titel" />
          <button onClick={() => zet({ belangrijk: !taak.belangrijk })} aria-label="Belangrijk" style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
            <Star size={20} color={taak.belangrijk ? C.terra : "#D8D0BF"} fill={taak.belangrijk ? C.terra : "none"} />
          </button>
          <button onClick={sluit} aria-label="Sluiten" style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}><X size={20} color={C.licht} /></button>
        </div>
        <p style={{ margin: "0 0 0 36px", fontSize: 12, color: C.muted }}>{ruimte === "werk" ? "💼" : "🏠"} {lijst.icon} {lijst.name}</p>

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
          <button style={S.chip(taak.herinnering === morgen9)} onClick={() => zet({ herinnering: morgen9 })}>Morgen 09:00</button>
          {volgendeMaandag !== plusDagen(vandaag, 1) && <button style={S.chip(taak.herinnering === `${volgendeMaandag}T09:00`)} onClick={() => zet({ herinnering: `${volgendeMaandag}T09:00` })}>Maandag 09:00</button>}
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
          {[["Vandaag", vandaag], ["Morgen", plusDagen(vandaag, 1)], ["Volgende week", volgendeMaandag]].map(([l, d]) => (
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
          <BezettingEditor taak={taak} wijzigLaatste={wijzigLaatste} contacten={contacten} onthoud={onthoud} />
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
function OfferteKop({ lijst, klanten, klantVan, zetProject, openAkkoord, openAfwijzen, nagevraagd }) {
  const o = lijst.project.offerte || {};
  const dagen = o.verstuurdOp ? dagenTussen(o.verstuurdOp, vandaagStr()) : 0;
  const navraag = (lijst.items || []).find(i => i.offerteNavraag && !i.checked);
  const klant = klantVan(lijst.project.klantId);
  return (
    <div style={{ ...S.kaart, padding: 14, background: "#FFF8EC" }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.oranje, letterSpacing: "0.04em" }}>📨 OFFERTE — WACHT OP AKKOORD</p>
      <p style={{ margin: "6px 0 0", fontSize: 14 }}>
        Verstuurd {datumKort(o.verstuurdOp).toLowerCase()} ({dagen} {dagen === 1 ? "dag" : "dagen"} geleden)
        {o.bedrag ? ` · € ${Number(o.bedrag).toLocaleString("nl-NL")}` : ""}
        {o.keerNagevraagd ? ` · ${o.keerNagevraagd}× nagevraagd` : ""}
      </p>
      {navraag && <p style={{ ...S.hint, marginTop: 4 }}>🔔 Volgende navraag: {herinneringKort(navraag.herinnering) || datumKort(navraag.dueDate)} — en daarna {herhalingLabel(navraag.herhaling).toLowerCase()}, tot je op Akkoord of Afgewezen tikt.</p>}
      <select value={lijst.project.klantId || ""} onChange={e => zetProject({ klantId: e.target.value || null })} aria-label="Klant"
        style={{ ...S.inp, width: "auto", padding: "6px 10px", fontSize: 13, marginTop: 10, color: klant?.kleur || C.tekst, fontWeight: 700 }}>
        <option value="">Geen klant</option>
        {klanten.map(k => <option key={k.id} value={k.id}>● {k.naam}</option>)}
      </select>
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        <button style={{ ...S.knop(), flex: "1 1 auto" }} onClick={openAkkoord}>✅ Akkoord — productie starten</button>
        {navraag && <button style={{ ...S.knop(C.bg, C.groen), border: `1px solid ${C.rand2}` }} onClick={nagevraagd}>Nagevraagd</button>}
        <button style={{ ...S.knop(C.bg, C.rood), border: `1px solid ${C.rand2}` }} onClick={openAfwijzen}>✕ Afgewezen</button>
      </div>
    </div>
  );
}

function OfferteSheet({ klanten, vandaag, nieuweKlant, sluit, maak }) {
  const [naam, setNaam] = useState("");
  const [klantId, setKlantId] = useState("");
  const [nieuweKlantNaam, setNieuweKlantNaam] = useState("");
  const [verstuurdOp, setVerstuurdOp] = useState(vandaag);
  const [bedrag, setBedrag] = useState("");
  const [weken, setWeken] = useState(1);
  const [tijd, setTijd] = useState("10:00");
  const [notitie, setNotitie] = useState("");
  const bedragGetal = bedrag ? Number(String(bedrag).replace(/\./g, "").replace(",", ".")) : null;
  const eerste = plusDagen(verstuurdOp || vandaag, 7 * weken);
  const kan = naam.trim() && verstuurdOp && (bedrag === "" || Number.isFinite(bedragGetal));
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <SheetKop titel="Offerte verstuurd" sluit={sluit} />
        <p style={{ ...S.hint, marginTop: 0 }}>De app vraagt je elke week om na te vragen hoe het ervoor staat. Bij akkoord start je met één tik de productie vanuit een sjabloon.</p>
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
        <p style={S.label}>Notitie (optioneel)</p>
        <textarea rows={2} style={{ ...S.inp, fontSize: 14 }} placeholder="Contactpersoon, wat je hebt afgesproken…" value={notitie} onChange={e => setNotitie(e.target.value)} />
        <button disabled={!kan} onClick={() => maak({ naam: naam.trim(), klantId: klantId || null, verstuurdOp, bedrag: bedragGetal, weken, tijd, notitie: notitie.trim() })}
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

function NieuwProjectSheet({ sjablonen, klanten, vandaag, startSjabloonId, nieuweKlant, sluit, maak, vanOfferte = null }) {
  const [sjabloonId, setSjabloonId] = useState(startSjabloonId || sjablonen[0]?.id);
  const sjabloon = sjablonen.find(t => t.id === sjabloonId) || sjablonen[0];
  const [naam, setNaam] = useState(vanOfferte?.name || "");
  const [klantId, setKlantId] = useState(vanOfferte?.project?.klantId || "");
  const [nieuweKlantNaam, setNieuweKlantNaam] = useState("");
  const [draaidag, setDraaidag] = useState(plusDagen(vandaag, 21));
  const [oplever, setOplever] = useState(null); // null = automatisch (draaidag + doorlooptijd)
  const [verledenNaarVandaag, setVerledenNaarVandaag] = useState(true);
  const [onderdelen, setOnderdelen] = useState(() => standaardOnderdelen(sjabloon));
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
  const kan = naam.trim() && draaidag && opleverdatum >= draaidag;
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <SheetKop titel={vanOfferte ? `🎉 Akkoord — "${vanOfferte.name}"` : "Nieuw project"} sluit={sluit} />
        {vanOfferte && <p style={{ ...S.hint, marginTop: 0 }}>Kies het sjabloon en de data; de productietaken komen in dit project. Offerte- en akkoordstappen staan meteen op klaar.</p>}
        <p style={{ ...S.label, marginTop: 6 }}>Sjabloon</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {sjablonen.map(t => <button key={t.id} style={S.chip(t.id === sjabloon.id)} onClick={() => { setSjabloonId(t.id); setOplever(null); setOnderdelen(standaardOnderdelen(t)); }}>{t.icoon} {t.naam}</button>)}
        </div>
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

        {voorbeeld.length > 0 && (
          <div style={{ background: C.bg, borderRadius: 12, padding: 10, marginTop: 12, maxHeight: 180, overflowY: "auto" }}>
            {FASES.map(f => {
              const st = voorbeeld.filter(x => x.st.fase === f.id);
              if (!st.length) return null;
              return (
                <div key={f.id} style={{ marginBottom: 6 }}>
                  <strong style={{ fontSize: 12 }}>{f.icon} {f.label}</strong>
                  {st.map(({ st: s, d }) => (
                    <div key={s.id} style={{ fontSize: 12, display: "flex", gap: 6, color: d < vandaag ? C.rood : C.tekst }}>
                      <span style={{ width: 82, flexShrink: 0, color: d < vandaag ? C.rood : C.muted }}>{datumKort(d)}</span>
                      <span>{SOORTEN[s.soort]?.icon} {s.tekst}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        <p style={{ ...S.sectieKop, marginTop: 18 }}>🧩 Wat is er nodig voor deze productie?</p>
        <OnderdelenKiezer gekozen={onderdelen} setGekozen={setOnderdelen} meetings={meetings}
          setMeetings={(m) => { setMeetings(m); setPpmAangepast(true); }} />
        {teLaat > 0 && (
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 14 }}>
            <input type="checkbox" checked={verledenNaarVandaag} onChange={e => setVerledenNaarVandaag(e.target.checked)} />
            {teLaat} {teLaat === 1 ? "stap ligt" : "stappen liggen"} al in het verleden — op vandaag zetten
          </label>
        )}
        <button disabled={!kan} onClick={() => maak(sjabloon, { naam: naam.trim(), klantId: klantId || null, draaidag, opleverdatum, verledenNaarVandaag, onderdelen, meetings })}
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

function LeerSheet({ lijst, sjabloon, sluit, toepassen }) {
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
function OnderdelenKiezer({ gekozen, setGekozen, meetings, setMeetings }) {
  const aan = new Set(gekozen);
  const zet = (id) => { const n = new Set(aan); n.has(id) ? n.delete(id) : n.add(id); setGekozen([...n]); };
  return (
    <div>
      {ONDERDELEN.map(g => {
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
  const [meetings, setMeetings] = useState(() => standaardMeetings({ draaidag: p.draaidag, vandaag, bestaand: p.meetings || {} }));
  const weg = telVerdwijnendeTaken(lijst, gekozen);
  return (
    <div style={S.sheetAchter} onClick={sluit}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <SheetKop titel="Onderdelen aan/uit" sluit={sluit} />
        <p style={{ ...S.hint, marginTop: 0, marginBottom: 12 }}>Zet aan wat deze productie nodig heeft. Uitzetten haalt alleen taken weg die nog open staan; wat al gedaan is blijft staan.</p>
        <OnderdelenKiezer {...{ gekozen, setGekozen, meetings, setMeetings }} />
        {weg > 0 && <p style={{ ...S.hint, color: C.oranje }}>⚠️ {weg} open {weg === 1 ? "taak verdwijnt" : "taken verdwijnen"} uit het project.</p>}
        <button style={{ ...S.knop(), width: "100%", marginTop: 12 }} onClick={() => toepassen(gekozen, meetings)}>Toepassen</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// BEZETTING — namen per onderdeel/crew-rol met status en prijsafspraak.
// ════════════════════════════════════════════════════════════════════
function BezettingEditor({ taak, wijzigLaatste, contacten, onthoud }) {
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
              <BezettingRegel key={b.id} b={b} contacten={contacten} wijzig={(v) => wijzig(b.id, v)} verwijder={() => pasAan(lijst => lijst.filter(x => x.id !== b.id))}
                onthoud={(volledig) => { const contactId = onthoud(volledig); if (contactId && contactId !== b.contactId) wijzig(b.id, { contactId }); }} />
            ))}
            <button onClick={() => pasAan(lijst => [...lijst, nieuweBezetting({ onderdeelId: sec.id, eenheid: isLocatie || sec.id === "hotel" || sec.id === "verzekering" || sec.id === "catering" ? "totaal" : "dag" }, uid)])}
              style={{ ...S.chip(false), padding: "5px 10px", fontSize: 13, marginTop: regels.length ? 6 : 0 }}>
              + {regels.length ? "Nog iemand" : isLocatie ? "Locatie toevoegen" : "Naam toevoegen"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function BezettingRegel({ b, contacten, wijzig, verwijder, onthoud }) {
  const [naam, setNaam] = useState(b.naam || "");
  const [bedrag, setBedrag] = useState(b.bedrag != null ? String(b.bedrag).replace(".", ",") : "");
  const [notitie, setNotitie] = useState(b.notitie || "");
  const [focus, setFocus] = useState(false);
  useEffect(() => { setNaam(b.naam || ""); setBedrag(b.bedrag != null ? String(b.bedrag).replace(".", ",") : ""); setNotitie(b.notitie || ""); }, [b.id]);
  // Actuele invoer (ook binnen een vertraagde blur-afhandeling).
  const nu = useRef({});
  nu.current = { naam: naam.trim(), bedrag: leesBedragInvoer(bedrag), notitie: notitie.trim(), eenheid: b.eenheid, status: b.status };
  const suggesties = contactSuggesties(contacten, b.onderdeelId, naam).filter(c => c.naam !== naam).slice(0, 5);
  const bekend = contacten.find(c => c.naam.trim().toLowerCase() === naam.trim().toLowerCase());
  const vorige = bekend?.prijzen?.[b.onderdeelId];

  function kies(c) {
    const p = c.prijzen?.[b.onderdeelId];
    const velden = { naam: c.naam, contactId: c.id, notitie: notitie || c.notitie || "", ...(b.bedrag == null && p ? { bedrag: p.bedrag, eenheid: p.eenheid } : {}) };
    setNaam(c.naam); if (velden.bedrag != null) setBedrag(String(velden.bedrag).replace(".", ",")); setNotitie(velden.notitie);
    setFocus(false);
    wijzig(velden);
    onthoud({ ...b, ...velden });
  }
  // Alleen het veld dat je net verliet opslaan — nooit de andere velden met
  // een oude waarde overschrijven.
  function bewaarVeld(veld) {
    const waarde = nu.current[veld];
    if (waarde === (veld === "bedrag" ? b.bedrag : (b[veld] || ""))) return;
    wijzig({ [veld]: waarde });
    if (nu.current.naam) onthoud({ ...b, ...nu.current });
  }
  return (
    <div style={{ background: C.kaart, border: `1px solid ${C.rand}`, borderRadius: 10, padding: 8, marginBottom: 6 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", position: "relative" }}>
        <input value={naam} placeholder="Naam (persoon, bedrijf of locatie)" aria-label="Naam"
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
        <input value={notitie} placeholder="Tel., e-mail, afspraak…" aria-label="Notitie" onChange={e => setNotitie(e.target.value)} onBlur={() => bewaarVeld("notitie")}
          style={{ ...S.inp, padding: "6px 8px", fontSize: 13 }} />
      </div>
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

function BezettingOverzicht({ lijst }) {
  const regels = (lijst.items || []).flatMap(i => (i.bezetting || []).filter(b => b.naam).map(b => ({ ...b, taak: i.name })));
  const groepNaam = (b) => (b.onderdeelId?.startsWith("crew-") ? `Crew · ${onderdeelVan(b.onderdeelId)?.label || ""}` : onderdeelVan(b.onderdeelId)?.label || b.taak);
  return (
    <div style={{ marginTop: 8, background: C.bg, borderRadius: 12, padding: 10 }}>
      {regels.map(b => (
        <div key={b.id} style={{ display: "flex", gap: 8, fontSize: 13, padding: "4px 0", borderBottom: `1px solid ${C.rand}` }}>
          <span style={{ width: 12 }}>{b.status === "bevestigd" ? "✅" : b.status === "aangevraagd" ? "⏳" : "○"}</span>
          <span style={{ flex: 1, minWidth: 0 }}><strong>{b.naam}</strong> <span style={{ color: C.muted }}>· {groepNaam(b)}</span></span>
          <span style={{ color: C.muted, whiteSpace: "nowrap" }}>{prijsTekst(b.bedrag, b.eenheid)}</span>
        </div>
      ))}
      <p style={{ ...S.hint, marginTop: 6 }}>Tik op een taak om namen, status of prijzen te wijzigen.</p>
    </div>
  );
}
