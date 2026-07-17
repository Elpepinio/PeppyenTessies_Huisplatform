// ═══════════════════════════════════════════════════════════════════════════════
// Budget — huishoudbudget-tool, platform-versie (zonder AI-functies)
// ═══════════════════════════════════════════════════════════════════════════════
import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Cell, ReferenceLine, PieChart, Pie,
} from "recharts";

const THEMES = {
  dark:  { bg:"#0B0E15", surf:"#131720", card:"#1B2030", border:"#252C40", accent:"#00D4FF", green:"#00E096", red:"#FF4D6A", yellow:"#FFD166", purple:"#B57BFF", orange:"#FF8C42", text:"#E4E8F5", muted:"#6B7594", dim:"#3A4260" },
  light: { bg:"#F4F6FB", surf:"#FFFFFF", card:"#EEF1F8", border:"#D6DCF0", accent:"#0099CC", green:"#17A86A", red:"#D63353", yellow:"#CC8800", purple:"#7B52D9", orange:"#D4611A", text:"#1A1E2E", muted:"#6B7594", dim:"#C2C8DC" },
};

const ACC_COL  = { gezamenlijk:"#00D4FF", p1:"#B57BFF", p2:"#FF8C42" };
const CAT_ICON = { Wonen:"🏠", Boodschappen:"🛒", Transport:"🚗", Abonnementen:"📺", "Uit eten":"🍽️", Gezondheid:"💊", Kleding:"👗", Entertainment:"🎭", Vakantie:"✈️", Kinderen:"👶", Sparen:"💰", Verzekering:"🛡️", "Goede doelen":"❤️", Bankkosten:"🏛️", "Cadeaus":"🎁", Broodjes:"🥪", Stappen:"🍻", "Afschrijving creditcard":"💳", "Onderhoud huis":"🔧", "Inrichten huis":"🛋️", "Persoonlijke verzorging":"🧴", "Gezamenlijke rekening":"🏦", Overig:"📦" };
const CAT_COL  = {
  Wonen:"#6C63FF", Boodschappen:"#2ECC71", Transport:"#F39C12",
  Abonnementen:"#E74C3C", "Uit eten":"#1ABC9C", Gezondheid:"#E91E63",
  Kleding:"#FF9800", Entertainment:"#9C27B0", Vakantie:"#00BCD4",
  Kinderen:"#FF6B9D", Sparen:"#3F51B5", Verzekering:"#795548", "Goede doelen":"#D81B60",
  Bankkosten:"#546E7A", Cadeaus:"#EC407A", Broodjes:"#8D6E63", Stappen:"#7C4DFF",
  "Afschrijving creditcard":"#455A64", "Onderhoud huis":"#5D4037", "Inrichten huis":"#9575CD", "Persoonlijke verzorging":"#4DB6AC",
  "Gezamenlijke rekening":"#26A69A", Overig:"#607D8B",
};

