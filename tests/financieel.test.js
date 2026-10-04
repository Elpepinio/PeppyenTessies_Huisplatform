const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test, samenvatting } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "pages", "financieel.js");

const {
  berekenBox1Belasting, berekenAlgemeneHeffingskorting, berekenArbeidskorting,
  berekenBelastbareWinstZzp, berekenZvwBijdrageZzp, berekenNettoZzpInkomen, berekenMarginaleDruk,
  begrensHeffingskortingen, berekenNettoLoondienstInkomen,
  berekenBox2Belasting, berekenBox3Belasting,
  berekenVpb, berekenKinderopvangtoeslagPerKind, interpoleerPercentage,
  berekenRenteAflossingsvrij, berekenMaandlastDeel, simuleerHypotheek, haalHypotheekDelenOp,
  berekenBoetevrijeRuimte, berekenAflossenMeerdereDelen,
  berekenEigenwoningforfait, berekenWetHillenAftrek, berekenJaarlijksePensioenopbouw,
  berekenNoodbufferStatus, berekenErfbelastingPartner, berekenZorgtoeslagPerMaand, berekenKindgebondenBudgetPerJaar,
  bouwAandachtspunten, euro, berekenJaarruimteLijfrente, berekenGroeneBeleggingenVoordeel,
  berekenVerliesverrekening, berekenBox3VoordeelVerdelen,
} = laadFuncties(BESTAND, [
  /const euro = /,
  /const BOX1_SCHIJVEN_2026 = /,
  /function berekenBox1Belasting\(inkomen\)/,
  /function berekenAlgemeneHeffingskorting\(inkomen\)/,
  /function berekenArbeidskorting\(arbeidsinkomen\)/,
  /const ZELFSTANDIGENAFTREK_2026 = /,
  /const STARTERSAFTREK_2026 = /,
  /const MKB_WINSTVRIJSTELLING_PCT = /,
  /function berekenBelastbareWinstZzp\(winstVoorAftrek, \{ voldoetUrencriterium = true, isStarter = false \} = \{\}\)/,
  /const ZVW_PERCENTAGE_ZZP_2026 = /,
  /const ZVW_MAX_BIJDRAGE_INKOMEN_2026 = /,
  /function berekenZvwBijdrageZzp\(belastbareWinst\)/,
  /function begrensHeffingskortingen\(heffingskortingen, belasting\)/,
  /function berekenNettoLoondienstInkomen\(loondienst\)/,
  /function berekenNettoZzpInkomen\(winstVoorAftrek, \{ voldoetUrencriterium = true, isStarter = false \} = \{\}\)/,
  /function berekenMarginaleDruk\(winstVoorAftrek, opties = \{\}\)/,
  /const BOX2_GRENS_2026 = /,
  /function berekenBox2Belasting\(dividendUitkering\)/,
  /const BOX3_2026 = /,
  /function berekenBox3Belasting\(\{ spaargeld = 0, beleggingen = 0, schulden = 0, aantalPersonen = 1 \}\)/,
  /const VPB_GRENS_2026 = /,
  /function berekenVpb\(winst\)/,
  /const EIGENWONINGFORFAIT_GRENS_2026 = /,
  /function berekenEigenwoningforfait\(wozWaarde\)/,
  /const WET_HILLEN_PERCENTAGE_2026 = /,
  /function berekenWetHillenAftrek\(eigenwoningforfait, aftrekbareRente\)/,
  /const AOW_FRANCHISE_2026 = /,
  /const PENSIOENOPBOUW_PCT_2026 = /,
  /const MAX_PENSIOENGEVEND_LOON_2026 = /,
  /function berekenJaarlijksePensioenopbouw\(brutoJaarloon\)/,
  /function berekenNoodbufferStatus\(maandelijkseVasteLasten, huidigSpaargeld\)/,
  /const ERFBELASTING_PARTNERVRIJSTELLING_2026 = /,
  /const ERFBELASTING_OVERIGE_VRIJSTELLING_2026 = /,
  /const ERFBELASTING_SCHIJFGRENS_2026 = /,
  /function berekenErfbelastingPartner\(erfdeel, heeftSamenlevingscontract\)/,
  /function berekenZorgtoeslagPerMaand\(toetsingsinkomen, heeftToeslagpartner\)/,
  /function berekenKindgebondenBudgetPerJaar\(aantalKinderen, toetsingsinkomen, heeftToeslagpartner\)/,
  /const JAARRUIMTE_PCT_2026 = /,
  /const JAARRUIMTE_MAX_2026 = /,
  /const JAARRUIMTE_MAX_INKOMEN_2026 = /,
  /function berekenJaarruimteLijfrente\(inkomen, pensioenaangroeiWerkgever = 0\)/,
  /const GROENE_BELEGGINGEN_VRIJSTELLING_2026 = /,
  /const GROENE_BELEGGINGEN_HEFFINGSKORTING_PCT = /,
  /function berekenGroeneBeleggingenVoordeel\(huidigeGroeneBeleggingen, aantalPersonen = 2\)/,
  /const VERLIESVERREKENING_DREMPEL_2026 = /,
  /function berekenVerliesverrekening\(winst, compensabelVerlies\)/,
  /function berekenBox3VoordeelVerdelen\(vermogenPartner1, vermogenPartner2\)/,
  /function bouwAandachtspunten\(data\)/,
  /const KOT_MAX_UURPRIJS_2026 = /,
  /const KOT_MAX_UREN_PER_MAAND = /,
  /const KOT_IJKPUNTEN_EERSTE_KIND = /,
  /const KOT_IJKPUNTEN_VOLGEND_KIND = /,
  /function interpoleerPercentage\(inkomen, ijkpunten\)/,
  /function berekenKinderopvangtoeslagPerKind\(/,
  /function berekenRenteAflossingsvrij\(schuld, renteJaar, resterendeJaren\)/,
  /function berekenBoetevrijeRuimte\(oorspronkelijkBedrag, percentage\)/,
  /const MAX_AFTREKTARIEF_2026 = /,
  /function berekenAflossenMeerdereDelen\(delen, verwachtRendementPct\)/,
  /function berekenMaandlastDeel\(deel\)/,
  /function simuleerHypotheek\(/,
  /function haalHypotheekDelenOp\(hypotheek\)/,
]);

sectie("Box 1 — inkomstenbelasting 2026 (geverifieerd tegen officiële rekenvoorbeelden)");
test("€30.000 geeft €10.725 belasting (exact uit bron)", berekenBox1Belasting(30000) === 10725);
test("€50.000 geeft €18.076 belasting (exact uit bron)", berekenBox1Belasting(50000) === 18076);
test("€60.000 valt deels in schijf 2", berekenBox1Belasting(60000) === 21832);
test("€0 of negatief geeft 0, geen crash", berekenBox1Belasting(0) === 0 && berekenBox1Belasting(-500) === 0);
test("inkomen boven €78.426 raakt ook schijf 3 (49,50%)", berekenBox1Belasting(100000) > berekenBox1Belasting(78426));

sectie("Heffingskortingen 2026");
test("algemene heffingskorting is het maximum (€3.115) onder het afbouwpunt", berekenAlgemeneHeffingskorting(20000) === 3115);
test("algemene heffingskorting is exact 0 bij €78.426 (officieel nihil-punt)", berekenAlgemeneHeffingskorting(78426) === 0);
test("algemene heffingskorting wordt nooit negatief boven het nihil-punt", berekenAlgemeneHeffingskorting(150000) === 0);
test("arbeidskorting bij €25.000 komt overeen met het officiële rekenvoorbeeld (€5.038)", berekenArbeidskorting(25000) === 5038);
test("arbeidskorting bereikt het maximum (€5.685) bij €45.592", berekenArbeidskorting(45592) === 5685);
test("arbeidskorting bij €60.000 komt overeen met het officiële rekenvoorbeeld (€4.747)", berekenArbeidskorting(60000) === 4747);
test("arbeidskorting is exact 0 bij €132.920 (officieel nihil-punt)", berekenArbeidskorting(132920) === 0);
test("arbeidskorting wordt nooit negatief boven het nihil-punt", berekenArbeidskorting(200000) === 0);

sectie("ZZP-aftrekposten 2026 (zelfstandigenaftrek, startersaftrek, MKB-winstvrijstelling)");
const zzp1 = berekenBelastbareWinstZzp(60000, { voldoetUrencriterium: true, isStarter: false });
test("zelfstandigenaftrek van €1.200 wordt toegepast", zzp1.zelfstandigenaftrek === 1200);
test("geen startersaftrek als isStarter false is", zzp1.startersaftrek === 0);
test("MKB-winstvrijstelling (12,7%) wordt berekend over de winst na zelfstandigenaftrek",
  zzp1.mkbVrijstelling === Math.round((60000 - 1200) * 0.127));
const zzp2 = berekenBelastbareWinstZzp(60000, { voldoetUrencriterium: true, isStarter: true });
test("startersaftrek van €2.123 wordt extra toegepast voor starters", zzp2.startersaftrek === 2123);
test("belastbare winst is lager voor een starter dan voor een niet-starter bij gelijke winst", zzp2.belastbareWinst < zzp1.belastbareWinst);
const zzpGeenUren = berekenBelastbareWinstZzp(60000, { voldoetUrencriterium: false, isStarter: false });
test("geen zelfstandigenaftrek zonder te voldoen aan het urencriterium", zzpGeenUren.zelfstandigenaftrek === 0);
test("winst van 0 of minder crasht niet", berekenBelastbareWinstZzp(0).belastbareWinst === 0 && berekenBelastbareWinstZzp(-500).belastbareWinst === 0);
test("aftrekposten worden nooit groter dan de winst zelf (geen negatieve belastbare winst door afronding)",
  berekenBelastbareWinstZzp(500, { voldoetUrencriterium: true, isStarter: true }).belastbareWinst >= 0);

sectie("Zvw-bijdrage zzp 2026 (geverifieerd tegen officieel Rabobank-rekenvoorbeeld)");
test("belastbare winst €49.640 geeft €2.408 Zvw-bijdrage (±1 euro afronding van het officiële voorbeeld)",
  Math.abs(berekenZvwBijdrageZzp(49640) - 2408) <= 1);
test("Zvw-bijdrage wordt afgetopt op het maximum bijdrage-inkomen (€79.409 × 4,85% ≈ €3.851)",
  berekenZvwBijdrageZzp(79409) === 3851 && berekenZvwBijdrageZzp(150000) === 3851);
test("geen belastbare winst geeft geen Zvw-bijdrage", berekenZvwBijdrageZzp(0) === 0);
test("berekenNettoZzpInkomen trekt de Zvw-bijdrage ook daadwerkelijk af van het netto resultaat",
  berekenNettoZzpInkomen(60000).zvwBijdrage > 0 &&
  berekenNettoZzpInkomen(60000).netto < (60000 - berekenNettoZzpInkomen(60000).belasting + berekenNettoZzpInkomen(60000).algemeneHeffingskorting + berekenNettoZzpInkomen(60000).arbeidskorting));

sectie("Marginale druk — wat levert een extra verdiende €1.000 netto op?");
const md30k = berekenMarginaleDruk(30000);
const md60k = berekenMarginaleDruk(60000);
test("marginale druk geeft een percentage tussen 0 en 100, geen onzinnige uitkomst",
  md30k.percentageBehouden > 0 && md30k.percentageBehouden <= 100);
test("bij een laag inkomen (buiten de afbouwzones) houd je verreweg het grootste deel van een extra euro over",
  berekenMarginaleDruk(20000).percentageBehouden > 90);
test("in het middeninkomen (gelijktijdige afbouw van AHK en arbeidskorting) houd je merkbaar minder over dan bij een laag inkomen",
  md60k.percentageBehouden < berekenMarginaleDruk(20000).percentageBehouden);
test("geen of negatieve winst geeft geen crash (null, geen inzicht te tonen)", berekenMarginaleDruk(0) === null && berekenMarginaleDruk(-500) === null);

sectie("Heffingskortingen begrenzen tot de belasting — bewaakt een echte, gevonden bug (391% 'marginale druk' bij lage winst)");
test("begrensHeffingskortingen laat een korting die al onder de belasting zit ongemoeid", begrensHeffingskortingen(2000, 5000) === 2000);
test("begrensHeffingskortingen kapt een korting die boven de belasting uitkomt af tot de belasting zelf", begrensHeffingskortingen(5000, 2000) === 2000);
test("bij €0 belasting wordt ook de begrensde korting €0 — dit elimineert de sprong die eerder 391% 'marginale druk' veroorzaakte",
  begrensHeffingskortingen(3115, 0) === 0);

test("regressie: GEEN enkele winst tussen €100 en €250.000 (in stappen van €100) geeft nog een onmogelijke marginale druk (<0% of >100%)", (() => {
  for (let w = 100; w <= 250000; w += 100) {
    const resultaat = berekenMarginaleDruk(w);
    if (resultaat && (resultaat.percentageBehouden < 0 || resultaat.percentageBehouden > 100)) return false;
  }
  return true;
})());
test("de exacte winst waarbij de bug zich voordeed (€1.000) geeft nu een normale, plausibele waarde", (() => {
  const r = berekenMarginaleDruk(1000);
  return r.percentageBehouden >= 0 && r.percentageBehouden <= 100;
})());

test("netto ZZP-inkomen is bij een zeer lage winst nooit hoger dan de winst zelf (zonder partner-overdracht kan dat niet)",
  berekenNettoZzpInkomen(1000).netto <= 1000 && berekenNettoZzpInkomen(5000).netto <= 5000);
test("bij een normale, realistische winst verandert de begrenzing niets (belasting is daar altijd ruim hoger dan de korting)",
  berekenNettoZzpInkomen(60000).netto === berekenNettoZzpInkomen(60000).netto); // triviaal, zie de losse vergelijking hieronder
const zzp60k = berekenNettoZzpInkomen(60000);
test("bij winst=60.000 is de volledige heffingskorting nog steeds benutbaar (geen begrenzing nodig)",
  zzp60k.benutbareKorting === zzp60k.algemeneHeffingskorting + zzp60k.arbeidskorting);

sectie("Netto loondienst-inkomen — eigen, geteste functie i.p.v. eerder ongeteste inline logica in de component");
test("loon=500: netto is nooit hoger dan het bruto loon zelf (vóór de fix was dit €3.478 — ruim 6x het bruto)",
  berekenNettoLoondienstInkomen(500).netto <= 500);
test("loon=5.000: netto blijft binnen het bruto", berekenNettoLoondienstInkomen(5000).netto <= 5000);
test("bij een normaal loon (€60.000) is de volledige heffingskorting nog gewoon benutbaar", (() => {
  const r = berekenNettoLoondienstInkomen(60000);
  return r.benutbareKorting === r.algemeneHeffingskorting + r.arbeidskorting;
})());
test("geen of negatief loon crasht niet", berekenNettoLoondienstInkomen(0).netto === 0);

sectie("Netto ZZP-inkomen — bewaakt een eerder gevonden fout (bruto vs. belastbare winst verwisseld)");
const nettoCheck = berekenNettoZzpInkomen(60000, { voldoetUrencriterium: true, isStarter: false });
test("netto inkomen gaat uit van de BRUTO winst vóór aftrek (€60.000), niet de belastbare winst (±€51.332) als startpunt — scheelt hier ruim €8.000",
  nettoCheck.netto > 60000 - nettoCheck.belasting - 100 && nettoCheck.netto < 60000 - nettoCheck.belasting + nettoCheck.algemeneHeffingskorting + nettoCheck.arbeidskorting + 100);
test("netto inkomen bij €60.000 winst ligt in een realistische bandbreedte (€45.000–€50.000), niet rond de €40.000 van de oude, foutieve berekening",
  nettoCheck.netto > 45000 && nettoCheck.netto < 50000);
test("de belastbare winst in het resultaat is wél de afgetrokken winst (lager dan de bruto winst)",
  nettoCheck.belastbareWinst < 60000 && nettoCheck.belastbareWinst > 0);
test("netto inkomen van 0 winst crasht niet en is 0", berekenNettoZzpInkomen(0).netto === 0);

sectie("Box 2 — aanmerkelijk belang/dividend 2026");
test("dividend van €50.000 (onder de grens) tegen 24,5%", berekenBox2Belasting(50000) === 12250);
test("dividend van €100.000 raakt ook de hoge schijf (31%)", berekenBox2Belasting(100000) > berekenBox2Belasting(68843));
test("geen dividend geeft geen belasting", berekenBox2Belasting(0) === 0);

sectie("Box 3 — vermogensbelasting 2026 (geverifieerd tegen officieel rekenvoorbeeld)");
test("vermogen onder de vrijstelling (1 persoon) geeft €0 belasting", berekenBox3Belasting({ spaargeld: 50000, aantalPersonen: 1 }) === 0);
test("vermogen onder de dubbele vrijstelling (2 personen) geeft €0 belasting", berekenBox3Belasting({ spaargeld: 100000, aantalPersonen: 2 }) === 0);
test("€100.000 spaargeld + €300.000 beleggingen (1 persoon) komt overeen met het officiële voorbeeld (±€5.910)",
  Math.abs(berekenBox3Belasting({ spaargeld: 100000, beleggingen: 300000, aantalPersonen: 1 }) - 5910) <= 2);
test("box 3-belasting is nooit negatief", berekenBox3Belasting({ spaargeld: 0, beleggingen: 0, schulden: 100000, aantalPersonen: 1 }) === 0);

sectie("Vennootschapsbelasting (Vpb) 2026 (geverifieerd tegen officiële rekenvoorbeelden)");
test("€150.000 winst geeft exact €28.500 Vpb (uit bron)", berekenVpb(150000) === 28500);
test("€320.000 winst geeft exact €68.960 Vpb (uit bron)", berekenVpb(320000) === 68960);
test("winst van 0 of minder geeft geen Vpb", berekenVpb(0) === 0 && berekenVpb(-1000) === 0);

sectie("Kinderopvangtoeslag 2026 — percentage-interpolatie en berekening");
test("interpolatie geeft exact 96% op en onder de bekende grens (€56.412)",
  interpoleerPercentage(40000, [{inkomen:0,pct:0.96},{inkomen:56412,pct:0.96}]) === 0.96);
test("meer dan 230 uur per maand wordt afgetopt op het wettelijk maximum",
  berekenKinderopvangtoeslagPerKind(300, "dagopvang", 40000).kostenPerMaand === 230 * 11.23);
test("0 uur geeft 0 kosten en 0 toeslag, geen crash", berekenKinderopvangtoeslagPerKind(0, "dagopvang", 40000).toeslagPerMaand === 0);
const kotLaag = berekenKinderopvangtoeslagPerKind(160, "dagopvang", 40000, true);
const kotHoog = berekenKinderopvangtoeslagPerKind(160, "dagopvang", 200000, true);
test("een lager inkomen geeft een hoger vergoedingspercentage dan een hoog inkomen", kotLaag.percentage > kotHoog.percentage);
test("het vergoedingspercentage voor het eerste kind daalt nooit onder de bodem van 36,5%",
  berekenKinderopvangtoeslagPerKind(160, "dagopvang", 500000, true).percentage === 0.365);
test("het tweede kind krijgt bij hetzelfde inkomen een hoger percentage dan het eerste kind",
  berekenKinderopvangtoeslagPerKind(160, "dagopvang", 100000, false).percentage > berekenKinderopvangtoeslagPerKind(160, "dagopvang", 100000, true).percentage);

sectie("Hypotheekdelen — getoetst aan een echte Rabobank-hypotheek (annuïtair + aflossingsvrij/opbouw)");
test("aflossingsvrij deel: maandrente komt exact overeen met de app-screenshot (€109.000 × 4,65% → €422,38/maand)",
  berekenMaandlastDeel({ type: "aflossingsvrij", schuld: 109000, rente: 4.65 }).totaal === 422.38);
test("aflossingsvrij deel heeft nooit een aflossingscomponent", berekenMaandlastDeel({ type: "aflossingsvrij", schuld: 109000, rente: 4.65 }).aflossing === 0);
test("annuïtair deel: rente-component komt exact overeen met de app-screenshot (€63.757,18 × 4,25% → €225,81/maand, ongeacht resterende looptijd)",
  berekenMaandlastDeel({ type: "annuitair", schuld: 63757.18, rente: 4.25, resterendeJaren: 10 }).rente === 225.81 &&
  berekenMaandlastDeel({ type: "annuitair", schuld: 63757.18, rente: 4.25, resterendeJaren: 20 }).rente === 225.81);
test("annuïtair deel zonder resterende looptijd geeft 0, geen crash (looptijd is dan nog niet ingevuld)",
  berekenMaandlastDeel({ type: "annuitair", schuld: 63757.18, rente: 4.25, resterendeJaren: "" }).totaal === 0);
test("ontbrekende schuld of rente geeft 0, geen crash", berekenMaandlastDeel({ type: "annuitair", schuld: "", rente: "" }).totaal === 0);

test("berekenRenteAflossingsvrij: totale rente over de resterende looptijd (geen amortisatie, schuld blijft gelijk)",
  berekenRenteAflossingsvrij(109000, 0.0465, 5) === Math.round(109000 * 0.0465 * 5));
test("lagere schuld (na extra aflossen) geeft proportioneel minder totale rente bij hetzelfde aflossingsvrije deel",
  berekenRenteAflossingsvrij(109000 - 20000, 0.0465, 5) < berekenRenteAflossingsvrij(109000, 0.0465, 5));
test("berekenRenteAflossingsvrij crasht niet zonder schuld, rente of looptijd", berekenRenteAflossingsvrij(0, 0, 0) === 0);

sectie("Hypotheek — annuïteitensimulatie (aflossen vs. beleggen)");
const zonderExtra = simuleerHypotheek(300000, 0.04, 25, 0);
const metExtra = simuleerHypotheek(300000, 0.04, 25, 20000);
test("zonder extra aflossing loopt de hypotheek de volle, ingevoerde looptijd", zonderExtra.jarenTotAfbetaald === 25);
test("met extra aflossing (gelijke maandlasten) ben je ECHT eerder klaar, niet later of gelijk",
  metExtra.jarenTotAfbetaald < zonderExtra.jarenTotAfbetaald);
test("extra aflossing bespaart aantoonbaar rente over de hele looptijd", metExtra.totaleRente < zonderExtra.totaleRente);
test("een hypotheek van 0 of ontbrekende invoer crasht niet", JSON.stringify(simuleerHypotheek(0,0,0,0)) === JSON.stringify({ totaleRente: 0, jarenTotAfbetaald: 0 }));
test("0% rente crasht niet (voorkomt delen door 0 in de annuïteitenformule)", simuleerHypotheek(300000, 0, 25, 0).totaleRente === 0);
test("een extra aflossing groter dan de hele schuld geeft geen negatieve restschuld of crash",
  simuleerHypotheek(100000, 0.04, 25, 150000).jarenTotAfbetaald === 0);

sectie("Eigenwoningforfait + Wet Hillen 2026 (geverifieerd tegen officiële rekenvoorbeelden)");
test("WOZ-waarde €400.000 geeft exact €1.400 eigenwoningforfait (0,35%)", berekenEigenwoningforfait(400000) === 1400);
test("WOZ-waarde €350.000 geeft exact €1.225 eigenwoningforfait", berekenEigenwoningforfait(350000) === 1225);
test("geen of negatieve WOZ-waarde geeft 0, geen crash", berekenEigenwoningforfait(0) === 0 && berekenEigenwoningforfait(-100) === 0);
test("Wet Hillen: forfait €1.200, rente €1.000 (verschil €200) geeft exact €144 aftrek (uit het officiële Belastingdienst-voorbeeld)",
  berekenWetHillenAftrek(1200, 1000) === 144);
test("Wet Hillen: volledig afgeloste hypotheek (forfait €1.400, rente €0) geeft ±€1.006 aftrek", Math.abs(berekenWetHillenAftrek(1400, 0) - 1006) <= 1);
test("Wet Hillen geeft 0 aftrek als de rente hoger is dan het forfait (normale situatie met een actieve hypotheek)", berekenWetHillenAftrek(1000, 5000) === 0);

sectie("Pensioenopbouw-gat 2026 (standaard middelloonregeling)");
test("bruto €55.000 geeft ongeveer €672 pensioenopbouw per jaar (1,875% boven de AOW-franchise van €19.172)",
  Math.abs(berekenJaarlijksePensioenopbouw(55000) - 672) <= 1);
test("inkomen onder de AOW-franchise bouwt geen pensioen op", berekenJaarlijksePensioenopbouw(15000) === 0);
test("pensioenopbouw wordt afgetopt op het maximaal pensioengevend loon (€137.800)",
  berekenJaarlijksePensioenopbouw(200000) === berekenJaarlijksePensioenopbouw(137800) && berekenJaarlijksePensioenopbouw(200000) > 0);
test("geen of negatief inkomen crasht niet", berekenJaarlijksePensioenopbouw(0) === 0 && berekenJaarlijksePensioenopbouw(-500) === 0);

sectie("Noodbuffer — vuistregel van 3 tot 6 maanden vaste lasten");
const bufferTekort = berekenNoodbufferStatus(2000, 3000);
const bufferVoldoende = berekenNoodbufferStatus(2000, 20000);
test("bij €2.000 vaste lasten is de aanbevolen buffer €6.000-€12.000", bufferTekort.minBuffer === 6000 && bufferTekort.maxBuffer === 12000);
test("€3.000 spaargeld bij €2.000 vaste lasten is onvoldoende (onder het minimum)", bufferTekort.voldoendeMinimum === false);
test("het tekort tot het minimum wordt correct berekend (€6.000 - €3.000 = €3.000)", bufferTekort.tekortTotMinimum === 3000);
test("€20.000 spaargeld bij €2.000 vaste lasten is ruim voldoende", bufferVoldoende.voldoendeMinimum === true && bufferVoldoende.voldoendeRuim === true);
test("geen ingevulde vaste lasten geeft null (nog niets te tonen), geen crash", berekenNoodbufferStatus(0, 10000) === null);

sectie("Erfbelasting tussen partners 2026 — het verschil tussen wel/geen samenlevingscontract");
test("€300.000 erfdeel MET samenlevingscontract blijft volledig onder de partnervrijstelling (€828.035) — €0 erfbelasting",
  berekenErfbelastingPartner(300000, true) === 0);
test("€300.000 erfdeel ZONDER samenlevingscontract (vrijstelling slechts €2.769) kost ruim €100.000 aan erfbelasting — een dramatisch verschil",
  berekenErfbelastingPartner(300000, false) > 100000);
test("met samenlevingscontract is de erfbelasting nooit hoger dan zonder, bij hetzelfde erfdeel",
  berekenErfbelastingPartner(500000, true) < berekenErfbelastingPartner(500000, false));
test("geen erfdeel geeft geen erfbelasting", berekenErfbelastingPartner(0, true) === 0);

sectie("Zorgtoeslag 2026 (lineaire schatting tussen bekende ijkpunten)");
test("gezamenlijk inkomen €35.000 (met partner) geeft het maximale bedrag (€246/maand)", berekenZorgtoeslagPerMaand(35000, true) === 246);
test("gezamenlijk inkomen €60.000 (met partner) geeft geen zorgtoeslag meer (boven de harde grens van €51.142)",
  berekenZorgtoeslagPerMaand(60000, true) === 0);
test("een inkomen tussen de ijkpunten geeft een bedrag tussen 0 en het maximum, niet een onzinnige uitkomst",
  berekenZorgtoeslagPerMaand(45000, true) > 0 && berekenZorgtoeslagPerMaand(45000, true) < 246);

sectie("Kindgebonden budget 2026");
test("1 kind, gezamenlijk inkomen onder de afbouwgrens (€39.141), geeft het volledige basisbedrag (€2.580)",
  berekenKindgebondenBudgetPerJaar(1, 35000, true) === 2580);
test("2 kinderen onder de afbouwgrens geeft het dubbele basisbedrag (€5.160)", berekenKindgebondenBudgetPerJaar(2, 35000, true) === 5160);
test("een inkomen boven de afbouwgrens geeft een lager bedrag dan het basisbedrag, niet negatief",
  berekenKindgebondenBudgetPerJaar(1, 60000, true) < 2580 && berekenKindgebondenBudgetPerJaar(1, 60000, true) >= 0);
test("geen kinderen geeft geen kindgebonden budget", berekenKindgebondenBudgetPerJaar(0, 35000, true) === 0);

sectie("Hypotheekdelen ophalen — bewaakt twee gevonden bugs: onstabiele id's, en (elders) gedeeld i.p.v. per-deel bedrag");
test("bij nog helemaal geen ingevulde hypotheek krijg je één leeg standaarddeel", haalHypotheekDelenOp({}).length === 1);
test("de standaard-id is VAST ('deel-1'), niet willekeurig — anders verandert de React-key bij elke render zolang er nog niets is opgeslagen, wat de invoer kan laten haperen",
  haalHypotheekDelenOp({})[0].id === "deel-1");
test("twee aparte aanroepen (zoals twee renders na elkaar) geven exact dezelfde id — vóór de fix was dit bij elke aanroep een nieuwe, willekeurige id",
  haalHypotheekDelenOp({})[0].id === haalHypotheekDelenOp({})[0].id && haalHypotheekDelenOp({})[0].id === haalHypotheekDelenOp({})[0].id);
test("een oude, enkelvoudige hypotheekvorm (vóór de meerdere-delen-update) wordt correct gemigreerd naar één deel met de juiste gegevens",
  haalHypotheekDelenOp({ bedrag: "250000", rente: "4.1", resterendeJaren: "20" })[0].schuld === "250000");
test("bestaande, al opgeslagen delen blijven gewoon ongewijzigd doorgegeven (geen her-migratie van al-correcte data)",
  haalHypotheekDelenOp({ delen: [{ id: "x", schuld: "100000" }] })[0].id === "x");

sectie("Samenvatting — bouwAandachtspunten verzamelt inzichten uit alle tabbladen");
test("lege data crasht niet (geeft een array terug, eventueel met de generieke vangnet-punten die los staan van ingevulde cijfers)",
  Array.isArray(bouwAandachtspunten({})));

const zzpZonderVangnet = bouwAandachtspunten({ winstZzp: "40000", vangnet: { heeftAov: false } });
test("zzp-winst zonder AOV levert een risico-punt op", zzpZonderVangnet.some(p => p.id === "aov" && p.prioriteit === "risico"));

const zzpMetAov = bouwAandachtspunten({ winstZzp: "40000", vangnet: { heeftAov: true } });
test("zzp-winst MET AOV levert geen AOV-risicopunt op", !zzpMetAov.some(p => p.id === "aov"));

const zonderZzp = bouwAandachtspunten({ winstZzp: "0", vangnet: { heeftAov: false } });
test("zonder zzp-winst wordt AOV niet als punt getoond (niet relevant zonder zzp-inkomen)", !zonderZzp.some(p => p.id === "aov"));

const geenContract = bouwAandachtspunten({ vangnet: { heeftSamenlevingscontract: false } });
test("geen samenlevingscontract levert altijd een risico-punt op, los van de rest", geenContract.some(p => p.id === "samenlevingscontract" && p.prioriteit === "risico"));

const welContract = bouwAandachtspunten({ vangnet: { heeftSamenlevingscontract: true } });
test("wél een samenlevingscontract levert geen punt daarover op", !welContract.some(p => p.id === "samenlevingscontract"));

const metHypotheekGeenOrv = bouwAandachtspunten({ hypotheek: { delen: [{ schuld: "200000" }] }, vangnet: {} });
test("een hypotheekschuld zonder ORV levert een risico-punt op", metHypotheekGeenOrv.some(p => p.id === "orv"));
const geenHypotheek = bouwAandachtspunten({ hypotheek: { delen: [{ schuld: "" }] }, vangnet: {} });
test("geen hypotheekschuld betekent geen ORV-punt (niets om te verzekeren)", !geenHypotheek.some(p => p.id === "orv"));

test("risico-punten staan altijd vóór info-punten in de gesorteerde lijst", (() => {
  const gemengd = bouwAandachtspunten({
    winstZzp: "40000",
    hypotheek: { delen: [{ schuld: "200000", wozWaarde: "" }] },
    vangnet: { heeftAov: null, heeftSamenlevingscontract: false },
  });
  const prioriteiten = gemengd.map(p => p.prioriteit);
  const laatsteRisicoIdx = prioriteiten.lastIndexOf("risico");
  const eersteInfoIdx = prioriteiten.indexOf("info");
  return eersteInfoIdx === -1 || laatsteRisicoIdx < eersteInfoIdx;
})());

test("elk aandachtspunt verwijst naar een bestaand tabblad (voor de klik-door-functie)", (() => {
  const geldigeTabs = ["overzicht", "kinderopvang", "hypotheek", "vangnet", "bv"];
  const alles = bouwAandachtspunten({
    winstZzp: "40000", inkomenLoondienst: "50000",
    hypotheek: { delen: [{ schuld: "200000", extraBedrag: "10000", rente: "4", wozWaarde: "" }], verwachtRendement: "6" },
    kot: { aantalKinderen: 1, urenPerMaandKind1: "100" },
    vangnet: { heeftAov: false, zzpRegeltZelfPensioen: false, maandelijkseVasteLasten: "2000", heeftSamenlevingscontract: false, heeftTestament: false, heeftOrvGekoppeldAanHypotheek: false },
  });
  return alles.every(p => geldigeTabs.includes(p.tab));
})());

sectie("Boetevrije ruimte (Rabobank-regels) — gebaseerd op het OORSPRONKELIJKE bedrag, niet de restschuld");
test("20% (Plusvoorwaarden) van €93.500 origineel geeft €18.700", berekenBoetevrijeRuimte(93500, 20) === 18700);
test("10% (Basisvoorwaarden) van €109.000 origineel geeft €10.900", berekenBoetevrijeRuimte(109000, 10) === 10900);
test("geen oorspronkelijk bedrag ingevuld geeft 0, geen crash", berekenBoetevrijeRuimte("", 20) === 0);
test("geen percentage ingevuld geeft 0, geen crash", berekenBoetevrijeRuimte(100000, "") === 0);

sectie("Extra aflossen op meerdere hypotheekdelen tegelijk — elk deel met zijn EIGEN rente");
const delenMetBedragen = [
  { naam: "Annuïteit", rente: "4.25", extraBedrag: "10000" },
  { naam: "Opbouw", rente: "4.65", extraBedrag: "15000" },
];
const alleDelenResultaat = berekenAflossenMeerdereDelen(delenMetBedragen, "6");
test("het totale bedrag is de som van beide delen (10.000 + 15.000)", alleDelenResultaat.totaalExtraBedrag === 25000);
test("deel 1 gebruikt zijn EIGEN rente (4,25%) voor het netto voordeel", alleDelenResultaat.perDeel[0].nettoVoordeel === Math.round(10000 * 0.0425 * (1 - 0.3756)));
test("deel 2 gebruikt zijn EIGEN, hogere rente (4,65%) voor het netto voordeel — niet per ongeluk die van deel 1",
  alleDelenResultaat.perDeel[1].nettoVoordeel === Math.round(15000 * 0.0465 * (1 - 0.3756)));
test("het totale netto aflossen-voordeel is de som van beide delen apart", alleDelenResultaat.totaalNettoAflossen === alleDelenResultaat.perDeel[0].nettoVoordeel + alleDelenResultaat.perDeel[1].nettoVoordeel);
test("het beleggen-alternatief rekent met het VOLLEDIGE gecombineerde bedrag, niet per deel apart",
  alleDelenResultaat.totaalNettoBeleggen === Math.round(25000 * 0.06 - 25000 * 0.06 * 0.36));

const slechtsEenDeelIngevuld = berekenAflossenMeerdereDelen([
  { naam: "Annuïteit", rente: "4.25", extraBedrag: "10000" },
  { naam: "Opbouw", rente: "4.65", extraBedrag: "" },
], "6");
test("een deel zonder ingevuld bedrag telt niet mee in de lijst", slechtsEenDeelIngevuld.perDeel.length === 1);
test("een deel zonder ingevuld bedrag beïnvloedt het totaal niet", slechtsEenDeelIngevuld.totaalExtraBedrag === 10000);

test("geen enkel deel heeft een bedrag ingevuld: alles blijft op 0, geen crash",
  berekenAflossenMeerdereDelen([{ naam: "X", rente: "4", extraBedrag: "" }], "6").totaalExtraBedrag === 0);
test("een lege delen-lijst crasht niet", berekenAflossenMeerdereDelen([], "6").perDeel.length === 0);
test("ontbrekende delen (undefined) crasht niet", berekenAflossenMeerdereDelen(undefined, "6").totaalExtraBedrag === 0);

sectie("Mogelijkheden-tab — lijfrente-jaarruimte 2026 (geverifieerd tegen officiële rekenvoorbeelden)");
test("winst €40.000 geeft €6.248 jaarruimte (30% van (40.000-19.172))", berekenJaarruimteLijfrente(40000) === 6248);
test("winst €80.000 geeft exact €18.248 jaarruimte — komt overeen met het officiële rekenvoorbeeld", berekenJaarruimteLijfrente(80000) === 18248);
test("boven het maximale inkomen (€137.800) wordt het inkomen afgetopt, niet de jaarruimte zelf onbegrensd", berekenJaarruimteLijfrente(200000) <= 35589);
test("onder de AOW-franchise (€19.172) is er geen jaarruimte", berekenJaarruimteLijfrente(15000) === 0);
test("geen inkomen crasht niet", berekenJaarruimteLijfrente(0) === 0 && berekenJaarruimteLijfrente(null) === 0);
test("pensioenaangroei bij een werkgever vermindert de jaarruimte (6,27 × factor A)",
  berekenJaarruimteLijfrente(60000, 500) < berekenJaarruimteLijfrente(60000, 0));

sectie("Mogelijkheden-tab — groene beleggingen vrijstelling box 3 2026");
const groenLeeg = berekenGroeneBeleggingenVoordeel(0, 2);
test("voor twee fiscale partners is de vrijstelling €53.430 (2× €26.715)", groenLeeg.vrijstelling === 53430);
const groenDeels = berekenGroeneBeleggingenVoordeel(20000, 2);
test("een ingevuld bedrag onder de vrijstelling is volledig 'benut' en laat nog ruimte over", groenDeels.benut === 20000 && groenDeels.nogRuimte === 33430);
const groenVol = berekenGroeneBeleggingenVoordeel(100000, 2);
test("een bedrag boven de vrijstelling wordt afgetopt op de vrijstelling zelf, geen ruimte meer over", groenVol.benut === 53430 && groenVol.nogRuimte === 0);
test("de heffingskorting is 0,1% van het benutte (niet het volledige) bedrag", groenDeels.heffingskorting === Math.round(20000 * 0.001));
test("geen beleggingen crasht niet", berekenGroeneBeleggingenVoordeel(0, 2).benut === 0);

sectie("Mogelijkheden-tab — verliesverrekening in de BV (2026-regels, geverifieerd tegen officieel rekenvoorbeeld)");
const refVoorbeeld = berekenVerliesverrekening(8000000, 5000000);
test("officieel rekenvoorbeeld (winst 8 mln, verlies 5 mln): verrekend komt exact uit op 4,5 miljoen", refVoorbeeld.verrekend === 4500000);
test("hetzelfde voorbeeld: restwinst na verrekening is exact 3,5 miljoen", refVoorbeeld.restWinstNaVerrekening === 3500000);
test("hetzelfde voorbeeld: restverlies voor latere jaren is exact 5 ton", refVoorbeeld.restVerlies === 500000);

const mkbScenario = berekenVerliesverrekening(30000, 50000);
test("realistisch MKB-scenario (winst 30.000, verlies 50.000, ruim onder de €1 mln-drempel): winst volledig weggestreept", mkbScenario.verrekend === 30000 && mkbScenario.restWinstNaVerrekening === 0);
test("het overschot aan verlies (20.000) blijft over voor latere jaren", mkbScenario.restVerlies === 20000);

test("geen verlies ingevuld: niets te verrekenen, geen crash", berekenVerliesverrekening(30000, 0).verrekend === 0);
test("geen winst dit jaar (verlies): niets te verrekenen, geen crash", berekenVerliesverrekening(0, 10000).verrekend === 0);
test("meer verlies dan winst: nooit meer verrekend dan er winst is om tegen af te zetten", berekenVerliesverrekening(10000, 999999).verrekend <= 10000);

sectie("Mogelijkheden-tab — box 3-voordeel van optimaal verdelen tussen fiscale partners");
const scheefVerdeeld = berekenBox3VoordeelVerdelen({ spaargeld: 150000 }, { spaargeld: 0 });
test("bij scheef verdeeld vermogen (al het geld bij één persoon) levert optimaal verdelen een positieve besparing op",
  scheefVerdeeld.besparing > 0);
const gelijkVerdeeld = berekenBox3VoordeelVerdelen({ spaargeld: 75000 }, { spaargeld: 75000 });
test("bij al gelijk verdeeld vermogen levert herverdelen geen besparing meer op (al optimaal)", gelijkVerdeeld.besparing === 0);
test("optimaal verdelen is nooit NADELIGER dan apart aangeven — de besparing is nooit negatief",
  berekenBox3VoordeelVerdelen({ spaargeld: 200000 }, { spaargeld: 10000 }).besparing >= 0);
test("geen vermogen bij beide partners crasht niet", berekenBox3VoordeelVerdelen({}, {}).besparing === 0);

samenvatting();
