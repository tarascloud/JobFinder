import { cookies } from "next/headers";
import { auth } from "./auth";
import { prisma } from "./db";
import { verifyDemoToken, DEMO_COOKIE } from "@/lib/demo-token";

/** Fake demo user returned when browsing in demo mode */
const DEMO_USER = {
  id: 0,
  email: "demo@jf.taras.cloud",
  name: "Demo User",
  image: null,
  googleId: null,
  jfEmail: "demo@jf.taras.cloud",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
} as const;

export async function isDemoMode(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(DEMO_COOKIE)?.value;
  return verifyDemoToken(token);
}

export async function getCurrentUser() {
  // Check demo mode first
  if (await isDemoMode()) {
    return DEMO_USER;
  }

  const session = await auth();
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
