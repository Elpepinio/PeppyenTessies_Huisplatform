// ═══════════════════════════════════════════════════════════════════════════════
// Budget — huishoudbudget-tool, platform-versie (zonder AI-functies)
// ═══════════════════════════════════════════════════════════════════════════════
import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Cell, ReferenceLine,
} from "recharts";

const THEMES = {
  dark:  { bg:"#0B0E15", surf:"#131720", card:"#1B2030", border:"#252C40", accent:"#00D4FF", green:"#00E096", red:"#FF4D6A", yellow:"#FFD166", purple:"#B57BFF", orange:"#FF8C42", text:"#E4E8F5", muted:"#6B7594", dim:"#3A4260" },
  light: { bg:"#F4F6FB", surf:"#FFFFFF", card:"#EEF1F8", border:"#D6DCF0", accent:"#0099CC", green:"#17A86A", red:"#D63353", yellow:"#CC8800", purple:"#7B52D9", orange:"#D4611A", text:"#1A1E2E", muted:"#6B7594", dim:"#C2C8DC" },
};

const ACC_COL  = { gezamenlijk:"#00D4FF", p1:"#B57BFF", p2:"#FF8C42" };
const CAT_ICON = { Wonen:"🏠", Boodschappen:"🛒", Transport:"🚗", Abonnementen:"📺", "Uit eten":"🍽️", Gezondheid:"💊", Kleding:"👗", Entertainment:"🎭", Vakantie:"✈️", Kinderen:"👶", Sparen:"💰", Overig:"📦" };
const CAT_COL  = {
  Wonen:"#6C63FF", Boodschappen:"#2ECC71", Transport:"#F39C12",
  Abonnementen:"#E74C3C", "Uit eten":"#1ABC9C", Gezondheid:"#E91E63",
  Kleding:"#FF9800", Entertainment:"#9C27B0", Vakantie:"#00BCD4",
  Kinderen:"#FF6B9D", Sparen:"#3F51B5", Overig:"#607D8B",
};

const CATEGORIES = ["Wonen","Boodschappen","Transport","Abonnementen","Uit eten","Gezondheid","Kleding","Entertainment","Vakantie","Kinderen","Sparen","Overig"];
// ── Dynamische datum (altijd actueel) ────────────────────────────────────────
const _now       = new Date();
const NOW_MONTH  = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}`;
const NOW_YEAR   = _now.getFullYear();
const NOW_Q      = Math.ceil((_now.getMonth() + 1) / 3);

// ── Rabobank CSV parser ───────────────────────────────────────────────────────
function parseRabobankCSV(text, rekeningMap) {
  const firstLine = text.trim().split("\n")[0];
  const sep = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";

  const rows = text.trim().split("\n");
  const header = rows[0].split(sep).map(c => c.replace(/^"|"$/g,"").trim().toLowerCase());

  const ci = name => header.findIndex(h => h.includes(name));
  const iIBAN    = ci("iban") >= 0 ? ci("iban") : 0;
  const iDatum   = ci("datum") >= 0 ? ci("datum") : 4;
  const iBedrag  = ci("bedrag") >= 0 ? ci("bedrag") : 6;
  const iNaam    = ci("naam") >= 0 ? ci("naam") : 1;
  const iOmsch1  = ci("omschrijving") >= 0 ? ci("omschrijving") : 9;
  const iOmsch2  = header.lastIndexOf(header.find((h,i) => i > iOmsch1 && h.includes("omschrijving"))) ?? 19;

  return rows.slice(1).flatMap(line => {
    if (!line.trim()) return [];

    const cols = [];
    let cur = "", inQ = false;
    for (const ch of line + sep) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === sep && !inQ) { cols.push(cur.trim()); cur = ""; }
      else cur += ch;
    }

    if (cols.length < 7) return [];

    const rawAmount = (cols[iBedrag] || "").replace(/\./g,"").replace(",",".");
    const amount    = parseFloat(rawAmount);
    if (isNaN(amount) || amount >= 0) return [];

    const datum = cols[iDatum] || "";
    if (!datum) return [];
    const month = datum.includes("-") && datum.indexOf("-") === 4
      ? datum.slice(0,7)
      : datum.split("-").reverse().slice(0,2).join("-");

    const iban    = cols[iIBAN] || "";
    const naam    = cols[iNaam] || "";
    const omsch   = [cols[iOmsch1], cols[iOmsch2] ?? ""].filter(Boolean).join(" – ").slice(0,100);
    const fullDesc = [naam, omsch].filter(Boolean).join(" · ").trim();

    const account = rekeningMap?.[iban] || "gezamenlijk";

    return [{
      id: uid(),
      name:     fullDesc.slice(0,80) || "Onbekend",
      amount:   Math.abs(amount),
      category: guessCategory(fullDesc),
      account,
      month,
      fixed:    false,
      fromBank: true,
      iban,
      rawDesc: fullDesc,
    }];
  });
}

function detectIBANsInCSV(text) {
  const sep = text.split("\n")[0].split(";").length > text.split("\n")[0].split(",").length ? ";" : ",";
  const ibans = new Set();
  text.trim().split("\n").slice(1).forEach(line => {
    const first = line.split(sep)[0].replace(/^"|"$/g,"").trim();
    if (/^NL\d{2}[A-Z]{4}\d{10}$/.test(first)) ibans.add(first);
  });
  return [...ibans];
}

function guessCategory(t) {
  t = t.toLowerCase();
  if (/albert heijn|jumbo|lidl|aldi|plus|spar|dirk|supermarkt/.test(t)) return "Boodschappen";
  if (/huur|hypotheek|energie|gas|elektra|nuon|vattenfall|eneco|essent/.test(t)) return "Wonen";
  if (/ns |ov-chip|trein|bus|metro|shell|bp |esso|benzine|parkeer|uber|bolt/.test(t)) return "Transport";
  if (/netflix|spotify|disney|videoland|ziggo|kpn|t-mobile|vodafone/.test(t)) return "Abonnementen";
  if (/restaurant|cafe|café|mcdonalds|thuisbezorgd|deliveroo|dominos|pizza|sushi/.test(t)) return "Uit eten";
  if (/zara|h&m|primark|wehkamp|zalando|bol\.com|nike|adidas|uniqlo/.test(t)) return "Kleding";
  if (/apotheek|huisarts|tandarts|ziekenhuis|gym|sportschool|yoga|decathlon/.test(t)) return "Gezondheid";
  if (/booking|airbnb|hotel|vliegticket|ryanair|transavia|corendon|sunweb|vakantie/.test(t)) return "Vakantie";
  if (/bioscoop|theater|concert|ticketmaster|efteling|pretpark/.test(t)) return "Entertainment";
  if (/sparen|spaarrekening/.test(t)) return "Sparen";
  return "Overig";
}

// ── Budget suggestion catalogue ───────────────────────────────────────────────
const NAAM_SUGGESTIES = {
  Kinderen:     ["Kinderdagverblijf","BSO","School","Speelgoed","Kinderkleren","Schoolspullen","Luiers","Babyvoeding","Zwemlessen","Sportclub"],
  Boodschappen: ["Albert Heijn","Jumbo","Lidl","Aldi","Markt","Slager","Bakker"],
  "Uit eten":   ["Restaurant","Koffie","Lunch","Afhaal","Bezorging","Terras","Brunch"],
  Transport:    ["Benzine","Parkeren","OV","Taxi","Trein"],
  Gezondheid:   ["Apotheek","Huisarts","Tandarts","Fysiotherapeut","Sportschool","Yoga"],
  Kleding:      ["Kleding","Schoenen","Accessoires","Sportkleding"],
  Entertainment:["Bioscoop","Concert","Museum","Theater","Boeken","Spelletjes","Pretpark"],
  Vakantie:     ["Vliegticket","Hotel","Airbnb","Camping","Autoverhuur","Dagje uit"],
  Wonen:        ["Huur","Energie","Gas","Water","Internet","Verzekering","Gemeentebelasting"],
  Abonnementen: ["Netflix","Spotify","Disney+","Ziggo","KPN","T-Mobile","Videoland"],
};

const BUDGET_SUGGESTIONS = {
  Kleding:       [{period:"maand",amount:80,label:"Basis"},{period:"maand",amount:150,label:"Gemiddeld NL"},{period:"kwartaal",amount:300,label:"Seizoensgewijs"},{period:"jaar",amount:1200,label:"Jaarbudget NL"}],
  Vakantie:      [{period:"jaar",amount:1500,label:"Weekend + kort"},{period:"jaar",amount:3000,label:"1 grote vakantie EU"},{period:"jaar",amount:5000,label:"2 vakanties"},{period:"kwartaal",amount:800,label:"Elk kwartaal uitje"}],
  "Uit eten":    [{period:"maand",amount:80,label:"Af en toe"},{period:"maand",amount:150,label:"Gemiddeld stel"},{period:"maand",amount:250,label:"Actief sociaal"},{period:"kwartaal",amount:450,label:"Kwartaalbudget"}],
  Boodschappen:  [{period:"maand",amount:300,label:"Zuinig"},{period:"maand",amount:450,label:"Gemiddeld CBS 2024"},{period:"maand",amount:600,label:"Ruim"}],
  Entertainment: [{period:"maand",amount:50,label:"Alleen streaming"},{period:"maand",amount:100,label:"Films & uitjes"},{period:"kwartaal",amount:200,label:"Kwartaal"}],
  Transport:     [{period:"maand",amount:150,label:"OV + incidenteel"},{period:"maand",amount:250,label:"Auto dagelijks"},{period:"jaar",amount:2400,label:"Jaarkosten NL"}],
  Gezondheid:    [{period:"maand",amount:50,label:"Apotheek + sport"},{period:"maand",amount:100,label:"Incl. sportschool"},{period:"jaar",amount:500,label:"Eigen risico buffer"}],
};

const prevMonth = ym => { const [y,m]=ym.split("-").map(Number); return m===1?`${y-1}-12`:`${y}-${String(m-1).padStart(2,"0")}`; };

const fmtM = ym => { const [y,m] = ym.split("-"); return `${["Jan","Feb","Mrt","Apr","Mei","Jun","Jul","Aug","Sep","Okt","Nov","Dec"][+m-1]} '${y.slice(2)}`; };
const euro  = n  => `€${(+n).toLocaleString("nl-NL",{minimumFractionDigits:0,maximumFractionDigits:0})}`;
const uid   = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// "Wie heeft wat gedaan"-badge: toont het initiaal van wie de uitgave heeft
// toegevoegd, maar alleen als dat recent was (24u).
const WIE_BADGE_VENSTER_MS = 24 * 60 * 60 * 1000;
function WieBadge({ persoon, tijdstip }) {
  if (!persoon || !tijdstip) return null;
  if (Date.now() - tijdstip > WIE_BADGE_VENSTER_MS) return null;
  return (
    <span
      title={`Toegevoegd door ${persoon}`}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 15, height: 15, borderRadius: "50%",
        background: persoon === "Pepijn" ? "#2D4A3E" : "#C86E4A",
        color: "#FAF6F0", fontSize: 8, fontWeight: 700, flexShrink: 0,
      }}
    >
      {persoon.charAt(0)}
    </span>
  );
}

const getQ = m => Math.ceil(+m.split("-")[1] / 3);
const getY = m => +m.split("-")[0];

function computeSpent(budget, expenses, maand = NOW_MONTH) {
  const mYear = getY(maand), mQ = getQ(maand);
  return expenses.filter(e => {
    if (e.category !== budget.category) return false;
    if (budget.account !== "alle" && e.account !== budget.account) return false;
    const y = getY(e.month), q = getQ(e.month);
    if (budget.period === "maand")    return e.month === maand;
    if (budget.period === "kwartaal") return y === mYear && q === mQ;
    if (budget.period === "jaar")     return y === mYear;
    return false;
  }).reduce((s, e) => s + e.amount, 0);
}

function periodLabel(p, maand = NOW_MONTH) {
  const mYear = getY(maand), mQ = getQ(maand);
  if (p === "maand")    return fmtM(maand);
  if (p === "kwartaal") return `Q${mQ} ${mYear}`;
  return `${mYear}`;
}

