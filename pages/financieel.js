import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, AlertTriangle } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// Financieel overzicht — GEEN vergunninghoudend financieel adviseur. Hypotheek-
// en beleggingsadvies aan consumenten is in Nederland een gereguleerde
// activiteit onder de Wet op het financieel toezicht (Wft), waarvoor een
// AFM-vergunning nodig is. Deze tool geeft daarom geen bindende "doe dit"-
// aanbevelingen, maar rekent scenario's en actuele regelgeving (2026) door,
// zodat jullie zelf — eventueel samen met een erkend adviseur — een
// onderbouwde keuze kunnen maken. Zie de permanente disclaimer onderaan elk
// tabblad.
// ═══════════════════════════════════════════════════════════════════════════════

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const euro = n => `€ ${Math.round(n || 0).toLocaleString("nl-NL")}`;
const euro2 = n => `€ ${(n || 0).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Box 1 — inkomstenbelasting op loon/winst (2026) ──────────────────────
const BOX1_SCHIJVEN_2026 = [
  { tot: 38883, tarief: 0.3575 },
  { tot: 78426, tarief: 0.3756 },
  { tot: Infinity, tarief: 0.4950 },
];
function berekenBox1Belasting(inkomen) {
  if (!inkomen || inkomen <= 0) return 0;
  let belasting = 0, vorigeGrens = 0;
  for (const schijf of BOX1_SCHIJVEN_2026) {
    const inDezeSchijf = Math.max(0, Math.min(inkomen, schijf.tot) - vorigeGrens);
    belasting += inDezeSchijf * schijf.tarief;
    vorigeGrens = schijf.tot;
    if (inkomen <= schijf.tot) break;
  }
  return Math.round(belasting);
}

// ── Heffingskortingen 2026 ────────────────────────────────────────────────
function berekenAlgemeneHeffingskorting(inkomen) {
  const MAX = 3115, AFBOUW_VANAF = 29736, AFBOUW_PCT = 0.06398;
  if (!inkomen || inkomen <= 0) return 0;
  if (inkomen <= AFBOUW_VANAF) return MAX;
  return Math.max(0, Math.round(MAX - (inkomen - AFBOUW_VANAF) * AFBOUW_PCT));
}
// Officiële knikpunten Belastingdienst 2026 (drie oplopende opbouwtrajecten,
// daarna één afbouwtraject) — bewust niet afgerond tot een simpele
// driehoeksformule, want elk knikpunt wijzigt jaarlijks en de exacte
// percentages per traject lopen uiteen.
function berekenArbeidskorting(arbeidsinkomen) {
  const i = arbeidsinkomen || 0;
  if (i <= 0) return 0;
  if (i <= 11965) return Math.round(i * 0.08324);
  if (i <= 25845) return Math.round(996 + (i - 11965) * 0.31009);
  if (i <= 45592) return Math.round(5300 + (i - 25845) * 0.0195);
  if (i <= 132920) return Math.max(0, Math.round(5685 - (i - 45592) * 0.0651));
  return 0;
}

// ── ZZP-aftrekposten 2026 ─────────────────────────────────────────────────
const ZELFSTANDIGENAFTREK_2026 = 1200; // daalt verder naar 900 in 2027
const STARTERSAFTREK_2026 = 2123; // bovenop zelfstandigenaftrek, eerste max. 3 jaar (max 3x in 5 jaar)
const MKB_WINSTVRIJSTELLING_PCT = 0.127;
// Winst vóór aftrek → belastbare winst ná zelfstandigenaftrek + MKB-vrijstelling.
// Vereist het urencriterium (minimaal 1.225 uur/jaar aan de onderneming).
function berekenBelastbareWinstZzp(winstVoorAftrek, { voldoetUrencriterium = true, isStarter = false } = {}) {
  if (!winstVoorAftrek || winstVoorAftrek <= 0) return { belastbareWinst: Math.max(0, winstVoorAftrek || 0), zelfstandigenaftrek: 0, startersaftrek: 0, mkbVrijstelling: 0 };
  const zelfstandigenaftrek = voldoetUrencriterium ? Math.min(ZELFSTANDIGENAFTREK_2026, winstVoorAftrek) : 0;
  const startersaftrek = (voldoetUrencriterium && isStarter) ? Math.min(STARTERSAFTREK_2026, Math.max(0, winstVoorAftrek - zelfstandigenaftrek)) : 0;
  const naOndernemersaftrek = Math.max(0, winstVoorAftrek - zelfstandigenaftrek - startersaftrek);
  const mkbVrijstelling = Math.round(naOndernemersaftrek * MKB_WINSTVRIJSTELLING_PCT);
  const belastbareWinst = naOndernemersaftrek - mkbVrijstelling;
  return { belastbareWinst, zelfstandigenaftrek, startersaftrek, mkbVrijstelling };
}

// Zorgverzekeringswet — zzp'ers krijgen hiervoor een aparte aanslag van de
// Belastingdienst, los van de reguliere zorgpremie; werknemers hebben dit
// niet (bij hen draagt de werkgever de Zvw-heffing, dat raakt het nettoloon
// niet). Grondslag is de belastbare winst (ná ondernemersaftrek/MKB-
// vrijstelling), tot een maximum.
const ZVW_PERCENTAGE_ZZP_2026 = 0.0485;
const ZVW_MAX_BIJDRAGE_INKOMEN_2026 = 79409;
function berekenZvwBijdrageZzp(belastbareWinst) {
  if (!belastbareWinst || belastbareWinst <= 0) return 0;
  const grondslag = Math.min(belastbareWinst, ZVW_MAX_BIJDRAGE_INKOMEN_2026);
  return Math.round(grondslag * ZVW_PERCENTAGE_ZZP_2026);
}

// Het geld dat een zzp'er daadwerkelijk ontvangt is de VOLLEDIGE winst vóór
// aftrek, minus de belasting die over de (lagere) belastbare winst wordt
// geheven, minus de Zvw-bijdrage, plus heffingskortingen. Zelfstandigenaftrek/
// MKB-vrijstelling zijn geen geld dat je misloopt — ze verlagen alleen
// waarover belasting wordt geheven. Bewust als eigen functie: het
// verwisselen van bruto en belastbare winst hier leverde in een eerdere
// versie een verschil van duizenden euro's op.
// Heffingskortingen zijn niet-verzilverbaar BOVEN de belasting die je zelf
// verschuldigd bent — zonder fiscaal partnerschap kun je er niet méér netto
// mee overhouden dan je bruto hebt verdiend. Deze tool modelleert bewust
// geen overdracht van onbenutte korting naar een partner (dat is nog een
// aparte, complexe regeling) — vandaar deze begrenzing, de voorzichtigste
// aanname. Zonder deze begrenzing ontstond bij een zeer lage (zzp-)winst
// een onmogelijke marginale druk van well boven de 100%, doordat de
// algemene heffingskorting in één klap van €0 naar het volledige maximum
// sprong zodra de belastbare winst (na zelfstandigenaftrek) van exact €0
// naar een fractie daarboven ging.
function begrensHeffingskortingen(heffingskortingen, belasting) {
  return Math.min(heffingskortingen, belasting);
}

// Zelfde redenering als bij het ZZP-inkomen: zonder deze begrenzing zou een
// heel laag loondienstinkomen een netto tonen dat HOGER is dan het bruto
// zelf (de heffingskortingen zouden dan meer "terugbetalen" dan er aan
// belasting tegenover staat) — onrealistisch zonder een partner die het
// onbenutte deel kan overnemen, wat deze tool bewust niet modelleert.
function berekenNettoLoondienstInkomen(loondienst) {
  const belasting = berekenBox1Belasting(loondienst);
  const algemeneHeffingskorting = berekenAlgemeneHeffingskorting(loondienst);
  const arbeidskorting = berekenArbeidskorting(loondienst);
  const benutbareKorting = begrensHeffingskortingen(algemeneHeffingskorting + arbeidskorting, belasting);
  const netto = Math.max(0, loondienst || 0) - belasting + benutbareKorting;
  return { netto, belasting, algemeneHeffingskorting, arbeidskorting, benutbareKorting };
}

function berekenNettoZzpInkomen(winstVoorAftrek, { voldoetUrencriterium = true, isStarter = false } = {}) {
  const { belastbareWinst } = berekenBelastbareWinstZzp(winstVoorAftrek, { voldoetUrencriterium, isStarter });
  const belasting = berekenBox1Belasting(belastbareWinst);
  const algemeneHeffingskorting = berekenAlgemeneHeffingskorting(belastbareWinst);
  const arbeidskorting = berekenArbeidskorting(winstVoorAftrek); // over het arbeidsinkomen vóór ondernemersaftrek
  const zvwBijdrage = berekenZvwBijdrageZzp(belastbareWinst);
  const benutbareKorting = begrensHeffingskortingen(algemeneHeffingskorting + arbeidskorting, belasting);
  const netto = Math.max(0, winstVoorAftrek) - belasting - zvwBijdrage + benutbareKorting;
  return { netto, belastbareWinst, belasting, algemeneHeffingskorting, arbeidskorting, benutbareKorting, zvwBijdrage };
}

// ── Box 2 — aanmerkelijk belang/dividend uit de BV (2026) ────────────────
const BOX2_GRENS_2026 = 68843;
// Wat houd je netto over van de eerstvolgende extra verdiende €1.000? Door de
// gelijktijdige afbouw van algemene heffingskorting én arbeidskorting kan dit
// percentage, juist in het middeninkomen, verrassend laag uitvallen — lager
// dan het tarief van de belastingschijf zelf doet vermoeden. Genuttigd als
// inzicht bij de vraag "is extra werk/een hogere winst de moeite waard", niet
// als voorspelling van de exacte aanslag.
function berekenMarginaleDruk(winstVoorAftrek, opties = {}) {
  if (!winstVoorAftrek || winstVoorAftrek <= 0) return null;
  const STAP = 1000;
  const nettoNu = berekenNettoZzpInkomen(winstVoorAftrek, opties).netto;
  const nettoMeer = berekenNettoZzpInkomen(winstVoorAftrek + STAP, opties).netto;
  const percentageBehouden = Math.round(((nettoMeer - nettoNu) / STAP) * 100);
  return { percentageBehouden, nettoVanExtra: Math.round(nettoMeer - nettoNu) };
}

function berekenBox2Belasting(dividendUitkering) {
  if (!dividendUitkering || dividendUitkering <= 0) return 0;
  const laag = Math.min(dividendUitkering, BOX2_GRENS_2026) * 0.245;
  const hoog = Math.max(0, dividendUitkering - BOX2_GRENS_2026) * 0.31;
  return Math.round(laag + hoog);
}

// ── Box 3 — vermogensbelasting op sparen/beleggen (2026) ─────────────────
const BOX3_2026 = {
  heffingsvrijPerPersoon: 59357,
  forfaitSpaargeld: 0.0128,
  forfaitOverig: 0.06,
  forfaitSchulden: 0.027,
  tarief: 0.36,
};
// Vereenvoudigd: gaat uit van het EIGEN vermogen in box 3 (spaargeld +
// beleggingen - schulden), zonder peildatumschulden/drempel voor schulden
// (die een klein drempelbedrag kent) — voor een grove jaarlijkse inschatting
// is dat voldoende nauwkeurig; voor de exacte aangifte geldt altijd de
// Belastingdienst-berekening.
function berekenBox3Belasting({ spaargeld = 0, beleggingen = 0, schulden = 0, aantalPersonen = 1 }) {
  const heffingsvrij = BOX3_2026.heffingsvrijPerPersoon * aantalPersonen;
  const forfaitairRendement =
    spaargeld * BOX3_2026.forfaitSpaargeld +
    beleggingen * BOX3_2026.forfaitOverig -
    schulden * BOX3_2026.forfaitSchulden;
  const totaalVermogen = spaargeld + beleggingen - schulden;
  const grondslag = Math.max(0, totaalVermogen - heffingsvrij);
  // Het forfaitair rendement wordt naar rato van de grondslag-boven-vrijstelling
  // belast (vereenvoudigde, in de praktijk gangbare benadering).
  const belastbaarRendement = totaalVermogen > 0 ? forfaitairRendement * (grondslag / totaalVermogen) : 0;
  return Math.max(0, Math.round(belastbaarRendement * BOX3_2026.tarief));
}

// ── Vennootschapsbelasting 2026 (voor de BV) ──────────────────────────────
const VPB_GRENS_2026 = 200000;
function berekenVpb(winst) {
  if (!winst || winst <= 0) return 0;
  const laag = Math.min(winst, VPB_GRENS_2026) * 0.19;
  const hoog = Math.max(0, winst - VPB_GRENS_2026) * 0.258;
  return Math.round(laag + hoog);
}

// ── Eigenwoningforfait + Wet Hillen 2026 ─────────────────────────────────
// Een stuk van je huis "telt mee als inkomen" (het eigenwoningforfait) als
// tegenhanger van de hypotheekrenteaftrek — dit geldt voor IEDERE
// huiseigenaar-bewoner, ook met een afgeloste hypotheek. Heb je weinig of
// geen aftrekbare rente, dan compenseert de Wet Hillen een deel daarvan,
// maar dat percentage daalt elk jaar (2026: 71,867%, op weg naar 0% in 2041).
const EIGENWONINGFORFAIT_GRENS_2026 = 1350000;
function berekenEigenwoningforfait(wozWaarde) {
  if (!wozWaarde || wozWaarde <= 0) return 0;
  if (wozWaarde <= EIGENWONINGFORFAIT_GRENS_2026) return Math.round(wozWaarde * 0.0035);
  return Math.round(EIGENWONINGFORFAIT_GRENS_2026 * 0.0035 + (wozWaarde - EIGENWONINGFORFAIT_GRENS_2026) * 0.0235);
}
const WET_HILLEN_PERCENTAGE_2026 = 0.71867;
function berekenWetHillenAftrek(eigenwoningforfait, aftrekbareRente) {
  const verschil = Math.max(0, (eigenwoningforfait || 0) - (aftrekbareRente || 0));
  return Math.round(verschil * WET_HILLEN_PERCENTAGE_2026);
}

// ── Pensioenopbouw-gat (standaard middelloonregeling, 2026) ──────────────
// Een zzp'er bouwt, anders dan een werknemer, standaard GEEN pensioen op —
// tenzij daar zelf iets voor geregeld is (lijfrente, banksparen). Dit laat
// zien hoeveel een werknemer jaarlijks opbouwt, als ijkpunt voor dat gat.
const AOW_FRANCHISE_2026 = 19172;
const PENSIOENOPBOUW_PCT_2026 = 0.01875;
const MAX_PENSIOENGEVEND_LOON_2026 = 137800;
function berekenJaarlijksePensioenopbouw(brutoJaarloon) {
  if (!brutoJaarloon || brutoJaarloon <= 0) return 0;
  const pensioengevendLoon = Math.min(brutoJaarloon, MAX_PENSIOENGEVEND_LOON_2026);
  const grondslag = Math.max(0, pensioengevendLoon - AOW_FRANCHISE_2026);
  return Math.round(grondslag * PENSIOENOPBOUW_PCT_2026);
}

// ── Noodbuffer ────────────────────────────────────────────────────────────
// Een vuistregel van financieel adviseurs, vóór er over aflossen of
// beleggen wordt nagedacht: 3 tot 6 maanden vaste lasten achter de hand.
function berekenNoodbufferStatus(maandelijkseVasteLasten, huidigSpaargeld) {
  if (!maandelijkseVasteLasten || maandelijkseVasteLasten <= 0) return null;
  const minBuffer = maandelijkseVasteLasten * 3, maxBuffer = maandelijkseVasteLasten * 6;
  const spaargeld = huidigSpaargeld || 0;
  return {
    minBuffer, maxBuffer,
    voldoendeMinimum: spaargeld >= minBuffer,
    voldoendeRuim: spaargeld >= maxBuffer,
    tekortTotMinimum: Math.max(0, minBuffer - spaargeld),
  };
}

// ── Erfbelasting tussen partners (2026) ──────────────────────────────────
// Het grote, vaak onbekende risico voor ongehuwd samenwonenden: zonder een
// notarieel samenlevingscontract (met wederzijdse zorgverplichting, en
// minimaal 6 maanden samen op hetzelfde adres ingeschreven) telt een partner
// voor de erfbelasting NIET als partner, maar als "overige verkrijger" — een
// vrijstelling van een paar duizend euro in plaats van ruim acht ton.
const ERFBELASTING_PARTNERVRIJSTELLING_2026 = 828035;
const ERFBELASTING_OVERIGE_VRIJSTELLING_2026 = 2769;
const ERFBELASTING_SCHIJFGRENS_2026 = 158669;
function berekenErfbelastingPartner(erfdeel, heeftSamenlevingscontract) {
  if (!erfdeel || erfdeel <= 0) return 0;
  const vrijstelling = heeftSamenlevingscontract ? ERFBELASTING_PARTNERVRIJSTELLING_2026 : ERFBELASTING_OVERIGE_VRIJSTELLING_2026;
  const belast = Math.max(0, erfdeel - vrijstelling);
  const laagTarief = heeftSamenlevingscontract ? 0.10 : 0.30;
  const hoogTarief = heeftSamenlevingscontract ? 0.20 : 0.40;
  const laag = Math.min(belast, ERFBELASTING_SCHIJFGRENS_2026) * laagTarief;
  const hoog = Math.max(0, belast - ERFBELASTING_SCHIJFGRENS_2026) * hoogTarief;
  return Math.round(laag + hoog);
}

// ── Zorgtoeslag 2026 (lineaire schatting tussen de bekende ijkpunten:
//    vlak maximum tot een startinkomen, daarna aflopend naar 0 bij de harde
//    inkomensgrens) ──────────────────────────────────────────────────────
function berekenZorgtoeslagPerMaand(toetsingsinkomen, heeftToeslagpartner) {
  if (toetsingsinkomen == null || toetsingsinkomen < 0) return 0;
  const MAX = heeftToeslagpartner ? 246 : 129;
  const MAX_TOT = heeftToeslagpartner ? 39000 : 29500;
  const GRENS = heeftToeslagpartner ? 51142 : 40857;
  if (toetsingsinkomen <= MAX_TOT) return MAX;
  if (toetsingsinkomen >= GRENS) return 0;
  const fractie = (GRENS - toetsingsinkomen) / (GRENS - MAX_TOT);
  return Math.round(MAX * fractie);
}

// ── Kindgebonden budget 2026 ──────────────────────────────────────────────
function berekenKindgebondenBudgetPerJaar(aantalKinderen, toetsingsinkomen, heeftToeslagpartner) {
  if (!aantalKinderen || aantalKinderen <= 0) return 0;
  const basisPerKind = 2580;
  const basisTotaal = basisPerKind * aantalKinderen;
  const afbouwVanaf = heeftToeslagpartner ? 39141 : 29736;
  const AFBOUW_PCT = 0.0675;
  if ((toetsingsinkomen || 0) <= afbouwVanaf) return basisTotaal;
  const afbouw = (toetsingsinkomen - afbouwVanaf) * AFBOUW_PCT;
  return Math.max(0, Math.round(basisTotaal - afbouw));
}

// ── Kinderopvangtoeslag 2026 ──────────────────────────────────────────────
const KOT_MAX_UURPRIJS_2026 = { dagopvang: 11.23, bso: 9.98, gastouder: 8.49 };
const KOT_MAX_UREN_PER_MAAND = 230;
// Officiële tabel heeft ±70 inkomensschijven met een geleidelijk dalende
// curve — hieronder een lineaire interpolatie tussen de bevestigde
// ijkpunten uit de Belastingdienst-tabel 2026. Nauwkeurig genoeg voor een
// inschatting; voor het exacte, bindende bedrag geldt altijd de
// proefberekening op toeslagen.nl.
const KOT_IJKPUNTEN_EERSTE_KIND = [
  { inkomen: 0,      pct: 0.960 },
  { inkomen: 56412,  pct: 0.960 },
  { inkomen: 80000,  pct: 0.859 },
  { inkomen: 100000, pct: 0.721 },
  { inkomen: 120000, pct: 0.606 },
  { inkomen: 165658, pct: 0.365 },
  { inkomen: 1000000,pct: 0.365 },
];
const KOT_IJKPUNTEN_VOLGEND_KIND = [
  { inkomen: 0,      pct: 0.960 },
  { inkomen: 56412,  pct: 0.960 },
  { inkomen: 80000,  pct: 0.939 },
  { inkomen: 100000, pct: 0.905 },
  { inkomen: 120000, pct: 0.879 },
  { inkomen: 235698, pct: 0.682 },
  { inkomen: 1000000,pct: 0.682 },
];
function interpoleerPercentage(inkomen, ijkpunten) {
  if (inkomen <= ijkpunten[0].inkomen) return ijkpunten[0].pct;
  for (let i = 1; i < ijkpunten.length; i++) {
    if (inkomen <= ijkpunten[i].inkomen) {
      const vorige = ijkpunten[i - 1], huidige = ijkpunten[i];
      const fractie = (inkomen - vorige.inkomen) / (huidige.inkomen - vorige.inkomen);
      return vorige.pct + (huidige.pct - vorige.pct) * fractie;
    }
  }
  return ijkpunten[ijkpunten.length - 1].pct;
}
// urenPerMaand/kind, type opvang, gezamenlijk toetsingsinkomen → geschatte
// toeslag per maand voor dat kind.
function berekenKinderopvangtoeslagPerKind(urenPerMaand, type, toetsingsinkomen, isEersteKind = true) {
  const uren = Math.min(urenPerMaand || 0, KOT_MAX_UREN_PER_MAAND);
  if (uren <= 0) return { toeslagPerMaand: 0, kostenPerMaand: 0, eigenBijdragePerMaand: 0, percentage: 0 };
  const uurprijs = KOT_MAX_UURPRIJS_2026[type] ?? KOT_MAX_UURPRIJS_2026.dagopvang;
  const ijkpunten = isEersteKind ? KOT_IJKPUNTEN_EERSTE_KIND : KOT_IJKPUNTEN_VOLGEND_KIND;
  const percentage = interpoleerPercentage(toetsingsinkomen || 0, ijkpunten);
  const kostenPerMaand = uren * uurprijs;
  const toeslagPerMaand = kostenPerMaand * percentage;
  return { toeslagPerMaand, kostenPerMaand, eigenBijdragePerMaand: kostenPerMaand - toeslagPerMaand, percentage };
}

// ── Overstap van dagopvang naar BSO (kind gaat naar school) ───────────────
// Rekent de toeslag over een heel kalenderjaar: dagopvang tot de overstapdatum,
// daarna buitenschoolse opvang (BSO) met eigen uren. In de maand van de
// overstap wordt naar rato van dagen verdeeld. Rekent met de tarieven en
// ijkpunten van 2026, ook voor latere jaren (die zijn nog niet vastgesteld),
// en met één vast toetsingsinkomen — dus een vergelijking, geen voorspelling.
function berekenKotJaar({ urenDag, typeDag, bsoUren, bsoVanaf, toetsingsinkomen, isEersteKind = true, jaar }) {
  const overstap = bsoVanaf ? new Date(`${bsoVanaf}T00:00:00`) : null;
  const heeftOverstap = !!overstap && !isNaN(overstap.getTime()) && typeDag !== "bso";
  const dag = berekenKinderopvangtoeslagPerKind(+urenDag || 0, typeDag, toetsingsinkomen, isEersteKind);
  const bso = heeftOverstap ? berekenKinderopvangtoeslagPerKind(+bsoUren || 0, "bso", toetsingsinkomen, isEersteKind) : dag;
  let toeslag = 0, kosten = 0, maandenDag = 0, maandenBso = 0;
  for (let m = 0; m < 12; m++) {
    let fractieDag = 1;
    if (heeftOverstap) {
      const start = new Date(jaar, m, 1), eind = new Date(jaar, m + 1, 1);
      if (overstap <= start) fractieDag = 0;
      else if (overstap < eind) fractieDag = (overstap.getDate() - 1) / new Date(jaar, m + 1, 0).getDate();
    }
    toeslag += fractieDag * dag.toeslagPerMaand + (1 - fractieDag) * bso.toeslagPerMaand;
    kosten += fractieDag * dag.kostenPerMaand + (1 - fractieDag) * bso.kostenPerMaand;
    maandenDag += fractieDag;
    maandenBso += 1 - fractieDag;
  }
  return {
    toeslag: Math.round(toeslag), kosten: Math.round(kosten), eigenBijdrage: Math.round(kosten - toeslag),
    maandenDag: Math.round(maandenDag * 10) / 10, maandenBso: Math.round(maandenBso * 10) / 10, heeftOverstap,
  };
}

// ── Dividend: dit jaar of volgend jaar uitkeren? ──────────────────────────
// Dividend uit je eigen BV (box 2) telt volledig mee in het toetsingsinkomen
// van het jaar waarin je het ontvangt. Toeslagen worden achteraf over het hele
// jaar herberekend: een hoger inkomen geeft dus een terugvordering, ook als
// de voorschotten eerder lager waren. Kinderbijslag (SVB) is inkomensonafhankelijk
// en zit hier dus niet in. Rekent met de tarieven van 2026 voor beide jaren.
function bouwKotKinderen(kot) {
  if (!kot) return [];
  return [
    { uren: kot.urenPerMaandKind1, type: kot.typeKind1 || "dagopvang", vanaf: kot.bsoVanaf1, bsoUren: kot.bsoUren1, eerste: true, actief: true },
    { uren: kot.urenPerMaandKind2, type: kot.typeKind2 || "dagopvang", vanaf: kot.bsoVanaf2, bsoUren: kot.bsoUren2, eerste: false, actief: (+kot.aantalKinderen || 1) >= 2 },
  ].filter(k => k.actief && +k.uren > 0);
}
function berekenToeslagenJaar(kinderen, aantalKinderen, toetsingsinkomen, jaar) {
  const kot = (kinderen || []).reduce((som, k) => som + berekenKotJaar({ urenDag: k.uren, typeDag: k.type, bsoUren: k.bsoUren, bsoVanaf: k.vanaf, toetsingsinkomen, isEersteKind: k.eerste, jaar }).toeslag, 0);
  const zorg = berekenZorgtoeslagPerMaand(toetsingsinkomen, true) * 12;
  const kgb = berekenKindgebondenBudgetPerJaar(+aantalKinderen || 0, toetsingsinkomen, true);
  return { kot, zorg, kgb, overig: zorg + kgb, totaal: kot + zorg + kgb };
}
function berekenDividendScenario({ dividend2026, dividend2027, basisToetsingsinkomen, kinderen, aantalKinderen }) {
  const d26 = Math.max(0, +dividend2026 || 0), d27 = Math.max(0, +dividend2027 || 0);
  const basis = +basisToetsingsinkomen || 0;
  const t26 = berekenToeslagenJaar(kinderen, aantalKinderen, basis + d26, 2026);
  const t27 = berekenToeslagenJaar(kinderen, aantalKinderen, basis + d27, 2027);
  const box2 = berekenBox2Belasting(d26) + berekenBox2Belasting(d27);
  const nettoDividend = d26 + d27 - box2;
  const toeslagen = t26.totaal + t27.totaal;
  return { dividend2026: d26, dividend2027: d27, box2, nettoDividend, t26, t27, kot: t26.kot + t27.kot, overig: t26.overig + t27.overig, toeslagen, nettoTotaal: Math.round(nettoDividend + toeslagen) };
}
// Loopt alle verdelingen af (stappen) en geeft de beste terug. Bij gelijkspel
// wint het latere jaar (minder uitkeren in 2026), omdat uitstel niets kost.
function berekenDividendOptimum(params, totaal, stappen = 100) {
  const T = Math.max(0, +totaal || 0);
  const punten = [];
  let beste = null;
  for (let i = 0; i <= stappen; i++) {
    const x = Math.round((T * i) / stappen);
    const sc = berekenDividendScenario({ ...params, dividend2026: x, dividend2027: T - x });
    punten.push({ x, nettoTotaal: sc.nettoTotaal });
    if (!beste || sc.nettoTotaal > beste.nettoTotaal) beste = { x, ...sc };
  }
  return { punten, beste };
}

const C = {
  bg: "#F7F4EC", surf: "#FFFFFF", card: "#F3EFE6", border: "#E4DCCB",
  accent: "#2D4A3E", accentLicht: "#4A7A6C", text: "#2D2A26", muted: "#8C8576",
  rood: "#C0392B", groen: "#3D7A5C", oranje: "#C97D0C",
};
const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "24px 20px 8px" },
  main: { padding: "4px 20px 60px" },
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 12 },
  inp: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, width: "100%", boxSizing: "border-box", color: C.text },
  label: { fontSize: 11.5, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 },
  tab: (active) => ({ flex: 1, border: "none", borderRadius: 9, padding: "9px 4px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", background: active ? C.accent : "transparent", color: active ? "#FFF" : C.muted }),
};

// Een klein, tikbaar "ⓘ"-icoontje naast vakjargon, met uitleg in gewone taal
// erachter. Tikken i.p.v. hoveren, want dit moet ook op een telefoon werken.
function Uitleg({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", marginLeft: 3, color: C.accentLicht, fontSize: 12, fontWeight: 700, verticalAlign: "middle" }}>
        ⓘ
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 29 }} onClick={() => setOpen(false)} />
          <div style={{ position: "absolute", zIndex: 30, top: "130%", left: 0, width: 250, background: C.text, color: "#FFF", borderRadius: 10, padding: "10px 12px", fontSize: 11.5, lineHeight: 1.5, boxShadow: "0 6px 20px rgba(0,0,0,0.3)" }}>
            {children}
          </div>
        </>
      )}
    </span>
  );
}

function Disclaimer() {
  return (
    <div style={{ background: "#FBF0E4", border: `1px solid #E8C9A0`, borderRadius: 14, padding: 14, marginTop: 8, marginBottom: 16, display: "flex", gap: 10 }}>
      <AlertTriangle size={18} color={C.oranje} style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ margin: 0, fontSize: 11.5, color: C.text, lineHeight: 1.5 }}>
        <strong>Geen vergunninghoudend financieel advies.</strong> Hypotheek- en beleggingsadvies aan consumenten is in Nederland een gereguleerde activiteit onder de Wft, waarvoor een AFM-vergunning nodig is. Deze tool rekent scenario's door op basis van actuele regelgeving (2026) en de cijfers die je zelf invoert — het is bedoeld als startpunt voor een eigen afweging of een gesprek met een erkend adviseur/accountant, niet als bindend advies. Toeslagbedragen zijn een inschatting; het exacte, bindende bedrag staat op toeslagen.nl.
      </p>
    </div>
  );
}

