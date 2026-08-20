import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Plus, Check, CheckCheck, X, ChevronLeft, RotateCcw, Star, Sparkles, Pencil, Trash2, Eye, EyeOff, History, Settings, Gift, MoreHorizontal } from "lucide-react";

// ---- Constanten ----
const UNITS = ["stuks", "g", "kg", "ml", "l", "pak"];

const LIJST_ICONEN = ["🛒","✈️","🏖️","🏕️","🎿","🏠","🔧","🎉","📦","📋","🌍","🚗","🚐","🏨","🎒","💊","📚","🍽️","🧹","💡","🎁","🎄","🎅"];

const CADEAU_STATUSSEN = ["Idee", "Gekocht", "Ingepakt", "Gegeven"];

const STANDAARD_CATEGORIEEN = [
  { id: "cat_1", label: "Categorie 1", icon: "📌" },
  { id: "cat_2", label: "Categorie 2", icon: "📌" },
];

const VAKANTIE_CATEGORIEEN = [
  { id: "kleding",     label: "Kleding",      icon: "👕" },
  { id: "toilettas",   label: "Toilettas",    icon: "🧴" },
  { id: "documenten",  label: "Documenten",   icon: "📄" },
  { id: "elektronica", label: "Elektronica",  icon: "🔌" },
  { id: "medicijnen",  label: "Medicijnen",   icon: "💊" },
  { id: "overig",      label: "Overig",       icon: "📦" },
];

const LIJST_SJABLONEN = [
  { naam: "Vakantie paklijst", icon: "✈️", categorieen: VAKANTIE_CATEGORIEEN },
  { naam: "Boodschappen", icon: "🛒", categorieen: [
    { id: "groentekraam",   label: "Groentekraam",    icon: "🥦" },
    { id: "kaaskraam",      label: "Kaaskraam",        icon: "🧀" },
    { id: "viskraam",       label: "Viskraam",         icon: "🐟" },
    { id: "bloemenkraam",   label: "Bloemenkraam",     icon: "💐" },
    { id: "zuivel_eieren",  label: "Zuivel & Eieren",  icon: "🥛" },
    { id: "vlees_vis",      label: "Vlees & Vis",      icon: "🥩" },
    { id: "brood_bakkerij", label: "Brood & Bakkerij", icon: "🥐" },
    { id: "houdbaar",       label: "Houdbaar",         icon: "🥫" },
    { id: "diepvries",      label: "Diepvries",        icon: "🧊" },
    { id: "drogisterij",    label: "Drogisterij",      icon: "🧴" },
    { id: "huishouden",     label: "Huishouden",       icon: "🧽" },
    { id: "dranken",        label: "Dranken",          icon: "🧃" },
    { id: "overig",         label: "Overig",           icon: "🛒" },
  ]},
  { naam: "Cadeaulijst", icon: "🎁", type: "cadeau", categorieen: [
    { id: "pepijn",   label: "Pepijn",   icon: "👤" },
    { id: "tessa",    label: "Tessa",    icon: "👤" },
    { id: "familie",  label: "Familie",  icon: "👨‍👩‍👧" },
    { id: "vrienden", label: "Vrienden", icon: "👫" },
    { id: "overig",   label: "Overig",   icon: "🎁" },
  ], items: [
    { cat: "pepijn",   name: "Cadeau idee 1", amount: 1, unit: "stuks", status: "Idee", budget: "" },
    { cat: "tessa",    name: "Cadeau idee 1", amount: 1, unit: "stuks", status: "Idee", budget: "" },
  ]},
  { naam: "Klussenlijst", icon: "🔧", categorieen: [
    { id: "binnen", label: "Binnen", icon: "🏠" },
    { id: "buiten", label: "Buiten", icon: "🌳" },
    { id: "kopen",  label: "Nog kopen", icon: "🛒" },
    { id: "overig", label: "Overig",    icon: "📦" },
  ]},
  { naam: "Wintersport", icon: "🎿", categorieen: [
    { id: "kleding",     label: "Kleding",      icon: "🧥" },
    { id: "uitrusting",  label: "Uitrusting",   icon: "🎿" },
    { id: "bescherming", label: "Bescherming",  icon: "⛑️" },
    { id: "toilettas",   label: "Toilettas",    icon: "🧴" },
    { id: "documenten",  label: "Documenten",   icon: "📄" },
    { id: "elektronica", label: "Elektronica",  icon: "🔌" },
    { id: "overig",      label: "Overig",       icon: "📦" },
  ], items: [
    { cat: "kleding",     name: "Skibroek",                amount: 1, unit: "stuks" },
    { cat: "kleding",     name: "Ski-jas",                 amount: 1, unit: "stuks" },
    { cat: "kleding",     name: "Thermobroek",             amount: 2, unit: "stuks" },
    { cat: "kleding",     name: "Thermoshirt",             amount: 2, unit: "stuks" },
    { cat: "kleding",     name: "Fleece trui",             amount: 1, unit: "stuks" },
    { cat: "kleding",     name: "Skisokken",               amount: 4, unit: "stuks" },
    { cat: "kleding",     name: "Handschoenen",            amount: 2, unit: "stuks" },
    { cat: "kleding",     name: "Muts",                    amount: 1, unit: "stuks" },
    { cat: "kleding",     name: "Sjaal / nekwarmer",       amount: 1, unit: "stuks" },
    { cat: "kleding",     name: "Après-ski laarzen",       amount: 1, unit: "stuks" },
    { cat: "kleding",     name: "Ondergoed",               amount: 5, unit: "stuks" },
    { cat: "uitrusting",  name: "Skischoenen",             amount: 1, unit: "stuks" },
    { cat: "uitrusting",  name: "Ski's of snowboard",      amount: 1, unit: "stuks" },
    { cat: "uitrusting",  name: "Skistokken",              amount: 1, unit: "stuks" },
    { cat: "uitrusting",  name: "Skipas",                  amount: 1, unit: "stuks" },
    { cat: "bescherming", name: "Skihelm",                 amount: 1, unit: "stuks" },
    { cat: "bescherming", name: "Skibril",                 amount: 1, unit: "stuks" },
    { cat: "bescherming", name: "Rugprotector",            amount: 1, unit: "stuks" },
    { cat: "bescherming", name: "Zonnebrand factor 50",    amount: 1, unit: "stuks" },
    { cat: "bescherming", name: "Lippenbalsem",            amount: 1, unit: "stuks" },
    { cat: "toilettas",   name: "Tandenborstel",           amount: 1, unit: "stuks" },
    { cat: "toilettas",   name: "Tandpasta",               amount: 1, unit: "stuks" },
    { cat: "toilettas",   name: "Shampoo",                 amount: 1, unit: "stuks" },
    { cat: "toilettas",   name: "Douchegel",               amount: 1, unit: "stuks" },
    { cat: "toilettas",   name: "Deodorant",               amount: 1, unit: "stuks" },
    { cat: "toilettas",   name: "Ibuprofen / pijnstillers",amount: 1, unit: "stuks" },
    { cat: "documenten",  name: "Paspoort / ID",           amount: 1, unit: "stuks" },
    { cat: "documenten",  name: "Reisverzekeringspas",     amount: 1, unit: "stuks" },
    { cat: "documenten",  name: "Rijbewijs",               amount: 1, unit: "stuks" },
    { cat: "elektronica", name: "Telefoon + oplader",      amount: 1, unit: "stuks" },
    { cat: "elektronica", name: "Powerbank",               amount: 1, unit: "stuks" },
    { cat: "elektronica", name: "Adapter / stekker",       amount: 1, unit: "stuks" },
    { cat: "overig",      name: "Rugzak dagtas",           amount: 1, unit: "stuks" },
    { cat: "overig",      name: "Waterfles",               amount: 1, unit: "stuks" },
    { cat: "overig",      name: "Snacks voor onderweg",    amount: 1, unit: "stuks" },
  ]},
  { naam: "Zomervakantie", icon: "🏖️", categorieen: [
    { id: "kleding",     label: "Kleding",       icon: "👕" },
    { id: "strand",      label: "Strand & zwem", icon: "🏊" },
    { id: "toilettas",   label: "Toilettas",     icon: "🧴" },
    { id: "documenten",  label: "Documenten",    icon: "📄" },
    { id: "elektronica", label: "Elektronica",   icon: "🔌" },
    { id: "gezondheid",  label: "Gezondheid",    icon: "💊" },
    { id: "overig",      label: "Overig",        icon: "📦" },
  ], items: [
    { cat: "kleding",    name: "T-shirts",                   amount: 5, unit: "stuks" },
    { cat: "kleding",    name: "Shorts",                     amount: 3, unit: "stuks" },
    { cat: "kleding",    name: "Avondkleding",               amount: 2, unit: "stuks" },
    { cat: "kleding",    name: "Ondergoed",                  amount: 7, unit: "stuks" },
    { cat: "kleding",    name: "Sweater / vest (avond)",     amount: 1, unit: "stuks" },
    { cat: "kleding",    name: "Sandalen",                   amount: 1, unit: "stuks" },
    { cat: "kleding",    name: "Sneakers",                   amount: 1, unit: "stuks" },
    { cat: "kleding",    name: "Zonnehoed / pet",            amount: 1, unit: "stuks" },
    { cat: "kleding",    name: "Zonnebril",                  amount: 1, unit: "stuks" },
    { cat: "strand",     name: "Zwembroek / bikini",         amount: 2, unit: "stuks" },
    { cat: "strand",     name: "Strandlaken",                amount: 2, unit: "stuks" },
    { cat: "strand",     name: "Slippers",                   amount: 1, unit: "stuks" },
    { cat: "strand",     name: "Zonnebrand SPF 50",          amount: 1, unit: "stuks" },
    { cat: "strand",     name: "After sun",                  amount: 1, unit: "stuks" },
    { cat: "strand",     name: "Strandtas",                  amount: 1, unit: "stuks" },
    { cat: "toilettas",  name: "Tandenborstel",              amount: 1, unit: "stuks" },
    { cat: "toilettas",  name: "Tandpasta",                  amount: 1, unit: "stuks" },
    { cat: "toilettas",  name: "Shampoo",                    amount: 1, unit: "stuks" },
    { cat: "toilettas",  name: "Douchegel",                  amount: 1, unit: "stuks" },
    { cat: "toilettas",  name: "Deodorant",                  amount: 1, unit: "stuks" },
    { cat: "documenten", name: "Paspoort / ID",              amount: 1, unit: "stuks" },
    { cat: "documenten", name: "Reisverzekeringspas",        amount: 1, unit: "stuks" },
    { cat: "documenten", name: "Vliegtickets / boarding pass",amount: 1, unit: "stuks" },
    { cat: "documenten", name: "Hotelreservering",           amount: 1, unit: "stuks" },
    { cat: "elektronica",name: "Telefoon + oplader",         amount: 1, unit: "stuks" },
    { cat: "elektronica",name: "Powerbank",                  amount: 1, unit: "stuks" },
    { cat: "elektronica",name: "Camera + geheugenkaart",     amount: 1, unit: "stuks" },
    { cat: "elektronica",name: "Adapter / stekker",          amount: 1, unit: "stuks" },
    { cat: "gezondheid", name: "Ibuprofen / pijnstillers",   amount: 1, unit: "stuks" },
    { cat: "gezondheid", name: "Muggenspray",                amount: 1, unit: "stuks" },
    { cat: "gezondheid", name: "Pleisters",                  amount: 1, unit: "stuks" },
    { cat: "overig",     name: "Koffer / rugzak",            amount: 1, unit: "stuks" },
    { cat: "overig",     name: "Handbagage tas",             amount: 1, unit: "stuks" },
    { cat: "overig",     name: "Nekkussen (vliegtuig)",      amount: 1, unit: "stuks" },
    { cat: "overig",     name: "Waterfles",                  amount: 1, unit: "stuks" },
  ]},
  { naam: "Camper vakantie", icon: "🚐", categorieen: [
    { id: "kleding",     label: "Kleding",          icon: "👕" },
    { id: "keuken",      label: "Keuken & eten",    icon: "🍳" },
    { id: "camper",      label: "Camper & buiten",  icon: "🏕️" },
    { id: "toilettas",   label: "Toilettas",        icon: "🧴" },
    { id: "documenten",  label: "Documenten",       icon: "📄" },
    { id: "elektronica", label: "Elektronica",      icon: "🔌" },
    { id: "overig",      label: "Overig",           icon: "📦" },
  ], items: [
    // Kleding
    { cat: "kleding", name: "T-shirts",               amount: 5, unit: "stuks" },
    { cat: "kleding", name: "Shorts / broeken",       amount: 3, unit: "stuks" },
    { cat: "kleding", name: "Ondergoed",              amount: 7, unit: "stuks" },
    { cat: "kleding", name: "Sokken",                 amount: 6, unit: "stuks" },
    { cat: "kleding", name: "Trui / fleece",          amount: 2, unit: "stuks" },
    { cat: "kleding", name: "Regenjas",               amount: 1, unit: "stuks" },
    { cat: "kleding", name: "Wandelschoenen",         amount: 1, unit: "stuks" },
    { cat: "kleding", name: "Slippers",               amount: 1, unit: "stuks" },
    { cat: "kleding", name: "Pet / zonnehoed",        amount: 1, unit: "stuks" },
    { cat: "kleding", name: "Badpak / zwembroek",     amount: 2, unit: "stuks" },
    { cat: "kleding", name: "Pyjama",                 amount: 2, unit: "stuks" },
    // Keuken & eten
    { cat: "keuken", name: "Koekenpan",               amount: 1, unit: "stuks" },
    { cat: "keuken", name: "Snijplank",               amount: 1, unit: "stuks" },
    { cat: "keuken", name: "Messen",                  amount: 1, unit: "stuks" },
    { cat: "keuken", name: "Borden & bestek",         amount: 1, unit: "stuks" },
    { cat: "keuken", name: "Mokken / glazen",         amount: 1, unit: "stuks" },
    { cat: "keuken", name: "Olijfolie",               amount: 1, unit: "stuks" },
    { cat: "keuken", name: "Zout & peper",            amount: 1, unit: "stuks" },
    { cat: "keuken", name: "Theedoeken",              amount: 3, unit: "stuks" },
    { cat: "keuken", name: "Afwasmiddel",             amount: 1, unit: "stuks" },
    { cat: "keuken", name: "Koffie / thee",           amount: 1, unit: "stuks" },
    { cat: "keuken", name: "Brood & beleg",           amount: 1, unit: "stuks" },
    { cat: "keuken", name: "Snacks voor onderweg",    amount: 1, unit: "stuks" },
    { cat: "keuken", name: "Koelbox extra eten",      amount: 1, unit: "stuks" },
    // Camper & buiten
    { cat: "camper", name: "Stoelen & tafel",         amount: 1, unit: "stuks" },
    { cat: "camper", name: "Luifel / zonnescherm",   amount: 1, unit: "stuks" },
    { cat: "camper", name: "Buitenkleed",             amount: 1, unit: "stuks" },
    { cat: "camper", name: "BBQ / campinggrill",      amount: 1, unit: "stuks" },
    { cat: "camper", name: "Aanmaakblokjes",          amount: 1, unit: "stuks" },
    { cat: "camper", name: "Gas navulling",           amount: 1, unit: "stuks" },
    { cat: "camper", name: "Water jerrycan",          amount: 1, unit: "stuks" },
    { cat: "camper", name: "Zaklamp / hoofdlamp",    amount: 1, unit: "stuks" },
    { cat: "camper", name: "Touw / waslijntje",       amount: 1, unit: "stuks" },
    { cat: "camper", name: "Vuilniszakken",           amount: 1, unit: "stuks" },
    { cat: "camper", name: "Muggenspray",             amount: 1, unit: "stuks" },
    { cat: "camper", name: "Zonnebrand",              amount: 1, unit: "stuks" },
    { cat: "camper", name: "Handtassen / strandtassen",amount: 1, unit: "stuks" },
    // Toilettas
    { cat: "toilettas", name: "Tandenborstel",        amount: 1, unit: "stuks" },
    { cat: "toilettas", name: "Tandpasta",            amount: 1, unit: "stuks" },
    { cat: "toilettas", name: "Shampoo",              amount: 1, unit: "stuks" },
    { cat: "toilettas", name: "Douchegel",            amount: 1, unit: "stuks" },
    { cat: "toilettas", name: "Deodorant",            amount: 1, unit: "stuks" },
    { cat: "toilettas", name: "Toiletpapier",         amount: 2, unit: "pak" },
    { cat: "toilettas", name: "Ibuprofen / paracetamol",amount: 1, unit: "stuks" },
    { cat: "toilettas", name: "Pleisters",            amount: 1, unit: "stuks" },
    // Documenten
    { cat: "documenten", name: "Rijbewijs",           amount: 1, unit: "stuks" },
    { cat: "documenten", name: "Paspoort / ID",       amount: 1, unit: "stuks" },
    { cat: "documenten", name: "Kentekenbewijs camper",amount: 1, unit: "stuks" },
    { cat: "documenten", name: "Verzekeringspapieren",amount: 1, unit: "stuks" },
    { cat: "documenten", name: "Campingpas / ACSI",  amount: 1, unit: "stuks" },
    { cat: "documenten", name: "Reserveringsbevestiging",amount: 1, unit: "stuks" },
    // Elektronica
    { cat: "elektronica", name: "Telefoon + oplader", amount: 1, unit: "stuks" },
    { cat: "elektronica", name: "Powerbank",          amount: 1, unit: "stuks" },
    { cat: "elektronica", name: "Verlengsnoer / adapter",amount: 1, unit: "stuks" },
    { cat: "elektronica", name: "Navigatie / GPS",   amount: 1, unit: "stuks" },
    { cat: "elektronica", name: "Camera",             amount: 1, unit: "stuks" },
    // Overig
    { cat: "overig", name: "Boeken / spelletjes",    amount: 1, unit: "stuks" },
    { cat: "overig", name: "Kaarten / reisgids",     amount: 1, unit: "stuks" },
    { cat: "overig", name: "EHBO-doos",              amount: 1, unit: "stuks" },
    { cat: "overig", name: "Brandstof tanken",       amount: 1, unit: "stuks" },
  ]},
  { naam: "Weekendje weg", icon: "🏨", categorieen: [
    { id: "kleding",    label: "Kleding",      icon: "👕" },
    { id: "toilettas",  label: "Toilettas",    icon: "🧴" },
    { id: "documenten", label: "Documenten",   icon: "📄" },
    { id: "elektronica",label: "Elektronica",  icon: "🔌" },
    { id: "overig",     label: "Overig",       icon: "📦" },
  ], items: [
    // Kleding — compact, 2 nachten
    { cat: "kleding", name: "T-shirts",               amount: 2, unit: "stuks" },
    { cat: "kleding", name: "Broek / rok",            amount: 1, unit: "stuks" },
    { cat: "kleding", name: "Ondergoed",              amount: 3, unit: "stuks" },
    { cat: "kleding", name: "Sokken",                 amount: 3, unit: "stuks" },
    { cat: "kleding", name: "Avondkleding",           amount: 1, unit: "stuks" },
    { cat: "kleding", name: "Trui / vest",            amount: 1, unit: "stuks" },
    { cat: "kleding", name: "Schoenen extra paar",   amount: 1, unit: "stuks" },
    { cat: "kleding", name: "Pyjama",                 amount: 1, unit: "stuks" },
    // Toilettas — klein formaat
    { cat: "toilettas", name: "Tandenborstel",        amount: 1, unit: "stuks" },
    { cat: "toilettas", name: "Tandpasta",            amount: 1, unit: "stuks" },
    { cat: "toilettas", name: "Deodorant",            amount: 1, unit: "stuks" },
    { cat: "toilettas", name: "Shampoo (reisformaat)",amount: 1, unit: "stuks" },
    { cat: "toilettas", name: "Douchegel",            amount: 1, unit: "stuks" },
    { cat: "toilettas", name: "Make-up essentials",  amount: 1, unit: "stuks" },
    { cat: "toilettas", name: "Paracetamol",          amount: 1, unit: "stuks" },
    // Documenten
    { cat: "documenten", name: "ID / paspoort",       amount: 1, unit: "stuks" },
    { cat: "documenten", name: "Hotelbevestiging",    amount: 1, unit: "stuks" },
    { cat: "documenten", name: "Rijbewijs",           amount: 1, unit: "stuks" },
    // Elektronica
    { cat: "elektronica", name: "Telefoon + oplader", amount: 1, unit: "stuks" },
    { cat: "elektronica", name: "Powerbank",          amount: 1, unit: "stuks" },
    { cat: "elektronica", name: "Oordopjes",          amount: 1, unit: "stuks" },
    // Overig
    { cat: "overig", name: "Tas / weekend bag",       amount: 1, unit: "stuks" },
    { cat: "overig", name: "Zonnebril",               amount: 1, unit: "stuks" },
    { cat: "overig", name: "Boek / e-reader",         amount: 1, unit: "stuks" },
    { cat: "overig", name: "Contant geld",            amount: 1, unit: "stuks" },
  ]},
  { naam: "Lege lijst", icon: "📋", categorieen: STANDAARD_CATEGORIEEN },
];

