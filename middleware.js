import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const SESSION_COOKIE = "huis_session";

// Routes die altijd toegankelijk moeten zijn, ook zonder geldige sessie:
// de hoofdpagina (regelt zelf setup/login/overzicht) en de auth-API's.
const PUBLIC_PATHS = ["/", "/api/auth/setup", "/api/auth/login", "/api/auth/me", "/api/auth/logout"];

// @upstash/redis gebruikt de fetch-based REST API, dus dit werkt ook in de
// Edge runtime van de middleware (i.t.t. bijv. bcryptjs, dat Node-specifieke
// crypto nodig heeft en daarom niet hier maar in de API-routes wordt gebruikt).
const redis = Redis.fromEnv();

function sessionKey(token) {
  return `sessie:${token}`;
}

export async function middleware(req) {
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

  const token = req.cookies.get(SESSION_COOKIE)?.value;

  const unauthorized = () => {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
    }
    const homeUrl = new URL("/", req.url);
    return NextResponse.redirect(homeUrl);
  };

  if (!token) {
    return unauthorized();
  }

  // Echte validatie: bestaat de sessie nog in Redis, of is het cookie verlopen/
  // verwijderd (bijv. na wachtwoordwijziging of handmatig gewiste sessie)?
  try {
    const result = await redis.get(sessionKey(token));
    if (!result) {
      return unauthorized();
    }
  } catch (err) {
    // Als Redis zelf niet bereikbaar is, laten we het verzoek doorgaan naar de
    // API-route i.p.v. iedereen uit te loggen door een tijdelijke storing.
    console.error("Middleware sessie-check mislukt:", err);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
