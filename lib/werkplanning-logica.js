import { draaidagenVan, isVrijeDag, vrijeDagReden, startVan, duurVan, isVastePlanning, plusWerkdagen } from "./projecten-logica";
import { plusDagen } from "./taken-logica";

// ════════════════════════════════════════════════════════════════════
// WERKPLANNING — alle projecten en losse werktaken samen, per dag.
// Per dag: draaidagen, vaste momenten (calls, PPM…), deadlines en taken
// die "bezig" zijn (met een duur). Daaruit een drukte-niveau:
//   rustig (🟢) · druk (🟠) · vol (🔴)
// Een draaidag is altijd "vol". Twee draaidagen op één dag = botsing.
// ════════════════════════════════════════════════════════════════════
export const DRUKTE = { rustig: { icoon: "🟢", label: "Rustig" }, druk: { icoon: "🟠", label: "Druk" }, vol: { icoon: "🔴", label: "Vol" } };
export const DRUKTE_GRENS = { druk: 4, vol: 7 };
const wpIsDraai = (i) => !!(i.draaidagId || (i.anker === "draai" && Number(i.offset) === 0 && i.category === "productie"));

export function werkbelasting(lijsten, { vandaag, dagen = 42, van = null } = {}) {
  const start = van || vandaag;
  const eind = plusDagen(start, dagen - 1);
  const perDag = new Map();
  const dag = (d) => {
    if (!perDag.has(d)) perDag.set(d, { datum: d, draaidagen: [], momenten: [], deadlines: [], bezig: [] });
    return perDag.get(d);
  };
  for (const l of lijsten || []) {
    if (l.mailInbox || l.project?.afgerond) continue;
    const meta = { lijstId: l.id, lijstNaam: l.name, icoon: l.icon || "💼", klantId: l.project?.klantId || null, project: !!l.project };
    // Draaidagen van het project (ook als er geen taak voor is).
    const draaiDatums = new Set();
    if (l.project && !["aanvraag", "offerte", "afgewezen"].includes(l.project.status)) {
      for (const d of draaidagenVan(l.project)) {
        if (d.datum >= start && d.datum <= eind && !draaiDatums.has(d.datum)) { draaiDatums.add(d.datum); dag(d.datum).draaidagen.push({ ...meta, naam: "Draaidag" }); }
      }
    }
    for (const i of l.items || []) {
      if (i.checked || !i.dueDate) continue;
      const item = { ...meta, item: i, naam: i.name };
      if (wpIsDraai(i)) {
        if (i.dueDate >= start && i.dueDate <= eind && !draaiDatums.has(i.dueDate)) { draaiDatums.add(i.dueDate); dag(i.dueDate).draaidagen.push({ ...meta, naam: "Draaidag" }); }
        continue;
      }
      if (isVastePlanning(i) && !i.vast) { if (i.dueDate >= start && i.dueDate <= eind) dag(i.dueDate).momenten.push(item); continue; }
      if (i.dueDate >= start && i.dueDate <= eind) dag(i.dueDate).deadlines.push(item);
      // Taken met een duur: ook de dagen ervóór (bezig) tellen mee.
      if (duurVan(i) > 1) {
        let d = startVan(i);
        for (let n = 0; n < 60 && d && d < i.dueDate; n++) { if (d >= start && d <= eind && !isVrijeDag(d)) dag(d).bezig.push(item); d = plusWerkdagen(d, 1); }
      }
    }
  }
  const uit = [];
  for (let d = start, n = 0; d <= eind && n < 400; d = plusDagen(d, 1), n++) {
    const x = perDag.get(d) || { datum: d, draaidagen: [], momenten: [], deadlines: [], bezig: [] };
    const score = x.deadlines.length + x.momenten.length + x.bezig.length;
    const niveau = x.draaidagen.length ? "vol" : score >= DRUKTE_GRENS.vol ? "vol" : score >= DRUKTE_GRENS.druk ? "druk" : "rustig";
    uit.push({ ...x, score, niveau, vrij: isVrijeDag(d) ? vrijeDagReden(d) : null, leeg: !score && !x.draaidagen.length });
  }
  return uit;
}

// Waarschuwingen over alles heen.
export function werkplanningWaarschuwingen(dagen) {
  const uit = [];
  for (const d of dagen) {
    const projecten = new Set(d.draaidagen.map(x => x.lijstId));
    if (projecten.size >= 2) uit.push({ datum: d.datum, soort: "dubbele-draaidag", tekst: `Twee draaidagen op één dag: ${d.draaidagen.map(x => x.lijstNaam).join(" en ")}` });
    else if (d.draaidagen.length && (d.deadlines.length + d.momenten.length) > 0) uit.push({ datum: d.datum, soort: "draaidag-druk", tekst: `Draaidag (${d.draaidagen[0].lijstNaam}) én ${d.deadlines.length + d.momenten.length} andere ${d.deadlines.length + d.momenten.length === 1 ? "taak" : "taken"}` });
    if (d.vrij && d.vrij !== "Weekend" && (d.deadlines.length || d.momenten.length || d.draaidagen.length)) uit.push({ datum: d.datum, soort: "vrije-dag", tekst: `${d.vrij}: ${d.deadlines.length + d.momenten.length + d.draaidagen.length} ingepland` });
    if (!d.draaidagen.length && d.niveau === "vol") uit.push({ datum: d.datum, soort: "piek", tekst: `${d.score} dingen op één dag` });
  }
  return uit;
}

// Per week samengevat (ma t/m vr), voor het overzicht.
export function perWeek(dagen) {
  const weken = [];
  for (const d of dagen) {
    const x = new Date(`${d.datum}T12:00:00`);
    const ma = new Date(x); ma.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    const sleutel = `${ma.getFullYear()}-${String(ma.getMonth() + 1).padStart(2, "0")}-${String(ma.getDate()).padStart(2, "0")}`;
    let w = weken[weken.length - 1];
    if (!w || w.maandag !== sleutel) { w = { maandag: sleutel, dagen: [] }; weken.push(w); }
    w.dagen.push(d);
  }
  return weken.map(w => ({ ...w, totaal: w.dagen.reduce((n, d) => n + d.score + d.draaidagen.length, 0), zwaarste: w.dagen.reduce((m, d) => (["rustig", "druk", "vol"].indexOf(d.niveau) > ["rustig", "druk", "vol"].indexOf(m) ? d.niveau : m), "rustig") }));
}
