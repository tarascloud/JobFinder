"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "users", href: "/settings" },
  { key: "platforms", href: "/settings/platforms" },
  { key: "preferences", href: "/settings/preferences" },
  { key: "ai", href: "/settings/ai" },
] as const;

export default function SettingsTabs({ active }: { active: string }) {
  const t = useTranslations("settings");

  return (
    <div className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
      {tabs.map(({ key, href }) => (
        <Link
          key={key}
          href={href}
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all",
            active === key
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t(`tab_${key}`)}
        </Link>
      ))}
    </div>
  );
}
