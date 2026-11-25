// ════════════════════════════════════════════════════════════════════
// Taken — pure rekenlogica, gedeeld door de Taken-pagina, de Lijsten-
// pagina (to-do-lijsten), de API-routes en de tests.
//
// Bewust ZONDER imports: alles hier is puur (geen Redis, geen fetch, geen
// klok tenzij die wordt meegegeven), zodat de tests dit bestand rechtstreeks
// kunnen laden en elke functie los kunnen controleren.
//
// Datums zijn altijd "JJJJ-MM-DD"-strings in lokale (Nederlandse) tijd en
// herinneringen "JJJJ-MM-DDTUU:MM" — precies wat <input type="date"> en
// <input type="datetime-local"> opleveren. Nooit toISOString() gebruiken
// voor een kalenderdatum: dat schuift rond middernacht een dag op.
// ════════════════════════════════════════════════════════════════════

export const PERSONEN = ["Pepijn", "Tessa"];

export function persoonSlug(naam) {
  return PERSONEN.includes(naam) ? naam.toLowerCase() : null;
}

// ── Datums ─────────────────────────────────────────────────────────
export function datumNaarStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function strNaarDatum(s) {
  const [j, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return new Date(j, m - 1, d);
}
export function vandaagStr(nu = new Date()) {
  return datumNaarStr(nu);
}
export function plusDagen(datumStr, n) {
  const d = strNaarDatum(datumStr);
  d.setDate(d.getDate() + n);
  return datumNaarStr(d);
}
export function dagenTussen(vanStr, totStr) {
  // Via UTC-middernacht rekenen, zodat de zomertijd-overgang (een dag van
  // 23 of 25 uur) het aantal dagen niet scheef trekt.
  const [a, b] = [vanStr, totStr].map(s => {
    const [j, m, d] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(j, m - 1, d);
  });
  return Math.round((b - a) / 86400000);
}
// Maandag = 1 … zondag = 7 (ISO), handiger dan JS' zondag = 0.
export function isoWeekdag(datumStr) {
  const w = strNaarDatum(datumStr).getDay();
  return w === 0 ? 7 : w;
}

// ── Herhaling ──────────────────────────────────────────────────────
// Oude to-do's hebben herhaling als string ("dagelijks", "wekelijks",
// "maandelijks"); nieuwe als object { freq, interval, dagen }. Alles gaat
// eerst door normaliseerHerhaling, zodat beide vormen blijven werken.
export const HERHAAL_FREQS = ["dag", "week", "maand", "jaar"];

export function normaliseerHerhaling(h) {
  if (!h) return null;
  if (typeof h === "string") {
    return ({
      dagelijks: { freq: "dag", interval: 1 },
      werkdagen: { freq: "week", interval: 1, dagen: [1, 2, 3, 4, 5] },
      wekelijks: { freq: "week", interval: 1 },
      maandelijks: { freq: "maand", interval: 1 },
      jaarlijks: { freq: "jaar", interval: 1 },
    })[h] || null;
  }
  if (typeof h !== "object" || !HERHAAL_FREQS.includes(h.freq)) return null;
  const interval = Math.max(1, Math.min(365, Math.floor(+h.interval || 1)));
  const dagen = h.freq === "week" && Array.isArray(h.dagen)
    ? [...new Set(h.dagen.map(Number).filter(d => d >= 1 && d <= 7))].sort((a, b) => a - b)
    : [];
  return dagen.length ? { freq: h.freq, interval, dagen } : { freq: h.freq, interval };
}

function plusMaanden(datumStr, n) {
  // setMonth() op 31 januari + 1 maand rolt door naar 3 maart; daarom eerst
  // naar de 1e, maand ophogen, en de dag klemmen op de laatste geldige dag.
  const d = strNaarDatum(datumStr);
  const dag = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const laatste = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dag, laatste));
  return datumNaarStr(d);
}

