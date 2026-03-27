import { prisma } from "./db";

const JF_DOMAIN = "jf.taras.cloud";

/**
 * Generate a slug from the user's name or email.
 * - "Taras Pedchenko" -> "tpedchenko"
 * - "John Doe" -> "jdoe"
 * - If no name, use email prefix: "john@gmail.com" -> "john"
 */
function generateSlug(name: string | null | undefined, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      const first = parts[0].toLowerCase().replace(/[^a-z]/g, "");
      const last = parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, "");
      if (first && last) {
        return `${first[0]}${last}`;
      }
    }
    // Single name or failed to parse
    const cleaned = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleaned) return cleaned;
  }

  // Fallback to email prefix
  const prefix = email.split("@")[0] || "user";
  return prefix.toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

/**
 * Generate a unique jf.taras.cloud email for a new user.
 * Appends a number suffix if the slug is already taken.
 */
export async function generateJfEmail(
  name: string | null | undefined,
  email: string,
): Promise<string> {
  const baseSlug = generateSlug(name, email);
  let candidate = `${baseSlug}@${JF_DOMAIN}`;

  const existing = await prisma.user.findUnique({
    where: { jfEmail: candidate },
    select: { id: true },
  });

  if (!existing) return candidate;

  // Slug taken — try with number suffix
  let counter = 2;
  while (counter < 100) {
    candidate = `${baseSlug}${counter}@${JF_DOMAIN}`;
    const taken = await prisma.user.findUnique({
      where: { jfEmail: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
    counter++;
  }

  // Extremely unlikely fallback
  return `${baseSlug}${Date.now()}@${JF_DOMAIN}`;
}
