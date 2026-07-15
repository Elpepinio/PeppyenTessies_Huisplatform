import Head from "next/head";
import { useEffect, Component as ReactComponent } from "react";

// Stuurt een fout naar het eigen foutlogboek (lib/error-log.js via de API),
// zodat problemen zichtbaar worden voordat iemand ze toevallig zelf meldt.
// Faalt de melding zelf (bv. geen verbinding), dan gebeurt er verder niets —
// dit mag nooit de eigenlijke gebruikerservaring verstoren.
function meldFout(bron, bericht, stack, url) {
  try {
    fetch("/api/error-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bron, bericht, stack, url }),
    }).catch(() => {});
  } catch { /* loggen mag nooit crashen */ }
}

// Vangt crashes in de React-renderweergave op (bv. een onverwachte null-
// waarde in een component) en toont een rustig herstelscherm in plaats van
// een volledig kapotte, witte pagina.
class FoutGrens extends ReactComponent {
  constructor(props) { super(props); this.state = { fout: null }; }
  static getDerivedStateFromError(fout) { return { fout }; }
  componentDidCatch(fout, info) {
    meldFout("react-render", fout?.message || String(fout), info?.componentStack || fout?.stack || "", typeof window !== "undefined" ? window.location.pathname : "");
  }
  render() {
    if (this.state.fout) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 32px", textAlign: "center", background: "#FAF6F0", fontFamily: "-apple-system, sans-serif" }}>
          <div style={{ fontSize: 40 }}>😵</div>
          <p style={{ fontWeight: 700, fontSize: 17, color: "#2D2A26", margin: 0 }}>Er ging iets mis</p>
          <p style={{ fontSize: 14, color: "#8C8576", margin: 0 }}>Dit is automatisch gemeld. Probeer de pagina te verversen.</p>
          <button onClick={() => window.location.reload()} style={{ background: "#2D4A3E", color: "#FAF6F0", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Ververs
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service worker registreren mislukt", err);
      });
    }

    // Vangt fouten op die búiten React's eigen renderproces gebeuren (bv. in
    // een event handler of een losse async functie) — die worden niet door
    // de FoutGrens hierboven opgevangen, maar zijn minstens zo waardevol om
    // te weten.
    const onWindowError = (event) => {
      meldFout("window-error", event.message, event.error?.stack || "", window.location.pathname);
    };
    const onUnhandledRejection = (event) => {
      const reden = event.reason;
      meldFout("onafgehandelde-promise", reden?.message || String(reden), reden?.stack || "", window.location.pathname);
    };
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#FAF6F0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Ons Huishouden" />
        <link rel="manifest" href="/manifest.json" />
        <title>Ons Huishouden</title>
        {/* Leaflet CSS preloaden voor snellere kaartweergave */}
        <link rel="preload" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" as="style" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" crossOrigin="anonymous" />
      </Head>
      <FoutGrens>
        <Component {...pageProps} />
      </FoutGrens>
    </>
  );
}
