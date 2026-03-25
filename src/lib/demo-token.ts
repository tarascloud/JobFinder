import crypto from "crypto";

const DEMO_SECRET = process.env.NEXTAUTH_SECRET || "demo-secret";

export function isValidDemoToken(token: string): boolean {
  const expected = crypto
    .createHmac("sha256", DEMO_SECRET)
    .update("demo")
    .digest("hex");
  return token === expected;
}
