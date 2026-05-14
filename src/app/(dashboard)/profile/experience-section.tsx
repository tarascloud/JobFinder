"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { ExperienceEntry } from "@/actions/profile";

interface ExperienceSectionProps {
  experience: ExperienceEntry[];
  setExperience: (v: ExperienceEntry[]) => void;
}

export default function ExperienceSection({
  experience,
  setExperience,
}: ExperienceSectionProps) {
  const t = useTranslations("profile");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("experience_title")}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExperience([...experience, { company: "", title: "", dateFrom: "", dateTo: "", description: "" }])}
          >
            <Plus className="h-3 w-3 mr-1" /> {t("add")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {experience.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("no_experience")}</p>
        )}
        {experience.map((entry, idx) => (
          <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">#{idx + 1}</span>
              <button
                type="button"
                onClick={() => setExperience(experience.filter((_, i) => i !== idx))}
                className="text-destructive hover:text-destructive/80"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder={t("exp_company")}
                value={entry.company}
                onChange={(e) => { const u = [...experience]; u[idx] = { ...u[idx], company: e.target.value }; setExperience(u); }}
              />
              <Input
                placeholder={t("exp_title")}
                value={entry.title}
                onChange={(e) => { const u = [...experience]; u[idx] = { ...u[idx], title: e.target.value }; setExperience(u); }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder={t("date_from")}
                value={entry.dateFrom}
                onChange={(e) => { const u = [...experience]; u[idx] = { ...u[idx], dateFrom: e.target.value }; setExperience(u); }}
              />
              <Input
                placeholder={t("date_to")}
                value={entry.dateTo}
                onChange={(e) => { const u = [...experience]; u[idx] = { ...u[idx], dateTo: e.target.value }; setExperience(u); }}
              />
            </div>
            <textarea
              placeholder={t("exp_description")}
              value={entry.description}
              onChange={(e) => { const u = [...experience]; u[idx] = { ...u[idx], description: e.target.value }; setExperience(u); }}
              rows={2}
              className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
