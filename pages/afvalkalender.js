import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, Settings, RefreshCw, Trash2 } from "lucide-react";

// ── Constanten ─────────────────────────────────────────
const AFVAL_TYPES = {
  papier:     { label: "Papier",              icon: "📦", kleur: "#2C6E8C" },
  gft:        { label: "GFT",                 icon: "🍂", kleur: "#4C9A2A" },
  pbd:        { label: "Plastic/blik/pak",    icon: "♻️", kleur: "#E0A800" },
  restafval:  { label: "Restafval",           icon: "🗑️", kleur: "#6B6B6B" },
  textiel:    { label: "Textiel",             icon: "👕", kleur: "#9B5DE5" },
  kerstboom:  { label: "Kerstboom",           icon: "🎄", kleur: "#2D6A4F" },
  grofvuil:   { label: "Grofvuil",            icon: "🛋️", kleur: "#8B5A2B" },
  kca:        { label: "Klein chemisch afval",icon: "☣️", kleur: "#D6273C" },
  takken:     { label: "Takken",              icon: "🌿", kleur: "#4C9A2A" },
};
function afvalInfo(naam) {
  const sleutel = (naam || "").toLowerCase().replace(/\s/g, "");
  return AFVAL_TYPES[sleutel] || { label: naam || "Onbekend", icon: "📥", kleur: "#8A9089" };
}
// Voor een samengevoegd kliko-kaartje (bv. Restafval + GFT) gebruiken we de
// override-velden i.p.v. terug te vallen op het (niet-bestaande) .name-veld.
function weergaveInfo(ophaling) {
  if (ophaling.naamOverride) return { label: ophaling.naamOverride, icon: ophaling.iconOverride, kleur: ophaling.kleurOverride };
  return afvalInfo(ophaling.name);
}

// Sommige afvaltypen delen fysiek dezelfde kliko en worden dus ook altijd op
// dezelfde dag opgehaald — die tonen we als één kaartje i.p.v. twee losse.
const KLIKO_GROEPEN = [
  { typen: ["restafval", "gft"], label: "Restafval + GFT", icon: "🗑️🍂", kleur: "#6B6B6B" },
  { typen: ["papier", "pbd"],    label: "Papier + Plastic", icon: "📦♻️", kleur: "#2C6E8C" },
];
// Groepeert ophalingen: vallen twee gekoppelde typen op dezelfde datum, dan
// worden ze samengevoegd tot één regel. Losse/niet-gekoppelde typen, of
// gekoppelde typen die toevallig op verschillende datums vallen, blijven
// gewoon apart staan.
function groepeerKlikos(ophalingen) {
  const gebruikt = new Set();
  const resultaat = [];
  for (const groep of KLIKO_GROEPEN) {
    const perDatum = {};
    ophalingen.forEach(o => {
      const sleutel = (o.name || "").toLowerCase().replace(/\s/g, "");
      if (groep.typen.includes(sleutel)) {
        if (!perDatum[o.date]) perDatum[o.date] = [];
        perDatum[o.date].push(o);
      }
    });
    Object.entries(perDatum).forEach(([datum, items]) => {
      if (items.length >= 2) {
        items.forEach(i => gebruikt.add(i));
        resultaat.push({ date: datum, daysTillDate: items[0].daysTillDate, naamOverride: groep.label, iconOverride: groep.icon, kleurOverride: groep.kleur });
      }
    });
  }
  ophalingen.forEach(o => { if (!gebruikt.has(o)) resultaat.push(o); });
  return resultaat;
}

function formatDatumLang(isoDatum) {
  const d = new Date(isoDatum);
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}
function dagenTekst(dagen) {
  if (dagen === 0) return "Vandaag";
  if (dagen === 1) return "Morgen";
  if (dagen < 0) return null; // in het verleden, niet meer tonen
  return `Over ${dagen} dagen`;
}

