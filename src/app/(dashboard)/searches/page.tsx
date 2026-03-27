"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  MapPin,
  DollarSign,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Trash2,
  Sparkles,
  Loader2,
  Zap,
  X,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  getSearchProfiles,
  createSearchProfile,
  updateSearchProfile,
  deleteSearchProfile,
  toggleSearchProfile,
  generateSearchFromProfile,
} from "@/actions/search-profiles";
import { Skeleton } from "@/components/ui/skeleton";
import { ALL_PLATFORMS } from "@/lib/platforms";

interface SearchProfile {
  id: number;
  name: string;
  jobTitles: string[];
  minSalary: number | null;
  currency: string | null;
  employmentTypes: string[];
  remoteOnly: boolean;
  geographies: string[];
  excludedCompanies: string[];
  skills: string[];
  preferredPlatforms: string[];
  excludedKeywords: string[];
  applyHoursStart: number;
  applyHoursEnd: number;
  maxDailyApplies: number;
  autoApply: boolean;
  isActive: boolean;
  source: string;
  createdAt: Date | string;
}

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

const emptyForm: FormData = {
  name: "",
  jobTitles: "",
  minSalary: "",
  currency: "EUR",
  employmentTypes: ["full_time"],
  remoteOnly: true,
  geographies: "",
  excludedCompanies: [],
  skills: [],
  preferredPlatforms: [],
  excludedKeywords: [],
  applyHoursStart: "18",
  applyHoursEnd: "22",
  maxDailyApplies: "20",
  autoApply: false,
};

function profileToForm(p: SearchProfile): FormData {
  return {
    name: p.name,
    jobTitles: p.jobTitles.join(", "),
    minSalary: p.minSalary?.toString() ?? "",
    currency: p.currency ?? "EUR",
    employmentTypes: p.employmentTypes,
    remoteOnly: p.remoteOnly,
    geographies: p.geographies.join(", "),
    excludedCompanies: p.excludedCompanies ?? [],
    skills: p.skills ?? [],
    preferredPlatforms: p.preferredPlatforms ?? [],
    excludedKeywords: p.excludedKeywords ?? [],
    applyHoursStart: p.applyHoursStart.toString(),
    applyHoursEnd: p.applyHoursEnd.toString(),
    maxDailyApplies: p.maxDailyApplies.toString(),
    autoApply: p.autoApply,
  };
}

function splitComma(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/40 text-primary px-2.5 py-0.5 text-sm"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-primary/60 hover:text-primary cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag(input);
          }
        }}
        placeholder={placeholder}
      />
      <p className="text-xs text-muted-foreground mt-1">
        Press Enter to add
      </p>
    </div>
  );
}

