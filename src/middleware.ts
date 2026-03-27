import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// v2 - landing page support
const PUBLIC_PATHS = ["/login", "/landing", "/about", "/api/auth", "/api/health", "/api/status", "/api/admin/emails", "/api/email-response", "/api/telegram-webhook"];

function isRootPath(pathname: string): boolean {
  return pathname === "/";
}

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

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
    pathname.endsWith(".css")
  );
}

async function verifyDemoToken(token: string): Promise<boolean> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode("demo"));
  const expected = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return token === expected;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow assets, public routes, and root landing page
  if (isAsset(pathname) || isPublic(pathname) || isRootPath(pathname)) {
    return NextResponse.next();
  }

  // Check for NextAuth session token
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (sessionToken) {
    return NextResponse.next();
  }

  // Check for valid demo token (Edge-compatible Web Crypto)
  const demoToken = request.cookies.get("demo_token")?.value;
  if (demoToken) {
    if (await verifyDemoToken(demoToken)) {
      return NextResponse.next();
    }
  }

  // Not authenticated — redirect to login (but never redirect root /)
  if (pathname === "/") {
    return NextResponse.next();
  }
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
