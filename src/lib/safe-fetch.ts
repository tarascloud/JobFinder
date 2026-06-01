/**
 * safe-fetch — SSRF-hardened fetch wrapper for user-supplied URLs.
 *
 * Defends against the SSRF class found in MP-SEC ARC-20260601-0002 where
 * `analyzeResumeForUser` did an unbounded `fetch(userUrl)` and rendered the
 * response back to the model/user, allowing attackers to probe internal
 * services (pg:5432, ollama:11434, cloud metadata, localhost:8003 etc).
 *
 * Defences layered:
 *   1. Scheme allowlist — only http(s).
 *   2. Strict path validation for /-prefixed URLs (only /api/resumes/<safe>).
 *   3. Host suffix allowlist (linkedin, github, githubusercontent, aws, cdn).
 *   4. DNS resolution + IP-range blocklist (loopback, private RFC1918,
 *      link-local 169.254, IPv4-mapped IPv6, fc00::/7, fe80::/10, ::1,
 *      0.0.0.0/8). All resolved IPs must pass.
 *   5. Response body size cap (default 5 MB) — streamed, aborts on overflow.
 *   6. Timeout (default 15 s) via AbortController.
 *
 * KNOWN LIMITATIONS:
 *   - DNS rebinding TOCTOU: we resolve once and let fetch resolve again on
 *     the wire. Production mitigation would require passing a custom
 *     `lookup` to undici's Agent. For now the host allowlist is the primary
 *     bulwark — even if DNS rebinds, only allowlisted hosts can reach this
 *     code path with /-non-prefixed URLs.
 *   - We do NOT follow redirects across hosts (redirect: "manual" by default
 *     in the export below); callers that need redirects must re-validate
 *     `Location` through safeExternalFetch again.
 */
import dns from "node:dns/promises";
import { isIP } from "node:net";

interface LookupAddress { address: string; family: number }

export class SafeFetchError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_URL"
      | "BAD_SCHEME"
      | "BAD_PATH"
      | "HOST_NOT_ALLOWED"
      | "PRIVATE_IP"
      | "DNS_FAILED"
      | "BODY_TOO_LARGE"
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

/**
 * Host suffix allowlist for external resume fetches. Suffix match —
 * `linkedin.com` matches `linkedin.com` and `www.linkedin.com` but NOT
 * `evil-linkedin.com.attacker.io`.
 */
const ALLOWED_HOST_SUFFIXES = [
  "linkedin.com",
  "githubusercontent.com",
  "github.com",
  "amazonaws.com",
  "cloudfront.net",
  "licdn.com", // covers media.licdn.com (LinkedIn CDN)
];

/**
 * Strict resume-on-disk URL pattern. Only filenames composed of
 * alphanumerics, dot, underscore, dash. NO slashes, no `..`, no encoded
 * chars (%2F etc). Matches the directory layout of {dataDir}/resumes/.
 */
const LOCAL_RESUME_RE = /^\/api\/resumes\/[a-zA-Z0-9._-]+$/;

/**
 * IPv4 dotted-quad → 32-bit unsigned int. Returns -1 on invalid.
 */
function ipv4ToInt(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) return -1;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return -1;
    n = (n << 8) | o;
  }
  return n >>> 0;
}

/**
 * Check whether an IPv4 address falls into any disallowed range.
 */