export default function SearchesPage() {
  const t = useTranslations("searches");
  const tCommon = useTranslations("common");

  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const MAX_PROFILES = 3;
  const hasReachedMax = profiles.length >= MAX_PROFILES;

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const result = await getSearchProfiles();
      if (Array.isArray(result)) {
        setProfiles(result as SearchProfile[]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (p: SearchProfile) => {
    setEditingId(p.id);
    setForm(profileToForm(p));
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        name: form.name,
        jobTitles: splitComma(form.jobTitles),
        minSalary: form.minSalary ? Number(form.minSalary) : null,
        currency: form.currency || "EUR",
        employmentTypes: form.employmentTypes,
        remoteOnly: form.remoteOnly,
        geographies: splitComma(form.geographies),
        excludedCompanies: form.excludedCompanies,
        skills: form.skills,
        preferredPlatforms: form.preferredPlatforms,
        excludedKeywords: form.excludedKeywords,
        applyHoursStart: Number(form.applyHoursStart) || 18,
        applyHoursEnd: Number(form.applyHoursEnd) || 22,
        maxDailyApplies: Number(form.maxDailyApplies) || 20,
        autoApply: form.autoApply,
      };

      if (editingId) {
        const result = await updateSearchProfile(editingId, data);
        if (result && "error" in result) {
          setError(result.error);
          return;
        }
      } else {
        const result = await createSearchProfile(data);
        if (result && "error" in result) {
          setError(result.error);
          return;
        }
      }

      setDialogOpen(false);
      setError(null);
      await loadProfiles();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number) => {
    await toggleSearchProfile(id);
    await loadProfiles();
  };

  const handleDelete = async (id: number) => {
    await deleteSearchProfile(id);
    setDeleteConfirmId(null);
    await loadProfiles();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateSearchFromProfile();
      if ("error" in result) {
        console.error(result.error);
        return;
      }
      setForm({
        name: result.name,
        jobTitles: result.jobTitles.join(", "),
        minSalary: result.minSalary?.toString() ?? "",
        currency: result.currency,
        employmentTypes: result.employmentTypes,
        remoteOnly: result.remoteOnly,
        geographies: result.geographies.join(", "),
        excludedCompanies: [],
        skills: [],
        preferredPlatforms: [],
        excludedKeywords: [],
        applyHoursStart: "18",
        applyHoursEnd: "22",
        maxDailyApplies: "20",
        autoApply: false,
      });
    } finally {
      setGenerating(false);
    }
  };

  const updateForm = (field: keyof FormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="relative group">
          <Button onClick={openCreate} disabled={hasReachedMax}>
            <Plus className="h-4 w-4 mr-1.5" /> {t("create")}
          </Button>
          {hasReachedMax && (
            <div className="absolute right-0 top-full mt-1 z-10 hidden group-hover:block whitespace-nowrap rounded-md bg-popover border border-border px-3 py-1.5 text-sm text-muted-foreground shadow-md">
              {t("max_profiles_reached")}
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-28" />
                </div>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground text-lg">{t("no_searches")}</p>
            <p className="text-muted-foreground text-sm mt-1">{t("create")}</p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" /> {t("create")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <Card key={profile.id} className="hover:border-border transition-colors">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{profile.name}</h3>
                    {profile.source === "ai" && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex items-center gap-0.5 bg-purple-500/15 text-purple-400 border-purple-500/30">
                        <Sparkles className="h-3 w-3" />
                        {tCommon("source_ai")}
                      </Badge>
                    )}
                    {profile.source === "ai_edited" && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex items-center gap-0.5 bg-blue-500/15 text-blue-400 border-blue-500/30">
                        <Sparkles className="h-3 w-3" />
                        {tCommon("source_ai_edited")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
                      onClick={() => openEdit(profile)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="text-muted-foreground hover:text-destructive cursor-pointer p-1"
                      onClick={() => setDeleteConfirmId(profile.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => handleToggle(profile.id)}
                    >
                      {profile.isActive ? (
                        <ToggleRight className="h-6 w-6 text-primary" />
                      ) : (
                        <ToggleLeft className="h-6 w-6" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {profile.jobTitles.slice(0, 4).map((title) => (
                    <Badge key={title} variant="blue">
                      {title}
                    </Badge>
                  ))}
                  {profile.jobTitles.length > 4 && (
                    <Badge variant="secondary">+{profile.jobTitles.length - 4}</Badge>
                  )}
                </div>

                <div className="space-y-1.5 text-sm">
                  {(profile.minSalary !== null) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-4 w-4 shrink-0" />
                      <span>
                        {profile.minSalary.toLocaleString()}+ {profile.currency ?? "EUR"}
                      </span>
                    </div>
                  )}
                  {profile.geographies.length > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span>{profile.geographies.join(", ")}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={profile.isActive ? "green" : "default"}>
                    {profile.isActive ? t("active") : t("inactive")}
                  </Badge>
                  {profile.autoApply && (
                    <Badge variant="blue" className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {t("auto_apply.label")}
                    </Badge>
                  )}
                  {profile.remoteOnly && <Badge variant="blue">{t("remote_only")}</Badge>}
                  {profile.employmentTypes.map((et) => (
                    <Badge key={et} variant="secondary">
                      {EMPLOYMENT_TYPE_OPTIONS.includes(et as EmploymentTypeKey)
                        ? t(`employment_type_options.${et}`)
                        : et}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info block */}
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>{t("info_block")}</p>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? tCommon("edit") : t("create")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Generate button */}
            {!editingId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generating}
                className="w-full"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generating ? t("generating") : t("generate_from_profile")}
              </Button>
            )}

            <div>
              <Label>{t("name")}</Label>
              <Input
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="Senior Frontend Remote"
              />
            </div>

            <div>
              <Label>{t("job_titles")}</Label>
              <Input
                value={form.jobTitles}
                onChange={(e) => updateForm("jobTitles", e.target.value)}
                placeholder="Senior Frontend Engineer, Staff Engineer"
              />
              <p className="text-xs text-muted-foreground mt-1">Comma-separated</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("min_salary")}</Label>
                <Input
                  type="number"
                  value={form.minSalary}
                  onChange={(e) => updateForm("minSalary", e.target.value)}
                  placeholder="100000"
                />
              </div>
              <div>
                <Label>{t("currency")}</Label>
                <Input
                  value={form.currency}
                  onChange={(e) => updateForm("currency", e.target.value)}
                  placeholder="EUR"
                />
              </div>
            </div>

            <div>
              <Label>{t("geography")}</Label>
              <Input
                value={form.geographies}
                onChange={(e) => updateForm("geographies", e.target.value)}
                placeholder="Remote (EU), Spain, Germany"
              />
            </div>

            <div>
              <Label>{t("skills")}</Label>
              <TagInput
                value={form.skills}
                onChange={(tags) => setForm((prev) => ({ ...prev, skills: tags }))}
                placeholder="React, TypeScript, Node.js"
              />
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
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          employmentTypes: isSelected
                            ? prev.employmentTypes.filter((t) => t !== type)
                            : [...prev.employmentTypes, type],
                        }));
                      }}
                      className={`
                        inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium
                        border cursor-pointer transition-colors
                        ${
                          isSelected
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "bg-muted border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        }
                      `}
                    >
                      {t(`employment_type_options.${type}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>{t("remote_only")}</Label>
              <Switch
                checked={form.remoteOnly}
                onCheckedChange={(checked) => updateForm("remoteOnly", checked)}
              />
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
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          preferredPlatforms: isSelected
                            ? prev.preferredPlatforms.filter((p) => p !== platform)
                            : [...prev.preferredPlatforms, platform],
                        }));
                      }}
                      className={`
                        inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium
                        border cursor-pointer transition-colors
                        ${
                          isSelected
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "bg-muted border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        }
                      `}
                    >
                      {platform}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Zap className="h-4 w-4" />
                  {t("auto_apply.label")}
                </Label>
                <Switch
                  checked={form.autoApply}
                  onCheckedChange={(checked) => updateForm("autoApply", checked)}
                />
              </div>
              {form.autoApply && (
                <p className="text-xs text-amber-400/80 bg-amber-400/10 rounded-md px-3 py-2">
                  {t("auto_apply.warning")}
                </p>
              )}
            </div>

            <div>
              <Label>{t("excluded_companies")}</Label>
              <TagInput
                value={form.excludedCompanies}
                onChange={(tags) => setForm((prev) => ({ ...prev, excludedCompanies: tags }))}
                placeholder="Acme Corp, Evil Inc"
              />
            </div>

            <div>
              <Label>{t("excluded_keywords")}</Label>
              <TagInput
                value={form.excludedKeywords}
                onChange={(tags) => setForm((prev) => ({ ...prev, excludedKeywords: tags }))}
                placeholder="senior, manager, lead"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>{t("apply_hours")} (start)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={form.applyHoursStart}
                  onChange={(e) => updateForm("applyHoursStart", e.target.value)}
                />
              </div>
              <div>
                <Label>{t("apply_hours")} (end)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={form.applyHoursEnd}
                  onChange={(e) => updateForm("applyHoursEnd", e.target.value)}
                />
              </div>
              <div>
                <Label>{t("max_daily")}</Label>
                <Input
                  type="number"
                  value={form.maxDailyApplies}
                  onChange={(e) => updateForm("maxDailyApplies", e.target.value)}
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDialogOpen(false); setError(null); }}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tCommon("delete")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-2">{t("delete_confirm")}</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
