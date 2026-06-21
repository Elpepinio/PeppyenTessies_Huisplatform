import { NextResponse } from "next/server";

const SESSION_COOKIE = "huis_session";

// Routes die altijd toegankelijk moeten zijn, ook zonder geldige sessie:
// de hoofdpagina (regelt zelf setup/login/overzicht) en de auth-API's.
const PUBLIC_PATHS = ["/", "/api/auth/setup", "/api/auth/login", "/api/auth/me", "/api/auth/logout"];

export function middleware(req) {
  const { pathname } = req.nextUrl;

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icon-") ||
    pathname === "/manifest.json" ||
    pathname === "/favicon.ico";

  if (isPublic) {
    return NextResponse.next();
  }

  const hasCookie = req.cookies.has(SESSION_COOKIE);

  if (!hasCookie) {
    // API-routes krijgen een nette JSON-foutmelding, tool-pagina's worden naar het
    // platform-hoofdscherm gestuurd, dat zelf het inlogformulier toont.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
    }
    const homeUrl = new URL("/", req.url);
    return NextResponse.redirect(homeUrl);
  }

  // Let op: de middleware checkt hier alleen of het cookie ÚÚberhaupt bestaat.
  // De echte geldigheid (bestaat de sessie nog in Redis?) wordt gecontroleerd
  // in de API-routes zelf, zodat een verlopen of verwijderde sessie alsnog
  // wordt afgewezen zelfs als het cookie nog in de browser staat.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