function buildAlerts(expenses, budgets, savingsGoals, incomes, maand = NOW_MONTH) {
  const alerts = [];
  const totalIncome = incomes.p1+incomes.p2;
  budgets.forEach(b => {
    const spent = computeSpent(b, expenses, maand);
    const pct = b.amount > 0 ? spent/b.amount : 0;
    if (spent > b.amount) alerts.push({id:`over-${b.id}`,level:"rood",icon:"🚨",title:`Budget overschreden: ${b.category}`,body:`${euro(spent-b.amount)} meer dan budget van ${euro(b.amount)}.`,tab:"budgetten"});
    else if (pct > 0.8) alerts.push({id:`warn-${b.id}`,level:"oranje",icon:"⚠️",title:`${b.category} ${Math.round(pct*100)}% vol`,body:`Nog ${euro(b.amount-spent)} resterend.`,tab:"budgetten"});
  });
  const PREV = prevMonth(maand);
  const catNow={}, catPrev={};
  expenses.filter(e=>e.month===maand).forEach(e=>{catNow[e.category]=(catNow[e.category]||0)+e.amount;});
  expenses.filter(e=>e.month===PREV).forEach(e=>{catPrev[e.category]=(catPrev[e.category]||0)+e.amount;});
  Object.keys(catNow).forEach(cat => {
    const rise = catPrev[cat]>0 ? (catNow[cat]-catPrev[cat])/catPrev[cat] : 0;
    if (rise>0.25 && catNow[cat]>50) alerts.push({id:`rise-${cat}`,level:"oranje",icon:"📈",title:`${cat} +${Math.round(rise*100)}% vs vorige maand`,body:`${euro(catPrev[cat])} → ${euro(catNow[cat])}`,tab:"dashboard"});
  });
  if (savingsGoals) savingsGoals.forEach(g => {
    if (!g.deadline) return;
    const [ty,tm]=g.deadline.split("-").map(Number);
    const [ny,nm]=maand.split("-").map(Number);
    const ml=(ty-ny)*12+(tm-nm); const needed=g.target-g.current;
    if (ml>0 && needed>0) { const monthly=needed/ml; if(monthly>totalIncome*0.3) alerts.push({id:`goal-${g.id}`,level:"oranje",icon:"🎯",title:`${g.name}: tempo verhogen`,body:`Je hebt ${euro(monthly)}/mnd nodig.`,tab:"doelen"}); }
  });
  const totalSpent=Object.values(catNow).reduce((s,v)=>s+v,0);
  const savRate=totalIncome>0?(totalIncome-totalSpent)/totalIncome:0;
  if (savRate>=0.2) alerts.push({id:"good",level:"groen",icon:"✅",title:`Spaarquote ${Math.round(savRate*100)}% 🎉`,body:"Jullie sparen meer dan 20% van het inkomen.",tab:"dashboard"});
  return alerts;
}

function detectRecurring(expenses) {
  const groups={};
  expenses.forEach(e=>{const k=`${e.name}|${e.account}|${e.category}`;(groups[k]=groups[k]||[]).push(e.month);});
  return new Set(Object.entries(groups).filter(([,m])=>m.length>=3).map(([k])=>k));
}

