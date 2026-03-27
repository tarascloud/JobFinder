/**
 * Computes the per-user apply email address used when auto-applying to jobs.
 * Uses the local part of user's email (e.g. tpedchenko@gmail.com → tpedchenko@jf.taras.cloud).
 * Recruiter replies are routed by CF Email Worker back to the app and forwarded to the user's personal email.
 */
export function getApplyEmail(userEmail: string): string {
  const localPart = userEmail.split("@")[0] || "user";
  return `${localPart}@jf.taras.cloud`;
}
