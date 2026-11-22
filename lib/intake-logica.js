// ════════════════════════════════════════════════════════════════════
// INTAKE — notities van het eerste telefoongesprek, waarin de vraag bij
// ons wordt neergelegd. Je typt gewoon zoals je praat ("2 draaidagen begin
// december, prelight de dag ervoor, post doet het bureau zelf, budget rond
// de 25k, online 9:16 en 16:9, acteur + 10 figuranten, hotel nodig") en de
// app herkent wat er voor het verdere proces toe doet:
//   klant · draaidag + aantal draaidagen · prelight · postproductie ja/nee ·
//   oplevering / live · budget · deliverables · onderdelen (cast, locaties,
//   crew, hotel, catering, post…)
// Alles wat herkend is wordt voorgesteld bij de offerte en bij de start
// van de productie; de notities zelf blijven altijd bij het project.
// Puur, zonder imports: makkelijk te testen.
// ════════════════════════════════════════════════════════════════════
const MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const MAAND_RE = "(jan(?:uari)?|feb(?:ruari)?|maa(?:rt)?|mrt|apr(?:il)?|mei|jun(?:i)?|jul(?:i)?|aug(?:ustus)?|sep(?:t(?:ember)?)?|okt(?:ober)?|oct|nov(?:ember)?|dec(?:ember)?)";
const GETAL = { een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10, halve: 0.5 };
const getal = (s) => (s == null ? null : /^\d+$/.test(s) ? Number(s) : GETAL[String(s).toLowerCase()] ?? null);
const pad = (n) => String(n).padStart(2, "0");
const iso = (j, m, d) => `${j}-${pad(m)}-${pad(d)}`;

function maandNr(s) {
  const t = s.toLowerCase().slice(0, 3);
  const i = MAANDEN.findIndex(m => m.startsWith(t === "mrt" ? "maa" : t === "oct" ? "okt" : t));
  return i >= 0 ? i + 1 : null;
}
// Eerstvolgende datum (vandaag of later) als er geen jaar genoemd is.
function maakDatum(dag, maand, jaar, vandaag) {
  if (!dag || !maand || dag > 31 || maand > 12) return null;
  let j = jaar ? (jaar < 100 ? 2000 + jaar : jaar) : Number(vandaag.slice(0, 4));
  let d = iso(j, maand, dag);
  if (!jaar && d < vandaag) d = iso(j + 1, maand, dag);
  return d;
}

// Alle datums in de tekst met hun positie.
export function vindDatums(tekst, vandaag) {
  const uit = [];
  const t = tekst.toLowerCase();
  const reTekst = new RegExp(`\\b(\\d{1,2})(?:e|ste|de)?\\s+${MAAND_RE}\\b(?:\\s+(\\d{4}))?`, "g");
  let m;
  while ((m = reTekst.exec(t))) {
    const d = maakDatum(Number(m[1]), maandNr(m[2]), m[3] ? Number(m[3]) : null, vandaag);
    if (d) uit.push({ datum: d, index: m.index, eind: m.index + m[0].length, tekst: m[0] });
  }
  const reCijfer = /\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?\b/g;
  while ((m = reCijfer.exec(t))) {
    if (/\d:\d/.test(t.slice(Math.max(0, m.index - 1), m.index + 1))) continue;
    const d = maakDatum(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : null, vandaag);
    if (d) uit.push({ datum: d, index: m.index, eind: m.index + m[0].length, tekst: m[0] });
  }
  // "begin/half/eind december" → 1e / 15e / 25e (bij benadering).
  const reGlobaal = new RegExp(`\\b(begin|half|midden|eind)\\s+${MAAND_RE}\\b`, "g");
  while ((m = reGlobaal.exec(t))) {
    const dag = { begin: 1, half: 15, midden: 15, eind: 25 }[m[1]];
    const d = maakDatum(dag, maandNr(m[2]), null, vandaag);
    if (d) uit.push({ datum: d, index: m.index, eind: m.index + m[0].length, tekst: m[0], globaal: true });
  }
  return uit.sort((a, b) => a.index - b.index);
}

