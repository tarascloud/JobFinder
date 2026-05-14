import { slidingWindow } from "./rate-limit-redis";

/**
 * JF rate limiter.
 *
 * Internals: Redis-backed sliding window when REDIS_URL/REDIS_PASSWORD set
 * (canon shared with PD/VS/KO via `rate-limit-redis.ts`, namespace `jf:rl`).
 * Falls back to in-process Maps for dev/CI without Redis.
 *
 * Public API (`checkRateLimit`, `checkIpRateLimit`) preserved from pre-Redis
 * version so existing callers continue to work. Distributed-aware async
 * variants exposed for new code: `checkRateLimitAsync`, `checkIpRateLimitAsync`.
 */

const NAMESPACE = "jf:rl";

// Per user, per action (hour-window)
const limits = new Map<string, { count: number; resetAt: number }>();

// IP-based (per IP, per action, minute-window)
const ipLimits = new Map<string, { count: number; resetAt: number }>();

/**
 * @deprecated Use `checkIpRateLimitAsync` (Redis-backed, distributed-safe).
 * In-memory variant kept only for legacy callers and dev/CI without Redis.
 * Will be removed once all callers migrate.
 */
export function checkIpRateLimit(
  ip: string,
  action: string,
  maxPerMinute: number
): { allowed: boolean; retryAfter?: number } {
  const key = `${ip}:${action}`;
  const now = Date.now();

  if (ipLimits.size > 2000) {
    for (const [k, v] of ipLimits) {
      if (now > v.resetAt) ipLimits.delete(k);
    }
  }

  const entry = ipLimits.get(key);
  if (!entry || now > entry.resetAt) {
    ipLimits.set(key, { count: 1, resetAt: now + 60000 });
    return { allowed: true };
  }
  if (entry.count >= maxPerMinute) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true };
}

/**
 * @deprecated Use `checkRateLimitAsync` (Redis-backed, distributed-safe).
 * In-memory variant kept only for legacy callers and dev/CI without Redis.
 * Will be removed once all callers migrate.
 */
export function checkRateLimit(
  userId: number,
  action: string,
  maxPerHour: number
): { allowed: boolean; retryAfter?: number } {
  const key = `${userId}:${action}`;
  const now = Date.now();

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

/**
 * Async variant — Redis preferred, fail-open via slidingWindow().
 * Use in new code that runs in distributed deployments.
 */
export async function checkRateLimitAsync(
  userId: number,
  action: string,
  maxPerHour: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const r = await slidingWindow(NAMESPACE, `u:${userId}:${action}`, {
    limit: maxPerHour,
    windowSeconds: 3600,
  });
  if (!r.allowed) return { allowed: false, retryAfter: r.retryAfterSecs };
  return { allowed: true };
}

export async function checkIpRateLimitAsync(
  ip: string,
  action: string,
  maxPerMinute: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const r = await slidingWindow(NAMESPACE, `ip:${ip}:${action}`, {
    limit: maxPerMinute,
    windowSeconds: 60,
  });
  if (!r.allowed) return { allowed: false, retryAfter: r.retryAfterSecs };
  return { allowed: true };
}
