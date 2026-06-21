import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Home, ShoppingBasket, Wallet, LogOut, Lock, KeyRound } from "lucide-react";

// ---- Tools die op het platform beschikbaar zijn ----
const TOOLS = [
  {
    href: "/boodschappen",
    label: "Boodschappen",
    description: "Gedeelde, gecategoriseerde boodschappenlijst",
    icon: ShoppingBasket,
    color: "#2D4A3E",
  },
  {
    href: "/budget",
    label: "Budget",
    description: "Huishouduitgaven, budgetten en spaardoelen",
    icon: Wallet,
    color: "#C86E4A",
  },
  // Nieuwe tools komen hier later bij.
];

export default function Platform() {
  const [status, setStatus] = useState("laden"); // laden | setup | login | overzicht
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (!data.accountExists) {
          setStatus("setup");
        } else if (data.loggedIn) {
          setStatus("overzicht");
        } else {
          setStatus("login");
        }
      } catch (e) {
        setStatus("login");
      }
    })();
  }, []);

  async function handleSetup(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Wachtwoorden komen niet overeen");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kon account niet aanmaken");
        setBusy(false);
        return;
      }
      window.location.href = "/";
    } catch (e) {
      setError("Kon geen verbinding maken");
      setBusy(false);
    }
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
      if (!res.ok) {
        setError(data.error || "Inloggen mislukt");
        setBusy(false);
        return;
      }
      window.location.href = "/";
    } catch (e) {
      setError("Kon geen verbinding maken");
      setBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (status === "laden") {
    return (
      <div style={styles.appBg}>
        <div style={styles.centerWrap}>
          <Home size={32} color="#2D4A3E" />
        </div>
      </div>
    );
  }

  if (status === "setup") {
    return (
      <div style={styles.appBg}>
        <form style={styles.authWrap} onSubmit={handleSetup}>
          <KeyRound size={36} color="#2D4A3E" strokeWidth={1.6} />
          <h1 style={styles.authTitle}>Huishouden instellen</h1>
          <p style={styles.authBody}>
            Dit is de eerste keer dat het platform wordt gestart. Stel een naam en wachtwoord in — dit wachtwoord
            deel je met je huisgenoot, zodat jullie beiden toegang hebben.
          </p>
          <input
            style={styles.authInput}
            placeholder="Naam van het huishouden"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <input
            style={styles.authInput}
            placeholder="Wachtwoord (minstens 6 tekens)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            style={styles.authInput}
            placeholder="Herhaal wachtwoord"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {error && <p style={styles.authError}>{error}</p>}
          <button style={styles.authBtn} type="submit" disabled={busy}>
            {busy ? "Bezig…" : "Huishouden aanmaken"}
          </button>
        </form>
      </div>
    );
  }

  if (status === "login") {
    return (
      <div style={styles.appBg}>
        <form style={styles.authWrap} onSubmit={handleLogin}>
          <Lock size={36} color="#2D4A3E" strokeWidth={1.6} />
          <h1 style={styles.authTitle}>Welkom terug</h1>
          <p style={styles.authBody}>Vul het huishoudwachtwoord in om verder te gaan.</p>
          <input
            style={styles.authInput}
            placeholder="Wachtwoord"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p style={styles.authError}>{error}</p>}
          <button style={styles.authBtn} type="submit" disabled={busy}>
            {busy ? "Bezig…" : "Inloggen"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={styles.appBg}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Huishouden</p>
          <h1 style={styles.title}>Onze tools</h1>
        </div>
        <button style={styles.logoutBtn} onClick={handleLogout} aria-label="Uitloggen">
          <LogOut size={20} color="#8C8576" />
        </button>
      </header>

      <main style={styles.grid}>
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.href} href={tool.href} style={styles.tile}>
              <div style={{ ...styles.tileIcon, background: tool.color }}>
                <Icon size={24} color="#FAF6F0" strokeWidth={1.8} />
              </div>
              <p style={styles.tileLabel}>{tool.label}</p>
              <p style={styles.tileDesc}>{tool.description}</p>
            </Link>
          );
        })}
      </main>
    </div>
  );
}

const styles = {
  appBg: {
    minHeight: "100vh",
    background: "#FAF6F0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, Roboto, sans-serif",
    color: "#2D2A26",
  },
  centerWrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  authWrap: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 28px",
    textAlign: "center",
    gap: 4,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: "#2D4A3E",
    margin: "14px 0 8px",
  },
  authBody: {
    fontSize: 14,
    color: "#8C8576",
    lineHeight: 1.5,
    margin: "0 0 22px",
    maxWidth: 320,
  },
  authInput: {
    width: "100%",
    maxWidth: 320,
    border: "1px solid #E4DCCB",
    borderRadius: 12,
    padding: "15px 16px",
    fontSize: 16,
    marginBottom: 12,
    boxSizing: "border-box",
    textAlign: "center",
    background: "#FFFFFF",
  },
  authError: {
    color: "#C86E4A",
    fontSize: 13,
    margin: "0 0 12px",
  },
  authBtn: {
    width: "100%",
    maxWidth: 320,
    padding: "15px 0",
    borderRadius: 12,
    border: "none",
    background: "#2D4A3E",
    color: "#FAF6F0",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  header: {
    padding: "28px 20px 8px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#B8B2A8",
    fontWeight: 600,
  },
  title: {
    margin: "4px 0 0",
    fontSize: 28,
    fontWeight: 700,
    color: "#2D4A3E",
    letterSpacing: "-0.01em",
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: "1px solid #EFE9DC",
    background: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  grid: {
    padding: "16px 20px 40px",
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 14,
  },
  tile: {
    display: "block",
    background: "#FFFFFF",
    border: "1px solid #EFE9DC",
    borderRadius: 18,
    padding: "18px 16px",
    textDecoration: "none",
    color: "#2D2A26",
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  tileLabel: {
    margin: "0 0 4px",
    fontSize: 15,
    fontWeight: 700,
    color: "#2D4A3E",
  },
  tileDesc: {
    margin: 0,
    fontSize: 12,
    color: "#8C8576",
    lineHeight: 1.4,
  },
};
