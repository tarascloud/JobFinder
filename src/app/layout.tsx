import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { cookies } from "next/headers";
import Script from "next/script";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { restorePreferencesFromDB } from "@/actions/preferences";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: {
    default: "JobFinder — AI-Powered Job Search & Auto-Apply",
    template: "%s | JobFinder",
  },
  description:
    "Open-source AI job search automation. Upload your resume, scrape 11+ job boards, get AI match scores, auto-generate cover letters, and auto-apply. Self-hosted, privacy-first.",
  keywords: [
    "job search automation",
    "AI job matching",
    "auto apply jobs",
    "job scraper",
    "resume parser",
    "cover letter generator",
    "open source job board",
    "self-hosted job search",
    "LinkedIn scraper",
    "Indeed scraper",
    "job application tracker",
    "AI recruitment",
    "remote jobs",
  ],
  manifest: "/manifest.json",
  metadataBase: new URL("https://jobfinder.taras.cloud"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "JobFinder",
    title: "JobFinder — AI-Powered Job Search & Auto-Apply",
    description:
      "Open-source AI job search automation. Scrape 11+ job boards, get AI match scores, auto-generate cover letters, and auto-apply. Self-hosted & privacy-first.",
    url: "https://jobfinder.taras.cloud",
  },
  twitter: {
    card: "summary_large_image",
    title: "JobFinder — AI-Powered Job Search & Auto-Apply",
    description:
      "Open-source AI job search automation. Scrape 11+ job boards, AI scoring, auto-apply. Self-hosted & privacy-first.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JobFinder",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
  other: {
    "application-name": "JobFinder",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const hasSession = cookieStore.get("authjs.session-token")?.value ||
    cookieStore.get("__Secure-authjs.session-token")?.value ||
    cookieStore.get("demo_token")?.value;

  // Only restore preferences for authenticated users
  let dbPrefs: Awaited<ReturnType<typeof restorePreferencesFromDB>> = null;
  if (hasSession) {
    try {
      dbPrefs = await restorePreferencesFromDB();
    } catch {
      // ignore
    }
  }

  const locale = await getLocale();
  const messages = await getMessages();
  const skin = cookieStore.get("jf-skin")?.value || "taras";

  // Use DB theme as defaultTheme so when localStorage is cleared,
  // next-themes falls back to the user's saved preference instead of "dark".
  const defaultTheme = dbPrefs?.theme || "system";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "JobFinder",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Open-source AI-powered job search automation. Upload your resume, scrape 11+ job boards, get AI match scores, auto-generate cover letters, and auto-apply.",
    url: "https://jobfinder.taras.cloud",
    image: "https://jobfinder.taras.cloud/opengraph-image",
    author: {
      "@type": "Organization",
      name: "JobFinder",
      url: "https://github.com/tarascloud/JobFinder",
    },
    license: "https://www.gnu.org/licenses/agpl-3.0.html",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "AI resume analysis",
      "11+ job board scraping",
      "AI match scoring",
      "Auto cover letter generation",
      "Semi-auto and full-auto apply",
      "Q&A knowledge base",
      "Application tracking",
      "Email response tracking",
      "Analytics dashboard",
    ],
  };

  return (
    <html lang={locale} suppressHydrationWarning {...(skin !== "default" ? { "data-skin": skin } : {})}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${inter.variable} ${inter.className} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme={defaultTheme}
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
          <Toaster position="bottom-right" />
        </ThemeProvider>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-0BLTYQVLZT" strategy="afterInteractive" />
        <Script id="ga-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-0BLTYQVLZT');`}</Script>
      </body>
    </html>
  );
}