// ── Data ophalen/opslaan via eigen API-route (Upstash Redis) ─────────────────
async function loadBudgetData() {
  try {
    const res = await fetch("/api/budget");
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function saveBudgetData(data) {
  try {
    await fetch("/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.error("Opslaan mislukt", e);
  }
}

// ── Reusable UI primitives ────────────────────────────────────────────────────
function AccountBadge({ accountId, names, small, C }) {
  const label = accountId === "gezamenlijk" ? "Gezamenlijk" : accountId === "p1" ? names.p1 : names.p2;
  const color = ACC_COL[accountId] || (C ? C.muted : "#6B7594");
  return (
    <span style={{
      background:`${color}22`, color, border:`1px solid ${color}55`,
      padding: small ? "1px 7px" : "2px 9px",
      borderRadius:20, fontSize: small ? 10 : 11, fontWeight:700, whiteSpace:"nowrap",
    }}>{label}</span>
  );
}

function BudgetRing({ spent, budget, size = 64, C }) {
  const _C    = C || { red:"#FF4D6A", yellow:"#FFD166", green:"#00E096", dim:"#3A4260" };
  const pct   = budget > 0 ? Math.min(100, Math.round(spent / budget * 100)) : 0;
  const over  = spent > budget;
  const color = over ? _C.red : pct > 80 ? _C.yellow : _C.green;
  const r     = size / 2 - 6;
  const circ  = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)", flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={_C.dim} strokeWidth={5}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${circ * pct / 100} ${circ}`} strokeLinecap="round"
        style={{ transition:"stroke-dasharray .5s ease" }}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={size/5} fontWeight={800}
        style={{ transform:`rotate(90deg)`, transformOrigin:`${size/2}px ${size/2}px` }}>
        {pct}%
      </text>
    </svg>
  );
}

function makeS(C) {
  return {
    inp: { background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 11px", color:C.text, fontSize:13, width:"100%", boxSizing:"border-box" },
    btn: (col=C.accent, tc=C.bg) => ({ background:col, color:tc, border:"none", borderRadius:8, padding:"8px 16px", fontWeight:700, fontSize:13, cursor:"pointer" }),
    tabBtn: active => ({ padding:"10px 14px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:600, fontSize:13, background:active?C.accent:"transparent", color:active?C.bg:C.muted, transition:"all .15s", whiteSpace:"nowrap" }),
    badge: (color) => ({ background:`${color}22`, color, border:`1px solid ${color}55`, padding:"1px 7px", borderRadius:20, fontSize:10, fontWeight:700, whiteSpace:"nowrap" }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function BudgetApp() {
  const [loading, setLoading] = useState(true);
  const [verbindingsFout, setVerbindingsFout] = useState(false);
  const [offline, setOffline] = useState(false);
  const [themeName, setThemeNameState] = useState("dark");
  const [names,        setNamesState]        = useState({ p1:"Partner 1", p2:"Partner 2" });
  const [incomes,      setIncomesState]      = useState({ p1:0, p2:0, bijdrage_p1:0, bijdrage_p2:0, kinderbijslag:0 });
  const [expenses,     setExpensesState]     = useState([]);
  const [budgets,      setBudgetsState]      = useState([]);
  const [receipts,     setReceiptsState]     = useState([]);
  const [savingsGoals, setSavingsGoalsState] = useState([]);
  const [tasks,        setTasksState]        = useState([]);
  const [bijst,        setBijstState]        = useState([]);
  const [setupDone,    setSetupDoneState]    = useState(false);
  const [huidigeGebruiker, setHuidigeGebruiker] = useState(null); // "Pepijn" | "Tessa"

  // ── Wie ben ik? (voor "wie heeft wat gedaan"-badges) ──
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.user) setHuidigeGebruiker(d.user);
    }).catch(() => {});
  }, []);

  const C = THEMES[themeName] || THEMES.dark;
  const S = useMemo(() => makeS(C), [themeName]);

  const lastLocalWriteRef = useRef(0);
  const pollRef = useRef(null);

  // Eén centrale plek die het hele state-object samenstelt en opslaat.
  const persist = useCallback((patch) => {
    lastLocalWriteRef.current = Date.now();
    const next = {
      setupDone: patch.setupDone ?? setupDone,
      theme: patch.theme ?? themeName,
      names: patch.names ?? names,
      incomes: patch.incomes ?? incomes,
      expenses: patch.expenses ?? expenses,
      budgets: patch.budgets ?? budgets,
      receipts: patch.receipts ?? receipts,
      savingsGoals: patch.savingsGoals ?? savingsGoals,
      tasks: patch.tasks ?? tasks,
      bijst: patch.bijst ?? bijst,
    };
    if (patch.setupDone !== undefined) setSetupDoneState(patch.setupDone);
    if (patch.theme !== undefined) setThemeNameState(patch.theme);
    if (patch.names !== undefined) setNamesState(patch.names);
    if (patch.incomes !== undefined) setIncomesState(patch.incomes);
    if (patch.expenses !== undefined) setExpensesState(patch.expenses);
    if (patch.budgets !== undefined) setBudgetsState(patch.budgets);
    if (patch.receipts !== undefined) setReceiptsState(patch.receipts);
    if (patch.savingsGoals !== undefined) setSavingsGoalsState(patch.savingsGoals);
    if (patch.tasks !== undefined) setTasksState(patch.tasks);
    if (patch.bijst !== undefined) setBijstState(patch.bijst);
    saveBudgetData(next);
  }, [setupDone, themeName, names, incomes, expenses, budgets, receipts, savingsGoals, tasks, bijst]);

  // Kleine helper-setters die op dezelfde manier werken als de oude setX(updater)-vorm,
  // zodat de rest van de component-logica grotendeels ongewijzigd kan blijven.
  const setNames        = (updater) => persist({ names: typeof updater === "function" ? updater(names) : updater });
  const setIncomes      = (updater) => persist({ incomes: typeof updater === "function" ? updater(incomes) : updater });
  const setExpenses     = (updater) => persist({ expenses: typeof updater === "function" ? updater(expenses) : updater });
  const setBudgets      = (updater) => persist({ budgets: typeof updater === "function" ? updater(budgets) : updater });
  const setReceipts     = (updater) => persist({ receipts: typeof updater === "function" ? updater(receipts) : updater });
  const setSavingsGoals = (updater) => persist({ savingsGoals: typeof updater === "function" ? updater(savingsGoals) : updater });
  const setTasks        = (updater) => persist({ tasks: typeof updater === "function" ? updater(tasks) : updater });
  const setBijst        = (updater) => persist({ bijst: typeof updater === "function" ? updater(bijst) : updater });
  const setThemeName    = (updater) => persist({ theme: typeof updater === "function" ? updater(themeName) : updater });
  const setSetupDone    = (val) => persist({ setupDone: val });

  // Laad data bij openen, en poll voor sync met partner
  useEffect(() => {
    let active = true;

    const refresh = async () => {
      if (Date.now() - lastLocalWriteRef.current < 5000) return;
      const data = await loadBudgetData();
      if (active && data) {
        setSetupDoneState(!!data.setupDone);
        setThemeNameState(data.theme || "dark");
        setNamesState(data.names);
        setIncomesState(data.incomes);
        setExpensesState(data.expenses || []);
        setBudgetsState(data.budgets || []);
        setReceiptsState(data.receipts || []);
        setSavingsGoalsState(data.savingsGoals || []);
        setTasksState(data.tasks || []);
        setBijstState(data.bijst || []);
        setLoading(false);
        setVerbindingsFout(false);
      } else if (active) {
        setLoading(false);
        setVerbindingsFout(true);
      }
    };

    refresh();
    pollRef.current = setInterval(refresh, 4000);
    return () => {
      active = false;
      clearInterval(pollRef.current);
    };
  }, []);

  // ── Offline detectie ──────────────────────────────────────────────────────
  useEffect(() => {
    const onOnline  = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // ── Ephemeral UI state ────────────────────────────────────────────────────
  const [tab,          setTab]          = useState("dashboard");
  const [quickAdd,     setQuickAdd]     = useState(false);
  const [activeAcc,    setActiveAcc]    = useState("alle");
  const [selectedMonth, setSelectedMonth] = useState(NOW_MONTH); // maand-selector
  const [csvImport,    setCsvImport]    = useState(null);
  const [csvError,     setCsvError]     = useState("");
  const [ibanMap,      setIbanMap]      = useState({});
  const [toast,        setToast]        = useState(null);
  const [toastColor,   setToastColor]   = useState(null);
  const [expForm,      setExpForm]      = useState({ name:"", amount:"", category:CATEGORIES[0], account:"p1", month:NOW_MONTH, fixed:false, recurring:false, note:"" });
  const [bForm,        setBForm]        = useState({ category:"Kleding", period:"kwartaal", amount:"", account:"alle", note:"" });
  const [showBForm,    setShowBForm]    = useState(false);
  const [drillCat,     setDrillCat]     = useState(null);
  const _prevMonth = prevMonth(NOW_MONTH);
  const [cmpMonth,     setCmpMonth]     = useState(_prevMonth);
  const [editNote,     setEditNote]     = useState(null);
  const [goalForm,     setGoalForm]     = useState({name:"",target:"",current:"0",deadline:"",account:"gezamenlijk",icon:"🎯"});
  const [taskForm,     setTaskForm]     = useState({title:"",due:"",account:"alle",priority:"middel"});

  const csvRef  = useRef();

  // ── Derived data (memoised) ───────────────────────────────────────────────
  const accountOptions = useMemo(() => [
    { id:"p1",          label: names.p1 },
    { id:"p2",          label: names.p2 },
    { id:"gezamenlijk", label:"Gezamenlijk" },
  ], [names]);

  const gezBudget = (incomes.bijdrage_p1||0) + (incomes.bijdrage_p2||0)
    + (incomes.kinderbijslag||0)
    + (bijst||[]).filter(b => b.datum?.startsWith(selectedMonth)).reduce((s,b) => s+b.bedrag, 0);

  const totalByAccount = useMemo(() => {
    const t = { gezamenlijk:0, p1:0, p2:0 };
    expenses.filter(e => e.month === selectedMonth).forEach(e => { t[e.account] = (t[e.account]||0) + e.amount; });
    return t;
  }, [expenses, selectedMonth]);

  const filteredExpenses = useMemo(() =>
    activeAcc === "alle" ? expenses : expenses.filter(e => e.account === activeAcc),
  [expenses, activeAcc]);

  const byCat = useMemo(() => {
    const m = {};
    expenses.filter(e => e.month === selectedMonth).forEach(e => { m[e.category] = (m[e.category]||0) + e.amount; });
    return Object.entries(m).map(([name,value]) => ({name,value})).sort((a,b) => b.value - a.value);
  }, [expenses, selectedMonth]);

  const byCatPrev = useMemo(() => {
    const m = {};
    expenses.filter(e => e.month === cmpMonth).forEach(e => { m[e.category] = (m[e.category]||0) + e.amount; });
    return m;
  }, [expenses, cmpMonth]);

  const alerts = useMemo(() =>
    buildAlerts(expenses, budgets, savingsGoals || [], incomes, selectedMonth),
  [expenses, budgets, savingsGoals, incomes, selectedMonth]);

  const recurring = useMemo(() => detectRecurring(expenses), [expenses]);

  const budgetsWithSpent = useMemo(() =>
    budgets.map(b => ({ ...b, spent: computeSpent(b, expenses, selectedMonth), pLabel: periodLabel(b.period, selectedMonth) })),
  [budgets, expenses, selectedMonth]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg, col=null) { setToast(msg); setToastColor(col); setTimeout(() => { setToast(null); setToastColor(null); }, 2800); }

  // ── Terugkerende uitgaven automatisch toevoegen ───────────────────────────
  useEffect(() => {
    if (!expenses.length) return;
    const recurring = expenses.filter(e => e.recurring && e.month !== NOW_MONTH);
    if (!recurring.length) return;
    // Groepeer per naam+account+category — neem de meest recente versie
    const byKey = {};
    recurring.forEach(e => {
      const k = `${e.name}|${e.account}|${e.category}`;
      if (!byKey[k] || e.month > byKey[k].month) byKey[k] = e;
    });
    const nieuweItems = Object.values(byKey).filter(e =>
      !expenses.some(x => x.name === e.name && x.account === e.account && x.category === e.category && x.month === NOW_MONTH)
    );
    if (!nieuweItems.length) return;
    setExpenses(prev => [
      ...prev,
      ...nieuweItems.map(e => ({ ...e, id: uid(), month: NOW_MONTH, fromBank: false })),
    ]);
  }, []);  // eslint-disable-line — alleen bij mount

  // ── CSV-export ────────────────────────────────────────────────────────────
  function exporteerCSV() {
    const header = ["Datum","Naam","Bedrag (€)","Categorie","Rekening","Vast","Terugkerend","Notitie"];
    const rows = expenses
      .sort((a,b) => b.month.localeCompare(a.month))
      .map(e => [
        e.month,
        e.name,
        `€ ${e.amount.toFixed(2).replace(".",",")}`,
        e.category,
        e.account === "p1" ? names.p1 : e.account === "p2" ? names.p2 : "Gezamenlijk",
        e.fixed ? "Ja" : "Nee",
        e.recurring ? "Ja" : "Nee",
        e.note || "",
      ]);
    // Totaalregel onderaan
    const totaal = expenses.reduce((s,e) => s+e.amount, 0);
    rows.push(["TOTAAL","","€ "+totaal.toFixed(2).replace(".",","),"","","","",""]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `budget-export-${selectedMonth}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast("✅ CSV geëxporteerd");
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  function addExpense() {
    if (!expForm.name.trim() || !expForm.amount) return;
    setExpenses(prev => [...prev, {
      ...expForm, id: uid(), amount: +expForm.amount,
      addedBy: huidigeGebruiker, addedAt: Date.now(),
    }]);
    setExpForm(f => ({ ...f, name:"", amount:"" }));
    showToast("✅ Uitgave toegevoegd");
  }

  function delExpense(id) {
    const item = expenses.find(e => e.id === id);
    setExpenses(prev => prev.filter(e => e.id !== id));
    if (item) {
      showToast(`🗑 ${item.name} verwijderd — `, "undo");
      // Bewaar voor undo
      window._undoExp = { item, timer: setTimeout(() => { window._undoExp = null; setToast(null); }, 5000) };
    }
  }

  function undoDelExpense() {
    if (!window._undoExp) return;
    clearTimeout(window._undoExp.timer);
    setExpenses(prev => [...prev, window._undoExp.item]);
    window._undoExp = null;
    setToast(null);
    showToast("✅ Teruggezet");
  }

  function addBudget() {
    if (!bForm.amount) return;
    setBudgets(prev => [...prev, { ...bForm, id: uid(), amount: +bForm.amount }]);
    setBForm(f => ({ ...f, amount:"", note:"" }));
    setShowBForm(false);
    showToast("✅ Budget aangemaakt");
  }

  function delBudget(id) { setBudgets(prev => prev.filter(b => b.id !== id)); }
  function updateNote(id, note) { setExpenses(prev => prev.map(e => e.id===id ? {...e,note} : e)); setEditNote(null); showToast("✅ Notitie opgeslagen"); }
  function addGoal() { if(!goalForm.name||!goalForm.target) return; setSavingsGoals(p=>[...p,{...goalForm,id:uid(),target:+goalForm.target,current:+goalForm.current||0}]); setGoalForm({name:"",target:"",current:"0",deadline:"",account:"gezamenlijk",icon:"🎯"}); showToast("✅ Spaardoel toegevoegd"); }
  function delGoal(id) { setSavingsGoals(p=>p.filter(g=>g.id!==id)); }
  function depositGoal(id, add) { setSavingsGoals(p=>p.map(g=>g.id===id?{...g,current:Math.min(g.target,g.current+add)}:g)); }
  function addTask() { if(!taskForm.title) return; setTasks(p=>[...p,{...taskForm,id:uid(),done:false}]); setTaskForm({title:"",due:"",account:"alle",priority:"middel"}); showToast("✅ Taak toegevoegd"); }
  function toggleTask(id) { setTasks(p=>p.map(t=>t.id===id?{...t,done:!t.done}:t)); }
  function delTask(id) { setTasks(p=>p.filter(t=>t.id!==id)); }

  function confirmCSV(rows) {
    setExpenses(prev => [...prev, ...rows]);
    setCsvImport(null);
    showToast(`✅ ${rows.length} transacties ingeladen`);
    setTab("uitgaven");
  }

  // ── CSV import ────────────────────────────────────────────────────────────
  function handleCSV(file) {
    if (!file) return;
    setCsvError(""); setCsvImport(null);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const rows = parseRabobankCSV(e.target.result, ibanMap);
        if (!rows.length) { setCsvError("Geen uitgaven gevonden. Controleer het Rabobank CSV-formaat."); return; }
        setCsvImport(rows);
      } catch (err) { setCsvError("Fout bij inladen: " + err.message); }
    };
    reader.readAsText(file, "UTF-8");
  }

  // ── Shared style helpers (use inside render only) ─────────────────────────
  const tabBtn = t => S.tabBtn(tab === t);
  const accBtn = a => ({
    padding:"5px 11px", borderRadius:20, border:`1px solid ${activeAcc===a ? ACC_COL[a]||C.accent : C.border}`,
    cursor:"pointer", fontWeight:600, fontSize:12,
    background: activeAcc===a ? `${ACC_COL[a]||C.accent}22` : "transparent",
    color: activeAcc===a ? ACC_COL[a]||C.accent : C.muted, transition:"all .15s",
  });

  // ── Balances ──────────────────────────────────────────────────────────────
  const balances = {
    p1: (incomes.p1||0) - (totalByAccount.p1||0) - (incomes.bijdrage_p1||0),
    p2: (incomes.p2||0) - (totalByAccount.p2||0) - (incomes.bijdrage_p2||0),
    gezamenlijk: gezBudget - (totalByAccount.gezamenlijk||0),
  };
  const totalIncome = incomes.p1 + incomes.p2;
  const totalAll    = Object.values(totalByAccount).reduce((s,v) => s+v, 0);

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ fontSize:28 }}>💰</div>
      <div style={{ display:"flex", gap:6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:C.accent, opacity:0.3, animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}`}</style>
    </div>
  );

  if (verbindingsFout) return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, padding:"0 32px", textAlign:"center" }}>
      <div style={{ fontSize:40 }}>{offline ? "📡" : "⚠️"}</div>
      <p style={{ fontWeight:700, fontSize:17, color:C.text, margin:0 }}>{offline ? "Geen verbinding" : "Kon niet laden"}</p>
      <p style={{ fontSize:14, color:C.muted, margin:0 }}>
        {offline
          ? "Er zijn nog geen eerder opgehaalde gegevens om te tonen. Zodra je weer online bent, laadt alles vanzelf."
          : "Controleer je internetverbinding en probeer het opnieuw."}
      </p>
      <button style={{ background:C.accent, color:C.bg, border:"none", borderRadius:10, padding:"12px 28px", fontSize:15, fontWeight:700, cursor:"pointer" }} onClick={() => { setVerbindingsFout(false); setLoading(true); window.location.reload(); }}>
        Opnieuw proberen
      </button>
    </div>
  );

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (!setupDone) return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"system-ui,sans-serif", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.surf, borderRadius:16, border:`1px solid ${C.border}`, padding:24, maxWidth:440, width:"100%", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ fontSize:28, textAlign:"center", marginBottom:4 }}>👫</div>
        <h2 style={{ margin:"0 0 3px", textAlign:"center", fontSize:18 }}>Budget instellen</h2>
        <p style={{ margin:"0 0 18px", color:C.muted, fontSize:12, textAlign:"center" }}>
          {names.p1 !== "Partner 1" ? `Welkom terug, ${names.p1} & ${names.p2}` : "Stel jullie rekeningen in"}
        </p>

        {[["p1","👤 Partner 1"],["p2","👤 Partner 2"]].map(([key, label]) => (
          <div key={key} style={{ marginBottom:16, paddingBottom:14, borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontSize:12, color:ACC_COL[key], fontWeight:700, marginBottom:7 }}>{label}</div>
            <input style={{...S.inp, marginBottom:6}}
              placeholder={key==="p1" ? "Naam partner 1" : "Naam partner 2"}
              value={names[key]}
              onChange={e => setNames(p=>({...p,[key]:e.target.value}))}/>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
              <span style={{ fontSize:11, color:C.muted, width:170, flexShrink:0 }}>💰 Netto maandinkomen €</span>
              <input style={S.inp} type="number" min="0"
                value={incomes[key]}
                onChange={e => setIncomes(p=>({...p,[key]:Math.max(0,+e.target.value)}))}/>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:11, color:C.muted, width:170, flexShrink:0 }}>🏦 Bijdrage aan gezamenlijk €</span>
              <input style={S.inp} type="number" min="0"
                value={incomes[key==="p1"?"bijdrage_p1":"bijdrage_p2"]||0}
                onChange={e => setIncomes(p=>({...p,[key==="p1"?"bijdrage_p1":"bijdrage_p2"]:Math.max(0,+e.target.value)}))}/>
            </div>
          </div>
        ))}

        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, color:ACC_COL.gezamenlijk, fontWeight:700, marginBottom:6 }}>🏦 Gezamenlijke rekening</div>
          <p style={{ margin:"0 0 10px", fontSize:11, color:C.muted, lineHeight:1.5 }}>
            Gevoed door jullie bijdragen + kinderbijslag. Extra stortingen voeg je per keer toe via het dashboard.
          </p>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:11, color:C.muted, width:170, flexShrink:0 }}>👶 Kinderbijslag / toeslag €</span>
            <input style={S.inp} type="number" min="0"
              value={incomes.kinderbijslag||0}
              onChange={e => setIncomes(p=>({...p,kinderbijslag:Math.max(0,+e.target.value)}))}/>
          </div>
          <div style={{ marginTop:10, background:C.card, borderRadius:9, padding:"9px 12px" }}>
            <div style={{ fontSize:10, color:C.muted, marginBottom:6, textTransform:"uppercase", letterSpacing:.5 }}>Budget gezamenlijk per maand</div>
            {[
              [`Bijdrage ${names.p1||"Partner 1"}`, incomes.bijdrage_p1||0],
              [`Bijdrage ${names.p2||"Partner 2"}`, incomes.bijdrage_p2||0],
              ["Kinderbijslag / toeslag", incomes.kinderbijslag||0],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, marginBottom:3 }}>
                <span>{lbl}</span><span style={{ color:val>0?C.text:C.dim }}>€{val.toLocaleString("nl-NL")}</span>
              </div>
            ))}
            <div style={{ borderTop:`1px solid ${C.border}`, marginTop:6, paddingTop:6, display:"flex", justifyContent:"space-between", fontWeight:800, fontSize:14 }}>
              <span style={{ color:ACC_COL.gezamenlijk }}>Totaal</span>
              <span style={{ color:ACC_COL.gezamenlijk }}>€{((incomes.bijdrage_p1||0)+(incomes.bijdrage_p2||0)+(incomes.kinderbijslag||0)).toLocaleString("nl-NL")}/mnd</span>
            </div>
          </div>
        </div>

        <button style={{...S.btn(), width:"100%", padding:"11px", fontSize:14}}
          onClick={() => { if(names.p1.trim()&&names.p2.trim()) setSetupDone(true); }}>
          Start →
        </button>
        <Link href="/" style={{ display:"block", textAlign:"center", marginTop:10, fontSize:12, color:C.muted, textDecoration:"underline" }}>
          ← Terug naar overzicht
        </Link>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"system-ui,-apple-system,sans-serif", padding:"16px 14px" }}>
      {offline && (
        <div style={{ background:"#C86E4A", color:"#FFF", padding:"7px 14px", borderRadius:10, fontSize:12, fontWeight:600, textAlign:"center", marginBottom:12 }}>
          📡 Geen verbinding — je ziet de laatst opgehaalde gegevens. Wijzigen kan pas weer zodra je online bent.
        </div>
      )}
      {toast && (
        <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", background:C.green, color:C.bg, padding:"9px 16px", borderRadius:10, fontWeight:700, zIndex:999, fontSize:13, boxShadow:"0 4px 24px rgba(0,224,150,.35)", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:10 }}>
          <span>{toast}</span>
          {window._undoExp && (
            <button onClick={undoDelExpense} style={{ background:C.yellow, color:C.bg, border:"none", borderRadius:7, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
              Ongedaan maken
            </button>
          )}
        </div>
      )}

      {!navigator.onLine && (
        <div style={{ background:C.orange, color:C.bg, padding:"7px 16px", fontSize:12, fontWeight:600, textAlign:"center" }}>
          📡 Geen verbinding — wijzigingen worden opgeslagen zodra je weer online bent
        </div>
      )}

      <div style={{ maxWidth:960, margin:"0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4, flexWrap:"wrap", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <Link href="/" style={{ display:"flex", alignItems:"center", justifyContent:"center", width:34, height:34, borderRadius:9, background:`linear-gradient(135deg,${C.accent},${C.purple})`, fontSize:17, textDecoration:"none" }}>🏠</Link>
            <div>
              <h1 style={{ margin:0, fontSize:19, fontWeight:800, letterSpacing:-.5 }}>Budget</h1>
              <p style={{ margin:0, color:C.muted, fontSize:11 }}>{names.p1} · {names.p2} · Gezamenlijk</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
            {/* Maand-selector */}
            <input type="month" value={selectedMonth} max={NOW_MONTH}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 10px", color:C.text, fontSize:12, cursor:"pointer" }} />
            {alerts.filter(a=>a.level==="rood").length > 0 && <span style={{ background:`${C.red}22`, color:C.red, border:`1px solid ${C.red}44`, padding:"3px 9px", borderRadius:20, fontSize:11, fontWeight:700, cursor:"pointer" }} onClick={()=>setTab("meldingen")}>🚨 {alerts.filter(a=>a.level==="rood").length}</span>}
            {alerts.filter(a=>a.level==="oranje").length > 0 && <span style={{ background:`${C.yellow}22`, color:C.yellow, border:`1px solid ${C.yellow}44`, padding:"3px 9px", borderRadius:20, fontSize:11, fontWeight:700, cursor:"pointer" }} onClick={()=>setTab("meldingen")}>⚠️ {alerts.filter(a=>a.level==="oranje").length}</span>}
            <button onClick={exporteerCSV} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 10px", color:C.muted, cursor:"pointer", fontSize:12 }}>⬇️ CSV</button>
            <button onClick={() => csvRef.current?.click()} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 10px", color:C.muted, cursor:"pointer", fontSize:12 }}>📂 Bank</button>
            <input ref={csvRef} type="file" accept=".csv" style={{ display:"none" }} onChange={e => handleCSV(e.target.files[0])}/>
            <button onClick={() => setThemeName(t => t==="dark" ? "light" : "dark")} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 10px", color:C.muted, cursor:"pointer", fontSize:14 }}>{themeName==="dark" ? "☀️" : "🌙"}</button>
            <button onClick={() => setSetupDone(false)} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 10px", color:C.muted, cursor:"pointer", fontSize:14 }}>⚙️</button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch", paddingBottom:4, margin:"12px 0" }}>
          <div style={{ display:"flex", gap:2, background:C.surf, borderRadius:9, padding:3, border:`1px solid ${C.border}`, width:"max-content" }}>
            {[["dashboard","🏠 Dashboard"],["uitgaven","💳 Uitgaven"],["bank","🏦 Bank"],[`meldingen`,`🔔${alerts.length > 0 ? " "+alerts.length : ""} Meldingen`],["budgetten","🎯 Budgetten"],["vergelijk","📊 Vergelijk"],["doelen","💰 Doelen"],["taken","✅ Taken"],["afsluiting","📅 Maand"]]
              .map(([t,l]) => <button key={t} style={tabBtn(t)} onClick={() => setTab(t)}>{l}</button>)}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            BUDGETTEN
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "budgetten" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
              <div>
                <h2 style={{ margin:0, fontSize:16, fontWeight:800 }}>Budgetten</h2>
                <p style={{ margin:"3px 0 0", fontSize:12, color:C.muted }}>Maand · Kwartaal · Jaar — live bijgewerkt</p>
              </div>
              <button style={S.btn()} onClick={() => setShowBForm(v => !v)}>+ Nieuw budget</button>
            </div>

            {/* New budget form */}
            {showBForm && (
              <div style={{ background:C.surf, borderRadius:12, border:`1px solid ${C.accent}44`, padding:16 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:C.accent }}>Nieuw budget</div>
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr auto", gap:8, alignItems:"end" }}>
                  <div>
                    <Label C={C}>Categorie</Label>
                    <select style={S.inp} value={bForm.category} onChange={e => setBForm(p=>({...p,category:e.target.value}))}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    {BUDGET_SUGGESTIONS[bForm.category] && (
                      <div style={{ marginTop:5, display:"flex", flexWrap:"wrap", gap:3 }}>
                        {BUDGET_SUGGESTIONS[bForm.category].map((s,i) => (
                          <button key={i} onClick={() => setBForm(p=>({...p,period:s.period,amount:s.amount}))}
                            style={{ background:`${C.accent}15`, border:`1px solid ${C.accent}44`, borderRadius:6, padding:"2px 7px", color:C.accent, fontSize:10, cursor:"pointer" }}>
                            {s.period[0].toUpperCase()} €{s.amount} – {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div><Label C={C}>Periode</Label><select style={S.inp} value={bForm.period} onChange={e=>setBForm(p=>({...p,period:e.target.value}))}>{["maand","kwartaal","jaar"].map(p=><option key={p}>{p}</option>)}</select></div>
                  <div><Label C={C}>Bedrag €</Label><input style={S.inp} type="number" min="0" placeholder="0" value={bForm.amount} onChange={e=>setBForm(p=>({...p,amount:e.target.value}))}/></div>
                  <div><Label C={C}>Rekening</Label>
                    <select style={S.inp} value={bForm.account} onChange={e=>setBForm(p=>({...p,account:e.target.value}))}>
                      <option value="alle">Alle</option>
                      {accountOptions.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                  </div>
                  <button style={S.btn(C.green)} onClick={addBudget}>Opslaan</button>
                </div>
                <input style={{...S.inp, marginTop:8}} placeholder="Notitie (optioneel)" value={bForm.note} onChange={e=>setBForm(p=>({...p,note:e.target.value}))}/>
              </div>
            )}

            {/* Budget cards grouped by period */}
            {["maand","kwartaal","jaar"].map(period => {
              const pb = budgetsWithSpent.filter(b => b.period === period);
              if (!pb.length) return null;
              return (
                <div key={period}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>
                    {period === "maand" ? "📅 Maand" : period === "kwartaal" ? "📆 Kwartaal" : "📅 Jaar"} · {periodLabel(period)}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
                    {pb.map(b => {
                      const over      = b.spent > b.amount;
                      const pct       = b.amount > 0 ? Math.min(100, Math.round(b.spent/b.amount*100)) : 0;
                      const barColor  = over ? C.red : pct > 80 ? C.yellow : C.green;
                      const remaining = b.amount - b.spent;
                      return (
                        <div key={b.id} style={{ background:C.surf, borderRadius:13, border:`1px solid ${over?C.red+"44":C.border}`, padding:16, position:"relative" }}>
                          <button onClick={() => delBudget(b.id)} style={{ position:"absolute", top:10, right:10, background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:14 }}>×</button>
                          <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                            <BudgetRing spent={b.spent} budget={b.amount} size={60} C={C}/>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:3 }}>
                                <span style={{ fontWeight:700, fontSize:14 }}>{b.category}</span>
                                {b.account !== "alle" && <AccountBadge accountId={b.account} names={names} small C={C}/>}
                              </div>
                              {b.note && <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>{b.note}</div>}
                              <div style={{ fontSize:12 }}>Budget: <strong>{euro(b.amount)}</strong> · Besteed: <strong style={{ color:barColor }}>{euro(b.spent)}</strong></div>
                            </div>
                          </div>
                          <div style={{ marginTop:10, background:C.card, borderRadius:4, height:6 }}>
                            <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:4, transition:"width .4s" }}/>
                          </div>
                          <div style={{ display:"flex", justifyContent:"space-between", marginTop:5, fontSize:11 }}>
                            <span style={{ color:C.muted }}>{pct}% gebruikt</span>
                            <span style={{ color: over ? C.red : C.green, fontWeight:600 }}>
                              {over ? `${euro(Math.abs(remaining))} over budget` : `${euro(remaining)} resterend`}
                            </span>
                          </div>
                          {over && <div style={{ marginTop:8, background:`${C.red}15`, borderRadius:6, padding:"5px 10px", fontSize:11, color:C.red }}>⚠️ Overschreden met {euro(b.spent - b.amount)}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Preset suggestions table */}
            <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:18 }}>
              <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700 }}>📚 Nederlandse richtlijnen</h3>
              <p style={{ margin:"0 0 12px", fontSize:12, color:C.muted }}>Klik om direct een budget toe te voegen</p>
              {Object.entries(BUDGET_SUGGESTIONS).map(([cat,subs]) => (
                <div key={cat} style={{ borderBottom:`1px solid ${C.border}`, paddingBottom:8, marginBottom:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                    <span style={{ width:9, height:9, borderRadius:"50%", background:CAT_COL[cat]||C.muted, display:"inline-block" }}/>
                    <span style={{ fontWeight:700, fontSize:13 }}>{cat}</span>
                  </div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {subs.map((s,i) => (
                      <button key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:7, padding:"4px 9px", color:C.text, fontSize:11, cursor:"pointer" }}
                        onClick={() => { setBudgets(p=>[...p,{id:uid(),category:cat,period:s.period,amount:s.amount,account:"alle",note:s.label}]); showToast(`✅ Budget ${cat} toegevoegd`); }}>
                        <span style={{ color:C.accent, fontWeight:700 }}>{euro(s.amount)}/{s.period==="maand"?"mnd":s.period==="kwartaal"?"kwt":"jr"}</span>
                        <span style={{ color:C.muted, marginLeft:5 }}>{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ VERGELIJK / DRILL-DOWN ══ */}
        {tab === "vergelijk" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <h2 style={{ margin:0, fontSize:15, fontWeight:800, flex:1 }}>📊 Maandvergelijking</h2>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <span style={{ fontSize:12, color:C.muted }}>vs</span>
                <input type="month" value={cmpMonth} onChange={e=>setCmpMonth(e.target.value)} style={{ ...S.inp, width:"auto" }}/>
              </div>
            </div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              <button style={{ ...S.btn(drillCat===null?C.accent:C.card, drillCat===null?C.bg:C.text), fontSize:11, padding:"4px 10px" }} onClick={()=>setDrillCat(null)}>Alle</button>
              {byCat.map(({name})=>(
                <button key={name} style={{ ...S.btn(drillCat===name?CAT_COL[name]||C.accent:C.card, drillCat===name?C.bg:C.text), fontSize:11, padding:"4px 10px" }} onClick={()=>setDrillCat(drillCat===name?null:name)}>
                  {CAT_ICON[name]} {name}
                </button>
              ))}
            </div>
            {drillCat === null ? (
              <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:16 }}>
                <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:700 }}>{fmtM(selectedMonth)} vs {fmtM(cmpMonth)}</h3>
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={byCat.map(c=>({name:c.name.length>7?c.name.slice(0,7)+"…":c.name,Huidig:c.value,Vorig:byCatPrev[c.name]||0}))} barGap={3} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke={C.dim}/>
                    <XAxis dataKey="name" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`}/>
                    <Tooltip contentStyle={{background:C.card,border:"none",borderRadius:8,color:C.text,fontSize:11}} formatter={(v,n)=>[`€${v}`,n]}/>
                    <Bar dataKey="Huidig" radius={[3,3,0,0]}>{byCat.map((c,i)=><Cell key={i} fill={CAT_COL[c.name]||C.accent} opacity={.85}/>)}</Bar>
                    <Bar dataKey="Vorig" radius={[3,3,0,0]}>{byCat.map((c,i)=><Cell key={i} fill={CAT_COL[c.name]||C.muted} opacity={.3}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display:"flex", gap:14, marginTop:6, fontSize:11, color:C.muted, justifyContent:"center" }}>
                  <span><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:C.accent,marginRight:4,opacity:.85}}/>Huidig</span>
                  <span><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:C.muted,marginRight:4,opacity:.35}}/>Vorig</span>
                </div>
              </div>
            ) : (()=>{
              const catExp = expenses.filter(e=>e.category===drillCat&&e.month===selectedMonth).sort((a,b)=>b.amount-a.amount);
              const months = Array.from({length:6},(_,i)=>{const d=new Date(NOW_YEAR,+NOW_MONTH.split("-")[1]-1-i,1);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}).reverse();
              const trendData = months.map(m=>({label:fmtM(m),total:expenses.filter(e=>e.category===drillCat&&e.month===m).reduce((s,e)=>s+e.amount,0)}));
              return <>
                <div style={{ background:C.surf, borderRadius:13, border:`2px solid ${CAT_COL[drillCat]||C.accent}44`, overflow:"hidden" }}>
                  <div style={{ background:C.card, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontWeight:700, fontSize:14 }}>{CAT_ICON[drillCat]} {drillCat} — {fmtM(selectedMonth)}</span>
                    <span style={{ fontWeight:800, color:CAT_COL[drillCat]||C.accent }}>{euro(byCat.find(c=>c.name===drillCat)?.value||0)}</span>
                  </div>
                  {catExp.map(e=>(
                    <div key={e.id} style={{ padding:"9px 14px", display:"flex", alignItems:"center", gap:8, borderTop:`1px solid ${C.border}` }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{e.name}</div>
                        {e.note && <div style={{ fontSize:11, color:C.muted }}>💬 {e.note}</div>}
                      </div>
                      <AccountBadge accountId={e.account} names={names} small C={C}/>
                      {recurring.has(`${e.name}|${e.account}|${e.category}`) && <span style={{ fontSize:10, background:`${C.purple}22`, color:C.purple, padding:"1px 6px", borderRadius:8 }}>↻</span>}
                      <span style={{ fontWeight:700, fontSize:14 }}>{euro(e.amount)}</span>
                      <button onClick={()=>setEditNote({id:e.id,note:e.note||""})} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:5, padding:"2px 6px", cursor:"pointer", color:C.muted, fontSize:11 }}>📝</button>
                    </div>
                  ))}
                  {catExp.length===0 && <div style={{ padding:"18px 14px", textAlign:"center", color:C.muted, fontSize:12 }}>Geen uitgaven in {fmtM(selectedMonth)}</div>}
                </div>
                <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:16 }}>
                  <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:700 }}>6-maanden trend: {drillCat}</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.dim}/>
                      <XAxis dataKey="label" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`}/>
                      <Tooltip contentStyle={{background:C.card,border:"none",borderRadius:8,color:C.text,fontSize:11}} formatter={v=>[`€${v}`,"Besteed"]}/>
                      <Line type="monotone" dataKey="total" stroke={CAT_COL[drillCat]||C.accent} strokeWidth={2.5} dot={{r:4,fill:CAT_COL[drillCat]||C.accent,stroke:C.bg,strokeWidth:2}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>;
            })()}
          </div>
        )}

        {/* ══ SPAARDOELEN ══ */}
        {tab === "doelen" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <h2 style={{ margin:0, fontSize:15, fontWeight:800 }}>💰 Spaardoelen</h2>
            <div style={{ background:C.surf, borderRadius:12, border:`1px solid ${C.border}`, padding:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:9 }}>+ Nieuw spaardoel</div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr auto", gap:7, alignItems:"end" }}>
                <div><Label C={C}>Naam</Label><input style={S.inp} placeholder="bv. Vakantie 2026" value={goalForm.name} onChange={e=>setGoalForm(p=>({...p,name:e.target.value}))}/></div>
                <div><Label C={C}>Doel €</Label><input style={S.inp} type="number" min="0" value={goalForm.target} onChange={e=>setGoalForm(p=>({...p,target:e.target.value}))}/></div>
                <div><Label C={C}>Nu gespaard €</Label><input style={S.inp} type="number" min="0" value={goalForm.current} onChange={e=>setGoalForm(p=>({...p,current:e.target.value}))}/></div>
                <div><Label C={C}>Deadline</Label><input style={S.inp} type="month" value={goalForm.deadline} onChange={e=>setGoalForm(p=>({...p,deadline:e.target.value}))}/></div>
                <button style={S.btn(C.green)} onClick={addGoal}>+</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7, marginTop:7 }}>
                <div><Label C={C}>Rekening</Label><select style={S.inp} value={goalForm.account} onChange={e=>setGoalForm(p=>({...p,account:e.target.value}))}><option value="alle">Alle</option>{accountOptions.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
                <div><Label C={C}>Icoon</Label><select style={S.inp} value={goalForm.icon} onChange={e=>setGoalForm(p=>({...p,icon:e.target.value}))}>{["🎯","✈️","🚗","🏠","🛡️","💍","🎓","💻","🎸","⛵","🏖️"].map(ic=><option key={ic}>{ic}</option>)}</select></div>
              </div>
            </div>
            {(savingsGoals||[]).map(g=>{
              const pct = g.target>0 ? Math.min(100,Math.round(g.current/g.target*100)) : 0;
              const [ty,tm] = g.deadline ? g.deadline.split("-").map(Number) : [NOW_YEAR+1,1];
              const [ny,nm] = selectedMonth.split("-").map(Number);
              const ml = Math.max(0,(ty-ny)*12+(tm-nm));
              const needed = g.target-g.current;
              const monthly = ml>0 ? Math.round(needed/ml) : needed;
              const totalInc = incomes.p1 + incomes.p2;
              return (
                <div key={g.id} style={{ background:C.surf, borderRadius:13, border:`1px solid ${pct>=100?C.green+"44":C.border}`, padding:16 }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:10 }}>
                    <span style={{ fontSize:28 }}>{g.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <span style={{ fontWeight:800, fontSize:15 }}>{g.name}</span>
                        <button onClick={()=>delGoal(g.id)} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:14 }}>×</button>
                      </div>
                      {g.account!=="alle" && <AccountBadge accountId={g.account} names={names} small C={C}/>}
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:10 }}>
                    {[{l:"Gespaard",v:euro(g.current),c:C.green},{l:"Doel",v:euro(g.target),c:C.text},{l:"Nodig/mnd",v:euro(monthly),c:monthly>totalInc*0.3?C.red:C.accent}].map(({l,v,c})=>(
                      <div style={{ background:C.card, borderRadius:9, padding:"9px 11px", textAlign:"center" }}>
                        <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>{l}</div>
                        <div style={{ fontWeight:800, fontSize:16, color:c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background:C.card, borderRadius:5, height:8, marginBottom:5 }}>
                    <div style={{ height:"100%", width:`${pct}%`, background:pct>=100?C.green:C.accent, borderRadius:5, transition:"width .5s" }}/>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, marginBottom:10 }}>
                    <span>{pct}% bereikt</span>
                    {g.deadline && <span>{ml} maanden resterend · deadline {fmtM(g.deadline)}</span>}
                  </div>
                  {pct<100 && (
                    <div style={{ display:"flex", gap:6 }}>
                      {[50,100,250,500].map(amt=>(
                        <button key={amt} style={{ ...S.btn(C.green), fontSize:11, padding:"5px 10px", flex:1 }} onClick={()=>{ depositGoal(g.id,amt); showToast(`+${euro(amt)} gespaard!`, C.green); }}>
                          +{euro(amt)}
                        </button>
                      ))}
                    </div>
                  )}
                  {pct>=100 && <div style={{ background:`${C.green}22`, borderRadius:8, padding:"8px 12px", textAlign:"center", color:C.green, fontWeight:700 }}>🎉 Doel bereikt!</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ TAKEN ══ */}
        {tab === "taken" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <h2 style={{ margin:0, fontSize:15, fontWeight:800 }}>✅ Taken & herinneringen</h2>
            <div style={{ background:C.surf, borderRadius:12, border:`1px solid ${C.border}`, padding:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:9 }}>+ Nieuwe taak</div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr auto", gap:7, alignItems:"end" }}>
                <div><Label C={C}>Taak</Label><input style={S.inp} placeholder="Omschrijving" value={taskForm.title} onChange={e=>setTaskForm(p=>({...p,title:e.target.value}))}/></div>
                <div><Label C={C}>Deadline</Label><input style={S.inp} type="date" value={taskForm.due} onChange={e=>setTaskForm(p=>({...p,due:e.target.value}))}/></div>
                <div><Label C={C}>Prioriteit</Label><select style={S.inp} value={taskForm.priority} onChange={e=>setTaskForm(p=>({...p,priority:e.target.value}))}>{["hoog","middel","laag"].map(p=><option key={p}>{p}</option>)}</select></div>
                <div><Label C={C}>Rekening</Label><select style={S.inp} value={taskForm.account} onChange={e=>setTaskForm(p=>({...p,account:e.target.value}))}><option value="alle">Alle</option>{accountOptions.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
                <button style={S.btn()} onClick={addTask}>+</button>
              </div>
            </div>
            {["hoog","middel","laag"].map(prio=>{
              const pt = (tasks||[]).filter(t=>!t.done&&t.priority===prio);
              if(!pt.length) return null;
              const col = prio==="hoog"?C.red:prio==="middel"?C.yellow:C.muted;
              return (
                <div key={prio}>
                  <div style={{ fontSize:11, fontWeight:700, color:col, marginBottom:7, textTransform:"uppercase", letterSpacing:1 }}>
                    {prio==="hoog"?"🔴 Hoog":prio==="middel"?"🟡 Middel":"⚪ Laag"}
                  </div>
                  {pt.map(t=>{
                    const isOver = t.due && t.due < new Date().toISOString().slice(0,10);
                    return (
                      <div key={t.id} style={{ background:C.surf, borderRadius:11, border:`1px solid ${isOver?C.red+"44":C.border}`, padding:"11px 14px", display:"flex", alignItems:"center", gap:10, marginBottom:7 }}>
                        <input type="checkbox" checked={false} onChange={()=>toggleTask(t.id)} style={{ width:16, height:16, cursor:"pointer" }}/>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600 }}>{t.title}</div>
                          <div style={{ display:"flex", gap:8, marginTop:3, flexWrap:"wrap" }}>
                            {t.due && <span style={{ fontSize:11, color:isOver?C.red:C.muted }}>📅 {t.due}</span>}
                            {t.account!=="alle" && <AccountBadge accountId={t.account} names={names} small C={C}/>}
                          </div>
                        </div>
                        <button onClick={()=>delTask(t.id)} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:14 }}>×</button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {(tasks||[]).filter(t=>t.done).length > 0 && (
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:C.green, marginBottom:7, textTransform:"uppercase", letterSpacing:1 }}>✅ Afgerond</div>
                {(tasks||[]).filter(t=>t.done).map(t=>(
                  <div key={t.id} style={{ background:C.surf, borderRadius:11, border:`1px solid ${C.border}`, padding:"9px 14px", display:"flex", alignItems:"center", gap:10, marginBottom:6, opacity:.55 }}>
                    <input type="checkbox" checked={true} onChange={()=>toggleTask(t.id)} style={{ width:16, height:16, cursor:"pointer" }}/>
                    <span style={{ flex:1, fontSize:12, textDecoration:"line-through", color:C.muted }}>{t.title}</span>
                    <button onClick={()=>delTask(t.id)} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:13 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ MELDINGEN ══ */}
        {tab === "meldingen" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <h2 style={{ margin:0, fontSize:15, fontWeight:800, color:C.text }}>🔔 Meldingen</h2>
            {alerts.length === 0 && (
              <div style={{ background:C.surf, borderRadius:12, border:`1px solid ${C.green}44`, padding:22, textAlign:"center" }}>
                <div style={{ fontSize:28, marginBottom:6 }}>✅</div>
                <div style={{ fontWeight:700, color:C.green }}>Alles ziet er goed uit!</div>
                <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>Geen overschrijdingen of aandachtspunten.</div>
              </div>
            )}
            {alerts.map(a => {
              const col = a.level==="rood"?C.red:a.level==="oranje"?C.yellow:a.level==="groen"?C.green:C.muted;
              const voorstel = a.level==="rood" ? `Bekijk je ${a.title.split(":")[1]?.trim()||""} uitgaven en kijk wat je kunt verminderen.`
                : a.level==="oranje" && a.id.startsWith("warn-") ? `Je zit op meer dan 80%. Let op de komende uitgaven.`
                : a.level==="oranje" && a.id.startsWith("rise-") ? `Controleer of dit een eenmalige piek is of een trend.`
                : a.level==="oranje" && a.id.startsWith("goal-") ? `Overweeg de bijdrage te verhogen of de deadline te verschuiven.`
                : null;
              return (
                <div key={a.id} style={{ background:C.surf, borderRadius:12, border:`1px solid ${col}44`, padding:14 }}>
                  <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{a.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:C.text, marginBottom:2 }}>{a.title}</div>
                      <div style={{ fontSize:12, color:C.muted, marginBottom: voorstel?8:0 }}>{a.body}</div>
                      {voorstel && (
                        <div style={{ background:`${col}15`, borderRadius:7, padding:"6px 10px", fontSize:12, color:col }}>
                          💡 {voorstel}
                        </div>
                      )}
                    </div>
                    {a.tab && (
                      <button style={{ background:`${col}22`, color:col, border:`1px solid ${col}44`,
                        borderRadius:7, padding:"4px 9px", cursor:"pointer", fontSize:11, fontWeight:700, flexShrink:0 }}
                        onClick={() => setTab(a.tab)}>
                        Bekijk →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {recurring.size > 0 && (
              <div style={{ background:C.surf, borderRadius:12, border:`1px solid ${C.border}`, padding:14, marginTop:4 }}>
                <h3 style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.text }}>↻ Terugkerende uitgaven</h3>
                <p style={{ margin:"0 0 10px", fontSize:11, color:C.muted }}>Automatisch herkend — 3+ maanden achter elkaar</p>
                {[...recurring].slice(0,8).map(k => {
                  const [name, account, category] = k.split("|");
                  const last = expenses.filter(e=>e.name===name&&e.account===account).sort((a,b)=>b.month.localeCompare(a.month))[0];
                  return last ? (
                    <div key={k} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderTop:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:13 }}>{CAT_ICON[category]||"📦"}</span>
                      <span style={{ flex:1, fontSize:12, color:C.text }}>{name}</span>
                      <AccountBadge accountId={account} names={names} C={C} small/>
                      <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{euro(last.amount)}/mnd</span>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>
        )}

        {/* Note editor overlay */}
        {editNote && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={()=>setEditNote(null)}>
            <div style={{ background:C.surf, borderRadius:14, border:`1px solid ${C.border}`, padding:22, width:"100%", maxWidth:380 }} onClick={e=>e.stopPropagation()}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <h3 style={{ margin:0, fontSize:15 }}>📝 Notitie</h3>
                <button onClick={()=>setEditNote(null)} aria-label="Sluiten"
                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, lineHeight:1, color:C.muted, padding:4 }}>×</button>
              </div>
              <textarea value={editNote.note} onChange={e=>setEditNote(n=>({...n,note:e.target.value}))}
                style={{ ...S.inp, height:80, resize:"vertical" }} placeholder="Voeg een notitie toe…"/>
              <div style={{ display:"flex", gap:8, marginTop:10 }}>
                <button style={{ ...S.btn(C.green), flex:1 }} onClick={()=>updateNote(editNote.id,editNote.note)}>Opslaan</button>
                <button style={S.btn(C.dim, C.text)} onClick={()=>setEditNote(null)}>Annuleer</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ DASHBOARD ══ */}
        {tab === "dashboard" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

            {/* 6-maanden trend grafiek */}
            {(() => {
              const maanden = Array.from({length:6}, (_,i) => {
                const d = new Date(_now.getFullYear(), _now.getMonth() - i, 1);
                return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
              }).reverse();
              const trendData = maanden.map(m => ({
                label: fmtM(m),
                totaal: expenses.filter(e => e.month === m).reduce((s,e) => s+e.amount, 0),
                inkomen: incomes.p1 + incomes.p2,
              }));
              const maxVal = Math.max(...trendData.map(d => d.totaal), incomes.p1+incomes.p2, 1);
              return (
                <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:C.text }}>📈 Uitgaven afgelopen 6 maanden</h3>
                    <span style={{ fontSize:11, color:C.muted }}>— inkomen</span>
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.dim}/>
                      <XAxis dataKey="label" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`}/>
                      <Tooltip contentStyle={{background:C.card,border:"none",borderRadius:8,color:C.text,fontSize:11}} formatter={(v,n)=>[`€${v}`,n==="totaal"?"Uitgaven":"Inkomen"]}/>
                      <ReferenceLine y={incomes.p1+incomes.p2} stroke={C.green} strokeDasharray="4 2" strokeWidth={1.5}/>
                      <Line type="monotone" dataKey="totaal" stroke={C.accent} strokeWidth={2.5} dot={{r:4,fill:C.accent,stroke:C.bg,strokeWidth:2}}/>
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ display:"flex", gap:16, marginTop:6, fontSize:11, color:C.muted, justifyContent:"center" }}>
                    <span><span style={{display:"inline-block",width:12,height:3,borderRadius:2,background:C.accent,marginRight:5,verticalAlign:"middle"}}/>Uitgaven</span>
                    <span><span style={{display:"inline-block",width:12,height:2,borderBottom:`2px dashed ${C.green}`,marginRight:5,verticalAlign:"middle"}}/>Inkomen</span>
                  </div>
                </div>
              );
            })()}

            {/* Jaaroverzicht: 12-maanden staafgrafiek */}
            {(() => {
              const jaarMaanden = Array.from({length:12}, (_,i) => {
                const d = new Date(_now.getFullYear(), _now.getMonth() - 11 + i, 1);
                return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
              });
              const jaarData = jaarMaanden.map(m => ({
                label: fmtM(m),
                totaal: expenses.filter(e => e.month === m).reduce((s,e) => s+e.amount, 0),
              }));
              const jaarTotaal = jaarData.reduce((s,d) => s+d.totaal, 0);
              const gemiddeld = jaarTotaal / jaarData.length;
              return (
                <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:C.text }}>📊 Jaaroverzicht (laatste 12 maanden)</h3>
                    <span style={{ fontSize:11, color:C.muted }}>gem. {euro(gemiddeld)}/maand</span>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={jaarData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke={C.dim}/>
                      <XAxis dataKey="label" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`}/>
                      <Tooltip contentStyle={{background:C.card,border:"none",borderRadius:8,color:C.text,fontSize:11}} formatter={(v)=>[`€${v}`,"Uitgaven"]}/>
                      <ReferenceLine y={gemiddeld} stroke={C.green} strokeDasharray="4 2" strokeWidth={1.5}/>
                      <Bar dataKey="totaal" fill={C.accent} radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:11, color:C.muted }}>
                    <span>Totaal 12 maanden: <strong style={{color:C.text}}>{euro(jaarTotaal)}</strong></span>
                    <span><span style={{display:"inline-block",width:12,height:2,borderBottom:`2px dashed ${C.green}`,marginRight:5,verticalAlign:"middle"}}/>Gemiddelde</span>
                  </div>
                </div>
              );
            })()}

            {/* Rekening-kaarten */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:10 }}>
              {[{id:"p1",label:`👤 ${names.p1}`,income:incomes.p1,bijdrage:incomes.bijdrage_p1||0},
                {id:"p2",label:`👤 ${names.p2}`,income:incomes.p2,bijdrage:incomes.bijdrage_p2||0},
                {id:"gezamenlijk",label:"🏦 Gezamenlijk",income:gezBudget,bijdrage:0}].map(acc => {
                const spent  = totalByAccount[acc.id]||0;
                const bal    = balances[acc.id];
                const pct    = acc.income>0 ? Math.min(100,Math.round(spent/acc.income*100)) : 0;
                const isGez  = acc.id==="gezamenlijk";
                return (
                  <div key={acc.id} style={{ background:C.surf, borderRadius:13, border:`2px solid ${ACC_COL[acc.id]}44`, padding:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                      <span style={{ fontWeight:700, fontSize:13, color:C.text }}>{acc.label}</span>
                      <AccountBadge accountId={acc.id} names={names} C={C} small/>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:8 }}>
                      <div>
                        <div style={{ fontSize:10, color:C.muted }}>{isGez?"Budget":"Inkomen"}</div>
                        <div style={{ fontWeight:700, fontSize:14, color:C.text }}>{euro(acc.income)}</div>
                        {!isGez && acc.bijdrage>0 && <div style={{ fontSize:9, color:C.muted }}>-{euro(acc.bijdrage)} bijdrage</div>}
                      </div>
                      <div>
                        <div style={{ fontSize:10, color:C.muted }}>Uitgaven</div>
                        <div style={{ fontWeight:700, fontSize:14, color:C.red }}>{euro(spent)}</div>
                      </div>
                    </div>
                    <div style={{ background:C.card, borderRadius:7, padding:"7px 10px", display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                      <span style={{ fontSize:11, color:C.muted }}>Saldo</span>
                      <span style={{ fontWeight:800, fontSize:16, color:bal>=0?C.green:C.red }}>{euro(bal)}</span>
                    </div>
                    <div style={{ background:C.card, borderRadius:3, height:5 }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:bal<0?C.red:ACC_COL[acc.id], borderRadius:3, transition:"width .4s" }}/>
                    </div>
                    {isGez && <BijstortKnop bijst={bijst} setBijst={setBijst} names={names} C={C} S={S}/>}
                  </div>
                );
              })}
            </div>

            {/* Vaste lasten */}
            {(() => {
              const vast = expenses.filter(e => e.fixed && e.month === selectedMonth);
              const vastTot = vast.reduce((s,e) => s+e.amount, 0);
              const variabel = (incomes.p1+incomes.p2) - vastTot - (incomes.bijdrage_p1||0) - (incomes.bijdrage_p2||0);
              return (
                <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:C.text }}>📌 Vaste lasten {fmtM(selectedMonth)}</h3>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontWeight:800, fontSize:15, color:C.red }}>{euro(vastTot)}</div>
                      <div style={{ fontSize:10, color:C.muted }}>Vrij te besteden: <strong style={{ color:C.green }}>{euro(Math.max(0,variabel))}</strong></div>
                    </div>
                  </div>
                  {vast.map(e => (
                    <div key={e.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderTop:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:13 }}>{CAT_ICON[e.category]||"📦"}</span>
                      <span style={{ flex:1, fontSize:12, color:C.text }}>{e.name}</span>
                      <AccountBadge accountId={e.account} names={names} C={C} small/>
                      <span style={{ fontWeight:700, fontSize:13, color:C.text }}>{euro(e.amount)}</span>
                    </div>
                  ))}
                  {vast.length === 0 && <div style={{ fontSize:12, color:C.muted, textAlign:"center", padding:8 }}>Nog geen vaste lasten — vink "Vaste last" aan bij een uitgave</div>}
                </div>
              );
            })()}

            {/* Wat vereist actie */}
            {alerts.filter(a => a.level==="rood"||a.level==="oranje").length > 0 && (
              <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
                  <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:C.text }}>⚠️ Vereist aandacht</h3>
                  <button style={{ ...S.btn(C.dim, C.muted), fontSize:11, padding:"4px 9px" }} onClick={()=>setTab("meldingen")}>Alle meldingen →</button>
                </div>
                {alerts.filter(a=>a.level==="rood"||a.level==="oranje").slice(0,3).map(a => {
                  const col = a.level==="rood"?C.red:C.yellow;
                  return (
                    <div key={a.id} style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 0", borderTop:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:16 }}>{a.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{a.title}</div>
                        <div style={{ fontSize:11, color:C.muted }}>{a.body}</div>
                      </div>
                      {a.tab && <button style={{ background:`${col}22`, color:col, border:`1px solid ${col}44`, borderRadius:7, padding:"3px 8px", cursor:"pointer", fontSize:11, fontWeight:700 }} onClick={()=>setTab(a.tab)}>Fix →</button>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Budget overzicht */}
            <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:C.text }}>🎯 Budgetten {fmtM(selectedMonth)}</h3>
                <button style={{ ...S.btn(C.accent), fontSize:11, padding:"4px 9px" }} onClick={()=>setTab("budgetten")}>Beheer →</button>
              </div>
              {budgetsWithSpent.filter(b=>b.period==="maand").length === 0
                ? <div style={{ fontSize:12, color:C.muted, textAlign:"center", padding:8 }}>Geen maandbudgetten ingesteld</div>
                : budgetsWithSpent.filter(b=>b.period==="maand").map(b => {
                    const pct=b.amount>0?Math.min(100,Math.round(b.spent/b.amount*100)):0;
                    const col=b.spent>b.amount?C.red:pct>80?C.yellow:C.green;
                    return (
                      <div key={b.id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
                        <span style={{ fontSize:13 }}>{CAT_ICON[b.category]||"📦"}</span>
                        <span style={{ width:90, fontSize:12, fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.category}</span>
                        <div style={{ flex:1, background:C.card, borderRadius:3, height:7 }}>
                          <div style={{ height:"100%", width:`${pct}%`, background:col, borderRadius:3, transition:"width .4s" }}/>
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, color:col, width:32, textAlign:"right" }}>{pct}%</span>
                        <span style={{ fontSize:11, color:C.muted, width:88, textAlign:"right" }}>{euro(b.spent)}/{euro(b.amount)}</span>
                      </div>
                    );
                  })}
            </div>

            {/* Spaardoelen */}
            {(savingsGoals||[]).length > 0 && (
              <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:C.text }}>💰 Spaardoelen</h3>
                  <button style={{ ...S.btn(C.dim, C.muted), fontSize:11, padding:"4px 9px" }} onClick={()=>setTab("doelen")}>Alle →</button>
                </div>
                {(savingsGoals||[]).slice(0,3).map(g => {
                  const pct = g.target>0?Math.min(100,Math.round(g.current/g.target*100)):0;
                  return (
                    <div key={g.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                      <span style={{ fontSize:20 }}>{g.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontSize:12, fontWeight:600, color:C.text }}>{g.name}</span>
                          <span style={{ fontSize:12, color:C.muted }}>{euro(g.current)} / {euro(g.target)}</span>
                        </div>
                        <div style={{ background:C.card, borderRadius:3, height:6 }}>
                          <div style={{ height:"100%", width:`${pct}%`, background:pct>=100?C.green:C.accent, borderRadius:3, transition:"width .5s" }}/>
                        </div>
                      </div>
                      <span style={{ fontSize:12, fontWeight:700, color:pct>=100?C.green:C.accent }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            UITGAVEN
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "uitgaven" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

            <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
              <button style={accBtn("alle")} onClick={()=>setActiveAcc("alle")}>Alle</button>
              {accountOptions.map(a => <button key={a.id} style={accBtn(a.id)} onClick={()=>setActiveAcc(a.id)}>{a.label}</button>)}
              <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                {accountOptions.map(a => (
                  <div key={a.id} style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ fontSize:11, color:ACC_COL[a.id] }}>{a.id==="gezamenlijk"?"Gem.":a.label} €</span>
                    <input type="number" min="0" value={incomes[a.id]}
                      onChange={e=>setIncomes(p=>({...p,[a.id]:Math.max(0,+e.target.value)}))}
                      style={{ width:80, background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 8px", color:C.text, fontSize:12 }}/>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background:C.surf, borderRadius:11, border:`1px solid ${C.border}`, padding:13 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:9 }}>+ Nieuwe uitgave</div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr auto", gap:7, alignItems:"end" }}>
                <div><Label C={C}>Naam</Label><input style={S.inp} placeholder="Omschrijving" value={expForm.name} onChange={e=>setExpForm(p=>({...p,name:e.target.value}))}/></div>
                <div><Label C={C}>€</Label><input style={S.inp} type="number" min="0" step="0.01" placeholder="0.00" value={expForm.amount} onChange={e=>setExpForm(p=>({...p,amount:e.target.value}))}/></div>
                <div><Label C={C}>Categorie</Label><select style={S.inp} value={expForm.category} onChange={e=>setExpForm(p=>({...p,category:e.target.value}))}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
                    {NAAM_SUGGESTIES[expForm.category] && (
                      <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginTop:4 }}>
                        {NAAM_SUGGESTIES[expForm.category].map(s => (
                          <button key={s} onClick={()=>setExpForm(p=>({...p,name:s}))}
                            style={{ background:expForm.name===s?`${CAT_COL[expForm.category]||C.accent}33`:C.card, border:`1px solid ${expForm.name===s?CAT_COL[expForm.category]||C.accent:C.border}`, borderRadius:20, padding:"2px 9px", fontSize:10, cursor:"pointer", color:expForm.name===s?CAT_COL[expForm.category]||C.accent:C.muted, fontWeight:expForm.name===s?700:400, whiteSpace:"nowrap" }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                <div><Label C={C}>Rekening</Label><select style={S.inp} value={expForm.account} onChange={e=>setExpForm(p=>({...p,account:e.target.value}))}>{accountOptions.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
                <div><Label C={C}>Maand</Label><input style={S.inp} type="month" value={expForm.month} onChange={e=>setExpForm(p=>({...p,month:e.target.value}))}/></div>
                <button style={S.btn()} onClick={addExpense}>+</button>
              </div>
              <input style={{...S.inp, marginTop:8, fontSize:13}} placeholder="📝 Notitie (optioneel)" value={expForm.note||""} onChange={e=>setExpForm(p=>({...p,note:e.target.value}))}/>
              <div style={{ marginTop:7, display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
                <label style={{ fontSize:12, color:C.muted, display:"flex", alignItems:"center", gap:5, cursor:"pointer" }}>
                  <input type="checkbox" checked={expForm.fixed} onChange={e=>setExpForm(p=>({...p,fixed:e.target.checked}))}/> Vaste last
                </label>
                <label style={{ fontSize:12, color:C.muted, display:"flex", alignItems:"center", gap:5, cursor:"pointer" }}>
                  <input type="checkbox" checked={expForm.recurring||false} onChange={e=>setExpForm(p=>({...p,recurring:e.target.checked}))}/> Elke maand herhalen 🔁
                </label>
              </div>
            </div>

            {accountOptions.map(acc => {
              const ae = filteredExpenses.filter(e => e.account === acc.id);
              if (!ae.length) return null;
              return (
                <div key={acc.id} style={{ background:C.surf, borderRadius:11, border:`2px solid ${ACC_COL[acc.id]}33`, overflow:"hidden" }}>
                  <div style={{ background:C.card, padding:"9px 14px", display:"flex", justifyContent:"space-between" }}>
                    <AccountBadge accountId={acc.id} names={names} C={C}/>
                    <span style={{ fontWeight:700, fontSize:13 }}>{euro(ae.reduce((s,e)=>s+e.amount,0))}</span>
                  </div>
                  {ae.map(e => (
                    <div key={e.id} style={{ padding:"8px 14px", display:"flex", alignItems:"flex-start", gap:8, borderTop:`1px solid ${C.border}` }}>
                      <span style={{ width:9, height:9, borderRadius:"50%", background:CAT_COL[e.category]||C.muted, flexShrink:0, marginTop:4 }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <span style={{ fontSize:13 }}>{e.name}</span>
                        {e.note && <div style={{ fontSize:11, color:C.muted, fontStyle:"italic", marginTop:2 }}>📝 {e.note}</div>}
                      </div>
                      <span style={{ fontSize:11, color:C.muted }}>{e.category}</span>
                      <span style={{ fontSize:11, color:C.muted }}>{fmtM(e.month)}</span>
                      {e.fixed     && <span style={{ fontSize:10, background:`${C.accent}22`, color:C.accent, padding:"1px 6px", borderRadius:8 }}>vast</span>}
                      {e.recurring && <span style={{ fontSize:10, background:`${C.purple}22`, color:C.purple, padding:"1px 6px", borderRadius:8 }}>🔁</span>}
                      {e.fromBank  && <span style={{ fontSize:10, background:`${C.green}22`,  color:C.green,  padding:"1px 6px", borderRadius:8 }}>bank</span>}
                      <WieBadge persoon={e.addedBy} tijdstip={e.addedAt} />
                      <span style={{ fontWeight:700, fontSize:13 }}>{euro(e.amount)}</span>
                      <button onClick={()=>delExpense(e.id)} style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:13 }}>×</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            BANK IMPORT
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "bank" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ background:"#0D1F35", border:`1px solid ${C.accent}44`, borderRadius:13, padding:20 }}>
              <div style={{ display:"flex", gap:12, marginBottom:14 }}>
                <span style={{ fontSize:26 }}>🏦</span>
                <div>
                  <h2 style={{ margin:0, fontSize:16, fontWeight:800 }}>Rabobank CSV-import</h2>
                  <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>Automatisch gecategoriseerd op basis van tekstherkenning · koppel IBAN aan rekening</p>
                </div>
              </div>

              {Object.keys(ibanMap).length > 0 && (
                <div style={{ background:C.card, borderRadius:10, padding:11, marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:7 }}>🔗 IBAN-koppeling (onthouden)</div>
                  {Object.entries(ibanMap).map(([iban, accId]) => (
                    <div key={iban} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                      <span style={{ fontSize:11, color:C.text, fontFamily:"monospace" }}>{iban}</span>
                      <span style={{ color:C.muted, fontSize:11 }}>→</span>
                      <select value={accId} onChange={e=>setIbanMap(p=>({...p,[iban]:e.target.value}))}
                        style={{ ...S.inp, width:"auto", fontSize:11, padding:"3px 7px" }}>
                        {accountOptions.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
                      </select>
                      <button onClick={()=>setIbanMap(p=>{const n={...p};delete n[iban];return n;})}
                        style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:12 }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background:C.card, borderRadius:10, padding:11, marginBottom:12, fontSize:11, color:C.muted, lineHeight:1.6 }}>
                📋 rabo.nl → Rekeningen → <strong style={{ color:C.text }}>Download → CSV</strong> → kies periode
              </div>

              <div style={{ border:`2px dashed ${csvImport ? C.green : C.border}`, borderRadius:12, padding:22, textAlign:"center", cursor:"pointer" }}
                onClick={()=>csvRef.current?.click()}
                onDrop={e=>{e.preventDefault();handleCSV(e.dataTransfer.files[0]);}}
                onDragOver={e=>e.preventDefault()}>
                <input ref={csvRef} type="file" accept=".csv" style={{ display:"none" }} onChange={e=>handleCSV(e.target.files[0])}/>
                {csvImport
                  ? <div><div style={{ fontSize:26, marginBottom:4 }}>✅</div><div style={{ color:C.green, fontWeight:700 }}>{csvImport.length} transacties ingelezen</div></div>
                  : <div><div style={{ fontSize:26, marginBottom:4 }}>📂</div><div style={{ fontWeight:700 }}>Sleep CSV of klik</div><div style={{ color:C.muted, fontSize:11, marginTop:2 }}>Rabobank .csv</div></div>}
              </div>

              {csvError && <div style={{ marginTop:8, background:`${C.red}15`, border:`1px solid ${C.red}44`, borderRadius:8, padding:"7px 12px", color:C.red, fontSize:12 }}>⚠️ {csvError}</div>}
            </div>

            {csvImport?.length > 0 && (
              <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                <div style={{ padding:"11px 16px", background:C.card, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                  <div>
                    <span style={{ fontWeight:700, fontSize:13 }}>{csvImport.length} transacties</span>
                    <span style={{ color:C.muted, fontSize:11, marginLeft:8 }}>· {euro(csvImport.reduce((s,r)=>s+r.amount,0))} totaal</span>
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    <button style={S.btn(`${C.red}88`, C.text)} onClick={()=>{setCsvImport(null);}}>Annuleer</button>
                    <button style={S.btn(C.green)} onClick={()=>confirmCSV(csvImport)}>✅ Importeer ({csvImport.length})</button>
                  </div>
                </div>
                <div style={{ maxHeight:400, overflowY:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <thead style={{ position:"sticky", top:0, background:C.card }}>
                      <tr>{["Omschrijving","Maand","Bedrag","Categorie","Rekening",""].map(h=><th key={h} style={{ padding:"7px 12px", textAlign:"left", color:C.muted, fontWeight:600, fontSize:11, borderBottom:`1px solid ${C.border}` }}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {csvImport.map((row,i) => (
                        <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                          <td style={{ padding:"6px 12px", maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{row.name}</td>
                          <td style={{ padding:"6px 12px", color:C.muted }}>{fmtM(row.month)}</td>
                          <td style={{ padding:"6px 12px", fontWeight:700, color:C.red }}>-{euro(row.amount)}</td>
                          <td style={{ padding:"6px 12px" }}>
                            <select value={row.category} onChange={e=>{const r=[...csvImport];r[i]={...r[i],category:e.target.value};setCsvImport(r);}}
                              style={{ background:C.card, border:`1px solid ${CAT_COL[row.category]||C.border}`, borderRadius:6, padding:"3px 7px", color:C.text, fontSize:11 }}>
                              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                            </select>
                          </td>
                          <td style={{ padding:"6px 12px" }}>
                            <select value={row.account} onChange={e=>{const r=[...csvImport];r[i]={...r[i],account:e.target.value};setCsvImport(r);}}
                              style={{ background:C.card, border:`1px solid ${ACC_COL[row.account]||C.border}`, borderRadius:6, padding:"3px 7px", color:C.text, fontSize:11 }}>
                              {accountOptions.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

        {/* ══ MAANDAFSLUITING ══ */}
        {tab === "afsluiting" && (() => {
          const totaalUit  = Object.values(totalByAccount).reduce((s,v)=>s+v,0);
          const totaalIn   = (incomes.p1||0)+(incomes.p2||0);
          const gespaard   = totaalIn - totaalUit - (incomes.bijdrage_p1||0) - (incomes.bijdrage_p2||0);
          const spaarquote = totaalIn > 0 ? Math.round((gespaard/totaalIn)*100) : 0;
          const topUit     = [...byCat].sort((a,b)=>b.value-a.value).slice(0,3);
          const overschr   = budgetsWithSpent.filter(b=>b.period==="maand"&&b.spent>b.amount);
          const onderbenut = budgetsWithSpent.filter(b=>b.period==="maand"&&b.spent<b.amount*0.5&&b.spent>0);
          return (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <h2 style={{ margin:0, fontSize:15, fontWeight:800, color:C.text }}>📅 Maandafsluiting {fmtM(selectedMonth)}</h2>
                <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>Hoe was deze maand?</p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                {[{l:"Inkomen",v:euro(totaalIn),c:C.text,i:"💰"},{l:"Uitgaven",v:euro(totaalUit),c:C.red,i:"💸"},{l:"Spaarquote",v:`${spaarquote}%`,c:spaarquote>=20?C.green:spaarquote>=10?C.yellow:C.red,i:"🐷"}].map(({l,v,c,i})=>(
                  <div key={l} style={{ background:C.surf, borderRadius:12, border:`1px solid ${C.border}`, padding:14, textAlign:"center" }}>
                    <div style={{ fontSize:22, marginBottom:4 }}>{i}</div>
                    <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>{l}</div>
                    <div style={{ fontWeight:800, fontSize:18, color:c }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:spaarquote>=20?`${C.green}15`:spaarquote>=10?`${C.yellow}15`:`${C.red}15`, border:`1px solid ${spaarquote>=20?C.green:spaarquote>=10?C.yellow:C.red}44`, borderRadius:12, padding:16, textAlign:"center" }}>
                <div style={{ fontSize:28, marginBottom:6 }}>{spaarquote>=20?"🎉":spaarquote>=10?"👍":"📉"}</div>
                <div style={{ fontWeight:700, fontSize:15, color:C.text, marginBottom:4 }}>
                  {spaarquote>=20?"Geweldige maand!":spaarquote>=10?"Redelijke maand":gespaard<0?"Meer uitgegeven dan binnengekomen":"Krappe maand"}
                </div>
                <div style={{ fontSize:12, color:C.muted }}>
                  {spaarquote>=20?`Jullie hebben ${euro(Math.max(0,gespaard))} overgehouden — meer dan 20% gespaard!`
                    :gespaard<0?`Jullie hebben ${euro(Math.abs(gespaard))} meer uitgegeven dan binnengekomen.`
                    :`Jullie hebben ${euro(Math.max(0,gespaard))} overgehouden. Nog ruimte voor verbetering.`}
                </div>
              </div>
              <div style={{ background:C.surf, borderRadius:12, border:`1px solid ${C.border}`, padding:14 }}>
                <h3 style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.text }}>🏆 Top 3 uitgaven</h3>
                {topUit.map((cat,i)=>(
                  <div key={cat.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderTop:i>0?`1px solid ${C.border}`:"none" }}>
                    <span style={{ fontSize:20 }}>{["🥇","🥈","🥉"][i]}</span>
                    <span style={{ fontSize:14 }}>{CAT_ICON[cat.name]||"📦"}</span>
                    <span style={{ flex:1, fontSize:13, fontWeight:600, color:C.text }}>{cat.name}</span>
                    <span style={{ fontWeight:800, fontSize:15, color:CAT_COL[cat.name]||C.accent }}>{euro(cat.value)}</span>
                  </div>
                ))}
              </div>
              {overschr.length > 0 && (
                <div style={{ background:C.surf, borderRadius:12, border:`1px solid ${C.red}44`, padding:14 }}>
                  <h3 style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.red }}>🚨 Budgetten overschreden</h3>
                  {overschr.map(b=>(
                    <div key={b.id} style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 0", borderTop:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:13 }}>{CAT_ICON[b.category]||"📦"}</span>
                      <span style={{ flex:1, fontSize:12, color:C.text }}>{b.category}</span>
                      <span style={{ fontSize:12, color:C.red, fontWeight:700 }}>+{euro(b.spent-b.amount)} over</span>
                    </div>
                  ))}
                  <div style={{ marginTop:8, background:`${C.red}15`, borderRadius:8, padding:"8px 12px", fontSize:12, color:C.red }}>💡 Overweeg de budgetten aan te passen of bewuster te zijn in deze categorieën.</div>
                </div>
              )}
              {onderbenut.length > 0 && (
                <div style={{ background:C.surf, borderRadius:12, border:`1px solid ${C.green}44`, padding:14 }}>
                  <h3 style={{ margin:"0 0 6px", fontSize:13, fontWeight:700, color:C.green }}>✅ Ruim binnen budget</h3>
                  <p style={{ margin:"0 0 8px", fontSize:11, color:C.muted }}>Minder dan 50% besteed — misschien budget verlagen?</p>
                  {onderbenut.map(b=>(
                    <div key={b.id} style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 0", borderTop:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:13 }}>{CAT_ICON[b.category]||"📦"}</span>
                      <span style={{ flex:1, fontSize:12, color:C.text }}>{b.category}</span>
                      <span style={{ fontSize:12, color:C.green }}>{euro(b.spent)} van {euro(b.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

      {/* ── Snelle invoer floating button ── */}
      <button onClick={() => setQuickAdd(true)}
        style={{ position:"fixed", bottom:88, right:20, width:52, height:52, borderRadius:16,
          background:`linear-gradient(135deg,${C.accent},${C.purple})`, border:"none",
          fontSize:28, cursor:"pointer", boxShadow:"0 4px 24px rgba(0,0,0,.4)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, color:C.bg, fontWeight:300 }}>
        +
      </button>

      {/* ── Snelle invoer modal ── */}
      {quickAdd && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.65)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={() => setQuickAdd(false)}>
          <div style={{ background:C.surf, borderRadius:"16px 16px 0 0", border:`1px solid ${C.border}`, padding:"20px 20px 36px", width:"100%", maxWidth:560 }} onClick={e => e.stopPropagation()}>
            <div style={{ width:36, height:4, background:C.dim, borderRadius:2, margin:"0 auto 16px" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:C.text }}>⚡ Snelle invoer</h3>
              <button onClick={() => setQuickAdd(false)} aria-label="Sluiten"
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, lineHeight:1, color:C.muted, padding:4 }}>×</button>
            </div>
            <div style={{ textAlign:"center", marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                <span style={{ fontSize:32, fontWeight:300, color:C.muted }}>€</span>
                <input autoFocus type="number" min="0" step="0.01" value={expForm.amount}
                  onChange={e => setExpForm(p=>({...p,amount:e.target.value}))} placeholder="0"
                  style={{ fontSize:52, fontWeight:800, color:C.text, background:"none", border:"none", outline:"none", width:190, textAlign:"center", caretColor:C.accent }}/>
              </div>
            </div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10, justifyContent:"center" }}>
              {CATEGORIES.map(cat=>(
                <button key={cat} onClick={()=>setExpForm(p=>({...p,category:cat,name:""}))}
                  style={{ background:expForm.category===cat?`${CAT_COL[cat]||C.accent}33`:C.card, border:`1px solid ${expForm.category===cat?CAT_COL[cat]||C.accent:C.border}`, borderRadius:20, padding:"5px 12px", fontSize:12, cursor:"pointer", color:expForm.category===cat?CAT_COL[cat]||C.accent:C.muted, fontWeight:expForm.category===cat?700:400 }}>
                  {CAT_ICON[cat]} {cat}
                </button>
              ))}
            </div>
            {NAAM_SUGGESTIES[expForm.category] && (
              <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:10, justifyContent:"center" }}>
                {NAAM_SUGGESTIES[expForm.category].map(s=>(
                  <button key={s} onClick={()=>setExpForm(p=>({...p,name:s}))}
                    style={{ background:expForm.name===s?`${CAT_COL[expForm.category]||C.accent}22`:C.card, border:`1px solid ${expForm.name===s?CAT_COL[expForm.category]||C.accent:C.border}`, borderRadius:20, padding:"3px 10px", fontSize:11, cursor:"pointer", color:expForm.name===s?CAT_COL[expForm.category]||C.accent:C.muted }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {!expForm.name && <input style={{ ...S.inp, marginBottom:10, textAlign:"center" }} placeholder="Omschrijving (optioneel)" value={expForm.name} onChange={e=>setExpForm(p=>({...p,name:e.target.value}))}/>}
            <div style={{ display:"flex", gap:6, justifyContent:"center", marginBottom:14 }}>
              {accountOptions.map(a=>(
                <button key={a.id} onClick={()=>setExpForm(p=>({...p,account:a.id}))}
                  style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${expForm.account===a.id?ACC_COL[a.id]:C.border}`, cursor:"pointer", fontWeight:600, fontSize:12, background:expForm.account===a.id?`${ACC_COL[a.id]}22`:"transparent", color:expForm.account===a.id?ACC_COL[a.id]:C.muted }}>
                  {a.label}
                </button>
              ))}
            </div>
            <button style={{ ...S.btn(), width:"100%", padding:"13px", fontSize:15 }}
              onClick={() => { if(!expForm.amount) return; addExpense(); setQuickAdd(false); }}>
              Toevoegen
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Label helper ──────────────────────────────────────────────────────────────
function Label({ children, C }) {
  return <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>{children}</div>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BIJSTORT KNOP — inline op dashboard gezamenlijke kaart
// ═══════════════════════════════════════════════════════════════════════════════
function BijstortKnop({ bijst, setBijst, names, C, S }) {
  const [open,    setOpen]    = useState(false);
  const [bedrag,  setBedrag]  = useState("");
  const [door,    setDoor]    = useState("p1");

  const dezeMaand = (bijst||[]).filter(b => b.datum?.startsWith(selectedMonth));
  const totaal    = dezeMaand.reduce((s,b) => s+b.bedrag, 0);

  function stort() {
    if (!bedrag || +bedrag <= 0) return;
    setBijst(prev => [...(prev||[]), {
      id: uid(), bedrag: +bedrag,
      datum: new Date().toISOString().slice(0,10),
      door,
    }]);
    setBedrag(""); setOpen(false);
  }

  return (
    <div style={{ marginTop:7 }}>
      {totaal > 0 && (
        <div style={{ fontSize:10, color:ACC_COL.gezamenlijk, marginBottom:5 }}>
          💰 Deze maand bijgestort: <strong>{euro(totaal)}</strong>
          {dezeMaand.map(b => (
            <span key={b.id} style={{ marginLeft:5, opacity:.7 }}>
              ({b.door==="p1"?names.p1:names.p2} {euro(b.bedrag)})
            </span>
          ))}
        </div>
      )}
      {open ? (
        <div style={{ display:"flex", gap:5, alignItems:"center", flexWrap:"wrap" }}>
          <input type="number" min="1" placeholder="Bedrag €" value={bedrag} onChange={e=>setBedrag(e.target.value)}
            style={{ ...S.inp, width:90 }} autoFocus/>
          <select value={door} onChange={e=>setDoor(e.target.value)}
            style={{ ...S.inp, width:"auto" }}>
            <option value="p1">{names.p1}</option>
            <option value="p2">{names.p2}</option>
          </select>
          <button style={S.btn(C.green)} onClick={stort}>Stort bij</button>
          <button style={S.btn(C.dim, C.text)} onClick={()=>{setOpen(false);setBedrag("");}}>✕</button>
        </div>
      ) : (
        <button style={{ ...S.btn(C.accent), fontSize:11, width:"100%", padding:"5px" }}
          onClick={()=>setOpen(true)}>
          + Bijstorten
        </button>
      )}
    </div>
  );
}
