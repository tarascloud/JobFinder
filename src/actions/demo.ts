"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createDemoToken, DEMO_COOKIE, DEMO_TTL_SECONDS } from "@/lib/demo-token";

export async function enterDemoMode() {
  const token = await createDemoToken();
  const jar = await cookies();
  jar.set(DEMO_COOKIE, token, {
    path: "/",
    maxAge: DEMO_TTL_SECONDS,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
  redirect("/profile");
}

export async function exitDemoMode() {
  const jar = await cookies();
  jar.delete(DEMO_COOKIE);
  redirect("/login");
}
