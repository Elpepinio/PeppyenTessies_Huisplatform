import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { BUILD_INFO } from "../lib/build-info";
import { Home, List, Wallet, LogOut, Lock, KeyRound, Settings, Eye, EyeOff } from "lucide-react";

const TOOLS = [
  {
    href: "/lijsten",
    label: "Lijsten",
    description: "Boodschappen, paklijsten, klussenlijsten en meer",
    emoji: "📋",
    color: "#2D4A3E",
  },
  {
    href: "/budget",
    label: "Budget",
    description: "Huishouduitgaven, budgetten en spaardoelen",
    emoji: "💰",
    color: "#C86E4A",
  },
  {
    href: "/planten",
    label: "Planten & Tuin",
    description: "Verzorging, seizoensadvies en AI-analyse",
    emoji: "🌿",
    color: "#2D6A4F",
  },
  {
    href: "/maaltijden",
    label: "Maaltijden",
    description: "Recepten, weekmenu en boodschappenlijst",
    emoji: "🍽️",
    color: "#8B4513",
  },
  {
    href: "/onderhoud",
    label: "Onderhoud",
    description: "Woning, camper en auto onderhoud bijhouden",
    emoji: "🔧",
    color: "#5B3FA6",
  },
  {
    href: "/places",
    label: "Places",
    description: "Plekken bewaren die je wil bezoeken of al bezocht hebt",
    emoji: "🗺️",
    color: "#2C5F9E",
  },
  {
    href: "/voorraad",
    label: "Voorraad",
    description: "Wat er in huis is, met bijna-op waarschuwingen",
    emoji: "📦",
    color: "#B8722E",
  },
  {
    href: "/verjaardagen",
    label: "Verjaardagen",
    description: "Wie er jarig is en cadeau-ideeën bijhouden",
    emoji: "🎂",
    color: "#D6336C",
  },
  {
    href: "/kijklijst",
    label: "Kijklijst",
    description: "Films en series die we willen kijken, met IMDb-score",
    emoji: "🎬",
    color: "#7A2E3B",
  },
  {
    href: "/schoolinfo",
    label: "Schoolinfo",
    description: "Schoolagenda, vrije dagen en vaste weekitems",
    emoji: "🏫",
    color: "#2C6E8C",
  },
  {
    href: "/bonnetjes",
    label: "Bonnetjes",
    description: "Aankoopbonnetjes scannen, garantie bijhouden en terugvinden",
    emoji: "🧾",
    color: "#8B5E34",
  },
  {
    href: "/woonideeen",
    label: "Woonideeën",
    description: "Inrichtingsideeën die je online tegenkomt, per kamer en categorie",
    emoji: "🏡",
    color: "#4A6B5A",
  },
  {
    href: "/ai-kosten",
    label: "AI-kosten",
    description: "Wat de AI-functies in de tools ons kosten",
    emoji: "💰",
    color: "#3D3A34",
  },
];

