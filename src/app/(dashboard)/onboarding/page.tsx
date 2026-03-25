"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Upload,
  Plus,
  X,
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Rocket,
  FileText,
  Briefcase,
  MessageSquare,
  User,
  Pencil,
  Trash2,
  Link,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  analyzeResume,
  type AnalyzedProfile,
  type AnalyzedSearchProfile,
  type AnalyzedQaPair,
} from "@/actions/profile";
import { completeOnboarding } from "@/actions/onboarding";

type ReviewTab = "profile" | "searches" | "qa";

export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const tProfile = useTranslations("profile");
  const tSearches = useTranslations("searches");
  const tCommon = useTranslations("common");

  const [step, setStep] = useState(1);

  const STEPS = [
    { number: 1, label: t("step_resume") },
    { number: 2, label: t("step_review") },
    { number: 3, label: t("step_ready") },
  ];

  // Step 1 state
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeUrlInput, setResumeUrlInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 state — AI-generated data
  const [activeTab, setActiveTab] = useState<ReviewTab>("profile");
  const [profile, setProfile] = useState<AnalyzedProfile>({
    headline: "",
    summary: "",
    yearsExperience: null,
    skills: [],
    languages: [],
    portfolioUrls: [],
    salaryMin: null,
    salaryCurrency: "EUR",
    preferredLocations: [],
    preferredRemoteType: "remote",
    employmentTypes: ["full-time"],
  });
  const [searchProfiles, setSearchProfiles] = useState<AnalyzedSearchProfile[]>([]);
  const [qaPairs, setQaPairs] = useState<AnalyzedQaPair[]>([]);

  // Inline edit helpers
  const [newSkill, setNewSkill] = useState("");
  const [newLanguage, setNewLanguage] = useState("");
  const [newPortfolioUrl, setNewPortfolioUrl] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [editingQa, setEditingQa] = useState<number | null>(null);

  // Search profile edit state
  const [editingSearch, setEditingSearch] = useState<number | null>(null);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newGeo, setNewGeo] = useState("");

  const [saving, setSaving] = useState(false);

  // --- File upload ---
  async function handleFileUpload(file: File) {
    if (file.type !== "application/pdf") {
      setAnalyzeError(tProfile("pdf_only"));
      return;
    }
    setIsUploading(true);
    setAnalyzeError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload-resume", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setAnalyzeError(data.error || "Upload failed");
        setIsUploading(false);
        return;
      }
      setUploadedFile(file.name);
      setResumeUrl(data.url);
      setIsUploading(false);
      await runAnalysis(data.url);
    } catch {
      setAnalyzeError("Upload failed");
      setIsUploading(false);
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }

  // --- Analyze resume (comprehensive) ---
  async function runAnalysis(url: string) {
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      const result = await analyzeResume(url);
      if ("error" in result) {
        setAnalyzeError(result.error);
      } else {
        setProfile(result.profile);
        setSearchProfiles(result.searchProfiles);
        setQaPairs(result.qaPairs);
        setStep(2);
      }
    } catch {
      setAnalyzeError(tCommon("error"));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleUrlAnalyze() {
    if (!resumeUrlInput.trim()) return;
    setResumeUrl(resumeUrlInput.trim());
    await runAnalysis(resumeUrlInput.trim());
  }

  // --- Complete onboarding ---
  async function handleComplete() {
    setSaving(true);
    setAnalyzeError("");
    try {
      const result = await completeOnboarding(
        { ...profile, resumeUrl },
        searchProfiles,
        qaPairs
      );

      if ("error" in result) {
        setAnalyzeError(result.error ?? tCommon("error"));
      } else {
        router.push("/");
      }
    } catch {
      setAnalyzeError(tCommon("error"));
    } finally {
      setSaving(false);
    }
  }

  // --- Tag helpers ---
  function addTag(
    value: string,
    list: string[],
    setList: (v: string[]) => void,
    setCurrent: (v: string) => void
  ) {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
    }
    setCurrent("");
  }

  function removeTag(tag: string, list: string[], setList: (v: string[]) => void) {
    setList(list.filter((t) => t !== tag));
  }

  function toggleEmploymentType(type: string) {
    setProfile((prev) => ({
      ...prev,
      employmentTypes: prev.employmentTypes.includes(type)
        ? prev.employmentTypes.filter((t) => t !== type)
        : [...prev.employmentTypes, type],
    }));
  }

  // --- Search profile helpers ---
  function updateSearchProfile(index: number, updates: Partial<AnalyzedSearchProfile>) {
    setSearchProfiles((prev) =>
      prev.map((sp, i) => (i === index ? { ...sp, ...updates } : sp))
    );
  }

  function removeSearchProfile(index: number) {
    setSearchProfiles((prev) => prev.filter((_, i) => i !== index));
  }

  function addSearchProfile() {
    setSearchProfiles((prev) => [
      ...prev,
      {
        name: `Search ${prev.length + 1}`,
        jobTitles: profile.headline ? [profile.headline] : [],
        minSalary: profile.salaryMin,
        currency: profile.salaryCurrency,
        geographies: [],
        remoteOnly: true,
        employmentTypes: ["full-time"],
      },
    ]);
    setEditingSearch(searchProfiles.length);
  }

  // --- Q&A helpers ---
  function updateQaPair(index: number, field: "question" | "answer", value: string) {
    setQaPairs((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  function removeQaPair(index: number) {
    setQaPairs((prev) => prev.filter((_, i) => i !== index));
    if (editingQa === index) setEditingQa(null);
  }

  function addQaPair() {
    setQaPairs((prev) => [...prev, { question: "", answer: "" }]);
    setEditingQa(qaPairs.length);
  }

  // --- Tab content ---
  const tabItems: { key: ReviewTab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "profile", label: t("tab_profile"), icon: <User className="h-4 w-4" />, count: 0 },
    {
      key: "searches",
      label: t("tab_searches"),
      icon: <Briefcase className="h-4 w-4" />,
      count: searchProfiles.length,
    },
    {
      key: "qa",
      label: t("tab_qa"),
      icon: <MessageSquare className="h-4 w-4" />,
      count: qaPairs.length,
    },
  ];

  return (
    <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-start py-8 px-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.number} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                step > s.number
                  ? "bg-green-600 text-white"
                  : step === s.number
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s.number ? <Check className="h-4 w-4" /> : s.number}
            </div>
            <span
              className={`ml-1.5 text-sm hidden sm:inline ${
                step >= s.number ? "text-foreground" : "text-muted-foreground/60"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`w-8 sm:w-12 h-px mx-2 ${
                  step > s.number ? "bg-green-600" : "bg-secondary"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="w-full max-w-3xl">
        {/* ===== STEP 1: Upload Resume ===== */}
        {step === 1 && (
          <Card>
            <CardContent className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">{t("upload_title")}</h2>
                <p className="text-muted-foreground">
                  {t("upload_description")}
                </p>
              </div>

              {/* Drag and drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                  transition-all duration-200
                  ${
                    isDragging
                      ? "border-primary bg-primary/10"
                      : analyzing
                        ? "border-amber-500/50 bg-amber-500/5"
                        : uploadedFile && !analyzeError
                          ? "border-green-500/50 bg-green-500/5"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    <p className="text-sm text-foreground/80">{tProfile("uploading")}</p>
                  </div>
                ) : analyzing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 text-amber-400 animate-spin" />
                    <p className="text-sm text-amber-300 font-medium">{t("analyzing_title")}</p>
                    <p className="text-xs text-muted-foreground">{t("analyzing_description")}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-foreground/80">{tProfile("drop_zone_text")}</p>
                      <p className="text-xs text-muted-foreground mt-1">{tProfile("pdf_only")}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* URL input */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex-1 border-t border-input" />
                <span>{tProfile("or_paste_url")}</span>
                <div className="flex-1 border-t border-input" />
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={resumeUrlInput}
                    onChange={(e) => setResumeUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUrlAnalyze()}
                    placeholder={tProfile("resume_url_placeholder")}
                    className="pl-9"
                    disabled={analyzing}
                  />
                </div>
                <Button
                  onClick={handleUrlAnalyze}
                  disabled={!resumeUrlInput.trim() || analyzing}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {tCommon("loading")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      {t("analyze_button")}
                    </>
                  )}
                </Button>
              </div>

              {analyzeError && (
                <p className="text-sm text-red-400">{analyzeError}</p>
              )}

              <Button
                variant="ghost"
                onClick={() => setStep(2)}
                className="w-full text-muted-foreground"
              >
                {t("skip_manual")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ===== STEP 2: Review AI-Generated Data ===== */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold">{t("review_title")}</h2>
              <p className="text-muted-foreground">
                {t("review_description")}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {tabItems.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === tab.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ---- Profile Tab ---- */}
            {activeTab === "profile" && (
              <Card>
                <CardContent className="p-6 space-y-5">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1.5">
                      {tProfile("headline")}
                    </label>
                    <Input
                      value={profile.headline}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, headline: e.target.value }))
                      }
                      placeholder="e.g. Senior Frontend Engineer"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-muted-foreground mb-1.5">
                      {tProfile("summary")}
                    </label>
                    <textarea
                      value={profile.summary}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, summary: e.target.value }))
                      }
                      rows={3}
                      className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1.5">
                        {tProfile("years_experience")}
                      </label>
                      <Input
                        type="number"
                        value={profile.yearsExperience ?? ""}
                        onChange={(e) =>
                          setProfile((p) => ({
                            ...p,
                            yearsExperience: e.target.value ? parseInt(e.target.value) : null,
                          }))
                        }
                        placeholder="5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1.5">
                        {tProfile("salary_min")}
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={profile.salaryMin ?? ""}
                          onChange={(e) =>
                            setProfile((p) => ({
                              ...p,
                              salaryMin: e.target.value ? parseInt(e.target.value) : null,
                            }))
                          }
                          placeholder="80000"
                          className="flex-1"
                        />
                        <select
                          value={profile.salaryCurrency}
                          onChange={(e) =>
                            setProfile((p) => ({ ...p, salaryCurrency: e.target.value }))
                          }
                          className="rounded-lg border border-input bg-muted px-2 text-sm text-foreground focus:border-ring focus:outline-none"
                        >
                          <option value="EUR">EUR</option>
                          <option value="USD">USD</option>
                          <option value="GBP">GBP</option>
                          <option value="UAH">UAH</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Skills */}
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1.5">
                      {tProfile("skills")}
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {profile.skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-sm text-primary/80"
                        >
                          {skill}
                          <button
                            onClick={() =>
                              setProfile((p) => ({
                                ...p,
                                skills: p.skills.filter((s) => s !== skill),
                              }))
                            }
                            className="ml-0.5 text-primary hover:text-primary/80 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          addTag(
                            newSkill,
                            profile.skills,
                            (v) => setProfile((p) => ({ ...p, skills: v })),
                            setNewSkill
                          )
                        }
                        placeholder={tProfile("skills") + "..."}
                        className="max-w-64"
                      />
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() =>
                          addTag(
                            newSkill,
                            profile.skills,
                            (v) => setProfile((p) => ({ ...p, skills: v })),
                            setNewSkill
                          )
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Languages */}
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1.5">
                      {tProfile("languages")}
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {profile.languages.map((lang) => (
                        <span
                          key={lang}
                          className="inline-flex items-center gap-1 rounded-full bg-purple-900/40 border border-purple-700/40 px-3 py-1 text-sm text-purple-300"
                        >
                          {lang}
                          <button
                            onClick={() =>
                              setProfile((p) => ({
                                ...p,
                                languages: p.languages.filter((l) => l !== lang),
                              }))
                            }
                            className="ml-0.5 text-purple-400 hover:text-primary/80 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newLanguage}
                        onChange={(e) => setNewLanguage(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          addTag(
                            newLanguage,
                            profile.languages,
                            (v) => setProfile((p) => ({ ...p, languages: v })),
                            setNewLanguage
                          )
                        }
                        placeholder="e.g. English (Professional)"
                        className="max-w-64"
                      />
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() =>
                          addTag(
                            newLanguage,
                            profile.languages,
                            (v) => setProfile((p) => ({ ...p, languages: v })),
                            setNewLanguage
                          )
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Preferred Locations */}
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1.5">
                      {t("preferred_locations")}
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {profile.preferredLocations.map((loc) => (
                        <span
                          key={loc}
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-900/40 border border-indigo-700/40 px-3 py-1 text-sm text-indigo-300"
                        >
                          {loc}
                          <button
                            onClick={() =>
                              setProfile((p) => ({
                                ...p,
                                preferredLocations: p.preferredLocations.filter((l) => l !== loc),
                              }))
                            }
                            className="ml-0.5 text-indigo-400 hover:text-primary/80 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newLocation}
                        onChange={(e) => setNewLocation(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          addTag(
                            newLocation,
                            profile.preferredLocations,
                            (v) => setProfile((p) => ({ ...p, preferredLocations: v })),
                            setNewLocation
                          )
                        }
                        placeholder="e.g. Remote, EU, Spain"
                        className="max-w-64"
                      />
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() =>
                          addTag(
                            newLocation,
                            profile.preferredLocations,
                            (v) => setProfile((p) => ({ ...p, preferredLocations: v })),
                            setNewLocation
                          )
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Remote type + Employment types */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1.5">
                        {tSearches("remote_only")}
                      </label>
                      <select
                        value={profile.preferredRemoteType}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, preferredRemoteType: e.target.value }))
                        }
                        className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
                      >
                        <option value="remote">Remote</option>
                        <option value="hybrid">Hybrid</option>
                        <option value="onsite">On-site</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1.5">
                        {tSearches("employment_types")}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {["full-time", "contract", "part-time", "freelance"].map((type) => (
                          <button
                            key={type}
                            onClick={() => toggleEmploymentType(type)}
                            className={`rounded-full border px-3 py-1 text-sm transition-colors cursor-pointer ${
                              profile.employmentTypes.includes(type)
                                ? "border-primary bg-primary/20 text-primary/80"
                                : "border-input bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Portfolio URLs */}
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1.5">
                      {tProfile("portfolio")}
                    </label>
                    <div className="space-y-1.5 mb-2">
                      {profile.portfolioUrls.map((url) => (
                        <div key={url} className="flex items-center gap-2 text-sm">
                          <span className="text-foreground/80 truncate flex-1">{url}</span>
                          <button
                            onClick={() =>
                              setProfile((p) => ({
                                ...p,
                                portfolioUrls: p.portfolioUrls.filter((u) => u !== url),
                              }))
                            }
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        value={newPortfolioUrl}
                        onChange={(e) => setNewPortfolioUrl(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          addTag(
                            newPortfolioUrl,
                            profile.portfolioUrls,
                            (v) => setProfile((p) => ({ ...p, portfolioUrls: v })),
                            setNewPortfolioUrl
                          )
                        }
                        placeholder="https://github.com/username"
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() =>
                          addTag(
                            newPortfolioUrl,
                            profile.portfolioUrls,
                            (v) => setProfile((p) => ({ ...p, portfolioUrls: v })),
                            setNewPortfolioUrl
                          )
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ---- Searches Tab ---- */}
            {activeTab === "searches" && (
              <div className="space-y-4">
                {searchProfiles.map((sp, idx) => (
                  <Card key={idx}>
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          {editingSearch === idx ? (
                            <Input
                              value={sp.name}
                              onChange={(e) =>
                                updateSearchProfile(idx, { name: e.target.value })
                              }
                              className="max-w-64"
                            />
                          ) : (
                            <h3 className="font-medium">{sp.name}</h3>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setEditingSearch(editingSearch === idx ? null : idx)
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {searchProfiles.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSearchProfile(idx)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {editingSearch === idx ? (
                        <div className="space-y-4">
                          {/* Job titles */}
                          <div>
                            <label className="block text-sm text-muted-foreground mb-1.5">
                              {tSearches("job_titles")}
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {sp.jobTitles.map((title) => (
                                <span
                                  key={title}
                                  className="inline-flex items-center gap-1 rounded-full bg-green-900/40 border border-green-700/40 px-3 py-1 text-sm text-green-300"
                                >
                                  {title}
                                  <button
                                    onClick={() =>
                                      updateSearchProfile(idx, {
                                        jobTitles: sp.jobTitles.filter((t) => t !== title),
                                      })
                                    }
                                    className="ml-0.5 text-green-400 hover:text-primary/80 cursor-pointer"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Input
                                value={newJobTitle}
                                onChange={(e) => setNewJobTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && newJobTitle.trim()) {
                                    updateSearchProfile(idx, {
                                      jobTitles: [...sp.jobTitles, newJobTitle.trim()],
                                    });
                                    setNewJobTitle("");
                                  }
                                }}
                                placeholder="e.g. Senior Engineer"
                                className="flex-1"
                              />
                              <Button
                                variant="outline"
                                size="md"
                                onClick={() => {
                                  if (newJobTitle.trim()) {
                                    updateSearchProfile(idx, {
                                      jobTitles: [...sp.jobTitles, newJobTitle.trim()],
                                    });
                                    setNewJobTitle("");
                                  }
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Salary + Remote */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1.5">
                                {tSearches("min_salary")}
                              </label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  value={sp.minSalary ?? ""}
                                  onChange={(e) =>
                                    updateSearchProfile(idx, {
                                      minSalary: e.target.value ? parseInt(e.target.value) : null,
                                    })
                                  }
                                  placeholder="80000"
                                  className="flex-1"
                                />
                                <select
                                  value={sp.currency}
                                  onChange={(e) =>
                                    updateSearchProfile(idx, { currency: e.target.value })
                                  }
                                  className="rounded-lg border border-input bg-muted px-2 text-sm text-foreground focus:border-ring focus:outline-none"
                                >
                                  <option value="EUR">EUR</option>
                                  <option value="USD">USD</option>
                                  <option value="GBP">GBP</option>
                                  <option value="UAH">UAH</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1.5">
                                {tSearches("remote_only")}
                              </label>
                              <button
                                onClick={() =>
                                  updateSearchProfile(idx, { remoteOnly: !sp.remoteOnly })
                                }
                                className={`w-full rounded-lg border px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                                  sp.remoteOnly
                                    ? "border-primary bg-primary/20 text-primary/80"
                                    : "border-input bg-muted text-muted-foreground"
                                }`}
                              >
                                {sp.remoteOnly ? tSearches("remote_only") : "Include on-site/hybrid"}
                              </button>
                            </div>
                          </div>

                          {/* Geographies */}
                          <div>
                            <label className="block text-sm text-muted-foreground mb-1.5">
                              {tSearches("geography")}
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {sp.geographies.map((geo) => (
                                <span
                                  key={geo}
                                  className="inline-flex items-center gap-1 rounded-full bg-indigo-900/40 border border-indigo-700/40 px-3 py-1 text-sm text-indigo-300"
                                >
                                  {geo}
                                  <button
                                    onClick={() =>
                                      updateSearchProfile(idx, {
                                        geographies: sp.geographies.filter((g) => g !== geo),
                                      })
                                    }
                                    className="ml-0.5 text-indigo-400 hover:text-primary/80 cursor-pointer"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Input
                                value={newGeo}
                                onChange={(e) => setNewGeo(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && newGeo.trim()) {
                                    updateSearchProfile(idx, {
                                      geographies: [...sp.geographies, newGeo.trim()],
                                    });
                                    setNewGeo("");
                                  }
                                }}
                                placeholder="e.g. EU, Remote worldwide"
                                className="flex-1"
                              />
                              <Button
                                variant="outline"
                                size="md"
                                onClick={() => {
                                  if (newGeo.trim()) {
                                    updateSearchProfile(idx, {
                                      geographies: [...sp.geographies, newGeo.trim()],
                                    });
                                    setNewGeo("");
                                  }
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Employment types */}
                          <div>
                            <label className="block text-sm text-muted-foreground mb-1.5">
                              {tSearches("employment_types")}
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {["full-time", "contract", "part-time", "freelance"].map((type) => (
                                <button
                                  key={type}
                                  onClick={() => {
                                    const types = sp.employmentTypes.includes(type)
                                      ? sp.employmentTypes.filter((t) => t !== type)
                                      : [...sp.employmentTypes, type];
                                    updateSearchProfile(idx, { employmentTypes: types });
                                  }}
                                  className={`rounded-full border px-3 py-1 text-sm transition-colors cursor-pointer ${
                                    sp.employmentTypes.includes(type)
                                      ? "border-primary bg-primary/20 text-primary/80"
                                      : "border-input bg-muted text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Collapsed view */
                        <div className="space-y-2 text-sm">
                          {sp.jobTitles.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {sp.jobTitles.map((jt) => (
                                <Badge key={jt} color="green">
                                  {jt}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                            {sp.minSalary && (
                              <span>
                                {sp.minSalary.toLocaleString()} {sp.currency}
                              </span>
                            )}
                            <span>{sp.remoteOnly ? "Remote" : "Any location"}</span>
                            {sp.geographies.length > 0 && (
                              <span>{sp.geographies.join(", ")}</span>
                            )}
                            {sp.employmentTypes.length > 0 && (
                              <span>{sp.employmentTypes.join(", ")}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" onClick={addSearchProfile} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("add_search")}
                </Button>
              </div>
            )}

            {/* ---- Q&A Tab ---- */}
            {activeTab === "qa" && (
              <div className="space-y-3">
                {qaPairs.length === 0 && (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      {t("no_qa_generated")}
                    </CardContent>
                  </Card>
                )}
                {qaPairs.map((pair, idx) => (
                  <Card key={idx}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        {editingQa === idx ? (
                          <div className="flex-1 space-y-2">
                            <Input
                              value={pair.question}
                              onChange={(e) => updateQaPair(idx, "question", e.target.value)}
                              placeholder="Question..."
                            />
                            <textarea
                              value={pair.answer}
                              onChange={(e) => updateQaPair(idx, "answer", e.target.value)}
                              rows={3}
                              className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingQa(null)}
                            >
                              {tCommon("save")}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{pair.question}</p>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {pair.answer}
                            </p>
                          </div>
                        )}
                        {editingQa !== idx && (
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingQa(idx)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeQaPair(idx)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" onClick={addQaPair} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("add_qa")}
                </Button>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> {tCommon("back")}
              </Button>
              <Button onClick={() => setStep(3)}>
                {tCommon("next")} <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            {analyzeError && (
              <p className="text-sm text-red-400 text-center">{analyzeError}</p>
            )}
          </div>
        )}

        {/* ===== STEP 3: Ready! ===== */}
        {step === 3 && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-8 space-y-6">
                <div className="text-center space-y-2">
                  <div className="mx-auto w-14 h-14 rounded-full bg-green-600/20 flex items-center justify-center mb-4">
                    <Rocket className="h-7 w-7 text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold">{t("ready_title")}</h2>
                  <p className="text-muted-foreground">
                    {t("ready_description")}
                  </p>
                </div>

                {/* Profile summary */}
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <h3 className="text-sm font-medium text-foreground/80 uppercase tracking-wide">
                    {tProfile("title")}
                  </h3>
                  <div className="space-y-1.5 text-sm">
                    {profile.headline && (
                      <p>
                        <span className="text-muted-foreground">{tProfile("headline")}:</span>{" "}
                        <span className="text-foreground">{profile.headline}</span>
                      </p>
                    )}
                    {profile.yearsExperience && (
                      <p>
                        <span className="text-muted-foreground">{tProfile("years_experience")}:</span>{" "}
                        <span className="text-foreground">{profile.yearsExperience}</span>
                      </p>
                    )}
                    {profile.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {profile.skills.slice(0, 8).map((s) => (
                          <Badge key={s} color="blue">
                            {s}
                          </Badge>
                        ))}
                        {profile.skills.length > 8 && (
                          <Badge>+{profile.skills.length - 8} more</Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Search profiles summary */}
                {searchProfiles.map((sp, idx) => (
                  <div key={idx} className="rounded-lg border border-border p-4 space-y-3">
                    <h3 className="text-sm font-medium text-foreground/80 uppercase tracking-wide">
                      {tCommon("search")}: {sp.name}
                    </h3>
                    <div className="space-y-1.5 text-sm">
                      {sp.jobTitles.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {sp.jobTitles.map((jt) => (
                            <Badge key={jt} color="green">
                              {jt}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p>
                        <span className="text-muted-foreground">{tSearches("remote_only")}:</span>{" "}
                        <span className="text-foreground">{sp.remoteOnly ? "Yes" : "No"}</span>
                        {sp.minSalary && (
                          <>
                            {" "}
                            <span className="text-muted-foreground/60">|</span>{" "}
                            <span className="text-muted-foreground">{tSearches("min_salary")}:</span>{" "}
                            <span className="text-foreground">
                              {sp.minSalary.toLocaleString()} {sp.currency}
                            </span>
                          </>
                        )}
                      </p>
                      {sp.geographies.length > 0 && (
                        <p>
                          <span className="text-muted-foreground">{tSearches("geography")}:</span>{" "}
                          <span className="text-foreground">{sp.geographies.join(", ")}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Q&A summary */}
                {qaPairs.length > 0 && (
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <h3 className="text-sm font-medium text-foreground/80 uppercase tracking-wide">
                      {t("tab_qa")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("qa_count", { count: qaPairs.length })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> {tCommon("back")}
              </Button>
              <Button size="lg" onClick={handleComplete} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {tCommon("loading")}
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4 mr-2" />
                    {t("start_button")}
                  </>
                )}
              </Button>
            </div>
            {analyzeError && (
              <p className="text-sm text-red-400 text-center">{analyzeError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
