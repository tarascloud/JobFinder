"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { type Locale, routing } from "@/i18n/routing";
import { updatePreference } from "@/actions/preferences";

const localeLabels: Record<Locale, string> = {
  en: "EN",
  uk: "UA",
  es: "ES",
};

export function LanguageToggle() {
  const locale = useLocale() as Locale;
  const router = useRouter();

  const cycleLocale = async () => {
    const currentIndex = routing.locales.indexOf(locale);
    const nextIndex = (currentIndex + 1) % routing.locales.length;
    const nextLocale = routing.locales[nextIndex];

    // Set cookie immediately for instant SSR update
    document.cookie = `locale=${nextLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;

    // Persist to DB (fire and forget — cookie already set)
    updatePreference("locale", nextLocale);

    router.refresh();
  };

  return (
    <button
      onClick={cycleLocale}
      className="flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      title={`Language: ${localeLabels[locale]}`}
    >
      {localeLabels[locale]}
    </button>
  );
}