// Chatten over de eigen cijfers — zelfde patroon als de budget-chat elders
// in het huishoudplatform. Belangrijk: de AI krijgt hier expliciet mee dat
// ze GEEN vergunninghoudend adviseur is, zodat ook in een los gesprek de
// grens van de disclaimer overeind blijft.
function FinancieelChatPaneel({ context, onSluiten }) {
  const [berichten, setBerichten] = useState([]);
  const [invoer, setInvoer] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);
  const scrollRef = useRef(null);

  async function verstuur(tekst) {
    if (!tekst.trim() || bezig) return;
    const nieuw = [...berichten, { role: "user", text: tekst.trim() }];
    setBerichten(nieuw);
    setInvoer("");
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bron: "financieel-chat",
          systemPrompt: `Je legt begrippen en berekeningen uit binnen een financieel-overzicht-tool voor een Nederlands gezin (een partner in loondienst, een partner zzp'er, een BV die zakelijk belegt, en samen één kind). De tool behandelt: inkomen/belasting (box 1/2/3, zelfstandigenaftrek, Zvw), kinderopvangtoeslag/zorgtoeslag/kindgebonden budget, hypotheek (meerdere delen, eigenwoningforfait/Wet Hillen, aflossen vs. beleggen op één deel of op alle delen tegelijk, en Rabobank's boetevrije-aflosruimte), de BV (Vpb, dividend), én een "Vangnet"-tabblad met arbeidsongeschiktheid (AOV), pensioenopbouw-gat, een noodbuffer, en wat er gebeurt bij overlijden (erfbelasting, samenlevingscontract, testament, overlijdensrisicoverzekering), en een "Samenvatting"-tabblad dat automatisch aandachtspunten/inzichten uit alle andere tabbladen samenbrengt, en een "Mogelijkheden"-tabblad met legale privé- en zakelijke regelingen (lijfrente-jaarruimte, groene beleggingen, schenkingsvrijstelling, fiscaal partnerschap, lijfrente via de BV, dividend-timing, verliesverrekening in de BV, box 3-vermogen optimaal verdelen tussen partners, periodieke gift aan een goed doel) — expliciet als bespreekpunten geframed, geen bindend advies. Hieronder staan de cijfers die ze zelf in de tool hebben ingevuld.

Belangrijk: jij bent GEEN vergunninghoudend financieel adviseur. Hypotheek- en beleggingsadvies aan consumenten is in Nederland een gereguleerde activiteit onder de Wft, waarvoor een AFM-vergunning nodig is. Leg daarom begrippen, belastingregels en de berekeningen in de tool helder uit in doodgewone taal — reken gerust voorbeelden door met hún eigen cijfers — maar geef geen bindende persoonlijke aanbevelingen zoals "jullie moeten aflossen" of "beleg in X". Als iemand daar wel naar vraagt, leg dan de relevante afwegingen en factoren uit, en zeg dat een erkend financieel adviseur of accountant nodig is voor een bindend advies.

Houd antwoorden kort en concreet, in het Nederlands, zonder jargon tenzij je dat direct uitlegt.

Hun ingevulde cijfers:
${context}`,
          messages: nieuw.map(b => ({ role: b.role, content: b.text })),
          maxTokens: 700,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBerichten(b => [...b, { role: "assistant", text: data.text || "(geen antwoord ontvangen)" }]);
    } catch (e) {
      setFout("Kon geen antwoord ophalen: " + e.message);
    }
    setBezig(false);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [berichten, bezig]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end" }} onClick={onSluiten}>
      <div style={{ background: C.bg, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 560, margin: "0 auto", maxHeight: "85vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: `1px solid ${C.border}` }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>💬 Vraag het</h3>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>Snap je iets niet? Vraag het gewoon.</p>
          </div>
          <button onClick={onSluiten} style={{ background: "none", border: "none", fontSize: 18, color: C.muted, cursor: "pointer", padding: 4 }}>✕</button>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {berichten.length === 0 && !bezig && (
            <p style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 20 }}>
              Stel een vraag over wat je hier ziet — bv. "wat betekent box 3 voor ons?" of "waarom krijgen we minder toeslag dan ik dacht?".
            </p>
          )}
          {berichten.map((b, i) => (
            <div key={i} style={{ alignSelf: b.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", background: b.role === "user" ? C.accent : C.surf, color: b.role === "user" ? "#FFF" : C.text, border: b.role === "user" ? "none" : `1px solid ${C.border}`, borderRadius: 14, padding: "9px 13px", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {b.text}
            </div>
          ))}
          {bezig && (
            <div style={{ alignSelf: "flex-start", background: C.surf, border: `1px solid ${C.border}`, borderRadius: 14, padding: "9px 13px", fontSize: 13, color: C.muted }}>
              typt…
            </div>
          )}
          {fout && <p style={{ fontSize: 12, color: C.rood, textAlign: "center" }}>⚠️ {fout}</p>}
        </div>

        <div style={{ display: "flex", gap: 8, padding: "12px 18px", borderTop: `1px solid ${C.border}`, paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
          <input value={invoer} onChange={e => setInvoer(e.target.value)} placeholder="Typ je vraag…" autoFocus
            onKeyDown={e => { if (e.key === "Enter") verstuur(invoer); }}
            style={{ flex: 1, background: C.surf, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.text }} />
          <button onClick={() => verstuur(invoer)} disabled={bezig || !invoer.trim()}
            style={{ background: C.accent, color: "#FFF", border: "none", borderRadius: 10, padding: "0 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: (bezig || !invoer.trim()) ? 0.5 : 1 }}>
            Stuur
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FinancieelApp() {
  const [tab, setTab] = useState("overzicht");
  const [data, setData] = useState(null);
  const [laden, setLaden] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [saveFout, setSaveFout] = useState(false);
  const lastWriteRef = useRef(0);

  useEffect(() => {
    let actief = true;
    fetch("/api/financieel").then(r => r.json()).then(d => { if (actief) setData(d); }).catch(() => setData(LEEG_DATA())).finally(() => { if (actief) setLaden(false); });
    return () => { actief = false; };
  }, []);

  const persist = useCallback((patch) => {
    lastWriteRef.current = Date.now();
    setData(d => {
      const next = { ...d, ...patch };
      fetch("/api/financieel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) })
        .then(r => { if (!r.ok) throw new Error(); setSaveFout(false); })
        .catch(() => setSaveFout(true));
      return next;
    });
  }, []);

  if (laden || !data) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>Laden…</div>
  );

  return (
    <div style={S.appBg}>
      <header style={{ ...S.header, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Link href="/" style={{ fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, textDecoration: "none" }}>
            <ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> Terug
          </Link>
          <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700, color: C.accent }}>💶 Financieel overzicht</h1>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: C.muted }}>Jullie gezinsfinanciën — inzicht, geen bindend advies</p>
        </div>
        <button onClick={() => setShowChat(true)}
          style={{ background: C.accent, color: "#FFF", border: "none", borderRadius: 12, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginTop: 2 }}>
          💬 Vraag het
        </button>
      </header>

      {saveFout && (
        <div style={{ margin: "0 20px 8px", background: "#FBEAEA", border: `1px solid ${C.rood}44`, borderRadius: 10, padding: "9px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} color={C.rood} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 11.5, color: C.text }}>Opslaan is niet gelukt — controleer je verbinding. Je laatste wijziging staat mogelijk nog niet vast.</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 4, background: C.card, borderRadius: 11, padding: 3, margin: "12px 20px 4px", overflowX: "auto" }}>
        <button style={{ ...S.tab(tab==="overzicht"), flexShrink: 0 }} onClick={() => setTab("overzicht")}>Overzicht</button>
        <button style={{ ...S.tab(tab==="kinderopvang"), flexShrink: 0 }} onClick={() => setTab("kinderopvang")}>Toeslagen</button>
        <button style={{ ...S.tab(tab==="hypotheek"), flexShrink: 0 }} onClick={() => setTab("hypotheek")}>Hypotheek</button>
        <button style={{ ...S.tab(tab==="studieschuld"), flexShrink: 0 }} onClick={() => setTab("studieschuld")}>Studieschuld</button>
        <button style={{ ...S.tab(tab==="vangnet"), flexShrink: 0 }} onClick={() => setTab("vangnet")}>Vangnet</button>
        <button style={{ ...S.tab(tab==="bv"), flexShrink: 0 }} onClick={() => setTab("bv")}>BV</button>
        <button style={{ ...S.tab(tab==="samenvatting"), flexShrink: 0 }} onClick={() => setTab("samenvatting")}>📋 Samenvatting</button>
        <button style={{ ...S.tab(tab==="mogelijkheden"), flexShrink: 0 }} onClick={() => setTab("mogelijkheden")}>💡 Mogelijkheden</button>
      </div>

      <main style={S.main}>
        {tab === "overzicht" && <OverzichtTab data={data} persist={persist} />}
        {tab === "kinderopvang" && <KinderopvangTab data={data} persist={persist} />}
        {tab === "hypotheek" && <HypotheekTab data={data} persist={persist} />}
        {tab === "studieschuld" && <StudieschuldTab data={data} persist={persist} />}
        {tab === "vangnet" && <VangnetTab data={data} persist={persist} />}
        {tab === "bv" && <BvTab data={data} persist={persist} />}
        {tab === "samenvatting" && <SamenvattingTab data={data} setTab={setTab} />}
        {tab === "mogelijkheden" && <MogelijkhedenTab data={data} persist={persist} />}
      </main>

      {showChat && (
        <FinancieelChatPaneel context={bouwFinancieelContext(data)} onSluiten={() => setShowChat(false)} />
      )}
    </div>
  );
}

// Vat de door het gezin zelf ingevulde cijfers samen tot leesbare context
// voor de AI-chat — zodat een vraag als "wat betekent dit voor ons?" ook
// echt met hún eigen getallen beantwoord kan worden, niet in algemeenheden.
// ── Samenvatting: wat valt op in de ingevulde cijfers? ───────────────────
// Bewust GEEN "dit moet je doen"-aanbevelingen (zie de disclaimer: dat zou
// vergunningplichtig financieel advies zijn) — wel een geprioriteerd
// overzicht van waar de cijfers zelf om aandacht vragen, zodat je niet
// elk tabblad apart hoeft na te lopen om te zien wat relevant is.
// ── Lijfrente-jaarruimte 2026 ─────────────────────────────────────────────
// Het bedrag dat je dit jaar fiscaal aftrekbaar mag inleggen voor je
// pensioen (lijfrente, banksparen) — met name relevant voor de zzp-partner,
// die geen pensioen opbouwt via een werkgever. Gebaseerd op het inkomen van
// VORIG jaar; hier benaderd met het huidige ingevulde inkomen.
const JAARRUIMTE_PCT_2026 = 0.30;
const JAARRUIMTE_MAX_2026 = 35589;
const JAARRUIMTE_MAX_INKOMEN_2026 = 137800;
function berekenJaarruimteLijfrente(inkomen, pensioenaangroeiWerkgever = 0) {
  if (!inkomen || inkomen <= 0) return 0;
  const grondslag = Math.min(inkomen, JAARRUIMTE_MAX_INKOMEN_2026) - AOW_FRANCHISE_2026;
  if (grondslag <= 0) return 0;
  const ruimte = grondslag * JAARRUIMTE_PCT_2026 - 6.27 * (pensioenaangroeiWerkgever || 0);
  return Math.round(Math.min(JAARRUIMTE_MAX_2026, Math.max(0, ruimte)));
}

// ── Groene beleggingen — extra vrijstelling in box 3 (2026) ──────────────
// Bovenop het algemene heffingsvrij vermogen geldt een aparte vrijstelling
// voor erkende groene beleggingen/spaartegoeden, plus een kleine
// heffingskorting over het vrijgestelde bedrag.
const GROENE_BELEGGINGEN_VRIJSTELLING_2026 = 26715; // per persoon; x2 voor fiscale partners
const GROENE_BELEGGINGEN_HEFFINGSKORTING_PCT = 0.001;
function berekenGroeneBeleggingenVoordeel(huidigeGroeneBeleggingen, aantalPersonen = 2) {
  const vrijstelling = GROENE_BELEGGINGEN_VRIJSTELLING_2026 * aantalPersonen;
  const benut = Math.min(+huidigeGroeneBeleggingen || 0, vrijstelling);
  const heffingskorting = Math.round(benut * GROENE_BELEGGINGEN_HEFFINGSKORTING_PCT);
  return { vrijstelling, benut, heffingskorting, nogRuimte: Math.max(0, vrijstelling - benut) };
}

// ── Verliesverrekening in de BV (2026) ────────────────────────────────────
// Verliezen zijn sinds 2022 onbeperkt voorwaarts te verrekenen, maar met een
// plafond: tot €1 miljoen winst volledig verrekenbaar, daarboven nog maar
// 50% van het meerdere — zodat ook bij oude verliezen altijd een bodem aan
// Vpb verschuldigd blijft bij een grote winst.
const VERLIESVERREKENING_DREMPEL_2026 = 1000000;
function berekenVerliesverrekening(winst, compensabelVerlies) {
  const w = +winst || 0, v = +compensabelVerlies || 0;
  if (w <= 0 || v <= 0) return { verrekend: 0, restWinstNaVerrekening: Math.max(0, w), restVerlies: Math.max(0, v) };
  const volledigVerrekenbaar = Math.min(w, VERLIESVERREKENING_DREMPEL_2026);
  const verrekendOnderDrempel = Math.min(v, volledigVerrekenbaar);
  const restVerliesNaDrempel = v - verrekendOnderDrempel;
  const restWinstBovenDrempel = Math.max(0, w - VERLIESVERREKENING_DREMPEL_2026);
  const maxVerrekenBovenDrempel = restWinstBovenDrempel * 0.5;
  const verrekendBovenDrempel = Math.min(restVerliesNaDrempel, maxVerrekenBovenDrempel);
  const totaalVerrekend = verrekendOnderDrempel + verrekendBovenDrempel;
  return {
    verrekend: Math.round(totaalVerrekend),
    restWinstNaVerrekening: Math.round(w - totaalVerrekend),
    restVerlies: Math.round(v - totaalVerrekend),
  };
}

// ── Box 3: voordeel van optimaal verdelen tussen fiscale partners ────────
// Fiscale partners mogen de GEZAMENLIJKE grondslag en vrijstelling vrij
// verdelen over beide aangiftes — vergelijkt wat er gebeurt als ieders
// eigen vermogen apart (tegen de individuele vrijstelling) wordt
// aangegeven versus optimaal gecombineerd.
function berekenBox3VoordeelVerdelen(vermogenPartner1, vermogenPartner2) {
  const nietOptimaal =
    berekenBox3Belasting({ ...vermogenPartner1, aantalPersonen: 1 }) +
    berekenBox3Belasting({ ...vermogenPartner2, aantalPersonen: 1 });
  const optimaal = berekenBox3Belasting({
    spaargeld: (+vermogenPartner1.spaargeld || 0) + (+vermogenPartner2.spaargeld || 0),
    beleggingen: (+vermogenPartner1.beleggingen || 0) + (+vermogenPartner2.beleggingen || 0),
    schulden: (+vermogenPartner1.schulden || 0) + (+vermogenPartner2.schulden || 0),
    aantalPersonen: 2,
  });
  return { nietOptimaal, optimaal, besparing: nietOptimaal - optimaal };
}

function bouwAandachtspunten(data) {
  const punten = [];
  const loondienst = +data.inkomenLoondienst || 0;
  const winstZzp = +data.winstZzp || 0;
  const spaargeld = +data.spaargeld || 0;
  const v = data.vangnet || {};
  const delen = (data.hypotheek?.delen || []).filter(d => +d.schuld > 0);
  const heeftHypotheekschuld = delen.length > 0;

  // ── Risico's: ontbrekend vangnet ──────────────────────────────────────
  if (winstZzp > 0 && v.heeftAov === false) {
    punten.push({ id: "aov", prioriteit: "risico", tab: "vangnet",
      titel: "Geen arbeidsongeschiktheidsverzekering",
      tekst: "Bij langdurige ziekte valt het volledige zzp-inkomen weg, zonder vangnet zoals een werknemer dat via de WIA heeft." });
  } else if (winstZzp > 0 && v.heeftAov == null) {
    punten.push({ id: "aov-onbekend", prioriteit: "info", tab: "vangnet",
      titel: "Nog niet aangegeven: AOV",
      tekst: "Je hebt op het Vangnet-tabblad nog niet aangegeven of er een arbeidsongeschiktheidsverzekering is." });
  }

  if (winstZzp > 0 && v.zzpRegeltZelfPensioen === false) {
    const pensioenopbouwLoondienst = berekenJaarlijksePensioenopbouw(loondienst);
    punten.push({ id: "pensioen", prioriteit: "risico", tab: "vangnet",
      titel: "Pensioenopbouw-gat",
      tekst: loondienst > 0
        ? `De zzp-partner bouwt nog niets op voor later, terwijl de werknemer-partner ongeveer ${euro(pensioenopbouwLoondienst)} per jaar opbouwt.`
        : "De zzp-partner bouwt nog niets op voor later (geen lijfrente, banksparen of vergelijkbaars)." });
  }

  if (+v.maandelijkseVasteLasten > 0) {
    const buffer = berekenNoodbufferStatus(+v.maandelijkseVasteLasten, spaargeld);
    if (buffer && !buffer.voldoendeMinimum) {
      punten.push({ id: "buffer", prioriteit: "risico", tab: "vangnet",
        titel: "Noodbuffer onder het aanbevolen minimum",
        tekst: `Nog ${euro(buffer.tekortTotMinimum)} tot de aanbevolen 3 maanden vaste lasten — de gangbare vuistregel vóór aflossen of beleggen relevant wordt.` });
    }
  }

  if (v.heeftSamenlevingscontract !== true) {
    punten.push({ id: "samenlevingscontract", prioriteit: "risico", tab: "vangnet",
      titel: "Geen notarieel samenlevingscontract",
      tekst: "Zonder samenlevingscontract geldt bij overlijden niet de partnervrijstelling voor erfbelasting (€828.035), maar de vrijstelling voor 'overige verkrijgers' (€2.769) — een verschil van meestal tonnen." });
  }
  if (v.heeftTestament !== true) {
    punten.push({ id: "testament", prioriteit: "risico", tab: "vangnet",
      titel: "Geen testament",
      tekst: "Zonder testament erft de partner bij ongehuwd samenwonen wettelijk niets automatisch." });
  }
  if (heeftHypotheekschuld && v.heeftOrvGekoppeldAanHypotheek !== true) {
    punten.push({ id: "orv", prioriteit: "risico", tab: "vangnet",
      titel: "Geen overlijdensrisicoverzekering gekoppeld aan de hypotheek",
      tekst: "Bij overlijden moet de achterblijvende partner de hypotheeklast dan alleen kunnen dragen." });
  }

  // ── Compleetheid: ontbrekende invoer die het beeld scherper zou maken ──
  if (heeftHypotheekschuld && !(+data.hypotheek?.wozWaarde > 0)) {
    punten.push({ id: "woz", prioriteit: "info", tab: "hypotheek",
      titel: "WOZ-waarde nog niet ingevuld",
      tekst: "Zonder WOZ-waarde ontbreekt het eigenwoningforfait in het beeld — dat beïnvloedt hoe gunstig de hypotheekrenteaftrek in de praktijk uitpakt." });
  }

  // ── Studieschuld ──────────────────────────────────────────────────────
  const studieschulden = (data.studieschuld?.schulden || []).filter(x => +x.restschuld > 0);
  studieschulden.forEach(x => {
    const sim = simuleerStudieschuld(x.restschuld, x.rente, x.maandbedrag, x.resterendeJaren);
    if (!sim.kanBerekenen) {
      punten.push({ id: `studie-leeg-${x.id}`, prioriteit: "info", tab: "studieschuld",
        titel: `Studieschuld ${x.persoon || ""}: maandbedrag of looptijd ontbreekt`.replace("  ", " "),
        tekst: "Vul het maandbedrag aan DUO en de resterende looptijd in om te zien wanneer de schuld is afgelost." });
    } else if (!sim.wordtAfgelost) {
      punten.push({ id: `studie-kwijtschelding-${x.id}`, prioriteit: "kans", tab: "studieschuld",
        titel: `Studieschuld ${x.persoon || ""}: wordt niet volledig afgelost`.replace("  ", " "),
        tekst: `Bij het huidige maandbedrag blijft er na de looptijd ongeveer ${euro(sim.kwijtgescholden)} over, dat volgens de regeling wordt kwijtgescholden — extra aflossen levert dan weinig op.` });
    }
  });
  const studieTotaalMaand = studieschulden.reduce((som, x) => som + (+x.maandbedrag || 0), 0);
  const studieImpact = berekenStudieschuldHypotheekImpact(studieTotaalMaand, data.studieschuld?.bruteringsfactor || STUDIESCHULD_BRUTERINGSFACTOR_STANDAARD, berekenGemiddeldeHypotheekRente(delen));
  if (studieImpact && studieImpact.verlagingMaxHypotheek > 0) {
    punten.push({ id: "studie-hypotheek", prioriteit: "info", tab: "studieschuld",
      titel: "Studieschuld drukt op een nieuwe hypotheek",
      tekst: `Bij verhuizen of oversluiten verlaagt de studieschuld de maximale hypotheek grof geschat met ${euro(studieImpact.verlagingMaxHypotheek)}.` });
  }

  // ── Inzichten/kansen: wat de cijfers zelf al laten zien ────────────────
  delen.forEach(deel => {
    const extraBedrag = +deel.extraBedrag || 0;
    if (extraBedrag > 0) {
      const verwachtRendement = (+data.hypotheek?.verwachtRendement || 0) / 100;
      const deelRenteJaar = (+deel.rente || 0) / 100;
      const nettoAflossen = Math.round(extraBedrag * deelRenteJaar * (1 - 0.3756));
      const nettoBeleggen = Math.round(extraBedrag * verwachtRendement - extraBedrag * 0.06 * 0.36);
      punten.push({ id: `aflossen-${deel.id}`, prioriteit: "kans", tab: "hypotheek",
        titel: `Aflossen of beleggen — "${deel.naam}"`,
        tekst: `Bij het ingevulde bedrag en rendement komt ${nettoBeleggen > nettoAflossen ? "beleggen" : "aflossen"} rekenkundig als hoger netto voordeel uit (${euro(Math.max(nettoAflossen, nettoBeleggen))} tegenover ${euro(Math.min(nettoAflossen, nettoBeleggen))} per jaar) — maar aflossen is gegarandeerd, beleggen niet.` });
    }
  });

  if (winstZzp > 0) {
    const marginaleDruk = berekenMarginaleDruk(winstZzp, { voldoetUrencriterium: data.voldoetUrencriterium, isStarter: data.isStarter });
    if (marginaleDruk && marginaleDruk.percentageBehouden < 55) {
      punten.push({ id: "marginale-druk", prioriteit: "info", tab: "overzicht",
        titel: "Relatief lage marginale opbrengst van extra winst",
        tekst: `Van een volgende extra verdiende €1.000 winst houdt de zzp-partner naar schatting maar ${euro(marginaleDruk.nettoVanExtra)} netto over (${marginaleDruk.percentageBehouden}%) — door de gelijktijdige afbouw van heffingskortingen.` });
    }
  }

  const toetsingsinkomenRuw = loondienst + (berekenBelastbareWinstZzp(winstZzp, { voldoetUrencriterium: data.voldoetUrencriterium, isStarter: data.isStarter }).belastbareWinst || 0);
  if (data.kot?.aantalKinderen >= 1 && (+data.kot?.urenPerMaandKind1 > 0 || +data.kot?.urenPerMaandKind2 > 0)) {
    const zorgtoeslag = berekenZorgtoeslagPerMaand(toetsingsinkomenRuw, true);
    if (zorgtoeslag > 0) {
      punten.push({ id: "zorgtoeslag", prioriteit: "kans", tab: "kinderopvang",
        titel: "Mogelijk recht op zorgtoeslag",
        tekst: `Bij het ingevulde toetsingsinkomen is er naar schatting recht op ${euro(zorgtoeslag)} zorgtoeslag per maand.` });
    }
  }

  const volgorde = { risico: 0, kans: 1, info: 2 };
  return punten.sort((a, b) => volgorde[a.prioriteit] - volgorde[b.prioriteit]);
}

function bouwFinancieelContext(data) {
  const regels = [];
  if (+data.inkomenLoondienst > 0) regels.push(`Bruto loondienstinkomen (persoon 1): ${euro(+data.inkomenLoondienst)} per jaar`);
  if (+data.winstZzp > 0) regels.push(`ZZP-winst vóór aftrekposten (persoon 2): ${euro(+data.winstZzp)} per jaar, voldoet aan urencriterium: ${data.voldoetUrencriterium ? "ja" : "nee"}, starter: ${data.isStarter ? "ja" : "nee"}`);
  if (+data.spaargeld > 0) regels.push(`Spaargeld (samen): ${euro(+data.spaargeld)}`);
  if (+data.beleggingenPrive > 0) regels.push(`Beleggingen privé (samen): ${euro(+data.beleggingenPrive)}`);
  if (+data.beleggingenBv > 0) regels.push(`Beleggingen binnen de BV: ${euro(+data.beleggingenBv)}`);
  if (+data.schulden > 0) regels.push(`Overige schulden (niet de hypotheek): ${euro(+data.schulden)}`);
  (data.hypotheek?.delen || []).forEach(d => {
    if (+d.schuld > 0) regels.push(`Hypotheekdeel "${d.naam}": ${euro(+d.schuld)} resterende schuld, ${d.rente || "?"}% rente, type: ${d.type === "aflossingsvrij" ? "aflossingsvrij/opbouw" : "annuïtair"}${d.resterendeJaren ? `, resterende looptijd ${d.resterendeJaren} jaar` : ""}`);
  });
  (data.studieschuld?.schulden || []).forEach(x => {
    if (+x.restschuld > 0) regels.push(`Studieschuld (${x.persoon || "onbekend"}): ${euro(+x.restschuld)} restschuld, ${x.rente || "?"}% rente, ${x.maandbedrag ? `${euro(+x.maandbedrag)} per maand aan DUO` : "maandbedrag onbekend"}, ${x.resterendeJaren || "?"} jaar resterend`);
  });
  const kot = data.kot;
  if (+kot?.urenPerMaandKind1 > 0) regels.push(`Kinderopvang kind 1: ${kot.urenPerMaandKind1} uur/maand, type ${kot.typeKind1}${kot.bsoVanaf1 && +kot.bsoUren1 > 0 ? `, overstap naar BSO per ${kot.bsoVanaf1} met ${kot.bsoUren1} uur/maand` : ""}`);
  if (kot?.aantalKinderen >= 2 && +kot?.urenPerMaandKind2 > 0) regels.push(`Kinderopvang kind 2: ${kot.urenPerMaandKind2} uur/maand, type ${kot.typeKind2}${kot.bsoVanaf2 && +kot.bsoUren2 > 0 ? `, overstap naar BSO per ${kot.bsoVanaf2} met ${kot.bsoUren2} uur/maand` : ""}`);
  if (+data.bv?.verwachteWinstPerJaar > 0) regels.push(`Verwachte BV-winst per jaar: ${euro(+data.bv.verwachteWinstPerJaar)}`);
  if (+data.bv?.dividendplan > 0) regels.push(`Voorgenomen dividenduitkering: ${euro(+data.bv.dividendplan)}`);
  if (+data.hypotheek?.wozWaarde > 0) regels.push(`WOZ-waarde woning: ${euro(+data.hypotheek.wozWaarde)}`);
  const vn = data.vangnet;
  if (vn?.heeftAov != null) regels.push(`Arbeidsongeschiktheidsverzekering (AOV) voor de zzp-partner: ${vn.heeftAov ? "ja" : "nee"}`);
  if (vn?.zzpRegeltZelfPensioen != null) regels.push(`ZZP-partner regelt zelf pensioen: ${vn.zzpRegeltZelfPensioen ? `ja, inleg ${euro(+vn.pensioenEigenInlegPerJaar || 0)}/jaar` : "nee, nog niets geregeld"}`);
  if (+vn?.maandelijkseVasteLasten > 0) regels.push(`Maandelijkse vaste lasten: ${euro(+vn.maandelijkseVasteLasten)}`);
  if (vn?.heeftSamenlevingscontract != null) regels.push(`Notarieel samenlevingscontract: ${vn.heeftSamenlevingscontract ? "ja" : "nee"}`);
  if (vn?.heeftTestament != null) regels.push(`Testament: ${vn.heeftTestament ? "ja" : "nee"}`);
  if (vn?.heeftOrvGekoppeldAanHypotheek != null) regels.push(`Overlijdensrisicoverzekering gekoppeld aan de hypotheek: ${vn.heeftOrvGekoppeldAanHypotheek ? "ja" : "nee"}`);
  return regels.length > 0 ? regels.join("\n") : "Nog geen gegevens ingevuld door het gezin.";
}

function LEEG_DATA() {
  return {
    inkomenLoondienst: "", winstZzp: "", voldoetUrencriterium: true, isStarter: false,
    spaargeld: "", beleggingenPrive: "", beleggingenBv: "", schulden: "",
    hypotheek: {
      delen: [{ id: uid(), naam: "Hypotheekdeel 1", type: "annuitair", schuld: "", rente: "", resterendeJaren: "", oorspronkelijkBedrag: "" }],
      extraDeelIdx: 0, extraBedrag: "", verwachtRendement: "6", wozWaarde: "",
      aflossenModus: "een-deel", boetevrijPercentage: 20,
    },
    kot: { aantalKinderen: 1, urenPerMaandKind1: "", typeKind1: "dagopvang", bsoVanaf1: "", bsoUren1: "", urenPerMaandKind2: "", typeKind2: "dagopvang", bsoVanaf2: "", bsoUren2: "" },
    bv: { verwachteWinstPerJaar: "", dividendplan: "", compensabelVerlies: "", dividendTotaal: "", dividend2026: "", basisToetsingsinkomen: "" },
    studieschuld: { schulden: [], bruteringsfactor: String(STUDIESCHULD_BRUTERINGSFACTOR_STANDAARD) },
    vermogenVerdeling: {
      partner1: { naam: "Pepijn", spaargeld: "", beleggingen: "", schulden: "" },
      partner2: { naam: "Tessa", spaargeld: "", beleggingen: "", schulden: "" },
    },
    vangnet: {
      heeftAov: null, // null = nog niet aangegeven, true/false
      zzpRegeltZelfPensioen: null, pensioenEigenInlegPerJaar: "",
      maandelijkseVasteLasten: "",
      heeftSamenlevingscontract: null, heeftTestament: null, heeftOrvGekoppeldAanHypotheek: null,
    },
  };
}

function Veld({ label, value, onChange, type = "number", placeholder = "", suffix = "" }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={S.label}>{label}</label>
      <div style={{ position: "relative" }}>
        <input type={type} style={S.inp} value={value} placeholder={placeholder}
          onChange={e => onChange(e.target.value)} />
        {suffix && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.muted }}>{suffix}</span>}
      </div>
    </div>
  );
}

function OverzichtTab({ data, persist }) {
  const loondienst = +data.inkomenLoondienst || 0;
  const winstZzpVoorAftrek = +data.winstZzp || 0;
  const { belastbareWinst, zelfstandigenaftrek, startersaftrek, mkbVrijstelling } = berekenBelastbareWinstZzp(winstZzpVoorAftrek, { voldoetUrencriterium: data.voldoetUrencriterium, isStarter: data.isStarter });

  const { netto: nettoLoondienst, belasting: belastingLoondienst, algemeneHeffingskorting: ahkLoondienst, arbeidskorting: akLoondienst, benutbareKorting: benutbareKortingLoondienst } = berekenNettoLoondienstInkomen(loondienst);

  const { netto: nettoZzp, belasting: belastingZzp, algemeneHeffingskorting: ahkZzp, arbeidskorting: akZzp, benutbareKorting: benutbareKortingZzp, zvwBijdrage } =
    berekenNettoZzpInkomen(winstZzpVoorAftrek, { voldoetUrencriterium: data.voldoetUrencriterium, isStarter: data.isStarter });
  const marginaleDruk = winstZzpVoorAftrek > 0 ? berekenMarginaleDruk(winstZzpVoorAftrek, { voldoetUrencriterium: data.voldoetUrencriterium, isStarter: data.isStarter }) : null;

  const geschatToetsingsinkomen = loondienst + belastbareWinst; // benadering — zie disclaimer

  const spaargeld = +data.spaargeld || 0, beleggingenPrive = +data.beleggingenPrive || 0, schulden = +data.schulden || 0;
  const box3Belasting = berekenBox3Belasting({ spaargeld, beleggingen: beleggingenPrive, schulden, aantalPersonen: 2 });

  return (
    <>
      <div style={S.card}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: C.accent }}>
          👤 Jij — loondienst (box 1)
          <Uitleg>"Box 1" is het deel van de belasting over je inkomen uit werk — je salaris dus. Nederland verdeelt inkomen en vermogen over drie "boxen", elk met eigen regels. Box 1 is verreweg de bekendste: hoe meer je verdient, hoe hoger het percentage dat je over het bovenste stukje betaalt (een "schijf").</Uitleg>
        </h3>
        <Veld label="Bruto jaarinkomen" value={data.inkomenLoondienst} onChange={v => persist({ inkomenLoondienst: v })} suffix="€/jaar" />
        {loondienst > 0 && (
          <div style={{ background: C.card, borderRadius: 10, padding: 12, marginTop: 4 }}>
            <Rij label="Inkomstenbelasting box 1" waarde={euro(belastingLoondienst)} />
            <Rij label={<>Heffingskortingen<Uitleg>De "algemene heffingskorting" (iedereen) en de "arbeidskorting" (alleen voor werkenden) samen — beide worden kleiner naarmate je meer verdient. Een heffingskorting kan nooit groter zijn dan de belasting die je zelf verschuldigd bent — bij een laag inkomen wordt het recht daarom soms niet volledig benut.</Uitleg></>} waarde={`+ ${euro(benutbareKortingLoondienst)}`} groen />
            {benutbareKortingLoondienst < ahkLoondienst + akLoondienst && (
              <p style={{ fontSize: 10, color: C.muted, margin: "2px 0 0" }}>
                (Het volledige recht is {euro(ahkLoondienst + akLoondienst)}, maar bij dit inkomen is er niet genoeg belasting om dat helemaal tegen af te zetten.)
              </p>
            )}
            <Rij label="Geschat netto per jaar" waarde={euro(nettoLoondienst)} dik />
            <Rij label="Geschat netto per maand" waarde={euro(nettoLoondienst / 12)} muted />
          </div>
        )}
      </div>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: C.accent }}>👩 Je vriendin — ZZP (box 1)</h3>
        <Veld label="Winst vóór aftrekposten" value={data.winstZzp} onChange={v => persist({ winstZzp: v })} suffix="€/jaar" />
        <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
            <input type="checkbox" checked={data.voldoetUrencriterium} onChange={e => persist({ voldoetUrencriterium: e.target.checked })} />
            Voldoet aan urencriterium (1.225 uur/jaar)
            <Uitleg>Het "urencriterium" is de regel dat je minimaal 1.225 uur per jaar aan je onderneming moet besteden om recht te hebben op belastingvoordeel voor zelfstandigen (de zelfstandigenaftrek). Dat komt neer op zo'n 24 uur per week. Zonder genoeg uren vervalt dit voordeel, ook al heb je wel winst gemaakt.</Uitleg>
          </label>
        </div>
        <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
            <input type="checkbox" checked={data.isStarter} onChange={e => persist({ isStarter: e.target.checked })} />
            Starter (startersaftrek van toepassing)
            <Uitleg>Startende zelfstandigen krijgen de eerste jaren een extra belastingvoordeel bovenop de normale zelfstandigenaftrek: de startersaftrek. Dit mag je maximaal 3 keer gebruiken in de eerste 5 jaar dat je ondernemer bent.</Uitleg>
          </label>
        </div>
        {winstZzpVoorAftrek > 0 && (
          <div style={{ background: C.card, borderRadius: 10, padding: 12, marginTop: 4 }}>
            <Rij label="Zelfstandigenaftrek" waarde={`− ${euro(zelfstandigenaftrek)}`} />
            {startersaftrek > 0 && <Rij label="Startersaftrek" waarde={`− ${euro(startersaftrek)}`} />}
            <Rij label="MKB-winstvrijstelling (12,7%)" waarde={`− ${euro(mkbVrijstelling)}`} />
            <Rij label="Belastbare winst" waarde={euro(belastbareWinst)} />
            <Rij label="Inkomstenbelasting box 1" waarde={euro(belastingZzp)} />
            <Rij label="Zvw-bijdrage (zorgverzekeringswet, aparte aanslag)" waarde={`− ${euro(zvwBijdrage)}`} />
            <p style={{ fontSize: 10.5, color: C.muted, margin: "4px 0 0", lineHeight: 1.5 }}>
              💡 De zelfstandigenaftrek en MKB-winstvrijstelling zijn geen geld dat je misloopt — ze zorgen er alleen voor dat je over een kleiner deel van je winst belasting betaalt. De Zvw-bijdrage is een verplichte zorgpremie die zzp'ers zelf via een aparte aanslag betalen (werknemers hebben dit niet, dat betaalt bij hen de werkgever).
            </p>
            <Rij label={<>Heffingskortingen<Uitleg>Een heffingskorting is een korting op de belasting die je moet betalen — iedereen krijgt de "algemene heffingskorting", en iedereen die werkt (in loondienst of als zelfstandige) krijgt daarbovenop de "arbeidskorting". Beide worden kleiner naarmate je meer verdient, en kunnen bij een hoger inkomen zelfs helemaal verdwijnen. Een heffingskorting kan nooit groter zijn dan de belasting die je zelf verschuldigd bent — bij een lage winst wordt het recht daarom soms niet volledig benut.</Uitleg></>} waarde={`+ ${euro(benutbareKortingZzp)}`} groen />
            {benutbareKortingZzp < ahkZzp + akZzp && (
              <p style={{ fontSize: 10, color: C.muted, margin: "2px 0 0" }}>
                (Het volledige recht is {euro(ahkZzp + akZzp)}, maar bij deze winst is er niet genoeg belasting om dat helemaal tegen af te zetten — zonder een werkende fiscale partner die het restant kan overnemen, vervalt het teveel.)
              </p>
            )}
            <Rij label="Geschat netto per jaar" waarde={euro(nettoZzp)} dik />
            <Rij label="Geschat netto per maand" waarde={euro(nettoZzp / 12)} muted />
          </div>
        )}
        {marginaleDruk && (
          <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, margin: "10px 0 0" }}>
            💡 Van de eerstvolgende <strong>extra € 1.000</strong> winst houd je naar schatting <strong>{euro(marginaleDruk.nettoVanExtra)}</strong> netto over ({marginaleDruk.percentageBehouden}%) — door de gelijktijdige afbouw van heffingskortingen kan dit lager zijn dan je belastingschijf doet vermoeden.
          </p>
        )}
      </div>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: C.accent }}>
          🏦 Vermogen — box 3
          <Uitleg>"Box 3" is de belasting over je spaargeld en beleggingen. Opvallend: je betaalt niet over wat je er écht mee verdient, maar over een door de overheid aangenomen ("forfaitair") rendement — ook als je in werkelijkheid minder (of niets) verdiende. Pas boven een bepaald bedrag (het "heffingsvrij vermogen") betaal je hier iets over.</Uitleg>
        </h3>
        <Veld label="Spaargeld (privé, samen)" value={data.spaargeld} onChange={v => persist({ spaargeld: v })} suffix="€" />
        <Veld label="Beleggingen (privé, samen — niet via de BV)" value={data.beleggingenPrive} onChange={v => persist({ beleggingenPrive: v })} suffix="€" />
        <Veld label="Schulden (niet de eigenwoningschuld — die valt in box 1)" value={data.schulden} onChange={v => persist({ schulden: v })} suffix="€" />
        <div style={{ background: C.card, borderRadius: 10, padding: 12, marginTop: 4 }}>
          <Rij label="Heffingsvrij vermogen (2 personen)" waarde={euro(59357 * 2)} muted />
          <Rij label="Geschatte box 3-belasting per jaar" waarde={euro(box3Belasting)} dik />
        </div>
        <p style={{ fontSize: 11, color: C.muted, margin: "8px 0 0", lineHeight: 1.5 }}>
          Forfaitair: 1,28% verondersteld rendement op spaargeld, 6,00% op beleggingen, tegen 36% belasting — ongeacht je werkelijke rendement. Beleggingen binnen de BV vallen hier niet onder (die lopen via de vennootschapsbelasting, zie tabblad BV).
        </p>
      </div>

      <div style={{ ...S.card, background: C.accent, color: "#FFF" }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800 }}>👨‍👩‍👧 Gezinsbeeld</h3>
        <Rij label="Netto gezinsinkomen per maand" waarde={euro((nettoLoondienst + nettoZzp) / 12)} wit dik />
        <Rij label="Geschat toetsingsinkomen (voor toeslagen)" waarde={euro(geschatToetsingsinkomen)} wit />
        <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.75)", margin: "8px 0 0", lineHeight: 1.5 }}>
          Het toetsingsinkomen is hier een benadering (bruto loon + belastbare ZZP-winst). Het officiële verzamelinkomen houdt ook rekening met o.a. de eigenwoningregeling — voor de exacte Toeslagen-berekening gebruik je dat bedrag uit je (voorlopige) aanslag.
        </p>
      </div>

      <Disclaimer />
    </>
  );
}

