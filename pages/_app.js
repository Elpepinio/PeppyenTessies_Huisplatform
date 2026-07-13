import Head from "next/head";
import { useEffect } from "react";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service worker registreren mislukt", err);
      });
    }
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
      <Component {...pageProps} />
    </>
  );
}