// De datum die het dichtst ná (of vlak vóór) een trefwoord staat, binnen dezelfde zin.
function datumBij(tekst, datums, trefRe) {
  const t = tekst.toLowerCase();
  let beste = null;
  for (const zin of zinnen(t)) {
    const tm = trefRe.exec(zin.tekst);
    if (!tm) continue;
    const pos = zin.start + tm.index;
    const kandidaten = datums.filter(d => d.index >= zin.start && d.index < zin.eind);
    for (const d of kandidaten) {
      // Een datum ná het trefwoord ("live vanaf 5 januari") gaat vóór een datum ervoor.
      const afstand = d.index >= pos ? d.index - pos : (pos - d.eind) * 4 + 10;
      if (!beste || afstand < beste.afstand) beste = { ...d, afstand };
    }
  }
  return beste;
}
function zinnen(t) {
  const uit = [];
  const re = /[^.!?\n;]+/g;
  let m;
  while ((m = re.exec(t))) uit.push({ tekst: m[0], start: m.index, eind: m.index + m[0].length });
  return uit;
}

// Herkenning van onderdelen (ids uit ONDERDELEN in projecten-logica).
const ONDERDEEL_WOORDEN = [
  ["acteurs", /\b(acteurs?|actrice|hoofdrol|spelers?|talent)\b/],
  ["edelfiguranten", /\bedel-?figurant(en)?\b/],
  ["figuranten", /(?<!edel-?)\bfigurant(en)?\b/],
  ["loc-exterieur", /\b(exterieur|buiten(opnames?|locatie)?|op straat|in het bos|op het strand)\b/],
  ["loc-interieur", /\b(interieur|binnen(opnames?|locatie)?|studio|fabriek|showroom|kantoor|winkel|woning|huis)\b/],
  ["props", /\b(props|rekwisieten)\b/],
  ["decor", /\b(decor|setbouw|set bouwen)\b/],
  ["hotel", /\b(hotel|overnachten|overnachting(en)?|slapen ter plaatse)\b/],
  ["catering", /\b(catering|lunch(en)? (regelen|verzorgen)|eten op de set)\b/],
  ["verzekering", /\bverzeker/],
  ["crew-regie", /\b(regie|regisseur)\b/],
  ["crew-camera", /\b(dop|cameraman|camera-?vrouw|director of photography)\b/],
  ["crew-geluid", /\b(geluid(sman)?|sound ?guy|boom)\b/],
  ["crew-visagie", /\b(visagie|visagist(e)?|make-?up|mua|haar en make-?up)\b/],
  ["crew-stylist", /\b(styling|stylist(e)?|kleding)\b/],
  ["crew-art-director", /\bart ?director\b/],
  ["crew-gripper", /\b(grip(per)?|dolly|slider|crane|kraan)\b/],
  ["crew-belichter", /\b(belicht(er|ing)|gaffer|licht(plan)?)\b/],
  ["crew-data-handler", /\b(data ?handler|dit)\b/],
  ["crew-fotografie", /\b(fotograaf|fotografie|stills)\b/],
  ["animatie", /\b(animatie|motion( graphics)?|2d|3d)\b/],
  ["muziek-componeren", /\b(componist|muziek (laten )?componeren|eigen muziek|gecomponeerd)\b/],
  ["muziek-stock", /\b(stock ?muziek|muziek ?licentie|library muziek)\b/],
  ["grading", /\b(grading|grade)\b/],
  ["kleurcorrectie", /\bkleurcorrectie\b/],
  ["sound-effects", /\b(sound ?design|sound effects|sfx)\b/],
  ["afmixen", /\b(afmix(en)?|geluidsstudio|mix)\b/],
  ["edit-v1", /\b(montage|edit|monteren)\b/],
];
const POST_IDS = ["edit-v1", "edit-v2", "edit-lock", "animatie", "kleurcorrectie", "grading", "sound-effects", "muziek-componeren", "muziek-stock", "afmixen"];