function Rij({ label, waarde, dik, groen, muted, wit }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: dik ? 13.5 : 12.5, fontWeight: dik ? 800 : 500, color: wit ? "#FFF" : groen ? C.groen : muted ? C.muted : C.text }}>
      <span>{label}</span>
      <span>{waarde}</span>
    </div>
  );
}

function KinderopvangTab({ data, persist }) {
  const kot = data.kot || { aantalKinderen: 1, urenPerMaandKind1: "", typeKind1: "dagopvang", urenPerMaandKind2: "", typeKind2: "dagopvang" };
  const loondienst = +data.inkomenLoondienst || 0;
  const { belastbareWinst } = berekenBelastbareWinstZzp(+data.winstZzp || 0, { voldoetUrencriterium: data.voldoetUrencriterium, isStarter: data.isStarter });
  const toetsingsinkomen = loondienst + belastbareWinst;

  function updateKot(patch) { persist({ kot: { ...kot, ...patch } }); }

  const kind1 = berekenKinderopvangtoeslagPerKind(+kot.urenPerMaandKind1 || 0, kot.typeKind1, toetsingsinkomen, true);
  const kind2 = kot.aantalKinderen >= 2 ? berekenKinderopvangtoeslagPerKind(+kot.urenPerMaandKind2 || 0, kot.typeKind2, toetsingsinkomen, false) : null;
  const totaalToeslag = kind1.toeslagPerMaand + (kind2?.toeslagPerMaand || 0);
  const totaalKosten = kind1.kostenPerMaand + (kind2?.kostenPerMaand || 0);

  // Overstap naar BSO: per kind een datum + BSO-uren. Het overzicht per jaar
  // verschijnt zodra minstens één kind een geldige overstap heeft.
  const kindOpties = [
    { uren: kot.urenPerMaandKind1, type: kot.typeKind1, vanaf: kot.bsoVanaf1, bsoUren: kot.bsoUren1, eerste: true, actief: true },
    { uren: kot.urenPerMaandKind2, type: kot.typeKind2, vanaf: kot.bsoVanaf2, bsoUren: kot.bsoUren2, eerste: false, actief: kot.aantalKinderen >= 2 },
  ].filter(k => k.actief);
  const BSO_JAREN = [2026, 2027, 2028];
  const jaarOverzicht = BSO_JAREN.map(jaar => {
    const perKind = kindOpties.map(k => berekenKotJaar({ urenDag: k.uren, typeDag: k.type, bsoUren: k.bsoUren, bsoVanaf: k.vanaf, toetsingsinkomen, isEersteKind: k.eerste, jaar }));
    return {
      jaar,
      toeslag: perKind.reduce((som, k) => som + k.toeslag, 0),
      eigenBijdrage: perKind.reduce((som, k) => som + k.eigenBijdrage, 0),
      maandenBso: Math.max(...perKind.map(k => k.maandenBso)),
    };
  });
  const toonJaaroverzicht = kindOpties.some(k => k.type !== "bso" && k.vanaf && !isNaN(new Date(`${k.vanaf}T00:00:00`).getTime()) && +k.bsoUren > 0);

  // Dit gezin woont samen met een kind, dus geldt fiscaal gezien een
  // toeslagpartner — vandaar steeds het gezamenlijke toetsingsinkomen.
  const zorgtoeslagPerMaand = berekenZorgtoeslagPerMaand(toetsingsinkomen, true);
  const kindgebondenBudgetPerJaar = berekenKindgebondenBudgetPerJaar(kot.aantalKinderen, toetsingsinkomen, true);

  return (
    <>
      <div style={S.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.accent }}>👶 Kinderopvangtoeslag</h3>
        <p style={{ margin: "0 0 12px", fontSize: 11.5, color: C.muted }}>
          Gebaseerd op je ingevulde inkomens op het Overzicht-tabblad. Geschat toetsingsinkomen: <strong>{euro(toetsingsinkomen)}</strong>
          <Uitleg>Het "toetsingsinkomen" is jullie gezamenlijke inkomen zoals de Belastingdienst dat gebruikt om te bepalen hoeveel toeslag jullie krijgen — hoe hoger dit bedrag, hoe lager het percentage van de opvangkosten dat wordt vergoed.</Uitleg>
        </p>

        <label style={S.label}>Aantal kinderen in de opvang</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[1, 2].map(n => (
            <button key={n} onClick={() => updateKot({ aantalKinderen: n })}
              style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: `1px solid ${C.border}`, background: kot.aantalKinderen === n ? C.accent : C.card, color: kot.aantalKinderen === n ? "#FFF" : C.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {n}
            </button>
          ))}
        </div>

        <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 700 }}>Kind 1</p>
        <Veld label="Uren opvang per maand" value={kot.urenPerMaandKind1} onChange={v => updateKot({ urenPerMaandKind1: v })} suffix="uur" />
        <label style={S.label}>Type opvang</label>
        <select style={{ ...S.inp, marginBottom: 10 }} value={kot.typeKind1} onChange={e => updateKot({ typeKind1: e.target.value })}>
          <option value="dagopvang">Dagopvang (max € 11,23/u)</option>
          <option value="bso">Buitenschoolse opvang (max € 9,98/u)</option>
          <option value="gastouder">Gastouderopvang (max € 8,49/u)</option>
        </select>
        {kot.typeKind1 !== "bso" && (
          <div style={{ background: C.card, borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700 }}>🎒 Gaat naar school — overstap naar BSO?<Uitleg>Op de basisschool kan een kind vanaf de dag dat het 4 wordt starten. Daarna is er alleen nog buitenschoolse opvang (BSO) voor de uren buiten schooltijd, met een lager maximumuurtarief en meestal minder uren per maand. Vul hier de datum in vanaf wanneer de dagopvang stopt en hoeveel BSO-uren je daarna per maand verwacht (reken vakantie- en vrije-dagenopvang naar een gemiddelde per maand mee).</Uitleg></p>
            <Veld label="Overstap per (datum)" type="date" value={kot.bsoVanaf1 || ""} onChange={v => updateKot({ bsoVanaf1: v })} />
            <Veld label="BSO-uren per maand daarna" value={kot.bsoUren1 || ""} onChange={v => updateKot({ bsoUren1: v })} suffix="uur" />
            {kot.bsoVanaf1 && !(+kot.bsoUren1 > 0) && (
              <p style={{ margin: 0, fontSize: 11, color: C.oranje }}>Vul de BSO-uren in — zonder uren rekent de tool met géén opvang na de overstap.</p>
            )}
          </div>
        )}

        {kot.aantalKinderen >= 2 && (
          <>
            <p style={{ margin: "14px 0 8px", fontSize: 12.5, fontWeight: 700 }}>Kind 2 (2e kind krijgt een hoger percentage)</p>
            <Veld label="Uren opvang per maand" value={kot.urenPerMaandKind2} onChange={v => updateKot({ urenPerMaandKind2: v })} suffix="uur" />
            <label style={S.label}>Type opvang</label>
            <select style={{ ...S.inp, marginBottom: 10 }} value={kot.typeKind2} onChange={e => updateKot({ typeKind2: e.target.value })}>
              <option value="dagopvang">Dagopvang (max € 11,23/u)</option>
              <option value="bso">Buitenschoolse opvang (max € 9,98/u)</option>
              <option value="gastouder">Gastouderopvang (max € 8,49/u)</option>
            </select>
            {kot.typeKind2 !== "bso" && (
              <div style={{ background: C.card, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700 }}>🎒 Gaat naar school — overstap naar BSO?<Uitleg>Op de basisschool kan een kind vanaf de dag dat het 4 wordt starten. Daarna is er alleen nog buitenschoolse opvang (BSO) voor de uren buiten schooltijd, met een lager maximumuurtarief en meestal minder uren per maand. Vul hier de datum in vanaf wanneer de dagopvang stopt en hoeveel BSO-uren je daarna per maand verwacht (reken vakantie- en vrije-dagenopvang naar een gemiddelde per maand mee).</Uitleg></p>
                <Veld label="Overstap per (datum)" type="date" value={kot.bsoVanaf2 || ""} onChange={v => updateKot({ bsoVanaf2: v })} />
                <Veld label="BSO-uren per maand daarna" value={kot.bsoUren2 || ""} onChange={v => updateKot({ bsoUren2: v })} suffix="uur" />
                {kot.bsoVanaf2 && !(+kot.bsoUren2 > 0) && (
                  <p style={{ margin: 0, fontSize: 11, color: C.oranje }}>Vul de BSO-uren in — zonder uren rekent de tool met géén opvang na de overstap.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {totaalKosten > 0 && (
        <div style={{ ...S.card, background: C.accent, color: "#FFF" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800 }}>
            Geschatte uitkomst per maand
            <Uitleg>Het "vergoedingspercentage" is hoeveel procent van de opvangkosten de overheid terugbetaalt. Dat percentage is hoger voor een 2e (of volgend) kind dan voor het 1e — vandaar dat de percentages hieronder kunnen verschillen.</Uitleg>
          </h3>
          <Rij label="Kosten kinderopvang (tegen max. uurtarief)" waarde={euro(totaalKosten)} wit />
          <Rij label={`Vergoedingspercentage kind 1`} waarde={`${Math.round(kind1.percentage*100)}%`} wit muted />
          {kind2 && <Rij label="Vergoedingspercentage kind 2" waarde={`${Math.round(kind2.percentage*100)}%`} wit muted />}
          <Rij label="Geschatte kinderopvangtoeslag" waarde={euro(totaalToeslag)} wit dik />
          <Rij label="Geschatte eigen bijdrage" waarde={euro(totaalKosten - totaalToeslag)} wit dik />
        </div>
      )}

      {toonJaaroverzicht && (
        <div style={S.card}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.accent }}>📅 Per jaar, met de overstap naar BSO</h3>
          <p style={{ margin: "0 0 10px", fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            Dagopvang tot de overstapdatum, daarna BSO. Gerekend met de tarieven van 2026 en hetzelfde toetsingsinkomen in elk jaar — de regels voor latere jaren zijn nog niet vastgesteld.
          </p>
          {jaarOverzicht.map(j => (
            <div key={j.jaar} style={{ padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
              <Rij label={<>{j.jaar}{j.maandenBso > 0 && j.maandenBso < 12 ? ` · ${j.maandenBso} mnd BSO` : j.maandenBso >= 12 ? " · volledig BSO" : " · dagopvang"}</>} waarde={euro(j.toeslag)} dik />
              <Rij label="Toeslag per jaar · eigen bijdrage" waarde={euro(j.eigenBijdrage)} muted />
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, margin: "0 0 12px" }}>
        Deze berekening gaat uit van het maximale uurtarief van de overheid. Rekent je opvang een hoger uurtarief, dan betaal je dat verschil altijd zelf bij — ongeacht je inkomen. Het percentage tussen de bekende ijkpunten van de officiële tabel is lineair geschat; voor het exacte bedrag raadpleeg je de proefberekening op <strong>toeslagen.nl</strong>.
      </p>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: C.accent }}>
          🏥 Zorgtoeslag
          <Uitleg>Een maandelijkse bijdrage in de kosten van je zorgverzekering, afhankelijk van je (gezamenlijke) inkomen. Boven een bepaald inkomen vervalt dit recht helemaal.</Uitleg>
        </h3>
        {toetsingsinkomen > 0 ? (
          zorgtoeslagPerMaand > 0 ? (
            <Rij label="Geschatte zorgtoeslag per maand (samen)" waarde={euro(zorgtoeslagPerMaand)} dik />
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Bij dit toetsingsinkomen is er naar schatting geen recht meer op zorgtoeslag.</p>
          )
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Vul eerst jullie inkomens in op het Overzicht-tabblad.</p>
        )}
      </div>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: C.accent }}>
          👶 Kindgebonden budget
          <Uitleg>Een extra, inkomensafhankelijke bijdrage bovenop de kinderbijslag, voor ouders met kinderen tot 18 jaar. Hoe meer kinderen, hoe hoger het bedrag — en hoe lager het gezamenlijke inkomen, hoe hoger de bijdrage per kind.</Uitleg>
        </h3>
        {toetsingsinkomen > 0 ? (
          kindgebondenBudgetPerJaar > 0 ? (
            <>
              <Rij label="Geschat kindgebonden budget per jaar" waarde={euro(kindgebondenBudgetPerJaar)} />
              <Rij label="Per maand" waarde={euro(kindgebondenBudgetPerJaar / 12)} dik />
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Bij dit toetsingsinkomen is er naar schatting geen recht meer op kindgebonden budget.</p>
          )
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Vul eerst jullie inkomens in op het Overzicht-tabblad.</p>
        )}
      </div>

      <Disclaimer />
    </>
  );
}

// Simuleert een annuïteitenhypotheek jaar voor jaar, met optioneel een
// eenmalige extra aflossing aan het begin — puur rekenkundig, geen
// voorspelling. Geeft de totale betaalde rente over de resterende looptijd
// terug, zodat je het effect van wél/niet extra aflossen kunt vergelijken.
// Aflossingsvrij/opbouw-deel — geen periodieke aflossing, de schuld blijft
// de hele resterende looptijd gelijk en je betaalt alleen rente. Typisch bij
// een opbouw-/spaarhypotheek, waar apart wordt gespaard (vaak tegen hetzelfde
// rentepercentage) om de schuld aan het einde in één keer af te lossen.
function berekenRenteAflossingsvrij(schuld, renteJaar, resterendeJaren) {
  if (!schuld || schuld <= 0 || !renteJaar || !resterendeJaren) return 0;
  return Math.round(schuld * renteJaar * resterendeJaren);
}

// Maandlast van één hypotheekdeel — voor annuïtair de rente/aflossing-split
// van de eerste maand, voor aflossingsvrij alleen de (vaste) maandrente.
// ── Boetevrije ruimte bij extra aflossen (Rabobank-regels, 2026) ─────────
// Vrijwel elke hypotheekverstrekker staat toe jaarlijks een percentage van
// het OORSPRONKELIJKE leningbedrag (niet de restschuld!) boetevrij extra af
// te lossen, PER LENINGDEEL. Bij Rabobank is dat 10% met Basisvoorwaarden
// of 20% met Plusvoorwaarden. Ga je er met een deel overheen, dan kán er
// boeterente gelden — maar alleen als je huidige rente lager is dan de
// actuele marktrente voor een vergelijkbare resterende periode. Het exacte
// boetebedrag is niet door deze tool te berekenen: dat hangt af van
// Rabobank's actuele rentetabellen op het moment van aflossen.
function berekenBoetevrijeRuimte(oorspronkelijkBedrag, percentage) {
  return Math.round((+oorspronkelijkBedrag || 0) * (+percentage || 0) / 100);
}

// ── Extra aflossen op meerdere hypotheekdelen tegelijk ───────────────────
// Elk deel met een ingevuld bedrag telt mee; elk deel gebruikt daarbij wél
// zijn EIGEN rentepercentage (dat bepaalt het rekenkundige voordeel per
// deel), en het totaal wordt vergeleken met beleggen van hetzelfde
// gecombineerde bedrag.
const MAX_AFTREKTARIEF_2026 = 0.3756;
function berekenAflossenMeerdereDelen(delen, verwachtRendementPct) {
  const verwachtRendement = (+verwachtRendementPct || 0) / 100;
  const BOX3_FORFAIT = 0.06, BOX3_TARIEF = 0.36;
  const actieveDelen = (delen || []).filter(d => +d.extraBedrag > 0);
  let totaalExtraBedrag = 0, totaalNettoAflossen = 0;
  const perDeel = actieveDelen.map(d => {
    const bedrag = +d.extraBedrag || 0;
    const renteJaar = (+d.rente || 0) / 100;
    const nettoVoordeel = Math.round(bedrag * renteJaar * (1 - MAX_AFTREKTARIEF_2026));
    totaalExtraBedrag += bedrag;
    totaalNettoAflossen += nettoVoordeel;
    return { naam: d.naam, bedrag, nettoVoordeel };
  });
  const totaalNettoBeleggen = Math.round(totaalExtraBedrag * verwachtRendement - totaalExtraBedrag * BOX3_FORFAIT * BOX3_TARIEF);
  return { totaalExtraBedrag, totaalNettoAflossen, totaalNettoBeleggen, perDeel };
}

function berekenMaandlastDeel(deel) {
  const schuld = +deel.schuld || 0, renteJaar = (+deel.rente || 0) / 100, looptijd = +deel.resterendeJaren || 0;
  if (!schuld || !renteJaar) return { rente: 0, aflossing: 0, totaal: 0 };
  if (deel.type === "aflossingsvrij") {
    const renteMaand = Math.round((schuld * renteJaar / 12) * 100) / 100;
    return { rente: renteMaand, aflossing: 0, totaal: renteMaand };
  }
  if (!looptijd) return { rente: 0, aflossing: 0, totaal: 0 };
  const annuiteitJaar = schuld * renteJaar / (1 - Math.pow(1 + renteJaar, -looptijd));
  const renteJaar1 = schuld * renteJaar;
  const aflossingJaar1 = annuiteitJaar - renteJaar1;
  return {
    rente: Math.round((renteJaar1 / 12) * 100) / 100,
    aflossing: Math.round((aflossingJaar1 / 12) * 100) / 100,
    totaal: Math.round((annuiteitJaar / 12) * 100) / 100,
  };
}

function simuleerHypotheek(schuld, renteJaar, looptijdJaren, extraAflossing = 0) {
  if (!schuld || schuld <= 0 || !renteJaar || !looptijdJaren) return { totaleRente: 0, jarenTotAfbetaald: 0 };
  // De oorspronkelijke annuïteit (maandlasten) ligt vast op basis van de
  // oorspronkelijke schuld/looptijd en blijft gelijk — zo simuleer je het
  // effect van extra aflossen op HOE SNEL je klaar bent, bij gelijkblijvende
  // maandlasten (een lagere maandlast bij gelijke looptijd is de andere,
  // eveneens geldige keuze die hypotheekverstrekkers vaak bieden, maar niet
  // wat hier wordt vergeleken).
  const annuiteit = schuld * renteJaar / (1 - Math.pow(1 + renteJaar, -looptijdJaren));
  let resterend = Math.max(0, schuld - extraAflossing);
  let totaleRente = 0, jaar = 0;
  while (resterend > 1 && jaar < looptijdJaren + 50) { // ruime veiligheidsmarge tegen een oneindige lus
    const renteDitJaar = resterend * renteJaar;
    const aflossingDitJaar = Math.min(resterend, annuiteit - renteDitJaar);
    if (aflossingDitJaar <= 0) break; // zou bij een normale rente niet moeten gebeuren, maar voorkomt vastlopen
    totaleRente += renteDitJaar;
    resterend -= aflossingDitJaar;
    jaar++;
  }
  return { totaleRente: Math.round(totaleRente), jarenTotAfbetaald: jaar };
}

// Oudere, al opgeslagen data had één simpel hypotheekobject i.p.v. een array
// van delen — zet die bij het inladen om naar de nieuwe vorm, zodat niemand
// zijn eerder ingevulde cijfers kwijtraakt.
function haalHypotheekDelenOp(hypotheek) {
  if (hypotheek.delen) return hypotheek.delen;
  if (hypotheek.bedrag) {
    return [{ id: "gemigreerd", naam: "Hypotheekdeel 1", type: "annuitair", schuld: hypotheek.bedrag, rente: hypotheek.rente || "", resterendeJaren: hypotheek.resterendeJaren || "" }];
  }
  // Let op: deze functie wordt op ELKE render van HypotheekTab opnieuw
  // aangeroepen (geen memoisatie) — een willekeurige id via uid() zou dan
  // bij elke render veranderen zolang er nog niets is opgeslagen, wat een
  // instabiele React-key oplevert. Een vaste id (zelfde patroon als het
  // standaard-antwoord van de server in /api/financieel.js) voorkomt dat.
  return [{ id: "deel-1", naam: "Hypotheekdeel 1", type: "annuitair", schuld: "", rente: "", resterendeJaren: "" }];
}

function HypotheekTab({ data, persist }) {
  const h = data.hypotheek || { delen: null, extraDeelIdx: 0, extraBedrag: "", verwachtRendement: "6", wozWaarde: "", aflossenModus: "een-deel", boetevrijPercentage: 20 };
  const delen = haalHypotheekDelenOp(h);
  function updateH(patch) { persist({ hypotheek: { ...h, delen, ...patch } }); }
  function updateDeel(idx, patch) {
    updateH({ delen: delen.map((d, i) => i === idx ? { ...d, ...patch } : d) });
  }
  function voegDeelToe() {
    updateH({ delen: [...delen, { id: uid(), naam: `Hypotheekdeel ${delen.length + 1}`, type: "annuitair", schuld: "", rente: "", resterendeJaren: "" }] });
  }
  function verwijderDeel(idx) {
    const nieuweDelen = delen.filter((_, i) => i !== idx);
    updateH({ delen: nieuweDelen, extraDeelIdx: Math.min(h.extraDeelIdx || 0, Math.max(0, nieuweDelen.length - 1)) });
  }

  const totaalSchuld = delen.reduce((s, d) => s + (+d.schuld || 0), 0);
  const totaalMaandlast = delen.reduce((s, d) => s + berekenMaandlastDeel(d).totaal, 0);
  const jaarlijkseRenteAlleDelen = delen.reduce((s, d) => s + berekenMaandlastDeel(d).rente * 12, 0);

  const wozWaarde = +h.wozWaarde || 0;
  const eigenwoningforfait = berekenEigenwoningforfait(wozWaarde);
  const wetHillenAftrek = berekenWetHillenAftrek(eigenwoningforfait, jaarlijkseRenteAlleDelen);
  // Twee mogelijke uitkomsten: bij een normale hypotheek is de aftrekbare
  // rente hoger dan het forfait (netto een aftrekpost); bij een kleine of
  // afgeloste hypotheek is het forfait hoger (netto een bijtelling, deels
  // verzacht door de Wet Hillen).
  const eigenWoningSaldo = eigenwoningforfait - jaarlijkseRenteAlleDelen; // positief = bijtelling, negatief = aftrek
  const nettoEigenwoningBijtelling = eigenWoningSaldo > 0 ? Math.max(0, eigenWoningSaldo - wetHillenAftrek) : 0;
  const nettoEigenwoningAftrek = eigenWoningSaldo < 0 ? Math.abs(eigenWoningSaldo) : 0;

  const extraDeelIdx = h.extraDeelIdx || 0;
  const gekozenDeel = delen[extraDeelIdx] || delen[0];
  // Bewust per deel opgeslagen (op het deel zelf, niet op h) — anders zou
  // hetzelfde bedrag blijven staan bij het wisselen tussen delen, terwijl
  // je voor elk deel juist een ander bedrag wilt kunnen doorrekenen.
  const extraBedrag = +gekozenDeel?.extraBedrag || 0;
  const verwachtRendement = (+h.verwachtRendement || 0) / 100;
  const BOX3_FORFAIT_BELEGGEN = 0.06, BOX3_TARIEF = 0.36;

  const deelSchuld = +gekozenDeel?.schuld || 0, deelRenteJaar = (+gekozenDeel?.rente || 0) / 100, deelLooptijd = +gekozenDeel?.resterendeJaren || 0;
  const isAflossingsvrij = gekozenDeel?.type === "aflossingsvrij";

  // Bij een annuïtair deel: volledige amortisatiesimulatie (looptijd kan
  // korter uitvallen). Bij een aflossingsvrij deel: de schuld blijft gewoon
  // lager staan voor de hele resterende looptijd — geen "eerder klaar",
  // want er was nooit een aflossingsschema om te verkorten.
  const zonderExtra = isAflossingsvrij
    ? { totaleRente: berekenRenteAflossingsvrij(deelSchuld, deelRenteJaar, deelLooptijd), jarenTotAfbetaald: deelLooptijd }
    : simuleerHypotheek(deelSchuld, deelRenteJaar, deelLooptijd, 0);
  const metExtra = isAflossingsvrij
    ? { totaleRente: berekenRenteAflossingsvrij(Math.max(0, deelSchuld - extraBedrag), deelRenteJaar, deelLooptijd), jarenTotAfbetaald: deelLooptijd }
    : simuleerHypotheek(deelSchuld, deelRenteJaar, deelLooptijd, extraBedrag);
  const bruteRentebesparing = zonderExtra.totaleRente - metExtra.totaleRente;
  const nettoRentebesparingAflossen = Math.round(extraBedrag * deelRenteJaar * (1 - MAX_AFTREKTARIEF_2026)); // per jaar, op het extra afgeloste bedrag

  const nettoRendementBeleggenPerJaar = Math.round(extraBedrag * verwachtRendement - extraBedrag * BOX3_FORFAIT_BELEGGEN * BOX3_TARIEF);

  const aflossenModus = h.aflossenModus || "een-deel";
  const alleDelenResultaat = berekenAflossenMeerdereDelen(delen, h.verwachtRendement);
  const boetevrijPercentage = h.boetevrijPercentage || 20;

  return (
    <>
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.accent }}>
            🏠 Hypotheekdelen
            <Uitleg>Veel hypotheken bestaan uit meerdere "delen" met elk een eigen rente en aflossingsvorm — bijvoorbeeld een deel waarop je maandelijks aflost, en een deel waarbij je alleen rente betaalt en apart spaart om het in één keer af te lossen. Check je hypotheek-app: staan er meerdere leningnummers/delen onder "Hypotheek"? Vul ze dan hier allebei in voor een kloppend totaalbeeld.</Uitleg>
          </h3>
          {delen.length > 1 && <span style={{ fontSize: 11, color: C.muted }}>{delen.length} delen</span>}
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 11.5, color: C.muted }}>
          Heb je, zoals vaak, meerdere leningdelen met een eigen rente en rentevaste periode (bijvoorbeeld een annuïteitendeel plus een aflossingsvrij/opbouwdeel)? Voeg ze hier los toe — dat geeft een veel preciezer beeld dan alles op één hoop vegen.
        </p>

        {delen.map((deel, idx) => {
          const maandlast = berekenMaandlastDeel(deel);
          return (
            <div key={deel.id} style={{ background: C.card, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <input value={deel.naam} onChange={e => updateDeel(idx, { naam: e.target.value })}
                  style={{ background: "none", border: "none", fontSize: 13, fontWeight: 800, color: C.text, padding: 0, flex: 1 }} />
                {delen.length > 1 && (
                  <button onClick={() => verwijderDeel(idx)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13 }}>✕</button>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <button onClick={() => updateDeel(idx, { type: "annuitair" })}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${C.border}`, background: deel.type !== "aflossingsvrij" ? C.accent : C.surf, color: deel.type !== "aflossingsvrij" ? "#FFF" : C.text, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                  Annuïtair
                </button>
                <button onClick={() => updateDeel(idx, { type: "aflossingsvrij" })}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${C.border}`, background: deel.type === "aflossingsvrij" ? C.accent : C.surf, color: deel.type === "aflossingsvrij" ? "#FFF" : C.text, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                  Aflossingsvrij / opbouw
                </button>
              </div>
              <p style={{ fontSize: 10.5, color: C.muted, margin: "0 0 10px", lineHeight: 1.5 }}>
                {deel.type === "aflossingsvrij"
                  ? "Bij dit type betaal je elke maand alleen rente — de schuld zelf wordt niet lager. Vaak hoort hier een aparte spaarrekening bij die apart groeit, om de lening aan het einde in één keer af te lossen."
                  : "Bij dit type betaal je elke maand rente én een stukje aflossing — de schuld wordt dus geleidelijk kleiner, en je maandlast blijft (bij een vaste rente) gelijk."}
              </p>
              <Veld label={<>Oorspronkelijk geleend bedrag (optioneel)<Uitleg>Bepaalt hoeveel je per jaar boetevrij extra mag aflossen — dat percentage geldt bij vrijwel elke hypotheekverstrekker over het bedrag dat je bij het AFSLUITEN van dit leningdeel hebt geleend, niet over de huidige restschuld. Staat in je hypotheekofferte of -akte.</Uitleg></>} value={deel.oorspronkelijkBedrag || ""} onChange={v => updateDeel(idx, { oorspronkelijkBedrag: v })} suffix="€" />
              <Veld label="Resterende schuld" value={deel.schuld} onChange={v => updateDeel(idx, { schuld: v })} suffix="€" />
              <Veld label="Rentepercentage" value={deel.rente} onChange={v => updateDeel(idx, { rente: v })} suffix="% per jaar" />
              <Veld label={<>Resterende looptijd<Uitleg>Dit is het aantal jaren tot de hypotheek VOLLEDIG is afbetaald — niet hetzelfde als "rente staat vast tot [datum]"! Die rentevaste periode is vaak maar een deel van de totale looptijd: na afloop loopt de hypotheek gewoon door, alleen tegen een nieuw (dan nog onbekend) rentepercentage. Vul je hier per ongeluk de rentevaste periode in terwijl de werkelijke looptijd langer is, dan berekent de tool een veel te hoge maandlast. Check bij twijfel de oorspronkelijke hypotheekofferte of je bank-app op "totale looptijd" of "einddatum lening" — niet op "rente vast tot".</Uitleg></>} value={deel.resterendeJaren} onChange={v => updateDeel(idx, { resterendeJaren: v })} suffix="jaar" />
              {deel.type === "aflossingsvrij" && (
                <Veld label="Gekoppeld opgebouwd spaarbedrag (optioneel, puur informatief)" value={deel.gekoppeldSpaargeld || ""} onChange={v => updateDeel(idx, { gekoppeldSpaargeld: v })} suffix="€" />
              )}
              {maandlast.totaal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: C.muted, marginTop: 6, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                  <span>Maandlast: <strong style={{ color: C.text }}>{euro2(maandlast.totaal)}</strong></span>
                  {deel.type !== "aflossingsvrij" && <span>waarvan aflossing: {euro2(maandlast.aflossing)}</span>}
                </div>
              )}
            </div>
          );
        })}
        <button onClick={voegDeelToe} style={{ width: "100%", background: "none", border: `1px dashed ${C.border}`, borderRadius: 10, padding: "9px 0", fontSize: 12.5, fontWeight: 700, color: C.accent, cursor: "pointer" }}>
          + Nog een hypotheekdeel toevoegen
        </button>

        {totaalSchuld > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
            <Rij label="Totale resterende schuld (bruto, vóór verrekening gekoppeld spaargeld)" waarde={euro(totaalSchuld)} dik />
          </div>
        )}
        {totaalMaandlast > 0 && <Rij label="Totale maandlast (alle delen samen)" waarde={euro2(totaalMaandlast)} dik />}
      </div>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.accent }}>
          🏡 Eigenwoningforfait
          <Uitleg>Als huiseigenaar-bewoner telt een klein percentage van de WOZ-waarde van je huis juist weer mee als inkomen (het "eigenwoningforfait") — als tegenhanger van de hypotheekrenteaftrek. Dit geldt voor IEDERE huiseigenaar, ook met een (bijna) afgeloste hypotheek. Dit wordt vaak vergeten, waardoor het voordeel van hypotheekrenteaftrek in de praktijk kleiner is dan je zou denken.</Uitleg>
        </h3>
        <Veld label="WOZ-waarde van de woning" value={h.wozWaarde} onChange={v => updateH({ wozWaarde: v })} suffix="€" />
        {wozWaarde > 0 && (
          <div style={{ background: C.card, borderRadius: 10, padding: 12, marginTop: 4 }}>
            <Rij label="Eigenwoningforfait (0,35% van de WOZ-waarde)" waarde={euro(eigenwoningforfait)} />
            <Rij label="Jaarlijkse hypotheekrente (alle delen samen)" waarde={euro(jaarlijkseRenteAlleDelen)} />
            {nettoEigenwoningAftrek > 0 && (
              <Rij label="Per saldo: netto aftrekpost op je inkomen" waarde={`− ${euro(nettoEigenwoningAftrek)}`} dik />
            )}
            {nettoEigenwoningBijtelling > 0 && (
              <>
                <Rij label={<>Wet Hillen-compensatie (71,9%)<Uitleg>Heb je weinig of geen hypotheekrente meer (bijvoorbeeld door veel aflossen), dan is het eigenwoningforfait hoger dan je renteaftrek — je zou dus per saldo meer belasting betalen. De Wet Hillen compenseert dat verschil gedeeltelijk, maar dat percentage daalt elk jaar (2026: 71,9%, richting 0% in 2041).</Uitleg></>} waarde={`+ ${euro(wetHillenAftrek)}`} />
                <Rij label="Per saldo: netto bijtelling op je inkomen" waarde={`+ ${euro(nettoEigenwoningBijtelling)}`} dik />
              </>
            )}
          </div>
        )}
      </div>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.accent }}>🤔 Aflossen of beleggen?</h3>
        <p style={{ margin: "0 0 12px", fontSize: 11.5, color: C.muted }}>Elk deel heeft zijn eigen rente, dus dat bepaalt het rekenkundige voordeel.</p>

        {delen.length > 1 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button onClick={() => updateH({ aflossenModus: "een-deel" })}
              style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: `1px solid ${C.border}`, background: aflossenModus === "een-deel" ? C.accent : C.card, color: aflossenModus === "een-deel" ? "#FFF" : C.text, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Eén deel</button>
            <button onClick={() => updateH({ aflossenModus: "alle-delen" })}
              style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: `1px solid ${C.border}`, background: aflossenModus === "alle-delen" ? C.accent : C.card, color: aflossenModus === "alle-delen" ? "#FFF" : C.text, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Alle delen</button>
          </div>
        )}

        {aflossenModus === "een-deel" && (
          <>
            {delen.length > 1 && (
              <>
                <label style={S.label}>Welk hypotheekdeel?</label>
                <select style={{ ...S.inp, marginBottom: 10 }} value={extraDeelIdx} onChange={e => updateH({ extraDeelIdx: +e.target.value })}>
                  {delen.map((d, idx) => <option key={d.id} value={idx}>{d.naam} ({d.rente || "?"}%)</option>)}
                </select>
              </>
            )}
            <Veld label="Beschikbaar bedrag" value={gekozenDeel?.extraBedrag || ""} onChange={v => updateDeel(extraDeelIdx, { extraBedrag: v })} suffix="€" />
            <Veld label="Verwacht bruto beleggingsrendement (jouw eigen inschatting)" value={h.verwachtRendement} onChange={v => updateH({ verwachtRendement: v })} suffix="% per jaar" />

            {deelSchuld > 0 && deelRenteJaar > 0 && deelLooptijd > 0 && extraBedrag > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                <div style={{ background: C.card, borderRadius: 12, padding: 14 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800 }}>📉 Scenario: extra aflossen op "{gekozenDeel.naam}"</p>
                  <Rij label="Bruto rentebesparing (resterende looptijd)" waarde={euro(bruteRentebesparing)} />
                  <Rij label={<>Netto voordeel per jaar<Uitleg>Hypotheekrente mag je aftrekken van je belastbaar inkomen (de "hypotheekrenteaftrek"), waardoor je minder belasting betaalt. Los je extra af, dan betaal je minder rente — maar je loopt ook een stukje van dat belastingvoordeel mis. Het "netto voordeel" hier is wat er na dat effect overblijft.</Uitleg></>} waarde={euro(nettoRentebesparingAflossen)} dik />
                  {!isAflossingsvrij && <Rij label="Hypotheek eerder afgelost na" waarde={`${zonderExtra.jarenTotAfbetaald - metExtra.jarenTotAfbetaald} jaar`} muted />}
                  {isAflossingsvrij && <Rij label="Let op" waarde="aflossingsvrij — geen aflosschema, dus geen 'eerder klaar'" muted />}
                  <p style={{ fontSize: 10.5, color: C.muted, margin: "6px 0 0" }}>Gegarandeerd rendement — geen risico, geen verrassingen.</p>
                </div>
                <div style={{ background: C.card, borderRadius: 12, padding: 14 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800 }}>📈 Scenario: beleggen</p>
                  <Rij label="Bruto verwacht rendement per jaar" waarde={euro(extraBedrag * verwachtRendement)} />
                  <Rij label={<>Geschatte box 3-belasting per jaar<Uitleg>Ook als je werkelijke rendement dit jaar lager uitvalt (of zelfs negatief is), rekent de Belastingdienst toch met een vast, aangenomen ("forfaitair") rendement voor beleggingen. Deze belasting betaal je dus hoe dan ook, los van wat je écht verdient.</Uitleg></>} waarde={`− ${euro(extraBedrag * BOX3_FORFAIT_BELEGGEN * BOX3_TARIEF)}`} />
                  <Rij label="Netto verwacht voordeel per jaar" waarde={euro(nettoRendementBeleggenPerJaar)} dik />
                  <p style={{ fontSize: 10.5, color: C.rood, margin: "6px 0 0" }}>⚠️ Onzeker — een werkelijk rendement van 0% of negatief is net zo goed mogelijk als het ingevulde percentage. Box 3-belasting betaal je over het forfait, ook als je werkelijke rendement lager uitvalt.</p>
                </div>
                <div style={{ background: nettoRendementBeleggenPerJaar > nettoRentebesparingAflossen ? "#EAF3EE" : "#FBF0E4", border: `1px solid ${nettoRendementBeleggenPerJaar > nettoRentebesparingAflossen ? C.groen : C.oranje}44`, borderRadius: 12, padding: 14 }}>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
                    Bij dít ingevulde verwachte rendement komt <strong>{nettoRendementBeleggenPerJaar > nettoRentebesparingAflossen ? "beleggen" : "aflossen"}</strong> rekenkundig als hoger netto voordeel uit — maar aflossen is <em>gegarandeerd</em>, beleggen niet. Dat is een afweging van risico versus verwacht rendement, geen rekensom met één juist antwoord.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {aflossenModus === "alle-delen" && (
          <>
            <p style={{ margin: "0 0 10px", fontSize: 11.5, color: C.muted }}>Vul per deel in hoeveel je daarop extra zou aflossen — elk deel telt mee tegen zijn eigen rente.</p>
            {delen.map((deel, idx) => (
              <Veld key={deel.id} label={`Beschikbaar bedrag — "${deel.naam}" (${deel.rente || "?"}%)`} value={deel.extraBedrag || ""} onChange={v => updateDeel(idx, { extraBedrag: v })} suffix="€" />
            ))}
            <Veld label="Verwacht bruto beleggingsrendement (jouw eigen inschatting)" value={h.verwachtRendement} onChange={v => updateH({ verwachtRendement: v })} suffix="% per jaar" />

            {alleDelenResultaat.totaalExtraBedrag > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                <div style={{ background: C.card, borderRadius: 12, padding: 14 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800 }}>📉 Scenario: beide/alle delen extra aflossen</p>
                  {alleDelenResultaat.perDeel.map(d => (
                    <Rij key={d.naam} label={`Netto voordeel per jaar — "${d.naam}"`} waarde={euro(d.nettoVoordeel)} />
                  ))}
                  <Rij label="Totaal netto voordeel per jaar" waarde={euro(alleDelenResultaat.totaalNettoAflossen)} dik />
                  <p style={{ fontSize: 10.5, color: C.muted, margin: "6px 0 0" }}>Gegarandeerd rendement — geen risico, geen verrassingen.</p>
                </div>
                <div style={{ background: C.card, borderRadius: 12, padding: 14 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800 }}>📈 Scenario: hetzelfde totaalbedrag beleggen</p>
                  <Rij label="Gecombineerd bedrag" waarde={euro(alleDelenResultaat.totaalExtraBedrag)} />
                  <Rij label="Netto verwacht voordeel per jaar" waarde={euro(alleDelenResultaat.totaalNettoBeleggen)} dik />
                  <p style={{ fontSize: 10.5, color: C.rood, margin: "6px 0 0" }}>⚠️ Onzeker — een werkelijk rendement van 0% of negatief is net zo goed mogelijk als het ingevulde percentage.</p>
                </div>
                <div style={{ background: alleDelenResultaat.totaalNettoBeleggen > alleDelenResultaat.totaalNettoAflossen ? "#EAF3EE" : "#FBF0E4", border: `1px solid ${alleDelenResultaat.totaalNettoBeleggen > alleDelenResultaat.totaalNettoAflossen ? C.groen : C.oranje}44`, borderRadius: 12, padding: 14 }}>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
                    Bij dít ingevulde verwachte rendement komt <strong>{alleDelenResultaat.totaalNettoBeleggen > alleDelenResultaat.totaalNettoAflossen ? "beleggen" : "aflossen van beide/alle delen"}</strong> rekenkundig als hoger netto voordeel uit. Heb je niet genoeg voor alle delen tegelijk? Dan levert extra aflossen op het deel met de hoogste rente per euro het meeste op.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Boetevrije ruimte — relevant ongeacht de gekozen modus hierboven */}
        {delen.some(d => +d.oorspronkelijkBedrag > 0) && (
          <div style={{ background: "#FBF0E4", border: `1px solid ${C.oranje}33`, borderRadius: 12, padding: 14, marginTop: 14 }}>
            <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 800 }}>
              💶 Boetevrije ruimte bij Rabobank
              <Uitleg>Vrijwel elke hypotheekverstrekker staat toe jaarlijks een percentage van het OORSPRONKELIJKE leningbedrag (niet de restschuld) boetevrij extra af te lossen, per leningdeel. Ga je daar met een deel overheen, dan kán Rabobank boeterente rekenen — maar alleen als je huidige rente lager is dan de actuele marktrente voor een vergelijkbare resterende periode. Is de marktrente nu hoger dan jouw rente? Dan is extra aflossen vaak alsnog volledig boetevrij, ook boven dit percentage.</Uitleg>
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button onClick={() => updateH({ boetevrijPercentage: 10 })}
                style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${C.border}`, background: boetevrijPercentage === 10 ? C.accent : C.surf, color: boetevrijPercentage === 10 ? "#FFF" : C.text, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>Basisvoorwaarden (10%)</button>
              <button onClick={() => updateH({ boetevrijPercentage: 20 })}
                style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${C.border}`, background: boetevrijPercentage === 20 ? C.accent : C.surf, color: boetevrijPercentage === 20 ? "#FFF" : C.text, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>Plusvoorwaarden (20%)</button>
            </div>
            {delen.filter(d => +d.oorspronkelijkBedrag > 0).map(deel => {
              const ruimte = berekenBoetevrijeRuimte(deel.oorspronkelijkBedrag, boetevrijPercentage);
              const ingevuld = +deel.extraBedrag || 0;
              const overschreden = ingevuld > ruimte;
              return (
                <div key={deel.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                  <Rij label={`Boetevrije ruimte dit jaar — "${deel.naam}"`} waarde={euro(ruimte)} />
                  {ingevuld > 0 && (
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: overschreden ? C.rood : C.groen }}>
                      {overschreden
                        ? `⚠️ Het ingevulde bedrag (${euro(ingevuld)}) gaat hier met ${euro(ingevuld - ruimte)} overheen — mogelijk boeterente, check dit vooraf bij Rabobank.`
                        : `✅ Het ingevulde bedrag (${euro(ingevuld)}) blijft binnen de boetevrije ruimte.`}
                    </p>
                  )}
                </div>
              );
            })}
            <p style={{ fontSize: 10.5, color: C.muted, margin: "4px 0 0" }}>
              Het exacte boetebedrag kan deze tool niet berekenen — dat hangt af van Rabobank's actuele rentetabellen op het moment van aflossen. Check dit vooraf via de Rabo-app of met een adviseur.
            </p>
          </div>
        )}
      </div>
      <Disclaimer />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// STUDIESCHULD (DUO) — restschuld, rente, aflossing en wat het betekent voor
// de hypotheek. De rente is NIET aftrekbaar (anders dan hypotheekrente).
// ══════════════════════════════════════════════════════════════════════════
// DUO-rente 2026 (persbericht "rentepercentages studiefinanciering voor
// 2026"): 2,33% voor de 35-jaarsregeling (leenstelsel), 2,29% voor de
// 15-jaarsregeling (o.a. pre-2015). Voor oud-studenten staat de rente 5 jaar
// vast vanaf het begin van hun periode — het eigen percentage staat in Mijn DUO.
const STUDIESCHULD_RENTE_2026 = { "35": 2.33, "15": 2.29 };
const STUDIESCHULD_LOOPTIJD_JAREN = { "35": 35, "15": 15 };
// Bruteringsfactor waarmee hypotheekverstrekkers de maandlast aan DUO
// optellen bij de leenlasten; hangt af van de hypotheekrente (hypotheker.nl,
// 2026: ≤2% → 1,05 · 4,001–4,5% → 1,25 · 5,001–5,5% → 1,30 · ≥6% → 1,40).
const STUDIESCHULD_BRUTERINGSFACTOR_STANDAARD = 1.25;

function berekenStudieschuldRentePerJaar(restschuld, rentePct) {
  const schuld = +restschuld || 0, rente = +rentePct || 0;
  if (schuld <= 0 || rente <= 0) return 0;
  return Math.round(schuld * rente / 100);
}

// Maand-voor-maand simulatie: rente erbij, vaste betaling eraf. Na de
// resterende looptijd wordt een eventuele restschuld kwijtgescholden (zo is
// de regeling opgezet) — dat telt hier dus NIET als betaald.
function simuleerStudieschuld(restschuld, rentePct, maandbedrag, resterendeJaren, extraEenmalig = 0) {
  const startSchuld = Math.max(0, (+restschuld || 0) - (+extraEenmalig || 0));
  if (startSchuld <= 0) return { kanBerekenen: true, maanden: 0, jaren: 0, totaleRente: 0, totaalBetaald: 0, kwijtgescholden: 0, wordtAfgelost: true };
  const bedrag = +maandbedrag || 0;
  const maxMaanden = Math.round((+resterendeJaren || 0) * 12);
  if (bedrag <= 0 || maxMaanden <= 0) return { kanBerekenen: false };
  const r = (+rentePct || 0) / 100 / 12;
  let saldo = startSchuld, totaleRente = 0, totaalBetaald = 0, maanden = 0;
  while (saldo > 0.005 && maanden < maxMaanden) {
    const rente = saldo * r;
    totaleRente += rente;
    const betaling = Math.min(saldo + rente, bedrag);
    saldo = saldo + rente - betaling;
    totaalBetaald += betaling;
    maanden++;
  }
  const kwijtgescholden = saldo > 0.5 ? Math.round(saldo) : 0;
  return {
    kanBerekenen: true, maanden, jaren: Math.round(maanden / 12 * 10) / 10,
    totaleRente: Math.round(totaleRente), totaalBetaald: Math.round(totaalBetaald),
    kwijtgescholden, wordtAfgelost: kwijtgescholden === 0,
  };
}

// Wat levert een eenmalige extra aflossing écht op? Vergelijkt wat je in
// TOTAAL kwijt bent (incl. de extra aflossing zelf). Wordt een deel van de
// schuld toch kwijtgescholden, dan kan extra aflossen netto méér kosten dan
// opleveren — dat zie je hier terug als negatieve besparing.
function berekenExtraAflossenEffect(schuld) {
  const extra = +schuld?.extraBedrag || 0;
  if (!(extra > 0)) return null;
  const zonder = simuleerStudieschuld(schuld.restschuld, schuld.rente, schuld.maandbedrag, schuld.resterendeJaren);
  if (!zonder.kanBerekenen) return null;
  const met = simuleerStudieschuld(schuld.restschuld, schuld.rente, schuld.maandbedrag, schuld.resterendeJaren, extra);
  const werkelijkExtra = Math.min(extra, +schuld.restschuld || 0);
  return {
    besparing: zonder.totaalBetaald - (met.totaalBetaald + werkelijkExtra),
    maandenKorter: zonder.maanden - met.maanden,
    kwijtgescholdenZonder: zonder.kwijtgescholden, kwijtgescholdenMet: met.kwijtgescholden,
  };
}

function berekenGemiddeldeHypotheekRente(delen) {
  const relevant = (delen || []).filter(d => +d.schuld > 0 && +d.rente > 0);
  const totaal = relevant.reduce((som, d) => som + (+d.schuld), 0);
  if (totaal <= 0) return 0;
  return Math.round(relevant.reduce((som, d) => som + (+d.schuld) * (+d.rente), 0) / totaal * 100) / 100;
}

// Grove inschatting: de gebruteerde maandlast aan DUO verlaagt de maximale
// hypotheek met de contante waarde van die maandlast over 30 jaar bij de
// hypotheekrente. Een echte aanvraag rekent met de leennormen van de
// verstrekker — dit is alleen om de ORDE VAN GROOTTE te laten zien.
function berekenStudieschuldHypotheekImpact(totaalMaandbedrag, bruteringsfactor, hypotheekRentePct, looptijdJaren = 30) {
  const maand = +totaalMaandbedrag || 0;
  const factor = +bruteringsfactor || 0;
  if (maand <= 0 || factor <= 0) return null;
  const gebruteerd = maand * factor;
  const r = (+hypotheekRentePct || 0) / 100 / 12;
  const n = looptijdJaren * 12;
  const contanteWaardeFactor = r > 0 ? (1 - Math.pow(1 + r, -n)) / r : n;
  return { gebruteerdeMaandlast: Math.round(gebruteerd), verlagingMaxHypotheek: Math.round(gebruteerd * contanteWaardeFactor) };
}

// Welke schuld kost het meest, netto? Studieschuldrente is niet aftrekbaar;
// hypotheekrente wel (geschat tegen het hoogste aftrektarief, zoals elders
// in deze tool). Puur een vergelijking van rentepercentages — boeterente,
// rentevaste periodes en de soepele voorwaarden van DUO (draagkracht,
// kwijtschelding) zitten er niet in.
function bepaalAflosvolgorde(studieschulden, hypotheekDelen) {
  const lijst = [];
  (studieschulden || []).filter(x => +x.restschuld > 0 && +x.rente > 0).forEach(x =>
    lijst.push({ naam: x.naam || "Studieschuld", soort: "studieschuld", nettoRente: Math.round(+x.rente * 100) / 100 }));
  (hypotheekDelen || []).filter(d => +d.schuld > 0 && +d.rente > 0).forEach(d =>
    lijst.push({ naam: d.naam || "Hypotheekdeel", soort: "hypotheek", nettoRente: Math.round(+d.rente * (1 - MAX_AFTREKTARIEF_2026) * 100) / 100 }));
  return lijst.sort((a, b) => b.nettoRente - a.nettoRente);
}

function nieuweStudieschuld(persoon) {
  return { id: uid(), persoon, regeling: "35", restschuld: "", rente: String(STUDIESCHULD_RENTE_2026["35"]), maandbedrag: "", resterendeJaren: "35", extraBedrag: "" };
}

function StudieschuldTab({ data, persist }) {
  const studie = data.studieschuld || { schulden: [], bruteringsfactor: String(STUDIESCHULD_BRUTERINGSFACTOR_STANDAARD) };
  const schulden = studie.schulden || [];
  const delen = data.hypotheek?.delen || [];
  const naam1 = data.vermogenVerdeling?.partner1?.naam || "Pepijn";
  const naam2 = data.vermogenVerdeling?.partner2?.naam || "Tessa";

  function opslaan(lijst) { persist({ studieschuld: { ...studie, schulden: lijst } }); }
  function updateSchuld(id, patch) { opslaan(schulden.map(x => x.id === id ? { ...x, ...patch } : x)); }
  function verwijder(id) {
    if (!window.confirm("Deze studieschuld verwijderen?")) return;
    opslaan(schulden.filter(x => x.id !== id));
  }

  const actief = schulden.filter(x => +x.restschuld > 0);
  const totaalSchuld = actief.reduce((som, x) => som + (+x.restschuld), 0);
  const totaalMaand = actief.reduce((som, x) => som + (+x.maandbedrag || 0), 0);
  const totaalRente = actief.reduce((som, x) => som + berekenStudieschuldRentePerJaar(x.restschuld, x.rente), 0);
  const gemHypRente = berekenGemiddeldeHypotheekRente(delen);
  const impact = berekenStudieschuldHypotheekImpact(totaalMaand, studie.bruteringsfactor || STUDIESCHULD_BRUTERINGSFACTOR_STANDAARD, gemHypRente);
  const volgorde = bepaalAflosvolgorde(schulden, delen);

  return (
    <>
      <div style={S.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.accent }}>🎓 Studieschuld (DUO)</h3>
        <p style={{ margin: 0, fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>
          Vul per persoon in wat er nog openstaat — je vindt de bedragen en je rente in Mijn DUO. De rente op een studieschuld is niet aftrekbaar van de belasting (anders dan hypotheekrente).
        </p>
      </div>

      {actief.length > 0 && (
        <div style={{ ...S.card, background: C.accent, color: "#FFF" }}>
          <Rij label="Totale restschuld" waarde={euro(totaalSchuld)} dik wit />
          <Rij label="Rente per jaar (bij benadering)" waarde={euro(totaalRente)} wit />
          {totaalMaand > 0 && <Rij label="Aflossing aan DUO per maand" waarde={euro(totaalMaand)} wit />}
        </div>
      )}

      {schulden.map(x => {
        const sim = simuleerStudieschuld(x.restschuld, x.rente, x.maandbedrag, x.resterendeJaren);
        const effect = berekenExtraAflossenEffect(x);
        const rentePerJaar = berekenStudieschuldRentePerJaar(x.restschuld, x.rente);
        return (
          <div key={x.id} style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[naam1, naam2].map(n => (
                  <button key={n} onClick={() => updateSchuld(x.id, { persoon: n })}
                    style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: x.persoon === n ? C.accent : C.card, color: x.persoon === n ? "#FFF" : C.text, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {n}
                  </button>
                ))}
              </div>
              <button onClick={() => verwijder(x.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.rood, fontSize: 12, fontWeight: 700 }}>Verwijder</button>
            </div>

            <label style={S.label}>Regeling<Uitleg>De meeste studenten sinds 2015 (leenstelsel) hebben 35 jaar om terug te betalen. Wie voor 2015 begon heeft meestal 15 jaar. Welke bij jou hoort staat in Mijn DUO. Wat er na afloop nog openstaat, wordt volgens de regeling kwijtgescholden.</Uitleg></label>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {[["35", "35 jaar (leenstelsel)"], ["15", "15 jaar (o.a. pre-2015)"]].map(([waarde, label]) => (
                <button key={waarde} onClick={() => updateSchuld(x.id, { regeling: waarde, resterendeJaren: String(STUDIESCHULD_LOOPTIJD_JAREN[waarde]), rente: String(STUDIESCHULD_RENTE_2026[waarde]) })}
                  style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: `1px solid ${C.border}`, background: x.regeling === waarde ? C.accent : C.card, color: x.regeling === waarde ? "#FFF" : C.text, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><Veld label="Restschuld" value={x.restschuld} onChange={v => updateSchuld(x.id, { restschuld: v })} suffix="€" /></div>
              <div style={{ flex: 1 }}><Veld label={<>Rente<Uitleg>Het DUO-tarief voor 2026 is {STUDIESCHULD_RENTE_2026["35"]}% (35-jaarsregeling) of {STUDIESCHULD_RENTE_2026["15"]}% (15-jaarsregeling). Voor wie al terugbetaalt staat de rente 5 jaar vast, dus jouw eigen percentage kan hiervan afwijken — controleer het in Mijn DUO en pas het hier aan.</Uitleg></>} value={x.rente} onChange={v => updateSchuld(x.id, { rente: v })} suffix="%" /></div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><Veld label="Aflossing per maand" value={x.maandbedrag} onChange={v => updateSchuld(x.id, { maandbedrag: v })} suffix="€" /></div>
              <div style={{ flex: 1 }}><Veld label="Resterende looptijd" value={x.resterendeJaren} onChange={v => updateSchuld(x.id, { resterendeJaren: v })} suffix="jaar" /></div>
            </div>

            {+x.restschuld > 0 && (
              <div style={{ background: C.card, borderRadius: 10, padding: 12 }}>
                <Rij label="Rente per jaar" waarde={euro(rentePerJaar)} />
                {sim.kanBerekenen ? (
                  <>
                    <Rij label="Afgelost over" waarde={sim.wordtAfgelost ? `${sim.jaren} jaar` : `niet binnen ${x.resterendeJaren} jaar`} />
                    <Rij label="Totale rente die je nog betaalt" waarde={euro(sim.totaleRente)} />
                    {!sim.wordtAfgelost && (
                      <p style={{ margin: "6px 0 0", fontSize: 11.5, lineHeight: 1.5, color: C.oranje }}>
                        Bij dit maandbedrag blijft na {x.resterendeJaren} jaar nog {euro(sim.kwijtgescholden)} over, dat volgens de regeling wordt kwijtgescholden. Extra aflossen levert dan minder op dan je zou denken.
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ margin: "4px 0 0", fontSize: 11.5, color: C.muted }}>Vul het maandbedrag en de resterende looptijd in om te zien wanneer de schuld is afgelost.</p>
                )}
              </div>
            )}

            {+x.restschuld > 0 && sim.kanBerekenen && (
              <div style={{ marginTop: 10 }}>
                <Veld label="Wat als je eenmalig extra aflost? (optioneel)" value={x.extraBedrag} onChange={v => updateSchuld(x.id, { extraBedrag: v })} suffix="€" />
                {effect && (
                  <div style={{ background: C.card, borderRadius: 10, padding: 12 }}>
                    <Rij label="Netto effect over de hele looptijd" waarde={effect.besparing >= 0 ? `+ ${euro(effect.besparing)}` : `− ${euro(-effect.besparing)}`} dik groen={effect.besparing > 0} />
                    {effect.maandenKorter > 0 && <Rij label="Eerder klaar met" waarde={`${effect.maandenKorter} maanden`} />}
                    <p style={{ margin: "6px 0 0", fontSize: 10.5, color: C.muted, lineHeight: 1.5 }}>
                      {effect.besparing < 0
                        ? "Negatief: je betaalt in totaal méér dan je bespaart, omdat een deel van de schuld anders toch zou worden kwijtgescholden."
                        : "Gerekend inclusief de extra aflossing zelf. Aflossen levert een gegarandeerd rendement op ter hoogte van de rente, belastingvrij maar ook zonder aftrek."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button onClick={() => persist({ studieschuld: { ...studie, schulden: [...schulden, nieuweStudieschuld(schulden.length % 2 === 0 ? naam1 : naam2)] } })}
        style={{ width: "100%", background: C.card, border: `1px dashed ${C.accentLicht}`, borderRadius: 12, padding: "13px 0", fontWeight: 700, fontSize: 13, color: C.accent, cursor: "pointer", marginBottom: 12 }}>
        + Studieschuld toevoegen
      </button>

      {impact && (
        <div style={S.card}>
          <h3 style={{ margin: "0 0 4px", fontSize: 13.5, fontWeight: 800, color: C.accent }}>🏠 Effect op een (nieuwe) hypotheek</h3>
          <p style={{ margin: "0 0 8px", fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>
            Relevant bij verhuizen of oversluiten: hypotheekverstrekkers tellen de maandlast aan DUO mee, vermenigvuldigd met een factor die afhangt van de hypotheekrente.<Uitleg>Per 2026 (bron: hypotheker.nl): 1,05 bij een hypotheekrente tot 2%, 1,25 bij 4,001–4,5%, 1,30 bij 5,001–5,5% en 1,40 vanaf 6%. Voor de tussenliggende rentes zijn geen waarden gevonden — vraag je adviseur welke factor voor jouw rente geldt en pas hem hieronder aan.</Uitleg>
          </p>
          <Veld label="Bruteringsfactor" value={studie.bruteringsfactor ?? String(STUDIESCHULD_BRUTERINGSFACTOR_STANDAARD)} onChange={v => persist({ studieschuld: { ...studie, bruteringsfactor: v } })} />
          <Rij label="Meegerekende maandlast" waarde={euro(impact.gebruteerdeMaandlast)} />
          {gemHypRente > 0 ? (
            <Rij label={`Lagere maximale hypotheek (grof, bij ${gemHypRente}% over 30 jaar)`} waarde={`− ${euro(impact.verlagingMaxHypotheek)}`} dik />
          ) : (
            <p style={{ margin: "6px 0 0", fontSize: 11, color: C.muted }}>Vul op het Hypotheek-tabblad een rente in om ook de orde van grootte van het effect op de maximale hypotheek te zien.</p>
          )}
          <p style={{ margin: "8px 0 0", fontSize: 10.5, color: C.muted, lineHeight: 1.5 }}>
            Indicatief. Een echte aanvraag rekent met de leennormen van de verstrekker. Met een lager maandbedrag aan DUO (laat het opnieuw berekenen na extra aflossen) telt er minder mee.
          </p>
        </div>
      )}

      {volgorde.length >= 2 && volgorde.some(v => v.soort === "studieschuld") && (
        <div style={S.card}>
          <h3 style={{ margin: "0 0 4px", fontSize: 13.5, fontWeight: 800, color: C.accent }}>⚖️ Welke schuld kost het meest?</h3>
          <p style={{ margin: "0 0 8px", fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>
            Rente per jaar, na belastingvoordeel (hypotheekrente wordt geschat tegen {Math.round(MAX_AFTREKTARIEF_2026 * 10000) / 100}% aftrek; studieschuldrente is niet aftrekbaar).
          </p>
          {volgorde.map((v, i) => (
            <Rij key={i} label={`${v.naam} (${v.soort})`} waarde={`${v.nettoRente.toLocaleString("nl-NL")}%`} dik={i === 0} />
          ))}
          <p style={{ margin: "8px 0 0", fontSize: 10.5, color: C.muted, lineHeight: 1.5 }}>
            Alleen een vergelijking van percentages. Boeterente, rentevaste periodes en de soepelere voorwaarden van DUO (inkomensafhankelijk, kwijtschelding) wegen ook mee in een echte afweging.
          </p>
        </div>
      )}

      <div style={{ ...S.card, background: "#FBF0E4", border: `1px solid #E8C9A044` }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: C.text }}>Goed om te weten</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: C.text, lineHeight: 1.7 }}>
          <li>Een studieschuld telt in principe mee als schuld in box 3, maar alleen het deel boven een drempel. Wil je dat meenemen, vul de studieschuld dan ook in onder "schulden" op het Overzicht-tabblad.</li>
          <li>Extra aflossen kan altijd, zonder boete. Vraag DUO daarna het maandbedrag opnieuw te berekenen als je een lagere maandlast wilt (handig voor een hypotheekaanvraag).</li>
          <li>Het exacte maandbedrag hangt af van je inkomen (draagkracht) en kan jaarlijks veranderen — gebruik hier het bedrag dat DUO nu van je afschrijft.</li>
        </ul>
      </div>
      <Disclaimer />
    </>
  );
}

function BvTab({ data, persist }) {
  const bv = data.bv || { verwachteWinstPerJaar: "", dividendplan: "", compensabelVerlies: "" };
  function updateBv(patch) { persist({ bv: { ...bv, ...patch } }); }
  const winst = +bv.verwachteWinstPerJaar || 0;
  const dividend = +bv.dividendplan || 0;
  const compensabelVerlies = +bv.compensabelVerlies || 0;
  const verliesverrekening = berekenVerliesverrekening(winst, compensabelVerlies);
  const belastbareWinstNaVerrekening = compensabelVerlies > 0 ? verliesverrekening.restWinstNaVerrekening : winst;
  const vpb = berekenVpb(belastbareWinstNaVerrekening);
  const winstNaVpb = winst - vpb;
  const box2 = berekenBox2Belasting(dividend);
  const beleggingenBv = +data.beleggingenBv || 0;

  // Dividend-timing: totaal te verdelen over 2026 en 2027, met schuifje.
  const { belastbareWinst: winstZzpBelast } = berekenBelastbareWinstZzp(+data.winstZzp || 0, { voldoetUrencriterium: data.voldoetUrencriterium, isStarter: data.isStarter });
  const tiAfgeleid = (+data.inkomenLoondienst || 0) + winstZzpBelast;
  const basisTI = bv.basisToetsingsinkomen !== "" && bv.basisToetsingsinkomen != null ? (+bv.basisToetsingsinkomen || 0) : tiAfgeleid;
  const totaalDividend = +(bv.dividendTotaal || bv.dividendplan) || 0;
  const [schuif, setSchuif] = useState(bv.dividend2026 !== "" && bv.dividend2026 != null ? +bv.dividend2026 : null);
  const x26 = Math.min(totaalDividend, schuif == null ? totaalDividend : schuif);
  const kotKinderen = bouwKotKinderen(data.kot);
  const aantalKinderen = +data.kot?.aantalKinderen || 1;
  const timingParams = { basisToetsingsinkomen: basisTI, kinderen: kotKinderen, aantalKinderen };
  const gekozen = berekenDividendScenario({ ...timingParams, dividend2026: x26, dividend2027: totaalDividend - x26 });
  const alles26 = berekenDividendScenario({ ...timingParams, dividend2026: totaalDividend, dividend2027: 0 });
  const alles27 = berekenDividendScenario({ ...timingParams, dividend2026: 0, dividend2027: totaalDividend });
  const optimum = totaalDividend > 0 ? berekenDividendOptimum(timingParams, totaalDividend, 100) : null;
  const stapGrootte = totaalDividend > 100000 ? 1000 : 500;
  const heeftOverstapIngevuld = kotKinderen.some(k => k.type !== "bso" && k.vanaf && +k.bsoUren > 0);

  return (
    <>
      <div style={S.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.accent }}>🏢 Je (rustende) BV — zakelijk beleggen</h3>
        <p style={{ margin: "0 0 12px", fontSize: 11.5, color: C.muted }}>
          Beleggingsresultaten binnen de BV vallen onder de vennootschapsbelasting (Vpb), niet onder box 3 — pas bij een dividenduitkering aan jezelf privé komt box 2 om de hoek kijken.
        </p>
        <Veld label={<>Verwachte winst (incl. beleggingsresultaat) in de BV per jaar<Uitleg>Beleg je RECHTSTREEKS in individuele aandelen/obligaties (niet via fondsen)? Dan mag je op basis van "goed koopmansgebruik" koerswinst pas tot de winst rekenen zodra je verkoopt (de kostprijsmethode) — tel hier dus alleen ontvangen dividend/rente plus eventuele GEREALISEERDE verkoopwinst van dit jaar bij op, niet de ongerealiseerde koersstijging van wat je nog in bezit hebt. Beleg je via beleggingsfondsen (zeker met VBI-status)? Dan geldt vaak een verplichte jaarlijkse waardering op marktwaarde, en hoort de ongerealiseerde waardeverandering er wél bij.</Uitleg></>} value={bv.verwachteWinstPerJaar} onChange={v => updateBv({ verwachteWinstPerJaar: v })} suffix="€" />
        <Veld label="Huidige beleggingen binnen de BV" value={data.beleggingenBv} onChange={v => persist({ beleggingenBv: v })} suffix="€" />
        <Veld label={<>Nog te verrekenen verlies uit eerdere jaren (optioneel)<Uitleg>Had de BV in een eerder jaar verlies? Dat compensabele verlies mag onbeperkt in de tijd worden verrekend met toekomstige winst (sinds 2022), tot €1 miljoen winst volledig, daarboven nog maar voor 50% van het meerdere. Vul hier in wat er nog aan verlies "openstaat" — vraag dit na bij je boekhouder/de laatste Vpb-aangifte als je het niet precies weet.</Uitleg></>} value={bv.compensabelVerlies} onChange={v => updateBv({ compensabelVerlies: v })} suffix="€" />

        {winst > 0 && (
          <div style={{ background: C.card, borderRadius: 10, padding: 12, marginTop: 4 }}>
            {compensabelVerlies > 0 && (
              <>
                <Rij label="Verrekend met oud verlies" waarde={`− ${euro(verliesverrekening.verrekend)}`} />
                <Rij label="Belastbare winst na verliesverrekening" waarde={euro(belastbareWinstNaVerrekening)} />
                {verliesverrekening.restVerlies > 0 && (
                  <p style={{ fontSize: 10.5, color: C.muted, margin: "2px 0 8px" }}>Nog {euro(verliesverrekening.restVerlies)} verlies over voor latere jaren.</p>
                )}
              </>
            )}
            <Rij label={<>Vennootschapsbelasting<Uitleg>De vennootschapsbelasting ("Vpb") is de belasting die je BV zelf betaalt over haar winst — inclusief wat ze verdient met beleggen. Dit is een aparte belasting van je persoonlijke inkomstenbelasting. Zolang de winst in de BV blijft zitten (en niet als dividend naar jou gaat), blijft het hierbij.</Uitleg></>} waarde={euro(vpb)} />
            <Rij label="Winst na Vpb, blijft in de BV" waarde={euro(winstNaVpb)} dik />
          </div>
        )}
      </div>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.accent }}>💸 Dividend naar privé (box 2)</h3>
        <p style={{ margin: "0 0 12px", fontSize: 11.5, color: C.muted }}>
          Alleen relevant als je daadwerkelijk winst uitkeert aan jezelf — winst die in de BV blijft zitten (herbeleggen) wordt hier niet nog eens belast.
        </p>
        <Veld label="Voorgenomen dividenduitkering" value={bv.dividendplan} onChange={v => updateBv({ dividendplan: v })} suffix="€" />
        {dividend > 0 && (
          <div style={{ background: C.card, borderRadius: 10, padding: 12, marginTop: 4 }}>
            <Rij label={<>Box 2-belasting<Uitleg>Zodra je geld van je BV naar jezelf privé overmaakt als dividend (winstuitkering), betaal je daar persoonlijk belasting over — dat heet "box 2". Winst die gewoon in de BV blijft zitten, raakt box 2 niet.</Uitleg></>} waarde={euro(box2)} />
            <Rij label="Netto in privé" waarde={euro(dividend - box2)} dik />
          </div>
        )}
      </div>


      <div style={S.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.accent }}>⚖️ Dividend: 2026 of 2027?</h3>
        <p style={{ margin: "0 0 12px", fontSize: 11.5, color: C.muted }}>
          Dividend telt volledig mee in het toetsingsinkomen van het jaar waarin je het uitkeert en kan toeslagen kosten. Schuif om te zien wat een andere verdeling over 2026 en 2027 oplevert. Kinderbijslag blijft buiten beeld: die hangt niet van inkomen af.
        </p>
        <Veld label="Totaal dividend dat je wilt uitkeren (2026 + 2027)" value={bv.dividendTotaal !== "" && bv.dividendTotaal != null ? bv.dividendTotaal : bv.dividendplan} onChange={v => updateBv({ dividendTotaal: v })} suffix="€" />
        <Veld label={<>Toetsingsinkomen zonder dividend (per jaar)<Uitleg>Standaard het geschatte toetsingsinkomen uit het Overzicht ({euro(tiAfgeleid)}). Staat er in je voorlopige aanslag of op toeslagen.nl een ander bedrag, vul dat hier in. Het wordt voor 2026 en 2027 gelijk gehouden.</Uitleg></>} value={bv.basisToetsingsinkomen} onChange={v => updateBv({ basisToetsingsinkomen: v })} suffix="€" placeholder={String(Math.round(tiAfgeleid))} />

        {totaalDividend > 0 ? (
          <>
            <div style={{ margin: "8px 0 4px", display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700 }}>
              <span>2026: {euro(x26)}</span>
              <span>2027: {euro(totaalDividend - x26)}</span>
            </div>
            <input type="range" min={0} max={totaalDividend} step={stapGrootte} value={x26}
              onChange={e => setSchuif(+e.target.value)}
              onMouseUp={() => updateBv({ dividend2026: String(x26) })}
              onTouchEnd={() => updateBv({ dividend2026: String(x26) })}
              onKeyUp={() => updateBv({ dividend2026: String(x26) })}
              aria-label="Dividend in 2026"
              style={{ width: "100%", accentColor: C.accent }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: C.muted, marginBottom: 10 }}>
              <span>alles in 2027</span><span>alles in 2026</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 1fr", gap: 4, fontSize: 11.5, background: C.card, borderRadius: 10, padding: 10 }}>
              <span />
              <strong style={{ textAlign: "right" }}>Alles 2026</strong>
              <strong style={{ textAlign: "right", color: C.accent }}>Jouw keuze</strong>
              <strong style={{ textAlign: "right" }}>Alles 2027</strong>
              {[
                ["Box 2-belasting", s => `− ${euro(s.box2)}`],
                ["Opvangtoeslag", s => euro(s.kot)],
                ["Overige toeslagen", s => euro(s.overig)],
                ["Netto totaal", s => euro(s.nettoTotaal), true],
              ].map(([label, f, dik]) => (
                <React.Fragment key={label}>
                  <span style={{ fontWeight: dik ? 800 : 400 }}>{label}</span>
                  <span style={{ textAlign: "right", fontWeight: dik ? 800 : 400 }}>{f(alles26)}</span>
                  <span style={{ textAlign: "right", fontWeight: dik ? 800 : 400, color: C.accent }}>{f(gekozen)}</span>
                  <span style={{ textAlign: "right", fontWeight: dik ? 800 : 400 }}>{f(alles27)}</span>
                </React.Fragment>
              ))}
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 10.5, color: C.muted }}>Netto totaal = dividend na box 2 + alle toeslagen over beide jaren.</p>

            {optimum && (
              <div style={{ background: "#E8F1EC", borderRadius: 10, padding: 12, marginTop: 10, fontSize: 12.5, lineHeight: 1.5 }}>
                <strong>Beste verdeling: {euro(optimum.beste.x)} in 2026 en {euro(totaalDividend - optimum.beste.x)} in 2027.</strong>
                {" "}Dat levert {euro(optimum.beste.nettoTotaal - alles26.nettoTotaal)} meer op dan alles in 2026
                {optimum.beste.nettoTotaal - alles27.nettoTotaal > 0 ? ` en ${euro(optimum.beste.nettoTotaal - alles27.nettoTotaal)} meer dan alles in 2027` : ""}.
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => { setSchuif(optimum.beste.x); updateBv({ dividend2026: String(optimum.beste.x) }); }}
                    style={{ border: "none", background: C.accent, color: "#FFF", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Zet schuifje op de beste verdeling
                  </button>
                </div>
              </div>
            )}

            {optimum && (() => {
              const W = 300, H = 90, P = 6;
              const ys = optimum.punten.map(pt => pt.nettoTotaal);
              const min = Math.min(...ys), max = Math.max(...ys), span = Math.max(1, max - min);
              const px = x => P + ((totaalDividend - x) / totaalDividend) * (W - 2 * P);
              const py = y => H - P - ((y - min) / span) * (H - 2 * P);
              const lijn = optimum.punten.map(pt => `${px(pt.x).toFixed(1)},${py(pt.nettoTotaal).toFixed(1)}`).join(" ");
              return (
                <div style={{ marginTop: 10 }}>
                  <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Netto totaal per verdeling van het dividend">
                    <polyline points={lijn} fill="none" stroke={C.accentLicht} strokeWidth="2" />
                    <circle cx={px(optimum.beste.x)} cy={py(optimum.beste.nettoTotaal)} r="4" fill={C.groen} />
                    <circle cx={px(x26)} cy={py(gekozen.nettoTotaal)} r="4" fill={C.oranje} />
                  </svg>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted }}>
                    <span>alles in 2027</span><span>🟢 beste · 🟠 jouw keuze</span><span>alles in 2026</span>
                  </div>
                </div>
              );
            })()}

            {kotKinderen.length === 0 && (
              <p style={{ fontSize: 11.5, color: C.oranje, margin: "10px 0 0" }}>Op het tabblad Toeslagen is nog geen kinderopvang ingevuld; nu telt alleen box 2 (en eventuele zorgtoeslag/kindgebonden budget).</p>
            )}
            {kotKinderen.length > 0 && !heeftOverstapIngevuld && (
              <p style={{ fontSize: 11.5, color: C.oranje, margin: "10px 0 0" }}>Tip: vul op het tabblad Toeslagen de overstap naar BSO in (bijv. per 3 april 2027 met het aantal BSO-uren). Zonder overstap rekent 2027 nog met dagopvang en lijkt uitstel minder voordelig.</p>
            )}
            <p style={{ fontSize: 10.5, color: C.muted, margin: "10px 0 0" }}>
              Schatting met de tarieven van 2026 voor beide jaren, een gelijk toetsingsinkomen en lineaire interpolatie van de toeslagtabellen. Toeslagen worden achteraf herberekend: ook als je voorschot nu laag staat, kan een hogere uitkering later tot terugbetaling leiden. Pas bij een uitkering je voorschot tijdig aan. Boven {euro(BOX2_GRENS_2026)} per jaar geldt in box 2 een hoger tarief (31%), dus verdelen over twee jaar kan ook daar voordeel geven. Check de uitkomst met een proefberekening op toeslagen.nl en overleg met je boekhouder.
            </p>
          </>
        ) : (
          <p style={{ fontSize: 12, color: C.muted, margin: "8px 0 0" }}>Vul het totale dividend in om te verdelen over 2026 en 2027.</p>
        )}
      </div>

      <div style={{ ...S.card, background: "#FBF0E4", border: `1px solid #E8C9A044` }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: C.text }}>Aandachtspunten bij een rustende BV</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: C.text, lineHeight: 1.7 }}>
          <li>De <strong>gebruikelijkloonregeling</strong> (verplicht DGA-salaris) geldt in principe alleen als er daadwerkelijk werkzaamheden voor de BV worden verricht — bij een écht rustende, puur beleggende BV is dat meestal niet het geval, maar dit hangt af van de feitelijke situatie.</li>
          <li>Winst <em>binnen</em> de BV laten zitten (niet uitkeren) stelt de box 2-heffing uit, maar je betaalt wel gewoon Vpb over het beleggingsresultaat zelf, elk jaar.</li>
          <li>De structuur van een beleggings-BV (holding, aandeelhoudersstructuur, risicospreiding) raakt al snel specialistisch maatwerk — dat is bij uitstek iets voor een <strong>accountant of fiscalist</strong>, niet voor een algemene rekentool.</li>
        </ul>
      </div>
      <Disclaimer />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// VANGNET — de risico's die vóór optimalisatie horen: arbeidsongeschiktheid,
// pensioenopbouw, een noodbuffer, en wat er gebeurt bij overlijden. Een
// adviseur bespreekt dit doorgaans als eerste, vóór aflossen/beleggen.
// ══════════════════════════════════════════════════════════════════════════
function VangnetTab({ data, persist }) {
  const v = data.vangnet || {};
  function updateV(patch) { persist({ vangnet: { ...v, ...patch } }); }

  const winstZzp = +data.winstZzp || 0;
  const loondienst = +data.inkomenLoondienst || 0;
  const spaargeld = +data.spaargeld || 0;

  const { netto: nettoZzpNu } = berekenNettoZzpInkomen(winstZzp, { voldoetUrencriterium: data.voldoetUrencriterium, isStarter: data.isStarter });

  const pensioenopbouwLoondienst = berekenJaarlijksePensioenopbouw(loondienst);

  const vasteLasten = +v.maandelijkseVasteLasten || 0;
  const buffer = berekenNoodbufferStatus(vasteLasten, spaargeld);

  const [voorbeeldErfdeel, setVoorbeeldErfdeel] = useState(String(Math.round(spaargeld + (+data.beleggingenPrive || 0)) || 300000));
  const erfdeel = +voorbeeldErfdeel || 0;
  const erfbelastingMet = berekenErfbelastingPartner(erfdeel, true);
  const erfbelastingZonder = berekenErfbelastingPartner(erfdeel, false);

  return (
    <>
      <div style={S.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.accent }}>
          🛡️ Arbeidsongeschiktheid
          <Uitleg>Word je ziek of arbeidsongeschikt? Als werknemer ben je daarvoor verzekerd via de WIA. Een zzp'er heeft dat vangnet niet — zonder eigen verzekering (AOV) valt bij ziekte het hele inkomen weg, hoe lang het ook duurt.</Uitleg>
        </h3>
        <p style={{ margin: "0 0 12px", fontSize: 11.5, color: C.muted }}>Dit raakt specifiek je vriendin als zzp'er — jij bent via je werkgever verzekerd met de WIA.</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={() => updateV({ heeftAov: true })} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: `1px solid ${C.border}`, background: v.heeftAov === true ? C.groen : C.card, color: v.heeftAov === true ? "#FFF" : C.text, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Heeft een AOV</button>
          <button onClick={() => updateV({ heeftAov: false })} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: `1px solid ${C.border}`, background: v.heeftAov === false ? C.rood : C.card, color: v.heeftAov === false ? "#FFF" : C.text, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Geen AOV</button>
        </div>
        {v.heeftAov === false && winstZzp > 0 && (
          <div style={{ background: "#FBEAEA", border: `1px solid ${C.rood}33`, borderRadius: 10, padding: 12 }}>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
              ⚠️ Zonder AOV valt bij langdurige ziekte naar schatting <strong>{euro(nettoZzpNu)}</strong> netto per jaar weg — met niets dat dit opvangt, behalve eventueel bijstand (met een strenge vermogenstoets). Een AOV kost zelf ook geld (vaak enkele honderden euro's per maand, afhankelijk van leeftijd, beroep en dekking) — dat is een reële afweging, maar wel een bewuste.
            </p>
          </div>
        )}
        {v.heeftAov === true && (
          <p style={{ margin: 0, fontSize: 12, color: C.groen }}>✅ Mooi dat dit geregeld is — check wel af en toe of de dekking nog aansluit bij het huidige inkomen.</p>
        )}
      </div>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.accent }}>
          🏦 Pensioenopbouw-gat
          <Uitleg>Als werknemer bouw je meestal automatisch pensioen op via je werkgever. Een zzp'er doet dat niet automatisch — wie daar niets voor regelt (lijfrente, banksparen, of gewoon zelf beleggen voor later) staat op pensioenleeftijd met aanmerkelijk minder inkomen dan de partner die in loondienst was.</Uitleg>
        </h3>
        {loondienst > 0 && (
          <p style={{ margin: "0 0 10px", fontSize: 12.5 }}>
            Bij €{Math.round(loondienst).toLocaleString("nl-NL")} brutoloon bouwt de werknemer in dit gezin ongeveer <strong>{euro(pensioenopbouwLoondienst)}</strong> aanvullend pensioen per jaar op (standaard middelloonregeling, 1,875% over het loon boven de AOW-franchise van €19.172).
          </p>
        )}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={() => updateV({ zzpRegeltZelfPensioen: true })} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: `1px solid ${C.border}`, background: v.zzpRegeltZelfPensioen === true ? C.groen : C.card, color: v.zzpRegeltZelfPensioen === true ? "#FFF" : C.text, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Regelt zelf iets (lijfrente/banksparen)</button>
          <button onClick={() => updateV({ zzpRegeltZelfPensioen: false })} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: `1px solid ${C.border}`, background: v.zzpRegeltZelfPensioen === false ? C.oranje : C.card, color: v.zzpRegeltZelfPensioen === false ? "#FFF" : C.text, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Nog niets geregeld</button>
        </div>
        {v.zzpRegeltZelfPensioen === true && (
          <Veld label="Eigen inleg voor pensioen (lijfrente/banksparen) per jaar" value={v.pensioenEigenInlegPerJaar} onChange={val => updateV({ pensioenEigenInlegPerJaar: val })} suffix="€/jaar" />
        )}
        {v.zzpRegeltZelfPensioen === false && loondienst > 0 && (
          <div style={{ background: "#FBF0E4", border: `1px solid ${C.oranje}33`, borderRadius: 10, padding: 12 }}>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
              💡 Dat betekent een gat van ongeveer <strong>{euro(pensioenopbouwLoondienst)}</strong> per jaar tussen jullie pensioenopbouw. Over 20-30 jaar, met rente-op-rente, loopt dat flink op. Een lijfrente bij de eigen BV (in plaats van alleen privé) kan hier trouwens ook fiscaal gunstig zijn — vraag dit na bij een adviseur.
            </p>
          </div>
        )}
      </div>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.accent }}>
          💰 Noodbuffer
          <Uitleg>De vuistregel van de meeste financieel adviseurs: 3 tot 6 maanden vaste lasten achter de hand, vóórdat je nadenkt over extra aflossen of beleggen. Zonder buffer is een onverwachte rekening (kapotte wasmachine, auto) meteen een probleem.</Uitleg>
        </h3>
        <Veld label="Maandelijkse vaste lasten (huur/hypotheek, verzekeringen, boodschappen, etc.)" value={v.maandelijkseVasteLasten} onChange={val => updateV({ maandelijkseVasteLasten: val })} suffix="€/maand" />
        {buffer && (
          <div style={{ background: buffer.voldoendeMinimum ? "#EAF3EE" : "#FBEAEA", border: `1px solid ${(buffer.voldoendeMinimum ? C.groen : C.rood)}33`, borderRadius: 10, padding: 12, marginTop: 4 }}>
            <Rij label="Aanbevolen buffer (3-6 maanden)" waarde={`${euro(buffer.minBuffer)} – ${euro(buffer.maxBuffer)}`} />
            <Rij label="Jullie huidige spaargeld" waarde={euro(spaargeld)} />
            {buffer.voldoendeMinimum ? (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: C.groen, fontWeight: 600 }}>✅ Jullie buffer zit op of boven het aanbevolen minimum.</p>
            ) : (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: C.rood, fontWeight: 600 }}>⚠️ Nog {euro(buffer.tekortTotMinimum)} tot het aanbevolen minimum — overweeg dit vóór extra aflossen of beleggen.</p>
            )}
          </div>
        )}
      </div>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.accent }}>
          ⚰️ Bij overlijden
          <Uitleg>Zijn jullie niet getrouwd of geregistreerd partner? Dan erft de achterblijvende partner in Nederland standaard NIETS automatisch, en geldt voor de erfbelasting een minimale vrijstelling — tenzij aan specifieke voorwaarden is voldaan.</Uitleg>
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <input type="checkbox" checked={!!v.heeftSamenlevingscontract} onChange={e => updateV({ heeftSamenlevingscontract: e.target.checked })} />
            Notarieel samenlevingscontract (met wederzijdse zorgverplichting)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <input type="checkbox" checked={!!v.heeftTestament} onChange={e => updateV({ heeftTestament: e.target.checked })} />
            Testament (regelt dat de partner ook daadwerkelijk ERFT — het samenlevingscontract regelt alleen de erfbelasting-vrijstelling, niet het erfrecht zelf)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <input type="checkbox" checked={!!v.heeftOrvGekoppeldAanHypotheek} onChange={e => updateV({ heeftOrvGekoppeldAanHypotheek: e.target.checked })} />
            Overlijdensrisicoverzekering gekoppeld aan de hypotheek
          </label>
        </div>

        {(!v.heeftSamenlevingscontract || !v.heeftTestament) && (
          <div style={{ background: "#FBEAEA", border: `1px solid ${C.rood}33`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
              {!v.heeftTestament && <>⚠️ Zonder testament erft de achterblijvende partner bij ongehuwd samenwonen <strong>wettelijk niets</strong> — de wet laat het bezit dan naar de kinderen of familie van de overledene gaan. </>}
              {!v.heeftSamenlevingscontract && <>Zonder notarieel samenlevingscontract geldt bovendien voor de erfbelasting niet de partnervrijstelling, maar de vrijstelling voor "overige verkrijgers" (slechts €2.769, tegen €828.035 mét contract).</>}
            </p>
          </div>
        )}
        {!v.heeftOrvGekoppeldAanHypotheek && (
          <p style={{ margin: "0 0 12px", fontSize: 11.5, color: C.muted }}>
            💡 Zonder overlijdensrisicoverzekering moet de achterblijvende partner de volledige hypotheeklast alleen kunnen dragen — check of dat met één inkomen haalbaar zou zijn.
          </p>
        )}

        <label style={S.label}>Reken het verschil door — geschat te erven vermogen</label>
        <input type="number" style={{ ...S.inp, marginBottom: 10 }} value={voorbeeldErfdeel} onChange={e => setVoorbeeldErfdeel(e.target.value)} />
        {erfdeel > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, background: "#EAF3EE", borderRadius: 10, padding: 12, textAlign: "center" }}>
              <p style={{ margin: "0 0 4px", fontSize: 10.5, color: C.muted }}>Mét samenlevingscontract</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.groen }}>{euro(erfbelastingMet)}</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: C.muted }}>erfbelasting</p>
            </div>
            <div style={{ flex: 1, background: "#FBEAEA", borderRadius: 10, padding: 12, textAlign: "center" }}>
              <p style={{ margin: "0 0 4px", fontSize: 10.5, color: C.muted }}>Zónder contract</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.rood }}>{euro(erfbelastingZonder)}</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: C.muted }}>erfbelasting</p>
            </div>
          </div>
        )}
      </div>
      <Disclaimer />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SAMENVATTING — alle tabbladen bij elkaar: wat valt op in de ingevulde
