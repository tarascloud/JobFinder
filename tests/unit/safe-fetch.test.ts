/**
 * Unit tests for src/lib/safe-fetch.ts (ARC-20260601-0002).
 *
 * Covers SSRF defences:
 *   - scheme allowlist (http/https only)
 *   - host suffix allowlist (linkedin/github/aws etc)
 *   - private-IP blocklist via DNS resolution
 *   - rejection of /-prefixed URLs (must be read from disk)
 *   - parseLocalResumeUrl pattern enforcement
 *   - body size cap
 *
 * `dns.lookup` is mocked so tests do not hit real DNS.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const dnsLookupMock = vi.fn();
vi.mock("node:dns/promises", () => ({
  default: { lookup: (...args: unknown[]) => dnsLookupMock(...args) },
  lookup: (...args: unknown[]) => dnsLookupMock(...args),
}));

import {
  safeExternalFetch,
  SafeFetchError,
  isHostAllowed,
  isPrivateIp,
  parseLocalResumeUrl,
  resolveAndValidate,
} from "@/lib/safe-fetch";

beforeEach(() => {
  dnsLookupMock.mockReset();
});

describe("isHostAllowed", () => {
  it("allows exact suffixes", () => {
    expect(isHostAllowed("linkedin.com")).toBe(true);
    expect(isHostAllowed("github.com")).toBe(true);
  });
  it("allows sub-domains of suffixes", () => {
    expect(isHostAllowed("www.linkedin.com")).toBe(true);
    expect(isHostAllowed("media.licdn.com")).toBe(true);
    expect(isHostAllowed("raw.githubusercontent.com")).toBe(true);
    expect(isHostAllowed("foo.bar.amazonaws.com")).toBe(true);
    expect(isHostAllowed("xyz.cloudfront.net")).toBe(true);
  });
  it("rejects look-alike domains", () => {
    expect(isHostAllowed("evil-linkedin.com.attacker.io")).toBe(false);
    expect(isHostAllowed("linkedin.com.attacker.io")).toBe(false);
    expect(isHostAllowed("notgithub.com")).toBe(false);
    expect(isHostAllowed("pg")).toBe(false);
    expect(isHostAllowed("ollama")).toBe(false);
    expect(isHostAllowed("localhost")).toBe(false);
  });
  it("is case-insensitive on host", () => {
    expect(isHostAllowed("LinkedIn.COM")).toBe(true);
  });
});

describe("isPrivateIp", () => {
  it("blocks IPv4 loopback / RFC1918 / link-local / cgnat / 0.0.0.0/8", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("127.0.0.53")).toBe(true);
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("10.255.255.255")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true); // cloud metadata
    expect(isPrivateIp("100.64.0.1")).toBe(true); // CGNAT/Tailscale
    expect(isPrivateIp("0.0.0.0")).toBe(true);
    expect(isPrivateIp("224.0.0.1")).toBe(true); // multicast
  });
  it("allows public IPv4", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("172.32.0.1")).toBe(false); // just outside 172.16/12
    expect(isPrivateIp("169.255.0.1")).toBe(false); // just outside 169.254/16
  });
  it("blocks IPv6 loopback / link-local / ULA / IPv4-mapped", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("::")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fd12:3456::1")).toBe(true);
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateIp("ff02::1")).toBe(true); // multicast
  });
  it("allows public IPv6", () => {
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false); // Cloudflare DNS
    expect(isPrivateIp("2001:4860:4860::8888")).toBe(false); // Google DNS
  });
  it("fails closed on garbage", () => {
    expect(isPrivateIp("not-an-ip")).toBe(true);
    expect(isPrivateIp("")).toBe(true);
  });
});

describe("parseLocalResumeUrl", () => {
  it("accepts /api/resumes/<safe-filename>", () => {
    expect(parseLocalResumeUrl("/api/resumes/abc.pdf")).toBe("abc.pdf");
    expect(parseLocalResumeUrl("/api/resumes/my_resume-v2.pdf")).toBe("my_resume-v2.pdf");
  });
  it("accepts legacy /resumes/<safe-filename>", () => {
    expect(parseLocalResumeUrl("/resumes/abc.pdf")).toBe("abc.pdf");
  });
  it("rejects path traversal and url-encoded slashes", () => {
    expect(parseLocalResumeUrl("/api/resumes/../../../etc/passwd")).toBeNull();
    expect(parseLocalResumeUrl("/api/resumes/%2e%2e/etc")).toBeNull();
    expect(parseLocalResumeUrl("/api/resumes/foo%2Fbar")).toBeNull();
    expect(parseLocalResumeUrl("/api/resumes/sub/dir.pdf")).toBeNull();
    expect(parseLocalResumeUrl("/api/resumes/")).toBeNull();
  });
  it("rejects non-resume internal paths", () => {
    expect(parseLocalResumeUrl("/admin/internal")).toBeNull();
    expect(parseLocalResumeUrl("/api/admin/secret")).toBeNull();
    expect(parseLocalResumeUrl("/api/resumesX/foo")).toBeNull();
  });
  it("returns null for non-/-prefixed URLs", () => {
    expect(parseLocalResumeUrl("https://linkedin.com/x")).toBeNull();
    expect(parseLocalResumeUrl("")).toBeNull();
  });
});

describe("resolveAndValidate", () => {
  it("rejects literal private IP host without DNS call", async () => {
    await expect(resolveAndValidate("127.0.0.1")).rejects.toBeInstanceOf(SafeFetchError);
    await expect(resolveAndValidate("169.254.169.254")).rejects.toMatchObject({ code: "PRIVATE_IP" });
    await expect(resolveAndValidate("::1")).rejects.toMatchObject({ code: "PRIVATE_IP" });
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });
  it("returns IPs for a public-resolving hostname", async () => {
    dnsLookupMock.mockResolvedValueOnce([
      { address: "8.8.8.8", family: 4 },
      { address: "8.8.4.4", family: 4 },
    ]);
    await expect(resolveAndValidate("dns.google")).resolves.toEqual(["8.8.8.8", "8.8.4.4"]);
  });
  it("rejects if ANY resolved IP is private", async () => {
    dnsLookupMock.mockResolvedValueOnce([
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.5", family: 4 }, // hidden private IP — must block
    ]);
    await expect(resolveAndValidate("dns-rebind.example")).rejects.toMatchObject({ code: "PRIVATE_IP" });
  });
  it("rejects when DNS errors out", async () => {
    dnsLookupMock.mockRejectedValueOnce(new Error("ENOTFOUND"));
    await expect(resolveAndValidate("no-such-host.invalid")).rejects.toMatchObject({ code: "DNS_FAILED" });
  });
  it("rejects when DNS returns empty array", async () => {
    dnsLookupMock.mockResolvedValueOnce([]);
    await expect(resolveAndValidate("empty.example")).rejects.toMatchObject({ code: "DNS_FAILED" });
  });
});

describe("safeExternalFetch — URL validation", () => {
  it("rejects /-prefixed URLs (must be served from disk)", async () => {
    await expect(safeExternalFetch("/admin/internal")).rejects.toMatchObject({ code: "BAD_PATH" });
    await expect(safeExternalFetch("/api/resumes/abc.pdf")).rejects.toMatchObject({ code: "BAD_PATH" });
  });
  it("rejects empty/non-string URLs", async () => {
    // @ts-expect-error — runtime input may be wrong type
    await expect(safeExternalFetch(undefined)).rejects.toMatchObject({ code: "INVALID_URL" });
    await expect(safeExternalFetch("")).rejects.toMatchObject({ code: "INVALID_URL" });
  });
  it("rejects malformed URLs", async () => {
    await expect(safeExternalFetch("not a url")).rejects.toMatchObject({ code: "INVALID_URL" });
  });
  it("rejects non-http(s) schemes", async () => {
    await expect(safeExternalFetch("file:///etc/passwd")).rejects.toMatchObject({ code: "BAD_SCHEME" });
    await expect(safeExternalFetch("gopher://attacker.io/")).rejects.toMatchObject({ code: "BAD_SCHEME" });
    await expect(safeExternalFetch("ftp://files.example.com/")).rejects.toMatchObject({ code: "BAD_SCHEME" });
    await expect(safeExternalFetch("data:text/html,<script>")).rejects.toMatchObject({ code: "BAD_SCHEME" });
    await expect(safeExternalFetch("javascript:alert(1)")).rejects.toMatchObject({ code: "BAD_SCHEME" });
  });
  it("rejects internal docker-network hosts (pg, ollama, redis, localhost)", async () => {
    // These are non-allowlisted hostnames so they trip HOST_NOT_ALLOWED before any DNS happens.
    await expect(safeExternalFetch("http://pg:5432")).rejects.toMatchObject({ code: "HOST_NOT_ALLOWED" });
    await expect(safeExternalFetch("http://ollama:11434/api/tags")).rejects.toMatchObject({ code: "HOST_NOT_ALLOWED" });
    await expect(safeExternalFetch("http://localhost:8003/api/admin")).rejects.toMatchObject({ code: "HOST_NOT_ALLOWED" });
    await expect(safeExternalFetch("http://redis:6379")).rejects.toMatchObject({ code: "HOST_NOT_ALLOWED" });
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });
  it("rejects raw private-IP URLs even if attacker bypasses host allowlist via literal IP", async () => {
    // Literal IPs are not in the host suffix allowlist, so they fail HOST_NOT_ALLOWED.
    // Even if the allowlist did pass, resolveAndValidate would catch them — tested above.
    await expect(safeExternalFetch("http://169.254.169.254/latest/meta-data/")).rejects.toMatchObject({ code: "HOST_NOT_ALLOWED" });
    await expect(safeExternalFetch("http://127.0.0.1:8003/api/admin")).rejects.toMatchObject({ code: "HOST_NOT_ALLOWED" });
    await expect(safeExternalFetch("http://[::1]:3456/")).rejects.toMatchObject({ code: "HOST_NOT_ALLOWED" });
  });
  it("rejects look-alike domains", async () => {
    await expect(safeExternalFetch("https://evil-linkedin.com.attacker.io/foo")).rejects.toMatchObject({ code: "HOST_NOT_ALLOWED" });
  });
});

describe("safeExternalFetch — body size cap", () => {
  it("aborts when response body exceeds maxBytes", async () => {
    dnsLookupMock.mockResolvedValueOnce([{ address: "1.2.3.4", family: 4 }]);
    // Simulate a never-ending response body (~10 MB at once).
    const big = new Uint8Array(2_000_000);
    const stream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < 4; i++) controller.enqueue(big); // 8 MB total
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(stream, { headers: { "content-type": "text/html" } })
    );
    const orig = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      await expect(
        safeExternalFetch("https://linkedin.com/in/big", { maxBytes: 1_000_000 })
      ).rejects.toMatchObject({ code: "BODY_TOO_LARGE" });
    } finally {
      globalThis.fetch = orig;
    }
  });
});

describe("safeExternalFetch — happy path", () => {
  it("fetches an allowlisted public URL and returns text", async () => {
    dnsLookupMock.mockResolvedValueOnce([{ address: "203.0.113.10", family: 4 }]);
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response("<html>hi</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    );
    const orig = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const r = await safeExternalFetch("https://linkedin.com/in/foo");
      expect(r.ok).toBe(true);
      expect(r.status).toBe(200);
      expect(r.contentType).toContain("text/html");
      expect(r.text).toBe("<html>hi</html>");
    } finally {
      globalThis.fetch = orig;
    }
    expect(dnsLookupMock).toHaveBeenCalledTimes(1);
  });

  it("allows github.com via the host allowlist", async () => {
    dnsLookupMock.mockResolvedValueOnce([{ address: "140.82.121.4", family: 4 }]);
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response("README", { status: 200, headers: { "content-type": "text/plain" } })
    );
    const orig = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const r = await safeExternalFetch("https://github.com/foo/bar");
      expect(r.ok).toBe(true);
      expect(r.text).toBe("README");
    } finally {
      globalThis.fetch = orig;
    }
  });
});
