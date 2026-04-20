import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/onboarding/",
        "/admin/",
        "/settings/",
        "/profile/",
        "/vacancies/",
        "/applications/",
        "/searches/",
        "/emails/",
        "/analytics/",
        "/qa/",
      ],
    },
    sitemap: "https://jobfinder.taras.cloud/sitemap.xml",
  };
}