// Volgende datum na `datumStr` volgens de herhaling. Rekent vanaf de
// HUIDIGE vervaldatum, niet vanaf de dag van afvinken — anders schuift een
// taak die je een paar dagen laat liggen steeds verder op.
export function volgendeHerhalingsDatum(datumStr, herhaling) {
  const h = normaliseerHerhaling(herhaling);
  if (!h || !datumStr) return datumStr || null;
  if (h.freq === "dag") return plusDagen(datumStr, h.interval);
  if (h.freq === "maand") return plusMaanden(datumStr, h.interval);
  if (h.freq === "jaar") return plusMaanden(datumStr, 12 * h.interval);
  // week
  if (!h.dagen) return plusDagen(datumStr, 7 * h.interval);
  // Met vaste weekdagen (bv. werkdagen, of "om de 2 weken op ma en do"):
  // kandidaat-dagen in dezelfde week als de huidige datum tellen als week 0;
  // daarna alleen weken die een veelvoud van het interval verder liggen.
  const maandagAnker = plusDagen(datumStr, 1 - isoWeekdag(datumStr));
  for (let i = 1; i <= 7 * h.interval + 7; i++) {
    const kandidaat = plusDagen(datumStr, i);
    const weekNr = Math.floor(dagenTussen(maandagAnker, kandidaat) / 7);
    if (weekNr % h.interval === 0 && h.dagen.includes(isoWeekdag(kandidaat))) return kandidaat;
  }
  return plusDagen(datumStr, 7 * h.interval); // onbereikbaar vangnet
}

const DAG_KORT = ["", "ma", "di", "wo", "do", "vr", "za", "zo"];
export function herhalingLabel(herhaling) {
  const h = normaliseerHerhaling(herhaling);
  if (!h) return "";
  const n = h.interval;
  if (h.freq === "week" && h.dagen) {
    if (n === 1 && h.dagen.join() === "1,2,3,4,5") return "Werkdagen";
    if (n === 1 && h.dagen.length === 7) return "Elke dag";
    const dagen = h.dagen.map(d => DAG_KORT[d]).join(", ");
    return n === 1 ? `Elke week op ${dagen}` : `Om de ${n} weken op ${dagen}`;
  }
  const namen = { dag: ["Elke dag", "dagen"], week: ["Elke week", "weken"], maand: ["Elke maand", "maanden"], jaar: ["Elk jaar", "jaar"] }[h.freq];
  return n === 1 ? namen[0] : `Om de ${n} ${namen[1]}`;
}

// Een herhalende taak "afvinken" = klaar voor nu, door naar de volgende
// keer. De herinnering schuift evenveel dagen mee en houdt haar tijdstip.
export function rolHerhalendeTaakDoor(item, vandaag) {
  const basis = item.dueDate || (item.herinnering ? item.herinnering.slice(0, 10) : vandaag);
  const volgende = volgendeHerhalingsDatum(basis, item.herhaling);
  let herinnering = item.herinnering || null;
  if (herinnering) {
    const nieuweDag = plusDagen(herinnering.slice(0, 10), dagenTussen(basis, volgende));
    herinnering = `${nieuweDag}${herinnering.slice(10)}`;
  }
  return { ...item, dueDate: item.dueDate ? volgende : (item.herinnering ? null : volgende), herinnering, checked: false, mijnDag: null };
}

// Afvinken (en weer aanzetten) van een taak — herhalende taken rollen door.
export function vinkTaak(item, { wie = null, nu = Date.now(), vandaag } = {}) {
  if (!item.checked && normaliseerHerhaling(item.herhaling)) {
    return { ...rolHerhalendeTaakDoor(item, vandaag || vandaagStr(new Date(nu))), lastActionBy: wie, lastActionAt: nu };
  }
  return { ...item, checked: !item.checked, voltooidOp: item.checked ? null : nu, lastActionBy: wie, lastActionAt: nu };
}

// ── Slimme overzichten ─────────────────────────────────────────────
export function isInMijnDag(item, vandaag) {
  if (item.checked) return false;
  if (item.mijnDag === vandaag) return true;
  if (item.dueDate && item.dueDate <= vandaag) return true;
  return !!(item.herinnering && item.herinnering.slice(0, 10) <= vandaag);
}

// Voor "Gepland": wat telt als dé datum van een taak? De vervaldatum, of
// anders de dag van de herinnering.
export function planDatum(item) {
  return item.dueDate || (item.herinnering ? item.herinnering.slice(0, 10) : null);
}

