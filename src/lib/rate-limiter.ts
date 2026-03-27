// In-memory rate limiter (per user, per action)
const limits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  userId: number,
  action: string,
  maxPerHour: number
): { allowed: boolean; retryAfter?: number } {
  const key = `${userId}:${action}`;
  const now = Date.now();

  // Evict expired entries when the map grows too large
  if (limits.size > 1000) {
    for (const [k, v] of limits) {
      if (now > v.resetAt) {
        limits.delete(k);
      }
    }
  }

  const entry = limits.get(key);

  if (!entry || now > entry.resetAt) {
    limits.set(key, { count: 1, resetAt: now + 3600000 });
    return { allowed: true };
  }

  if (entry.count >= maxPerHour) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return { allowed: true };
}
