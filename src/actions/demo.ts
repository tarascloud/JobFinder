"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";

const DEMO_SECRET = process.env.NEXTAUTH_SECRET || "demo-secret";

export async function enterDemoMode() {
  const token = crypto
    .createHmac("sha256", DEMO_SECRET)
    .update("demo")
    .digest("hex");
  const jar = await cookies();
  jar.set("demo_token", token, {
    path: "/",
    maxAge: 3600,
    httpOnly: true,
    sameSite: "lax",
  });
  redirect("/profile");
}

export async function exitDemoMode() {
  const jar = await cookies();
  jar.delete("demo_token");
  redirect("/login");
}

