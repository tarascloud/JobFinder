import type { MetadataRoute } from "next";

// AI training crawlers — block from training on this content
// (REV-2026-05-03-100). User-agents drawn from each crawler's public docs.
const AI_BOTS = [
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "Google-Extended",
  "CCBot",
  "PerplexityBot",
  "Bytespider",
  "Amazonbot",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "FacebookBot",
  "cohere-ai",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
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
          "/login",
        ],
      },
      ...AI_BOTS.map((ua) => ({ userAgent: ua, disallow: "/" })),
    ],
    sitemap: "https://jobfinder.taras.cloud/sitemap.xml",
  };
}
