"use server";

import { prisma } from "@/lib/db";

const MAX_FREE_USERS = 10;

export async function getFreeSpotsRemaining(): Promise<number> {
  const count = await prisma.user.count();
  return Math.max(0, MAX_FREE_USERS - count);
}
