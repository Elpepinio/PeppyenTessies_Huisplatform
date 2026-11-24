import { plekkenUitOfferte, vulBezettingUitOfferte } from "./offerte-pdf-logica";

// ════════════════════════════════════════════════════════════════════
// MEERDERE OFFERTES PER AANVRAAG
//   • variant  — een extra optie naast de andere ("1 persoon" / "2 personen")
//   • revisie  — een nieuwe versie die een eerdere vervangt (na een review)
// Per versie: bedrag, datum, eventueel de ingelezen specificatie, wat er
// is veranderd t.o.v. de vorige, en een status:
//   open · vervangen · gekozen · niet-gekozen
// `project.offerte` blijft de werkversie waar de rest van de app mee
// rekent: vóór akkoord de laatst verstuurde, ná akkoord de gekozen versie.
// ════════════════════════════════════════════════════════════════════
const rv2 = (n) => Math.round(n * 100) / 100;

export function offerteVersies(p = {}) {
  if (Array.isArray(p.offertes) && p.offertes.length) return p.offertes;
  if (!p.offerte) return [];
  const o = p.offerte;
  return [{
    id: "v1", nr: 1, naam: "Offerte", soort: "eerste",
    verstuurdOp: o.verstuurdOp || null, bedrag: o.bedrag ?? null, specificatie: o.specificatie || null, notitie: "",
    status: o.akkoordOp ? "gekozen" : o.afgewezenOp ? "niet-gekozen" : "open",
  }];
}
export const openVersies = (p) => offerteVersies(p).filter(v => v.status === "open");
export const gekozenVersie = (p) => offerteVersies(p).find(v => v.status === "gekozen") || null;

// Sleutel van een post die over versies heen hetzelfde blijft:
// kopje + postnaam (+ volgnummer als dezelfde naam vaker voorkomt).
function postSleutels(spec) {
  const uit = {};
  (spec?.kopjes || []).forEach((k, ki) => {
    const teller = {};
    k.posten.forEach((p, pi) => {
      const basis = `${k.naam}|${p.naam}`.toLowerCase();
      teller[basis] = (teller[basis] || 0) + 1;
      uit[`${basis}#${teller[basis]}`] = { sleutel: `${ki}.${pi}`, kopje: k.naam, ...p };
    });
  });
  return uit;
}

// Wat is er veranderd tussen twee versies?
export function vergelijkOffertes(oud, nieuw) {
  const bedragVerschil = oud?.bedrag != null && nieuw?.bedrag != null ? rv2(nieuw.bedrag - oud.bedrag) : null;
  const uit = { bedragVerschil, toegevoegd: [], verwijderd: [], gewijzigd: [], heeftPosten: false };
  if (oud?.specificatie && nieuw?.specificatie) {
    uit.heeftPosten = true;
    const a = postSleutels(oud.specificatie), b = postSleutels(nieuw.specificatie);
    for (const [k, p] of Object.entries(b)) {
      if (!a[k]) { if (p.totaal) uit.toegevoegd.push({ kopje: p.kopje, naam: p.naam, totaal: p.totaal, aantal: p.aantal, eenheid: p.eenheid }); continue; }
      const o = a[k];
      if (o.totaal !== p.totaal || o.aantal !== p.aantal || o.prijs !== p.prijs) {
        uit.gewijzigd.push({ kopje: p.kopje, naam: p.naam, van: { aantal: o.aantal, eenheid: o.eenheid, prijs: o.prijs, totaal: o.totaal }, naar: { aantal: p.aantal, eenheid: p.eenheid, prijs: p.prijs, totaal: p.totaal }, verschil: rv2((p.totaal || 0) - (o.totaal || 0)) });
      }
    }
    for (const [k, p] of Object.entries(a)) if (!b[k] && p.totaal) uit.verwijderd.push({ kopje: p.kopje, naam: p.naam, totaal: p.totaal, aantal: p.aantal, eenheid: p.eenheid });
  }
  const delen = [];
  if (bedragVerschil) delen.push(`${bedragVerschil > 0 ? "+" : "−"}€ ${Math.abs(bedragVerschil).toLocaleString("nl-NL", { maximumFractionDigits: 2 })}`);
  if (uit.toegevoegd.length) delen.push(`${uit.toegevoegd.length} ${uit.toegevoegd.length === 1 ? "post" : "posten"} erbij`);
  if (uit.verwijderd.length) delen.push(`${uit.verwijderd.length} eraf`);
  if (uit.gewijzigd.length) delen.push(`${uit.gewijzigd.length} gewijzigd`);
  uit.samenvatting = delen.join(" · ") || "geen verschil in bedrag of posten";
  return uit;
}

// Werkelijke kosten / eigen-werk-keuzes (per "kopje.post"-index) meenemen
// naar een nieuwe specificatie, op basis van kopje + postnaam.
export function zetSleutelsOm(oudSpec, nieuwSpec, map = {}) {
  if (!oudSpec || !nieuwSpec) return {};
  const a = postSleutels(oudSpec), b = postSleutels(nieuwSpec);
  const uit = {};
  for (const [k, p] of Object.entries(a)) if (b[k] && map[p.sleutel] !== undefined) uit[b[k].sleutel] = map[p.sleutel];
  return uit;
}

