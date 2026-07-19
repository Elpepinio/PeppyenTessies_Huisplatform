import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ---- Labels per bron, zodat de ruwe interne bron-code leesbaar wordt ----
const BRON_LABELS = {
  "planten-foto-analyse": { emoji: "🌱", label: "Planten — Foto analyseren" },
  "planten-foto-herkenning-nieuw": { emoji: "🌱", label: "Planten — Nieuwe plant herkennen" },
  "planten-advies": { emoji: "🌱", label: "Planten — Advies" },
  "planten-info": { emoji: "🌱", label: "Planten — Plant-informatie" },
  "planten-overig": { emoji: "🌱", label: "Planten — Overig" },
  "maaltijden-ai-kok": { emoji: "🍽️", label: "Maaltijden — AI-kok" },
  "maaltijden-ai-kok-import": { emoji: "🍽️", label: "Maaltijden — AI-kok (opslaan)" },
  "maaltijden-weekmenu-suggestie": { emoji: "🍽️", label: "Maaltijden — Weekmenu-suggestie" },
  "maaltijden-foto-import": { emoji: "🍽️", label: "Maaltijden — Foto van kookboek" },
  "maaltijden-foto-gerecht": { emoji: "🍴", label: "Maaltijden — Gerecht nakoken" },
  "maaltijden-foto-gerecht-verfijnen": { emoji: "🍴", label: "Maaltijden — Gerecht verfijnen" },
  "maaltijden-link-import": { emoji: "🍽️", label: "Maaltijden — Recept via link" },
  "maaltijden-overig": { emoji: "🍽️", label: "Maaltijden — Overig" },
  "places-foto-herkenning": { emoji: "🗺️", label: "Places — Foto herkennen" },
  "kijklijst-suggesties": { emoji: "🎬", label: "Kijklijst — Suggesties" },
  "bonnetjes-scan": { emoji: "🧾", label: "Bonnetjes — Bon scannen" },
  "bonnetjes-overig": { emoji: "🧾", label: "Bonnetjes — Overig" },
  "woonideeen-link-import": { emoji: "🏡", label: "Woonideeën — Link-import" },
  "woonideeen-prijsvergelijk": { emoji: "💰", label: "Woonideeën — Prijsvergelijking" },
  "woonideeen-screenshot": { emoji: "📸", label: "Woonideeën — Screenshot uitlezen" },
  "woonideeen-visueel-zoeken": { emoji: "🔍", label: "Woonideeën — Foto herkennen + prijzen zoeken" },
  "moodboard-voorbeelden": { emoji: "🎨", label: "Moodboard — Voorbeelden zoeken" },
  onbekend: { emoji: "❔", label: "Onbekend" },
};
function bronInfo(bron) { return BRON_LABELS[bron] || { emoji: "🤖", label: bron }; }

