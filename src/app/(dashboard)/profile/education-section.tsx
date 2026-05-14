"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { EducationEntry } from "@/actions/profile";

interface EducationSectionProps {
  education: string;
  setEducation: (v: string) => void;
  educationField: string;
  setEducationField: (v: string) => void;
  educationSchool: string;
  setEducationSchool: (v: string) => void;
  educationHistory: EducationEntry[];
  setEducationHistory: (v: EducationEntry[]) => void;
}

export default function EducationSection({
  education,
  setEducation,
  educationField,
  setEducationField,
  educationSchool,
  setEducationSchool,
  educationHistory,
  setEducationHistory,
}: EducationSectionProps) {
  const t = useTranslations("profile");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("education_title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm text-muted-foreground mb-1.5">{t("education_degree")}</label>
          <select
            value={education}
            onChange={(e) => setEducation(e.target.value)}
            className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">{t("select_option")}</option>
            <option value="High School">High School</option>
            <option value="Associate">Associate</option>
            <option value="Bachelor's">Bachelor&apos;s</option>
            <option value="Master's">Master&apos;s</option>
            <option value="PhD">PhD</option>
            <option value="MBA">MBA</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1.5">{t("education_field")}</label>
          <Input value={educationField} onChange={(e) => setEducationField(e.target.value)} placeholder="Computer Science, Engineering, etc." />
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1.5">{t("education_school")}</label>
          <Input value={educationSchool} onChange={(e) => setEducationSchool(e.target.value)} />
        </div>

        {/* Education History (multiple entries) */}
        <div className="border-t border-border pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-foreground">{t("education_history")}</label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEducationHistory([...educationHistory, { degree: "", field: "", school: "", dateFrom: "", dateTo: "" }])}
            >
              <Plus className="h-3 w-3 mr-1" /> {t("add")}
            </Button>
          </div>
          {educationHistory.map((entry, idx) => (
            <div key={idx} className="rounded-lg border border-border p-3 mb-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => setEducationHistory(educationHistory.filter((_, i) => i !== idx))}
                  className="text-destructive hover:text-destructive/80"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder={t("education_degree")}
                  value={entry.degree}
                  onChange={(e) => { const u = [...educationHistory]; u[idx] = { ...u[idx], degree: e.target.value }; setEducationHistory(u); }}
                />
                <Input
                  placeholder={t("education_field")}
                  value={entry.field}
                  onChange={(e) => { const u = [...educationHistory]; u[idx] = { ...u[idx], field: e.target.value }; setEducationHistory(u); }}
                />
              </div>
              <Input
                placeholder={t("education_school")}
                value={entry.school}
                onChange={(e) => { const u = [...educationHistory]; u[idx] = { ...u[idx], school: e.target.value }; setEducationHistory(u); }}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder={t("date_from")}
                  value={entry.dateFrom}
                  onChange={(e) => { const u = [...educationHistory]; u[idx] = { ...u[idx], dateFrom: e.target.value }; setEducationHistory(u); }}
                />
                <Input
                  placeholder={t("date_to")}
                  value={entry.dateTo}
                  onChange={(e) => { const u = [...educationHistory]; u[idx] = { ...u[idx], dateTo: e.target.value }; setEducationHistory(u); }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
