import { prisma } from "./db";

export async function needsOnboarding(userId: number): Promise<boolean> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });
  return !profile;
}
