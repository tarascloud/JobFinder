import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import { restorePreferencesFromDB } from "@/actions/preferences";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "JobFinder — Auto Job Search & Apply",
  description: "AI-powered job search automation. Find, score, and apply to jobs automatically.",
  manifest: "/manifest.json",
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Restore preferences from DB if cookies are missing (e.g. cache cleared).
  // Returns DB prefs so we can use them for theme default below.
  const dbPrefs = await restorePreferencesFromDB();

  const locale = await getLocale();
  const messages = await getMessages();
  const cookieStore = await cookies();
  const skin = cookieStore.get("jf-skin")?.value || "taras";

  // Use DB theme as defaultTheme so when localStorage is cleared,
  // next-themes falls back to the user's saved preference instead of "dark".
  const defaultTheme = dbPrefs?.theme || "dark";

  return (
    <html lang={locale} suppressHydrationWarning {...(skin !== "default" ? { "data-skin": skin } : {})}>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
