"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { type Locale, routing } from "@/i18n/routing";

const localeLabels: Record<Locale, string> = {
  en: "EN",
  uk: "UA",
  es: "ES",
};

export function LanguageToggle() {
  const locale = useLocale() as Locale;
  const router = useRouter();

  const cycleLocale = () => {
    const currentIndex = routing.locales.indexOf(locale);
    const nextIndex = (currentIndex + 1) % routing.locales.length;
    const nextLocale = routing.locales[nextIndex];

    document.cookie = `locale=${nextLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
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