export function groepeerGepland(items, vandaag) {
  const groepen = [
    { id: "telaat", label: "Te laat", items: [] },
    { id: "vandaag", label: "Vandaag", items: [] },
    { id: "morgen", label: "Morgen", items: [] },
    { id: "week", label: "Komende 7 dagen", items: [] },
    { id: "later", label: "Later", items: [] },
  ];
  const morgen = plusDagen(vandaag, 1);
  const weekGrens = plusDagen(vandaag, 7);
  items
    .filter(i => !i.checked && planDatum(i))
    .sort((a, b) => (planDatum(a) + (a.herinnering || "")).localeCompare(planDatum(b) + (b.herinnering || "")))
    .forEach(i => {
      const d = planDatum(i);
      const g = d < vandaag ? 0 : d === vandaag ? 1 : d === morgen ? 2 : d <= weekGrens ? 3 : 4;
      groepen[g].items.push(i);
    });
  return groepen.filter(g => g.items.length > 0);
}

export function sorteerTaken(items, sortering = "handmatig") {
  const kopie = [...items];
  if (sortering === "vervaldatum") {
    return kopie.sort((a, b) => (planDatum(a) || "9999").localeCompare(planDatum(b) || "9999"));
  }
  if (sortering === "alfabetisch") {
    return kopie.sort((a, b) => (a.name || "").localeCompare(b.name || "", "nl", { sensitivity: "base" }));
  }
  if (sortering === "belangrijk") {
    return kopie.sort((a, b) => (b.belangrijk ? 1 : 0) - (a.belangrijk ? 1 : 0));
  }
  return kopie;
}

