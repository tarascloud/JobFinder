"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles, Zap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ALL_PLATFORMS } from "@/lib/platforms";

const EMPLOYMENT_TYPE_OPTIONS = [
  "full_time",
  "part_time",
  "contract",
  "freelance",
  "internship",
  "temporary",
] as const;

type EmploymentTypeKey = (typeof EMPLOYMENT_TYPE_OPTIONS)[number];

interface FormData {
  name: string;
  jobTitles: string;
  minSalary: string;
  currency: string;
  employmentTypes: string[];
  remoteOnly: boolean;
  geographies: string;
  excludedCompanies: string[];
  skills: string[];
  preferredPlatforms: string[];
  excludedKeywords: string[];
  applyHoursStart: string;
  applyHoursEnd: string;
  maxDailyApplies: string;
  autoApply: boolean;
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (tags: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed]);
    setInput("");
  };
  const removeTag = (tag: string) => onChange(value.filter((t) => t !== tag));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/40 text-primary px-2.5 py-0.5 text-sm">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="text-primary/60 hover:text-primary cursor-pointer">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(input); } }} placeholder={placeholder} />
      <p className="text-xs text-muted-foreground mt-1">Press Enter to add</p>
    </div>
  );
}

interface SearchProfileDialogProps {
  open: boolean;
  editingId: number | null;
  form: FormData;
  saving: boolean;
  generating: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
  onGenerate: () => void;
  onFormChange: (field: keyof FormData, value: string | boolean) => void;
  onFormTagChange: (field: "skills" | "excludedCompanies" | "preferredPlatforms" | "excludedKeywords", tags: string[]) => void;
}

export function SearchProfileDialog({
  open,
  editingId,
  form,
  saving,
  generating,
  error,
  onClose,
  onSave,
  onGenerate,
  onFormChange,
  onFormTagChange,
}: SearchProfileDialogProps) {
  const t = useTranslations("searches");
  const tCommon = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? tCommon("edit") : t("create")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {!editingId && (
            <Button variant="outline" size="sm" onClick={onGenerate} disabled={generating} className="w-full">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? t("generating") : t("generate_from_profile")}
            </Button>
          )}

          <div>
            <Label>{t("name")}</Label>
            <Input value={form.name} onChange={(e) => onFormChange("name", e.target.value)} placeholder="Senior Frontend Remote" />
          </div>

          <div>
            <Label>{t("job_titles")}</Label>
            <Input value={form.jobTitles} onChange={(e) => onFormChange("jobTitles", e.target.value)} placeholder="Senior Frontend Engineer, Staff Engineer" />
            <p className="text-xs text-muted-foreground mt-1">Comma-separated</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("min_salary")}</Label>
              <Input type="number" value={form.minSalary} onChange={(e) => onFormChange("minSalary", e.target.value)} placeholder="100000" />
            </div>
            <div>
              <Label>{t("currency")}</Label>
              <Input value={form.currency} onChange={(e) => onFormChange("currency", e.target.value)} placeholder="EUR" />
            </div>
          </div>

          <div>
            <Label>{t("geography")}</Label>
            <Input value={form.geographies} onChange={(e) => onFormChange("geographies", e.target.value)} placeholder="Remote (EU), Spain, Germany" />
          </div>

          <div>
            <Label>{t("skills")}</Label>
            <TagInput value={form.skills} onChange={(tags) => onFormTagChange("skills", tags)} placeholder="React, TypeScript, Node.js" />
          </div>

          <div>
            <Label>{t("employment_types")}</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {EMPLOYMENT_TYPE_OPTIONS.map((type) => {
                const isSelected = form.employmentTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onFormChange("employmentTypes" as keyof FormData, isSelected ? form.employmentTypes.filter((et) => et !== type).join(",") : [...form.employmentTypes, type].join(","))}
                    className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium border cursor-pointer transition-colors ${isSelected ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
                  >
                    {t(`employment_type_options.${type}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>{t("remote_only")}</Label>
            <Switch checked={form.remoteOnly} onCheckedChange={(checked) => onFormChange("remoteOnly", checked)} />
          </div>

          <div>
            <Label>{t("preferred_platforms")}</Label>
            <p className="text-xs text-muted-foreground mb-1.5">{t("preferred_platforms_hint")}</p>
            <div className="flex flex-wrap gap-2">
              {ALL_PLATFORMS.map((platform) => {
                const isSelected = form.preferredPlatforms.includes(platform);
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => onFormTagChange("preferredPlatforms", isSelected ? form.preferredPlatforms.filter((p) => p !== platform) : [...form.preferredPlatforms, platform])}
                    className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium border cursor-pointer transition-colors ${isSelected ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
                  >
                    {platform}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5"><Zap className="h-4 w-4" />{t("auto_apply.label")}</Label>
              <Switch checked={form.autoApply} onCheckedChange={(checked) => onFormChange("autoApply", checked)} />
            </div>
            {form.autoApply && <p className="text-xs text-amber-400/80 bg-amber-400/10 rounded-md px-3 py-2">{t("auto_apply.warning")}</p>}
          </div>

          <div>
            <Label>{t("excluded_companies")}</Label>
            <TagInput value={form.excludedCompanies} onChange={(tags) => onFormTagChange("excludedCompanies", tags)} placeholder="Acme Corp, Evil Inc" />
          </div>

          <div>
            <Label>{t("excluded_keywords")}</Label>
            <TagInput value={form.excludedKeywords} onChange={(tags) => onFormTagChange("excludedKeywords", tags)} placeholder="senior, manager, lead" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{t("apply_hours")} (start)</Label>
              <Input type="number" min={0} max={23} value={form.applyHoursStart} onChange={(e) => onFormChange("applyHoursStart", e.target.value)} />
            </div>
            <div>
              <Label>{t("apply_hours")} (end)</Label>
              <Input type="number" min={0} max={23} value={form.applyHoursEnd} onChange={(e) => onFormChange("applyHoursEnd", e.target.value)} />
            </div>
            <div>
              <Label>{t("max_daily")}</Label>
              <Input type="number" value={form.maxDailyApplies} onChange={(e) => onFormChange("maxDailyApplies", e.target.value)} />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{tCommon("cancel")}</Button>
          <Button onClick={onSave} disabled={saving || !form.name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
