export interface ProxyConfig {
  enabled: boolean;
  url?: string; // SOCKS5 or HTTP proxy URL
  rotatePerRequest: boolean;
}

export function getProxyAgent(): object | undefined {
  const proxyUrl = process.env.SCRAPER_PROXY_URL;
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