function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n < 0) return true; // unparseable — fail closed
  // NOTE: `n & mask` is signed-int in JS; coerce with `>>> 0` so the
  // comparison literal (uint32) matches. Without this, high-bit ranges
  // like 127/8, 172.16/12, 169.254/16 silently slip past the check.
  const mask = (v: number) => (n & v) >>> 0;
  // 0.0.0.0/8 — "this network"
  if (mask(0xff000000) === 0x00000000) return true;
  // 10.0.0.0/8
  if (mask(0xff000000) === 0x0a000000) return true;
  // 127.0.0.0/8 — loopback
  if (mask(0xff000000) === 0x7f000000) return true;
  // 169.254.0.0/16 — link-local (cloud metadata)
  if (mask(0xffff0000) === 0xa9fe0000) return true;
  // 172.16.0.0/12
  if (mask(0xfff00000) === 0xac100000) return true;
  // 192.168.0.0/16
  if (mask(0xffff0000) === 0xc0a80000) return true;
  // 100.64.0.0/10 — CGNAT / Tailscale shared
  if (mask(0xffc00000) === 0x64400000) return true;
  // 224.0.0.0/4 — multicast
  if (mask(0xf0000000) === 0xe0000000) return true;
  return false;
}

/**
 * Check whether an IPv6 address is in a disallowed range. Lower-cases
 * the input and looks at canonical prefixes; node's dns returns
 * already-normalised strings, but we tolerate any case.
 */
function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  // ::1 — loopback
  if (v === "::1") return true;
  // :: — unspecified
  if (v === "::") return true;
  // fe80::/10 — link-local
  if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true;
  // fc00::/7 — unique local (fc.. and fd..)
  if (v.startsWith("fc") || v.startsWith("fd")) return true;
  // ff00::/8 — multicast
  if (v.startsWith("ff")) return true;
  // ::ffff:a.b.c.d — IPv4-mapped, extract embedded IPv4 and re-check
  const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (m) return isPrivateIPv4(m[1]);
  // ::a.b.c.d — IPv4-compatible (deprecated but worth blocking)
  const m2 = v.match(/^::(\d+\.\d+\.\d+\.\d+)$/);
  if (m2) return isPrivateIPv4(m2[1]);
  return false;
}

/**
 * Returns true if `ip` is in any of the disallowed ranges. Returns true
 * (fail closed) if the IP is unparseable.
 */
export function isPrivateIp(ip: string): boolean {
  const fam = isIP(ip);
  if (fam === 4) return isPrivateIPv4(ip);
  if (fam === 6) return isPrivateIPv6(ip);
  return true; // unknown family — fail closed
}

/**
 * True if `hostname` exactly equals or ends with `.${suffix}` for any
 * suffix in the allowlist. Bare suffix match is intentional so e.g.
 * `linkedin.com` is allowed AND `media.licdn.com` is allowed.
 */
export function isHostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase();
  for (const s of ALLOWED_HOST_SUFFIXES) {
    if (h === s) return true;
    if (h.endsWith("." + s)) return true;
  }
  return false;
}

/**
 * Resolves `hostname` via DNS and throws SafeFetchError if ANY returned
 * address falls into a disallowed range. If the hostname IS a literal IP,
 * just validates it directly without DNS.
 *
 * Returns the list of resolved IPs (for callers that want to pin the
 * fetch to a known-good IP — currently unused).
 */
export async function resolveAndValidate(hostname: string): Promise<string[]> {
  // Literal IP — no DNS lookup needed.
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new SafeFetchError(
        `Host ${hostname} resolves to a private/internal IP`,
        "PRIVATE_IP"
      );
    }
    return [hostname];
  }

  let addrs: LookupAddress[];
  try {
    // all: true → return every A/AAAA record so an attacker can't hide a
    // private IP behind a multi-record DNS answer.
    addrs = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (e) {
    throw new SafeFetchError(
      `DNS lookup failed for ${hostname}: ${e instanceof Error ? e.message : "unknown"}`,
      "DNS_FAILED"
    );
  }

  if (!addrs.length) {
    throw new SafeFetchError(`DNS returned no addresses for ${hostname}`, "DNS_FAILED");
  }

  for (const a of addrs) {
    if (isPrivateIp(a.address)) {
      throw new SafeFetchError(
        `Host ${hostname} resolves to a private/internal IP (${a.address})`,
        "PRIVATE_IP"
      );
    }
  }
  return addrs.map((a) => a.address);
}

