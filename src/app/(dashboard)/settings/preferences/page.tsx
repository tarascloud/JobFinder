"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings2 } from "lucide-react";
import SettingsTabs from "../settings-tabs";

const SKINS = [
  { value: "default", key: "skin_default" },
  { value: "taras", key: "skin_taras" },
  { value: "neon", key: "skin_neon" },
] as const;

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "uk", label: "Українська" },
  { value: "es", label: "Español" },
];

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/`;
}

export default function PreferencesPage() {
  const t = useTranslations("preferences");
  const tCommon = useTranslations("common");

  const [skin, setSkin] = useState("default");
  const [language, setLanguage] = useState("en");
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [applyHoursStart, setApplyHoursStart] = useState(18);
  const [applyHoursEnd, setApplyHoursEnd] = useState(22);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSkin(getCookie("jf-skin") || "default");
    setLanguage(getCookie("NEXT_LOCALE") || "en");
    setTelegramEnabled(getCookie("jf-telegram") === "1");
    const start = getCookie("jf-apply-start");
    const end = getCookie("jf-apply-end");
    if (start) setApplyHoursStart(Number(start));
    if (end) setApplyHoursEnd(Number(end));
  }, []);

  function handleSave() {
    setCookie("jf-skin", skin);
    setCookie("NEXT_LOCALE", language);
    setCookie("jf-telegram", telegramEnabled ? "1" : "0");
    setCookie("jf-apply-start", String(applyHoursStart));
    setCookie("jf-apply-end", String(applyHoursEnd));

    // Apply skin to <html> in real-time
    const html = document.documentElement;
    if (skin === "default") {
      html.removeAttribute("data-skin");
    } else {
      html.setAttribute("data-skin", skin);
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <SettingsTabs active="preferences" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Skin selector */}
          <div className="space-y-2">
            <Label>{t("skin")}</Label>
            <Select value={skin} onChange={(e) => setSkin(e.target.value)}>
              {SKINS.map((s) => (
                <SelectOption key={s.value} value={s.value}>
                  {t(s.key)}
                </SelectOption>
              ))}
            </Select>
          </div>

          {/* Language selector */}
          <div className="space-y-2">
            <Label>{t("language")}</Label>
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <SelectOption key={l.value} value={l.value}>
                  {l.label}
                </SelectOption>
              ))}
            </Select>
          </div>

          {/* Telegram notifications */}
          <div className="flex items-center justify-between">
            <Label>{t("telegram")}</Label>
            <Switch
              checked={telegramEnabled}
              onCheckedChange={setTelegramEnabled}
            />
          </div>

          {/* Apply schedule */}
          <div className="space-y-2">
            <Label>{t("apply_schedule")}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={23}
                value={applyHoursStart}
                onChange={(e) => setApplyHoursStart(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-muted-foreground">—</span>
              <Input
                type="number"
                min={0}
                max={23}
                value={applyHoursEnd}
                onChange={(e) => setApplyHoursEnd(Number(e.target.value))}
                className="w-20"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave}>{tCommon("save")}</Button>
            {saved && (
              <span className="text-sm text-green-400">{t("saved")}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
