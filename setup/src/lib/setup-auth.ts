import { NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "crypto";

/**
 * Setup Wizard authentication.
 *
 * Self-hosted installer must not be exposed as an anonymous container takeover
 * endpoint. On first module load we read SETUP_TOKEN from the environment; if
 * not provided we generate a fresh random token and print it to stdout so the
 * operator can copy it from `docker logs`.
 *
 * Clients must send the token in the `x-setup-token` header. Compared with
 * crypto.timingSafeEqual to avoid timing attacks.
 */

function initToken(): string {
  const fromEnv = process.env.SETUP_TOKEN?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  const generated = randomBytes(24).toString("hex");
  // eslint-disable-next-line no-console
  console.log(
    "\n==============================================================\n" +
      "  JobFinder Setup Wizard — SETUP_TOKEN not provided, generated one:\n" +
      `  ${generated}\n` +
      "  Paste this token in the wizard UI when prompted.\n" +
      "==============================================================\n",
  );
  return generated;
}

const SETUP_TOKEN = initToken();

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf-8");
  const bb = Buffer.from(b, "utf-8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verify a request's setup token. Returns null on success,
 * or a NextResponse 401 that the caller should return on failure.
 */
export function verifySetupToken(req: Request): NextResponse | null {
  const provided = req.headers.get("x-setup-token") || "";
  if (!provided || !safeEqual(provided, SETUP_TOKEN)) {
    return NextResponse.json(
      { error: "Unauthorized: missing or invalid x-setup-token header" },
      { status: 401 },
    );
  }
  return null;
}