// cijfers? Bewust als "aandachtspunten om te bespreken" geframed, niet als
// bindende aanbevelingen (zie de disclaimer die ook hier onderaan staat).
// ══════════════════════════════════════════════════════════════════════════
const PRIORITEIT_INFO = {
  risico: { label: "Vraagt aandacht", kleur: C.rood, achtergrond: "#FBEAEA", icoon: "⚠️" },
  kans: { label: "Kans/inzicht", kleur: C.groen, achtergrond: "#EAF3EE", icoon: "💡" },
  info: { label: "Compleetheid", kleur: C.oranje, achtergrond: "#FBF0E4", icoon: "ℹ️" },
};
const TAB_LABELS = { overzicht: "Overzicht", kinderopvang: "Toeslagen", hypotheek: "Hypotheek", studieschuld: "Studieschuld", vangnet: "Vangnet", bv: "BV" };

function SamenvattingTab({ data, setTab }) {
  const punten = bouwAandachtspunten(data);
  const risicos = punten.filter(p => p.prioriteit === "risico");
  const heeftIetsIngevuld = +data.inkomenLoondienst > 0 || +data.winstZzp > 0 || (data.hypotheek?.delen || []).some(d => +d.schuld > 0);

  return (
    <>
      <div style={S.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.accent }}>📋 Wat valt op in jullie cijfers</h3>
        <p style={{ margin: 0, fontSize: 11.5, color: C.muted }}>
          Een overzicht van alle tabbladen samen — geen bindend advies, maar een geprioriteerde lijst van wat de ingevulde cijfers zelf laten zien.
        </p>
      </div>

      {!heeftIetsIngevuld && (
        <div style={S.card}>
          <p style={{ margin: 0, fontSize: 13, color: C.muted, textAlign: "center", padding: "10px 0" }}>
            Vul eerst een paar tabbladen in (te beginnen bij Overzicht) — dan verschijnt hier een samenvatting.
          </p>
        </div>
      )}

      {heeftIetsIngevuld && punten.length === 0 && (
        <div style={{ ...S.card, background: "#EAF3EE", border: `1px solid ${C.groen}33` }}>
          <p style={{ margin: 0, fontSize: 13 }}>✅ Op basis van wat er nu is ingevuld, springt er niets uit als duidelijk aandachtspunt. Vul gerust meer tabbladen in voor een vollediger beeld.</p>
        </div>
      )}

      {heeftIetsIngevuld && risicos.length > 0 && (
        <div style={{ ...S.card, background: "#FBEAEA", border: `1px solid ${C.rood}33` }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700 }}>
            {risicos.length} {risicos.length === 1 ? "punt vraagt" : "punten vragen"} aandacht — vaak zijn dit de dingen die het eerst de moeite waard zijn om te regelen, vóór optimalisaties zoals aflossen of beleggen.
          </p>
        </div>
      )}

      {punten.map(p => {
        const info = PRIORITEIT_INFO[p.prioriteit];
        return (
          <div key={p.id} onClick={() => setTab(p.tab)}
            style={{ ...S.card, background: info.achtergrond, border: `1px solid ${info.kleur}33`, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 800 }}>{info.icoon} {p.titel}</p>
              <span style={{ fontSize: 10, color: C.muted, flexShrink: 0, whiteSpace: "nowrap" }}>{TAB_LABELS[p.tab]} →</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: C.text }}>{p.tekst}</p>
          </div>
        );
      })}

      <Disclaimer />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MOGELIJKHEDEN — legale regelingen en overwegingen die bij jullie situatie
