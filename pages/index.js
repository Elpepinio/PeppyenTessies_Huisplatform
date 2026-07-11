import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Home, List, Wallet, LogOut, Lock, KeyRound, Settings, Eye, EyeOff } from "lucide-react";

const TOOLS = [
  {
    href: "/lijsten",
    label: "Lijsten",
    description: "Boodschappen, paklijsten, klussenlijsten en meer",
    icon: List,
    color: "#2D4A3E",
  },
  {
    href: "/budget",
    label: "Budget",
    description: "Huishouduitgaven, budgetten en spaardoelen",
    icon: Wallet,
    color: "#C86E4A",
  },
];

export default function Platform() {
  const [status, setStatus]               = useState("laden");
  const [name, setName]                   = useState("");
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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) throw new Error("server");
        const data = await res.json();
        if (!data.accountExists) setStatus("setup");
        else if (data.loggedIn)  setStatus("overzicht");
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
    if (password.length < 6) { setError("Wachtwoord moet minstens 6 tekens zijn"); return; }
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
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Wachtwoord onjuist"); setBusy(false); return; }
      window.location.href = "/";
    } catch (e) { setError("Geen verbinding met de server"); setBusy(false); }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  async function handleWachtwoordWijzigen(e) {
    e.preventDefault();
    setPwMsg(null);
    if (nieuwPw !== nieuwPw2) { setPwMsg({ ok: false, tekst: "Nieuwe wachtwoorden komen niet overeen" }); return; }
    if (nieuwPw.length < 6)   { setPwMsg({ ok: false, tekst: "Nieuw wachtwoord moet minstens 6 tekens zijn" }); return; }
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
          <input style={{ ...S.authInput, marginBottom: 0, paddingRight: 44 }} placeholder="Wachtwoord (min. 6 tekens)" type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} />
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
  if (status === "login") return (
    <div style={S.appBg}>
      <form style={S.authWrap} onSubmit={handleLogin}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "#2D4A3E", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
          <Lock size={24} color="#FAF6F0" strokeWidth={1.8} />
        </div>
        <h1 style={S.authTitle}>Welkom terug</h1>
        <p style={S.authBody}>Vul het huishoudwachtwoord in om verder te gaan.</p>
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
          <p style={S.eyebrow}>Huishouden</p>
          <h1 style={S.title}>Onze tools</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.iconBtn} onClick={() => setShowInstellingen(v => !v)} aria-label="Instellingen">
            <Settings size={18} color="#8C8576" />
          </button>
          <button style={S.iconBtn} onClick={handleLogout} aria-label="Uitloggen">
            <LogOut size={18} color="#8C8576" />
          </button>
        </div>
      </header>

      {/* Instellingen-paneel */}
      {showInstellingen && (
        <div style={{ margin: "0 20px 16px", background: "#FFFFFF", border: "1px solid #EFE9DC", borderRadius: 18, padding: "18px 16px" }}>
          <p style={{ margin: "0 0 14px", fontWeight: 700, fontSize: 14, color: "#2D4A3E" }}>🔑 Wachtwoord wijzigen</p>
          <form onSubmit={handleWachtwoordWijzigen}>
            <input style={{ ...S.settingInput, marginBottom: 8 }} type="password" placeholder="Huidig wachtwoord" value={huidigPw} onChange={e => setHuidigPw(e.target.value)} />
            <input style={{ ...S.settingInput, marginBottom: 8 }} type="password" placeholder="Nieuw wachtwoord (min. 6 tekens)" value={nieuwPw} onChange={e => setNieuwPw(e.target.value)} />
            <input style={{ ...S.settingInput, marginBottom: 12 }} type="password" placeholder="Herhaal nieuw wachtwoord" value={nieuwPw2} onChange={e => setNieuwPw2(e.target.value)} />
            {pwMsg && <p style={{ fontSize: 13, color: pwMsg.ok ? "#2D4A3E" : "#C86E4A", margin: "0 0 10px" }}>{pwMsg.tekst}</p>}
            <button style={{ ...S.authBtn, maxWidth: "none", padding: "12px 0", fontSize: 14, opacity: pwBusy ? 0.7 : 1 }} type="submit" disabled={pwBusy}>
              {pwBusy ? "Bezig…" : "Wachtwoord wijzigen"}
            </button>
          </form>
        </div>
      )}

      <main style={S.grid}>
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.href} href={tool.href} style={S.tile}>
              <div style={{ ...S.tileIcon, background: tool.color }}>
                <Icon size={24} color="#FAF6F0" strokeWidth={1.8} />
              </div>
              <p style={S.tileLabel}>{tool.label}</p>
              <p style={S.tileDesc}>{tool.description}</p>
            </Link>
          );
        })}
      </main>
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
  grid: { padding: "16px 20px 40px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 },
  tile: { display: "block", background: "#FFFFFF", border: "1px solid #EFE9DC", borderRadius: 18, padding: "18px 16px", textDecoration: "none", color: "#2D2A26" },
  tileIcon: { width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  tileLabel: { margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#2D4A3E" },
  tileDesc: { margin: 0, fontSize: 12, color: "#8C8576", lineHeight: 1.4 },
};
