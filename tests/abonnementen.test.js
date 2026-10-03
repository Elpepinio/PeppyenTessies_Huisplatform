const path = require("path");
const { laadFuncties } = require("./extractie");
const { sectie, test, samenvatting } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "pages", "abonnementen.js");

const {
  categorieInfo, frequentieLabel, VEELVOORKOMENDE_ABONNEMENTEN, BETAALD_DOOR_OPTIES,
  berekenMaandbedrag, berekenJaarbedrag,
  berekenLaatsteOpzegmoment, berekenDagenTot,
  berekenTotalenPerPersoon, berekenTotalenPerCategorie, groepeerPerCategorie,
} = laadFuncties(BESTAND, [
  /const CATEGORIEEN = /,
  /function categorieInfo\(id\)/,
  /const VEELVOORKOMENDE_ABONNEMENTEN = /,
  /const FREQUENTIES = /,
  /const BETAALD_DOOR_OPTIES = /,
  /function frequentieLabel\(id\)/,
  /function berekenMaandbedrag\(bedrag, frequentie\)/,
  /function berekenJaarbedrag\(bedrag, frequentie\)/,
  /function berekenLaatsteOpzegmoment\(volgendeVerlengdatum, opzegtermijnDagen\)/,
  /function berekenDagenTot\(datum, vandaag = new Date\(\)\)/,
  /function berekenTotalenPerPersoon\(abonnementen\)/,
  /function berekenTotalenPerCategorie\(abonnementen\)/,
  /function groepeerPerCategorie\(abonnementen\)/,
]);

sectie("Abonnementen — categorieën en frequenties");
test("categorieInfo herkent 'hypotheek' met het juiste label en icoon", categorieInfo("hypotheek").label === "Hypotheek" && categorieInfo("hypotheek").icon === "🏠");
test("categorieInfo herkent 'sport_hobby'", categorieInfo("sport_hobby").label === "Sport & hobby");
test("categorieInfo herkent de nieuwe categorie 'entertainment' (Netflix, HBO, krant e.d.)", categorieInfo("entertainment").label === "Entertainment & media" && categorieInfo("entertainment").icon === "🎬");
test("een onbekende categorie valt netjes terug op 'Overig' — nu via id gezocht, niet via een vaste index die zou breken bij het toevoegen van een categorie",
  categorieInfo("onzin").label === "Overig");
test("frequentieLabel geeft het juiste Nederlandse label", frequentieLabel("per_kwartaal") === "Per kwartaal");

sectie("Maand-/jaarbedrag — normaliseren ongeacht betaalfrequentie");
test("€120 jaarlijks is €10 per maand", berekenMaandbedrag(120, "jaarlijks") === 10);
test("€30 per kwartaal is €10 per maand", berekenMaandbedrag(30, "per_kwartaal") === 10);
test("€50 maandelijks blijft €50 per maand", berekenMaandbedrag(50, "maandelijks") === 50);
test("een eenmalige kost telt NIET mee in het structurele maandbedrag", berekenMaandbedrag(500, "eenmalig") === 0);
test("€10 per maand is €120 per jaar", berekenJaarbedrag(10, "maandelijks") === 120);
test("€30 per kwartaal is €120 per jaar", berekenJaarbedrag(30, "per_kwartaal") === 120);
test("een eenmalige kost telt WEL mee in het jaartotaal", berekenJaarbedrag(500, "eenmalig") === 500);
test("geen of ontbrekend bedrag geeft 0, geen crash", berekenMaandbedrag(null, "maandelijks") === 0 && berekenJaarbedrag(undefined, "jaarlijks") === 0);

sectie("Opzegmoment — de daadwerkelijk relevante datum, niet de verlengdatum zelf");
const opzegmoment = berekenLaatsteOpzegmoment("2026-03-01", 30);
test("verlengdatum 1 maart met 30 dagen opzegtermijn geeft 30 januari als laatste opzegmoment",
  opzegmoment.toISOString().slice(0, 10) === "2026-01-30");
test("15 januari ligt 15 dagen vóór dat opzegmoment", berekenDagenTot(opzegmoment, new Date("2026-01-15")) === 15);
test("geen verlengdatum ingevuld geeft null, geen crash", berekenLaatsteOpzegmoment(null, 30) === null);
test("geen opzegtermijn ingevuld geeft null, geen crash", berekenLaatsteOpzegmoment("2026-03-01", null) === null);
test("berekenDagenTot zonder datum geeft null, geen crash", berekenDagenTot(null) === null);
test("een opzegmoment in het verleden geeft een negatief aantal dagen (te laat)",
  berekenDagenTot(new Date("2026-01-01"), new Date("2026-01-10")) < 0);