// ---- Helpers ----
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Tijdzone-veilige datumfuncties — nooit toISOString() gebruiken (die schuift
// een dag op rond middernacht, afhankelijk van tijdzone).
function vandaagStr() {
  const nu = new Date();
  return `${nu.getFullYear()}-${String(nu.getMonth()+1).padStart(2,"0")}-${String(nu.getDate()).padStart(2,"0")}`;
}
function datumNaarStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function isVerlopen(datumStr) {
  return !!datumStr && datumStr < vandaagStr();
}
function formatVervaldatum(datumStr) {
  if (!datumStr) return "";
  const [j, m, d] = datumStr.split("-").map(Number);
  const datum = new Date(j, m - 1, d);
  if (datumStr === vandaagStr()) return "Vandaag";
  const morgen = new Date(); morgen.setDate(morgen.getDate() + 1);
  if (datumStr === datumNaarStr(morgen)) return "Morgen";
  return datum.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
// Berekent de volgende vervaldatum voor een herhalende taak, uitgaande van
// de HUIDIGE vervaldatum (of vandaag, als er nog geen was) — niet vanaf de
// dag dat je 'm afvinkt, want anders schuift een taak die je een paar dagen
// laat liggen steeds verder door.
function volgendeHerhaling(huidigeDatumStr, type) {
  const basis = huidigeDatumStr ? new Date(...huidigeDatumStr.split("-").map((v,i)=>i===1?+v-1:+v)) : new Date();
  const volgende = new Date(basis);
  if (type === "dagelijks") volgende.setDate(volgende.getDate() + 1);
  else if (type === "wekelijks") volgende.setDate(volgende.getDate() + 7);
  else if (type === "maandelijks") {
    // JS-eigenaardigheid: setMonth() op bv. 31 januari + 1 maand "rolt" door
    // naar 3 maart (want 31 februari bestaat niet) i.p.v. netjes op 28/29
    // februari uit te komen. Fix: eerst naar de 1e van de maand (voorkomt
    // die overflow), dan de maand ophogen, en dan de oorspronkelijke
    // dag-van-de-maand terugzetten — geklemd op de laatste geldige dag van
    // de nieuwe maand.
    const dagVanMaand = volgende.getDate();
    volgende.setDate(1);
    volgende.setMonth(volgende.getMonth() + 1);
    const laatsteDagNieuweMaand = new Date(volgende.getFullYear(), volgende.getMonth() + 1, 0).getDate();
    volgende.setDate(Math.min(dagVanMaand, laatsteDagNieuweMaand));
  }
  return datumNaarStr(volgende);
}
const CAT_ICONEN = [
  "📌","🥦","🧀","🐟","💐","🥛","🥩","🥐","🥫","🧊","🧴","🧽","🧃","🛒","👕","🏊","📄","🔌","💊","📦","🏠","🌳","👤","👨‍👩‍👧","👫","🎁","🔧","📚","🍽️","🫒","🥓",
  // Eten & drinken
  "🍞","🥚","🍎","🌶️","🧂","🍚","🥜","🍫","☕","🍷","🍺",
  // Baby & huisdieren
  "🍼","🐾",
  // Kamperen & vakantie
  "🚐","⛺","🎒",
  // Huishouden
  "🧻","🔋","💡","🕯️",
  // Overig
  "💻","🎨","🚲",
];

// "Wie heeft wat gedaan"-badge: toont het initiaal van wie een item als laatste
// heeft toegevoegd/afgevinkt/gewijzigd, maar alleen als dat recent was (24u).
const WIE_BADGE_VENSTER_MS = 24 * 60 * 60 * 1000;
function WieBadge({ persoon, tijdstip }) {
  if (!persoon || !tijdstip) return null;
  if (Date.now() - tijdstip > WIE_BADGE_VENSTER_MS) return null;
  return (
    <span
      title={`Laatst gewijzigd door ${persoon}`}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 16, height: 16, borderRadius: "50%",
        background: persoon === "Pepijn" ? "#2D4A3E" : "#C86E4A",
        color: "#FAF6F0", fontSize: 9, fontWeight: 700, marginLeft: 6, flexShrink: 0,
      }}
    >
      {persoon.charAt(0)}
    </span>
  );
}

