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

  const switchLocale = async (nextLocale: Locale) => {
    if (nextLocale === locale) return;

    // Set cookie + localStorage for instant SSR update
    document.cookie = `locale=${nextLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    localStorage.setItem("locale", nextLocale);

    // Persist to DB (fire and forget — cookie already set)
    updatePreference("locale", nextLocale);

    router.refresh();
  };

  return (
    <div className="inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          onClick={() => switchLocale(loc)}
          className={`min-h-[36px] px-2 py-0.5 text-xs font-medium rounded transition-colors ${
            loc === locale
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {localeLabels[loc]}
        </button>
      ))}
    </div>
  );
}