sectie("Totalen per persoon en groepering per categorie");
const voorbeeldAbonnementen = [
  { naam: "ANWB", categorie: "overig", bedrag: 90, frequentie: "jaarlijks", betaaldDoor: "Pepijn", actief: true },
  { naam: "Voetbal kind", categorie: "sport_hobby", bedrag: 20, frequentie: "maandelijks", betaaldDoor: "Pepijn", actief: true },
  { naam: "Yoga", categorie: "sport_hobby", bedrag: 45, frequentie: "maandelijks", betaaldDoor: "Tessa", actief: true },
  { naam: "Oude sportschool", categorie: "sport_hobby", bedrag: 30, frequentie: "maandelijks", betaaldDoor: "Tessa", actief: false },
];
const perPersoon = berekenTotalenPerPersoon(voorbeeldAbonnementen);
test("totalen per persoon tellen alleen actieve abonnementen mee", Math.abs(perPersoon["Tessa"] - 45) < 0.01);
test("Pepijn's totaal is ANWB (€90/jaar = €7,50/maand) plus voetbal (€20/maand) = €27,50",
  Math.abs(perPersoon["Pepijn"] - 27.5) < 0.01);
test("een inactief abonnement (oude sportschool) telt niet mee in Tessa's totaal", Math.abs(perPersoon["Tessa"] - 30) > 0.01);

const groepen = groepeerPerCategorie(voorbeeldAbonnementen);
test("groeperen zet elk abonnement in de juiste categorie", groepen.sport_hobby.length === 3 && groepen.overig.length === 1);
test("een categorie zonder abonnementen bestaat als lege lijst, geen undefined", Array.isArray(groepen.hypotheek) && groepen.hypotheek.length === 0);
test("groeperen op een lege lijst crasht niet", Object.keys(groepeerPerCategorie([])).length === 5);

sectie("Snelkeuzelijst — kanAltijdOpzeggen alleen bij diensten die dat ook echt standaard zijn");
const vindOptie = (categorie, naam) => VEELVOORKOMENDE_ABONNEMENTEN[categorie].find(o => o.naam === naam);
test("Netflix staat gemarkeerd als altijd opzegbaar", vindOptie("entertainment", "Netflix").kanAltijdOpzeggen === true);
test("Spotify staat gemarkeerd als altijd opzegbaar", vindOptie("entertainment", "Spotify").kanAltijdOpzeggen === true);
test("Dagblad/krant staat NIET gemarkeerd als altijd opzegbaar — looptijd/opzegtermijn verschilt sterk per abonnement",
  !vindOptie("entertainment", "Dagblad/krant").kanAltijdOpzeggen);
test("Sportschool staat NIET gemarkeerd als altijd opzegbaar — gymlidmaatschappen hebben vaak een minimumtermijn",
  !vindOptie("sport_hobby", "Sportschool").kanAltijdOpzeggen);
test("ANWB staat NIET gemarkeerd als altijd opzegbaar — kent een jaarlijks lidmaatschap met opzegtermijn",
  !vindOptie("overig", "ANWB").kanAltijdOpzeggen);
test("Internet staat NIET gemarkeerd als altijd opzegbaar — internetabonnementen hebben doorgaans een vaste looptijd",
  !vindOptie("overig", "Internet").kanAltijdOpzeggen);

sectie("Kosten per categorie — zodat hypotheek/verzekeringen niet onzichtbaar opgaan in het totaal met Netflix e.d.");
const gemengdeAbonnementen = [
  { naam: "Hypotheek", categorie: "hypotheek", bedrag: 1200, frequentie: "maandelijks", actief: true },
  { naam: "Netflix", categorie: "entertainment", bedrag: 12.99, frequentie: "maandelijks", actief: true },
  { naam: "HBO Max", categorie: "entertainment", bedrag: 90, frequentie: "jaarlijks", actief: true },
  { naam: "Oude krant", categorie: "entertainment", bedrag: 20, frequentie: "maandelijks", actief: false },
];
const perCat = berekenTotalenPerCategorie(gemengdeAbonnementen);
test("de hypotheek-categorie staat volledig los van entertainment (geen vermenging)", Math.abs(perCat.hypotheek.maand - 1200) < 0.01);
test("entertainment telt Netflix (maandelijks) en HBO Max (jaarlijks, omgerekend) correct bij elkaar op",
  Math.abs(perCat.entertainment.maand - (12.99 + 90/12)) < 0.01);
test("een inactief abonnement (oude krant) telt niet mee in het categorietotaal", Math.abs(perCat.entertainment.maand - (12.99 + 90/12)) < 0.01);
test("een categorie zonder enig abonnement bestaat met 0, geen undefined (bv. sport_hobby hier)", perCat.sport_hobby.maand === 0 && perCat.sport_hobby.jaar === 0);
test("jaartotaal van de hypotheek-categorie klopt (1200 × 12)", Math.abs(perCat.hypotheek.jaar - 14400) < 0.01);
test("een lege lijst crasht niet en geeft overal 0", berekenTotalenPerCategorie([]).overig.maand === 0);

sectie("Wie betaalt — vaste keuzelijst i.p.v. vrije tekst");
test("er zijn precies de 3 verwachte opties", BETAALD_DOOR_OPTIES.length === 3);
test("Pepijn, Tessa en Gezamenlijke rekening staan er alle drie in",
  ["Pepijn", "Tessa", "Gezamenlijke rekening"].every(naam => BETAALD_DOOR_OPTIES.includes(naam)));

samenvatting();
