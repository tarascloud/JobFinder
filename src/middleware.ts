import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";

const PUBLIC_PATHS = ["/login", "/about", "/api/auth", "/api/health", "/api/status"];

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
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".json") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".css")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow assets and public routes
  if (isAsset(pathname) || isPublic(pathname)) {
    return NextResponse.next();
  }

  // Check for NextAuth session token
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (sessionToken) {
    return NextResponse.next();
  }

  // Check for valid demo token
  const demoToken = request.cookies.get("demo_token")?.value;
  if (demoToken) {
    const secret = process.env.NEXTAUTH_SECRET || "demo-secret";
    const expected = crypto
      .createHmac("sha256", secret)
      .update("demo")
      .digest("hex");
    if (demoToken === expected) {
      return NextResponse.next();
    }
  }

  // Not authenticated — redirect to login
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