async function loadData() {
  try {
    const res = await fetch("/api/lijsten");
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

async function saveData(data) {
  try {
    await fetch("/api/lijsten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) { console.error("Opslaan mislukt", e); }
}

// ---- Stijlen ----
const S = {
  appBg: { minHeight: "100vh", background: "#FAF6F0", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, Roboto, sans-serif", color: "#2D2A26" },
  header: { padding: "28px 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { margin: "4px 0 0", fontSize: 28, fontWeight: 700, color: "#2D4A3E", letterSpacing: "-0.01em" },
  main: { flex: 1, padding: "4px 20px 140px", overflowY: "auto" },
  card: { background: "#FFFFFF", border: "1px solid #EFE9DC", borderRadius: 18, padding: "18px 16px", marginBottom: 12 },
  inp: { background: "#FAF6F0", border: "1px solid #E4DCCB", borderRadius: 12, padding: "12px 16px", fontSize: 16, width: "100%", boxSizing: "border-box", color: "#2D2A26" },
  btn: (bg="#2D4A3E", col="#FAF6F0") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  fab: { width: 52, height: 52, minWidth: 52, borderRadius: 16, background: "#2D4A3E", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px rgba(45,74,62,0.25)" },
  footer: { position: "fixed", bottom: 0, left: 0, right: 0, padding: "14px 20px 28px", background: "linear-gradient(180deg, rgba(250,246,240,0) 0%, #FAF6F0 40%)", display: "flex", gap: 12 },
  checkbox: { boxSizing: "border-box", width: 20, height: 20, minWidth: 20, flexShrink: 0, borderRadius: 6, border: "2px solid #D8D0BF", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  checkboxOn: { background: "#2D4A3E", borderColor: "#2D4A3E" },
  itemRow: { display: "flex", alignItems: "center", padding: "7px 12px", borderBottom: "1px solid #F3EEE3", gap: 8 },
  itemMain: { flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  itemName: { fontSize: 14, color: "#2D2A26", lineHeight: 1.3 },
  itemNameChecked: { color: "#2D4A3E", fontWeight: 600 },
  itemNote: { fontSize: 11, color: "#B8B2A8", fontStyle: "italic" },
  amountRow: { display: "flex", alignItems: "center", gap: 4 },
  amountBtn: { width: 20, height: 20, minWidth: 20, borderRadius: 6, border: "1px solid #E4DCCB", background: "#FAF6F0", fontSize: 13, color: "#2D4A3E", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 },
  unitSelect: { fontSize: 11, color: "#8C8576", border: "1px solid #E4DCCB", borderRadius: 6, background: "#FAF6F0", padding: "2px 4px", marginLeft: 2 },
  catHeading: { fontSize: 12, fontWeight: 700, color: "#2D4A3E", textTransform: "uppercase", letterSpacing: "0.04em", paddingLeft: 2, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" },
  itemList: { listStyle: "none", margin: 0, padding: 0, background: "#FFFFFF", borderRadius: 14, overflow: "hidden", border: "1px solid #EFE9DC" },
  addSheet: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: "22px 20px 32px", boxShadow: "0 -8px 30px rgba(45,42,38,0.12)", zIndex: 10, maxHeight: "85vh", overflowY: "auto", boxSizing: "border-box" },
  addTabs: { display: "flex", gap: 6, marginBottom: 16, background: "#F3EEE3", borderRadius: 12, padding: 4 },
  addTabBtn: (active) => ({ flex: 1, border: "none", background: active ? "#FFFFFF" : "transparent", borderRadius: 9, padding: "9px 0", fontSize: 12, fontWeight: 600, color: active ? "#2D4A3E" : "#8C8576", cursor: "pointer", boxShadow: active ? "0 1px 4px rgba(45,42,38,0.08)" : "none" }),
  catPickerBtn: (active) => ({ width: 42, height: 42, borderRadius: 12, border: active ? "2px solid #2D4A3E" : "1px solid #E4DCCB", background: active ? "#FFFFFF" : "#FAF6F0", fontSize: 19, cursor: "pointer" }),
  pickChip: { border: "1px solid #E4DCCB", background: "#FAF6F0", borderRadius: 999, padding: "8px 14px", fontSize: 13, color: "#2D2A26", cursor: "pointer" },
  suggestChip: { border: "1px solid #E4DCCB", background: "#FFFFFF", borderRadius: 999, padding: "8px 14px", fontSize: 14, color: "#2D2A26", cursor: "pointer" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
  shopRow: { display: "flex", alignItems: "center", padding: "15px 14px", borderBottom: "1px solid #F3EEE3", gap: 14, cursor: "pointer" },
  shopCheckbox: (on) => ({ width: 26, height: 26, minWidth: 26, borderRadius: 999, border: `2px solid ${on ? "#B8B2A8" : "#D8D0BF"}`, background: on ? "#B8B2A8" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }),
  shopItemName: (on) => ({ flex: 1, fontSize: 17, color: on ? "#C9C3B8" : "#2D2A26", textDecoration: on ? "line-through" : "none" }),
  shopItemAmount: { display: "block", fontSize: 12, color: "#B8B2A8", marginTop: 2 },
  switchBtn: { margin: 0, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: "#B8B2A8", fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  editInput: { fontSize: 16, border: "1px solid #C86E4A", borderRadius: 8, padding: "4px 8px", background: "#FFFFFF", width: "100%", boxSizing: "border-box" },
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" },
};

// ════════════════════════════════════════════════════════
// HOOFD APP
// ════════════════════════════════════════════════════════
export default function LijstenApp() {
  const router = useRouter();
  const [lists, setListsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verbindingsFout, setVerbindingsFout] = useState(false);
  const [offline, setOffline] = useState(false);
  const [laatstBijgewerkt, setLaatstBijgewerkt] = useState(null);
  const [activeListId, setActiveListId] = useState(null);
  const [mode, setMode] = useState("lijst"); // lijst | pakken | instellingen
  const deepLinkVerwerkt = useRef(false);
  const lastWriteRef = useRef(0);
  const pollRef = useRef(null);

  // Nieuwe lijst
  const [showNieuw, setShowNieuw] = useState(false);
  const [nieuwNaam, setNieuwNaam] = useState("");
  const [nieuwIcoon, setNieuwIcoon] = useState("📋");
  const [nieuwSjabloon, setNieuwSjabloon] = useState(null);
  const [nieuwType, setNieuwType] = useState("standaard"); // "standaard" | "todo"

  // Lijstbewerking
  const [editListId, setEditListId] = useState(null);
  const [editListNaam, setEditListNaam] = useState("");
  const [editCatId, setEditCatId] = useState(null);
  const [editCatLabel, setEditCatLabel] = useState("");

  // Toevoegen
  const [showAdd, setShowAdd] = useState(false);
  const [addTab, setAddTab] = useState("typen");
  const [newProduct, setNewProduct] = useState("");
  const [newCategory, setNewCategory] = useState(null);
  const [newAmount, setNewAmount] = useState(1);
  const [newUnit, setNewUnit] = useState("stuks");
  const [newNote, setNewNote] = useState("");
  const [newBudget, setNewBudget] = useState("");
  const [newStatus, setNewStatus] = useState("Idee");

  // Item-bewerken
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editNoteId, setEditNoteId] = useState(null);
  const [editNoteText, setEditNoteText] = useState("");

  // UI-opties
  const [verbergAfgevinkt, setVerbergAfgevinkt] = useState(false);
  const [showVorigeLijst, setShowVorigeLijst] = useState(false);
  const [wijzigCatItemId, setWijzigCatItemId] = useState(null);
  const [zoekterm, setZoekterm] = useState("");
  const [showZoek, setShowZoek] = useState(false);
  const [ingeklapteCategorieen, setIngeklapteCategorieen] = useState({}); // catId -> bool
  const [voltooidIngeklapt, setVoltooidIngeklapt] = useState(true); // standaard dicht, net als in Microsoft To Do
  const [ingeklaptePakkenCats, setIngeklaptePakkenCats] = useState({}); // catId -> bool, apart voor pakken-modus

  // Pakken-modus keuze
  const [showPakkenKeuze, setShowPakkenKeuze] = useState(false);

  // Undo voor verwijderen
  const [undoItem, setUndoItem] = useState(null); // { item, listId, timer }

  // Categorie beheer
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("📌");

  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState("success"); // success | undo
  const [huidigeGebruiker, setHuidigeGebruiker] = useState(null); // "Pepijn" | "Tessa"
  const [taakDetailId, setTaakDetailId] = useState(null);
  const [nieuweSubstap, setNieuweSubstap] = useState("");
  const [todoSortering, setTodoSortering] = useState("handmatig"); // "handmatig" | "vervaldatum" | "alfabetisch"

  // ── Wie ben ik? (voor "wie heeft wat gedaan"-badges) ──
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d?.user) setHuidigeGebruiker(d.user);
    }).catch(() => {});
  }, []);

  // ── Offline detectie ─────────────────────────────────
  useEffect(() => {
    const onOnline  = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // ── Data laag ────────────────────────────────────────
  const persistLists = useCallback((nextLists) => {
    lastWriteRef.current = Date.now();
    setListsState(nextLists);
    saveData({ lists: nextLists });
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (Date.now() - lastWriteRef.current < 5000) return;
      const aanvraagGestart = Date.now();
      const data = await loadData();
      if (lastWriteRef.current > aanvraagGestart) return; // ondertussen lokaal geschreven — dit antwoord is alweer verouderd
      if (active && data) {
        setListsState(data.lists || []);
        setLoading(false);
        setVerbindingsFout(false);
        setLaatstBijgewerkt(new Date());
      } else if (active) {
        setLoading(false);
        setVerbindingsFout(true);
      }
    };
    refresh();
    pollRef.current = setInterval(refresh, 4000);
    return () => { active = false; clearInterval(pollRef.current); };
  }, []);

  // ── Deep-link: open direct een specifieke lijst via ?lijst=ID ──
  // (gebruikt door bijv. Verjaardagen om rechtstreeks naar een cadeaulijst te linken)
  useEffect(() => {
    if (deepLinkVerwerkt.current || loading) return;
    const doelId = router.query.lijst;
    if (typeof doelId === "string" && lists.some(l => l.id === doelId)) {
      setActiveListId(doelId);
      setMode("lijst");
      deepLinkVerwerkt.current = true;
    } else if (router.isReady) {
      deepLinkVerwerkt.current = true;
    }
  }, [loading, lists, router.query.lijst, router.isReady]);

  function showToast(msg, type = "success") {
    setToast(msg);
    setToastType(type);
    if (type !== "undo") setTimeout(() => setToast(null), 2500);
  }

  // ── Lijst-mutaties ───────────────────────────────────
  function maakLijst() {
    if (!nieuwNaam.trim()) return;
    const sjabloon = LIJST_SJABLONEN.find(s => s.naam === nieuwSjabloon);
    const categorieen = sjabloon ? sjabloon.categorieen : STANDAARD_CATEGORIEEN;
    const startItems = sjabloon?.items?.map(item => ({
      id: uid(), name: item.name, category: item.cat,
      amount: item.amount || 1, unit: item.unit || "stuks",
      checked: false, inCart: false, note: "",
      status: item.status || null, budget: item.budget || null,
      addedAt: Date.now(),
    })) || [];
    const newList = {
      id: uid(), name: nieuwNaam.trim(), icon: nieuwIcoon,
      type: sjabloon?.type || nieuwType,
      categories: categorieen, items: startItems,
      history: {}, favorites: [], archief: [],
      createdAt: Date.now(),
    };
    persistLists([...lists, newList]);
    setNieuwNaam(""); setNieuwIcoon("📋"); setNieuwSjabloon(null); setNieuwType("standaard");
    setShowNieuw(false); setActiveListId(newList.id);
    showToast(`✅ Lijst "${newList.name}" aangemaakt`);
  }

  function wijzigLijstType(nieuweType) {
    if (activeList.type === nieuweType) return;
    updateList(activeListId, l => ({ ...l, type: nieuweType === "standaard" ? null : nieuweType }));
    showToast(nieuweType === "todo" ? "📋 Omgezet naar to-do-lijst" : "✅ Omgezet naar voeg toe/afvink-lijst");
  }

  function verwijderLijst(id) {
    if (!window.confirm("Weet je zeker dat je deze lijst wil verwijderen?")) return;
    lastWriteRef.current = Date.now();
    const nextLists = lists.filter(l => l.id !== id);
    setListsState(nextLists);
    saveData({ lists: nextLists, deletedListIds: [id] });
    if (activeListId === id) setActiveListId(null);
  }

  function hernoemLijst(id, naam) {
    persistLists(lists.map(l => l.id === id ? { ...l, name: naam } : l));
    setEditListId(null);
  }

  function voegCatToe() {
    if (!newCatLabel.trim() || !activeListId) return;
    const newCat = { id: uid(), label: newCatLabel.trim(), icon: newCatIcon };
    persistLists(lists.map(l => l.id === activeListId
      ? { ...l, categories: [...l.categories, newCat] } : l));
    setNewCatLabel(""); setNewCatIcon("📌");
    showToast(`✅ Categorie "${newCat.label}" toegevoegd`);
  }

  function hernoemCat(catId, naam) {
    setEditCatId(null);
    if (!naam.trim() || !activeListId) return;
    persistLists(lists.map(l => l.id === activeListId
      ? { ...l, categories: l.categories.map(c => c.id === catId ? { ...c, label: naam.trim() } : c) }
      : l));
    showToast("✅ Categorie hernoemd");
  }

  function wijzigCatIcoon(catId, icoon) {
    if (!activeListId) return;
    persistLists(lists.map(l => l.id === activeListId
      ? { ...l, categories: l.categories.map(c => c.id === catId ? { ...c, icon: icoon } : c) }
      : l));
  }

  function verwijderCat(catId) {
    persistLists(lists.map(l => l.id === activeListId
      ? { ...l, categories: l.categories.filter(c => c.id !== catId) } : l));
  }

  function dupliceerLijst(id) {
    const orig = lists.find(l => l.id === id);
    if (!orig) return;
    const kopie = {
      ...orig, id: uid(), name: `${orig.name} (kopie)`,
      items: orig.items.map(i => ({ ...i, id: uid(), checked: false, inCart: false })),
      history: {}, archief: [], createdAt: Date.now(),
    };
    persistLists([...lists, kopie]);
    showToast(`✅ "${orig.name}" gedupliceerd`);
  }

  function herschikLijsten(vanIdx, naarIdx) {
    const next = [...lists];
    const [verplaatst] = next.splice(vanIdx, 1);
    next.splice(naarIdx, 0, verplaatst);
    persistLists(next);
  }

  function wijzigItemCategorie(itemId, catId) {
    updateItem(itemId, { category: catId });
  }

  // ── Item-mutaties ────────────────────────────────────
  function updateList(id, updater) {
    persistLists(lists.map(l => l.id === id ? updater(l) : l));
  }

  const activeList = lists.find(l => l.id === activeListId);
  const isCadeau = activeList?.type === "cadeau";
  const isTodo = activeList?.type === "todo";

  function addItem(name, categoryId, amount, unit, note, status, budget) {
    if (!name.trim() || !activeListId) return;
    const exists = activeList?.items.find(i =>
      i.name.toLowerCase() === name.toLowerCase() && !i.checked);
    if (exists) { showToast("⚠️ Staat al in de lijst"); return; }
    updateList(activeListId, l => ({
      ...l,
      items: [...l.items, {
        id: uid(), name: name.trim(),
        category: categoryId || l.categories[0]?.id,
        amount: amount || 1, unit: unit || "stuks",
        checked: false, inCart: false,
        note: note || "", status: status || null, budget: budget || null,
        dueDate: null, assignedTo: null, herhaling: null, substappen: [], belangrijk: false,
        addedAt: Date.now(), addedBy: huidigeGebruiker,
        lastActionBy: huidigeGebruiker, lastActionAt: Date.now(),
      }],
    }));
    setNewProduct(""); setNewAmount(1); setNewUnit("stuks");
    setNewNote(""); setNewBudget(""); setNewStatus("Idee");
    setShowAdd(false);
  }

  function toggleCheck(itemId) {
    updateList(activeListId, l => ({
      ...l, items: l.items.map(i => {
        if (i.id !== itemId) return i;
        // Een herhalende taak "afvinken" betekent: klaar voor nu, maar
        // schuift meteen door naar de volgende keer i.p.v. afgevinkt te
        // blijven staan — dat is hoe herhalende taken in de meeste
        // to-do-apps werken.
        if (!i.checked && i.herhaling) {
          return { ...i, dueDate: volgendeHerhaling(i.dueDate, i.herhaling), lastActionBy: huidigeGebruiker, lastActionAt: Date.now() };
        }
        return { ...i, checked: !i.checked, lastActionBy: huidigeGebruiker, lastActionAt: Date.now() };
      }),
    }));
  }

  // Vinkt alle op dit moment zichtbare items (rekening houdend met eventueel
  // actieve zoekfilter) in één keer aan, of allemaal uit als ze al allemaal
  // aangevinkt zijn.
  function toggleAlles(zichtbareIds) {
    updateList(activeListId, l => {
      const alleAangevinkt = zichtbareIds.every(id => l.items.find(i => i.id === id)?.checked);
      return {
        ...l, items: l.items.map(i => zichtbareIds.includes(i.id)
          ? { ...i, checked: !alleAangevinkt, lastActionBy: huidigeGebruiker, lastActionAt: Date.now() }
          : i),
      };
    });
  }

  // Zet alle items van een to-do-lijst terug naar niet-afgevinkt, zodat de
  // hele lijst opnieuw doorlopen kan worden (bv. een nieuwe week). Wie het
  // laatst iets heeft aangevinkt blijft zichtbaar totdat het opnieuw wordt
  // aangevinkt — dat wissen we hier bewust niet, dat is gewoon geschiedenis.
  function resetTodoLijst() {
    if (!window.confirm("Alle items in deze lijst weer op 'niet gedaan' zetten?")) return;
    updateList(activeListId, l => ({
      ...l, items: l.items.map(i => ({ ...i, checked: false, inCart: false })),
    }));
    showToast("🔄 Lijst gereset — alles staat weer aan");
  }

  // ── To-do-specifieke item-acties ────────────────────────
  function zetVervaldatum(itemId, datumStr) {
    updateList(activeListId, l => ({
      ...l, items: l.items.map(i => i.id === itemId ? { ...i, dueDate: datumStr || null } : i),
    }));
  }
  function zetToegewezenAan(itemId, persoon) {
    updateList(activeListId, l => ({
      ...l, items: l.items.map(i => i.id === itemId ? { ...i, assignedTo: i.assignedTo === persoon ? null : persoon } : i),
    }));
  }
  function toggleBelangrijk(itemId) {
    updateList(activeListId, l => ({
      ...l, items: l.items.map(i => i.id === itemId ? { ...i, belangrijk: !i.belangrijk } : i),
    }));
  }
  function zetHerhaling(itemId, type) {
    updateList(activeListId, l => ({
      ...l, items: l.items.map(i => {
        if (i.id !== itemId) return i;
        const nieuweHerhaling = i.herhaling === type ? null : type;
        // Zonder vervaldatum heeft "elke week herhalen" geen ankerpunt om
        // vanaf door te schuiven — zet 'm dan meteen op vandaag.
        return { ...i, herhaling: nieuweHerhaling, dueDate: nieuweHerhaling && !i.dueDate ? vandaagStr() : i.dueDate };
      }),
    }));
  }
  function voegSubstapToe(itemId, tekst) {
    if (!tekst.trim()) return;
    updateList(activeListId, l => ({
      ...l, items: l.items.map(i => i.id === itemId
        ? { ...i, substappen: [...(i.substappen||[]), { id: uid(), tekst: tekst.trim(), afgevinkt: false }] }
        : i),
    }));
  }
  function toggleSubstap(itemId, stapId) {
    updateList(activeListId, l => ({
      ...l, items: l.items.map(i => i.id === itemId
        ? { ...i, substappen: (i.substappen||[]).map(s => s.id === stapId ? { ...s, afgevinkt: !s.afgevinkt } : s) }
        : i),
    }));
  }
  function verwijderSubstap(itemId, stapId) {
    updateList(activeListId, l => ({
      ...l, items: l.items.map(i => i.id === itemId
        ? { ...i, substappen: (i.substappen||[]).filter(s => s.id !== stapId) }
        : i),
    }));
  }

  // Zelfde logica als toggleCheck, maar werkt op een expliciet meegegeven
  // lijst-id i.p.v. altijd de actieve lijst — nodig voor "Mijn dag", waar
  // taken uit meerdere to-do-lijsten tegelijk getoond en afgevinkt worden.
  function toggleCheckInList(listId, itemId) {
    updateList(listId, l => ({
      ...l, items: l.items.map(i => {
        if (i.id !== itemId) return i;
        if (!i.checked && i.herhaling) {
          return { ...i, dueDate: volgendeHerhaling(i.dueDate, i.herhaling), lastActionBy: huidigeGebruiker, lastActionAt: Date.now() };
        }
        return { ...i, checked: !i.checked, lastActionBy: huidigeGebruiker, lastActionAt: Date.now() };
      }),
    }));
  }

  function toggleInCart(itemId) {
    updateList(activeListId, l => ({
      ...l, items: l.items.map(i => i.id === itemId ? { ...i, inCart: !i.inCart } : i),
    }));
  }

  function removeItem(itemId) {
    // Undo: bewaar het item 5 seconden
    const item = activeList?.items.find(i => i.id === itemId);
    if (item) {
      if (undoItem?.timer) clearTimeout(undoItem.timer);
      const timer = setTimeout(() => setUndoItem(null), 5000);
      setUndoItem({ item, listId: activeListId, timer });
      showToast("🗑 Verwijderd", "undo");
    }
    updateList(activeListId, l => ({ ...l, items: l.items.filter(i => i.id !== itemId) }));
  }

  function undoRemove() {
    if (!undoItem) return;
    clearTimeout(undoItem.timer);
    persistLists(lists.map(l => l.id === undoItem.listId
      ? { ...l, items: [...l.items, undoItem.item] } : l));
    setUndoItem(null);
    setToast(null);
  }

  function updateItem(itemId, fields) {
    updateList(activeListId, l => ({
      ...l, items: l.items.map(i => i.id === itemId ? { ...i, ...fields } : i),
    }));
  }

  function changeAmount(itemId, delta) {
    const item = activeList?.items.find(i => i.id === itemId);
    if (!item) return;
    const unit = item.unit || "stuks";
    const stap = unit === "g" ? 100 : ["kg", "l", "ml"].includes(unit) ? 0.5 : 1;
    const next = Math.max(stap, Math.round(((item.amount || stap) + delta * stap) * 100) / 100);
    updateItem(itemId, { amount: next });
  }

  function setAmountDirect(itemId, waarde) {
    const parsed = parseFloat(String(waarde).replace(",", "."));
    if (!isNaN(parsed) && parsed > 0) updateItem(itemId, { amount: parsed });
  }

  function toggleFavorite(name, categoryId) {
    updateList(activeListId, l => {
      const isFav = l.favorites.some(f => f.name.toLowerCase() === name.toLowerCase());
      return {
        ...l,
        favorites: isFav
          ? l.favorites.filter(f => f.name.toLowerCase() !== name.toLowerCase())
          : [...l.favorites, { name, category: categoryId }],
      };
    });
  }

  // ── Pakken afronden: keuze bewaren of leegmaken ──────
  function finishPacking(leegmaken) {
    updateList(activeListId, l => {
      const huidigRonde = {
        datum: new Date().toLocaleDateString("nl-NL"),
        items: l.items.filter(i => i.checked).map(i => ({
          name: i.name, category: i.category, amount: i.amount, unit: i.unit,
        })),
      };
      const nextArchief = [huidigRonde, ...(l.archief || [])].slice(0, 5);
      const nextHistory = { ...l.history };
      l.items.filter(i => i.checked).forEach(i => {
        const key = i.name.toLowerCase();
        nextHistory[key] = {
          name: i.name, category: i.category, amount: i.amount, unit: i.unit,
          count: (nextHistory[key]?.count || 0) + 1, lastUsed: Date.now(),
        };
      });
      if (leegmaken) {
        return { ...l, items: [], history: nextHistory, archief: nextArchief };
      } else {
        // Bewaren: afvinkjes resetten, lijst intact laten
        return {
          ...l,
          items: l.items.map(i => ({ ...i, checked: false, inCart: false })),
          history: nextHistory,
          archief: nextArchief,
        };
      }
    });
    setMode("lijst");
    setShowPakkenKeuze(false);
    showToast(leegmaken ? "✅ Lijst geleegd — alles opgeslagen" : "✅ Klaar! Vinkjes gereset voor volgende keer");
  }

  // Start een nieuwe boodschappen-/pakronde. inCart wordt hier altijd hard
  // gereset naar false, ongeacht of de vorige ronde netjes is afgesloten via
  // finishPacking — anders lijkt het net alsof alles al gepakt is terwijl je
  // nog moet beginnen, bijvoorbeeld als je de vorige keer de app gewoon
  // hebt weggeklikt zonder op "Klaar" te drukken.
  function startPakken() {
    updateList(activeListId, l => ({
      ...l,
      items: l.items.map(i => i.checked ? { ...i, inCart: false } : i),
    }));
    setMode("pakken");
  }

  function laadVorigeLijst(ronde) {
    if (!activeList) return;
    const bestaandeNamen = new Set(activeList.items.map(i => i.name.toLowerCase()));
    const nieuwItems = ronde.items
      .filter(i => !bestaandeNamen.has(i.name.toLowerCase()))
      .map(i => ({
        id: uid(), name: i.name, category: i.category,
        amount: i.amount, unit: i.unit,
        checked: false, inCart: false, note: "", addedAt: Date.now(),
      }));
    updateList(activeListId, l => ({ ...l, items: [...l.items, ...nieuwItems] }));
    setShowVorigeLijst(false);
    showToast(`✅ ${nieuwItems.length} items toegevoegd`);
  }

  function saveEditName() {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (trimmed) updateItem(editingId, { name: trimmed });
    setEditingId(null); setEditName("");
  }

  // ── Loading ──────────────────────────────────────────
  if (loading) return (
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <span style={{ fontSize: 32 }}>📋</span>
        <div style={{ display: "flex", gap: 6 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#2D4A3E", opacity: 0.3, animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />
          ))}
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}`}</style>
      </div>
    </div>
  );

  if (verbindingsFout) return (
    <div style={S.appBg}>
      <div style={{ ...S.loadingWrap, gap: 16, padding: "0 32px", textAlign: "center" }}>
        <span style={{ fontSize: 40 }}>⚠️</span>
        <p style={{ fontWeight: 700, fontSize: 17, color: "#2D4A3E", margin: 0 }}>Geen verbinding</p>
        <p style={{ fontSize: 14, color: "#8C8576", margin: 0 }}>Controleer je internetverbinding.</p>
        <button style={{ background: "#2D4A3E", color: "#FAF6F0", border: "none", borderRadius: 12, padding: "13px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
          onClick={() => { setVerbindingsFout(false); setLoading(true); window.location.reload(); }}>
          Opnieuw proberen
        </button>
        <Link href="/" style={{ fontSize: 13, color: "#B8B2A8" }}>← Terug</Link>
      </div>
    </div>
  );

  // ════════════════════════════
  // PAKKEN-MODUS
  // ════════════════════════════
  if (activeList && mode === "pakken") {
    const teNemen = activeList.items.filter(i => i.checked);
    const sorteerAlfabetisch = (a, b) => a.name.localeCompare(b.name, "nl", { sensitivity: "base" });
    const grouped = activeList.categories
      .map(cat => ({ cat, items: teNemen.filter(i => i.category === cat.id).sort(sorteerAlfabetisch) }))
      .filter(g => g.items.length > 0);
    const uncategorized = teNemen.filter(i => !activeList.categories.find(c => c.id === i.category)).sort(sorteerAlfabetisch);
    const done = teNemen.filter(i => i.inCart).length;
    const isVakantie = !activeList.name.toLowerCase().includes("boodschappen");

    return (
      <div style={S.appBg}>
        {/* Keuze-overlay: leegmaken of bewaren */}
        {showPakkenKeuze && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
            <div style={{ background: "#FFFFFF", width: "100%", padding: "24px 20px 40px", borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 17, color: "#2D4A3E" }}>Klaar met {isVakantie ? "inpakken" : "boodschappen"}!</p>
              <p style={{ margin: "0 0 20px", fontSize: 14, color: "#8C8576" }}>Wat wil je doen met de lijst?</p>
              <button style={{ ...S.btn(), width: "100%", marginBottom: 10, padding: "15px 0", borderRadius: 14 }}
                onClick={() => finishPacking(false)}>
                🔄 Vinkjes resetten — lijst bewaren
                <span style={{ display: "block", fontSize: 12, fontWeight: 400, opacity: 0.8, marginTop: 3 }}>Handig voor volgende vakantie of week</span>
              </button>
              <button style={{ ...S.btn("#C86E4A"), width: "100%", padding: "15px 0", borderRadius: 14, marginBottom: 12 }}
                onClick={() => finishPacking(true)}>
                🗑 Lijst leegmaken
                <span style={{ display: "block", fontSize: 12, fontWeight: 400, opacity: 0.8, marginTop: 3 }}>Items worden verwijderd, archief bewaard</span>
              </button>
              <button style={{ ...S.btn("#E4DCCB", "#2D2A26"), width: "100%", padding: "12px 0", borderRadius: 14 }}
                onClick={() => setShowPakkenKeuze(false)}>
                Annuleer — nog niet klaar
              </button>
            </div>
          </div>
        )}

        <header style={{ ...S.header, alignItems: "center" }}>
          <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setMode("lijst")}>
            <ChevronLeft size={20} color="#2D4A3E" />
          </button>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#2D4A3E" }}>{activeList.icon} {activeList.name}</h1>
            {teNemen.length > 0 && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#B8B2A8" }}>{done} van {teNemen.length} klaar</p>}
          </div>
          <div style={{ width: 32 }} />
        </header>

        <main style={S.main}>
          {teNemen.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#2D4A3E" }}>Niets aangevinkt</p>
              <p style={{ fontSize: 14, color: "#B8B2A8" }}>Ga terug en vink items aan.</p>
            </div>
          ) : (
            <>
              {grouped.map(({ cat, items }) => {
                const ingeklapt = !!ingeklaptePakkenCats[cat.id];
                const klaar = items.filter(i => i.inCart).length;
                return (
                  <section key={cat.id} style={{ marginBottom: 24 }}>
                    <div style={{ ...S.catHeading, marginBottom: ingeklapt ? 0 : 6 }}
                      onClick={() => setIngeklaptePakkenCats(prev => ({ ...prev, [cat.id]: !ingeklapt }))}>
                      <span>{cat.icon} {cat.label}</span>
                      <span style={{ fontSize: 11, color: "#B8B2A8", fontWeight: 400, marginLeft: "auto" }}>
                        {klaar}/{items.length}
                      </span>
                      <span style={{ fontSize: 14, color: "#B8B2A8", marginLeft: 4 }}>{ingeklapt ? "▸" : "▾"}</span>
                    </div>
                    {!ingeklapt && (
                      <ul style={S.itemList}>
                        {items.map(item => (
                          <li key={item.id} style={S.shopRow} onClick={() => toggleInCart(item.id)}>
                            <span style={S.shopCheckbox(item.inCart)}>
                              {item.inCart && <Check size={15} color="#FAF6F0" strokeWidth={3} />}
                            </span>
                            <span style={S.shopItemName(item.inCart)}>
                              {item.name}
                              <span style={S.shopItemAmount}>{item.amount ?? 1} {item.unit || "stuks"}</span>
                              {item.note && <span style={{ ...S.shopItemAmount, fontStyle: "italic" }}>📝 {item.note}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
              {uncategorized.length > 0 && (() => {
                const ingeklapt = !!ingeklaptePakkenCats._overig;
                const klaar = uncategorized.filter(i => i.inCart).length;
                return (
                  <section style={{ marginBottom: 24 }}>
                    <div style={{ ...S.catHeading, marginBottom: ingeklapt ? 0 : 6 }}
                      onClick={() => setIngeklaptePakkenCats(prev => ({ ...prev, _overig: !ingeklapt }))}>
                      <span>📦 Overig</span>
                      <span style={{ fontSize: 11, color: "#B8B2A8", fontWeight: 400, marginLeft: "auto" }}>
                        {klaar}/{uncategorized.length}
                      </span>
                      <span style={{ fontSize: 14, color: "#B8B2A8", marginLeft: 4 }}>{ingeklapt ? "▸" : "▾"}</span>
                    </div>
                    {!ingeklapt && (
                      <ul style={S.itemList}>
                        {uncategorized.map(item => (
                          <li key={item.id} style={S.shopRow} onClick={() => toggleInCart(item.id)}>
                            <span style={S.shopCheckbox(item.inCart)}>
                              {item.inCart && <Check size={15} color="#FAF6F0" strokeWidth={3} />}
                            </span>
                            <span style={S.shopItemName(item.inCart)}>{item.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })()}
            </>
          )}
        </main>
        <footer style={S.footer}>
          <button style={{ ...S.btn(), width: "100%", padding: "16px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, boxShadow: "0 6px 16px rgba(45,74,62,0.25)" }}
            onClick={() => setShowPakkenKeuze(true)}>
            <RotateCcw size={16} color="#FAF6F0" />
            Klaar met {isVakantie ? "inpakken" : "boodschappen"}
          </button>
        </footer>
      </div>
    );
  }

  // ════════════════════════════
  // INSTELLINGEN
  // ════════════════════════════
  if (activeList && mode === "instellingen") {
    return (
      <div style={S.appBg}>
        <header style={{ ...S.header, alignItems: "center" }}>
          <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setMode("lijst")}>
            <ChevronLeft size={20} color="#2D4A3E" />
          </button>
          <h1 style={{ ...S.title, fontSize: 20 }}>Categorieën</h1>
          <div style={{ width: 32 }} />
        </header>
        <main style={S.main}>
          {activeList.type !== "cadeau" && (
            <div style={{ ...S.card, marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: "#8C8576", margin: "0 0 8px", fontWeight: 700 }}>Type lijst</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => wijzigLijstType("standaard")}
                  style={{ flex: 1, textAlign: "left", border: (activeList.type||"standaard") === "standaard" ? "2px solid #2D4A3E" : "1px solid #E4DCCB", background: (activeList.type||"standaard") === "standaard" ? "#2D4A3E11" : "#FAF6F0", borderRadius: 12, padding: "10px 12px", cursor: "pointer" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#2D2A26" }}>✅ Voeg toe/afvink</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#8C8576" }}>Items toevoegen, afvinken zodra klaar/gekocht</p>
                </button>
                <button onClick={() => wijzigLijstType("todo")}
                  style={{ flex: 1, textAlign: "left", border: activeList.type === "todo" ? "2px solid #2D4A3E" : "1px solid #E4DCCB", background: activeList.type === "todo" ? "#2D4A3E11" : "#FAF6F0", borderRadius: 12, padding: "10px 12px", cursor: "pointer" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#2D2A26" }}>📋 To-do</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#8C8576" }}>Terugkerende taken, later in één keer resetten</p>
                </button>
              </div>
              <p style={{ fontSize: 11, color: "#8C8576", margin: "8px 0 0" }}>
                De inhoud van de lijst blijft gewoon staan — dit wijzigt alleen hoe items eruitzien en welke opties je erbij hebt (vervaldatum, toewijzen, etc. bij To-do).
              </p>
            </div>
          )}

          <ul style={{ ...S.itemList, marginBottom: 16 }}>
            {activeList.categories.map(cat => (
              <li key={cat.id} style={{ ...S.itemRow, alignItems: editCatId === cat.id ? "flex-start" : "center", flexDirection: editCatId === cat.id ? "column" : "row", gap: editCatId === cat.id ? 10 : 8 }}>
                {editCatId === cat.id ? (
                  <div style={{ width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 20 }}>{cat.icon}</span>
                      <input autoFocus style={{ ...S.inp, flex: 1 }} value={editCatLabel}
                        onChange={e => setEditCatLabel(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && hernoemCat(cat.id, editCatLabel)} />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      {CAT_ICONEN.map(ic => (
                        <button key={ic} onClick={() => wijzigCatIcoon(cat.id, ic)}
                          style={{ width: 32, height: 32, borderRadius: 8, border: cat.icon === ic ? "2px solid #2D4A3E" : "1px solid #E4DCCB", background: cat.icon === ic ? "#FFFFFF" : "#FAF6F0", fontSize: 15, cursor: "pointer" }}>
                          {ic}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, width: "100%" }}>
                      <button style={{ ...S.btn("#E4DCCB", "#2D2A26"), flex: 1 }} onClick={() => setEditCatId(null)}>Annuleer</button>
                      <button style={{ ...S.btn(), flex: 1 }} onClick={() => hernoemCat(cat.id, editCatLabel)}>Opslaan</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 20, marginRight: 4 }}>{cat.icon}</span>
                    <span style={{ flex: 1, fontSize: 15, cursor: "pointer" }}
                      onClick={() => { setEditCatId(cat.id); setEditCatLabel(cat.label); }}>
                      {cat.label}
                    </span>
                    <button style={S.iconBtn} onClick={() => { setEditCatId(cat.id); setEditCatLabel(cat.label); }}>
                      <Pencil size={14} color="#B8B2A8" />
                    </button>
                    <button style={S.iconBtn} onClick={() => verwijderCat(cat.id)}>
                      <Trash2 size={15} color="#B8B2A8" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div style={{ ...S.card, border: "1px solid #2D4A3E44" }}>
            <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#2D4A3E" }}>+ Nieuwe categorie</p>
            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Naam" value={newCatLabel}
              onChange={e => setNewCatLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && voegCatToe()} autoFocus />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {CAT_ICONEN.map(ic => (
                <button key={ic} onClick={() => setNewCatIcon(ic)}
                  style={{ width: 36, height: 36, borderRadius: 9, border: newCatIcon === ic ? "2px solid #2D4A3E" : "1px solid #E4DCCB", background: newCatIcon === ic ? "#FFFFFF" : "#FAF6F0", fontSize: 17, cursor: "pointer" }}>
                  {ic}
                </button>
              ))}
            </div>
            <button style={{ ...S.btn(), width: "100%" }} onClick={voegCatToe}>Toevoegen</button>
          </div>
        </main>
      </div>
    );
  }

  // ════════════════════════════
  // LIJST-DETAIL
  // ════════════════════════════
  if (activeList) {
    const defaultCatId = activeList.categories[0]?.id;
    if (newCategory === null && defaultCatId) setNewCategory(defaultCatId);

    const suggestions = Object.values(activeList.history || {})
      .filter(h => h.count >= 1)
      .filter(h => !activeList.items.some(i => i.name.toLowerCase() === h.name.toLowerCase()))
      .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
      .slice(0, 10);

    // Cross-lijst favorieten: favorieten uit andere lijsten die nog niet in suggesties staan
    const andereListFavs = lists
      .filter(l => l.id !== activeListId)
      .flatMap(l => (l.favorites || []).map(f => ({ ...f, vanLijst: l.name })))
      .filter(f => !activeList.items.some(i => i.name.toLowerCase() === f.name.toLowerCase()))
      .filter(f => !suggestions.some(s => s.name.toLowerCase() === f.name.toLowerCase()))
      .slice(0, 5);

    const checkedCount = activeList.items.filter(i => i.checked).length;

    // Zoekfilter
    const zoekLower = zoekterm.toLowerCase();
    const zoekActief = showZoek && zoekterm.length > 0;

    const alleItems = verbergAfgevinkt
      ? activeList.items.filter(i => !i.checked)
      : activeList.items;

    const gefilterd = zoekActief
      ? alleItems.filter(i => i.name.toLowerCase().includes(zoekLower))
      : alleItems;

    const sorteerAlfabetisch = (a, b) => a.name.localeCompare(b.name, "nl", { sensitivity: "base" });
    // Voor to-do-lijsten is de sortering zelf gekozen (handmatig/vervaldatum/
    // alfabetisch) — "handmatig" laat de invoegvolgorde met rust, dat is de
    // enige plek waar we bewust NIET automatisch sorteren.
    const sorteerFn = isTodo
      ? todoSortering === "vervaldatum"
        ? (a, b) => (a.dueDate || "9999") .localeCompare(b.dueDate || "9999") || sorteerAlfabetisch(a, b)
        : todoSortering === "alfabetisch"
          ? sorteerAlfabetisch
          : null // handmatig: geen sortering, invoegvolgorde behouden
      : sorteerAlfabetisch;
    const toepassenSortering = arr => sorteerFn ? [...arr].sort(sorteerFn) : arr;

    // Bij to-do-lijsten verhuizen voltooide taken naar een aparte sectie
    // onderaan (net als "Completed" in Microsoft To Do) i.p.v. tussen de
    // actieve taken te blijven staan. Bij andere lijsttypes blijft het
    // bestaande gedrag (inline, evt. verborgen via het oog-icoon) gewoon
    // ongewijzigd — dat is hoe een boodschappenlijst juist wél moet werken.
    const teGroeperen = isTodo ? gefilterd.filter(i => !i.checked) : gefilterd;
    const voltooideItems = isTodo
      ? gefilterd.filter(i => i.checked).sort((a,b) => (b.lastActionAt||0) - (a.lastActionAt||0))
      : [];

    const grouped = activeList.categories
      .map(cat => ({
        cat,
        items: toepassenSortering(teGroeperen.filter(i => i.category === cat.id)),
      }))
      .filter(g => g.items.length > 0);

    const uncategorized = toepassenSortering(teGroeperen.filter(i => !activeList.categories.find(c => c.id === i.category)));

    return (
      <div style={S.appBg}>
        {/* Toast / Undo */}
        {toast && (
          <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: toastType === "undo" ? "#1A1A2E" : "#2D4A3E", color: "#FAF6F0", padding: "9px 16px", borderRadius: 10, fontWeight: 700, zIndex: 999, fontSize: 13, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 12 }}>
            <span>{toast}</span>
            {toastType === "undo" && (
              <button onClick={undoRemove} style={{ background: "#C86E4A", color: "#FAF6F0", border: "none", borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Ongedaan maken
              </button>
            )}
          </div>
        )}

        {/* Offline banner */}
        {offline && (
          <div style={{ background: "#C86E4A", color: "#FAF6F0", padding: "8px 16px", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
            📡 Geen verbinding — je ziet de laatst opgehaalde gegevens. Wijzigen kan pas weer zodra je online bent.
          </div>
        )}

        {/* Note-editor overlay */}
        {editNoteId && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }} onClick={() => setEditNoteId(null)}>
            <div style={{ background: "#FFFFFF", width: "100%", padding: "20px 20px 36px", borderTopLeftRadius: 20, borderTopRightRadius: 20 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>📝 Notitie</p>
                <button onClick={() => setEditNoteId(null)} aria-label="Sluiten"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <X size={18} color="#B8B2A8" />
                </button>
              </div>
              <textarea autoFocus style={{ ...S.inp, height: 80, resize: "none" }} value={editNoteText}
                onChange={e => setEditNoteText(e.target.value)} placeholder="Voeg een notitie toe…" />
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button style={{ ...S.btn("#E4DCCB", "#2D2A26"), flex: 1 }} onClick={() => setEditNoteId(null)}>Annuleer</button>
                <button style={{ ...S.btn(), flex: 2 }} onClick={() => { updateItem(editNoteId, { note: editNoteText }); setEditNoteId(null); showToast("✅ Notitie opgeslagen"); }}>Opslaan</button>
              </div>
            </div>
          </div>
        )}

        {/* Categorie-wijziger overlay */}
        {wijzigCatItemId && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }} onClick={() => setWijzigCatItemId(null)}>
            <div style={{ background: "#FFFFFF", width: "100%", padding: "20px 20px 36px", borderTopLeftRadius: 20, borderTopRightRadius: 20 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>Verplaats naar categorie</p>
                <button onClick={() => setWijzigCatItemId(null)} aria-label="Sluiten"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <X size={18} color="#B8B2A8" />
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {activeList.categories.map(cat => {
                  const huidig = activeList.items.find(i => i.id === wijzigCatItemId)?.category === cat.id;
                  return (
                    <button key={cat.id}
                      style={{ ...S.pickChip, background: huidig ? "#2D4A3E" : "#FAF6F0", color: huidig ? "#FAF6F0" : "#2D2A26", fontWeight: huidig ? 700 : 400 }}
                      onClick={() => { wijzigItemCategorie(wijzigCatItemId, cat.id); setWijzigCatItemId(null); showToast(`✅ Verplaatst naar ${cat.label}`); }}>
                      {cat.icon} {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Taakdetail-modal (to-do-lijsten): vervaldatum, toewijzen, herhaling, belangrijk, substappen */}
        {taakDetailId && activeList.items.find(i => i.id === taakDetailId) && (() => {
          const taak = activeList.items.find(i => i.id === taakDetailId);
          const HERHALINGEN = [["dagelijks","Dagelijks"],["wekelijks","Wekelijks"],["maandelijks","Maandelijks"]];
          const TOEWIJSBAAR = ["Pepijn", "Tessa", "Jimmy"];
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }} onClick={() => setTaakDetailId(null)}>
              <div style={{ background: "#FFFFFF", width: "100%", maxHeight: "88vh", overflowY: "auto", padding: "20px 20px 36px", borderTopLeftRadius: 20, borderTopRightRadius: 20 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => toggleBelangrijk(taak.id)} title="Belangrijk" style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      <Star size={18} color={taak.belangrijk ? "#C97D0C" : "#D8D0BF"} fill={taak.belangrijk ? "#C97D0C" : "none"} />
                    </button>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{taak.name}</p>
                  </div>
                  <button onClick={() => setTaakDetailId(null)} aria-label="Sluiten" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                    <X size={18} color="#B8B2A8" />
                  </button>
                </div>

                <p style={{ fontSize: 12, color: "#8C8576", fontWeight: 600, margin: "0 0 6px" }}>Vervaldatum</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <input type="date" style={{ ...S.inp, flex: 1 }} value={taak.dueDate || ""}
                    onChange={e => zetVervaldatum(taak.id, e.target.value)} />
                  {taak.dueDate && (
                    <button style={{ ...S.iconBtn, border: "1px solid #E4DCCB", borderRadius: 10 }} onClick={() => zetVervaldatum(taak.id, null)} title="Vervaldatum wissen">
                      <X size={14} color="#8C8576" />
                    </button>
                  )}
                </div>

                <p style={{ fontSize: 12, color: "#8C8576", fontWeight: 600, margin: "0 0 6px" }}>Herhaling</p>
                <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                  {HERHALINGEN.map(([id, label]) => (
                    <button key={id} onClick={() => zetHerhaling(taak.id, id)}
                      style={{ ...S.pickChip, background: taak.herhaling === id ? "#2D4A3E" : "#FAF6F0", color: taak.herhaling === id ? "#FAF6F0" : "#2D2A26", fontWeight: taak.herhaling === id ? 700 : 400 }}>
                      🔁 {label}
                    </button>
                  ))}
                </div>
                {taak.herhaling && (
                  <p style={{ fontSize: 11, color: "#8C8576", margin: "-10px 0 16px" }}>
                    Zodra je 'm afvinkt, schuift de vervaldatum automatisch door naar de volgende keer i.p.v. dat de taak afgevinkt blijft staan.
                  </p>
                )}

                <p style={{ fontSize: 12, color: "#8C8576", fontWeight: 600, margin: "0 0 6px" }}>Toewijzen aan</p>
                <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                  {TOEWIJSBAAR.map(persoon => (
                    <button key={persoon} onClick={() => zetToegewezenAan(taak.id, persoon)}
                      style={{ ...S.pickChip, background: taak.assignedTo === persoon ? "#2D4A3E" : "#FAF6F0", color: taak.assignedTo === persoon ? "#FAF6F0" : "#2D2A26", fontWeight: taak.assignedTo === persoon ? 700 : 400 }}>
                      👤 {persoon}
                    </button>
                  ))}
                </div>

                <p style={{ fontSize: 12, color: "#8C8576", fontWeight: 600, margin: "0 0 6px" }}>Substappen</p>
                {(taak.substappen||[]).map(stap => (
                  <div key={stap.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span role="checkbox" aria-checked={stap.afgevinkt} tabIndex={0}
                      style={{ ...S.checkbox, width: 18, height: 18, ...(stap.afgevinkt ? S.checkboxOn : {}) }}
                      onClick={() => toggleSubstap(taak.id, stap.id)}
                      onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggleSubstap(taak.id, stap.id))}>
                      {stap.afgevinkt && <Check size={10} color="#FAF6F0" strokeWidth={3} />}
                    </span>
                    <span style={{ flex: 1, fontSize: 14, color: stap.afgevinkt ? "#B8B2A8" : "#2D2A26", textDecoration: stap.afgevinkt ? "line-through" : "none" }}>
                      {stap.tekst}
                    </span>
                    <button onClick={() => verwijderSubstap(taak.id, stap.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                      <X size={13} color="#D8D0BF" />
                    </button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 16 }}>
                  <input style={{ ...S.inp, flex: 1, fontSize: 13, padding: "8px 12px" }} placeholder="Substap toevoegen…" value={nieuweSubstap}
                    onChange={e => setNieuweSubstap(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { voegSubstapToe(taak.id, nieuweSubstap); setNieuweSubstap(""); } }} />
                  <button style={{ ...S.btn(), padding: "8px 14px", fontSize: 13 }}
                    onClick={() => { voegSubstapToe(taak.id, nieuweSubstap); setNieuweSubstap(""); }}>+</button>
                </div>

                <p style={{ fontSize: 12, color: "#8C8576", fontWeight: 600, margin: "0 0 6px" }}>Notitie</p>
                <textarea style={{ ...S.inp, height: 60, resize: "none" }} value={taak.note || ""}
                  onChange={e => updateItem(taak.id, { note: e.target.value })} placeholder="Extra context…" />

                <button style={{ ...S.btn(), width: "100%", marginTop: 18 }} onClick={() => setTaakDetailId(null)}>Klaar</button>
              </div>
            </div>
          );
        })()}

        {/* Vorige lijst overlay */}
        {showVorigeLijst && (activeList.archief?.length > 0) && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }} onClick={() => setShowVorigeLijst(false)}>
            <div style={{ background: "#FFFFFF", width: "100%", maxHeight: "75vh", overflowY: "auto", padding: "20px 20px 36px", borderTopLeftRadius: 20, borderTopRightRadius: 20, boxSizing: "border-box" }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>📅 Vorige rondes</p>
                <button onClick={() => setShowVorigeLijst(false)} aria-label="Sluiten"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <X size={18} color="#B8B2A8" />
                </button>
              </div>
              {activeList.archief.map((ronde, idx) => (
                <div key={idx} style={{ border: "1px solid #EFE9DC", borderRadius: 14, padding: 14, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#2D4A3E" }}>📅 {ronde.datum} — {ronde.items.length} items</span>
                    <button style={{ ...S.btn(), fontSize: 12, padding: "6px 14px" }} onClick={() => laadVorigeLijst(ronde)}>
                      Alles toevoegen
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {ronde.items.map((item, i) => {
                      const alInLijst = activeList.items.some(li => li.name.toLowerCase() === item.name.toLowerCase());
                      return (
                        <button key={i} disabled={alInLijst}
                          style={{ ...S.pickChip, opacity: alInLijst ? 0.4 : 1, cursor: alInLijst ? "default" : "pointer" }}
                          onClick={() => { if (!alInLijst) addItem(item.name, item.category, item.amount, item.unit); }}>
                          {item.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <header style={{ ...S.header, flexWrap: "wrap", rowGap: 10 }}>
          <div>
            <button style={S.switchBtn} onClick={() => { setActiveListId(null); setMode("lijst"); setShowAdd(false); setShowZoek(false); setZoekterm(""); }}>
              ← Alle lijsten
            </button>
            <h1 style={S.title}>{activeList.icon} {activeList.name}</h1>
            {laatstBijgewerkt && (
              <p style={{ margin: 0, fontSize: 10, color: "#C8C0B4", marginTop: 2 }}>
                bijgewerkt {laatstBijgewerkt.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button style={{ ...S.iconBtn, background: "#FFFFFF", border: "1px solid #EFE9DC", borderRadius: 10, padding: "6px 8px" }}
              onClick={() => { setShowZoek(v => !v); if (showZoek) setZoekterm(""); }} title="Zoeken">
              <span style={{ fontSize: 15 }}>🔍</span>
            </button>
            {(activeList.archief?.length > 0) && (
              <button style={{ ...S.iconBtn, background: "#FFFFFF", border: "1px solid #EFE9DC", borderRadius: 10, padding: "6px 8px" }}
                onClick={() => setShowVorigeLijst(true)} title="Vorige ronde laden">
                <History size={16} color="#8C8576" />
              </button>
            )}
            {!isTodo && (
              <button style={{ ...S.iconBtn, background: "#FFFFFF", border: "1px solid #EFE9DC", borderRadius: 10, padding: "6px 8px" }}
                onClick={() => setVerbergAfgevinkt(v => !v)} title={verbergAfgevinkt ? "Toon afgevinkt" : "Verberg afgevinkt"}>
                {verbergAfgevinkt ? <Eye size={16} color="#2D4A3E" /> : <EyeOff size={16} color="#8C8576" />}
              </button>
            )}
            {gefilterd.length > 0 && (
              <button style={{ ...S.iconBtn, background: "#FFFFFF", border: "1px solid #EFE9DC", borderRadius: 10, padding: "6px 8px" }}
                onClick={() => toggleAlles(gefilterd.map(i => i.id))}
                title={gefilterd.every(i => i.checked) ? "Alles deselecteren" : "Alles selecteren"}>
                <CheckCheck size={16} color={gefilterd.every(i => i.checked) ? "#2D4A3E" : "#8C8576"} />
              </button>
            )}
            {isTodo && (
              <button style={{ ...S.iconBtn, background: "#FFFFFF", border: "1px solid #EFE9DC", borderRadius: 10, padding: "6px 8px" }}
                onClick={resetTodoLijst} title="Lijst resetten (alles weer op niet-gedaan)">
                <RotateCcw size={16} color="#8C8576" />
              </button>
            )}
            <button style={{ ...S.iconBtn, background: "#FFFFFF", border: "1px solid #EFE9DC", borderRadius: 10, padding: "6px 8px" }}
              onClick={() => setMode("instellingen")} title="Categorieën beheren">
              <Settings size={16} color="#8C8576" />
            </button>
          </div>
        </header>

        {/* Zoekbalk */}
        {showZoek && (
          <div style={{ padding: "0 20px 12px" }}>
            <input autoFocus style={{ ...S.inp, fontSize: 15 }} placeholder="🔍 Zoek in lijst…"
              value={zoekterm} onChange={e => setZoekterm(e.target.value)} />
          </div>
        )}

        {isTodo && (
          <div style={{ padding: "0 20px 12px", display: "flex", gap: 6 }}>
            {[["handmatig","Handmatig"],["vervaldatum","Vervaldatum"],["alfabetisch","A-Z"]].map(([id,label]) => (
              <button key={id} onClick={() => setTodoSortering(id)}
                style={{ border: todoSortering === id ? "1.5px solid #2D4A3E" : "1px solid #E4DCCB", background: todoSortering === id ? "#2D4A3E" : "#FFFFFF", color: todoSortering === id ? "#FAF6F0" : "#8C8576", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {label}
              </button>
            ))}
          </div>
        )}

        <main style={S.main}>
          {/* Suggesties */}
          {!isTodo && (suggestions.length > 0 || andereListFavs.length > 0) && !showAdd && !zoekActief && (
            <section style={{ marginBottom: 22 }}>
              {suggestions.length > 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#C86E4A", marginBottom: 10 }}>
                    <Sparkles size={15} color="#C86E4A" />
                    Vaak gebruikt — toevoegen?
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: andereListFavs.length > 0 ? 12 : 0 }}>
                    {suggestions.map(s => {
                      const cat = activeList.categories.find(c => c.id === s.category);
                      return (
                        <button key={s.name} style={S.suggestChip}
                          onClick={() => addItem(s.name, s.category, s.amount || 1, s.unit || "stuks")}>
                          {cat?.icon || "📦"} {s.name}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {andereListFavs.length > 0 && (
                <>
                  <div style={{ fontSize: 12, color: "#B8B2A8", fontWeight: 600, marginBottom: 8 }}>⭐ Favorieten uit andere lijsten</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {andereListFavs.map(f => (
                      <button key={f.name} style={{ ...S.suggestChip, borderColor: "#D4C8F0", background: "#F5F0FF" }}
                        onClick={() => addItem(f.name, activeList.categories[0]?.id, 1, "stuks")}>
                        ⭐ {f.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {/* Zoekresultaten leeg */}
          {zoekActief && gefilterd.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ fontSize: 16, color: "#B8B2A8" }}>Geen items gevonden voor "{zoekterm}"</p>
            </div>
          )}

          {/* Lege lijst */}
          {!zoekActief && activeList.items.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#2D4A3E", margin: "0 0 6px" }}>Lijst is leeg</p>
              <p style={{ fontSize: 14, color: "#B8B2A8", margin: 0 }}>Tik op + om je eerste item toe te voegen.</p>
            </div>
          )}

          {/* Items per categorie */}
          {grouped.map(({ cat, items }) => {
            const ingeklapt = !!ingeklapteCategorieen[cat.id];
            const aangevinkt = items.filter(i => i.checked).length;
            return (
              <section key={cat.id} style={{ marginBottom: 16 }}>
                {editCatId === cat.id ? (
                  <div style={{ background: "#FFFFFF", border: "1px solid #EFE9DC", borderRadius: 12, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 18 }}>{cat.icon}</span>
                      <input autoFocus style={{ ...S.inp, flex: 1, padding: "8px 12px", fontSize: 14 }} value={editCatLabel}
                        onChange={e => setEditCatLabel(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && hernoemCat(cat.id, editCatLabel)} />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                      {CAT_ICONEN.map(ic => (
                        <button key={ic} onClick={() => wijzigCatIcoon(cat.id, ic)}
                          style={{ width: 30, height: 30, borderRadius: 8, border: cat.icon === ic ? "2px solid #2D4A3E" : "1px solid #E4DCCB", background: cat.icon === ic ? "#FAF6F0" : "#FFFFFF", fontSize: 14, cursor: "pointer" }}>
                          {ic}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ ...S.btn("#E4DCCB", "#2D2A26"), flex: 1, padding: "8px 0", fontSize: 13 }} onClick={() => setEditCatId(null)}>Annuleer</button>
                      <button style={{ ...S.btn(), flex: 1, padding: "8px 0", fontSize: 13 }} onClick={() => hernoemCat(cat.id, editCatLabel)}>Opslaan</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ ...S.catHeading, marginBottom: ingeklapt ? 0 : 6 }}
                    onClick={() => setIngeklapteCategorieen(prev => ({ ...prev, [cat.id]: !ingeklapt }))}>
                    <span>{cat.icon} {cat.label}</span>
                    <button onClick={e => { e.stopPropagation(); setEditCatId(cat.id); setEditCatLabel(cat.label); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", opacity: 0.6 }} title="Categorie hernoemen">
                      <Pencil size={11} color="#8C8576" />
                    </button>
                    <span style={{ fontSize: 11, color: "#B8B2A8", fontWeight: 400, marginLeft: "auto" }}>
                      {aangevinkt}/{items.length}
                    </span>
                    <span style={{ fontSize: 14, color: "#B8B2A8", marginLeft: 4 }}>{ingeklapt ? "▸" : "▾"}</span>
                  </div>
                )}
                {!ingeklapt && (
                  <ul style={S.itemList}>
                    {items.map(item => (
                  <li key={item.id} style={S.itemRow}>
                    <span role="checkbox" aria-checked={item.checked} tabIndex={0}
                      style={{ ...S.checkbox, ...(item.checked ? S.checkboxOn : {}) }}
                      onClick={() => toggleCheck(item.id)}
                      onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggleCheck(item.id))}>
                      {item.checked && <Check size={12} color="#FAF6F0" strokeWidth={3} />}
                    </span>
                    <div style={S.itemMain}>
                      {editingId === item.id ? (
                        <input autoFocus style={S.editInput} value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onBlur={saveEditName}
                          onKeyDown={e => e.key === "Enter" && saveEditName()} />
                      ) : (
                        <span style={{ ...S.itemName, ...(item.checked ? S.itemNameChecked : {}), display: "inline-flex", alignItems: "center" }}
                          onClick={() => { setEditingId(item.id); setEditName(item.name); }}>
                          {item.name}
                          <WieBadge persoon={item.lastActionBy} tijdstip={item.lastActionAt} />
                        </span>
                      )}

                      {isCadeau ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <select style={{ ...S.unitSelect, fontSize: 11 }} value={item.status || "Idee"}
                            onChange={e => updateItem(item.id, { status: e.target.value })}>
                            {CADEAU_STATUSSEN.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <input style={{ ...S.unitSelect, width: 70, fontSize: 11 }} placeholder="Budget €"
                            value={item.budget || ""} onChange={e => updateItem(item.id, { budget: e.target.value })} />
                        </div>
                      ) : isTodo ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 2 }}>
                          {item.belangrijk && <Star size={13} color="#C97D0C" fill="#C97D0C" />}
                          {item.dueDate && (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 8, background: isVerlopen(item.dueDate) && !item.checked ? "#C0392B18" : "#EFE9DC", color: isVerlopen(item.dueDate) && !item.checked ? "#C0392B" : "#8C8576" }}>
                              📅 {formatVervaldatum(item.dueDate)}
                            </span>
                          )}
                          {item.herhaling && (
                            <span style={{ fontSize: 11, color: "#8C8576" }} title={`Herhaalt ${item.herhaling}`}>🔁</span>
                          )}
                          {item.assignedTo && (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 8, background: "#2D4A3E14", color: "#2D4A3E" }}>
                              👤 {item.assignedTo}
                            </span>
                          )}
                          {(item.substappen||[]).length > 0 && (
                            <span style={{ fontSize: 11, color: "#8C8576" }}>
                              ☑️ {item.substappen.filter(s=>s.afgevinkt).length}/{item.substappen.length}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div style={S.amountRow}>
                          <button style={S.amountBtn} onClick={() => changeAmount(item.id, -1)}>−</button>
                          <input
                            style={{ fontSize: 12, color: "#8C8576", border: "1px solid #E4DCCB", borderRadius: 5, padding: "1px 3px", width: 36, textAlign: "center", background: "#FAF6F0" }}
                            value={item.amount ?? 1}
                            onChange={e => updateItem(item.id, { amount: e.target.value })}
                            onBlur={e => setAmountDirect(item.id, e.target.value)}
                            onKeyDown={e => e.key === "Enter" && setAmountDirect(item.id, e.target.value)}
                          />
                          <button style={S.amountBtn} onClick={() => changeAmount(item.id, 1)}>+</button>
                          <select style={S.unitSelect} value={item.unit || "stuks"}
                            onChange={e => updateItem(item.id, { unit: e.target.value })}>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      )}

                      {item.note ? (
                        <span style={S.itemNote} onClick={() => { setEditNoteId(item.id); setEditNoteText(item.note); }}>
                          📝 {item.note}
                        </span>
                      ) : null}
                    </div>

                    {/* Acties */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button style={S.iconBtn} onClick={() => { setEditNoteId(item.id); setEditNoteText(item.note || ""); }}>
                        <Pencil size={13} color={item.note ? "#C86E4A" : "#D8D0BF"} />
                      </button>
                      {isTodo && (
                        <button style={S.iconBtn} title="Taakdetails" onClick={() => setTaakDetailId(item.id)}>
                          <MoreHorizontal size={14} color="#8C8576" />
                        </button>
                      )}
                      {!isCadeau && !isTodo && (
                        <>
                          <button style={S.iconBtn} onClick={() => toggleFavorite(item.name, item.category)}>
                            <Star size={13}
                              color={activeList.favorites.some(f => f.name.toLowerCase() === item.name.toLowerCase()) ? "#C86E4A" : "#D8D0BF"}
                              fill={activeList.favorites.some(f => f.name.toLowerCase() === item.name.toLowerCase()) ? "#C86E4A" : "none"} />
                          </button>
                          <button style={S.iconBtn} title="Categorie wijzigen"
                            onClick={() => setWijzigCatItemId(item.id)}>
                            <span style={{ fontSize: 12, lineHeight: 1 }}>📂</span>
                          </button>
                        </>
                      )}
                      <button style={S.iconBtn} onClick={() => removeItem(item.id)}>
                        <X size={13} color="#D8D0BF" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
                )}
            </section>
            );
          })}

          {uncategorized.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <div style={S.catHeading}>📦 Overig</div>
              <ul style={S.itemList}>
                {uncategorized.map(item => (
                  <li key={item.id} style={S.itemRow}>
                    <span role="checkbox" aria-checked={item.checked} tabIndex={0}
                      style={{ ...S.checkbox, ...(item.checked ? S.checkboxOn : {}) }}
                      onClick={() => toggleCheck(item.id)}
                      onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggleCheck(item.id))}>
                      {item.checked && <Check size={14} color="#FAF6F0" strokeWidth={3} />}
                    </span>
                    <div style={S.itemMain}>
                      <span style={{ ...S.itemName, ...(item.checked ? S.itemNameChecked : {}) }}>{item.name}</span>
                    </div>
                    <button style={S.iconBtn} onClick={() => removeItem(item.id)}>
                      <X size={13} color="#D8D0BF" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Voltooid — alleen bij to-do-lijsten, ingeklapt net als in
              Microsoft To Do. Simpelere rij dan actieve taken: geen
              vervaldatum/toewijzen-bewerking meer nodig voor iets dat al
              klaar is, alleen uitvinken of verwijderen. */}
          {isTodo && voltooideItems.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <div style={S.catHeading} onClick={() => setVoltooidIngeklapt(v => !v)}>
                <span>✅ Voltooid</span>
                <span style={{ fontSize: 11, color: "#B8B2A8", fontWeight: 400, marginLeft: "auto" }}>{voltooideItems.length}</span>
                <span style={{ fontSize: 14, color: "#B8B2A8", marginLeft: 4 }}>{voltooidIngeklapt ? "▸" : "▾"}</span>
              </div>
              {!voltooidIngeklapt && (
                <ul style={S.itemList}>
                  {voltooideItems.map(item => (
                    <li key={item.id} style={S.itemRow}>
                      <span role="checkbox" aria-checked={true} tabIndex={0}
                        style={{ ...S.checkbox, ...S.checkboxOn }}
                        onClick={() => toggleCheck(item.id)}
                        onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggleCheck(item.id))}>
                        <Check size={12} color="#FAF6F0" strokeWidth={3} />
                      </span>
                      <div style={S.itemMain}>
                        <span style={{ ...S.itemName, ...S.itemNameChecked, display: "inline-flex", alignItems: "center" }}>
                          {item.name}
                          <WieBadge persoon={item.lastActionBy} tijdstip={item.lastActionAt} />
                        </span>
                      </div>
                      <button style={S.iconBtn} onClick={() => removeItem(item.id)}>
                        <X size={13} color="#D8D0BF" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </main>

        {/* Toevoegen paneel */}
        {showAdd && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 9, display: "flex", alignItems: "flex-end" }}
            onClick={() => setShowAdd(false)}>
          <div style={S.addSheet} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#2D2A26" }}>Item toevoegen</h3>
              <button onClick={() => setShowAdd(false)} aria-label="Sluiten"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={20} color="#B8B2A8" />
              </button>
            </div>
            <div style={S.addTabs}>
              {(isTodo ? ["typen"] : ["typen", "favorieten"]).map(t => (
                <button key={t} style={S.addTabBtn(addTab === t)} onClick={() => setAddTab(t)}>
                  {t === "typen" ? "Typen" : "⭐ Favorieten"}
                </button>
              ))}
            </div>

            {addTab === "typen" && (
              <>
                <input autoFocus style={{ ...S.inp, marginBottom: 10 }} placeholder="Naam"
                  value={newProduct} onChange={e => setNewProduct(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addItem(newProduct, newCategory || defaultCatId, newAmount, newUnit, newNote, newStatus, newBudget)} />

                {isCadeau ? (
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <select style={{ ...S.inp, flex: 1, fontSize: 13 }} value={newStatus}
                      onChange={e => setNewStatus(e.target.value)}>
                      {CADEAU_STATUSSEN.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input style={{ ...S.inp, flex: 1, fontSize: 13 }} placeholder="Budget €"
                      value={newBudget} onChange={e => setNewBudget(e.target.value)} />
                  </div>
                ) : isTodo ? null : (
                  <div style={{ ...S.amountRow, marginBottom: 12 }}>
                    <button style={S.amountBtn} onClick={() => setNewAmount(a => {
                      const stap = newUnit === "g" ? 100 : ["kg","l","ml"].includes(newUnit) ? 0.5 : 1;
                      return Math.max(stap, Math.round((+a - stap) * 100) / 100);
                    })}>−</button>
                    <input style={{ fontSize: 13, color: "#8C8576", border: "1px solid #E4DCCB", borderRadius: 6, padding: "2px 4px", width: 44, textAlign: "center", background: "#FAF6F0" }}
                      value={newAmount} onChange={e => setNewAmount(e.target.value)}
                      onBlur={e => { const p = parseFloat(String(e.target.value).replace(",",".")); if (!isNaN(p) && p > 0) setNewAmount(p); }} />
                    <button style={S.amountBtn} onClick={() => setNewAmount(a => {
                      const stap = newUnit === "g" ? 100 : ["kg","l","ml"].includes(newUnit) ? 0.5 : 1;
                      return Math.round((+a + stap) * 100) / 100;
                    })}>+</button>
                    <select style={S.unitSelect} value={newUnit}
                      onChange={e => { setNewUnit(e.target.value); setNewAmount(e.target.value === "g" ? 100 : 1); }}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                )}

                <input style={{ ...S.inp, marginBottom: 12, fontSize: 14 }} placeholder="📝 Notitie (optioneel)"
                  value={newNote} onChange={e => setNewNote(e.target.value)} />

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  {activeList.categories.map(c => (
                    <button key={c.id} style={S.catPickerBtn((newCategory || defaultCatId) === c.id)}
                      onClick={() => setNewCategory(c.id)} title={c.label}>
                      {c.icon}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={{ ...S.btn("#E4DCCB", "#2D2A26"), flex: 1 }} onClick={() => setShowAdd(false)}>Annuleer</button>
                  <button style={{ ...S.btn(), flex: 2 }} onClick={() => addItem(newProduct, newCategory || defaultCatId, newAmount, newUnit, newNote, newStatus, newBudget)}>Toevoegen</button>
                </div>
              </>
            )}

            {addTab === "favorieten" && (
              <>
                {activeList.favorites.length === 0 ? (
                  <p style={{ fontSize: 14, color: "#B8B2A8", textAlign: "center", padding: "20px 0" }}>
                    Nog geen favorieten. Tik het ⭐-icoon bij een item om het hier te bewaren.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                    {activeList.favorites.map(f => {
                      const cat = activeList.categories.find(c => c.id === f.category);
                      return (
                        <button key={f.name} style={S.pickChip}
                          onClick={() => addItem(f.name, f.category, 1, "stuks")}>
                          {cat?.icon || "📦"} {f.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <button style={{ ...S.btn("#E4DCCB", "#2D2A26"), width: "100%" }} onClick={() => setShowAdd(false)}>Sluiten</button>
              </>
            )}
          </div>
          </div>
        )}

        <footer style={S.footer}>
          <button style={S.fab} onClick={() => { setShowAdd(true); setAddTab("typen"); }}>
            <Plus size={22} color="#FAF6F0" strokeWidth={2.4} />
          </button>
          {!isCadeau && !isTodo && (
            <button
              style={{ ...S.btn(checkedCount === 0 ? "#E4DCCB" : "#C86E4A", checkedCount === 0 ? "#B8B2A8" : "#FAF6F0"), flex: 1, borderRadius: 16, boxShadow: checkedCount > 0 ? "0 6px 16px rgba(200,110,74,0.28)" : "none" }}
              disabled={checkedCount === 0}
              onClick={startPakken}>
              {activeList.name.toLowerCase().includes("boodschappen")
                ? `Start boodschappen (${checkedCount})`
                : `Start pakken (${checkedCount})`}
            </button>
          )}
        </footer>
      </div>
    );
  }

  // ════════════════════════════
  // LIJSTENOVERZICHT
  // ════════════════════════════
  return (
    <div style={S.appBg}>
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#2D4A3E", color: "#FAF6F0", padding: "9px 20px", borderRadius: 10, fontWeight: 700, zIndex: 999, fontSize: 13, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      <header style={S.header}>
        <div>
          <Link href="/" style={S.switchBtn}>← Overzicht</Link>
          <h1 style={S.title}>Lijsten</h1>
        </div>
      </header>

      <main style={S.main}>
        {(() => {
          // "Mijn dag": alles wat vandaag of eerder moet (verlopen) of als
          // belangrijk gemarkeerd is, over alle to-do-lijsten heen — puur
          // ter info, echte bewerking gebeurt nog steeds in de lijst zelf.
          const mijnDagItems = lists
            .filter(l => l.type === "todo")
            .flatMap(l => l.items
              .filter(i => !i.checked && ((i.dueDate && i.dueDate <= vandaagStr()) || i.belangrijk))
              .map(i => ({ ...i, lijstId: l.id, lijstNaam: l.name, lijstIcoon: l.icon })));
          if (mijnDagItems.length === 0) return null;
          mijnDagItems.sort((a,b) => (a.dueDate||"9999").localeCompare(b.dueDate||"9999"));
          return (
            <div style={{ ...S.card, border: "1px solid #C97D0C33", background: "#C97D0C0A", marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#C97D0C" }}>☀️ Mijn dag</p>
              {mijnDagItems.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid #C97D0C22" }}>
                  <span role="checkbox" aria-checked={false} tabIndex={0}
                    style={{ ...S.checkbox, width: 20, height: 20, flexShrink: 0 }}
                    onClick={() => toggleCheckInList(item.lijstId, item.id)}
                    onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggleCheckInList(item.lijstId, item.id))} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {item.belangrijk && <Star size={12} color="#C97D0C" fill="#C97D0C" />}
                      <span style={{ fontSize: 14, color: "#2D2A26" }}>{item.name}</span>
                    </div>
                    <p style={{ margin: "1px 0 0", fontSize: 11, color: "#8C8576" }}>
                      {item.lijstIcoon} {item.lijstNaam}
                      {item.dueDate && isVerlopen(item.dueDate) && <span style={{ color: "#C0392B", fontWeight: 700 }}> · Verlopen</span>}
                      {item.dueDate && !isVerlopen(item.dueDate) && <span> · {formatVervaldatum(item.dueDate)}</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
          {lists.map((list, idx) => {
            const aantalItems = list.items.length;
            const aangevinkt = list.items.filter(i => i.checked).length;
            const isCadeauLijst = list.type === "cadeau";
            const gekocht = isCadeauLijst
              ? list.items.filter(i => ["Gekocht","Ingepakt","Gegeven"].includes(i.status)).length
              : null;
            return (
              <div key={list.id} style={{ ...S.card, cursor: "pointer", position: "relative" }}
                onClick={() => { setActiveListId(list.id); setNewCategory(list.categories[0]?.id || null); }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{list.icon}</div>
                {editListId === list.id ? (
                  <input autoFocus style={{ ...S.inp, fontSize: 14, padding: "6px 10px", marginBottom: 6 }}
                    value={editListNaam}
                    onChange={e => setEditListNaam(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onBlur={() => hernoemLijst(list.id, editListNaam)}
                    onKeyDown={e => e.key === "Enter" && hernoemLijst(list.id, editListNaam)} />
                ) : (
                  <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#2D4A3E" }}>{list.name}</p>
                )}
                <p style={{ margin: 0, fontSize: 12, color: "#B8B2A8" }}>
                  {aantalItems === 0 ? "Leeg"
                    : isCadeauLijst ? `${gekocht}/${aantalItems} gekocht`
                    : list.type === "todo" ? `${aangevinkt}/${aantalItems} gedaan`
                    : `${aangevinkt}/${aantalItems} aangevinkt`}
                </p>
                <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                  {/* Omhoog */}
                  {idx > 0 && (
                    <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4, fontSize: 12 }}
                      onClick={() => herschikLijsten(idx, idx - 1)} title="Omhoog">↑</button>
                  )}
                  {/* Omlaag */}
                  {idx < lists.length - 1 && (
                    <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4, fontSize: 12 }}
                      onClick={() => herschikLijsten(idx, idx + 1)} title="Omlaag">↓</button>
                  )}
                  <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} title="Dupliceren"
                    onClick={() => dupliceerLijst(list.id)}>
                    <span style={{ fontSize: 12 }}>⧉</span>
                  </button>
                  <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    onClick={() => { setEditListId(list.id); setEditListNaam(list.name); }}>
                    <Pencil size={13} color="#B8B2A8" />
                  </button>
                  <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    onClick={() => verwijderLijst(list.id)}>
                    <Trash2 size={13} color="#B8B2A8" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {showNieuw ? (
          <div style={{ ...S.card, border: "1px solid #2D4A3E44" }}>
            <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#2D4A3E" }}>Nieuwe lijst</p>
            <input style={{ ...S.inp, marginBottom: 12 }} placeholder="Naam (bv. Vakantie Spanje)"
              value={nieuwNaam} autoFocus onChange={e => setNieuwNaam(e.target.value)}
              onKeyDown={e => e.key === "Enter" && maakLijst()} />
            <p style={{ fontSize: 12, color: "#8C8576", margin: "0 0 8px" }}>Icoon</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {LIJST_ICONEN.map(ic => (
                <button key={ic} onClick={() => setNieuwIcoon(ic)}
                  style={{ width: 38, height: 38, borderRadius: 10, border: nieuwIcoon === ic ? "2px solid #2D4A3E" : "1px solid #E4DCCB", background: nieuwIcoon === ic ? "#FFFFFF" : "#FAF6F0", fontSize: 18, cursor: "pointer" }}>
                  {ic}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "#8C8576", margin: "0 0 8px" }}>Sjabloon</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {LIJST_SJABLONEN.map(s => (
                <button key={s.naam}
                  onClick={() => { setNieuwSjabloon(nieuwSjabloon === s.naam ? null : s.naam); setNieuwIcoon(s.icon); if (!nieuwNaam) setNieuwNaam(s.naam); }}
                  style={{ border: nieuwSjabloon === s.naam ? "2px solid #2D4A3E" : "1px solid #E4DCCB", background: nieuwSjabloon === s.naam ? "#2D4A3E" : "#FAF6F0", color: nieuwSjabloon === s.naam ? "#FAF6F0" : "#2D2A26", borderRadius: 20, padding: "7px 14px", fontSize: 13, cursor: "pointer", fontWeight: nieuwSjabloon === s.naam ? 700 : 400 }}>
                  {s.icon} {s.naam}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "#8C8576", margin: "0 0 8px" }}>Type lijst</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={() => setNieuwType("standaard")}
                style={{ flex: 1, textAlign: "left", border: nieuwType === "standaard" ? "2px solid #2D4A3E" : "1px solid #E4DCCB", background: nieuwType === "standaard" ? "#2D4A3E11" : "#FAF6F0", borderRadius: 12, padding: "10px 12px", cursor: "pointer" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#2D2A26" }}>✅ Voeg toe/afvink</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#8C8576" }}>Items toevoegen, afvinken zodra klaar/gekocht</p>
              </button>
              <button onClick={() => setNieuwType("todo")}
                style={{ flex: 1, textAlign: "left", border: nieuwType === "todo" ? "2px solid #2D4A3E" : "1px solid #E4DCCB", background: nieuwType === "todo" ? "#2D4A3E11" : "#FAF6F0", borderRadius: 12, padding: "10px 12px", cursor: "pointer" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#2D2A26" }}>📋 To-do</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#8C8576" }}>Terugkerende taken, later in één keer resetten</p>
              </button>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...S.btn("#E4DCCB", "#2D2A26"), flex: 1 }} onClick={() => setShowNieuw(false)}>Annuleer</button>
              <button style={{ ...S.btn(), flex: 2 }} onClick={maakLijst}>Aanmaken</button>
            </div>
          </div>
        ) : (
          <button style={{ ...S.btn("#FFFFFF", "#2D4A3E"), width: "100%", border: "2px dashed #D8D0BF", borderRadius: 18, padding: "18px 0", fontSize: 15 }}
            onClick={() => setShowNieuw(true)}>
            + Nieuwe lijst
          </button>
        )}
      </main>
    </div>
  );
}