const CATEGORIES = ["Wonen","Boodschappen","Transport","Abonnementen","Uit eten","Broodjes","Gezondheid","Persoonlijke verzorging","Kleding","Entertainment","Stappen","Vakantie","Kinderen","Sparen","Verzekering","Goede doelen","Cadeaus","Bankkosten","Afschrijving creditcard","Onderhoud huis","Inrichten huis","Gezamenlijke rekening","Overig"];
// ── Dynamische datum (altijd actueel) ────────────────────────────────────────
const _now       = new Date();
const NOW_MONTH  = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}`;
const NOW_YEAR   = _now.getFullYear();
const NOW_Q      = Math.ceil((_now.getMonth() + 1) / 3);

// ── Rabobank CSV parser ───────────────────────────────────────────────────────
function parseRabobankCSV(text, rekeningMap, categorieMap, bekendeIbans) {
  const firstLine = text.trim().split("\n")[0];
  const sep = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";

  const rows = text.trim().split("\n");
  const header = rows[0].split(sep).map(c => c.replace(/^"|"$/g,"").replace(/\r$/,"").trim().toLowerCase());

  // Rabobank heeft meerdere CSV-exportvarianten: de "oude", Nederlandstalige
  // (Datum/Bedrag/Naam tegenpartij/Omschrijving-1) en de nieuwere, Engelstalige
  // "CSV_A"-indeling (Date/Amount/Name Counterpty/Description-1). We proberen
  // de gegeven zoektermen op volgorde, zodat beide indelingen werken.
  const ci = (...names) => {
    for (const name of names) {
      const idx = header.findIndex(h => h.includes(name));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const iIBAN    = ci("iban") >= 0 ? ci("iban") : 0;
  const iTegenIban = ci("tegenrekening", "counterpty iban");
  const iDatum   = ci("datum", "date") >= 0 ? ci("datum", "date") : 4;
  const iBedrag  = ci("bedrag", "amount") >= 0 ? ci("bedrag", "amount") : 6;
  const iNaam    = ci("naam tegenpartij", "name counterpty", "naam") >= 0
    ? ci("naam tegenpartij", "name counterpty", "naam") : 1;
  const omschCols = header
    .map((h, i) => (h.includes("omschrijving") || h.includes("description")) ? i : -1)
    .filter(i => i >= 0);
  const iOmsch1  = omschCols[0] ?? 9;
  const iOmsch2  = omschCols[1] ?? 19;

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
    const tegenIban = iTegenIban >= 0 ? (cols[iTegenIban] || "") : "";
    const naam    = cols[iNaam] || "";
    const omsch   = [cols[iOmsch1], cols[iOmsch2] ?? ""].filter(Boolean).join(" – ").slice(0,100);
    const fullDesc = [naam, omsch].filter(Boolean).join(" · ").trim();

    const account = rekeningMap?.[iban] || "gezamenlijk";

    // Sleutel om "hetzelfde soort transactie" te herkennen — gebruikt om
    // categorieën te leren/hergebruiken. Alleen de naam van de tegenpartij is
    // niet genoeg: familie/bekenden maken vaak overschrijvingen met heel
    // verschillende doelen (bv. hypotheekrente vs. een cadeautje), dus de
    // omschrijving telt nadrukkelijk mee. Getallen/referenties/data worden
    // eruit gehaald omdat die toch elke keer net anders zijn.
    const normaliseer = s => s
      .toLowerCase()
      .replace(/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/g, "")   // datums
      .replace(/\d+/g, "")                              // losse getallen/referenties
      .replace(/\s+/g, " ")
      .trim();
    const categorieSleutel = [normaliseer(naam), normaliseer(omsch)].filter(Boolean).join(" · ").slice(0, 80)
      || fullDesc.toLowerCase().slice(0,40);

    // Een overschrijving náár een bekend rekeningnummer (bv. de gezamenlijke
    // rekening) is een betrouwbaarder signaal dan tekstherkenning — dat gaat
    // daarom vóór de geleerde/geraden categorie.
    const ibanCategorie = tegenIban && bekendeIbans?.[tegenIban.replace(/\s/g,"").toUpperCase()];
    const category = ibanCategorie || categorieMap?.[categorieSleutel] || guessCategory(fullDesc);

    // Vingerafdruk om dezelfde transactie later te herkennen als je een
    // overlappende periode opnieuw importeert (voorkomt dubbele boekingen).
    const bankRef = [iban, datum, cols[iBedrag], fullDesc].join("|");

    return [{
      id: uid(),
      name:     fullDesc.slice(0,80) || "Onbekend",
      amount:   Math.abs(amount),
      category,
      categorieSleutel,
      account,
      month,
      fixed:    false,
      fromBank: true,
      iban,
      tegenIban,
      rawDesc: fullDesc,
      bankRef,
    }];
  });
}

// Creditcard-afschriften verschillen sterk per kaartuitgever (ICS, Amex,
// bank-eigen creditcards...) — deze parser is daarom bewust flexibeler dan de
// Rabobank-parser: hij zoekt naar de meest gebruikelijke kolomnamen in
// meerdere talen/varianten, in plaats van één vast formaat te verwachten.
// Een creditcardafschrift heeft meestal geen eigen-IBAN-kolom (het is altijd
// dezelfde kaart), dus "account" wordt niet automatisch bepaald — dat kies je
// na het inlezen in één keer voor de hele import.
function parseCreditCardCSV(text, categorieMap) {
  const firstLine = text.trim().split("\n")[0];
  const sep = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const rows = text.trim().split("\n");
  const header = rows[0].split(sep).map(c => c.replace(/^"|"$/g,"").replace(/\r$/,"").trim().toLowerCase());

  const ci = (...names) => {
    for (const name of names) {
      const idx = header.findIndex(h => h.includes(name));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const iDatum  = ci("transactiedatum", "boekdatum", "datum", "transaction date", "date");
  const iBedrag = ci("transactiebedrag", "bedrag", "amount");
  const iOmsch  = ci("omschrijving", "transactieomschrijving", "specificatie", "vermelding", "description", "merchant", "naam");

  if (iDatum < 0 || iBedrag < 0) return []; // kon geen bruikbare kolommen vinden

  return rows.slice(1).flatMap(line => {
    if (!line.trim()) return [];
    const cols = [];
    let cur = "", inQ = false;
    for (const ch of line + sep) {
      if (ch === '"') inQ = !inQ;
      else if (ch === sep && !inQ) { cols.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    if (cols.length < 2) return [];

    const ruwDatum = (cols[iDatum] || "").replace(/^"|"$/g, "").trim();
    const ruwBedrag = (cols[iBedrag] || "").replace(/^"|"$/g, "").trim();
    const omsch = iOmsch >= 0 ? (cols[iOmsch] || "").replace(/^"|"$/g, "").trim().slice(0, 100) : "Onbekend";
    if (!ruwDatum || !ruwBedrag) return [];

    // Datum kan YYYY-MM-DD of DD-MM-YYYY zijn
    let jaar, maand;
    if (/^\d{4}/.test(ruwDatum)) {
      [jaar, maand] = ruwDatum.split(/[-/]/);
    } else {
      const delen = ruwDatum.split(/[-/]/);
      [, maand, jaar] = delen.length === 3 ? delen : [null, "01", "1970"];
    }
    if (jaar?.length === 2) jaar = "20" + jaar;
    const month = `${jaar}-${String(maand).padStart(2, "0")}`;

    const bedragSchoon = ruwBedrag.replace(/[^\d,.-]/g, "");
    const amount = Math.abs(parseFloat(bedragSchoon.includes(",") ? bedragSchoon.replace(/\./g,"").replace(",",".") : bedragSchoon));
    if (!amount || isNaN(amount)) return [];

    const normaliseer = s => s.toLowerCase().replace(/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/g, "").replace(/\d+/g, "").replace(/\s+/g, " ").trim();
    const categorieSleutel = normaliseer(omsch).slice(0, 80) || omsch.toLowerCase().slice(0, 40);
    const category = categorieMap?.[categorieSleutel] || guessCategory(omsch);

    const bankRef = ["creditcard", ruwDatum, ruwBedrag, omsch].join("|");

    return [{
      id: uid(),
      name: omsch.slice(0, 80) || "Onbekend",
      amount,
      category,
      categorieSleutel,
      account: "gezamenlijk",
      month,
      fixed: false,
      fromBank: true,
      bron: "creditcard",
      rawDesc: omsch,
      bankRef,
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
  if (/huur|hypotheek|energie|gas|elektra|water|nuon|vattenfall|eneco|essent|vitens|waternet|dunea|brabant water|evides|wml|oasen|pwn/.test(t)) return "Wonen";
  if (/ns |ov-chip|trein|bus|metro|shell|bp |esso|benzine|parkeer|uber|bolt/.test(t)) return "Transport";
  if (/netflix|spotify|disney|videoland|ziggo|kpn|t-mobile|vodafone/.test(t)) return "Abonnementen";
  if (/restaurant|cafe|café|mcdonalds|thuisbezorgd|deliveroo|dominos|pizza|sushi/.test(t)) return "Uit eten";
  if (/zara|h&m|primark|wehkamp|zalando|bol\.com|nike|adidas|uniqlo/.test(t)) return "Kleding";
  if (/verzeker|zorgverzekeraar|vgz|cz\b|zilveren kruis|achmea|ohra|centraal beheer|univé|interpolis|aegon|nationale.?nederlanden|ditzo|fbto|anwb|asr\b|allianz|inshared/.test(t)) return "Verzekering";
  if (/apotheek|huisarts|tandarts|ziekenhuis|gym|sportschool|yoga|decathlon/.test(t)) return "Gezondheid";
  if (/booking|airbnb|hotel|vliegticket|ryanair|transavia|corendon|sunweb|vakantie/.test(t)) return "Vakantie";
  if (/bioscoop|theater|concert|ticketmaster|efteling|pretpark/.test(t)) return "Entertainment";
  if (/sparen|spaarrekening|opbouwspaar|spaarpot|\bpeaks\b|derdengeld|beheer derden|vermogensbeheer|beleggingsrekening|effectenrekening/.test(t)) return "Sparen";
  if (/unicef|artsen zonder grenzen|rode kruis|greenpeace|wnf|wereld natuur fonds|kwf|hartstichting|leger des heils|oxfam novib|amnesty|natuurmonumenten|dierenbescherming|goede doel|donatie|stichting.*fonds|giro555|\bkika\b|kinderen kankervrij/.test(t)) return "Goede doelen";
  if (/afschrijvingskosten|bankkosten|betaalpas|kosten betaalrekening|jaarlijkse.*kosten|pakketkosten|totaalpakket/.test(t)) return "Bankkosten";
  if (/afschrijving.*creditcard|afschrijving ics|creditcardafschrijving|creditcardkosten|ics creditcard/.test(t)) return "Afschrijving creditcard";
  if (/loodgieter|aannemer|klusbedrijf|dakdekker|huisschilder|installateur|onderhoudsbedrijf|cv-ketel|ketelonderhoud|rioolontstopping/.test(t)) return "Onderhoud huis";
  if (/ikea|leen bakker|kwantum|woonwinkel|meubel|gordijnen|behang|woondecoratie|karwei|praxis|gamma|hornbach/.test(t)) return "Inrichten huis";
  if (/kapper|drogist|kruidvat|etos|parfumerie|schoonheidssalon|nagelstudio|kapsalon/.test(t)) return "Persoonlijke verzorging";
  if (/bakker|broodje|lunchroom|croissanterie|broodzaak|belegd broodje/.test(t)) return "Broodjes";
  if (/café|kroeg|nachtclub|bar\b|discotheek|borrel/.test(t)) return "Stappen";
  if (/cadeau|cadeaubon|geschenk|bloemen.*cadeau/.test(t)) return "Cadeaus";
  if (/inleg|naar gezamenlijk|gezamenlijke rekening|extra inleg/.test(t)) return "Gezamenlijke rekening";
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
  Verzekering:  ["Zorgverzekering","Inboedelverzekering","Aansprakelijkheidsverzekering (WA)","Autoverzekering","Reisverzekering","Rechtsbijstandverzekering"],
  Abonnementen: ["Netflix","Spotify","Disney+","Ziggo","KPN","T-Mobile","Videoland"],
  Broodjes:     ["Broodje bakker", "Lunchroom", "Lunch op werk"],
  Stappen:      ["Café", "Kroeg", "Uitgaan", "Borrel"],
  Cadeaus:      ["Verjaardagscadeau", "Cadeaubon", "Sinterklaas", "Kerstcadeau"],
  Bankkosten:   ["Betaalpas kosten", "Jaarlijkse bankkosten"],
  "Afschrijving creditcard": ["Afschrijving ICS", "Creditcard-afschrijving"],
  "Onderhoud huis": ["Loodgieter", "CV-ketel onderhoud", "Klusbedrijf"],
  "Inrichten huis": ["IKEA", "Meubels", "Gordijnen"],
  "Persoonlijke verzorging": ["Kapper", "Drogist", "Nagelstudio"],
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

// Veelvoorkomende terugkerende kosten (gas/water/licht, verzekeringen, huur,
// abonnementen). Een klik zoekt eerst of dit al ergens in de geïmporteerde
// transacties staat (via matchWoorden) — zo ja, dan hoef je 'm alleen te
// bevestigen als vaste last, in plaats van een nieuwe, dubbele regel te typen.
// Staat 'ie er nog niet in, dan vult het formulier zich voor zodat je 'm
// alsnog handmatig kunt toevoegen, met "Vaste last" en "Elke maand herhalen"
// al aangevinkt.
const VASTE_LASTEN_PRESETS = [
  { naam: "Huur / hypotheek",                      categorie: "Wonen",        matchWoorden: ["huur","hypotheek"] },
  { naam: "Gas, water & licht",                     categorie: "Wonen",        matchWoorden: ["energie","gas","water","elektra","nuon","vattenfall","eneco","essent","vitens","waternet","dunea","evides"] },
  { naam: "Gemeentebelasting",                      categorie: "Wonen",        matchWoorden: ["gemeentebelasting","gemeente"] },
  { naam: "Waterschapsbelasting",                   categorie: "Wonen",        matchWoorden: ["waterschap"] },
  { naam: "Zorgverzekering",                        categorie: "Verzekering",  matchWoorden: ["zorgverzeker","zorgverz"] },
  { naam: "Inboedelverzekering",                    categorie: "Verzekering",  matchWoorden: ["inboedel"] },
  { naam: "Aansprakelijkheidsverzekering (WA)",     categorie: "Verzekering",  matchWoorden: ["aansprakelijk"," wa "] },
  { naam: "Autoverzekering",                        categorie: "Verzekering",  matchWoorden: ["auto"] },
  { naam: "Internet & TV",                          categorie: "Abonnementen", matchWoorden: ["internet","ziggo","kpn","glasvezel"] },
  { naam: "Mobiele telefoon",                       categorie: "Abonnementen", matchWoorden: ["mobiel","t-mobile","vodafone","simyo","lebara","odido"] },
  { naam: "Netflix",                                categorie: "Abonnementen", matchWoorden: ["netflix"] },
  { naam: "HBO Max",                                categorie: "Abonnementen", matchWoorden: ["hbo"] },
  { naam: "NPO Plus",                               categorie: "Abonnementen", matchWoorden: ["npo"] },
  { naam: "Sportschool",                            categorie: "Gezondheid",   matchWoorden: ["sportschool","fitness","basic.?fit","gym"] },
];

// Zoekt de meest recente al-geïmporteerde transactie die bij een preset past.
function vindBestaandeVasteLast(expenses, preset) {
  const kandidaten = expenses.filter(e =>
    e.category === preset.categorie &&
    preset.matchWoorden.some(w => new RegExp(w, "i").test(e.name))
  );
  return kandidaten.sort((a,b) => b.month.localeCompare(a.month))[0] || null;
}

const prevMonth = ym => { const [y,m]=ym.split("-").map(Number); return m===1?`${y-1}-12`:`${y}-${String(m-1).padStart(2,"0")}`; };
const nextMonth = ym => { const [y,m]=ym.split("-").map(Number); return m===12?`${y+1}-01`:`${y}-${String(m+1).padStart(2,"0")}`; };

// De 6 maanden vóórafgaand aan `ym` (ym zelf niet inbegrepen) — gebruikt als
// stabielere basislijn dan alleen "vorige maand", die te veel kan schommelen
// door bv. een eenmalige grote uitgave.
const last6Months = ym => {
  const [y,m] = ym.split("-").map(Number);
  return Array.from({length:6}, (_,i) => {
    const d = new Date(y, m - 2 - i, 1); // maand vóór ym, dan 5 verder terug
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });
};

// Dezelfde maand, één jaar eerder — voor jaar-op-jaar vergelijking.
const sameMonthLastYear = ym => { const [y,m] = ym.split("-").map(Number); return `${y-1}-${String(m).padStart(2,"0")}`; };

// Totaal inkomen voor een specifieke maand, rekening houdend met
// salarisveranderingen. Zoekt de meest recente wijziging die "vanaf" die
// maand of eerder ingaat; is er geen enkele geregistreerde wijziging (of
// geen enkele van vóór/op deze maand), dan valt hij terug op het huidige
// ingestelde inkomen — zo hoeft niemand met terugwerkende kracht alles in te vullen.
function incomeForMonth(incomeHistory, incomes, maand) {
  const relevant = (incomeHistory||[])
    .filter(h => h.vanafMaand && h.vanafMaand <= maand)
    .sort((a,b) => b.vanafMaand.localeCompare(a.vanafMaand));
  if (relevant.length > 0) return (relevant[0].p1||0) + (relevant[0].p2||0);
  return (incomes?.p1||0) + (incomes?.p2||0);
}

// Eenmalige extra inkomsten (vakantiegeld, bonus, teruggave belasting…) — in
// tegenstelling tot een salarisverandering geldt dit ALLEEN voor de maand
// zelf, niet voor alle maanden daarna. Met "herhaaltJaarlijks" (bv.
// vakantiegeld dat elk jaar in mei komt) telt hij ook mee in latere jaren,
// zolang het jaartal niet vóór het startjaar van de eerste registratie ligt.
function extraInkomenVoorMaand(extraInkomsten, maand) {
  const [qJaar, qMaand] = maand.split("-").map(Number);
  return (extraInkomsten||[]).filter(x => {
    if (!x.maand) return false;
    const [xJaar, xMaand] = x.maand.split("-").map(Number);
    if (x.herhaaltJaarlijks) return xMaand === qMaand && qJaar >= xJaar;
    return x.maand === maand;
  }).reduce((s,x) => s + (+x.bedrag||0), 0);
}

function totaalInkomenVoorMaand(incomeHistory, incomes, extraInkomsten, maand) {
  return incomeForMonth(incomeHistory, incomes, maand) + extraInkomenVoorMaand(extraInkomsten, maand);
}

// Zelfde als incomeForMonth, maar voor één persoon apart (p1 of p2) — nodig
// voor de persoonlijke saldi, die niet het gezamenlijke totaal willen maar
// ieders eigen deel, mét eventuele salarisgeschiedenis.
function incomeForMonthPersoon(incomeHistory, incomes, persoon, maand) {
  const relevant = (incomeHistory||[])
    .filter(h => h.vanafMaand && h.vanafMaand <= maand)
    .sort((a,b) => b.vanafMaand.localeCompare(a.vanafMaand));
  if (relevant.length > 0) return relevant[0][persoon] || 0;
  return incomes?.[persoon] || 0;
}

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

function buildAlerts(expenses, budgets, savingsGoals, incomes, maand = NOW_MONTH, incomeHistory = [], extraInkomsten = []) {
  const alerts = [];
  const totalIncome = totaalInkomenVoorMaand(incomeHistory, incomes, extraInkomsten, maand);
  budgets.forEach(b => {
    const spent = computeSpent(b, expenses, maand);
    const pct = b.amount > 0 ? spent/b.amount : 0;
    if (spent > b.amount) alerts.push({id:`over-${b.id}`,level:"rood",icon:"🚨",title:`Budget overschreden: ${b.category}`,body:`${euro(spent-b.amount)} meer dan budget van ${euro(b.amount)}.`,tab:"budgetten"});
    else if (pct > 0.8) alerts.push({id:`warn-${b.id}`,level:"oranje",icon:"⚠️",title:`${b.category} ${Math.round(pct*100)}% vol`,body:`Nog ${euro(b.amount-spent)} resterend.`,tab:"budgetten"});
  });
  // Categorie-stijging t.o.v. het 6-maands gemiddelde — stabieler dan alleen
  // "vorige maand", waar één eenmalige uitgave (bv. vakantie) al voor een
  // valse alert kon zorgen.
  const catNow={};
  expenses.filter(e=>e.month===maand).forEach(e=>{catNow[e.category]=(catNow[e.category]||0)+e.amount;});
  const baselineMaanden = last6Months(maand);
  const maandenMetData = baselineMaanden.filter(m => expenses.some(e=>e.month===m));
  const catBaseline = {};
  baselineMaanden.forEach(m => {
    expenses.filter(e=>e.month===m).forEach(e=>{catBaseline[e.category]=(catBaseline[e.category]||0)+e.amount;});
  });
  const deler = Math.max(1, maandenMetData.length);
  Object.keys(catNow).forEach(cat => {
    const basis = (catBaseline[cat]||0) / deler;
    const rise = basis>0 ? (catNow[cat]-basis)/basis : 0;
    if (rise>0.25 && catNow[cat]>50 && basis>=20) {
      alerts.push({id:`rise-${cat}`,level:"oranje",icon:"📈",title:`${cat} +${Math.round(rise*100)}% vs gemiddelde`,body:`Gemiddeld ${euro(basis)}/mnd → nu ${euro(catNow[cat])}`,tab:"dashboard"});
    }
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

  // Vaste lasten die vorige maand nog gewoon voorkwamen, maar deze maand nog
  // niet gezien zijn in de bank-import — kan wijzen op een vergeten import,
  // of een uitgebleven betaling. Alleen relevant voor de huidige, lopende
  // maand (voor oudere maanden is dit achteraf niet meer interessant).
  if (maand === NOW_MONTH) {
    const recurringSet = detectRecurring(expenses);
    const laatsteByKeyMaand = {};
    expenses.forEach(e => {
      const k = `${e.name}|${e.account}|${e.category}`;
      if (!laatsteByKeyMaand[k] || e.month > laatsteByKeyMaand[k].month) laatsteByKeyMaand[k] = e;
    });
    const vorigeMaand = prevMonth(maand);
    Object.entries(laatsteByKeyMaand).forEach(([k,e]) => {
      const isVasteBankLast = e.fromBank && (e.fixed || e.recurring || recurringSet.has(k)) && !isVermoedelijkOverboeking(e.name, e.category);
      if (isVasteBankLast && e.month === vorigeMaand) {
        alerts.push({id:`gemist-${k}`, level:"oranje", icon:"❓", title:`${e.name} nog niet gezien deze maand`, body:`Normaal ~${euro(e.amount)}/mnd, laatst gezien ${fmtM(vorigeMaand)} — CSV nog niet geïmporteerd, of betaling uitgebleven?`, tab:"bank"});
      }
    });
  }

  return alerts;
}

function detectRecurring(expenses) {
  const groups={};
  expenses.forEach(e=>{const k=`${e.name}|${e.account}|${e.category}`;(groups[k]=groups[k]||[]).push(e.month);});
  return new Set(Object.entries(groups).filter(([,m])=>m.length>=3).map(([k])=>k));
}

// Een creditcard-CSV is een UITSPLITSING van een bedrag dat al als één losse
// regel "Afschrijving creditcard" via de bank-CSV is binnengekomen (de
// bank ziet alleen de totale afschrijving, niet de losse aankopen erachter).
// Zodra voor een maand de losse creditcard-aankopen zijn geïmporteerd
// (bron:"creditcard"), telt de oorspronkelijke bank-verzamelregel dus niet
// meer als aparte kostenpost mee — anders wordt hetzelfde bedrag dubbel
// geteld. De ruwe regel blijft gewoon zichtbaar/bewerkbaar in Uitgaven; deze
// functie wordt alleen gebruikt voor totalen, budgetten, meldingen en grafieken.
function nettoExpensesFilter(expenses) {
  const maandenMetItemisatie = new Set(expenses.filter(e => e.bron === "creditcard").map(e => e.month));
  return expenses.filter(e =>
    !e.genegeerd &&
    !(e.category === "Afschrijving creditcard" && e.bron !== "creditcard" && maandenMetItemisatie.has(e.month))
  );
}

// Herkent interne overboekingen naar sparen/beleggen op basis van de
// OMSCHRIJVING zelf, niet alleen de opgeslagen categorie. Nodig omdat een
// transactie soms al maanden geleden is geïmporteerd met een verouderde
// categorie-gok (bv. vóór een categorie-regel bestond) — de categorie op de
// transactie zelf verandert dan niet met terugwerkende kracht mee, ook al
// zou een nieuwe import het nu wél goed herkennen.
// Let op: de vaste overdracht naar de Gezamenlijke rekening telt WEL mee als
// terugkerende kost — dat is voor de inbrenger een echte, vaste maandelijkse
// afdracht, ook al blijft het geld binnen het huishouden.
const OVERBOEKING_PATROON = /spaarrekening|opbouwspaar|\bsparen\b|spaarpot|\bpeaks\b|derdengeld|beheer derden|vermogensbeheer|beleggingsrekening|effectenrekening/i;
function isVermoedelijkOverboeking(naam, categorie) {
  if (categorie === "Sparen") return true;
  return OVERBOEKING_PATROON.test(naam || "");
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
  // Salarisveranderingen: elke wijziging geldt vanaf een bepaalde maand, zodat
  // historische maanden met het toen geldende inkomen worden doorgerekend
  // i.p.v. altijd met het huidige bedrag.
  const [incomeHistory, setIncomeHistoryState] = useState([]);
  // Eenmalige extra inkomsten (vakantiegeld, bonus, teruggave) — apart van
  // incomeHistory omdat dit geen blijvende verhoging is, maar een bult in één specifieke maand.
  const [extraInkomsten, setExtraInkomstenState] = useState([]);
  const [expenses,     setExpensesState]     = useState([]);
  const [budgets,      setBudgetsState]      = useState([]);
  const [receipts,     setReceiptsState]     = useState([]);
  const [savingsGoals, setSavingsGoalsState] = useState([]);
  const [tasks,        setTasksState]        = useState([]);
  const [bijst,        setBijstState]        = useState([]);
  const [setupDone,    setSetupDoneState]    = useState(false);
  const [laatsteBankImport, setLaatsteBankImportState] = useState(null);
  const [ibanMap, setIbanMapState] = useState({});
  const [categorieMap, setCategorieMapState] = useState({});
  // Rekeningnummers van bekende, vaste tegenpartijen — een overschrijving náár
  // zo'n rekening krijgt automatisch de gekoppelde categorie, betrouwbaarder
  // dan tekstherkenning. Vooraf gevuld met de gezamenlijke rekening.
  const [bekendeIbans, setBekendeIbansState] = useState({ "NL38RABO0353865362": "Gezamenlijke rekening" });
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
      incomeHistory: patch.incomeHistory ?? incomeHistory,
      extraInkomsten: patch.extraInkomsten ?? extraInkomsten,
      expenses: patch.expenses ?? expenses,
      budgets: patch.budgets ?? budgets,
      receipts: patch.receipts ?? receipts,
      savingsGoals: patch.savingsGoals ?? savingsGoals,
      tasks: patch.tasks ?? tasks,
      bijst: patch.bijst ?? bijst,
      laatsteBankImport: patch.laatsteBankImport ?? laatsteBankImport,
      ibanMap: patch.ibanMap ?? ibanMap,
      categorieMap: patch.categorieMap ?? categorieMap,
      bekendeIbans: patch.bekendeIbans ?? bekendeIbans,
    };
    if (patch.setupDone !== undefined) setSetupDoneState(patch.setupDone);
    if (patch.theme !== undefined) setThemeNameState(patch.theme);
    if (patch.names !== undefined) setNamesState(patch.names);
    if (patch.incomes !== undefined) setIncomesState(patch.incomes);
    if (patch.incomeHistory !== undefined) setIncomeHistoryState(patch.incomeHistory);
    if (patch.extraInkomsten !== undefined) setExtraInkomstenState(patch.extraInkomsten);
    if (patch.expenses !== undefined) setExpensesState(patch.expenses);
    if (patch.budgets !== undefined) setBudgetsState(patch.budgets);
    if (patch.receipts !== undefined) setReceiptsState(patch.receipts);
    if (patch.laatsteBankImport !== undefined) setLaatsteBankImportState(patch.laatsteBankImport);
    if (patch.ibanMap !== undefined) setIbanMapState(patch.ibanMap);
    if (patch.categorieMap !== undefined) setCategorieMapState(patch.categorieMap);
    if (patch.bekendeIbans !== undefined) setBekendeIbansState(patch.bekendeIbans);
    if (patch.savingsGoals !== undefined) setSavingsGoalsState(patch.savingsGoals);
    if (patch.tasks !== undefined) setTasksState(patch.tasks);
    if (patch.bijst !== undefined) setBijstState(patch.bijst);
    saveBudgetData(next);
  }, [setupDone, themeName, names, incomes, incomeHistory, extraInkomsten, expenses, budgets, receipts, savingsGoals, tasks, bijst, laatsteBankImport, ibanMap, categorieMap, bekendeIbans]);

  // Kleine helper-setters die op dezelfde manier werken als de oude setX(updater)-vorm,
  // zodat de rest van de component-logica grotendeels ongewijzigd kan blijven.
  const setNames        = (updater) => persist({ names: typeof updater === "function" ? updater(names) : updater });
  const setIncomes      = (updater) => persist({ incomes: typeof updater === "function" ? updater(incomes) : updater });
  const setIncomeHistory = (updater) => persist({ incomeHistory: typeof updater === "function" ? updater(incomeHistory) : updater });
  const setExtraInkomsten = (updater) => persist({ extraInkomsten: typeof updater === "function" ? updater(extraInkomsten) : updater });
  const setExpenses     = (updater) => persist({ expenses: typeof updater === "function" ? updater(expenses) : updater });
  const setBudgets      = (updater) => persist({ budgets: typeof updater === "function" ? updater(budgets) : updater });
  const setReceipts     = (updater) => persist({ receipts: typeof updater === "function" ? updater(receipts) : updater });
  const setSavingsGoals = (updater) => persist({ savingsGoals: typeof updater === "function" ? updater(savingsGoals) : updater });
  const setTasks        = (updater) => persist({ tasks: typeof updater === "function" ? updater(tasks) : updater });
  const setBijst        = (updater) => persist({ bijst: typeof updater === "function" ? updater(bijst) : updater });
  const setIbanMap      = (updater) => persist({ ibanMap: typeof updater === "function" ? updater(ibanMap) : updater });
  const setCategorieMap = (updater) => persist({ categorieMap: typeof updater === "function" ? updater(categorieMap) : updater });
  const setBekendeIbans = (updater) => persist({ bekendeIbans: typeof updater === "function" ? updater(bekendeIbans) : updater });
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
        setIncomeHistoryState(data.incomeHistory || []);
        setExtraInkomstenState(data.extraInkomsten || []);
        setExpensesState(data.expenses || []);
        setBudgetsState(data.budgets || []);
        setReceiptsState(data.receipts || []);
        setSavingsGoalsState(data.savingsGoals || []);
        setTasksState(data.tasks || []);
        setBijstState(data.bijst || []);
        setLaatsteBankImportState(data.laatsteBankImport || null);
        setIbanMapState(data.ibanMap || {});
        setCategorieMapState(data.categorieMap || {});
        setBekendeIbansState(data.bekendeIbans && Object.keys(data.bekendeIbans).length > 0
          ? data.bekendeIbans : { "NL38RABO0353865362": "Gezamenlijke rekening" });
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
  const [uitgavenZoek, setUitgavenZoek] = useState("");
  const [uitgeklapt,   setUitgeklapt]   = useState({});
  const [terugkerendAccFilter, setTerugkerendAccFilter] = useState("alle"); // key: `${accId}::${categorie}` → true = uitgeklapt (standaard dus ingeklapt)
  const [selectedMonth, setSelectedMonth] = useState(NOW_MONTH); // maand-selector
  const [csvImport,    setCsvImport]    = useState(null);
  const [csvError,     setCsvError]     = useState("");
  const [toast,        setToast]        = useState(null);
  const [toastColor,   setToastColor]   = useState(null);
  const [expForm,      setExpForm]      = useState({ name:"", amount:"", category:CATEGORIES[0], account:"p1", month:NOW_MONTH, fixed:false, recurring:false, note:"" });
  const [bForm,        setBForm]        = useState({ category:"Kleding", period:"kwartaal", amount:"", account:"alle", note:"" });
  const [showBForm,    setShowBForm]    = useState(false);
  const [incomeHistoryForm, setIncomeHistoryForm] = useState({ vanafMaand: NOW_MONTH, p1:"", p2:"", note:"" });
  const [showIncomeHistoryForm, setShowIncomeHistoryForm] = useState(false);
  const [extraInkomstenForm, setExtraInkomstenForm] = useState({ maand: NOW_MONTH, bedrag:"", omschrijving:"", herhaaltJaarlijks:false });
  const [showExtraInkomstenForm, setShowExtraInkomstenForm] = useState(false);
  const [drillCat,     setDrillCat]     = useState(null);
  const _prevMonth = prevMonth(NOW_MONTH);
  const [cmpMonth,     setCmpMonth]     = useState(_prevMonth);
  const [editNote,     setEditNote]     = useState(null);
  const vasteBedragRef = useRef(null);
  const [vasteLastMatch, setVasteLastMatch] = useState(null); // { preset, expense } — gevonden bestaande transactie, wacht op bevestiging
  const [goalForm,     setGoalForm]     = useState({name:"",target:"",current:"0",deadline:"",account:"gezamenlijk",icon:"🎯"});
  const [taskForm,     setTaskForm]     = useState({title:"",due:"",account:"alle",priority:"middel"});

  const csvRef  = useRef();
  const creditcardCsvRef = useRef();

  // ── Derived data (memoised) ───────────────────────────────────────────────
  const accountOptions = useMemo(() => [
    { id:"p1",          label: names.p1 },
    { id:"p2",          label: names.p2 },
    { id:"gezamenlijk", label:"Gezamenlijk" },
  ], [names]);

  // Voor totalen/budgetten/meldingen/grafieken: dubbeltelling van creditcard-
  // afschrijvingen eruit. De rauwe `expenses` blijft de bron van waarheid voor
  // de Uitgaven-lijst zelf (bewerken/verwijderen werkt op de echte data).
  const nettoExpenses = useMemo(() => nettoExpensesFilter(expenses), [expenses]);

  // De "bijdrage"-instelling (Instellingen → Budget gezamenlijk) is een
  // GEPLAND bedrag — bedoeld als schatting zolang de echte overboeking naar
  // de Gezamenlijke rekening nog niet is geïmporteerd. Zodra die overboeking
  // er wél al staat (category "Gezamenlijke rekening", telt sinds kort mee
  // als kost), moet de geplande bijdrage NIET er nog eens bovenop worden
  // afgetrokken — anders wordt hetzelfde bedrag dubbel meegerekend. Hier
  // wordt dus alleen de planning gebruikt als er nog geen echte transactie
  // is gezien; zodra die er is, valt het bedrag terug op 0 extra aftrek.
  const feitelijkeBijdrage = useMemo(() => {
    const somVoor = acc => nettoExpenses
      .filter(e => e.account===acc && e.category==="Gezamenlijke rekening" && e.month===selectedMonth)
      .reduce((s,e) => s+e.amount, 0);
    return { p1: somVoor("p1"), p2: somVoor("p2") };
  }, [nettoExpenses, selectedMonth]);
  const bijdrageP1Effectief = feitelijkeBijdrage.p1 > 0 ? feitelijkeBijdrage.p1 : (incomes.bijdrage_p1||0);
  const bijdrageP2Effectief = feitelijkeBijdrage.p2 > 0 ? feitelijkeBijdrage.p2 : (incomes.bijdrage_p2||0);
  // Voor plekken die ALS-NOG een bedrag van iemands persoonlijke rekening
  // aftrekken bovenop totalByAccount (dat de overboeking al meetelt zodra
  // die als transactie is geïmporteerd): alleen de geplande bijdrage
  // gebruiken als er nog GEEN echte overboeking is gezien, anders 0 — om
  // dubbele aftrek te voorkomen.
  const bijdrageP1Aftrek = feitelijkeBijdrage.p1 > 0 ? 0 : (incomes.bijdrage_p1||0);
  const bijdrageP2Aftrek = feitelijkeBijdrage.p2 > 0 ? 0 : (incomes.bijdrage_p2||0);

  const gezBudget = bijdrageP1Effectief + bijdrageP2Effectief
    + (incomes.kinderbijslag||0)
    + (bijst||[]).filter(b => b.datum?.startsWith(selectedMonth)).reduce((s,b) => s+b.bedrag, 0);

  const totalByAccount = useMemo(() => {
    const t = { gezamenlijk:0, p1:0, p2:0 };
    nettoExpenses.filter(e => e.month === selectedMonth).forEach(e => { t[e.account] = (t[e.account]||0) + e.amount; });
    return t;
  }, [nettoExpenses, selectedMonth]);

  const [uitgavenPeriode, setUitgavenPeriode] = useState("alles"); // "alles" | "maand"

  const filteredExpenses = useMemo(() => {
    let r = activeAcc === "alle" ? expenses : expenses.filter(e => e.account === activeAcc);
    if (uitgavenPeriode === "maand") r = r.filter(e => e.month === selectedMonth);
    return r;
  }, [expenses, activeAcc, uitgavenPeriode, selectedMonth]);

  const byCat = useMemo(() => {
    const m = {};
    nettoExpenses.filter(e => e.month === selectedMonth).forEach(e => { m[e.category] = (m[e.category]||0) + e.amount; });
    return Object.entries(m).map(([name,value]) => ({name,value})).sort((a,b) => b.value - a.value);
  }, [nettoExpenses, selectedMonth]);

  const byCatPrev = useMemo(() => {
    const m = {};
    nettoExpenses.filter(e => e.month === cmpMonth).forEach(e => { m[e.category] = (m[e.category]||0) + e.amount; });
    return m;
  }, [nettoExpenses, cmpMonth]);

  const alerts = useMemo(() =>
    buildAlerts(nettoExpenses, budgets, savingsGoals || [], incomes, selectedMonth, incomeHistory, extraInkomsten),
  [nettoExpenses, budgets, savingsGoals, incomes, selectedMonth, incomeHistory, extraInkomsten]);

  const recurring = useMemo(() => detectRecurring(nettoExpenses), [nettoExpenses]);

  const budgetsWithSpent = useMemo(() =>
    budgets.map(b => ({ ...b, spent: computeSpent(b, nettoExpenses, selectedMonth), pLabel: periodLabel(b.period, selectedMonth) })),
  [budgets, nettoExpenses, selectedMonth]);

  // Terugkerende kosten: expliciet gemarkeerd (fixed/recurring) of 3+ maanden
  // achter elkaar herkend. Eén centrale berekening i.p.v. verspreid over
  // tabbladen, zodat Meldingen en Inzichten altijd precies hetzelfde tonen.
  // Twee correcties op de automatische ("patroon") herkenning — handmatig
  // gemarkeerde vaste lasten/herhalingen blijven altijd staan, ongeacht
  // naam, categorie of ouderdom:
  //  1. Interne overboekingen (sparen/beleggen/gezamenlijk) zijn geen kosten
  //     — herkend op naam, niet alleen op (mogelijk verouderde) categorie.
  //  2. Als de omschrijving van een bank-import net iets verandert (bv. een
  //     polisperiode of referentienummer), ontstaat een "nieuw" patroon
  //     terwijl het dezelfde kostenpost is — het oude blijft dan ten
  //     onrechte meetellen. Alleen recente patroon-items (deze of vorige
  //     maand) laten meetellen voorkomt dat.
  const terugkerend = useMemo(() => {
    const laatsteByKey = {};
    nettoExpenses.forEach(e => {
      const k = `${e.name}|${e.account}|${e.category}`;
      if (!laatsteByKey[k] || e.month > laatsteByKey[k].month) laatsteByKey[k] = e;
    });
    const PREV = prevMonth(selectedMonth);
    return Object.entries(laatsteByKey)
      .map(([k,e]) => ({ ...e, key:k, herhaaltVast: recurring.has(k) }))
      .filter(e => {
        const alleenAutoPatroon = !e.fixed && !e.recurring && e.herhaaltVast;
        if (alleenAutoPatroon && isVermoedelijkOverboeking(e.name, e.category)) return false;
        if (alleenAutoPatroon && e.month !== selectedMonth && e.month !== PREV) return false;
        return e.fixed || e.recurring || e.herhaaltVast;
      })
      .sort((a,b) => b.amount - a.amount);
  }, [nettoExpenses, recurring, selectedMonth]);
  const terugkerendTotaal = useMemo(() => terugkerend.reduce((s,e) => s+e.amount, 0), [terugkerend]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg, col=null) { setToast(msg); setToastColor(col); setTimeout(() => { setToast(null); setToastColor(null); }, 2800); }

  // ── Terugkerende uitgaven automatisch toevoegen ───────────────────────────
  // Moet draaien NÁDAT de data uit Redis binnen is — bij het allereerste
  // mount-moment is `expenses` nog altijd leeg (die fetch is async), dus dit
  // hangt bewust aan `loading` (wordt precies één keer false na de eerste
  // succesvolle laadbeurt) in plaats van aan een lege dependency-array.
  useEffect(() => {
    if (loading) return;
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
  }, [loading]);  // eslint-disable-line — alleen als loading van true naar false gaat

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

  function kiesVasteLast(preset) {
    const gevonden = vindBestaandeVasteLast(expenses, preset);
    if (gevonden && !gevonden.fixed) {
      setVasteLastMatch({ preset, expense: gevonden });
      return;
    }
    if (gevonden && gevonden.fixed) {
      showToast(`✅ "${gevonden.name}" staat al als vaste last gemarkeerd`);
      return;
    }
    setExpForm(p => ({
      ...p,
      name: preset.naam,
      category: preset.categorie,
      account: "gezamenlijk",
      month: selectedMonth,
      fixed: true,
      recurring: true,
    }));
    setTimeout(() => { vasteBedragRef.current?.focus(); vasteBedragRef.current?.select(); }, 50);
  }

  function bevestigGevondenVasteLast() {
    if (!vasteLastMatch) return;
    toggleFixed(vasteLastMatch.expense.id);
    setVasteLastMatch(null);
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

  function toggleFixed(id) {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, fixed: !e.fixed } : e));
    const item = expenses.find(e => e.id === id);
    if (item) showToast(item.fixed ? `${item.name} is geen vaste last meer` : `✅ ${item.name} is nu een vaste last`);
  }

  function toggleGenegeerd(id) {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, genegeerd: !e.genegeerd } : e));
    const item = expenses.find(e => e.id === id);
    if (item) showToast(item.genegeerd ? `${item.name} telt weer mee` : `🚫 ${item.name} genegeerd — telt nergens meer mee`);
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

  function addIncomeHistory() {
    if (!incomeHistoryForm.vanafMaand || (!incomeHistoryForm.p1 && !incomeHistoryForm.p2)) return;
    const nieuw = {
      id: uid(),
      vanafMaand: incomeHistoryForm.vanafMaand,
      p1: +incomeHistoryForm.p1 || 0,
      p2: +incomeHistoryForm.p2 || 0,
      note: incomeHistoryForm.note || "",
    };
    setIncomeHistory(p => [...p, nieuw]);
    setIncomeHistoryForm({ vanafMaand: NOW_MONTH, p1:"", p2:"", note:"" });
    setShowIncomeHistoryForm(false);
    showToast("✅ Salarisverandering toegevoegd");
  }
  function delIncomeHistory(id) {
    setIncomeHistory(p => p.filter(h => h.id !== id));
  }

  function addExtraInkomsten() {
    if (!extraInkomstenForm.maand || !extraInkomstenForm.bedrag) return;
    const nieuw = {
      id: uid(),
      maand: extraInkomstenForm.maand,
      bedrag: +extraInkomstenForm.bedrag || 0,
      omschrijving: extraInkomstenForm.omschrijving || "Extra inkomsten",
      herhaaltJaarlijks: !!extraInkomstenForm.herhaaltJaarlijks,
    };
    setExtraInkomsten(p => [...p, nieuw]);
    setExtraInkomstenForm({ maand: NOW_MONTH, bedrag:"", omschrijving:"", herhaaltJaarlijks:false });
    setShowExtraInkomstenForm(false);
    showToast("✅ Extra inkomsten toegevoegd");
  }
  function delExtraInkomsten(id) {
    setExtraInkomsten(p => p.filter(x => x.id !== id));
  }
  // Snelkoppeling: vult meteen "mei" in — als mei van dit jaar al voorbij is,
  // pakt hij volgend jaar. Bedrag en herhaling laat de gebruiker zelf kiezen.
  function startVakantiegeldPreset() {
    const nu = new Date();
    const jaar = nu.getMonth() >= 4 ? nu.getFullYear() + 1 : nu.getFullYear(); // getMonth()===4 is mei (0-indexed)
    setExtraInkomstenForm({ maand: `${jaar}-05`, bedrag:"", omschrijving:"Vakantiegeld", herhaaltJaarlijks:true });
    setShowExtraInkomstenForm(true);
  }
  function delGoal(id) { setSavingsGoals(p=>p.filter(g=>g.id!==id)); }
  function depositGoal(id, add) { setSavingsGoals(p=>p.map(g=>g.id===id?{...g,current:Math.min(g.target,g.current+add)}:g)); }
  function koppelSparenAanDoel(id, bedrag, maand) {
    setSavingsGoals(p=>p.map(g=>g.id===id
      ? { ...g, current:Math.min(g.target, g.current+bedrag), gekoppeldeMaanden:[...(g.gekoppeldeMaanden||[]), maand] }
      : g
    ));
    showToast(`+${euro(bedrag)} automatisch bijgeschreven vanuit Sparen`, C.green);
  }
  function addTask() { if(!taskForm.title) return; setTasks(p=>[...p,{...taskForm,id:uid(),done:false}]); setTaskForm({title:"",due:"",account:"alle",priority:"middel"}); showToast("✅ Taak toegevoegd"); }
  function toggleTask(id) { setTasks(p=>p.map(t=>t.id===id?{...t,done:!t.done}:t)); }
  function delTask(id) { setTasks(p=>p.filter(t=>t.id!==id)); }

  function confirmCSV(rows) {
    if (csvImportingRef.current) return; // beschermt tegen een dubbele tik vóór de eerste herrender
    csvImportingRef.current = true;
    persist({ expenses: [...expenses, ...rows], laatsteBankImport: Date.now() });
    setCsvImport(null);
    setCsvDubbelCount(0);
    showToast(`✅ ${rows.length} transacties ingeladen`);
    setTab("uitgaven");
    csvImportingRef.current = false;
  }

  // ── CSV import ────────────────────────────────────────────────────────────
  const [csvDubbelCount, setCsvDubbelCount] = useState(0);
  const csvImportingRef = useRef(false); // ref i.p.v. state: werkt synchroon, dus ook bestand tegen twee taps binnen dezelfde tick
  const [csvReviewPagina, setCsvReviewPagina] = useState(0);
  const [nieuweIbanInput, setNieuweIbanInput] = useState("");
  const [nieuweIbanCategorie, setNieuweIbanCategorie] = useState("Gezamenlijke rekening");
  const CSV_PAGINA_GROOTTE = 50;

  function handleCSV(file) {
    if (!file) return;
    setCsvError(""); setCsvImport(null); setCsvDubbelCount(0); setCsvReviewPagina(0);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const rows = parseRabobankCSV(e.target.result, ibanMap, categorieMap, bekendeIbans);
        if (!rows.length) { setCsvError("Geen uitgaven gevonden. Controleer het Rabobank CSV-formaat."); return; }

        // Sla transacties over die er (op basis van vingerafdruk) al in staan —
        // zo kun je gerust een overlappende periode opnieuw importeren.
        const bekendeRefs = new Set(expenses.filter(x => x.bankRef).map(x => x.bankRef));
        const nieuw = rows.filter(r => !bekendeRefs.has(r.bankRef));
        const dubbel = rows.length - nieuw.length;
        setCsvDubbelCount(dubbel);

        if (!nieuw.length) {
          setCsvError(`Alle ${rows.length} transacties uit dit bestand staan al in Budget — niks nieuws om te importeren.`);
          return;
        }
        setCsvImport(nieuw);
      } catch (err) { setCsvError("Fout bij inladen: " + err.message); }
    };
    reader.readAsText(file, "UTF-8");
  }

  // Creditcard-afschriften zijn meestal abonnementen/eenmalige aankopen op één
  // kaart — geen eigen-IBAN-koppeling nodig, wel dezelfde dubbele-detectie en
  // geleerde-categorieën als bij de bank-CSV.
  function handleCreditcardCSV(file) {
    if (!file) return;
    setCsvError(""); setCsvImport(null); setCsvDubbelCount(0); setCsvReviewPagina(0);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const rows = parseCreditCardCSV(e.target.result, categorieMap);
        if (!rows.length) {
          setCsvError("Geen transacties herkend in dit bestand. Creditcard-afschriften verschillen sterk per kaartuitgever — stuur een voorbeeldbestand door zodat de import daarop afgestemd kan worden.");
          return;
        }

        const bekendeRefs = new Set(expenses.filter(x => x.bankRef).map(x => x.bankRef));
        const nieuw = rows.filter(r => !bekendeRefs.has(r.bankRef));
        const dubbel = rows.length - nieuw.length;
        setCsvDubbelCount(dubbel);

        if (!nieuw.length) {
          setCsvError(`Alle ${rows.length} transacties uit dit bestand staan al in Budget — niks nieuws om te importeren.`);
          return;
        }
        setCsvImport(nieuw);
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
    p1: incomeForMonthPersoon(incomeHistory, incomes, "p1", selectedMonth) - (totalByAccount.p1||0) - bijdrageP1Aftrek,
    p2: incomeForMonthPersoon(incomeHistory, incomes, "p2", selectedMonth) - (totalByAccount.p2||0) - bijdrageP2Aftrek,
    gezamenlijk: gezBudget - (totalByAccount.gezamenlijk||0),
  };
  const totalIncome = totaalInkomenVoorMaand(incomeHistory, incomes, extraInkomsten, selectedMonth);
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

        {/* Salarisveranderingen */}
        <div style={{ marginBottom:16, paddingTop:2 }}>
          <div style={{ fontSize:12, color:C.text, fontWeight:700, marginBottom:4 }}>📈 Salarisveranderingen</div>
          <p style={{ margin:"0 0 10px", fontSize:11, color:C.muted, lineHeight:1.5 }}>
            Loonsverhoging, nieuwe baan, ouderschapsverlof? Leg vast vanaf welke maand een ander inkomen gold — de tekort/overschot-berekening in Inzichten rekent daar dan automatisch mee.
          </p>
          {[...incomeHistory].sort((a,b) => b.vanafMaand.localeCompare(a.vanafMaand)).map(h => (
            <div key={h.id} style={{ display:"flex", alignItems:"center", gap:8, background:C.card, borderRadius:9, padding:"8px 10px", marginBottom:6 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:700 }}>Vanaf {fmtM(h.vanafMaand)}</div>
                <div style={{ fontSize:11, color:C.muted }}>{euro(h.p1)} + {euro(h.p2)} = {euro(h.p1+h.p2)}/mnd{h.note ? ` · ${h.note}` : ""}</div>
              </div>
              <button onClick={()=>delIncomeHistory(h.id)} style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:14 }}>×</button>
            </div>
          ))}
          {showIncomeHistoryForm ? (
            <div style={{ background:C.card, borderRadius:10, padding:10 }}>
              <label style={{ fontSize:10, color:C.muted, display:"block", marginBottom:3 }}>Vanaf maand</label>
              <input style={{...S.inp, marginBottom:6}} type="month"
                value={incomeHistoryForm.vanafMaand}
                onChange={e=>setIncomeHistoryForm(p=>({...p,vanafMaand:e.target.value}))}/>
              <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:10, color:C.muted, display:"block", marginBottom:3 }}>{names.p1||"Partner 1"} €</label>
                  <input style={S.inp} type="number" min="0" placeholder="0"
                    value={incomeHistoryForm.p1}
                    onChange={e=>setIncomeHistoryForm(p=>({...p,p1:e.target.value}))}/>
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:10, color:C.muted, display:"block", marginBottom:3 }}>{names.p2||"Partner 2"} €</label>
                  <input style={S.inp} type="number" min="0" placeholder="0"
                    value={incomeHistoryForm.p2}
                    onChange={e=>setIncomeHistoryForm(p=>({...p,p2:e.target.value}))}/>
                </div>
              </div>
              <input style={{...S.inp, marginBottom:8}} placeholder="Notitie (optioneel, bv. 'loonsverhoging Pepijn')"
                value={incomeHistoryForm.note}
                onChange={e=>setIncomeHistoryForm(p=>({...p,note:e.target.value}))}/>
              <div style={{ display:"flex", gap:6 }}>
                <button style={{...S.btn(C.dim, C.text), flex:1, padding:"9px 0", fontSize:12}} onClick={()=>setShowIncomeHistoryForm(false)}>Annuleer</button>
                <button style={{...S.btn(), flex:1, padding:"9px 0", fontSize:12}} onClick={addIncomeHistory}>Toevoegen</button>
              </div>
            </div>
          ) : (
            <button style={{ background:"none", border:`1px dashed ${C.border}`, borderRadius:9, padding:"9px 0", width:"100%", color:C.muted, fontSize:12, cursor:"pointer" }}
              onClick={()=>setShowIncomeHistoryForm(true)}>
              + Salarisverandering toevoegen
            </button>
          )}
        </div>

        {/* Eenmalige extra inkomsten */}
        <div style={{ marginBottom:16, paddingTop:2 }}>
          <div style={{ fontSize:12, color:C.text, fontWeight:700, marginBottom:4 }}>🎁 Eenmalige extra inkomsten</div>
          <p style={{ margin:"0 0 10px", fontSize:11, color:C.muted, lineHeight:1.5 }}>
            Vakantiegeld, bonus, belastingteruggave — geldt alleen voor die ene maand, niet voor de maanden erna (in tegenstelling tot een salarisverandering hierboven).
          </p>
          {[...extraInkomsten].sort((a,b) => b.maand.localeCompare(a.maand)).map(x => (
            <div key={x.id} style={{ display:"flex", alignItems:"center", gap:8, background:C.card, borderRadius:9, padding:"8px 10px", marginBottom:6 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:700 }}>{x.omschrijving} · {euro(x.bedrag)}</div>
                <div style={{ fontSize:11, color:C.muted }}>{x.herhaaltJaarlijks ? `Elk jaar in ${fmtM(x.maand).split(" ")[0]}, vanaf ${x.maand.split("-")[0]}` : fmtM(x.maand)}</div>
              </div>
              <button onClick={()=>delExtraInkomsten(x.id)} style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:14 }}>×</button>
            </div>
          ))}
          {showExtraInkomstenForm ? (
            <div style={{ background:C.card, borderRadius:10, padding:10 }}>
              <label style={{ fontSize:10, color:C.muted, display:"block", marginBottom:3 }}>Maand</label>
              <input style={{...S.inp, marginBottom:6}} type="month"
                value={extraInkomstenForm.maand}
                onChange={e=>setExtraInkomstenForm(p=>({...p,maand:e.target.value}))}/>
              <label style={{ fontSize:10, color:C.muted, display:"block", marginBottom:3 }}>Bedrag (totaal, beide partners) €</label>
              <input style={{...S.inp, marginBottom:6}} type="number" min="0" placeholder="0"
                value={extraInkomstenForm.bedrag}
                onChange={e=>setExtraInkomstenForm(p=>({...p,bedrag:e.target.value}))}/>
              <input style={{...S.inp, marginBottom:6}} placeholder="Omschrijving (bv. Vakantiegeld)"
                value={extraInkomstenForm.omschrijving}
                onChange={e=>setExtraInkomstenForm(p=>({...p,omschrijving:e.target.value}))}/>
              <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.muted, marginBottom:8, cursor:"pointer" }}>
                <input type="checkbox" checked={extraInkomstenForm.herhaaltJaarlijks}
                  onChange={e=>setExtraInkomstenForm(p=>({...p,herhaaltJaarlijks:e.target.checked}))}/>
                Herhaalt elk jaar in deze maand (bv. vakantiegeld)
              </label>
              <div style={{ display:"flex", gap:6 }}>
                <button style={{...S.btn(C.dim, C.text), flex:1, padding:"9px 0", fontSize:12}} onClick={()=>setShowExtraInkomstenForm(false)}>Annuleer</button>
                <button style={{...S.btn(), flex:1, padding:"9px 0", fontSize:12}} onClick={addExtraInkomsten}>Toevoegen</button>
              </div>
            </div>
          ) : (
            <div style={{ display:"flex", gap:6 }}>
              <button style={{ background:"none", border:`1px dashed ${C.border}`, borderRadius:9, padding:"9px 0", flex:1, color:C.muted, fontSize:12, cursor:"pointer" }}
                onClick={startVakantiegeldPreset}>
                🏖️ Vakantiegeld
              </button>
              <button style={{ background:"none", border:`1px dashed ${C.border}`, borderRadius:9, padding:"9px 0", flex:1, color:C.muted, fontSize:12, cursor:"pointer" }}
                onClick={()=>setShowExtraInkomstenForm(true)}>
                + Anders
              </button>
            </div>
          )}
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

      <div style={{ maxWidth:960, margin:"0 auto" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom:4 }}>
          <Link href="/" style={{ margin:0, fontSize:12, letterSpacing:"0.04em", textTransform:"uppercase", color:C.muted, fontWeight:600, background:"none", border:"none", padding:0, cursor:"pointer", textDecoration:"none", display:"inline-block" }}>
            ← Overzicht
          </Link>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginTop:6 }}>
            <div>
              <h1 style={{ margin:0, fontSize:19, fontWeight:800, letterSpacing:-.5 }}>Budget</h1>
              <p style={{ margin:0, color:C.muted, fontSize:11 }}>{names.p1} · {names.p2} · Gezamenlijk</p>
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
        </div>

        {/* ── Tabs ── */}
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch", paddingBottom:4, margin:"12px 0" }}>
          <div style={{ display:"flex", gap:2, background:C.surf, borderRadius:9, padding:3, border:`1px solid ${C.border}`, width:"max-content" }}>
            {[["dashboard","🏠 Dashboard"],["inzichten","💡 Inzichten"],["uitgaven","💳 Uitgaven"],["bank","🏦 Bank"],[`meldingen`,`🔔${alerts.length > 0 ? " "+alerts.length : ""} Meldingen`],["budgetten","🎯 Budgetten"],["vergelijk","📊 Vergelijk"],["doelen","💰 Doelen"],["taken","✅ Taken"],["afsluiting","📅 Maand"]]
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
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))", gap:8, alignItems:"end" }}>
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

            {/* Budgetten op basis van eigen historie */}
            {(() => {
              const histMaanden = Array.from({length:6}, (_,i) => {
                const [y,m] = selectedMonth.split("-").map(Number);
                const d = new Date(y, m-1-1-i, 1); // t/m vorige maand, 6 maanden terug
                return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
              });
              const somPerCat = {};
              const maandenGezienPerCat = {};
              nettoExpenses.filter(e => histMaanden.includes(e.month)).forEach(e => {
                somPerCat[e.category] = (somPerCat[e.category]||0) + e.amount;
                (maandenGezienPerCat[e.category] = maandenGezienPerCat[e.category] || new Set()).add(e.month);
              });
              const bestaandeCatMaand = new Set(budgets.filter(b=>b.period==="maand").map(b=>b.category));
              const gemiddeldes = Object.entries(somPerCat)
                .filter(([cat]) => !bestaandeCatMaand.has(cat)) // geen dubbele suggestie voor iets dat al een maandbudget heeft
                .map(([cat, som]) => ({ cat, gemiddeld: Math.round(som / Math.max(1, maandenGezienPerCat[cat].size)), maanden: maandenGezienPerCat[cat].size }))
                .filter(x => x.gemiddeld >= 15 && x.maanden >= 2) // ruis eruit: te klein of te weinig historie
                .sort((a,b) => b.gemiddeld - a.gemiddeld);

              if (gemiddeldes.length === 0) return null;
              return (
                <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:18 }}>
                  <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700 }}>📊 Op basis van jullie eigen gemiddelde</h3>
                  <p style={{ margin:"0 0 12px", fontSize:12, color:C.muted }}>
                    Gemiddelde besteding per categorie over de laatste {histMaanden.length} maanden — vaak realistischer dan een landelijke richtlijn. Klik om als maandbudget toe te voegen.
                  </p>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {gemiddeldes.map(g => (
                      <button key={g.cat} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:9, padding:"7px 11px", color:C.text, fontSize:12, cursor:"pointer" }}
                        onClick={() => { setBudgets(p=>[...p,{id:uid(),category:g.cat,period:"maand",amount:g.gemiddeld,account:"alle",note:`Eigen gemiddelde over ${g.maanden} mnd`}]); showToast(`✅ Budget ${g.cat} toegevoegd (${euro(g.gemiddeld)})`); }}>
                        {CAT_ICON[g.cat]||"📦"} <strong style={{ color:C.accent }}>{euro(g.gemiddeld)}/mnd</strong> — {g.cat}
                        <span style={{ color:C.muted, marginLeft:5, fontSize:10 }}>({g.maanden} mnd data)</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

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
                <span style={{ fontSize:12, color:C.muted }}>Maand</span>
                <input type="month" value={selectedMonth} max={NOW_MONTH} onChange={e=>setSelectedMonth(e.target.value)} style={{ ...S.inp, width:"auto" }}/>
              </div>
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

            {/* Jaar-op-jaar */}
            {(() => {
              const ymly = sameMonthLastYear(selectedMonth);
              const heeftData = expenses.some(e => e.month === ymly);
              const inScope = e => !drillCat || e.category === drillCat;
              const totaalNu   = nettoExpenses.filter(e => e.month === selectedMonth && inScope(e)).reduce((s,e)=>s+e.amount,0);
              const totaalVorig = nettoExpenses.filter(e => e.month === ymly && inScope(e)).reduce((s,e)=>s+e.amount,0);
              const delta = totaalVorig>0 ? (totaalNu-totaalVorig)/totaalVorig : null;
              return (
                <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:14 }}>
                  <h3 style={{ margin:"0 0 6px", fontSize:13, fontWeight:700 }}>📅 Jaar-op-jaar{drillCat?`: ${drillCat}`:""}</h3>
                  {!heeftData ? (
                    <p style={{ margin:0, fontSize:12, color:C.muted }}>Nog geen data van {fmtM(ymly)} — komt vanzelf zodra jullie een jaar verder zijn.</p>
                  ) : (
                    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                      <div>
                        <div style={{ fontSize:10, color:C.muted }}>{fmtM(ymly)}</div>
                        <div style={{ fontWeight:700, fontSize:15 }}>{euro(totaalVorig)}</div>
                      </div>
                      <span style={{ color:C.muted }}>→</span>
                      <div>
                        <div style={{ fontSize:10, color:C.muted }}>{fmtM(selectedMonth)}</div>
                        <div style={{ fontWeight:700, fontSize:15 }}>{euro(totaalNu)}</div>
                      </div>
                      {delta !== null && (
                        <span style={{ marginLeft:"auto", fontWeight:700, fontSize:13, color:delta>0?C.red:C.green }}>
                          {delta>0?"+":""}{Math.round(delta*100)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

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
              const catExp = nettoExpenses.filter(e=>e.category===drillCat&&e.month===selectedMonth).sort((a,b)=>b.amount-a.amount);
              const [selJ, selM] = selectedMonth.split("-").map(Number);
              const months = Array.from({length:6},(_,i)=>{const d=new Date(selJ,selM-1-i,1);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}).reverse();
              const trendData = months.map(m=>({label:fmtM(m),total:nettoExpenses.filter(e=>e.category===drillCat&&e.month===m).reduce((s,e)=>s+e.amount,0)}));
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
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))", gap:7, alignItems:"end" }}>
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
            {(() => {
              const openDoelen = (savingsGoals||[]).filter(g => (g.target>0 ? Math.round(g.current/g.target*100) : 0) < 100).length;
              return (savingsGoals||[]).map(g=>{
              const pct = g.target>0 ? Math.min(100,Math.round(g.current/g.target*100)) : 0;
              const [ty,tm] = g.deadline ? g.deadline.split("-").map(Number) : [NOW_YEAR+1,1];
              const [ny,nm] = selectedMonth.split("-").map(Number);
              const ml = Math.max(0,(ty-ny)*12+(tm-nm));
              const needed = g.target-g.current;
              const monthly = ml>0 ? Math.round(needed/ml) : needed;
              const totalInc = totaalInkomenVoorMaand(incomeHistory, incomes, extraInkomsten, selectedMonth);
              const sparenDezeMaand = nettoExpenses
                .filter(e => e.category==="Sparen" && e.month===selectedMonth && (g.account==="alle" || e.account===g.account))
                .reduce((s,e)=>s+e.amount, 0);
              const alGekoppeld = (g.gekoppeldeMaanden||[]).includes(selectedMonth);
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
                  {pct<100 && sparenDezeMaand > 0 && !alGekoppeld && openDoelen === 1 && (
                    <div style={{ background:`${C.green}15`, border:`1px solid ${C.green}40`, borderRadius:10, padding:"9px 12px", marginBottom:8 }}>
                      <p style={{ margin:"0 0 6px", fontSize:12, color:C.text }}>
                        💰 Deze maand ging er <strong>{euro(sparenDezeMaand)}</strong> naar Sparen volgens je transacties — toevoegen aan dit doel?
                      </p>
                      <button style={{ ...S.btn(C.green), width:"100%", padding:"7px 0", fontSize:12 }}
                        onClick={()=>koppelSparenAanDoel(g.id, sparenDezeMaand, selectedMonth)}>
                        + {euro(sparenDezeMaand)} toevoegen
                      </button>
                    </div>
                  )}
                  {pct<100 && sparenDezeMaand > 0 && !alGekoppeld && openDoelen > 1 && (
                    <p style={{ margin:"0 0 8px", fontSize:11, color:C.muted }}>
                      💰 Er ging {euro(sparenDezeMaand)} naar Sparen deze maand — met meerdere open doelen tegelijk kan de tool niet zeker weten welk doel dat is, dus voeg 'm hieronder handmatig toe.
                    </p>
                  )}
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
            });
            })()}
          </div>
        )}

        {/* ══ TAKEN ══ */}
        {tab === "taken" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <h2 style={{ margin:0, fontSize:15, fontWeight:800 }}>✅ Taken & herinneringen</h2>
            <div style={{ background:C.surf, borderRadius:12, border:`1px solid ${C.border}`, padding:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:9 }}>+ Nieuwe taak</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))", gap:7, alignItems:"end" }}>
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

            {terugkerend.length > 0 && (
              <div style={{ background:C.surf, borderRadius:12, border:`1px solid ${C.border}`, padding:14, marginTop:4 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:C.text }}>↻ Terugkerende uitgaven</h3>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontWeight:800, fontSize:14, color:C.text }}>{euro(terugkerendTotaal)}/mnd</div>
                    <div style={{ fontSize:10, color:C.muted }}>≈ {euro(terugkerendTotaal*12)}/jaar</div>
                  </div>
                </div>
                <p style={{ margin:"0 0 10px", fontSize:11, color:C.muted }}>Vast gemarkeerd, "elke maand herhalen" of automatisch herkend (3+ maanden)</p>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                  {[{id:"alle", label:"Alle", kleur:C.text}, ...accountOptions.map(a=>({id:a.id, label:a.label, kleur:ACC_COL[a.id]}))].map(f => {
                    const subtotaal = f.id==="alle" ? terugkerendTotaal : terugkerend.filter(e=>e.account===f.id).reduce((s,e)=>s+e.amount,0);
                    const actief = terugkerendAccFilter===f.id;
                    return (
                      <button key={f.id} onClick={()=>setTerugkerendAccFilter(f.id)}
                        style={{ padding:"5px 10px", borderRadius:20, border:`1px solid ${actief?f.kleur:C.border}`, background:actief?`${f.kleur}22`:"transparent", color:actief?f.kleur:C.muted, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                        {f.label} · {euro(subtotaal)}
                      </button>
                    );
                  })}
                </div>
                {terugkerend.filter(e => terugkerendAccFilter==="alle" || e.account===terugkerendAccFilter).map(e => (
                  <div key={e.key} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderTop:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:13 }}>{CAT_ICON[e.category]||"📦"}</span>
                    <span style={{ flex:1, fontSize:12, color:C.text }}>{e.name}</span>
                    <AccountBadge accountId={e.account} names={names} C={C} small/>
                    {!e.fixed && !e.recurring && <span style={{ fontSize:10, background:`${C.purple}22`, color:C.purple, padding:"1px 6px", borderRadius:8 }}>patroon</span>}
                    <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{euro(e.amount)}/mnd</span>
                  </div>
                ))}
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

        {/* ══ INZICHTEN ══ */}
        {tab === "inzichten" && (() => {
          const totalIncome  = totaalInkomenVoorMaand(incomeHistory, incomes, extraInkomsten, selectedMonth);
          const maandExp     = nettoExpenses.filter(e => e.month === selectedMonth);
          const totalSpent   = maandExp.reduce((s,e) => s+e.amount, 0);
          const vastTotaal   = maandExp.filter(e => e.fixed).reduce((s,e) => s+e.amount, 0);
          const vrijBesteed  = totalIncome - vastTotaal;
          const spaarquote   = totalIncome > 0 ? (totalIncome - totalSpent) / totalIncome : 0;

          // ── Boven inkomen / uit reserves ─────────────────────────────────
          // Gebruikt per maand het toen geldende inkomen (incl. geregistreerde
          // salarisveranderingen via Instellingen); zonder geregistreerde
          // wijziging valt het terug op het huidige ingestelde inkomen.
          const reserveMaanden = Array.from({length:12}, (_,i) => {
            const [ry,rm] = selectedMonth.split("-").map(Number);
            const d = new Date(ry, rm-1-11+i, 1);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
          });
          let cumulatiefLopend = 0;
          const reserveData = reserveMaanden.map(m => {
            const spentM = nettoExpenses.filter(e=>e.month===m).reduce((s,e)=>s+e.amount,0);
            const inkomenM = totaalInkomenVoorMaand(incomeHistory, incomes, extraInkomsten, m);
            const verschil = inkomenM - spentM;
            cumulatiefLopend += verschil;
            return { label: fmtM(m), verschil, cumulatief: cumulatiefLopend };
          });
          const tekort12mnd = reserveData[reserveData.length-1].cumulatief;

          const [selJaar, selMaandNr] = selectedMonth.split("-").map(Number);
          const kalenderMaanden = Array.from({length:selMaandNr}, (_,i) => `${selJaar}-${String(i+1).padStart(2,"0")}`);
          const tekortKalenderjaar = kalenderMaanden.reduce((s,m) => {
            const spentM = nettoExpenses.filter(e=>e.month===m).reduce((a,e)=>a+e.amount,0);
            return s + (totaalInkomenVoorMaand(incomeHistory, incomes, extraInkomsten, m) - spentM);
          }, 0);

          const tekortDezeMaand = totalIncome - totalSpent;

          // Grootste categorieën deze maand
          const catNow = {};
          maandExp.forEach(e => { catNow[e.category] = (catNow[e.category]||0) + e.amount; });
          const grootsteCats = Object.entries(catNow).sort((a,b) => b[1]-a[1]).slice(0,5);

          // Stijgers & dalers t.o.v. vorige maand
          const PREV = prevMonth(selectedMonth);
          const catPrev = {};
          nettoExpenses.filter(e => e.month === PREV).forEach(e => { catPrev[e.category] = (catPrev[e.category]||0) + e.amount; });
          const alleCats = new Set([...Object.keys(catNow), ...Object.keys(catPrev)]);
          const bewegingen = [...alleCats].map(cat => {
            const nu = catNow[cat]||0, vorig = catPrev[cat]||0;
            return { cat, nu, vorig, delta: nu - vorig };
          }).filter(m => Math.abs(m.delta) >= 15 && (m.nu >= 30 || m.vorig >= 30))
            .sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0,6);

          // Terugkerende kosten: zie de gedeelde `terugkerend`/`terugkerendTotaal`
          // memo bovenaan het component — gebruikt hier en in Meldingen.

          const attentieAlerts = alerts.filter(a => a.level==="rood" || a.level==="oranje");

          // ── Data voor de nieuwe visuals ──────────────────────────────────
          // 6 maanden inclusief de geselecteerde maand, chronologisch — basis
          // voor zowel de gestapelde maandgrafiek als de heatmap.
          const maandenBereik = Array.from({length:6}, (_,i) => {
            const [y,m] = selectedMonth.split("-").map(Number);
            const d = new Date(y, m-1-i, 1);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
          }).reverse();
          const somPerCatBereik = {};
          maandenBereik.forEach(m => {
            nettoExpenses.filter(e => e.month===m).forEach(e => { somPerCatBereik[e.category] = (somPerCatBereik[e.category]||0) + e.amount; });
          });
          const catRanking = Object.entries(somPerCatBereik).sort((a,b) => b[1]-a[1]).map(([c])=>c);

          // Donut: categorieverdeling deze maand (top 6 + "Overig")
          const donutRaw = Object.entries(catNow).sort((a,b) => b[1]-a[1]);
          const donutData = donutRaw.slice(0,6).map(([name,value]) => ({ name, value }));
          const donutRest = donutRaw.slice(6).reduce((s,[,v]) => s+v, 0);
          if (donutRest > 0) donutData.push({ name:"Overig", value:donutRest });

          // Gestapelde maandgrafiek: top 5 categorieën uit het 6-maands bereik + "Overig"
          const stackCats = catRanking.slice(0,5);
          const stackData = maandenBereik.map(m => {
            const maandExpM = nettoExpenses.filter(e => e.month===m);
            const row = { label: fmtM(m) };
            stackCats.forEach(c => { row[c] = maandExpM.filter(e => e.category===c).reduce((s,e)=>s+e.amount,0); });
            row["Overig"] = maandExpM.filter(e => !stackCats.includes(e.category)).reduce((s,e)=>s+e.amount,0);
            return row;
          });

          // Heatmap: top 8 categorieën × 6 maanden, kleurintensiteit relatief per categorie
          const heatmapCats = catRanking.slice(0,8);

          // Inkomensverdeling-balk
          const overigeUitgaven = Math.max(0, totalSpent - vastTotaal);
          const overschot = totalIncome - totalSpent;
          const inkBasis = Math.max(totalIncome, totalSpent, 1);
          const inkSegments = [
            { label:"Vaste lasten",     bedrag:vastTotaal,          kleur:C.accent },
            { label:"Overige uitgaven", bedrag:overigeUitgaven,     kleur:C.orange },
            { label: overschot>=0 ? "Gespaard" : "Tekort", bedrag:Math.abs(overschot), kleur: overschot>=0 ? C.green : C.red },
          ].filter(s => s.bedrag > 0);

          // ── Bespaartips ───────────────────────────────────────────────────
          // Regelgebaseerd, afgeleid van de data die al op dit scherm staat —
          // geen aparte AI-aanroep nodig.
          const bespaartips = [];
          if (tekortDezeMaand < 0) {
            bespaartips.push({ icon:"🚨", titel:"Je geeft meer uit dan er binnenkomt",
              tekst:`Deze maand ging er ${euro(Math.abs(tekortDezeMaand))} meer uit dan er binnenkwam. Kijk bij "Grootste categorieën" hierboven waar dat vandaan komt.` });
          }
          const STREAMING_NAMEN = ["netflix","hbo max","hbo","disney+","disney plus","videoland","npo plus","spotify","viaplay","amazon prime","prime video"];
          const streamingItems = terugkerend.filter(e => STREAMING_NAMEN.some(s => e.name.toLowerCase().includes(s)));
          if (streamingItems.length >= 3) {
            const streamTotaal = streamingItems.reduce((s,e)=>s+e.amount,0);
            bespaartips.push({ icon:"📺", titel:`${streamingItems.length} streamingdiensten tegelijk actief`,
              tekst:`${streamingItems.map(e=>e.name).join(", ")} kosten samen ${euro(streamTotaal)}/mnd (${euro(streamTotaal*12)}/jaar). Overweeg ze afwisselend per maand te gebruiken in plaats van alles tegelijk aan te houden.` });
          }
          const duursteAbonnement = terugkerend.filter(e => e.category==="Abonnementen" && !streamingItems.includes(e)).sort((a,b)=>b.amount-a.amount)[0];
          if (duursteAbonnement && duursteAbonnement.amount >= 15) {
            bespaartips.push({ icon:"💳", titel:`Duurste losse abonnement: ${duursteAbonnement.name}`,
              tekst:`${euro(duursteAbonnement.amount)}/mnd ≈ ${euro(duursteAbonnement.amount*12)}/jaar. Nog de moeite waard, of tijd om op te zeggen?` });
          }
          const grootsteStijger = bewegingen.filter(m=>m.delta>0)[0];
          if (grootsteStijger) {
            bespaartips.push({ icon:"📈", titel:`${grootsteStijger.cat} steeg het meest`,
              tekst:`Van ${euro(grootsteStijger.vorig)} naar ${euro(grootsteStijger.nu)} t.o.v. ${fmtM(PREV)} — eenmalige piek, of een nieuwe gewoonte?` });
          }
          const overBudget = [...budgetsWithSpent].filter(b=>b.spent>b.amount).sort((a,b)=>(b.spent-b.amount)-(a.spent-a.amount))[0];
          if (overBudget) {
            bespaartips.push({ icon:"🎯", titel:`Budget overschreden: ${overBudget.category}`,
              tekst:`${euro(overBudget.spent-overBudget.amount)} boven het ingestelde budget van ${euro(overBudget.amount)}.` });
          }
          if (totalIncome > 0 && vastTotaal/totalIncome > 0.5) {
            bespaartips.push({ icon:"🏠", titel:"Vaste lasten nemen een groot deel van je inkomen in beslag",
              tekst:`${Math.round(vastTotaal/totalIncome*100)}% van je inkomen gaat naar vaste lasten — de vuistregel is rond de 50%. Check bij Verzekering/Abonnementen of er goedkoper kan.` });
          }
          if (totalIncome > 0 && spaarquote < 0.1) {
            bespaartips.push({ icon:"💰", titel:"Weinig ruimte om te sparen",
              tekst:`Spaarquote van ${Math.round(spaarquote*100)}% deze maand. Een richtlijn van 10-20% helpt om buffer op te bouwen voor onverwachte kosten.` });
          }
          if (bespaartips.length === 0) {
            bespaartips.push({ icon:"✅", titel:"Niets bijzonders te melden",
              tekst:"Op basis van de huidige cijfers springt er niets concreets uit om op te besparen. Goed bezig!" });
          }

          return (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <h2 style={{ margin:0, fontSize:15, fontWeight:800 }}>💡 Inzichten — {fmtM(selectedMonth)}</h2>

              {/* Samenvatting */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:8 }}>
                <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px" }}>
                  <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:.4 }}>Vaste lasten</div>
                  <div style={{ fontWeight:800, fontSize:17, color:C.text, marginTop:2 }}>{euro(vastTotaal)}</div>
                </div>
                <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px" }}>
                  <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:.4 }}>Vrij besteedbaar</div>
                  <div style={{ fontWeight:800, fontSize:17, color:vrijBesteed>=0?C.green:C.red, marginTop:2 }}>{euro(Math.max(0,vrijBesteed))}</div>
                </div>
                <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px" }}>
                  <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:.4 }}>Spaarquote</div>
                  <div style={{ fontWeight:800, fontSize:17, color:spaarquote>=0.2?C.green:spaarquote>=0?C.yellow:C.red, marginTop:2 }}>{Math.round(spaarquote*100)}%</div>
                </div>
              </div>

              {/* Boven inkomen / uit reserves */}
              <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:14 }}>
                <h3 style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.text }}>📉 Boven inkomen — uit reserves</h3>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:8, marginBottom:14 }}>
                  {[
                    { label:"Deze maand", bedrag:tekortDezeMaand },
                    { label:`Kalenderjaar ${selJaar}`, bedrag:tekortKalenderjaar },
                    { label:"Laatste 12 mnd", bedrag:tekort12mnd },
                  ].map(x => (
                    <div key={x.label} style={{ background:C.card, borderRadius:10, padding:"10px 12px" }}>
                      <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:.4 }}>{x.label}</div>
                      <div style={{ fontWeight:800, fontSize:15, color:x.bedrag>=0?C.green:C.red, marginTop:2 }}>
                        {x.bedrag>=0?"+":"−"}{euro(Math.abs(x.bedrag))}
                      </div>
                      <div style={{ fontSize:9, color:C.muted, marginTop:1 }}>{x.bedrag>=0?"overschot":"uit reserves"}</div>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={reserveData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.dim}/>
                    <XAxis dataKey="label" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`}/>
                    <Tooltip contentStyle={{background:C.card,border:"none",borderRadius:8,color:C.text,fontSize:11}} formatter={(v,n)=>[euro(v), n==="cumulatief"?"Cumulatief":"Deze maand"]}/>
                    <ReferenceLine y={0} stroke={C.muted} strokeDasharray="4 2"/>
                    <Line type="monotone" dataKey="cumulatief" stroke={tekort12mnd>=0?C.green:C.red} strokeWidth={2.5} dot={{r:3,fill:tekort12mnd>=0?C.green:C.red,stroke:C.bg,strokeWidth:1.5}}/>
                  </LineChart>
                </ResponsiveContainer>
                <p style={{ margin:"8px 0 0", fontSize:10, color:C.muted, lineHeight:1.5 }}>
                  Cumulatief verschil tussen inkomen en uitgaven, laatste 12 maanden. Onder de nullijn = dat bedrag is per saldo uit spaargeld/reserves gekomen.
                  Houdt rekening met geregistreerde salarisveranderingen (via Instellingen ⚙️) — zonder geregistreerde wijziging wordt het huidige ingestelde inkomen ({euro(totalIncome)}/mnd) aangehouden voor die maand.
                </p>
              </div>

              {/* Inkomensverdeling */}
              <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:14 }}>
                <h3 style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.text }}>💶 Waar gaat het inkomen naartoe</h3>
                {inkSegments.length === 0 ? (
                  <div style={{ fontSize:12, color:C.muted, textAlign:"center", padding:8 }}>Nog geen inkomen of uitgaven ingesteld voor {fmtM(selectedMonth)}</div>
                ) : (
                  <>
                    <div style={{ display:"flex", height:22, borderRadius:8, overflow:"hidden", background:C.card }}>
                      {inkSegments.map(s => (
                        <div key={s.label} title={`${s.label}: ${euro(s.bedrag)}`} style={{ width:`${Math.max(2,s.bedrag/inkBasis*100)}%`, background:s.kleur }}/>
                      ))}
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginTop:10 }}>
                      {inkSegments.map(s => (
                        <div key={s.label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11 }}>
                          <span style={{ width:9, height:9, borderRadius:2, background:s.kleur, display:"inline-block" }}/>
                          <span style={{ color:C.muted }}>{s.label}</span>
                          <span style={{ fontWeight:700 }}>{euro(s.bedrag)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Vraagt aandacht */}
              <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:14 }}>
                <h3 style={{ margin:"0 0 9px", fontSize:13, fontWeight:700, color:C.text }}>⚠️ Vraagt aandacht</h3>
                {attentieAlerts.length === 0 && <div style={{ fontSize:12, color:C.muted, textAlign:"center", padding:8 }}>Niets dat opvalt — het staat er goed voor. 🎉</div>}
                {attentieAlerts.map(a => {
                  const col = a.level==="rood" ? C.red : C.yellow;
                  return (
                    <div key={a.id} style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 0", borderTop:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:16 }}>{a.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{a.title}</div>
                        <div style={{ fontSize:11, color:C.muted }}>{a.body}</div>
                      </div>
                      {a.tab && <button style={{ background:`${col}22`, color:col, border:`1px solid ${col}44`, borderRadius:7, padding:"3px 8px", cursor:"pointer", fontSize:11, fontWeight:700 }} onClick={()=>setTab(a.tab)}>Bekijk →</button>}
                    </div>
                  );
                })}
              </div>

              {/* Grootste categorieën */}
              <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:14 }}>
                <h3 style={{ margin:"0 0 9px", fontSize:13, fontWeight:700, color:C.text }}>🍩 Categorieverdeling deze maand</h3>
                {donutData.length === 0 ? (
                  <div style={{ fontSize:12, color:C.muted, textAlign:"center", padding:8 }}>Nog geen uitgaven in {fmtM(selectedMonth)}</div>
                ) : (
                  <>
                    <div style={{ position:"relative" }}>
                      <ResponsiveContainer width="100%" height={190}>
                        <PieChart>
                          <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2} strokeWidth={0}>
                            {donutData.map((d,i) => <Cell key={i} fill={CAT_COL[d.name]||C.muted}/>)}
                          </Pie>
                          <Tooltip contentStyle={{background:C.card,border:"none",borderRadius:8,color:C.text,fontSize:11}} formatter={(v,n)=>[euro(v),n]}/>
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center", pointerEvents:"none" }}>
                        <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:.4 }}>Totaal</div>
                        <div style={{ fontWeight:800, fontSize:15, color:C.text }}>{euro(totalSpent)}</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center", marginTop:4 }}>
                      {donutData.map(d => (
                        <div key={d.name} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10 }}>
                          <span style={{ width:8, height:8, borderRadius:2, background:CAT_COL[d.name]||C.muted, display:"inline-block" }}/>
                          <span style={{ color:C.muted }}>{d.name==="Overig"?"Overig":`${CAT_ICON[d.name]||""} ${d.name}`}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <h3 style={{ margin:"16px 0 9px", fontSize:13, fontWeight:700, color:C.text, borderTop:`1px solid ${C.border}`, paddingTop:12 }}>🏆 Grootste categorieën</h3>
                {grootsteCats.length === 0 && <div style={{ fontSize:12, color:C.muted, textAlign:"center", padding:8 }}>Nog geen uitgaven in {fmtM(selectedMonth)}</div>}
                {grootsteCats.map(([cat,bedrag]) => {
                  const pct = totalSpent>0 ? Math.round(bedrag/totalSpent*100) : 0;
                  return (
                    <div key={cat} style={{ padding:"7px 0", borderTop:`1px solid ${C.border}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                        <span>{CAT_ICON[cat]||"📦"} {cat}</span>
                        <span style={{ fontWeight:700 }}>{euro(bedrag)} <span style={{ color:C.muted, fontWeight:400 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ background:C.card, borderRadius:4, height:5 }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:CAT_COL[cat]||C.accent, borderRadius:4 }}/>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stijgers & dalers */}
              <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:14 }}>
                <h3 style={{ margin:"0 0 9px", fontSize:13, fontWeight:700, color:C.text }}>📈 Stijgers & dalers t.o.v. {fmtM(PREV)}</h3>
                {bewegingen.length === 0 && <div style={{ fontSize:12, color:C.muted, textAlign:"center", padding:8 }}>Geen opvallende verschuivingen — vrij stabiel maandje.</div>}
                {bewegingen.map(m => (
                  <div key={m.cat} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderTop:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:14 }}>{m.delta>0?"📈":"📉"}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600 }}>{CAT_ICON[m.cat]||"📦"} {m.cat}</div>
                      <div style={{ fontSize:11, color:C.muted }}>{euro(m.vorig)} → {euro(m.nu)}</div>
                    </div>
                    <span style={{ fontWeight:700, fontSize:13, color:m.delta>0?C.red:C.green }}>{m.delta>0?"+":""}{euro(m.delta)}</span>
                  </div>
                ))}
              </div>

              {/* Gestapelde maandgrafiek: samenstelling over tijd */}
              <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:14 }}>
                <h3 style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:C.text }}>📊 Samenstelling per maand</h3>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={stackData} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke={C.dim}/>
                    <XAxis dataKey="label" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`}/>
                    <Tooltip contentStyle={{background:C.card,border:"none",borderRadius:8,color:C.text,fontSize:11}} formatter={(v,n)=>[euro(v),n]}/>
                    {stackCats.map(c => <Bar key={c} dataKey={c} stackId="a" fill={CAT_COL[c]||C.accent}/>)}
                    <Bar dataKey="Overig" stackId="a" fill={C.muted} radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center", marginTop:6 }}>
                  {[...stackCats,"Overig"].map(c => (
                    <div key={c} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10 }}>
                      <span style={{ width:8, height:8, borderRadius:2, background:c==="Overig"?C.muted:(CAT_COL[c]||C.accent), display:"inline-block" }}/>
                      <span style={{ color:C.muted }}>{c==="Overig"?"Overig":`${CAT_ICON[c]||""} ${c}`}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Heatmap: categorie × maand */}
              <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:14, overflowX:"auto" }}>
                <h3 style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:C.text }}>🔥 Patronen per categorie</h3>
                <p style={{ margin:"0 0 10px", fontSize:11, color:C.muted }}>
                  Kleurintensiteit is relatief per categorie — zo zie je pieken, ook bij kleinere categorieën.
                </p>
                {heatmapCats.length === 0 ? (
                  <div style={{ fontSize:12, color:C.muted, textAlign:"center", padding:8 }}>Nog niet genoeg data voor een patroon.</div>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns:`88px repeat(${maandenBereik.length}, 1fr)`, gap:3, minWidth:340 }}>
                    <div/>
                    {maandenBereik.map(m => (
                      <div key={m} style={{ fontSize:9, color:C.muted, textAlign:"center" }}>{fmtM(m).split(" ")[0]}</div>
                    ))}
                    {heatmapCats.map(cat => {
                      const rowVals = maandenBereik.map(m => nettoExpenses.filter(e => e.category===cat && e.month===m).reduce((s,e)=>s+e.amount,0));
                      const maxVal = Math.max(...rowVals, 1);
                      return (
                        <React.Fragment key={cat}>
                          <div style={{ fontSize:10, color:C.text, display:"flex", alignItems:"center", gap:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            {CAT_ICON[cat]||"📦"} {cat.length>9?cat.slice(0,8)+"…":cat}
                          </div>
                          {rowVals.map((v,i) => {
                            const intensity = v / maxVal;
                            const alphaHex = v===0 ? "00" : Math.round(35 + intensity*180).toString(16).padStart(2,"0");
                            return (
                              <div key={i} title={`${cat} · ${fmtM(maandenBereik[i])}: ${euro(v)}`}
                                style={{ height:26, borderRadius:5, background:v===0?C.card:`${CAT_COL[cat]||C.accent}${alphaHex}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                {v>0 && <span style={{ fontSize:8, color:C.text, opacity:0.85 }}>{v>=1000?Math.round(v/1000)+"k":Math.round(v)}</span>}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Terugkerende kosten */}
              <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
                  <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:C.text }}>🔁 Terugkerende kosten</h3>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontWeight:800, fontSize:14, color:C.text }}>{euro(terugkerendTotaal)}/mnd</div>
                    <div style={{ fontSize:10, color:C.muted }}>≈ {euro(terugkerendTotaal*12)}/jaar</div>
                  </div>
                </div>
                <p style={{ margin:"0 0 9px", fontSize:11, color:C.muted }}>
                  Abonnementen en vaste lasten — handig om sluimerende kosten te spotten die je niet meer actief gebruikt.
                </p>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                  {[{id:"alle", label:"Alle", kleur:C.text}, ...accountOptions.map(a=>({id:a.id, label:a.label, kleur:ACC_COL[a.id]}))].map(f => {
                    const subtotaal = f.id==="alle" ? terugkerendTotaal : terugkerend.filter(e=>e.account===f.id).reduce((s,e)=>s+e.amount,0);
                    const actief = terugkerendAccFilter===f.id;
                    return (
                      <button key={f.id} onClick={()=>setTerugkerendAccFilter(f.id)}
                        style={{ padding:"5px 10px", borderRadius:20, border:`1px solid ${actief?f.kleur:C.border}`, background:actief?`${f.kleur}22`:"transparent", color:actief?f.kleur:C.muted, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                        {f.label} · {euro(subtotaal)}
                      </button>
                    );
                  })}
                </div>
                {terugkerend.length === 0 && <div style={{ fontSize:12, color:C.muted, textAlign:"center", padding:8 }}>Nog niets gemarkeerd als vast of herhalend.</div>}
                {terugkerend.filter(e => terugkerendAccFilter==="alle" || e.account===terugkerendAccFilter).map(e => (
                  <div key={e.key} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderTop:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:13 }}>{CAT_ICON[e.category]||"📦"}</span>
                    <span style={{ flex:1, fontSize:12, color:C.text }}>{e.name}</span>
                    <AccountBadge accountId={e.account} names={names} C={C} small/>
                    {!e.fixed && !e.recurring && <span style={{ fontSize:10, background:`${C.purple}22`, color:C.purple, padding:"1px 6px", borderRadius:8 }}>patroon</span>}
                    <span style={{ fontSize:10, color:C.muted }}>≈{euro(e.amount*12)}/jr</span>
                    <span style={{ fontWeight:700, fontSize:13 }}>{euro(e.amount)}</span>
                  </div>
                ))}
              </div>

              {/* Bespaartips */}
              <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:14 }}>
                <h3 style={{ margin:"0 0 9px", fontSize:13, fontWeight:700, color:C.text }}>💡 Bespaartips</h3>
                {bespaartips.map((t,i) => (
                  <div key={i} style={{ display:"flex", gap:9, padding:"8px 0", borderTop: i===0?"none":`1px solid ${C.border}` }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{t.icon}</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{t.titel}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:2, lineHeight:1.5 }}>{t.tekst}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ══ DASHBOARD ══ */}
        {tab === "dashboard" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

            {/* Bank-sync status — maakt de handmatige CSV-import voelbaar 'bijgehouden' */}
            {(() => {
              const dagenGeleden = laatsteBankImport ? Math.floor((Date.now() - laatsteBankImport) / (1000*60*60*24)) : null;
              const vers = dagenGeleden !== null && dagenGeleden <= 3;
              const veroudend = dagenGeleden !== null && dagenGeleden > 3 && dagenGeleden <= 7;
              const kleur = laatsteBankImport === null ? C.muted : vers ? C.green : veroudend ? C.yellow : C.red;
              return (
                <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ width:9, height:9, borderRadius:"50%", background:kleur, flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:12, fontWeight:700, color:C.text }}>
                      {laatsteBankImport === null
                        ? "Nog geen bank-import gedaan"
                        : dagenGeleden === 0 ? "Vandaag bijgewerkt vanuit de bank"
                        : dagenGeleden === 1 ? "Gisteren bijgewerkt vanuit de bank"
                        : `${dagenGeleden} dagen geleden bijgewerkt vanuit de bank`}
                    </p>
                    <p style={{ margin:0, fontSize:11, color:C.muted }}>
                      {laatsteBankImport === null ? "Importeer je Rabobank-CSV om te beginnen" : !vers ? "Tijd voor een nieuwe export uit je bank-app?" : "Lekker actueel"}
                    </p>
                  </div>
                  <button onClick={() => csvRef.current?.click()} style={{ background:vers?"none":C.accent, color:vers?C.accent:"#FFF", border:`1px solid ${C.accent}`, borderRadius:8, padding:"6px 12px", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                    📂 Nu bijwerken
                  </button>
                </div>
              );
            })()}

            {/* 6-maanden trend grafiek */}
            {(() => {
              const maanden = Array.from({length:6}, (_,i) => {
                const d = new Date(_now.getFullYear(), _now.getMonth() - i, 1);
                return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
              }).reverse();
              const trendData = maanden.map(m => ({
                label: fmtM(m),
                totaal: nettoExpenses.filter(e => e.month === m).reduce((s,e) => s+e.amount, 0),
                inkomen: totaalInkomenVoorMaand(incomeHistory, incomes, extraInkomsten, m),
              }));
              const maxVal = Math.max(...trendData.map(d => Math.max(d.totaal, d.inkomen)), 1);
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
                      <Line type="stepAfter" dataKey="inkomen" stroke={C.green} strokeWidth={1.5} strokeDasharray="4 2" dot={false}/>
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
                totaal: nettoExpenses.filter(e => e.month === m).reduce((s,e) => s+e.amount, 0),
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
              {[{id:"p1",label:`👤 ${names.p1}`,income:incomeForMonthPersoon(incomeHistory, incomes, "p1", selectedMonth),bijdrage:bijdrageP1Aftrek},
                {id:"p2",label:`👤 ${names.p2}`,income:incomeForMonthPersoon(incomeHistory, incomes, "p2", selectedMonth),bijdrage:bijdrageP2Aftrek},
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
              const vast = nettoExpenses.filter(e => e.fixed && e.month === selectedMonth);
              const vastTot = vast.reduce((s,e) => s+e.amount, 0);
              const variabel = totaalInkomenVoorMaand(incomeHistory, incomes, extraInkomsten, selectedMonth) - vastTot - bijdrageP1Aftrek - bijdrageP2Aftrek;
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
                  {vast.length === 0 && <div style={{ fontSize:12, color:C.muted, textAlign:"center", padding:8 }}>Nog geen vaste lasten — ga naar "Uitgaven" en klik een preset aan bij "Snel een vaste last toevoegen"</div>}
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
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:3 }}>📌 Snel een vaste last toevoegen</div>
              <p style={{ margin:"0 0 9px", fontSize:11, color:C.muted }}>
                Klik een terugkerende kost aan. Staat 'ie al in je geïmporteerde transacties, dan wordt die meteen als vaste last gemarkeerd (geen nieuwe regel). Staat 'ie er nog niet in, dan vul je zelf even het bedrag in.
              </p>
              {vasteLastMatch && (
                <div style={{ background:`${C.accent}15`, border:`1px solid ${C.accent}40`, borderRadius:10, padding:"10px 12px", marginBottom:10 }}>
                  <p style={{ margin:"0 0 6px", fontSize:12, color:C.text }}>
                    Gevonden in je transacties: <strong>{vasteLastMatch.expense.name}</strong> · {euro(vasteLastMatch.expense.amount)} · {fmtM(vasteLastMatch.expense.month)}
                  </p>
                  <div style={{ display:"flex", gap:8 }}>
                    <button style={{ ...S.btn(C.dim, C.text), flex:1, padding:"7px 0", fontSize:12 }} onClick={()=>setVasteLastMatch(null)}>Annuleer</button>
                    <button style={{ ...S.btn(C.accent), flex:1, padding:"7px 0", fontSize:12 }} onClick={bevestigGevondenVasteLast}>✓ Markeer als vaste last</button>
                  </div>
                </div>
              )}
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {VASTE_LASTEN_PRESETS.map(p => (
                  <button key={p.naam} onClick={()=>kiesVasteLast(p)}
                    style={{ background:expForm.name===p.naam?`${CAT_COL[p.categorie]||C.accent}33`:C.card, border:`1px solid ${expForm.name===p.naam?CAT_COL[p.categorie]||C.accent:C.border}`, borderRadius:20, padding:"5px 11px", fontSize:11, cursor:"pointer", color:expForm.name===p.naam?CAT_COL[p.categorie]||C.accent:C.text, fontWeight:expForm.name===p.naam?700:500, whiteSpace:"nowrap" }}>
                    {CAT_ICON[p.categorie]||"📦"} {p.naam}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background:C.surf, borderRadius:11, border:`1px solid ${C.border}`, padding:13 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:9 }}>+ Nieuwe uitgave</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))", gap:7, alignItems:"end" }}>
                <div><Label C={C}>Naam</Label><input style={S.inp} placeholder="Omschrijving" value={expForm.name} onChange={e=>setExpForm(p=>({...p,name:e.target.value}))}/></div>
                <div><Label C={C}>€</Label><input ref={vasteBedragRef} style={S.inp} type="number" min="0" step="0.01" placeholder="0.00" value={expForm.amount} onChange={e=>setExpForm(p=>({...p,amount:e.target.value}))}/></div>
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

            {(() => {
              const alleeMaanden = [...new Set(expenses.map(e=>e.month))].sort();
              const vanaf = alleeMaanden[0], tot = alleeMaanden[alleeMaanden.length-1];
              const kanTerug  = uitgavenPeriode==="maand" && vanaf && selectedMonth > vanaf;
              const kanVooruit = uitgavenPeriode==="maand" && selectedMonth < NOW_MONTH;
              return (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    <button onClick={()=>setUitgavenPeriode("alles")}
                      style={{ padding:"5px 11px", borderRadius:20, border:`1px solid ${uitgavenPeriode==="alles"?C.accent:C.border}`, background:uitgavenPeriode==="alles"?`${C.accent}22`:"transparent", color:uitgavenPeriode==="alles"?C.accent:C.muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      Alle tijd
                    </button>
                    <button onClick={()=>setUitgavenPeriode("maand")}
                      style={{ padding:"5px 11px", borderRadius:20, border:`1px solid ${uitgavenPeriode==="maand"?C.accent:C.border}`, background:uitgavenPeriode==="maand"?`${C.accent}22`:"transparent", color:uitgavenPeriode==="maand"?C.accent:C.muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      Alleen {fmtM(selectedMonth)}
                    </button>
                    {uitgavenPeriode==="maand" && (
                      <div style={{ display:"flex", gap:3, marginLeft:2 }}>
                        <button disabled={!kanTerug} onClick={()=>setSelectedMonth(prevMonth(selectedMonth))}
                          style={{ width:26, height:26, borderRadius:"50%", border:`1px solid ${C.border}`, background:C.surf, color:kanTerug?C.text:C.dim, cursor:kanTerug?"pointer":"default", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          ‹
                        </button>
                        <button disabled={!kanVooruit} onClick={()=>setSelectedMonth(nextMonth(selectedMonth))}
                          style={{ width:26, height:26, borderRadius:"50%", border:`1px solid ${C.border}`, background:C.surf, color:kanVooruit?C.text:C.dim, cursor:kanVooruit?"pointer":"default", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          ›
                        </button>
                      </div>
                    )}
                  </div>
                  {uitgavenPeriode==="alles" && vanaf && tot && (
                    <span style={{ fontSize:11, color:C.muted }}>
                      📅 {fmtM(vanaf)} t/m {fmtM(tot)} ({alleeMaanden.length} maanden — dit zijn cumulatieve totalen over die hele periode, geen maandbedragen)
                    </span>
                  )}
                  {uitgavenPeriode==="maand" && vanaf && !kanTerug && (
                    <span style={{ fontSize:11, color:C.muted }}>📅 Dit is de eerste maand met data ({fmtM(vanaf)})</span>
                  )}
                </div>
              );
            })()}

            <div style={{ position:"relative" }}>
              <input style={{...S.inp, paddingLeft:32}} placeholder="🔍 Zoeken in uitgaven (naam of categorie)…"
                value={uitgavenZoek} onChange={e=>setUitgavenZoek(e.target.value)}/>
              {uitgavenZoek && (
                <button onClick={()=>setUitgavenZoek("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:14 }}>×</button>
              )}
            </div>

            {accountOptions.map(acc => {
              const aeAll = filteredExpenses.filter(e => e.account === acc.id);
              if (!aeAll.length) return null;
              const zoekActief = uitgavenZoek.trim().length > 0;
              const zoekLc = uitgavenZoek.trim().toLowerCase();
              const ae = zoekActief
                ? aeAll.filter(e => e.name.toLowerCase().includes(zoekLc) || e.category.toLowerCase().includes(zoekLc))
                : aeAll;
              if (zoekActief && !ae.length) return null;

              const perCategorie = {};
              ae.forEach(e => { (perCategorie[e.category] = perCategorie[e.category] || []).push(e); });
              const categorieen = Object.keys(perCategorie).sort((a,b) =>
                perCategorie[b].reduce((s,e)=>s+e.amount,0) - perCategorie[a].reduce((s,e)=>s+e.amount,0));

              return (
                <div key={acc.id} style={{ background:C.surf, borderRadius:11, border:`2px solid ${ACC_COL[acc.id]}33`, overflow:"hidden" }}>
                  <div style={{ background:C.card, padding:"9px 14px", display:"flex", justifyContent:"space-between" }}>
                    <AccountBadge accountId={acc.id} names={names} C={C}/>
                    <span style={{ fontWeight:700, fontSize:13 }}>{euro(ae.reduce((s,e)=>s+e.amount,0))}</span>
                  </div>
                  {categorieen.map(cat => {
                    const items = perCategorie[cat];
                    const key = `${acc.id}::${cat}`;
                    const open = zoekActief || !!uitgeklapt[key];
                    const subtotaal = items.reduce((s,e)=>s+e.amount,0);
                    return (
                      <div key={cat}>
                        <div onClick={()=>setUitgeklapt(p=>({...p,[key]:!p[key]}))}
                          style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 14px", borderTop:`1px solid ${C.border}`, cursor:"pointer" }}>
                          <span style={{ fontSize:11, color:C.muted, display:"inline-block", width:10, transform:open?"rotate(90deg)":"none", transition:"transform 0.15s" }}>›</span>
                          <span style={{ fontSize:13 }}>{CAT_ICON[cat]||"📦"}</span>
                          <span style={{ flex:1, fontSize:12, fontWeight:600, color:C.text }}>{cat}</span>
                          <span style={{ fontSize:11, color:C.muted }}>{items.length}×</span>
                          <span style={{ fontWeight:700, fontSize:12 }}>{euro(subtotaal)}</span>
                        </div>
                        {open && items.map(e => {
                          const overlaptCreditcard = e.category === "Afschrijving creditcard" && e.bron !== "creditcard"
                            && expenses.some(x => x.bron === "creditcard" && x.month === e.month);
                          return (
                            <div key={e.id} style={{ padding:"8px 14px 8px 32px", display:"flex", alignItems:"flex-start", gap:8, borderTop:`1px solid ${C.border}`, opacity:(overlaptCreditcard||e.genegeerd)?0.55:1 }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <span style={{ fontSize:13, textDecoration:e.genegeerd?"line-through":"none" }}>{e.name}</span>
                                {e.note && <div style={{ fontSize:11, color:C.muted, fontStyle:"italic", marginTop:2 }}>📝 {e.note}</div>}
                                {overlaptCreditcard && <div style={{ fontSize:10, color:C.orange, marginTop:2 }}>⚠️ Niet meegeteld — al uitgesplitst via creditcard-import</div>}
                                {e.genegeerd && <div style={{ fontSize:10, color:C.red, marginTop:2 }}>🚫 Genegeerd — telt nergens meer mee (eenmalige/ruis-afboeking)</div>}
                              </div>
                              <span style={{ fontSize:11, color:C.muted }}>{fmtM(e.month)}</span>
                              <button onClick={()=>toggleFixed(e.id)} title="Tik om vaste last aan/uit te zetten"
                                style={{ fontSize:10, background:e.fixed?`${C.accent}22`:"transparent", color:e.fixed?C.accent:C.muted, border:`1px solid ${e.fixed?C.accent:C.border}`, padding:"2px 7px", borderRadius:8, cursor:"pointer", whiteSpace:"nowrap" }}>
                                {e.fixed ? "✓ vast" : "+ vast"}
                              </button>
                              <button onClick={()=>toggleGenegeerd(e.id)} title="Tik om deze afboeking wel/niet mee te tellen"
                                style={{ fontSize:10, background:e.genegeerd?`${C.red}22`:"transparent", color:e.genegeerd?C.red:C.muted, border:`1px solid ${e.genegeerd?C.red:C.border}`, padding:"2px 7px", borderRadius:8, cursor:"pointer", whiteSpace:"nowrap" }}>
                                {e.genegeerd ? "🚫 genegeerd" : "negeer"}
                              </button>
                              {e.recurring && <span style={{ fontSize:10, background:`${C.purple}22`, color:C.purple, padding:"1px 6px", borderRadius:8 }}>🔁</span>}
                              {e.fromBank  && <span style={{ fontSize:10, background:`${C.green}22`,  color:C.green,  padding:"1px 6px", borderRadius:8 }}>bank</span>}
                              <WieBadge persoon={e.addedBy} tijdstip={e.addedAt} />
                              <span style={{ fontWeight:700, fontSize:13, textDecoration:e.genegeerd?"line-through":"none" }}>{euro(e.amount)}</span>
                              <button onClick={()=>delExpense(e.id)} style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:13 }}>×</button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
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
            <div style={{ background:C.surf, border:`1px solid ${C.accent}44`, borderRadius:13, padding:20 }}>
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

              {Object.keys(categorieMap).length > 0 && (
                <div style={{ background:C.card, borderRadius:10, padding:11, marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:7 }}>🏷️ Geleerde categorieën ({Object.keys(categorieMap).length})</div>
                  <div style={{ maxHeight:160, overflowY:"auto" }}>
                    {Object.entries(categorieMap).map(([sleutel, cat]) => (
                      <div key={sleutel} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                        <span style={{ fontSize:11, color:C.text, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sleutel}</span>
                        <span style={{ color:C.muted, fontSize:11 }}>→</span>
                        <select value={cat} onChange={e=>setCategorieMap(p=>({...p,[sleutel]:e.target.value}))}
                          style={{ ...S.inp, width:"auto", fontSize:11, padding:"3px 7px" }}>
                          {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                        </select>
                        <button onClick={()=>setCategorieMap(p=>{const n={...p};delete n[sleutel];return n;})}
                          style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:12 }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ background:C.card, borderRadius:10, padding:11, marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:7 }}>🏦 Bekende rekeningnummers → categorie</div>
                <p style={{ fontSize:10, color:C.muted, margin:"0 0 8px", lineHeight:1.5 }}>
                  Een overschrijving náár zo'n rekening (bv. de gezamenlijke rekening) krijgt altijd deze categorie, ongeacht de omschrijving.
                </p>
                {Object.entries(bekendeIbans).map(([iban, cat]) => (
                  <div key={iban} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                    <span style={{ fontSize:11, color:C.text, fontFamily:"monospace", flex:1 }}>{iban}</span>
                    <span style={{ color:C.muted, fontSize:11 }}>→</span>
                    <select value={cat} onChange={e=>setBekendeIbans(p=>({...p,[iban]:e.target.value}))}
                      style={{ ...S.inp, width:"auto", fontSize:11, padding:"3px 7px" }}>
                      {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                    </select>
                    <button onClick={()=>setBekendeIbans(p=>{const n={...p};delete n[iban];return n;})}
                      style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:12 }}>×</button>
                  </div>
                ))}
                <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
                  <input placeholder="NL.. rekeningnummer" value={nieuweIbanInput} onChange={e=>setNieuweIbanInput(e.target.value)}
                    style={{ ...S.inp, flex:"1 1 160px", fontSize:11, padding:"5px 9px", fontFamily:"monospace" }} />
                  <select value={nieuweIbanCategorie} onChange={e=>setNieuweIbanCategorie(e.target.value)}
                    style={{ ...S.inp, width:"auto", fontSize:11, padding:"5px 9px" }}>
                    {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                  <button style={{ ...S.btn(C.accent), fontSize:11, padding:"5px 12px" }}
                    onClick={()=>{
                      const iban = nieuweIbanInput.replace(/\s/g,"").toUpperCase();
                      if (!iban) return;
                      setBekendeIbans(p=>({...p,[iban]:nieuweIbanCategorie}));
                      setNieuweIbanInput("");
                    }}>+ Toevoegen</button>
                </div>
              </div>

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

            {/* Creditcard CSV-import — los van de bank-CSV, geen IBAN-koppeling nodig */}
            <div style={{ background:C.surf, border:`1px solid ${C.accent}44`, borderRadius:13, padding:20 }}>
              <div style={{ display:"flex", gap:12, marginBottom:14 }}>
                <span style={{ fontSize:26 }}>💳</span>
                <div>
                  <h2 style={{ margin:0, fontSize:16, fontWeight:800 }}>Creditcard CSV-import</h2>
                  <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>Vaak abonnementen/eenmalige aankopen · zelfde dubbele-detectie en geleerde categorieën als bij de bank-CSV</p>
                </div>
              </div>

              <div style={{ background:C.card, borderRadius:10, padding:11, marginBottom:12, fontSize:11, color:C.muted, lineHeight:1.6 }}>
                📋 Exporteer het afschrift van je creditcardmaatschappij (bv. ICS) als CSV, meestal via hun app/website onder "Afschriften" of "Transacties"
              </div>

              <div style={{ border:`2px dashed ${csvImport ? C.green : C.border}`, borderRadius:12, padding:22, textAlign:"center", cursor:"pointer" }}
                onClick={()=>creditcardCsvRef.current?.click()}
                onDrop={e=>{e.preventDefault();handleCreditcardCSV(e.dataTransfer.files[0]);}}
                onDragOver={e=>e.preventDefault()}>
                <input ref={creditcardCsvRef} type="file" accept=".csv" style={{ display:"none" }} onChange={e=>handleCreditcardCSV(e.target.files[0])}/>
                <div style={{ fontSize:26, marginBottom:4 }}>💳</div><div style={{ fontWeight:700 }}>Sleep CSV of klik</div><div style={{ color:C.muted, fontSize:11, marginTop:2 }}>Creditcard-afschrift .csv</div>
              </div>

              <p style={{ fontSize:10, color:C.muted, margin:"8px 0 0", lineHeight:1.5 }}>
                ⚠️ Creditcard-afschriften verschillen per kaartuitgever. Lukt het inlezen niet goed, stuur dan een voorbeeldbestand door — dan stem ik de import daarop af, zoals ook bij de bank-CSV is gebeurd.
              </p>
            </div>

            {csvImport?.length > 0 && (
              <div style={{ background:C.surf, borderRadius:13, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                {csvDubbelCount > 0 && (
                  <div style={{ padding:"8px 16px", background:`${C.yellow}15`, borderBottom:`1px solid ${C.border}`, fontSize:11, color:C.yellow }}>
                    ℹ️ {csvDubbelCount} transactie{csvDubbelCount !== 1 ? "s" : ""} stond{csvDubbelCount === 1 ? "" : "en"} al in Budget en {csvDubbelCount === 1 ? "is" : "zijn"} overgeslagen
                  </div>
                )}
                <div style={{ padding:"11px 16px", background:C.card, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                  <div>
                    <span style={{ fontWeight:700, fontSize:13 }}>{csvImport.length} nieuwe transacties</span>
                    <span style={{ color:C.muted, fontSize:11, marginLeft:8 }}>· {euro(csvImport.reduce((s,r)=>s+r.amount,0))} totaal</span>
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    <button style={S.btn(`${C.red}88`, C.text)} onClick={()=>{setCsvImport(null); setCsvDubbelCount(0);}}>Annuleer</button>
                    <button style={S.btn(C.green)} onClick={()=>confirmCSV(csvImport)}>✅ Importeer ({csvImport.length})</button>
                  </div>
                </div>
                <div style={{ padding:"9px 16px", background:`${C.accent}0F`, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <span style={{ fontSize:11, color:C.muted, whiteSpace:"nowrap" }}>💡 Deze hele CSV komt van één rekening? Zet 'm in één keer (wordt onthouden voor volgende keer):</span>
                  <select defaultValue="" onChange={e=>{
                      if (!e.target.value) return;
                      const gekozenAccount = e.target.value;
                      setCsvImport(r => r.map(row => ({ ...row, account: gekozenAccount })));
                      // Onthoud deze koppeling ook voor de IBAN('s) in dit bestand, zodat
                      // een volgende import van dezelfde rekening dit niet meer vraagt.
                      const ibans = [...new Set(csvImport.map(row => row.iban).filter(Boolean))];
                      setIbanMap(prev => {
                        const next = { ...prev };
                        ibans.forEach(iban => { next[iban] = gekozenAccount; });
                        return next;
                      });
                      e.target.value = "";
                    }}
                    style={{ ...S.inp, width:"auto", fontSize:11, padding:"5px 9px" }}>
                    <option value="">Alle {csvImport.length} rijen naar…</option>
                    {accountOptions.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </div>
                <div style={{ maxHeight:400, overflowY:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <thead style={{ position:"sticky", top:0, background:C.card }}>
                      <tr>{["Omschrijving","Maand","Bedrag","Categorie","Rekening",""].map(h=><th key={h} style={{ padding:"7px 12px", textAlign:"left", color:C.muted, fontWeight:600, fontSize:11, borderBottom:`1px solid ${C.border}` }}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {csvImport.slice(csvReviewPagina*CSV_PAGINA_GROOTTE, (csvReviewPagina+1)*CSV_PAGINA_GROOTTE).map((row,iRel) => {
                        const i = csvReviewPagina*CSV_PAGINA_GROOTTE + iRel;
                        return (
                        <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                          <td style={{ padding:"6px 12px", maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{row.name}</td>
                          <td style={{ padding:"6px 12px", color:C.muted }}>{fmtM(row.month)}</td>
                          <td style={{ padding:"6px 12px", fontWeight:700, color:C.red }}>-{euro(row.amount)}</td>
                          <td style={{ padding:"6px 12px" }}>
                            <select value={row.category} onChange={e=>{
                                const nieuweCategorie = e.target.value;
                                // Pas toe op álle rijen in deze import met dezelfde tegenpartij —
                                // niet alleen deze ene rij — zodat je maar één keer hoeft te corrigeren.
                                setCsvImport(r => r.map(x => x.categorieSleutel === row.categorieSleutel ? { ...x, category: nieuweCategorie } : x));
                                // En onthoud de koppeling voor toekomstige imports van dezelfde tegenpartij.
                                if (row.categorieSleutel) setCategorieMap(prev => ({ ...prev, [row.categorieSleutel]: nieuweCategorie }));
                              }}
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {csvImport.length > CSV_PAGINA_GROOTTE && (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", borderTop:`1px solid ${C.border}`, background:C.card }}>
                    <button style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", color:csvReviewPagina===0?C.muted:C.text, cursor:csvReviewPagina===0?"default":"pointer", fontSize:12, opacity:csvReviewPagina===0?0.5:1 }}
                      disabled={csvReviewPagina===0} onClick={()=>setCsvReviewPagina(p=>p-1)}>← Vorige</button>
                    <span style={{ fontSize:11, color:C.muted }}>
                      {csvReviewPagina*CSV_PAGINA_GROOTTE+1}–{Math.min((csvReviewPagina+1)*CSV_PAGINA_GROOTTE, csvImport.length)} van {csvImport.length}
                    </span>
                    <button style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", color:(csvReviewPagina+1)*CSV_PAGINA_GROOTTE>=csvImport.length?C.muted:C.text, cursor:(csvReviewPagina+1)*CSV_PAGINA_GROOTTE>=csvImport.length?"default":"pointer", fontSize:12, opacity:(csvReviewPagina+1)*CSV_PAGINA_GROOTTE>=csvImport.length?0.5:1 }}
                      disabled={(csvReviewPagina+1)*CSV_PAGINA_GROOTTE>=csvImport.length} onClick={()=>setCsvReviewPagina(p=>p+1)}>Volgende →</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

        {/* ══ MAANDAFSLUITING ══ */}
        {tab === "afsluiting" && (() => {
          const totaalUit  = Object.values(totalByAccount).reduce((s,v)=>s+v,0);
          const totaalIn   = totaalInkomenVoorMaand(incomeHistory, incomes, extraInkomsten, selectedMonth);
          const gespaard   = totaalIn - totaalUit;
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
