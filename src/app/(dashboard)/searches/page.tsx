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
  Zap,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { SearchProfileDialog } from "./search-profile-dialog";

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

  const updateFormTags = (
    field: "skills" | "excludedCompanies" | "preferredPlatforms" | "excludedKeywords",
    tags: string[]
  ) => {
    setForm((prev) => ({ ...prev, [field]: tags }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {profiles.length > 0 ? `${profiles.length} of ${MAX_PROFILES} profiles` : "Define your job search criteria"}
          </p>
        </div>
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
        <Card className="border-dashed">
          <CardContent className="py-16 px-6 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Sparkles className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1.5">{t("no_searches")}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
              Create a search profile to define your ideal job criteria. AI will generate one from your resume, or you can set it up manually.
            </p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" /> {t("create")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <Card key={profile.id} className={`transition-all hover:shadow-md hover:border-primary/20 ${
              profile.isActive ? "border-l-3 border-l-primary" : "opacity-75"
            }`}>
              <CardContent className="p-5 space-y-3.5">
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

      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>{t("info_block")}</p>
      </div>

      <SearchProfileDialog
        open={dialogOpen}
        editingId={editingId}
        form={form}
        saving={saving}
        generating={generating}
        error={error}
        onClose={() => { setDialogOpen(false); setError(null); }}
        onSave={handleSave}
        onGenerate={handleGenerate}
        onFormChange={updateForm}
        onFormTagChange={updateFormTags}
      />

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