function werkversie(p, v, { metAfspraken = false } = {}) {
  const o = p.offerte || {};
  const basis = {
    ...o, versieId: v.id, bedrag: v.bedrag, verstuurdOp: v.verstuurdOp || o.verstuurdOp,
    specificatie: v.specificatie || null,
  };
  if (!metAfspraken) return basis;
  return {
    ...basis,
    werkelijk: v.specificatie && o.specificatie ? zetSleutelsOm(o.specificatie, v.specificatie, o.werkelijk || {}) : (v.specificatie ? {} : o.werkelijk || {}),
    eigen: v.specificatie && o.specificatie ? zetSleutelsOm(o.specificatie, v.specificatie, o.eigen || {}) : (v.specificatie ? {} : o.eigen || {}),
  };
}

// Nieuwe versie of variant toevoegen.
export function voegOfferteVersieToe(lijst, { soort = "revisie", naam = "", verstuurdOp, bedrag = null, specificatie = null, notitie = "", vervangtId = null }, { nieuwId, nu = Date.now() }) {
  const p = lijst.project || {};
  let versies = offerteVersies(p).map(v => ({ ...v }));
  const nr = versies.reduce((m, v) => Math.max(m, v.nr || 0), 0) + 1;
  const vervangt = soort === "revisie" ? (versies.find(v => v.id === vervangtId) || [...versies].reverse().find(v => v.status === "gekozen" || v.status === "open")) : null;
  const nieuw = {
    id: nieuwId(), nr, soort: vervangt ? "revisie" : "variant",
    naam: naam.trim() || (vervangt ? `${vervangt.naam.replace(/\s*\(v\d+\)$/, "")} (v${nr})` : `Optie ${nr}`),
    verstuurdOp, bedrag: bedrag != null ? Number(bedrag) : null, specificatie, notitie: String(notitie || "").slice(0, 1000),
    vervangtId: vervangt?.id || null, status: vervangt?.status === "gekozen" ? "gekozen" : "open", aangemaaktOp: nu,
  };
  if (vervangt) {
    nieuw.wijzigingen = vergelijkOffertes(vervangt, nieuw);
    versies = versies.map(v => (v.id === vervangt.id ? { ...v, status: "vervangen", vervangenDoor: nieuw.id } : v));
  }
  versies.push(nieuw);
  const offerte = werkversie(p, nieuw, { metAfspraken: nieuw.status === "gekozen" });
  return { ...lijst, project: { ...p, offertes: versies, offerte } };
}

// Bij akkoord: welke offerte is het geworden? De rest wordt "niet gekozen".
export function kiesOfferteVersie(lijst, id) {
  const p = lijst.project || {};
  const versies = offerteVersies(p);
  const gekozen = versies.find(v => v.id === id);
  if (!gekozen) return lijst;
  return {
    ...lijst,
    project: {
      ...p,
      offertes: versies.map(v => (v.id === id ? { ...v, status: "gekozen" } : v.status === "open" ? { ...v, status: "niet-gekozen" } : v)),
      offerte: werkversie(p, gekozen),
    },
  };
}

// Na een herziene offerte in een lopend project: de plekken (crew, cast,
// locaties…) bijwerken. Plekken die blijven krijgen het nieuwe budget;
// nieuwe plekken komen erbij; lege plekken die niet meer in de offerte staan
// verdwijnen; plekken mét naam die er niet meer in staan krijgen een
// waarschuwing (niet zomaar weggooien — daar is al iets afgesproken).
export function synchroniseerPlekken(lijst, spec, { nieuwId }) {
  const plekken = plekkenUitOfferte(spec);
  const gebruikt = new Set();
  let bijgewerkt = 0, verwijderd = 0, vervallen = 0;
  const items = (lijst.items || []).map(i => {
    if (!(i.bezetting || []).some(b => b.offerte)) return i;
    const bezetting = [];
    for (const b of i.bezetting) {
      if (!b.offerte) { bezetting.push(b); continue; }
      const match = plekken.find(pl => !gebruikt.has(pl.plekKey) && pl.plekKey === b.offerte.plekKey)
        || plekken.find(pl => !gebruikt.has(pl.plekKey) && pl.onderdeelId === b.onderdeelId && pl.label === b.offerte.label);
      if (match) {
        gebruikt.add(match.plekKey);
        const veranderd = match.begroot !== b.offerte.begroot || match.tekst !== b.offerte.tekst;
        if (veranderd) bijgewerkt++;
        bezetting.push({ ...b, offerte: { plekKey: match.plekKey, label: match.label, begroot: match.begroot, tekst: match.tekst, posten: match.posten.map(x => ({ sleutel: x.sleutel, aandeel: x.aandeel })), ...(veranderd ? { vorigBegroot: b.offerte.begroot } : {}) } });
      } else if (!b.naam) {
        verwijderd++;
      } else {
        vervallen++;
        bezetting.push({ ...b, offerte: { ...b.offerte, vervallen: true, posten: [] } });
      }
    }
    return { ...i, bezetting };
  });
  const r = vulBezettingUitOfferte({ ...lijst, items }, spec, { nieuwId });
  return { lijst: r.lijst, toegevoegd: r.toegevoegd, bijgewerkt, verwijderd, vervallen };
}
