import crypto from "crypto";

const DEMO_SECRET = process.env.NEXTAUTH_SECRET;

export function isValidDemoToken(token: string): boolean {
  if (!DEMO_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", DEMO_SECRET)
    .update("demo")
    .digest("hex");
  return token === expected;
}