// ── Tijdzone: herinneringen staan als Nederlandse wandkloktijd opgeslagen
//    ("2026-11-23T09:00"); de server (UTC) moet daar een exact moment van
//    maken. Zonder tijdzone-bibliotheek, via Intl — dat kent de zomertijd. ──
const TIJDZONE = "Europe/Amsterdam";
function tijdzoneVerschilMs(epochMs, tz = TIJDZONE) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(epochMs)).map(x => [x.type, x.value]));
  const alsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return alsUtc - Math.floor(epochMs / 1000) * 1000;
}
export function lokaalNaarEpoch(lokaal, tz = TIJDZONE) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(lokaal || "");
  if (!m) return null;
  const gok = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let epoch = gok - tijdzoneVerschilMs(gok, tz);
  epoch = gok - tijdzoneVerschilMs(epoch, tz); // tweede ronde rond de zomertijdwissel
  return epoch;
}
export function epochNaarLokaal(epochMs, tz = TIJDZONE) {
  const d = new Date(epochMs + tijdzoneVerschilMs(epochMs, tz));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// ── Herinneringen inplannen ────────────────────────────────────────
// QStash kan een bericht maximaal 7 dagen vooruit plannen (gratis laag);
// alles verder weg plant de dagelijkse cron later alsnog in.
export const PLAN_HORIZON_MS = 6.5 * 24 * 60 * 60 * 1000;

// Vergelijkt wat er ingepland MOET staan met wat er al staat.
// `bestaand`: { itemId: { tijd, messageId } }.
export function berekenHerinneringWijzigingen(lists, bestaand, nuMs, horizonMs = PLAN_HORIZON_MS) {
  const gewenst = {};
  for (const l of lists || []) {
    for (const i of l.items || []) {
      if (!i.herinnering || i.checked) continue;
      const epoch = lokaalNaarEpoch(i.herinnering);
      if (epoch == null || epoch <= nuMs || epoch - nuMs > horizonMs) continue;
      gewenst[i.id] = { tijd: i.herinnering, epoch, listId: l.id, naam: i.name };
    }
  }
  const plannen = Object.entries(gewenst)
    .filter(([id, g]) => !bestaand?.[id] || bestaand[id].tijd !== g.tijd)
    .map(([itemId, g]) => ({ itemId, ...g }));
  const annuleren = Object.entries(bestaand || {})
    .filter(([id, b]) => !gewenst[id] || gewenst[id].tijd !== b.tijd)
    .map(([itemId, b]) => ({ itemId, ...b }));
  return { plannen, annuleren };
}

// Wie krijgt de melding? Werk: alleen de toestellen van de eigenaar.
// Thuis: wie de taak is toegewezen, anders iedereen in huis.
export function kiesOntvangers(subs, { ruimte, eigenaar = null, toegewezenAan = null }) {
  const lijst = subs || [];
  if (ruimte === "werk") return lijst.filter(s => s.user && s.user === eigenaar);
  if (toegewezenAan) return lijst.filter(s => s.user === toegewezenAan);
  return lijst;
}

export function herinneringTekst(item) {
  const delen = [];
  if (item.dueDate) delen.push(`Vervalt ${item.dueDate.split("-").reverse().join("-")}`);
  const open = (item.substappen || []).filter(s => !s.afgevinkt).length;
  if (open) delen.push(`${open} ${open === 1 ? "stap" : "stappen"} open`);
  if (item.note) delen.push(String(item.note).slice(0, 80));
  return delen.join(" · ") || "Herinnering";
}

// ── Slim invoeren ──────────────────────────────────────────────────
// Herkent herhaling in gewone taal. Geeft de herhaling terug plus de tekst
// zonder dat stukje.
const WEEKDAG_WOORDEN = { maandag: 1, dinsdag: 2, woensdag: 3, donderdag: 4, vrijdag: 5, zaterdag: 6, zondag: 7 };
export function herkenHerhaling(tekst) {
  const t = String(tekst || "");
  const regels = [
    [/\b(elke|iedere) werkdag\b/i, () => ({ freq: "week", interval: 1, dagen: [1, 2, 3, 4, 5] })],
    [/\b(elke|iedere) dag\b|\bdagelijks\b/i, () => ({ freq: "dag", interval: 1 })],
    [/\b(elke|iedere) week\b|\bwekelijks\b/i, () => ({ freq: "week", interval: 1 })],
    [/\b(elke|iedere) maand\b|\bmaandelijks\b/i, () => ({ freq: "maand", interval: 1 })],
    [/\b(elk|ieder) jaar\b|\bjaarlijks\b/i, () => ({ freq: "jaar", interval: 1 })],
    [/\bom de (\d{1,3}) (dag|dagen|week|weken|maand|maanden|jaar)\b/i, m => ({
      freq: /^dag/i.test(m[2]) ? "dag" : /^we/i.test(m[2]) ? "week" : /^maand/i.test(m[2]) ? "maand" : "jaar",
      interval: +m[1],
    })],
    [/\b(elke|iedere) ((?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)(?:\s*(?:,|en)\s*(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag))*)\b/i, m => ({
      freq: "week", interval: 1,
      dagen: m[2].toLowerCase().split(/\s*(?:,|en)\s*/).map(w => WEEKDAG_WOORDEN[w]).filter(Boolean),
    })],
  ];
  for (const [re, maak] of regels) {
    const m = re.exec(t);
    if (m) {
      return { herhaling: normaliseerHerhaling(maak(m)), rest: (t.slice(0, m.index) + t.slice(m.index + m[0].length)).replace(/\s{2,}/g, " ").trim(), gevonden: m[0] };
    }
  }
  return { herhaling: null, rest: t.trim(), gevonden: null };
}

// Volledige snelle invoer: "morgen om 9 uur kliko buiten zetten !"
// → titel, vervaldatum, herinnering (alleen als er een tijd genoemd is),
//   herhaling en belangrijk ("!" aan begin of eind).
// `chronoNl` is chrono-node's Nederlandse parser (chrono.nl), meegegeven
// zodat dit bestand importvrij en testbaar blijft.
// Meerdere taken in één keer inspreken of typen: "taak tandarts bellen,
// taak morgen offerte sturen, taak boodschappen". Het woord "taak" scheidt
// de taken. Pas bij twee of meer keer "taak" wordt er gesplitst.
export function splitsTaken(tekst) {
  const t = String(tekst || "").replace(/\s+/g, " ").trim();
  const delen = t.split(/\btaak\b/i);
  if (delen.length < 3) return [];
  // Tekst vóór de eerste "taak" hoort bij die eerste taak (bv. "Eerste taak …").
  const kop = delen.shift().replace(/\b(eerste|volgende|nieuwe|andere|een|de)\s*$/i, "").trim();
  const uit = [];
  delen.forEach((d, i) => {
    let x = (i === 0 && kop && !/^[\s,.;:!?-]*$/.test(kop) ? `${kop} ${d}` : d);
    x = x
      .replace(/^\s*(?:nummer\s*)?\d+\s*[:.)-]?\s*/i, "")             // "taak 2: …"
      .replace(/^[\s:;,.!?-]+/, "")
      .replace(/\s+(?:en\s+dan|en|dan|ook|nog)?\s*(?:de|een)?\s*(?:eerste|tweede|derde|vierde|vijfde|volgende|nieuwe|andere|laatste)?\s*$/i, "")
      .replace(/[\s,;.!?-]+$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (x.length >= 2) uit.push(x.charAt(0).toUpperCase() + x.slice(1));
  });
  return uit.length >= 2 ? uit : [];
}

export function ontleedSnelleInvoer(tekst, chronoNl, nu = new Date()) {
  let rest = String(tekst || "").trim();
  let belangrijk = false;
  if (/^!\s*|\s*!$/.test(rest)) {
    belangrijk = true;
    rest = rest.replace(/^!\s*|\s*!$/g, "").trim();
  }
  const her = herkenHerhaling(rest);
  rest = her.rest;
  let dueDate = null, herinnering = null, datumTekst = null;
  if (chronoNl && rest) {
    const resultaten = chronoNl.parse(rest, nu, { forwardDate: true }) || [];
    // Een losse maandnaam zonder dag ("Jan bellen", "mei") is meestal geen
    // datum maar een naam of woord — die overslaan.
    const r = resultaten.find(x => !(/^[a-zà-ü.]+$/i.test(x.text.trim()) && !x.start.isCertain("day") && !x.start.isCertain("weekday")));
    if (r) {
      const d = r.start.date();
      dueDate = datumNaarStr(d);
      if (r.start.isCertain("hour")) {
        herinnering = `${dueDate}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
      datumTekst = r.text;
      rest = (rest.slice(0, r.index) + rest.slice(r.index + r.text.length)).replace(/\s{2,}/g, " ").trim();
      // Tijd die de datumherkenning liet liggen ("morgen 14:00", "om 14.30 uur").
      if (!herinnering) {
        // Met een punt ("14.30") alleen als er "om" of "uur" bij staat — anders
        // kan het ook een versienummer of bedrag zijn.
        const tijd = rest.match(/(?:^|\s)(om\s+)?([01]?\d|2[0-3])([:.])([0-5]\d)(\s*uur)?(?=\s|$)|(?:^|\s)om\s+([01]?\d|2[0-3])\s*uur(?=\s|$)/i);
        if (tijd && tijd[3] === "." && !tijd[1] && !tijd[5]) tijd.length = 0;
        if (tijd && tijd[0]) {
          const uur = tijd[2] ?? tijd[6], min = tijd[4] ?? "00";
          herinnering = `${dueDate}T${String(uur).padStart(2, "0")}:${min}`;
          datumTekst = `${datumTekst} ${tijd[0].trim()}`;
          rest = (rest.slice(0, tijd.index) + " " + rest.slice(tijd.index + tijd[0].length)).replace(/\s{2,}/g, " ").trim();
        }
      }
    }
  }
  // Herhaling zonder datum: eerstvolgende passende dag als start.
  if (her.herhaling && !dueDate) {
    const vandaag = datumNaarStr(nu);
    dueDate = her.herhaling.dagen && !her.herhaling.dagen.includes(isoWeekdag(vandaag))
      ? volgendeHerhalingsDatum(vandaag, her.herhaling)
      : vandaag;
  }
  // Losse verbindingswoordjes die na het weghalen van de datum overblijven.
  rest = rest.replace(/^(op|om|voor|tegen)\s+/i, "").replace(/\s+(op|om|voor|tegen)$/i, "").trim();
  return {
    titel: rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "",
    dueDate, herinnering, herhaling: her.herhaling, belangrijk,
    herkend: [datumTekst, her.gevonden, belangrijk ? "!" : null].filter(Boolean),
  };
}

// ── Plak-import (bv. uit Microsoft To Do, Notities of een e-mail) ─────
// - Regels die eindigen op ":" worden een nieuwe lijst.
// - Opsommingstekens, nummering en vinkjes ([ ], ☐, - , • , 1.) gaan weg.
// - Afgevinkte regels ([x], ☑, ✓, ✔) worden overgeslagen.
// - Ingesprongen regels onder een taak worden substappen.
export function ontleedPlakImport(tekst) {
  const groepen = [];
  let huidig = { lijstNaam: null, taken: [] };
  groepen.push(huidig);
  let laatsteTaak = null;
  let overgeslagen = 0;
  for (const ruw of String(tekst || "").replace(/\r/g, "").split("\n")) {
    if (!ruw.trim()) continue;
    const ingesprongen = /^(\s{2,}|\t)/.test(ruw);
    // Eerst een opsommingsteken/nummer weg ("- [x] …" komt veel voor),
    // daarna pas het vinkje bekijken.
    let regel = ruw.trim().replace(/^([-*•◦▪‣]|\d{1,3}[.)])\s+/, "");
    const afgevinkt = /^(\[[xX✓✔]\]|☑|✅|✓|✔)\s*/.test(regel);
    regel = regel.replace(/^(\[[ xX✓✔]?\]|☐|☑|✅|✓|✔|[-*•◦▪‣]|\d{1,3}[.)])\s*/, "").trim();
    if (!regel) continue;
    if (/:$/.test(regel) && !ingesprongen && regel.length <= 60) {
      huidig = { lijstNaam: regel.replace(/:$/, "").trim(), taken: [] };
      groepen.push(huidig);
      laatsteTaak = null;
      continue;
    }
    if (afgevinkt) { overgeslagen++; continue; }
    if (ingesprongen && laatsteTaak) {
      laatsteTaak.substappen.push(regel);
      continue;
    }
    laatsteTaak = { tekst: regel, substappen: [] };
    huidig.taken.push(laatsteTaak);
  }
  return { groepen: groepen.filter(g => g.taken.length > 0), overgeslagen };
}

// ── Taak via e-mail ────────────────────────────────────────────────
export function onderwerpNaarTitel(onderwerp) {
  let t = String(onderwerp || "").trim();
  // Herhaald "Fwd: RE: FW:" enzovoort weghalen (NL-varianten ook).
  while (/^(re|fw|fwd|tr|doorst|antw|wg)\s*:\s*/i.test(t)) t = t.replace(/^(re|fw|fwd|tr|doorst|antw|wg)\s*:\s*/i, "");
  return t.trim() || "Taak uit e-mail";
}

export function emailUitAfzender(van) {
  const m = /<([^>]+)>/.exec(String(van || ""));
  return (m ? m[1] : String(van || "")).trim().toLowerCase();
}

export function afzenderToegestaan(van, toegestaan) {
  const adres = emailUitAfzender(van);
  return !!adres && (toegestaan || []).map(a => String(a).trim().toLowerCase()).includes(adres);
}

export function mailTokenUitAdressen(adressen) {
  for (const a of adressen || []) {
    const m = /(?:^|<)\s*taken-([a-z0-9]{8,32})@/i.exec(String(a));
    if (m) return m[1].toLowerCase();
  }
  return null;
}

export function mailAdres(token, domein) {
  if (!token || !domein) return null;
  return `taken-${token}@${String(domein).replace(/^@/, "").trim().toLowerCase()}`;
}

export function isGeldigDomein(domein) {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(String(domein || "").replace(/^@/, "").trim());
}

// ── Pincode ────────────────────────────────────────────────────────
export function isGeldigePin(pin) {
  return /^\d{6,8}$/.test(String(pin || ""));
}

// ── Opslaan: lijsten samenvoegen (zelfde regels als /api/lijsten) ──────
// Een lijst verdwijnt alleen als hij expliciet in `verwijderdeIds` staat;
// items die een ander toestel net (≤10 s) toevoegde, gaan niet verloren.
export function voegLijstenSamen(huidig, binnenkomend, verwijderdeIds = [], nuMs = Date.now(), verwijderdeItemIds = []) {
  const weg = new Set(verwijderdeIds);
  const wegItems = new Set(verwijderdeItemIds);
  const samengevoegd = (binnenkomend || []).map(inL => {
    const cur = (huidig || []).find(l => l.id === inL.id);
    if (!cur) return inL;
    const inIds = new Set((inL.items || []).map(i => i.id));
    const extra = (cur.items || []).filter(i => !inIds.has(i.id) && !wegItems.has(i.id) && i.addedAt > nuMs - 10000);
    return { ...inL, items: [...(inL.items || []), ...extra] };
  });
  const inIds = new Set((binnenkomend || []).map(l => l.id));
  const bewaren = (huidig || []).filter(l => !inIds.has(l.id) && !weg.has(l.id));
  return [...samengevoegd, ...bewaren];
}

export function nieuweTaak(velden, { wie = null, nu = Date.now(), id } = {}) {
  return {
    id: id || `${nu}-${Math.random().toString(36).slice(2)}`,
    name: "", checked: false, inCart: false, note: "",
    amount: 1, unit: "stuks", category: null, status: null, budget: null,
    dueDate: null, herinnering: null, assignedTo: null, herhaling: null,
    substappen: [], belangrijk: false, mijnDag: null, klantId: null,
    addedAt: nu, addedBy: wie, lastActionBy: wie, lastActionAt: nu,
    ...velden,
  };
}
