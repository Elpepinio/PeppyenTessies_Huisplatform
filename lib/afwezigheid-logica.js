// ════════════════════════════════════════════════════════════════════
// AFWEZIGHEID (vakanties, vrije dagen) van klanten, crew en cast
// afwezigheid = { id, naam, klantId, van, tot, notitie }
// We waarschuwen als een vast moment met de klant (kickoff, PPM, call,
// akkoord/feedback) of een draaidag waar iemand op ingepland staat in
// zo'n periode valt.
// ════════════════════════════════════════════════════════════════════
const afwNaam = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const afwDatum = (c) => `${c.get("year")}-${String(c.get("month")).padStart(2, "0")}-${String(c.get("day")).padStart(2, "0")}`;
const afwLokaal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function normAfwezigheid(a) {
  const van = a?.van || null, tot = a?.tot || a?.van || null;
  return {
    id: a?.id || null, naam: String(a?.naam || "").trim().slice(0, 80), klantId: a?.klantId || null,
    van: van && tot && tot < van ? tot : van, tot: van && tot && tot < van ? van : tot,
    notitie: String(a?.notitie || "").trim().slice(0, 300),
    // eigen = jouw eigen vrije dagen: daar plant de app geen deadlines.
    ...(a?.eigen ? { eigen: true } : {}),
  };
}
export function isAfwezigOp(a, datum) { return !!(a?.van && datum && a.van <= datum && datum <= (a.tot || a.van)); }
// Noemt een tekst deze persoon? (Op voornaam of volledige naam, als los woord.)
export function noemtPersoon(tekst, naam) {
  const t = ` ${afwNaam(tekst).replace(/[^a-z0-9]+/g, " ")} `;
  const delen = afwNaam(naam).replace(/[^a-z0-9 ]+/g, " ").split(" ").filter(w => w.length >= 3);
  if (!delen.length) return false;
  return t.includes(` ${delen.join(" ")} `) || t.includes(` ${delen[0]} `);
}

// Uit notities ("Leonie is met vakantie van 21 december tot 4 januari")
// een afwezigheid halen. Geeft null als er niets bruikbaars in staat.
const AFW_WOORDEN = /\b(vakantie|afwezig|niet (aanwezig|bereikbaar|beschikbaar|op kantoor)|er niet|verlof|vrij(e dagen)?|op reis|weg van|weg tot|skie?n|wintersport|out of office|ooo|kerstvakantie|zomervakantie|meivakantie)\b/i;
export function herkenAfwezigheid(tekst, chronoNl, nu = new Date()) {
  if (!chronoNl) return null;
  for (const regel of String(tekst || "").split(/\r?\n/)) {
    if (!AFW_WOORDEN.test(regel)) continue;
    const res = (chronoNl.parse(regel, nu, { forwardDate: true }) || [])
      // Losse weekdagwoorden ("vrij" = vrijdag) negeren; echte datums houden.
      .filter(r => (!/^(vrij|za|zo|ma|di|wo|do|vr)$/i.test(r.text.trim()) && r.start.isCertain("day")) || (r.start.isCertain("month") && /\d/.test(r.text)));
    if (!res.length) continue;
    let van, tot;
    if (res[0].end) { van = afwDatum(res[0].start); tot = afwDatum(res[0].end); }
    else if (res.length >= 2) { van = afwDatum(res[0].start); tot = afwDatum(res[1].start); }
    else if (/\b(tot|t\/m|tot en met|tm)\b[^\d]*$/i.test(regel.slice(0, res[0].index))) { van = afwLokaal(nu); tot = afwDatum(res[0].start); }
    else { van = afwDatum(res[0].start); tot = van; }
    if (tot < van) [van, tot] = [tot, van];
    return { van, tot, regel: regel.trim() };
  }
  return null;
}

// Wie is er afwezig op een datum? Optioneel alleen voor een klant/persoon.
export function afwezigOpDatum(afwezigheden, datum, { klantId = null, naam = null } = {}) {
  return (afwezigheden || []).filter(a => isAfwezigOp(a, datum) && (!klantId || a.klantId === klantId) && (!naam || noemtPersoon(naam, a.naam) || noemtPersoon(a.naam, naam)));
}
export function komendeAfwezigheden(afwezigheden, vandaag, dagen = 45) {
  const grens = afwLokaal(new Date(new Date(`${vandaag}T12:00:00`).getTime() + dagen * 86400000));
  return (afwezigheden || []).filter(a => a.van && (a.tot || a.van) >= vandaag && a.van <= grens)
    .sort((a, b) => a.van.localeCompare(b.van));
}

// Momenten met de klant: hier moet de klant (contactpersoon) bij zijn of op reageren.
const KLANT_MOMENT = /\b(klant|kickoff|ppm|pre-?productie-?meeting|akkoord|feedback|review|presentatie|goedkeuring|approval|oplevering|bespreking|call)\b/i;
export function isKlantMoment(i) {
  return !!(i && (i.onderdeelId === "kickoff" || i.onderdeelId === "ppm" || i.callMoment || KLANT_MOMENT.test(i.name || "")));
}
const isOpnameDag = (i) => !!(i.draaidagId || i.opzetTaak === "prelight" || (i.anker === "draai" && Number(i.offset) === 0 && i.category === "productie"));

// Botsingen in een project: [{ afwezigheid, item, reden }]
export function afwezigheidConflicten(lijst, afwezigheden) {
  const p = lijst?.project || {};
  const uit = [];
  const open = (lijst?.items || []).filter(i => !i.checked && i.dueDate);
  const calls = p.calls || [];
  for (const a of afwezigheden || []) {
    if (!a?.van || a.eigen) continue;
    const vanKlant = !!(a.klantId && a.klantId === p.klantId);
    const ingepland = (lijst?.items || []).some(i => (i.bezetting || []).some(b => b.naam && (noemtPersoon(b.naam, a.naam) || noemtPersoon(a.naam, b.naam))));
    for (const i of open) {
      if (!isAfwezigOp(a, i.dueDate)) continue;
      const call = i.callMoment || i.callId ? calls.find(c => c.id === i.callId || c.momentTaakId === i.id) : calls.find(c => c.momentTaakId === i.id);
      let reden = null;
      if (noemtPersoon(i.name, a.naam) || (call?.met && noemtPersoon(call.met, a.naam))) reden = "noemt";
      else if (vanKlant && isKlantMoment(i)) reden = "klant";
      else if (ingepland && isOpnameDag(i)) reden = "draaidag";
      if (reden) uit.push({ afwezigheid: a, item: i, reden });
    }
  }
  return uit;
}