export default function Platform() {
  const [status, setStatus]               = useState("laden");
  const [name, setName]                   = useState("");
  const [wieBenJij, setWieBenJij]         = useState(null); // "Pepijn" | "Tessa"
  const [ingelogdAls, setIngelogdAls]     = useState(null);
  const [password, setPassword]           = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw]               = useState(false);
  const [error, setError]                 = useState("");
  const [busy, setBusy]                   = useState(false);
  const [showInstellingen, setShowInstellingen] = useState(false);
  // Wachtwoord wijzigen
  const [huidigPw, setHuidigPw]           = useState("");
  const [nieuwPw, setNieuwPw]             = useState("");
  const [nieuwPw2, setNieuwPw2]           = useState("");
  const [pwMsg, setPwMsg]                 = useState(null); // { ok, tekst }
  const [pwBusy, setPwBusy]               = useState(false);
  // Tweestapsverificatie — inloggen
  const [pendingToken, setPendingToken]   = useState(null); // niet-null = we zitten in de 2FA-stap
  const [tweeFACode, setTweeFACode]       = useState("");
  const [gebruikHerstelcode, setGebruikHerstelcode] = useState(false);
  // Tweestapsverificatie — instellen in het instellingenpaneel
  const [tfaEnabled, setTfaEnabled]       = useState(false);
  const [tfaSetup, setTfaSetup]           = useState(null); // { secret, qrDataUrl } tijdens instellen
  const [tfaConfirmCode, setTfaConfirmCode] = useState("");
  const [tfaDisablePw, setTfaDisablePw]   = useState("");
  const [tfaMsg, setTfaMsg]               = useState(null); // { ok, tekst }
  const [tfaBusy, setTfaBusy]             = useState(false);
  const [tfaRecoveryCodes, setTfaRecoveryCodes] = useState(null); // net getoonde herstelcodes (eenmalig zichtbaar)
  const [tfaRecoveryRemaining, setTfaRecoveryRemaining] = useState(0);
  const [tfaShowRegenerate, setTfaShowRegenerate] = useState(false);
  const [tfaRegeneratePw, setTfaRegeneratePw] = useState("");

  // ── Back-up & herstel ──
  const [laatsteBackup, setLaatsteBackup] = useState(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState(null);
  const [showHerstelForm, setShowHerstelForm] = useState(false);
  const [herstelBestand, setHerstelBestand] = useState(null); // geparste inhoud, wacht op bevestiging
  const [herstelBevestiging, setHerstelBevestiging] = useState("");
  const [herstelBusy, setHerstelBusy] = useState(false);
  const herstelFileRef = useRef();
  const [foutlog, setFoutlog] = useState(null);
  const [showFoutlog, setShowFoutlog] = useState(false);

  // ── Volgorde tools (gedeeld via Redis) ───────────────
  const [toolVolgorde, setToolVolgorde] = useState(TOOLS.map(t => t.href));
  const [bewerkVolgorde, setBewerkVolgorde] = useState(false);

  useEffect(() => {
    // Laad gedeelde volgorde zodra we ingelogd zijn
    if (status !== "overzicht") return;
    (async () => {
      try {
        const res = await fetch("/api/instellingen");
        if (!res.ok) return;
        const data = await res.json();
        if (data.toolVolgorde) {
          const opgeslagen = data.toolVolgorde;
          const nieuw = TOOLS.map(t => t.href).filter(h => !opgeslagen.includes(h));
          setToolVolgorde([...opgeslagen, ...nieuw]);
        }
      } catch {}
    })();
  }, [status]);

  async function verschuifTool(idx, richting) {
    const next = [...toolVolgorde];
    const naarIdx = idx + richting;
    if (naarIdx < 0 || naarIdx >= next.length) return;
    [next[idx], next[naarIdx]] = [next[naarIdx], next[idx]];
    setToolVolgorde(next);
    try {
      await fetch("/api/instellingen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolVolgorde: next }),
      });
    } catch {}
  }

  const gesorteerdeTools = toolVolgorde
    .map(href => TOOLS.find(t => t.href === href))
    .filter(Boolean);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) throw new Error("server");
        const data = await res.json();
        if (!data.accountExists) setStatus("setup");
        else if (data.loggedIn)  {
          setIngelogdAls(data.user || null); setStatus("overzicht");
          fetch("/api/auth/2fa-status").then(r => r.json()).then(d => { setTfaEnabled(!!d.enabled); setTfaRecoveryRemaining(d.recoveryCodesRemaining || 0); }).catch(() => {});
          fetch("/api/instellingen").then(r => r.json()).then(d => setLaatsteBackup(d.laatsteBackup || null)).catch(() => {});
        }
        else                     setStatus("login");
      } catch (e) {
        setStatus("fout");
      }
    })();
  }, []);

  async function handleSetup(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Wachtwoorden komen niet overeen"); return; }
    if (password.length < 12) { setError("Wachtwoord moet minstens 12 tekens zijn"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Kon account niet aanmaken"); setBusy(false); return; }
      window.location.href = "/";
    } catch (e) { setError("Geen verbinding met de server"); setBusy(false); }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    if (!wieBenJij) { setError("Kies eerst wie je bent"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, user: wieBenJij }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Wachtwoord onjuist"); setBusy(false); return; }
      if (data.needs2FA) {
        // Wachtwoord klopte — nu nog de code uit de authenticator-app.
        setPendingToken(data.pendingToken);
        setBusy(false);
        return;
      }
      window.location.href = "/";
    } catch (e) { setError("Geen verbinding met de server"); setBusy(false); }
  }

  async function handle2FAVerify(e) {
    e.preventDefault();
    setError("");
    const isCijfercode = /^\d{6}$/.test(tweeFACode.trim());
    const isHerstelcode = /^[0-9A-F]{5}-[0-9A-F]{5}$/i.test(tweeFACode.trim());
    if (!isCijfercode && !isHerstelcode) { setError(gebruikHerstelcode ? "Vul een geldige herstelcode in" : "Vul de 6-cijferige code in"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/2fa-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken, code: tweeFACode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Onjuiste code"); setBusy(false); return; }
      window.location.href = "/";
    } catch (e) { setError("Geen verbinding met de server"); setBusy(false); }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Maak ook de offline-cache leeg — anders blijft eerder opgehaalde data
    // (bv. budgetgegevens) nog op het toestel staan nadat je bent uitgelogd.
    if (typeof caches !== "undefined") {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (e) { /* niet kritiek als dit een keer mislukt */ }
    }
    window.location.href = "/";
  }

  async function handleWachtwoordWijzigen(e) {
    e.preventDefault();
    setPwMsg(null);
    if (nieuwPw !== nieuwPw2) { setPwMsg({ ok: false, tekst: "Nieuwe wachtwoorden komen niet overeen" }); return; }
    if (nieuwPw.length < 12)   { setPwMsg({ ok: false, tekst: "Nieuw wachtwoord moet minstens 12 tekens zijn" }); return; }
    setPwBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ huidigPw, nieuwPw }),
      });
      const data = await res.json();
      if (!res.ok) { setPwMsg({ ok: false, tekst: data.error || "Mislukt" }); }
      else {
        setPwMsg({ ok: true, tekst: "Wachtwoord gewijzigd ✅" });
        setHuidigPw(""); setNieuwPw(""); setNieuwPw2("");
      }
    } catch (e) { setPwMsg({ ok: false, tekst: "Geen verbinding" }); }
    setPwBusy(false);
  }

  // ── Tweestapsverificatie instellen ──
  async function handleTfaSetupStart() {
    setTfaMsg(null); setTfaBusy(true);
    try {
      const res = await fetch("/api/auth/2fa-setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setTfaMsg({ ok: false, tekst: data.error || "Mislukt" }); }
      else setTfaSetup({ secret: data.secret, qrDataUrl: data.qrDataUrl });
    } catch (e) { setTfaMsg({ ok: false, tekst: "Geen verbinding" }); }
    setTfaBusy(false);
  }

  async function handleTfaConfirm(e) {
    e.preventDefault();
    setTfaMsg(null);
    if (!/^\d{6}$/.test(tfaConfirmCode.trim())) { setTfaMsg({ ok: false, tekst: "Vul de 6-cijferige code in" }); return; }
    setTfaBusy(true);
    try {
      const res = await fetch("/api/auth/2fa-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: tfaConfirmCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setTfaMsg({ ok: false, tekst: data.error || "Onjuiste code" }); }
      else {
        setTfaEnabled(true); setTfaSetup(null); setTfaConfirmCode("");
        setTfaRecoveryCodes(data.recoveryCodes || null);
        setTfaRecoveryRemaining((data.recoveryCodes || []).length);
        setTfaMsg(null);
      }
    } catch (e) { setTfaMsg({ ok: false, tekst: "Geen verbinding" }); }
    setTfaBusy(false);
  }

  async function handleTfaDisable(e) {
    e.preventDefault();
    setTfaMsg(null);
    if (!tfaDisablePw) { setTfaMsg({ ok: false, tekst: "Vul je wachtwoord in" }); return; }
    setTfaBusy(true);
    try {
      const res = await fetch("/api/auth/2fa-disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: tfaDisablePw }),
      });
      const data = await res.json();
      if (!res.ok) { setTfaMsg({ ok: false, tekst: data.error || "Mislukt" }); }
      else {
        setTfaEnabled(false); setTfaDisablePw(""); setTfaRecoveryRemaining(0); setTfaRecoveryCodes(null);
        setTfaMsg({ ok: true, tekst: "Tweestapsverificatie is uitgeschakeld" });
      }
    } catch (e) { setTfaMsg({ ok: false, tekst: "Geen verbinding" }); }
    setTfaBusy(false);
  }

  async function handleTfaRegenerate(e) {
    e.preventDefault();
    setTfaMsg(null);
    if (!tfaRegeneratePw) { setTfaMsg({ ok: false, tekst: "Vul je wachtwoord in" }); return; }
    setTfaBusy(true);
    try {
      const res = await fetch("/api/auth/2fa-regenerate-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: tfaRegeneratePw }),
      });
      const data = await res.json();
      if (!res.ok) { setTfaMsg({ ok: false, tekst: data.error || "Mislukt" }); }
      else {
        setTfaRecoveryCodes(data.recoveryCodes || null);
        setTfaRecoveryRemaining((data.recoveryCodes || []).length);
        setTfaShowRegenerate(false); setTfaRegeneratePw(""); setTfaMsg(null);
      }
    } catch (e) { setTfaMsg({ ok: false, tekst: "Geen verbinding" }); }
    setTfaBusy(false);
  }

  // ── Back-up & herstel ──
  async function handleExport() {
    setBackupBusy(true);
    setBackupMsg(null);
    try {
      const res = await fetch("/api/export");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Export mislukt");

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const datumSlug = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `ons-huishouden-backup-${datumSlug}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const nu = Date.now();
      setLaatsteBackup(nu);
      await fetch("/api/instellingen", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laatsteBackup: nu }),
      });
      setBackupMsg({ ok: true, tekst: `✅ Back-up gedownload (${payload.aantalSleutels} onderdelen)` });
    } catch (e) {
      setBackupMsg({ ok: false, tekst: "❌ Kon geen back-up maken: " + e.message });
    }
    setBackupBusy(false);
  }

  function handleHerstelBestand(file) {
    if (!file) return;
    setBackupMsg(null);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed.data || typeof parsed.data !== "object") throw new Error("Dit lijkt geen geldig back-upbestand van deze app te zijn");
        setHerstelBestand(parsed);
      } catch (err) {
        setBackupMsg({ ok: false, tekst: "❌ Kon bestand niet lezen: " + err.message });
      }
    };
    reader.readAsText(file);
  }

  async function handleHerstel() {
    if (herstelBevestiging !== "HERSTEL" || !herstelBestand) return;
    setHerstelBusy(true);
    setBackupMsg(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: herstelBestand.data }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Herstellen mislukt");
      setBackupMsg({ ok: true, tekst: `✅ ${data.hersteld} onderdelen hersteld. Ververs de app om alles te zien.` });
      setHerstelBestand(null);
      setHerstelBevestiging("");
      setShowHerstelForm(false);
    } catch (e) {
      setBackupMsg({ ok: false, tekst: "❌ " + e.message });
    }
    setHerstelBusy(false);
  }

  // ── Laadscherm met subtiele animatie ──
  if (status === "laden") return (
    <div style={S.appBg}>
      <div style={S.centerWrap}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#2D4A3E,#4A7C6A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Home size={26} color="#FAF6F0" />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#2D4A3E", opacity: 0.3, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
          <style>{`@keyframes pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:1;transform:scale(1.3)} }`}</style>
        </div>
      </div>
    </div>
  );

  // ── Verbindingsfout ──
  if (status === "fout") return (
    <div style={S.appBg}>
      <div style={{ ...S.centerWrap, flexDirection: "column", gap: 16, padding: "0 32px", textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <p style={{ fontWeight: 700, fontSize: 17, color: "#2D4A3E", margin: 0 }}>Geen verbinding</p>
        <p style={{ fontSize: 14, color: "#8C8576", margin: 0 }}>Controleer je internetverbinding en probeer het opnieuw.</p>
        <button style={S.authBtn} onClick={() => { setStatus("laden"); window.location.reload(); }}>
          Opnieuw proberen
        </button>
      </div>
    </div>
  );

  // ── Eerste keer instellen ──
  if (status === "setup") return (
    <div style={S.appBg}>
      <form style={S.authWrap} onSubmit={handleSetup}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "#2D4A3E", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
          <KeyRound size={24} color="#FAF6F0" strokeWidth={1.8} />
        </div>
        <h1 style={S.authTitle}>Huishouden instellen</h1>
        <p style={S.authBody}>Stel een naam en wachtwoord in. Dit wachtwoord deel je met je huisgenoot zodat jullie beiden toegang hebben.</p>
        <input style={S.authInput} placeholder="Naam van het huishouden" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <div style={{ position: "relative", width: "100%", maxWidth: 320 }}>
          <input style={{ ...S.authInput, marginBottom: 0, paddingRight: 44 }} placeholder="Wachtwoord (min. 12 tekens)" type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            {showPw ? <EyeOff size={16} color="#B8B2A8" /> : <Eye size={16} color="#B8B2A8" />}
          </button>
        </div>
        <input style={S.authInput} placeholder="Herhaal wachtwoord" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
        {error && <p style={S.authError}>{error}</p>}
        <button style={{ ...S.authBtn, opacity: busy ? 0.7 : 1 }} type="submit" disabled={busy}>
          {busy ? "Bezig…" : "Huishouden aanmaken"}
        </button>
      </form>
    </div>
  );

  // ── Inloggen ──
  if (status === "login" && pendingToken) return (
    <div style={S.appBg}>
      <form style={S.authWrap} onSubmit={handle2FAVerify}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "#2D4A3E", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
          <KeyRound size={24} color="#FAF6F0" strokeWidth={1.8} />
        </div>
        <h1 style={S.authTitle}>{gebruikHerstelcode ? "Herstelcode" : "Bevestigingscode"}</h1>
        <p style={S.authBody}>
          {gebruikHerstelcode ? "Vul een van je eenmalige herstelcodes in." : "Vul de 6-cijferige code uit je authenticator-app in."}
        </p>
        {gebruikHerstelcode ? (
          <input style={{ ...S.authInput, textAlign: "center", fontSize: 18, letterSpacing: 2, fontWeight: 700, textTransform: "uppercase" }}
            placeholder="XXXXX-XXXXX" maxLength={11} autoFocus
            value={tweeFACode} onChange={e => setTweeFACode(e.target.value.toUpperCase().slice(0, 11))} />
        ) : (
          <input style={{ ...S.authInput, textAlign: "center", fontSize: 22, letterSpacing: 6, fontWeight: 700 }}
            placeholder="000000" inputMode="numeric" maxLength={6} autoFocus
            value={tweeFACode} onChange={e => setTweeFACode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        )}
        {error && <p style={{ ...S.authError, marginTop: 8 }}>{error}</p>}
        <button style={{ ...S.authBtn, opacity: busy ? 0.7 : 1, marginTop: error ? 0 : 8 }} type="submit" disabled={busy}>
          {busy ? "Bezig…" : "Bevestigen"}
        </button>
        <button type="button" style={{ marginTop: 12, background: "none", border: "none", color: "#8C8576", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          onClick={() => { setGebruikHerstelcode(v => !v); setTweeFACode(""); setError(""); }}>
          {gebruikHerstelcode ? "Ik heb mijn authenticator-app weer" : "Geen toegang tot je authenticator-app? Gebruik een herstelcode"}
        </button>
        <button type="button" style={{ marginTop: 10, background: "none", border: "none", color: "#8C8576", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" }}
          onClick={() => { setPendingToken(null); setTweeFACode(""); setError(""); setPassword(""); setGebruikHerstelcode(false); }}>
          ← Terug
        </button>
      </form>
    </div>
  );

  if (status === "login") return (
    <div style={S.appBg}>
      <form style={S.authWrap} onSubmit={handleLogin}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "#2D4A3E", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
          <Lock size={24} color="#FAF6F0" strokeWidth={1.8} />
        </div>
        <h1 style={S.authTitle}>Welkom terug</h1>
        <p style={S.authBody}>Wie ben jij, en vul het huishoudwachtwoord in om verder te gaan.</p>
        <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 320, marginBottom: 4 }}>
          {["Pepijn", "Tessa"].map((naam) => (
            <button
              key={naam}
              type="button"
              onClick={() => setWieBenJij(naam)}
              style={{
                flex: 1,
                padding: "12px 0",
                borderRadius: 12,
                border: wieBenJij === naam ? "2px solid #2D4A3E" : "1px solid #E4DCCB",
                background: wieBenJij === naam ? "#2D4A3E" : "#FFFFFF",
                color: wieBenJij === naam ? "#FAF6F0" : "#2D2A26",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {naam}
            </button>
          ))}
        </div>
        <div style={{ position: "relative", width: "100%", maxWidth: 320 }}>
          <input style={{ ...S.authInput, marginBottom: 0, paddingRight: 44 }} placeholder="Wachtwoord" type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} autoFocus />
          <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            {showPw ? <EyeOff size={16} color="#B8B2A8" /> : <Eye size={16} color="#B8B2A8" />}
          </button>
        </div>
        {error && <p style={{ ...S.authError, marginTop: 8 }}>{error}</p>}
        <button style={{ ...S.authBtn, opacity: busy ? 0.7 : 1, marginTop: error ? 0 : 8 }} type="submit" disabled={busy}>
          {busy ? "Bezig…" : "Inloggen"}
        </button>
      </form>
    </div>
  );

  // ── Hoofdmenu ──
  return (
    <div style={S.appBg}>
      <header style={S.header}>
        <div>
          <p style={S.eyebrow}>{ingelogdAls ? `Ingelogd als ${ingelogdAls}` : "Huishouden"}</p>
          <h1 style={S.title}>Onze tools</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...S.iconBtn, background: bewerkVolgorde ? "#2D4A3E" : "#FFFFFF", border: bewerkVolgorde ? "none" : "1px solid #EFE9DC" }}
            onClick={() => setBewerkVolgorde(v => !v)} title="Volgorde aanpassen">
            <span style={{ fontSize: 16, color: bewerkVolgorde ? "#FAF6F0" : "#8C8576" }}>⇅</span>
          </button>
          <button style={S.iconBtn} onClick={() => setShowInstellingen(v => !v)} aria-label="Instellingen">
            <Settings size={18} color="#8C8576" />
          </button>
          <button style={S.iconBtn} onClick={handleLogout} aria-label="Uitloggen">
            <LogOut size={18} color="#8C8576" />
          </button>
        </div>
      </header>

      {bewerkVolgorde && (
        <div style={{ margin: "0 20px 12px", background: "#2D4A3E", borderRadius: 14, padding: "10px 14px" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#FAF6F0", opacity: 0.9 }}>
            ⇅ Gebruik de pijltjes op de tegels om de volgorde aan te passen
          </p>
        </div>
      )}

      {/* Instellingen-paneel */}
      {showInstellingen && (
        <div style={{ margin: "0 20px 16px", background: "#FFFFFF", border: "1px solid #EFE9DC", borderRadius: 18, padding: "18px 16px" }}>
          <p style={{ margin: "0 0 14px", fontWeight: 700, fontSize: 14, color: "#2D4A3E" }}>🔑 Wachtwoord wijzigen</p>
          <form onSubmit={handleWachtwoordWijzigen}>
            <input style={{ ...S.settingInput, marginBottom: 8 }} type="password" placeholder="Huidig wachtwoord" value={huidigPw} onChange={e => setHuidigPw(e.target.value)} />
            <input style={{ ...S.settingInput, marginBottom: 8 }} type="password" placeholder="Nieuw wachtwoord (min. 12 tekens)" value={nieuwPw} onChange={e => setNieuwPw(e.target.value)} />
            <input style={{ ...S.settingInput, marginBottom: 12 }} type="password" placeholder="Herhaal nieuw wachtwoord" value={nieuwPw2} onChange={e => setNieuwPw2(e.target.value)} />
            {pwMsg && <p style={{ fontSize: 13, color: pwMsg.ok ? "#2D4A3E" : "#C86E4A", margin: "0 0 10px" }}>{pwMsg.tekst}</p>}
            <button style={{ ...S.authBtn, maxWidth: "none", padding: "12px 0", fontSize: 14, opacity: pwBusy ? 0.7 : 1 }} type="submit" disabled={pwBusy}>
              {pwBusy ? "Bezig…" : "Wachtwoord wijzigen"}
            </button>
          </form>
        </div>
      )}

      {/* Back-up & herstel paneel */}
      {showInstellingen && (
        <div style={{ margin: "0 20px 16px", background: "#FFFFFF", border: "1px solid #EFE9DC", borderRadius: 18, padding: "18px 16px" }}>
          <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 14, color: "#2D4A3E" }}>💾 Back-up &amp; herstel</p>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#8C8576" }}>
            {laatsteBackup
              ? `Laatste back-up: ${new Date(laatsteBackup).toLocaleDateString("nl-NL", { day:"numeric", month:"long", year:"numeric" })}${Date.now() - laatsteBackup > 30*86400000 ? " — dat is meer dan 30 dagen geleden" : ""}`
              : "Nog nooit een back-up gemaakt"}
          </p>

          <button style={{ ...S.authBtn, maxWidth: "none", padding: "12px 0", fontSize: 14, opacity: backupBusy ? 0.7 : 1, marginBottom: 10 }} onClick={handleExport} disabled={backupBusy}>
            {backupBusy ? "Bezig…" : "📥 Exporteer alle data"}
          </button>

          {!showHerstelForm ? (
            <button type="button" style={{ background: "none", border: "none", color: "#8C8576", fontSize: 12, fontWeight: 600, cursor: "pointer", width: "100%", textAlign: "center", padding: "6px 0" }}
              onClick={() => setShowHerstelForm(true)}>
              Herstellen vanuit een eerdere back-up
            </button>
          ) : (
            <div style={{ borderTop: "1px solid #EFE9DC", paddingTop: 12, marginTop: 4 }}>
              {!herstelBestand ? (
                <>
                  <p style={{ fontSize: 12, color: "#8C8576", margin: "0 0 10px" }}>Kies een eerder gedownload back-upbestand (.json):</p>
                  <button style={{ ...S.authBtn, maxWidth: "none", padding: "10px 0", fontSize: 13, background: "#E4DCCB", color: "#2D2A26" }} onClick={() => herstelFileRef.current?.click()}>
                    Bestand kiezen
                  </button>
                  <input ref={herstelFileRef} type="file" accept="application/json" style={{ display: "none" }} onChange={e => handleHerstelBestand(e.target.files[0])} />
                </>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: "#C86E4A", fontWeight: 600, margin: "0 0 10px", lineHeight: 1.6 }}>
                    ⚠️ Dit overschrijft de huidige gegevens van {Object.keys(herstelBestand.data).length} onderdelen met de inhoud van de back-up
                    van {herstelBestand.gemaaktOp ? new Date(herstelBestand.gemaaktOp).toLocaleDateString("nl-NL") : "onbekende datum"}.
                    Dit kan niet ongedaan gemaakt worden.
                  </p>
                  <p style={{ fontSize: 12, color: "#2D2A26", margin: "0 0 6px" }}>Typ <strong>HERSTEL</strong> om te bevestigen:</p>
                  <input style={{ ...S.settingInput, marginBottom: 10 }} value={herstelBevestiging} onChange={e => setHerstelBevestiging(e.target.value)} placeholder="HERSTEL" />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" style={{ ...S.authBtn, maxWidth: "none", flex: 1, padding: "10px 0", fontSize: 13, background: "#E4DCCB", color: "#2D2A26" }}
                      onClick={() => { setHerstelBestand(null); setHerstelBevestiging(""); setShowHerstelForm(false); }}>
                      Annuleer
                    </button>
                    <button style={{ ...S.authBtn, maxWidth: "none", flex: 1, padding: "10px 0", fontSize: 13, background: "#C86E4A", opacity: herstelBevestiging === "HERSTEL" ? 1 : 0.5 }}
                      onClick={handleHerstel} disabled={herstelBevestiging !== "HERSTEL" || herstelBusy}>
                      {herstelBusy ? "Bezig…" : "Herstellen"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {backupMsg && <p style={{ fontSize: 13, color: backupMsg.ok ? "#2D4A3E" : "#C86E4A", margin: "10px 0 0" }}>{backupMsg.tekst}</p>}
        </div>
      )}

      {/* Foutlog-paneel */}
      {showInstellingen && (
        <div style={{ margin: "0 20px 16px", background: "#FFFFFF", border: "1px solid #EFE9DC", borderRadius: 18, padding: "18px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#2D4A3E" }}>🐛 Foutlog</p>
            <button style={{ background: "none", border: "none", color: "#2D4A3E", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              onClick={() => {
                if (showFoutlog) { setShowFoutlog(false); return; }
                setShowFoutlog(true);
                fetch("/api/error-log").then(r => r.json()).then(d => setFoutlog(d.log || [])).catch(() => setFoutlog([]));
              }}>
              {showFoutlog ? "Verberg" : "Bekijk"}
            </button>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8C8576" }}>Technische fouten worden hier automatisch verzameld, ook als niemand ze meldt.</p>
          {showFoutlog && (
            foutlog === null ? (
              <p style={{ fontSize: 12, color: "#8C8576", margin: "12px 0 0" }}>Laden…</p>
            ) : foutlog.length === 0 ? (
              <p style={{ fontSize: 12, color: "#8C8576", margin: "12px 0 0" }}>Geen fouten gelogd. 🎉</p>
            ) : (
              <div style={{ maxHeight: 260, overflowY: "auto", marginTop: 12 }}>
                {foutlog.slice(0, 30).map((f, i) => (
                  <div key={i} style={{ background: "#FAF6F0", borderRadius: 10, padding: "8px 10px", marginBottom: 6 }}>
                    <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#C86E4A" }}>
                      {f.bron} · {new Date(f.datum).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {f.gebruiker ? ` · ${f.gebruiker}` : ""}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "#2D2A26", wordBreak: "break-word" }}>{f.bericht}</p>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Tweestapsverificatie-paneel */}
      {showInstellingen && (
        <div style={{ margin: "0 20px 16px", background: "#FFFFFF", border: "1px solid #EFE9DC", borderRadius: 18, padding: "18px 16px" }}>
          <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 14, color: "#2D4A3E" }}>🔐 Tweestapsverificatie</p>

          {/* Net gegenereerde herstelcodes — eenmalig zichtbaar, moet eerst weg voordat je verdergaat */}
          {tfaRecoveryCodes ? (
            <div>
              <p style={{ margin: "10px 0 10px", fontSize: 12, color: "#C86E4A", fontWeight: 600 }}>
                ⚠️ Bewaar deze 8 herstelcodes ergens veilig (wachtwoordmanager, kluis). Ze worden maar één keer getoond en zijn je enige toegang als je je authenticator-app kwijtraakt.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, background: "#FAF6F0", borderRadius: 10, padding: 12, marginBottom: 14 }}>
                {tfaRecoveryCodes.map(c => (
                  <p key={c} style={{ margin: 0, fontFamily: "monospace", fontSize: 13, textAlign: "center", userSelect: "all" }}>{c}</p>
                ))}
              </div>
              <button style={{ ...S.authBtn, maxWidth: "none", padding: "12px 0", fontSize: 14 }}
                onClick={() => { setTfaRecoveryCodes(null); setTfaMsg({ ok: true, tekst: "Tweestapsverificatie is actief ✅" }); }}>
                Ik heb ze veilig bewaard
              </button>
            </div>
          ) : (
            <>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: "#8C8576" }}>
                {tfaEnabled ? "Actief — bij inloggen wordt ook een code uit je authenticator-app gevraagd." : "Extra beveiligingslaag bovenop het wachtwoord, via een authenticator-app (Google Authenticator, Authy, 1Password)."}
              </p>

              {!tfaEnabled && !tfaSetup && (
                <button style={{ ...S.authBtn, maxWidth: "none", padding: "12px 0", fontSize: 14, opacity: tfaBusy ? 0.7 : 1 }} onClick={handleTfaSetupStart} disabled={tfaBusy}>
                  {tfaBusy ? "Bezig…" : "Instellen"}
                </button>
              )}

              {!tfaEnabled && tfaSetup && (
                <form onSubmit={handleTfaConfirm}>
                  <p style={{ fontSize: 12, color: "#2D2A26", margin: "0 0 10px" }}>
                    Scan deze QR-code met je authenticator-app:
                  </p>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                    <img src={tfaSetup.qrDataUrl} alt="QR-code voor tweestapsverificatie" style={{ width: 180, height: 180, borderRadius: 10, border: "1px solid #EFE9DC" }} />
                  </div>
                  <p style={{ fontSize: 11, color: "#8C8576", margin: "0 0 4px" }}>Kan niet scannen? Vul deze code handmatig in:</p>
                  <p style={{ fontSize: 12, fontFamily: "monospace", background: "#FAF6F0", padding: "8px 10px", borderRadius: 8, wordBreak: "break-all", margin: "0 0 14px", userSelect: "all" }}>
                    {tfaSetup.secret}
                  </p>
                  <input style={{ ...S.settingInput, marginBottom: 10, textAlign: "center", fontSize: 18, letterSpacing: 4, fontWeight: 700 }}
                    placeholder="000000" inputMode="numeric" maxLength={6}
                    value={tfaConfirmCode} onChange={e => setTfaConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                  {tfaMsg && <p style={{ fontSize: 13, color: tfaMsg.ok ? "#2D4A3E" : "#C86E4A", margin: "0 0 10px" }}>{tfaMsg.tekst}</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" style={{ ...S.authBtn, maxWidth: "none", flex: 1, padding: "12px 0", fontSize: 14, background: "#E4DCCB", color: "#2D2A26" }}
                      onClick={() => { setTfaSetup(null); setTfaConfirmCode(""); setTfaMsg(null); }}>
                      Annuleer
                    </button>
                    <button style={{ ...S.authBtn, maxWidth: "none", flex: 1, padding: "12px 0", fontSize: 14, opacity: tfaBusy ? 0.7 : 1 }} type="submit" disabled={tfaBusy}>
                      {tfaBusy ? "Bezig…" : "Bevestigen"}
                    </button>
                  </div>
                </form>
              )}

              {tfaEnabled && !tfaShowRegenerate && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FAF6F0", borderRadius: 10, padding: "9px 12px", marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: "#2D2A26" }}>🔑 {tfaRecoveryRemaining} van 8 herstelcodes over</span>
                    <button type="button" style={{ background: "none", border: "none", color: "#2D4A3E", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      onClick={() => { setTfaShowRegenerate(true); setTfaMsg(null); }}>
                      Vernieuwen
                    </button>
                  </div>
                  <form onSubmit={handleTfaDisable}>
                    <input style={{ ...S.settingInput, marginBottom: 10 }} type="password" placeholder="Wachtwoord ter bevestiging" value={tfaDisablePw} onChange={e => setTfaDisablePw(e.target.value)} />
                    {tfaMsg && <p style={{ fontSize: 13, color: tfaMsg.ok ? "#2D4A3E" : "#C86E4A", margin: "0 0 10px" }}>{tfaMsg.tekst}</p>}
                    <button style={{ ...S.authBtn, maxWidth: "none", padding: "12px 0", fontSize: 14, background: "#C86E4A", opacity: tfaBusy ? 0.7 : 1 }} type="submit" disabled={tfaBusy}>
                      {tfaBusy ? "Bezig…" : "Uitschakelen"}
                    </button>
                  </form>
                </>
              )}

              {tfaEnabled && tfaShowRegenerate && (
                <form onSubmit={handleTfaRegenerate}>
                  <p style={{ fontSize: 12, color: "#2D2A26", margin: "0 0 10px" }}>
                    Dit maakt je huidige herstelcodes ongeldig en genereert 8 nieuwe. Vul je wachtwoord in ter bevestiging:
                  </p>
                  <input style={{ ...S.settingInput, marginBottom: 10 }} type="password" placeholder="Wachtwoord" value={tfaRegeneratePw} onChange={e => setTfaRegeneratePw(e.target.value)} />
                  {tfaMsg && <p style={{ fontSize: 13, color: tfaMsg.ok ? "#2D4A3E" : "#C86E4A", margin: "0 0 10px" }}>{tfaMsg.tekst}</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" style={{ ...S.authBtn, maxWidth: "none", flex: 1, padding: "12px 0", fontSize: 14, background: "#E4DCCB", color: "#2D2A26" }}
                      onClick={() => { setTfaShowRegenerate(false); setTfaRegeneratePw(""); setTfaMsg(null); }}>
                      Annuleer
                    </button>
                    <button style={{ ...S.authBtn, maxWidth: "none", flex: 1, padding: "12px 0", fontSize: 14, opacity: tfaBusy ? 0.7 : 1 }} type="submit" disabled={tfaBusy}>
                      {tfaBusy ? "Bezig…" : "Vernieuwen"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      )}

      <main style={S.grid}>
        {gesorteerdeTools.map((tool, idx) => (
          <div key={tool.href} style={{ position: "relative" }}>
            {bewerkVolgorde ? (
              <div style={{ ...S.tile, cursor: "default", opacity: 1 }}>
                <div style={{ ...S.tileIcon, background: tool.color }}>
                  <span style={{ fontSize: 22, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>{tool.emoji}</span>
                </div>
                <p style={S.tileLabel}>{tool.label}</p>
                <p style={S.tileDesc}>{tool.description}</p>
                {/* Pijltjes */}
                <div style={{ position: "absolute", top: 8, right: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                  <button
                    style={{ background: idx === 0 ? "#E4DCCB" : "#2D4A3E", color: idx === 0 ? "#B8B2A8" : "#FAF6F0", border: "none", borderRadius: 7, width: 26, height: 26, fontSize: 13, cursor: idx === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    onClick={() => verschuifTool(idx, -1)} disabled={idx === 0}>↑</button>
                  <button
                    style={{ background: idx === gesorteerdeTools.length - 1 ? "#E4DCCB" : "#2D4A3E", color: idx === gesorteerdeTools.length - 1 ? "#B8B2A8" : "#FAF6F0", border: "none", borderRadius: 7, width: 26, height: 26, fontSize: 13, cursor: idx === gesorteerdeTools.length - 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    onClick={() => verschuifTool(idx, 1)} disabled={idx === gesorteerdeTools.length - 1}>↓</button>
                </div>
              </div>
            ) : (
              <Link href={tool.href} style={S.tile}>
                <div style={{ ...S.tileIcon, background: tool.color }}>
                  <span style={{ fontSize: 22, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>{tool.emoji}</span>
                </div>
                <p style={S.tileLabel}>{tool.label}</p>
                <p style={S.tileDesc}>{tool.description}</p>
              </Link>
            )}
          </div>
        ))}
      </main>

      <p style={{ textAlign: "center", fontSize: 10, color: "#C2BCAE", padding: "0 20px 24px" }}>
        Bijgewerkt: {new Date(BUILD_INFO.datum).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}, {new Date(BUILD_INFO.datum).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
        {BUILD_INFO.omschrijving ? ` · ${BUILD_INFO.omschrijving}` : ""}
      </p>
    </div>
  );
}

const S = {
  appBg: { minHeight: "100vh", background: "#FAF6F0", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, Roboto, sans-serif", color: "#2D2A26" },
  centerWrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" },
  authWrap: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 28px", textAlign: "center", gap: 10 },
  authTitle: { fontSize: 24, fontWeight: 700, color: "#2D4A3E", margin: "4px 0 6px" },
  authBody: { fontSize: 14, color: "#8C8576", lineHeight: 1.5, margin: "0 0 8px", maxWidth: 320 },
  authInput: { width: "100%", maxWidth: 320, border: "1px solid #E4DCCB", borderRadius: 12, padding: "15px 16px", fontSize: 16, marginBottom: 10, boxSizing: "border-box", textAlign: "center", background: "#FFFFFF", color: "#2D2A26" },
  authError: { color: "#C86E4A", fontSize: 13, margin: "0" },
  authBtn: { width: "100%", maxWidth: 320, padding: "15px 0", borderRadius: 12, border: "none", background: "#2D4A3E", color: "#FAF6F0", fontSize: 16, fontWeight: 700, cursor: "pointer" },
  settingInput: { width: "100%", border: "1px solid #E4DCCB", borderRadius: 10, padding: "11px 14px", fontSize: 14, boxSizing: "border-box", background: "#FAF6F0", color: "#2D2A26", display: "block" },
  header: { padding: "28px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  eyebrow: { margin: 0, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "#B8B2A8", fontWeight: 600 },
  title: { margin: "4px 0 0", fontSize: 28, fontWeight: 700, color: "#2D4A3E", letterSpacing: "-0.01em" },
  iconBtn: { width: 38, height: 38, borderRadius: 12, border: "1px solid #EFE9DC", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  grid: { padding: "16px 20px 40px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, alignItems: "stretch" },
  tile: { display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box", background: "#FFFFFF", border: "1px solid #EFE9DC", borderRadius: 18, padding: "18px 16px", textDecoration: "none", color: "#2D2A26" },
  tileIcon: { width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, flexShrink: 0 },
  tileLabel: { margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#2D4A3E" },
  // Vaste hoogte voor precies 3 regels (12px lettergrootte × 1.4 regelhoogte),
  // zodat elke tegel exact even hoog is, ongeacht of de omschrijving 1, 2 of 3 regels beslaat.
  tileDesc: { margin: 0, fontSize: 12, color: "#8C8576", lineHeight: 1.4, minHeight: "50px" },
};