// passen (privé én zakelijk). Nadrukkelijk GEEN persoonlijk financieel
// advies (dat is in Nederland vergunningplichtig) — wel een overzicht van
// wat er bestaat, zodat je weloverwogen met een adviseur/fiscalist kunt
// bepalen wat voor jullie zinvol is.
// ══════════════════════════════════════════════════════════════════════════
function MogelijkhedenTab({ data, persist }) {
  const winstZzp = +data.winstZzp || 0;
  const beleggingenPrive = +data.beleggingenPrive || 0;
  const v = data.vangnet || {};

  const jaarruimte = berekenJaarruimteLijfrente(winstZzp);
  const groen = berekenGroeneBeleggingenVoordeel(0, 2); // 0 = nog niets in groen; toont de volledige beschikbare ruimte

  const vv = data.vermogenVerdeling || { partner1: { naam: "Partner 1", spaargeld: "", beleggingen: "", schulden: "" }, partner2: { naam: "Partner 2", spaargeld: "", beleggingen: "", schulden: "" } };
  function updateVermogen(wie, patch) { persist({ vermogenVerdeling: { ...vv, [wie]: { ...vv[wie], ...patch } } }); }
  const heeftVermogenIngevuld = [vv.partner1, vv.partner2].some(p => +p.spaargeld > 0 || +p.beleggingen > 0 || +p.schulden > 0);
  const box3Verdelen = berekenBox3VoordeelVerdelen(vv.partner1, vv.partner2);

  return (
    <>
      <div style={S.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.accent }}>💡 Mogelijkheden</h3>
        <p style={{ margin: 0, fontSize: 11.5, color: C.muted }}>
          Legale regelingen en overwegingen die bij jullie situatie passen — géén persoonlijk financieel advies (dat is in Nederland vergunningplichtig), wel een startpunt om te bespreken met een adviseur of fiscalist.
        </p>
      </div>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 10px", fontSize: 13.5, fontWeight: 800, color: C.accent }}>🏠 Privé</h3>

        <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700 }}>
            Lijfrente-jaarruimte (zzp-partner)
            <Uitleg>Als zzp'er bouw je geen pensioen op via een werkgever — de "jaarruimte" is het bedrag dat je dit jaar fiscaal aftrekbaar mag inleggen in een lijfrente of bankspaarrekening, als compensatie. Dit is 30% van je winst boven de AOW-franchise (€19.172), met een maximum van €35.589 in 2026. Niet benutte jaarruimte van de afgelopen 10 jaar mag je ook nog inhalen ("reserveringsruimte", max €42.753).</Uitleg>
          </p>
          {winstZzp > 0 ? (
            <>
              <Rij label="Geschatte jaarruimte 2026" waarde={euro(jaarruimte)} dik />
              <p style={{ fontSize: 11, color: C.muted, margin: "4px 0 0" }}>Direct gekoppeld aan het pensioenopbouw-gat dat op het Vangnet-tabblad al wordt gesignaleerd.</p>
            </>
          ) : (
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Vul eerst de zzp-winst in op Overzicht om een schatting te zien.</p>
          )}
        </div>

        <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700 }}>
            Groene beleggingen
            <Uitleg>Niet hetzelfde als "duurzaam beleggen" in het algemeen — het belastingvoordeel geldt alleen voor door de overheid (RVO) erkende groenfondsen, zoals ASN Groenprojectenfonds, Triodos Groenfonds of Rabo GroenSparen. Een fonds dat zichzelf "groen" noemt zonder die officiële erkenning telt niet mee. Bovenop het algemene heffingsvrij vermogen in box 3 geldt voor erkende groene beleggingen/spaartegoeden een aparte vrijstelling: €26.715 per persoon in 2026 (€53.430 samen als fiscale partners), plus een kleine heffingskorting (0,1%) over het vrijgestelde bedrag. Let op: deze regeling wordt afgebouwd — de vrijstelling daalt fors in 2027, en in 2028 verdwijnen zowel de vrijstelling als de heffingskorting helemaal. 2026 en 2027 zijn dus de laatste jaren om hier nog (bijna) het volledige voordeel uit te halen.</Uitleg>
          </p>
          <Rij label="Beschikbare vrijstelling (samen, nog ongebruikt)" waarde={euro(groen.vrijstelling)} dik />
          {beleggingenPrive > 0 && (
            <p style={{ fontSize: 11, color: C.muted, margin: "4px 0 0" }}>Van je ingevulde €{Math.round(beleggingenPrive).toLocaleString("nl-NL")} aan privébeleggingen zou een deel hier eventueel voor in aanmerking kunnen komen, afhankelijk van in welke producten je belegt.</p>
          )}
          <p style={{ fontSize: 10.5, color: C.oranje, margin: "6px 0 0" }}>⚠️ Wordt afgebouwd: fors lagere vrijstelling in 2027, volledig verdwenen in 2028.</p>
        </div>

        <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700 }}>
            Schenkingsvrijstelling richting jullie kind
            <Uitleg>Als (groot)ouders mogen jullie eigen ouders jaarlijks €6.908 (2026) belastingvrij aan jullie kind schenken, ongeacht diens leeftijd — bijvoorbeeld om alvast te sparen voor later. Dit is geen regeling die jullie zelf toepassen, maar kan relevant zijn om te bespreken met grootouders die willen bijdragen.</Uitleg>
          </p>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Jaarlijkse vrijstelling 2026: {euro(6908)} per kind, van (groot)ouders.</p>
        </div>

        <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700 }}>
            Fiscaal partnerschap — aftrekposten verdelen
            <Uitleg>Als fiscale partners mogen jullie gezamenlijke aftrekposten (zoals hypotheekrente) vrij verdelen over beide aangiftes — in de verhouding die voor jullie samen de laagste totale belasting oplevert. Dit kost niets om te doen, en de meeste aangifte-software (of een boekhouder) optimaliseert dit automatisch, maar het is goed om te weten dat deze keuzevrijheid bestaat.</Uitleg>
          </p>
        </div>
      </div>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 13.5, fontWeight: 800, color: C.accent }}>
          ⚖️ Box 3-vermogen optimaal verdelen
          <Uitleg>Als fiscale partners (wat jullie als ongehuwd samenwonenden met een kind automatisch zijn) mogen jullie het gezamenlijke box 3-vermogen én de gezamenlijke (verdubbelde) vrijstelling vrij verdelen over beide aangiftes. Staat het vermogen scheef verdeeld (bijvoorbeeld bijna alles op naam van één van jullie) en wordt dat niet actief gecorrigeerd bij de aangifte, dan loopt de ander zijn deel van de vrijstelling (€59.357 in 2026) mis. Vul ieders eigen spaargeld/beleggingen/schulden in om te zien of herverdelen voordeel oplevert.</Uitleg>
        </h3>
        <p style={{ margin: "0 0 12px", fontSize: 11.5, color: C.muted }}>Dit raakt alleen hoe je het op de aangifte verdeelt — niet waar het geld daadwerkelijk staat.</p>

        {[["partner1", vv.partner1], ["partner2", vv.partner2]].map(([key, p]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <p style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 700 }}>{p.naam}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><Veld label="Spaargeld" value={p.spaargeld} onChange={val => updateVermogen(key, { spaargeld: val })} suffix="€" /></div>
              <div style={{ flex: 1 }}><Veld label="Beleggingen" value={p.beleggingen} onChange={val => updateVermogen(key, { beleggingen: val })} suffix="€" /></div>
            </div>
          </div>
        ))}

        {heeftVermogenIngevuld && (
          <div style={{ background: box3Verdelen.besparing > 0 ? "#EAF3EE" : C.card, border: box3Verdelen.besparing > 0 ? `1px solid ${C.groen}33` : "none", borderRadius: 10, padding: 12 }}>
            <Rij label="Belasting als ieder zijn eigen deel apart aangeeft" waarde={euro(box3Verdelen.nietOptimaal)} />
            <Rij label="Belasting bij optimaal verdelen" waarde={euro(box3Verdelen.optimaal)} dik />
            {box3Verdelen.besparing > 0 ? (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: C.groen, fontWeight: 600 }}>✅ Optimaal verdelen scheelt {euro(box3Verdelen.besparing)} per jaar.</p>
            ) : (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: C.muted }}>Bij deze bedragen maakt de verdeling niets uit — jullie vermogen is al in balans of te laag voor het verschil om op te vallen.</p>
            )}
          </div>
        )}
      </div>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 10px", fontSize: 13.5, fontWeight: 800, color: C.accent }}>🏠 Nog meer privé</h3>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700 }}>
            Periodieke gift aan een goed doel
            <Uitleg>Een gewone, jaarlijkse gift is pas aftrekbaar boven een drempel van 1% van je inkomen — bij een bescheiden, regelmatig bedrag levert dat vaak HELEMAAL GEEN aftrek op. Leg je dezelfde gift schriftelijk vast als "periodieke gift" (minimaal 5 jaar, ongeveer gelijk bedrag, aan een ANBI) — geen notaris meer nodig sinds 2014, een onderhandse overeenkomst volstaat — dan is het VOLLEDIGE bedrag aftrekbaar, zonder drempel.</Uitleg>
          </p>
          <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>Relevant als jullie "Goede doelen"-abonnementen (zie de Abonnementen-tool) een vaste, terugkerende gift aan dezelfde instelling(en) betreffen.</p>
        </div>
      </div>

      <div style={S.card}>
        <h3 style={{ margin: "0 0 10px", fontSize: 13.5, fontWeight: 800, color: C.accent }}>🏢 Zakelijk (BV)</h3>

        <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700 }}>
            Lijfrente vanuit de BV
            <Uitleg>In plaats van (of naast) een privé-lijfrente kan de BV zelf een lijfrente-verplichting aangaan ten behoeve van de DGA — dit kan fiscaal aantrekkelijk zijn omdat de BV de inleg als kostenpost kan boeken, in plaats van dat het ten koste gaat van je privé-netto-inkomen. De exacte afweging (privé vs. via de BV) hangt af van jullie volledige plaatje en is iets voor een fiscalist.</Uitleg>
          </p>
          {v.zzpRegeltZelfPensioen === false && (
            <p style={{ fontSize: 11, color: C.oranje, margin: 0 }}>Relevant: op het Vangnet-tabblad staat aangegeven dat er voor de zzp-partner nog niets geregeld is.</p>
          )}
        </div>

        <div>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700 }}>
            Timing van dividenduitkeringen
            <Uitleg>Box 2 kent een laag tarief (24,5%) tot €68.843 en een hoog tarief (31%) daarboven, PER JAAR. Een groot dividend in één keer uitkeren kan je dus sneller in de hoge schijf duwen dan hetzelfde bedrag over meerdere jaren spreiden. Dit is een kwestie van timing, geen wondermiddel — maar wel iets om bewust over te beslissen in plaats van toevallig te laten gebeuren.</Uitleg>
          </p>
        </div>
      </div>

      <Disclaimer />
    </>
  );
}