// ── Stijlen ─────────────────────────────────────────────
const C = {
  bg: "#F5F6F4", surf: "#FFFFFF", card: "#EBEEEA",
  border: "#DBE0DA", accent: "#3D7A5C", accentDark: "#26523C",
  text: "#262A27", muted: "#8A9089", red: "#C0392B", yellow: "#C97D0C",
};
const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: C.accentDark },
  main: { padding: "4px 20px 60px" },
  inp: { background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 15, width: "100%", boxSizing: "border-box", color: C.text },
  btn: (bg=C.accent, col="#FFFFFF") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  card: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 10 },
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
};

export default function AfvalkalenderApp() {
  const [config, setConfig] = useState(null); // null = nog niet geladen
  const [ophalingen, setOphalingen] = useState(null);
  const [laden, setLaden] = useState(true);
  const [verversLaden, setVerversLaden] = useState(false);
  const [fout, setFout] = useState(null);
  const [showInstellingen, setShowInstellingen] = useState(false);
  const [form, setForm] = useState({ locatie: "", postcode: "", huisnummer: "", huisnummerToevoeging: "" });
  const lastWriteRef = useRef(0);

  const laadOphalingen = useCallback(async () => {
    setVerversLaden(true);
    setFout(null);
    try {
      const res = await fetch("/api/afvalkalender?actie=ophalen");
      const data = await res.json();
      if (!res.ok) { setFout(data.error || "Kon de afvalkalender niet ophalen"); setOphalingen(null); }
      else setOphalingen(data.ophalingen || []);
    } catch (e) {
      setFout("Kon geen verbinding maken met de afvaldienst");
    }
    setVerversLaden(false);
  }, []);

  useEffect(() => {
    let actief = true;
    (async () => {
      try {
        const res = await fetch("/api/afvalkalender");
        const data = await res.json();
        if (!actief) return;
        setConfig(data);
        setForm({
          locatie: data.locatie || "", postcode: data.postcode || "",
          huisnummer: data.huisnummer || "", huisnummerToevoeging: data.huisnummerToevoeging || "",
        });
        setLaden(false);
        if (data.locatie && data.postcode && data.huisnummer) {
          await laadOphalingen();
        } else {
          setShowInstellingen(true);
        }
      } catch {
        setLaden(false);
        setShowInstellingen(true);
      }
    })();
    return () => { actief = false; };
  }, [laadOphalingen]);

  async function opslaanInstellingen() {
    const opgeschoond = {
      locatie: form.locatie.trim(),
      postcode: form.postcode.trim().toUpperCase().replace(/\s/g, ""),
      huisnummer: form.huisnummer.trim(),
      huisnummerToevoeging: form.huisnummerToevoeging.trim(),
    };
    if (!opgeschoond.locatie || !opgeschoond.postcode || !opgeschoond.huisnummer) return;
    lastWriteRef.current = Date.now();
    await fetch("/api/afvalkalender", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opgeschoond),
    });
    setConfig(opgeschoond);
    setShowInstellingen(false);
    await laadOphalingen();
  }

  if (laden) return (
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <Trash2 size={32} color={C.accent} />
        <p style={{ color: C.muted, fontSize: 14 }}>Afvalkalender laden…</p>
      </div>
    </div>
  );

  const heeftAdres = config && config.locatie && config.postcode && config.huisnummer;
  const zichtbareOphalingen = groepeerKlikos(ophalingen || [])
    .map(o => ({ ...o, dagen: o.daysTillDate }))
    .filter(o => o.dagen >= 0)
    .sort((a,b) => a.dagen - b.dagen);
  const volgende = zichtbareOphalingen[0];

  return (
    <div style={S.appBg}>
      <header style={S.header}>
        <div>
          <Link href="/" style={S.switchBtn}><ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> Terug</Link>
          <h1 style={S.title}>🗑️ Afvalkalender</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {heeftAdres && (
            <button onClick={laadOphalingen} disabled={verversLaden}
              style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: verversLaden ? "default" : "pointer" }}>
              <RefreshCw size={16} color={C.accent} style={{ animation: verversLaden ? "spin 1s linear infinite" : "none" }} />
            </button>
          )}
          <button onClick={() => setShowInstellingen(true)}
            style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Settings size={16} color={C.muted} />
          </button>
        </div>
      </header>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <main style={S.main}>
        {!heeftAdres && !showInstellingen && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: C.accentDark, margin: "0 0 6px" }}>Nog geen adres ingesteld</p>
            <p style={{ fontSize: 14, color: C.muted, margin: "0 0 16px" }}>Vul je locatie, postcode en huisnummer in om te beginnen.</p>
            <button style={S.btn()} onClick={() => setShowInstellingen(true)}>Adres instellen</button>
          </div>
        )}

        {heeftAdres && fout && (
          <div style={{ ...S.card, background: `${C.red}0F`, border: `1px solid ${C.red}44` }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.red }}>⚠️ Kon de afvalkalender niet ophalen</p>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: C.text }}>{fout}</p>
            <button style={{ ...S.btn(C.card, C.accentDark), border: `1px solid ${C.border}` }} onClick={laadOphalingen}>
              Opnieuw proberen
            </button>
          </div>
        )}

        {heeftAdres && !fout && volgende && (
          <div style={{ ...S.card, background: `${weergaveInfo(volgende).kleur}12`, border: `1px solid ${weergaveInfo(volgende).kleur}44`, textAlign: "center", padding: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 6 }}>{weergaveInfo(volgende).icon}</div>
            <p style={{ margin: "0 0 2px", fontSize: 19, fontWeight: 700, color: C.accentDark }}>{weergaveInfo(volgende).label}</p>
            <p style={{ margin: 0, fontSize: 14, color: C.muted }}>
              {dagenTekst(volgende.dagen)} · {formatDatumLang(volgende.date)}
            </p>
          </div>
        )}

        {heeftAdres && !fout && zichtbareOphalingen.length === 0 && (
          <p style={{ textAlign: "center", color: C.muted, fontSize: 14, padding: "20px 0" }}>Geen ophaaldata gevonden voor dit adres.</p>
        )}

        {heeftAdres && !fout && zichtbareOphalingen.slice(1).length > 0 && (
          <>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", margin: "18px 0 8px" }}>Daarna</p>
            {zichtbareOphalingen.slice(1).map((o, idx) => {
              const info = weergaveInfo(o);
              return (
                <div key={idx} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, padding: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>{info.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{info.label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: C.muted }}>{formatDatumLang(o.date)}</p>
                  </div>
                  <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{dagenTekst(o.dagen)}</span>
                </div>
              );
            })}
          </>
        )}

        {heeftAdres && (
          <p style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 20 }}>
            {config.locatie} · {config.postcode} {config.huisnummer}{config.huisnummerToevoeging}
          </p>
        )}
      </main>

      {showInstellingen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => heeftAdres && setShowInstellingen(false)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: C.accentDark }}>Adres instellen</h2>

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Gemeente/locatie</label>
            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="bv. Tilburg" value={form.locatie}
              onChange={e => setForm(f => ({ ...f, locatie: e.target.value }))} />

            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Postcode</label>
            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="bv. 5017AZ" value={form.postcode}
              onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} />

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Huisnummer</label>
                <input style={S.inp} placeholder="bv. 31" value={form.huisnummer}
                  onChange={e => setForm(f => ({ ...f, huisnummer: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Toevoeging</label>
                <input style={S.inp} placeholder="bv. A (optioneel)" value={form.huisnummerToevoeging}
                  onChange={e => setForm(f => ({ ...f, huisnummerToevoeging: e.target.value }))} />
              </div>
            </div>

            <p style={{ fontSize: 11, color: C.muted, margin: "0 0 16px" }}>
              De locatie moet exact overeenkomen met de naam van je gemeente bij de afvaldienst (bv. "Tilburg"). Klopt de gemeentenaam maar krijg je toch geen data, dan ligt dat aan de bron zelf — die is soms tijdelijk niet bereikbaar.
            </p>

            <div style={{ display: "flex", gap: 8 }}>
              {heeftAdres && (
                <button style={{ ...S.btn(C.card, C.text), border: `1px solid ${C.border}`, flex: 1 }} onClick={() => setShowInstellingen(false)}>
                  Annuleren
                </button>
              )}
              <button style={{ ...S.btn(), flex: 1 }} onClick={opslaanInstellingen}>
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
