import type { MetadataRoute } from "next";

const BASE_URL = "https://jobfinder.taras.cloud";

// SMM-20260601-0012: static dates for rarely-changing pages — stop using new Date()
// which changes on every request and defeats lastmod freshness signal for Googlebot.
const STATIC_LASTMOD = "2026-06-01";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: STATIC_LASTMOD,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: STATIC_LASTMOD,
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ];
}
