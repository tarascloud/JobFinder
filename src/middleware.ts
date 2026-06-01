import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { verifyDemoToken, DEMO_COOKIE } from "@/lib/demo-token";

// v3 - JWT signature verification (SEC-001) + rate limiting (SEC-021)
const PUBLIC_PATHS = [
  "/login",
  "/landing",
  "/about",
  "/api/auth",
  "/api/health",
  "/api/status",
  "/api/email-response",
  "/api/telegram-webhook",
  "/api/scrape",        // bearer-token auth (JOBFINDER_CRON_SECRET), no session
  "/api/apply",         // bearer-token auth (JOBFINDER_CRON_SECRET), no session
];

// Auth endpoints subject to rate limiting
const RATE_LIMITED_PATHS = [
  "/api/auth/signin",
  "/api/auth/callback",
  "/api/auth/session",
];

const DEMO_RATE_PATHS = ["/api/auth/demo", "/login"];

// In-memory rate limiter: IP -> { count, resetAt }
// Note: resets on each edge worker cold-start; suitable for basic protection.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;        // requests per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function isRateLimited(ip: string, path: string): boolean {
  const isAuthPath = RATE_LIMITED_PATHS.some((p) => path.startsWith(p));
  const isDemoPath = DEMO_RATE_PATHS.some((p) => path.startsWith(p));
  if (!isAuthPath && !isDemoPath) return false;

  const now = Date.now();
  const key = `${ip}:${path}`;
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

// SEO files that must be publicly accessible to search engine crawlers
const SEO_PATHS = ["/sitemap.xml", "/robots.txt"];

function isAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon-") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/sw") ||
    pathname.startsWith("/serwist") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".json") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".css") ||
    SEO_PATHS.includes(pathname)
  );
}


// Routes that authenticate via bearer tokens / signed webhooks, not
// cookie sessions — exempt from CSRF Origin check.
const CSRF_EXEMPT_PREFIXES = [
  "/api/auth",          // next-auth (has its own CSRF token)
  "/api/health",
  "/api/status",
  "/api/email-response",
  "/api/telegram-webhook",
  "/api/scrape",        // cron bearer-token auth, no cookie session
  "/api/apply",         // cron bearer-token auth, no cookie session
];

function csrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Defence-in-depth CSRF check for state-changing API routes that rely
 * on cookie sessions. SameSite=Lax already blocks cross-site POSTs
 * from browsers, but we additionally verify that the Origin header
 * matches the request Host to defeat compromised subdomains or
 * misconfigured SameSite=None cookies.
 */
function csrfBlocked(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  if (!request.nextUrl.pathname.startsWith("/api/")) return false;
  if (csrfExempt(request.nextUrl.pathname)) return false;

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;
  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) return true;
  } catch {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSRF Origin check (before auth so unauthenticated cross-site POSTs
  // are rejected consistently).
  if (csrfBlocked(request)) {
    return NextResponse.json(
      { error: "CSRF: Origin header missing or does not match Host" },
      { status: 403 },
    );
  }

  // Allow assets, root, and public routes
  if (isAsset(pathname) || pathname === "/" || isPublic(pathname)) {
    return NextResponse.next();
  }

  // Rate limiting for auth endpoints
  const ip = getClientIp(request);
  if (isRateLimited(ip, pathname)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // Check for valid demo token (Edge-compatible Web Crypto with TTL)
  const demoToken = request.cookies.get(DEMO_COOKIE)?.value;
  if (demoToken && (await verifyDemoToken(demoToken))) {
    return NextResponse.next();
  }

  // Verify JWT session token (checks signature + expiry, not just cookie existence)
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NEXTAUTH_URL?.startsWith("https://"),
  });

  if (!token?.email) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