// Hoofdfunctie. `klanten`: [{id, naam}] om de klant in de tekst te vinden.
export function leesIntake(tekst, { vandaag, klanten = [] } = {}) {
  const ruw = String(tekst || "");
  const t = ruw.toLowerCase();
  const uit = { onderdelen: [], deliverables: {}, herkend: [] };
  if (!t.trim()) return uit;
  const zeg = (soort, label) => uit.herkend.push({ soort, label });
  const datums = vindDatums(ruw, vandaag);

  // Klant
  const klant = [...klanten].filter(k => k.naam && !k.gearchiveerd).sort((a, b) => b.naam.length - a.naam.length)
    .find(k => new RegExp(`\\b${k.naam.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t));
  if (klant) { uit.klantId = klant.id; zeg("klant", `Klant: ${klant.naam}`); }

  // Aantal draaidagen
  const dagRe = /(?<![\wà-ÿ])(\d+|een|één|twee|drie|vier|vijf|zes|zeven|acht|negen|tien)\s*(?:draai|opname|shoot)-?dag(?:en)?\b|\b(\d+|een|één|twee|drie|vier|vijf|zes|zeven)\s+dag(?:en)?\s+(?:draaien|filmen|shooten|opnames?|op locatie)\b|\b(?:shoot|draaien|opnames?)\s+(?:van\s+)?(\d+|twee|drie|vier|vijf)\s+dag(?:en)?\b/;
  const dm = dagRe.exec(t) || /\b(?:draaien|draai|shoot|opnames?|filmen)\b[^.]{0,30}?(?<![\wà-ÿ])()()(één|een|1) (?:hele )?dag\b/.exec(t);
  if (dm) {
    const n = getal(dm[1] || dm[2] || dm[3] || dm[4]);
    if (n && n >= 1 && n <= 30) { uit.draaidagen = Math.round(n); zeg("draaidagen", `${uit.draaidagen} ${uit.draaidagen === 1 ? "draaidag" : "draaidagen"}`); }
  } else if (/\b(halve|1\/2) draaidag\b/.test(t)) { uit.draaidagen = 1; zeg("draaidagen", "1 draaidag (halve dag)"); }

  // Draaidag
  const draai = datumBij(ruw, datums, /draai(en|dag|dagen)?|shoot|opnames?|filmen/);
  if (draai) { uit.draaidag = draai.datum; zeg("draaidag", `Draaidag: ${draai.tekst.trim()}${draai.globaal ? " (ongeveer)" : ""}`); }

  // Prelight
  if (/pre-?light ?dag|prelight (de )?dag (ervoor|vooraf|eerder)|dag (ervoor|vooraf|eerder)[^.]{0,30}pre-?light|(dag|avond) (ervoor|vooraf) (licht|lichten|uitlichten)/.test(t)) {
    uit.prelight = "aparte-dag"; zeg("prelight", "Aparte pre-light dag");
  } else if (/geen pre-?light/.test(t)) {
    uit.prelight = "geen"; zeg("prelight", "Geen prelight");
  } else if (/pre-?light/.test(t)) {
    uit.prelight = "zelfde-dag"; zeg("prelight", "Prelight op de draaidag");
  }

  // Postproductie
  const postWoord = "(post(productie)?|montage|edit(ing)?|nabewerking)";
  const extern = new RegExp(`${postWoord}[^.]{0,40}\\b(zelf|bureau|extern|ander(e|s)?|niet|elders|in-?house bij)\\b|\\b(geen|zonder)\\s+${postWoord}|alleen (de )?(productie|shoot|opnames?|draaien|draaidag)|(bureau|klant|zij|ze) (doet|doen|regelt|regelen) (de |het )?${postWoord}`);
  const intern = new RegExp(`\\b(ook|inclusief|incl\\.?|met|plus)\\s+(de\\s+)?${postWoord}|${postWoord}[^.]{0,25}\\b(bij ons|door ons|doen wij|wij doen|ook)\\b`);
  if (extern.test(t)) { uit.postDoorOns = false; zeg("post", "Postproductie door een ander"); }
  else if (intern.test(t)) { uit.postDoorOns = true; zeg("post", "Postproductie door ons"); }

  // Oplevering / live
  const op = datumBij(ruw, datums.filter(d => d.datum !== uit.draaidag), /opleve(ren|ring)|deadline|aanleveren|klaar|af (zijn|moet)/);
  if (op) { uit.opleverdatum = op.datum; zeg("oplever", `Oplevering: ${op.tekst.trim()}`); }
  const live = datumBij(ruw, datums.filter(d => d.datum !== uit.draaidag && d.datum !== uit.opleverdatum), /\blive\b|online (vanaf|op)|uitzend|campagne (start|loopt)|on ?air/);
  if (live) { uit.liveDatum = live.datum; zeg("live", `Live: ${live.tekst.trim()}`); }

  // Budget
  const bm = /(?:budget|bedrag|kosten|prijs|offerte)[^.\d€]{0,25}(?:€\s*)?(\d{1,3}(?:[.\s]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|duizend|mille)?/.exec(t)
    || /€\s*(\d{1,3}(?:[.\s]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|duizend)?/.exec(t);
  if (bm) {
    let bedrag = Number(bm[1].replace(/[.\s](?=\d{3}\b)/g, "").replace(",", "."));
    if (bm[2]) bedrag *= 1000;
    if (Number.isFinite(bedrag) && bedrag >= 100) { uit.budget = Math.round(bedrag); zeg("budget", `Budget: € ${uit.budget.toLocaleString("nl-NL")}`); }
  }

  // Deliverables
  const formaten = [];
  if (/16\s?[:x×]\s?9|liggend|breedbeeld/.test(t)) formaten.push("16x9");
  if (/4\s?[:x×]\s?5/.test(t)) formaten.push("4x5");
  if (/1\s?[:x×]\s?1|vierkant/.test(t)) formaten.push("1x1");
  if (/9\s?[:x×]\s?16|staand|verticaal|reels?|stories|tiktok/.test(t)) formaten.push("9x16");
  const kanalen = [];
  if (/\b(tvc|tv-?(commercial|spot|reclame)|televisie|tv)\b/.test(t)) kanalen.push("tvc");
  if (/\b(online|social|socials|instagram|youtube|facebook|tiktok|linkedin|website)\b/.test(t)) kanalen.push("online");
  if (/\b(paid|betaald|advertenties?|ads|campagne online)\b/.test(t)) kanalen.push("online-paid");
  // TV is altijd 16:9; de andere formaten gelden voor online.
  for (const k of kanalen) uit.deliverables[k] = k === "tvc" ? ["16x9"] : (formaten.length ? formaten : ["16x9"]);
  if (!kanalen.length && formaten.length) uit.deliverables.online = formaten;
  if (/\b(foto'?s|fotografie|stills|fotoshoot)\b/.test(t)) uit.deliverables.fotografie = true;
  const delivTekst = [...Object.keys(uit.deliverables).filter(k => k !== "fotografie").map(k => `${{ tvc: "TVC", online: "Online", "online-paid": "Online paid" }[k]} ${uit.deliverables[k].join(", ")}`), uit.deliverables.fotografie ? "fotografie" : ""].filter(Boolean).join(" · ");
  if (delivTekst) zeg("deliverables", `Deliverables: ${delivTekst}`);

  // Onderdelen
  for (const [id, re] of ONDERDEEL_WOORDEN) if (re.test(t)) uit.onderdelen.push(id);
  if (uit.deliverables.fotografie && !uit.onderdelen.includes("crew-fotografie")) uit.onderdelen.push("crew-fotografie");
  if (uit.postDoorOns === false) uit.onderdelen = uit.onderdelen.filter(id => !POST_IDS.includes(id));
  // Aantallen bij cast ("10 figuranten") voor in de notities van de taak.
  const aantallen = {};
  for (const [id, woord] of [["figuranten", "figurant"], ["edelfiguranten", "edelfigurant"], ["acteurs", "acteur"]]) {
    const am = new RegExp(`\\b(\\d+|twee|drie|vier|vijf|zes|zeven|acht|negen|tien)\\s+${woord}`).exec(t);
    if (am) aantallen[id] = getal(am[1]);
  }
  if (Object.keys(aantallen).length) uit.aantallen = aantallen;
  if (uit.onderdelen.length) zeg("onderdelen", `${uit.onderdelen.length} ${uit.onderdelen.length === 1 ? "onderdeel" : "onderdelen"}`);

  // Contactpersoon met telefoonnummer ("Angela Mostert 06 12345678")
  const cm = /\b([A-Z][a-zà-ÿ]+(?:\s+(?:van|de|der|den|ter|ten|het))*\s+[A-Z][a-zà-ÿ]+)[^\n\dA-Za-z]{0,12}((?:\+31|0)[\d\s-]{8,13}\d)/.exec(ruw);
  if (cm) { uit.contact = { naam: cm[1].trim(), telefoon: cm[2].trim() }; zeg("contact", `Contact: ${uit.contact.naam} · ${uit.contact.telefoon}`); }
  return uit;
}

// Leesbare namen van onderdelen voor de herkend-chips (labels komen uit de UI).
export function intakeSamenvatting(h) {
  return (h?.herkend || []).map(x => x.label);
}