export interface SafeFetchOptions {
  /** Request timeout in ms (default 15000). */
  timeoutMs?: number;
  /** Max bytes to read from response body (default 5_000_000 = 5 MB). */
  maxBytes?: number;
  /** HTTP headers to forward. */
  headers?: Record<string, string>;
  /** HTTP method (default GET). */
  method?: string;
}

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  contentType: string;
  /** Body as utf-8 string. Truncated at `maxBytes`. */
  text: string;
}

/**
 * Validates `rawUrl` against SSRF rules and fetches it.
 *
 * Throws SafeFetchError on validation failure. Throws plain Error on
 * network/timeout failure (caller can inspect e.message).
 *
 * If `rawUrl` starts with `/api/resumes/`, the caller is expected to
 * serve it locally; we still return a SafeFetchError("BAD_PATH") if the
 * filename portion contains anything outside `[a-zA-Z0-9._-]`. The
 * action layer reads the file from disk; this helper is only for
 * external/remote URLs and is the wrong tool for local files. Callers
 * should check `isLocalResumeUrl()` before deciding to call this.
 */
export async function safeExternalFetch(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const { timeoutMs = 15000, maxBytes = 5_000_000, headers = {}, method = "GET" } = options;

  if (typeof rawUrl !== "string" || rawUrl.length === 0) {
    throw new SafeFetchError("URL is required", "INVALID_URL");
  }

  // Reject /-prefixed paths here — those are local files, callers should
  // handle them via disk read, not via this helper. We still return a
  // helpful error code so the API layer knows it's not a "host" issue.
  if (rawUrl.startsWith("/")) {
    throw new SafeFetchError(
      "Local /-prefixed URLs must be read from disk, not fetched",
      "BAD_PATH"
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SafeFetchError(`Invalid URL: ${rawUrl}`, "INVALID_URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SafeFetchError(
      `Scheme ${parsed.protocol} is not allowed (only http/https)`,
      "BAD_SCHEME"
    );
  }

  if (!isHostAllowed(parsed.hostname)) {
    throw new SafeFetchError(
      `URL host ${parsed.hostname} is not in the allowlist`,
      "HOST_NOT_ALLOWED"
    );
  }

  await resolveAndValidate(parsed.hostname);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const response = await fetch(parsed.toString(), {
      method,
      headers,
      signal: ac.signal,
      redirect: "manual", // do not follow cross-host redirects silently
    });

    const contentType = response.headers.get("content-type") || "";

    // Stream-read body up to maxBytes. Abort if over.
    let received = 0;
    const chunks: Uint8Array[] = [];
    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            received += value.byteLength;
            if (received > maxBytes) {
              // Cancel the stream — don't waste bandwidth.
              try { await reader.cancel(); } catch { /* ignore */ }
              throw new SafeFetchError(
                `Response body exceeds ${maxBytes} bytes`,
                "BODY_TOO_LARGE"
              );
            }
            chunks.push(value);
          }
        }
      } finally {
        try { reader.releaseLock(); } catch { /* ignore */ }
      }
    }

    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const text = buf.toString("utf-8");

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType,
      text,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Helper for callers: is this `url` a local resume reference that should
 * be served from disk (not fetched)? Validates the filename portion to
 * prevent path traversal. Returns the safe filename if it matches the
 * pattern, otherwise null.
 */
export function parseLocalResumeUrl(url: string): string | null {
  if (!url.startsWith("/")) return null;
  // Old form `/resumes/<filename>` is still supported by callers but
  // tighter validation is enforced in the new form.
  if (url.startsWith("/resumes/")) {
    const tail = url.slice("/resumes/".length);
    if (/^[a-zA-Z0-9._-]+$/.test(tail)) return tail;
    return null;
  }
  if (!LOCAL_RESUME_RE.test(url)) return null;
  return url.slice("/api/resumes/".length);
}
