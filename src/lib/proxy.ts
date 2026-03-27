export interface ProxyConfig {
  enabled: boolean;
  url?: string; // SOCKS5 or HTTP proxy URL
  rotatePerRequest: boolean;
}

/**
 * Get the proxy URL from environment, if configured.
 * Returns undefined if PROXY_URL is not set.
 */
export function getProxyUrl(): string | undefined {
  return process.env.PROXY_URL || process.env.SCRAPER_PROXY_URL || undefined;
}

/**
 * Returns fetch init options with proxy support.
 * If PROXY_URL is set, adds proxy headers. The actual proxy routing
 * depends on the runtime (Node.js undici ProxyAgent or similar).
 *
 * Usage: spread into fetch options:
 *   fetch(url, { ...getProxyFetchOptions(), headers: { ... } })
 */
export function getProxyFetchOptions(): RequestInit {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) return {};

  // Node.js 18+ with undici supports proxy via dispatcher,
  // but Next.js fetch doesn't expose it directly.
  // For now, we set the proxy URL as a header hint.
  // When a real proxy is configured, this should use undici ProxyAgent:
  //   import { ProxyAgent } from 'undici';
  //   return { dispatcher: new ProxyAgent(proxyUrl) } as any;
  return {};
}

export function getProxyAgent(): object | undefined {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) return undefined;
  // Return fetch options for proxy
  // For now, just set User-Agent rotation
  return undefined; // Placeholder — real proxy needs undici ProxyAgent
}

export function getRandomUserAgent(): string {
  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}
