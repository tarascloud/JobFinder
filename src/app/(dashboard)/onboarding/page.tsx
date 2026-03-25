"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
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
  ThumbsUp,
  ThumbsDown,
  Settings,
  Lightbulb,
  GitCompare,
  Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  type AnalyzedProfile,
  type AnalyzedSearchProfile,
  type AnalyzedQaPair,
  type ComprehensiveAnalysisResult,
} from "@/actions/profile";
import { completeOnboarding } from "@/actions/onboarding";
import { submitAiFeedback } from "@/actions/ai-feedback";
import {
  generateResumeRecommendationsForCurrentUser,
  applyRecommendationsForCurrentUser,
  type ResumeRecommendation,
} from "@/actions/resume-recommendations";
import AiFeedbackButtons from "@/components/shared/ai-feedback-buttons";
import { trackAIEditsBatch } from "@/actions/ai-edit-tracking";
import { getTranslation, getBatchTranslation, getQATranslation } from "@/actions/translations";

type ReviewTab = "profile" | "searches" | "qa";
type AIModel = "ollama" | "gemini" | "groq";

const ANALYSIS_MESSAGES = [
  "analyzing_extracting",
  "analyzing_profile",
  "analyzing_searches",
  "analyzing_qa",
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const tProfile = useTranslations("profile");
  const tSearches = useTranslations("searches");
  const tCommon = useTranslations("common");
  const tEdit = useTranslations("ai_edit_tracking");
  const tTranslations = useTranslations("translations");
  const locale = useLocale();

  const [step, setStep] = useState(1);

  // Translation state for onboarding review (Step 3)
  const [isTranslatingReview, setIsTranslatingReview] = useState(false);
  const [translatedProfile, setTranslatedProfile] = useState<{ headline?: string; summary?: string } | null>(null);
  const [translatedQaPairs, setTranslatedQaPairs] = useState<Record<number, { question: string; answer: string }>>({});
  const [showTranslated, setShowTranslated] = useState(false);

  async function handleTranslateReview() {
    if (translatedProfile) {
      setShowTranslated(!showTranslated);
      return;
    }
    setIsTranslatingReview(true);
    try {
      const [tHeadline, tSummary] = await Promise.all([
        profile.headline ? getTranslation(profile.headline, locale, "en") : Promise.resolve(""),
        profile.summary ? getTranslation(profile.summary, locale, "en") : Promise.resolve(""),
      ]);
      setTranslatedProfile({ headline: tHeadline, summary: tSummary });

      // Translate Q&A pairs
      const qaTranslationsResult: Record<number, { question: string; answer: string }> = {};
      for (let i = 0; i < qaPairs.length; i++) {
        const pair = qaPairs[i];
        if (pair.question) {
          const translated = await getQATranslation(pair.question, pair.answer || "", locale, "en");
          qaTranslationsResult[i] = translated;
        }
      }
      setTranslatedQaPairs(qaTranslationsResult);
      setShowTranslated(true);
    } finally {
      setIsTranslatingReview(false);
    }
  }

  const STEPS = [
    { number: 1, label: t("step_upload") },
    { number: 2, label: t("step_analysis") },
    { number: 3, label: t("step_review") },
    { number: 4, label: t("step_recommendations") },
    { number: 5, label: t("step_improve") },
    { number: 6, label: t("step_ready") },
  ];

  // Step 1 state
  const [aiModel, setAiModel] = useState<AIModel>("ollama");
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeUrlInput, setResumeUrlInput] = useState("");
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 state — analysis progress
  const [analysisMessageIndex, setAnalysisMessageIndex] = useState(0);
  const [analysisError, setAnalysisError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3 state — review
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

  // Step 4 state — recommendations
  const [recommendations, setRecommendations] = useState<ResumeRecommendation[]>([]);
  const [recFeedback, setRecFeedback] = useState<Record<string, "like" | "dislike">>({});
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [applyingRecs, setApplyingRecs] = useState(false);

  // Step 5 state — improve (before/after)
  const [originalProfile, setOriginalProfile] = useState<AnalyzedProfile | null>(null);
  const [improvedProfile, setImprovedProfile] = useState<AnalyzedProfile | null>(null);

  // AI edit tracking — save original AI-generated values for comparison
  const [aiOriginalProfile, setAiOriginalProfile] = useState<AnalyzedProfile | null>(null);
  const [aiOriginalSearches, setAiOriginalSearches] = useState<AnalyzedSearchProfile[] | null>(null);
  const [aiOriginalQaPairs, setAiOriginalQaPairs] = useState<AnalyzedQaPair[] | null>(null);

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
  const [analyzeError, setAnalyzeError] = useState("");

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (messageRef.current) clearInterval(messageRef.current);
    };
  }, []);

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
      // Move to analysis step
      startAnalysis(data.url);
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

  async function handleUrlAnalyze() {
    if (!resumeUrlInput.trim()) return;
    setResumeUrl(resumeUrlInput.trim());
    startAnalysis(resumeUrlInput.trim());
  }

  // --- Step 2: Start background analysis ---
  function startAnalysis(url: string) {
    setStep(2);
    setAnalysisError("");
    setAnalysisMessageIndex(0);

    // Rotate through progress messages
    messageRef.current = setInterval(() => {
      setAnalysisMessageIndex((prev) =>
        prev < ANALYSIS_MESSAGES.length - 1 ? prev + 1 : prev
      );
    }, 4000);

    // POST to start background analysis
    fetch("/api/analyze-resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeUrl: url }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to start analysis");
        // Start polling
        pollRef.current = setInterval(pollAnalysisStatus, 3000);
      })
      .catch((err) => {
        setAnalysisError(err.message || t("analysis_error"));
        if (messageRef.current) clearInterval(messageRef.current);
      });
  }

  async function pollAnalysisStatus() {
    try {
      const res = await fetch("/api/analyze-resume");
      const data = await res.json();

      if (data.status === "done" && data.result) {
        // Stop polling
        if (pollRef.current) clearInterval(pollRef.current);
        if (messageRef.current) clearInterval(messageRef.current);

        const result = data.result as ComprehensiveAnalysisResult;
        setProfile(result.profile);
        setSearchProfiles(result.searchProfiles);
        setQaPairs(result.qaPairs);
        // Save original AI-generated values for edit tracking
        setAiOriginalProfile(structuredClone(result.profile));
        setAiOriginalSearches(structuredClone(result.searchProfiles));
        setAiOriginalQaPairs(structuredClone(result.qaPairs));
        setStep(3);
      } else if (data.status === "error") {
        if (pollRef.current) clearInterval(pollRef.current);
        if (messageRef.current) clearInterval(messageRef.current);
        setAnalysisError(data.result?.error || data.error || t("analysis_error"));
      }
    } catch {
      // Silently retry on network error
    }
  }

  // --- Step 4: Load recommendations ---
  async function loadRecommendations() {
    setLoadingRecs(true);
    try {
      const result = await generateResumeRecommendationsForCurrentUser();
      if ("error" in result) {
        setAnalyzeError(result.error);
      } else {
        setRecommendations(result.recommendations);
      }
    } catch {
      setAnalyzeError(tCommon("error"));
    } finally {
      setLoadingRecs(false);
    }
  }

  function handleRecFeedback(recId: string, rating: "like" | "dislike") {
    setRecFeedback((prev) => ({ ...prev, [recId]: rating }));
    const rec = recommendations.find((r) => r.id === recId);
    if (rec) {
      submitAiFeedback({
        field: "resume_recommendation",
        context: rec.category,
        content: rec.title + ": " + rec.description,
        rating,
      });
    }
  }

  async function handleApplySuggestions() {
    const acceptedIds = recommendations
      .filter((r) => recFeedback[r.id] !== "dislike")
      .map((r) => r.id);

    if (acceptedIds.length === 0) {
      setStep(6);
      return;
    }

    setApplyingRecs(true);
    setOriginalProfile({ ...profile });

    try {
      const result = await applyRecommendationsForCurrentUser(acceptedIds);
      if ("error" in result) {
        setAnalyzeError(result.error);
        setApplyingRecs(false);
        return;
      }
      setImprovedProfile(result.updatedProfile);
      setApplyingRecs(false);
      setStep(5);
    } catch {
      setAnalyzeError(tCommon("error"));
      setApplyingRecs(false);
    }
  }

  // --- Step 5: Accept/reject improvements ---
  function acceptImprovements() {
    if (improvedProfile) {
      setProfile(improvedProfile);
    }
    setStep(6);
  }

  function rejectImprovements() {
    setStep(6);
  }

  // --- Step 6: Complete onboarding ---
  async function handleComplete() {
    setSaving(true);
    setAnalyzeError("");
    try {
      // Track AI edits before saving
      if (aiOriginalProfile) {
        const edits: { field: string; originalAI: string; userEdited: string; accepted: boolean }[] = [];

        // Profile fields
        const profileFields: { key: keyof AnalyzedProfile; field: string }[] = [
          { key: "headline", field: "profile.headline" },
          { key: "summary", field: "profile.summary" },
          { key: "yearsExperience", field: "profile.yearsExperience" },
          { key: "salaryCurrency", field: "profile.salaryCurrency" },
          { key: "salaryMin", field: "profile.salaryMin" },
          { key: "preferredRemoteType", field: "profile.preferredRemoteType" },
        ];

        for (const { key, field } of profileFields) {
          const orig = String(aiOriginalProfile[key] ?? "");
          const current = String(profile[key] ?? "");
          edits.push({ field, originalAI: orig, userEdited: current, accepted: orig === current });
        }

        // Array fields
        const arrayFields: { key: "skills" | "languages" | "portfolioUrls" | "preferredLocations" | "employmentTypes"; field: string }[] = [
          { key: "skills", field: "profile.skills" },
          { key: "languages", field: "profile.languages" },
          { key: "portfolioUrls", field: "profile.portfolioUrls" },
          { key: "preferredLocations", field: "profile.preferredLocations" },
          { key: "employmentTypes", field: "profile.employmentTypes" },
        ];

        for (const { key, field } of arrayFields) {
          const orig = (aiOriginalProfile[key] as string[]).join(", ");
          const current = (profile[key] as string[]).join(", ");
          edits.push({ field, originalAI: orig, userEdited: current, accepted: orig === current });
        }

        // Search profiles
        if (aiOriginalSearches) {
          for (let i = 0; i < searchProfiles.length; i++) {
            const orig = aiOriginalSearches[i];
            const current = searchProfiles[i];
            if (orig) {
              edits.push({ field: `search.${i}.name`, originalAI: orig.name, userEdited: current.name, accepted: orig.name === current.name });
              edits.push({ field: `search.${i}.jobTitles`, originalAI: orig.jobTitles.join(", "), userEdited: current.jobTitles.join(", "), accepted: orig.jobTitles.join(", ") === current.jobTitles.join(", ") });
              edits.push({ field: `search.${i}.geographies`, originalAI: orig.geographies.join(", "), userEdited: current.geographies.join(", "), accepted: orig.geographies.join(", ") === current.geographies.join(", ") });
              edits.push({ field: `search.${i}.minSalary`, originalAI: String(orig.minSalary ?? ""), userEdited: String(current.minSalary ?? ""), accepted: String(orig.minSalary ?? "") === String(current.minSalary ?? "") });
              edits.push({ field: `search.${i}.remoteOnly`, originalAI: String(orig.remoteOnly), userEdited: String(current.remoteOnly), accepted: orig.remoteOnly === current.remoteOnly });
            }
          }
        }

        // Q&A pairs
        if (aiOriginalQaPairs) {
          for (let i = 0; i < qaPairs.length; i++) {
            const orig = aiOriginalQaPairs[i];
            const current = qaPairs[i];
            if (orig) {
              edits.push({ field: `qa.${i}.question`, originalAI: orig.question, userEdited: current.question, accepted: orig.question === current.question });
              edits.push({ field: `qa.${i}.answer`, originalAI: orig.answer, userEdited: current.answer, accepted: orig.answer === current.answer });
            }
          }
        }

        // Fire and forget — don't block onboarding completion
        trackAIEditsBatch(edits).catch(() => {});
      }

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

  // --- Navigation ---
  function goToStep(targetStep: number) {
    // Step 2 (analysis) cannot be skipped back to if we've passed it
    if (targetStep === 4 && step === 3) {
      loadRecommendations();
    }
    setStep(targetStep);
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

  const priorityColors = {
    high: "bg-red-900/40 border-red-700/40 text-red-300",
    medium: "bg-amber-900/40 border-amber-700/40 text-amber-300",
    low: "bg-blue-900/40 border-blue-700/40 text-blue-300",
  };

  const priorityLabels = {
    high: t("priority_high"),
    medium: t("priority_medium"),
    low: t("priority_low"),
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    content: <FileText className="h-4 w-4" />,
    format: <GitCompare className="h-4 w-4" />,
    keywords: <Sparkles className="h-4 w-4" />,
    achievements: <Rocket className="h-4 w-4" />,
    structure: <Briefcase className="h-4 w-4" />,
  };

  return (
    <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-start py-8 px-4">
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto max-w-full">
        {STEPS.map((s, i) => (
          <div key={s.number} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors shrink-0 ${
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
              className={`ml-1 text-xs hidden sm:inline whitespace-nowrap ${
                step >= s.number ? "text-foreground" : "text-muted-foreground/60"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`w-4 sm:w-8 h-px mx-1 sm:mx-2 ${
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

              {/* AI Model selector */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <label className="text-sm font-medium text-foreground whitespace-nowrap">
                  {t("select_ai_model")}
                </label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value as AIModel)}
                  className="flex-1 rounded-lg border border-input bg-muted px-3 py-1.5 text-sm text-foreground focus:border-ring focus:outline-none"
                >
                  <option value="ollama">Ollama (Local)</option>
                  <option value="gemini">Gemini</option>
                  <option value="groq">Groq</option>
                </select>
                <a
                  href="/settings/ai"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Settings className="h-3 w-3" />
                  {t("configure_ai")}
                </a>
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
                  />
                </div>
                <Button
                  onClick={handleUrlAnalyze}
                  disabled={!resumeUrlInput.trim()}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t("analyze_button")}
                </Button>
              </div>

              {analyzeError && (
                <p className="text-sm text-red-400">{analyzeError}</p>
              )}

              <Button
                variant="ghost"
                onClick={() => setStep(3)}
                className="w-full text-muted-foreground"
              >
                {t("skip_manual")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ===== STEP 2: Analysis Progress ===== */}
        {step === 2 && (
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Loader2 className="h-7 w-7 text-amber-400 animate-spin" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">{t("analyzing_title")}</h2>
                  <p className="text-muted-foreground">{t("analyzing_description")}</p>
                </div>

                {/* Animated progress messages */}
                <div className="space-y-3 py-4">
                  {ANALYSIS_MESSAGES.map((msgKey, idx) => (
                    <div
                      key={msgKey}
                      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-500 ${
                        idx < analysisMessageIndex
                          ? "bg-green-900/20 border border-green-700/30"
                          : idx === analysisMessageIndex
                          ? "bg-amber-900/20 border border-amber-700/30"
                          : "bg-muted/30 border border-transparent"
                      }`}
                    >
                      {idx < analysisMessageIndex ? (
                        <Check className="h-4 w-4 text-green-400 shrink-0" />
                      ) : idx === analysisMessageIndex ? (
                        <Loader2 className="h-4 w-4 text-amber-400 animate-spin shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />
                      )}
                      <span
                        className={`text-sm ${
                          idx < analysisMessageIndex
                            ? "text-green-300"
                            : idx === analysisMessageIndex
                            ? "text-amber-300"
                            : "text-muted-foreground/50"
                        }`}
                      >
                        {t(msgKey)}
                      </span>
                    </div>
                  ))}
                </div>

                {analysisError && (
                  <div className="space-y-3">
                    <p className="text-sm text-red-400">{analysisError}</p>
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> {tCommon("back")}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== STEP 3: Review AI-Generated Data ===== */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold">{t("review_title")}</h2>
              <p className="text-muted-foreground">
                {t("review_description")}
              </p>
            </div>

            {/* Translation banner — show when user's locale is not English */}
            {locale !== "en" && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-muted/50 border border-border text-sm">
                <span className="text-muted-foreground">
                  {tTranslations("ai_content_lang")} &middot; {tTranslations("ui_language", { language: tTranslations(locale as "en" | "uk" | "es") })}
                </span>
                <button
                  onClick={handleTranslateReview}
                  disabled={isTranslatingReview}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  {isTranslatingReview ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {tTranslations("translating")}
                    </>
                  ) : showTranslated ? (
                    <>
                      <Languages className="h-3 w-3" />
                      {tTranslations("show_english")}
                    </>
                  ) : (
                    <>
                      <Languages className="h-3 w-3" />
                      {tTranslations("translate_to", { language: tTranslations(locale as "en" | "uk" | "es") })}
                    </>
                  )}
                </button>
              </div>
            )}

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
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm text-muted-foreground">
                        {tProfile("headline")}
                      </label>
                      <div className="flex items-center gap-1.5">
                        {aiOriginalProfile && profile.headline !== aiOriginalProfile.headline && (
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            <Pencil className="h-3 w-3" /> {tEdit("edited")}
                          </span>
                        )}
                        {aiOriginalProfile && profile.headline === aiOriginalProfile.headline && aiOriginalProfile.headline && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <Check className="h-3 w-3" /> {tEdit("kept")}
                          </span>
                        )}
                        {aiOriginalProfile?.headline && (
                          <AiFeedbackButtons field="profile.headline" content={aiOriginalProfile.headline} context="onboarding" />
                        )}
                      </div>
                    </div>
                    <Input
                      value={profile.headline}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, headline: e.target.value }))
                      }
                      placeholder="e.g. Senior Frontend Engineer"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm text-muted-foreground">
                        {tProfile("summary")}
                      </label>
                      <div className="flex items-center gap-1.5">
                        {aiOriginalProfile && profile.summary !== aiOriginalProfile.summary && (
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            <Pencil className="h-3 w-3" /> {tEdit("edited")}
                          </span>
                        )}
                        {aiOriginalProfile && profile.summary === aiOriginalProfile.summary && aiOriginalProfile.summary && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <Check className="h-3 w-3" /> {tEdit("kept")}
                          </span>
                        )}
                        {aiOriginalProfile?.summary && (
                          <AiFeedbackButtons field="profile.summary" content={aiOriginalProfile.summary} context="onboarding" />
                        )}
                      </div>
                    </div>
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
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm text-muted-foreground">
                        {tProfile("skills")}
                      </label>
                      <div className="flex items-center gap-1.5">
                        {aiOriginalProfile && profile.skills.join(",") !== aiOriginalProfile.skills.join(",") && (
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            <Pencil className="h-3 w-3" /> {tEdit("edited")}
                          </span>
                        )}
                        {aiOriginalProfile && profile.skills.join(",") === aiOriginalProfile.skills.join(",") && aiOriginalProfile.skills.length > 0 && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <Check className="h-3 w-3" /> {tEdit("kept")}
                          </span>
                        )}
                        {aiOriginalProfile && aiOriginalProfile.skills.length > 0 && (
                          <AiFeedbackButtons field="profile.skills" content={aiOriginalProfile.skills.join(", ")} context="onboarding" />
                        )}
                      </div>
                    </div>
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
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm text-muted-foreground">
                        {tProfile("languages")}
                      </label>
                      <div className="flex items-center gap-1.5">
                        {aiOriginalProfile && profile.languages.join(",") !== aiOriginalProfile.languages.join(",") && (
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            <Pencil className="h-3 w-3" /> {tEdit("edited")}
                          </span>
                        )}
                        {aiOriginalProfile && profile.languages.join(",") === aiOriginalProfile.languages.join(",") && aiOriginalProfile.languages.length > 0 && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <Check className="h-3 w-3" /> {tEdit("kept")}
                          </span>
                        )}
                        {aiOriginalProfile && aiOriginalProfile.languages.length > 0 && (
                          <AiFeedbackButtons field="profile.languages" content={aiOriginalProfile.languages.join(", ")} context="onboarding" />
                        )}
                      </div>
                    </div>
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
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm text-muted-foreground">
                        {t("preferred_locations")}
                      </label>
                      <div className="flex items-center gap-1.5">
                        {aiOriginalProfile && profile.preferredLocations.join(",") !== aiOriginalProfile.preferredLocations.join(",") && (
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            <Pencil className="h-3 w-3" /> {tEdit("edited")}
                          </span>
                        )}
                        {aiOriginalProfile && profile.preferredLocations.join(",") === aiOriginalProfile.preferredLocations.join(",") && aiOriginalProfile.preferredLocations.length > 0 && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <Check className="h-3 w-3" /> {tEdit("kept")}
                          </span>
                        )}
                        {aiOriginalProfile && aiOriginalProfile.preferredLocations.length > 0 && (
                          <AiFeedbackButtons field="profile.preferredLocations" content={aiOriginalProfile.preferredLocations.join(", ")} context="onboarding" />
                        )}
                      </div>
                    </div>
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
                          {aiOriginalSearches && aiOriginalSearches[idx] && (
                            <AiFeedbackButtons
                              field={`search.${idx}`}
                              content={`${sp.name}: ${sp.jobTitles.join(", ")}`}
                              context="onboarding"
                            />
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
                          <div className="flex items-center gap-1 shrink-0">
                            {aiOriginalQaPairs && aiOriginalQaPairs[idx] && (
                              <>
                                {pair.answer !== aiOriginalQaPairs[idx].answer && (
                                  <span className="text-xs text-amber-400 flex items-center gap-1">
                                    <Pencil className="h-3 w-3" />
                                  </span>
                                )}
                                {pair.answer === aiOriginalQaPairs[idx].answer && aiOriginalQaPairs[idx].answer && (
                                  <span className="text-xs text-green-400 flex items-center gap-1">
                                    <Check className="h-3 w-3" />
                                  </span>
                                )}
                                <AiFeedbackButtons
                                  field={`qa.${idx}.answer`}
                                  content={aiOriginalQaPairs[idx].answer}
                                  context={pair.question}
                                />
                              </>
                            )}
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
              <Button onClick={() => goToStep(4)}>
                {tCommon("next")} <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            {analyzeError && (
              <p className="text-sm text-red-400 text-center">{analyzeError}</p>
            )}
          </div>
        )}

        {/* ===== STEP 4: Recommendations ===== */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                <Lightbulb className="h-7 w-7 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold">{t("recommendations_title")}</h2>
              <p className="text-muted-foreground">
                {t("recommendations_desc")}
              </p>
            </div>

            {loadingRecs ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{t("recommendations_loading")}</p>
                </CardContent>
              </Card>
            ) : recommendations.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Check className="h-8 w-8 text-green-400 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{t("no_recommendations")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <Card
                    key={rec.id}
                    className={`transition-opacity ${
                      recFeedback[rec.id] === "dislike" ? "opacity-50" : ""
                    }`}
                  >
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="mt-0.5 text-muted-foreground">
                            {categoryIcons[rec.category] || <Lightbulb className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-medium text-foreground">{rec.title}</h3>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${priorityColors[rec.priority]}`}
                              >
                                {priorityLabels[rec.priority]}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{rec.description}</p>
                            {rec.currentText && rec.suggestedText && (
                              <div className="mt-2 space-y-1.5">
                                <div className="rounded-md bg-red-950/30 border border-red-900/30 px-3 py-1.5">
                                  <p className="text-xs text-red-300/70 line-through">
                                    {rec.currentText}
                                  </p>
                                </div>
                                <div className="rounded-md bg-green-950/30 border border-green-900/30 px-3 py-1.5">
                                  <p className="text-xs text-green-300">{rec.suggestedText}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => handleRecFeedback(rec.id, "like")}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              recFeedback[rec.id] === "like"
                                ? "bg-green-900/40 text-green-400"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            <ThumbsUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRecFeedback(rec.id, "dislike")}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              recFeedback[rec.id] === "dislike"
                                ? "bg-red-900/40 text-red-400"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            <ThumbsDown className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> {tCommon("back")}
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep(6)}>
                  {t("skip_improvements")}
                </Button>
                {recommendations.length > 0 && (
                  <Button onClick={handleApplySuggestions} disabled={applyingRecs}>
                    {applyingRecs ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t("applying_improvements")}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        {t("apply_suggestions")}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            {analyzeError && (
              <p className="text-sm text-red-400 text-center">{analyzeError}</p>
            )}
          </div>
        )}

        {/* ===== STEP 5: Before/After Comparison ===== */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <GitCompare className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">{t("improve_title")}</h2>
              <p className="text-muted-foreground">{t("improve_desc")}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Before */}
              <Card className="border-red-900/30">
                <CardContent className="p-5 space-y-3">
                  <h3 className="text-sm font-medium text-red-300 uppercase tracking-wide">
                    {t("before")}
                  </h3>
                  {originalProfile && (
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">{tProfile("headline")}:</span>{" "}
                        <span className="text-foreground">{originalProfile.headline}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{tProfile("summary")}:</span>{" "}
                        <span className="text-foreground/80">{originalProfile.summary}</span>
                      </div>
                      {originalProfile.skills.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">{tProfile("skills")}:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {originalProfile.skills.map((s) => (
                              <Badge key={s} color="red">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {originalProfile.yearsExperience && (
                        <div>
                          <span className="text-muted-foreground">{tProfile("years_experience")}:</span>{" "}
                          <span className="text-foreground">{originalProfile.yearsExperience}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* After */}
              <Card className="border-green-900/30">
                <CardContent className="p-5 space-y-3">
                  <h3 className="text-sm font-medium text-green-300 uppercase tracking-wide">
                    {t("after")}
                  </h3>
                  {improvedProfile && (
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">{tProfile("headline")}:</span>{" "}
                        <span className={`text-foreground ${
                          improvedProfile.headline !== originalProfile?.headline ? "bg-green-900/30 px-1 rounded" : ""
                        }`}>
                          {improvedProfile.headline}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{tProfile("summary")}:</span>{" "}
                        <span className={`text-foreground/80 ${
                          improvedProfile.summary !== originalProfile?.summary ? "bg-green-900/30 px-1 rounded" : ""
                        }`}>
                          {improvedProfile.summary}
                        </span>
                      </div>
                      {improvedProfile.skills.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">{tProfile("skills")}:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {improvedProfile.skills.map((s) => (
                              <Badge
                                key={s}
                                color={originalProfile?.skills.includes(s) ? "blue" : "green"}
                              >
                                {s}
                                {!originalProfile?.skills.includes(s) && (
                                  <span className="ml-1 text-green-400">+</span>
                                )}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {improvedProfile.yearsExperience && (
                        <div>
                          <span className="text-muted-foreground">{tProfile("years_experience")}:</span>{" "}
                          <span className="text-foreground">{improvedProfile.yearsExperience}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(4)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> {tCommon("back")}
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={rejectImprovements}>
                  {t("reject_improvements")}
                </Button>
                <Button onClick={acceptImprovements}>
                  <Check className="h-4 w-4 mr-2" />
                  {t("accept_improvements")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ===== STEP 6: Ready! ===== */}
        {step === 6 && (
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
              <Button variant="outline" onClick={() => setStep(5)}>
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