// Vaste, ruwe schatting van de euro-waarde — Anthropic factureert in USD, dus
// dit is een indicatie, geen exacte rekening (wisselkoers/afronding kunnen afwijken).
const USD_NAAR_EUR = 0.92;
const euro = n => `€${(n * USD_NAAR_EUR).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const C = {
  bg: "#F5F3F0", surf: "#FFFFFF", card: "#ECE8E2",
  border: "#DDD7CD", accent: "#3D3A34", accentDark: "#242220",
  text: "#242220", muted: "#8A8378", green: "#3A7D5C",
};

const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 12px" },
  title: { margin: "4px 0 0", fontSize: 24, fontWeight: 700, color: C.accentDark },
  main: { padding: "4px 20px 60px" },
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 12 },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
};

export default function AiKostenApp() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ai-gebruik").then(r => r.json()).then(d => {
      setLog(d.log || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <p style={{ fontSize: 30 }}>💰</p>
        <p style={{ color: C.muted, fontSize: 14 }}>AI-gebruik laden…</p>
      </div>
    </div>
  );

  const nu = new Date();
  const dezeMaandStr = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}`;

  const totaalUsd = log.reduce((s, e) => s + (e.kostenUsd || 0), 0);
  const dezeMaandUsd = log.filter(e => e.datum.startsWith(dezeMaandStr)).reduce((s, e) => s + (e.kostenUsd || 0), 0);
  const totaalAanroepen = log.length;
  const aanroepenDezeMaand = log.filter(e => e.datum.startsWith(dezeMaandStr)).length;

  // Kosten per bron (aflopend), voor de balk-grafiek
  const perBron = {};
  log.forEach(e => {
    perBron[e.bron] = (perBron[e.bron] || 0) + (e.kostenUsd || 0);
  });
  const bronData = Object.entries(perBron)
    .map(([bron, usd]) => ({ bron, label: bronInfo(bron).label.split("—")[1]?.trim() || bronInfo(bron).label, emoji: bronInfo(bron).emoji, euro: usd * USD_NAAR_EUR }))
    .sort((a, b) => b.euro - a.euro);

  // Kosten per maand, laatste 6 maanden — voor trend
  const maanden = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(nu.getFullYear(), nu.getMonth() - 5 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const maandNamen = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
  const maandData = maanden.map(m => {
    const [j, mm] = m.split("-");
    return {
      label: `${maandNamen[+mm - 1]} '${j.slice(2)}`,
      euro: log.filter(e => e.datum.startsWith(m)).reduce((s, e) => s + (e.kostenUsd || 0), 0) * USD_NAAR_EUR,
    };
  });

  const recent = [...log].reverse().slice(0, 25);

  return (
    <div style={S.appBg}>
      <header style={S.header}>
        <Link href="/" style={S.switchBtn}><ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> Terug</Link>
        <h1 style={S.title}>💰 AI-kosten</h1>
      </header>

      <main style={S.main}>
        <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, margin: "0 0 16px" }}>
          Schatting op basis van de officiële Anthropic-tarieven voor het gebruikte model (claude-sonnet-4-6:
          $3 / miljoen input-tokens, $15 / miljoen output-tokens), omgerekend naar euro's tegen een vaste koers.
          De echte Anthropic-rekening kan licht afwijken door wisselkoersschommelingen en afronding.
        </p>

        {log.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: C.accentDark, margin: "0 0 6px" }}>Nog geen AI-gebruik gelogd</p>
            <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>Zodra iemand een AI-functie gebruikt (Planten, Maaltijden, Places, Kijklijst) verschijnt dat hier.</p>
          </div>
        ) : (
          <>
            {/* Samenvattingskaarten */}
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ ...S.card, flex: 1, marginBottom: 0, textAlign: "center" }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase" }}>Deze maand</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.accentDark }}>{euro(dezeMaandUsd)}</p>
                <p style={{ margin: 0, fontSize: 11, color: C.muted }}>{aanroepenDezeMaand} aanroepen</p>
              </div>
              <div style={{ ...S.card, flex: 1, marginBottom: 0, textAlign: "center" }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase" }}>Totaal</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.accentDark }}>{euro(totaalUsd)}</p>
                <p style={{ margin: 0, fontSize: 11, color: C.muted }}>{totaalAanroepen} aanroepen</p>
              </div>
            </div>

            {/* Trend laatste 6 maanden */}
            <div style={S.card}>
              <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: C.accentDark }}>📊 Laatste 6 maanden</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={maandData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v.toFixed(2)}`} />
                  <Tooltip contentStyle={{ background: C.accentDark, border: "none", borderRadius: 8, color: "#FFF", fontSize: 11 }} formatter={v => [`€${v.toFixed(3)}`, "Kosten"]} />
                  <Bar dataKey="euro" fill={C.accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Kosten per tool/functie */}
            <div style={S.card}>
              <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: C.accentDark }}>🔍 Per functie</h3>
              {bronData.map(b => (
                <div key={b.bron} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 16 }}>{b.emoji}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{b.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>€{b.euro.toFixed(3)}</span>
                </div>
              ))}
            </div>

            {/* Recente aanroepen */}
            <div style={S.card}>
              <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: C.accentDark }}>🕓 Recente aanroepen</h3>
              {recent.map((e, i) => {
                const info = bronInfo(e.bron);
                const datum = new Date(e.datum);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 14 }}>{info.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>{info.label}</p>
                      <p style={{ margin: 0, fontSize: 10, color: C.muted }}>
                        {datum.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} {datum.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                        {e.gebruiker ? ` · ${e.gebruiker}` : ""}
                        {e.webSearches > 0 ? ` · 🔍 ${e.webSearches}x gezocht` : ""}
                      </p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>€{(e.kostenUsd * USD_NAAR_EUR).toFixed(3)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
