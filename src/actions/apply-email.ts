"use server";

import { requireUser } from "@/lib/current-user";
import { getApplyEmail } from "@/lib/apply-email";

/**
 * Returns the current user's apply email and personal (forward) email.
 * Prefers the stored jfEmail from DB; falls back to computed email.
 */
export async function getApplyEmailInfo(): Promise<{
  applyEmail: string;
  forwardEmail: string;
}> {
  const user = await requireUser();
  return {
    applyEmail: user.jfEmail || getApplyEmail(user.email),
    forwardEmail: user.email,
  };
}
