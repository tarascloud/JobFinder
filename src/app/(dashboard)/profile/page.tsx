"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Upload,
  Plus,
  X,
  FileText,
  Loader2,
  CheckCircle,
  Link,
  Sparkles,
  Check,
  RotateCcw,
  AlertCircle,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  GitCompare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  updateProfile,
  type AnalyzedProfile,
  type AnalyzedSearchProfile,
  type AnalyzedQaPair,
  getAnalysisStatus,
  clearAnalysisStatus,
} from "@/actions/profile";
import { createSearchProfile } from "@/actions/search-profiles";
import AiFeedbackButtons from "@/components/shared/ai-feedback-buttons";
import { submitAiFeedback } from "@/actions/ai-feedback";
import {
  generateResumeRecommendationsForCurrentUser,
  applyRecommendationsForCurrentUser,
  type ResumeRecommendation,
} from "@/actions/resume-recommendations";

const LANGUAGE_OPTIONS = [
  "English",
  "Ukrainian",
  "Spanish",
  "German",
  "French",
  "Portuguese",
  "Italian",
  "Polish",
  "Dutch",
  "Czech",
  "Swedish",
  "Norwegian",
  "Danish",
  "Finnish",
  "Japanese",
  "Chinese",
  "Korean",
  "Arabic",
  "Hindi",
  "Turkish",
  "Russian",
];

const LANGUAGE_LEVELS = ["Native", "Fluent", "Professional", "Basic"] as const;
type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

interface LanguageEntry {
  language: string;
  level: LanguageLevel;
}

function parseLanguages(raw: string[]): LanguageEntry[] {
  if (!raw || raw.length === 0) return [];
  return raw.map((item) => {
    const match = item.match(/^(.+?)\s*\((.+?)\)$/);
    if (match) {
      const level = LANGUAGE_LEVELS.find(
        (l) => l.toLowerCase() === match[2].trim().toLowerCase()
      );
      return { language: match[1].trim(), level: level ?? "Professional" };
    }
    return { language: item.trim(), level: "Professional" as LanguageLevel };
  });
}

function serializeLanguages(entries: LanguageEntry[]): string[] {
  return entries.map((e) => `${e.language} (${e.level})`);
}

interface ReanalysisResult {
  profile: AnalyzedProfile;
  searchProfiles: AnalyzedSearchProfile[];
  qaPairs: AnalyzedQaPair[];
}

type AnalysisPhase = "idle" | "uploading" | "upload_done" | "analyzing" | "done" | "error";

export default function ProfilePage() {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");

  // Resume upload state
  const [isDragging, setIsDragging] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>("idle");
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reanalysis diff state
  const [reanalysisResult, setReanalysisResult] = useState<ReanalysisResult | null>(null);
  const [acceptedChanges, setAcceptedChanges] = useState<Set<string>>(new Set());

  // Recommendations state (shown after re-analysis)
  const tOnboarding = useTranslations("onboarding");
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState<ResumeRecommendation[]>([]);
  const [recFeedback, setRecFeedback] = useState<Record<string, "like" | "dislike">>({});
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [applyingRecs, setApplyingRecs] = useState(false);
  const [improvedProfile, setImprovedProfile] = useState<AnalyzedProfile | null>(null);
  const [showImprovePanel, setShowImprovePanel] = useState(false);

  // Profile state
  const [headline, setHeadline] = useState("Senior Frontend Engineer");
  const [summary, setSummary] = useState(
    "Experienced engineer with 8+ years building web applications with React, TypeScript, and Node.js."
  );
  const [yearsOfExperience, setYearsOfExperience] = useState("8");
  const [skills, setSkills] = useState([
    "React",
    "TypeScript",
    "Next.js",
    "Node.js",
    "PostgreSQL",
    "Tailwind CSS",
  ]);
  const [newSkill, setNewSkill] = useState("");
  const [languageEntries, setLanguageEntries] = useState<LanguageEntry[]>([
    { language: "English", level: "Professional" },
    { language: "Ukrainian", level: "Native" },
    { language: "Spanish", level: "Professional" },
  ]);
  const [portfolioUrl, setPortfolioUrl] = useState("https://example.com");
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeUrlInput, setResumeUrlInput] = useState("");

  // Language add UI
  const [showLanguageAdd, setShowLanguageAdd] = useState(false);
  const [newLanguage, setNewLanguage] = useState("");
  const [newLanguageLevel, setNewLanguageLevel] = useState<LanguageLevel>("Professional");

  // Check for in-progress analysis on mount (user navigated away and came back)
  useEffect(() => {
    checkExistingAnalysis();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Block navigation only during file upload
  useEffect(() => {
    if (analysisPhase !== "uploading") return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [analysisPhase]);

  async function checkExistingAnalysis() {
    try {
      const status = await getAnalysisStatus();
      if (status.status === "analyzing") {
        setAnalysisPhase("analyzing");
        startPolling();
      } else if (status.status === "done" && status.result) {
        setReanalysisResult(status.result);
        setAcceptedChanges(new Set());
        setAnalysisPhase("done");
        setUploadedFile("resume.pdf");
        // Clear the status so it doesn't show again on next visit
        await clearAnalysisStatus();
      } else if (status.status === "error") {
        setAnalyzeError(status.error || "Analysis failed");
        setAnalysisPhase("error");
        await clearAnalysisStatus();
      }
    } catch {
      // ignore — first visit or no profile yet
    }
  }

  function startPolling() {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const status = await getAnalysisStatus();
        if (status.status === "done" && status.result) {
          stopPolling();
          setReanalysisResult(status.result);
          setAcceptedChanges(new Set());
          setAnalysisPhase("done");
          await clearAnalysisStatus();
        } else if (status.status === "error") {
          stopPolling();
          setAnalyzeError(status.error || "Analysis failed");
          setAnalysisPhase("error");
          await clearAnalysisStatus();
        }
      } catch {
        // continue polling
      }
    }, 3000);
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  async function triggerBackgroundAnalysis(url: string) {
    setAnalysisPhase("analyzing");
    setAnalyzeError(null);

    try {
      const response = await fetch("/api/analyze-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeUrl: url }),
      });

      if (!response.ok) {
        const data = await response.json();
        setAnalyzeError(data.error || "Failed to start analysis");
        setAnalysisPhase("error");
        return;
      }

      // Start polling for results
      startPolling();
    } catch {
      setAnalyzeError("Failed to start analysis");
      setAnalysisPhase("error");
    }
  }

  async function handleFileUpload(file: File) {
    if (file.type !== "application/pdf") {
      setAnalyzeError(t("pdf_only"));
      return;
    }

    setAnalysisPhase("uploading");
    setAnalyzeError(null);
    setReanalysisResult(null);

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
        setAnalysisPhase("error");
        return;
      }

      setUploadedFile(file.name);
      setResumeUrl(data.url);
      setAnalysisPhase("upload_done");

      // Automatically trigger background analysis
      await triggerBackgroundAnalysis(data.url);
    } catch {
      setAnalyzeError("Upload failed");
      setAnalysisPhase("error");
    }
  }

  async function handleUrlAnalyze() {
    if (!resumeUrlInput.trim()) return;
    const url = resumeUrlInput.trim();
    setResumeUrl(url);
    setReanalysisResult(null);
    await triggerBackgroundAnalysis(url);
  }

  function acceptChange(field: string) {
    if (!reanalysisResult) return;
    const p = reanalysisResult.profile;
    setAcceptedChanges((prev) => new Set(prev).add(field));

    switch (field) {
      case "headline":
        setHeadline(p.headline);
        break;
      case "summary":
        setSummary(p.summary);
        break;
      case "yearsExperience":
        setYearsOfExperience(p.yearsExperience != null ? String(p.yearsExperience) : "");
        break;
      case "skills":
        setSkills(p.skills);
        break;
      case "languages":
        setLanguageEntries(parseLanguages(p.languages));
        break;
      case "portfolioUrls":
        if (p.portfolioUrls.length > 0) setPortfolioUrl(p.portfolioUrls[0]);
        break;
    }
  }

  function acceptAllChanges() {
    if (!reanalysisResult) return;
    const p = reanalysisResult.profile;
    setHeadline(p.headline);
    setSummary(p.summary);
    setYearsOfExperience(p.yearsExperience != null ? String(p.yearsExperience) : "");
    setSkills(p.skills);
    setLanguageEntries(parseLanguages(p.languages));
    if (p.portfolioUrls.length > 0) setPortfolioUrl(p.portfolioUrls[0]);
    setAcceptedChanges(new Set(["headline", "summary", "yearsExperience", "skills", "languages", "portfolioUrls"]));
  }

  async function acceptSearchProfiles() {
    if (!reanalysisResult) return;
    for (const sp of reanalysisResult.searchProfiles) {
      await createSearchProfile({
        name: sp.name,
        jobTitles: sp.jobTitles,
        minSalary: sp.minSalary,
        currency: sp.currency,
        employmentTypes: sp.employmentTypes,
        remoteOnly: sp.remoteOnly,
        geographies: sp.geographies,
      });
    }
    setAcceptedChanges((prev) => new Set(prev).add("searchProfiles"));
  }

  function dismissReanalysis() {
    setReanalysisResult(null);
    setAcceptedChanges(new Set());
  }

  // --- Recommendations ---
  async function loadProfileRecommendations() {
    setShowRecommendations(true);
    setLoadingRecs(true);
    setRecommendations([]);
    setRecFeedback({});
    try {
      const result = await generateResumeRecommendationsForCurrentUser();
      if ("error" in result) {
        setAnalyzeError(result.error);
      } else {
        setRecommendations(result.recommendations);
      }
    } catch {
      setAnalyzeError("Failed to load recommendations");
    } finally {
      setLoadingRecs(false);
    }
  }

  function handleProfileRecFeedback(recId: string, rating: "like" | "dislike") {
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

  async function handleApplyProfileSuggestions() {
    const acceptedIds = recommendations
      .filter((r) => recFeedback[r.id] !== "dislike")
      .map((r) => r.id);

    if (acceptedIds.length === 0) {
      setShowRecommendations(false);
      return;
    }

    setApplyingRecs(true);
    try {
      const result = await applyRecommendationsForCurrentUser(acceptedIds);
      if ("error" in result) {
        setAnalyzeError(result.error);
        setApplyingRecs(false);
        return;
      }
      setImprovedProfile(result.updatedProfile);
      setShowImprovePanel(true);
      setShowRecommendations(false);
      setApplyingRecs(false);
    } catch {
      setAnalyzeError("Failed to apply recommendations");
      setApplyingRecs(false);
    }
  }

  function acceptProfileImprovements() {
    if (!improvedProfile) return;
    setHeadline(improvedProfile.headline);
    setSummary(improvedProfile.summary);
    setYearsOfExperience(improvedProfile.yearsExperience != null ? String(improvedProfile.yearsExperience) : "");
    setSkills(improvedProfile.skills);
    setShowImprovePanel(false);
    setImprovedProfile(null);
  }

  function dismissProfileImprovements() {
    setShowImprovePanel(false);
    setImprovedProfile(null);
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

  function addSkill() {
    const trimmed = newSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkill("");
    }
  }

  function removeSkill(skill: string) {
    setSkills(skills.filter((s) => s !== skill));
  }

  function addLanguage() {
    const lang = newLanguage.trim();
    if (lang && !languageEntries.find((e) => e.language === lang)) {
      setLanguageEntries([...languageEntries, { language: lang, level: newLanguageLevel }]);
      setNewLanguage("");
      setNewLanguageLevel("Professional");
      setShowLanguageAdd(false);
    }
  }

  function removeLanguage(language: string) {
    setLanguageEntries(languageEntries.filter((e) => e.language !== language));
  }

  function updateLanguageLevel(language: string, level: LanguageLevel) {
    setLanguageEntries(
      languageEntries.map((e) =>
        e.language === language ? { ...e, level } : e
      )
    );
  }

  function getLevelColor(level: LanguageLevel) {
    switch (level) {
      case "Native":
        return "bg-green-900/40 border-green-700/40 text-green-300";
      case "Fluent":
        return "bg-primary/15 border-primary/30 text-primary/80";
      case "Professional":
        return "bg-purple-900/40 border-purple-700/40 text-purple-300";
      case "Basic":
        return "bg-muted border-border text-foreground/80";
    }
  }

  function hasChanged(field: string): boolean {
    if (!reanalysisResult) return false;
    const p = reanalysisResult.profile;
    switch (field) {
      case "headline":
        return p.headline !== headline;
      case "summary":
        return p.summary !== summary;
      case "yearsExperience":
        return String(p.yearsExperience ?? "") !== yearsOfExperience;
      case "skills":
        return JSON.stringify(p.skills.sort()) !== JSON.stringify([...skills].sort());
      case "languages":
        return JSON.stringify(p.languages.sort()) !== JSON.stringify(serializeLanguages(languageEntries).sort());
      case "portfolioUrls":
        return JSON.stringify(p.portfolioUrls) !== JSON.stringify(portfolioUrl ? [portfolioUrl] : []);
      default:
        return false;
    }
  }

  function DiffIndicator({ field }: { field: string }) {
    if (!reanalysisResult || acceptedChanges.has(field)) return null;
    if (!hasChanged(field)) return null;
    return (
      <button
        onClick={() => acceptChange(field)}
        className="ml-2 inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
        title={t("accept_change")}
      >
        <Sparkles className="h-3 w-3" />
        {t("new_suggestion")}
      </button>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Background analysis banner — persists across navigation */}
      {analysisPhase === "analyzing" && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <Loader2 className="h-5 w-5 text-amber-400 animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">{t("bg_analyzing")}</p>
            <p className="text-xs text-muted-foreground">{t("bg_analyzing_desc")}</p>
          </div>
        </div>
      )}

      {/* Resume Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("upload_resume")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  : analysisPhase === "analyzing"
                    ? "border-amber-500/50 bg-amber-500/5"
                    : (uploadedFile && analysisPhase !== "error")
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

            {analysisPhase === "uploading" ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-sm text-foreground/80">{t("uploading")}</p>
              </div>
            ) : uploadedFile && analysisPhase !== "error" ? (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle className="h-10 w-10 text-green-400" />
                <p className="text-sm text-green-300 font-medium">{uploadedFile}</p>
                <p className="text-xs text-muted-foreground">
                  {analysisPhase === "analyzing"
                    ? t("upload_complete_analyzing")
                    : analysisPhase === "done"
                      ? t("analysis_complete")
                      : t("upload_complete")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="text-sm text-foreground/80">{t("drop_zone_text")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("pdf_only")}</p>
                </div>
              </div>
            )}
          </div>

          {analyzeError && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>{analyzeError}</p>
            </div>
          )}

          {/* URL input */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex-1 border-t border-input" />
            <span>{t("or_paste_url")}</span>
            <div className="flex-1 border-t border-input" />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={resumeUrlInput}
                onChange={(e) => setResumeUrlInput(e.target.value)}
                placeholder={t("resume_url_placeholder")}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="md"
              onClick={handleUrlAnalyze}
              disabled={!resumeUrlInput.trim() || analysisPhase === "analyzing"}
            >
              {analysisPhase === "analyzing" ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1.5" />
              )}
              {t("analyze")}
            </Button>
          </div>

          {resumeUrl && (
            <p className="text-xs text-muted-foreground">
              {t("resume_url")}: <span className="text-foreground/80">{resumeUrl}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Re-analysis diff panel */}
      {reanalysisResult && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-300">
              <Sparkles className="h-5 w-5" />
              {t("reanalysis_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("reanalysis_description")}</p>

            {/* Changed fields summary */}
            <div className="space-y-2">
              {(["headline", "summary", "yearsExperience", "skills", "languages", "portfolioUrls"] as const).map(
                (field) => {
                  if (!hasChanged(field) || acceptedChanges.has(field)) return null;
                  return (
                    <div key={field} className="flex items-center justify-between text-sm p-2 rounded bg-amber-500/10 border border-amber-500/20">
                      <span className="text-foreground capitalize">
                        {field === "yearsExperience" ? t("years_experience") : t(field === "portfolioUrls" ? "portfolio" : field)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => acceptChange(field)}
                        className="text-amber-300 border-amber-500/40"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        {t("accept")}
                      </Button>
                    </div>
                  );
                }
              )}
            </div>

            {/* New search profiles */}
            {reanalysisResult.searchProfiles.length > 0 && !acceptedChanges.has("searchProfiles") && (
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    {t("new_search_profiles", { count: reanalysisResult.searchProfiles.length })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={acceptSearchProfiles}
                    className="text-amber-300 border-amber-500/40"
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {t("accept")}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {reanalysisResult.searchProfiles.map((sp) => (
                    <Badge key={sp.name} color="yellow">{sp.name}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* New Q&A pairs */}
            {reanalysisResult.qaPairs.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {t("new_qa_pairs", { count: reanalysisResult.qaPairs.length })}
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={acceptAllChanges}>
                <Check className="h-4 w-4 mr-1" />
                {t("accept_all")}
              </Button>
              <Button variant="outline" size="sm" onClick={dismissReanalysis}>
                <RotateCcw className="h-4 w-4 mr-1" />
                {t("dismiss")}
              </Button>
              <Button variant="outline" size="sm" onClick={loadProfileRecommendations}>
                <Lightbulb className="h-4 w-4 mr-1" />
                {tOnboarding("recommendations_title")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Recommendations Panel */}
      {showRecommendations && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-300">
              <Lightbulb className="h-5 w-5" />
              {tOnboarding("recommendations_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{tOnboarding("recommendations_desc")}</p>

            {loadingRecs ? (
              <div className="text-center py-4">
                <Loader2 className="h-6 w-6 text-primary animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{tOnboarding("recommendations_loading")}</p>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="text-center py-4">
                <Check className="h-6 w-6 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{tOnboarding("no_recommendations")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className={`p-3 rounded-lg border border-border space-y-2 transition-opacity ${
                      recFeedback[rec.id] === "dislike" ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium">{rec.title}</h4>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
                            rec.priority === "high" ? "bg-red-900/40 border-red-700/40 text-red-300"
                              : rec.priority === "medium" ? "bg-amber-900/40 border-amber-700/40 text-amber-300"
                              : "bg-blue-900/40 border-blue-700/40 text-blue-300"
                          }`}>
                            {rec.priority === "high" ? tOnboarding("priority_high")
                              : rec.priority === "medium" ? tOnboarding("priority_medium")
                              : tOnboarding("priority_low")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{rec.description}</p>
                        {rec.currentText && rec.suggestedText && (
                          <div className="mt-2 space-y-1">
                            <div className="rounded bg-red-950/30 border border-red-900/30 px-2 py-1">
                              <p className="text-xs text-red-300/70 line-through">{rec.currentText}</p>
                            </div>
                            <div className="rounded bg-green-950/30 border border-green-900/30 px-2 py-1">
                              <p className="text-xs text-green-300">{rec.suggestedText}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleProfileRecFeedback(rec.id, "like")}
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                            recFeedback[rec.id] === "like"
                              ? "bg-green-900/40 text-green-400"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleProfileRecFeedback(rec.id, "dislike")}
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
                  </div>
                ))}
              </div>
            )}

            {recommendations.length > 0 && (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleApplyProfileSuggestions} disabled={applyingRecs}>
                  {applyingRecs ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      {tOnboarding("applying_improvements")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" />
                      {tOnboarding("apply_suggestions")}
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowRecommendations(false)}>
                  {tOnboarding("skip_improvements")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Improvement Before/After Panel */}
      {showImprovePanel && improvedProfile && (
        <Card className="border-green-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-300">
              <GitCompare className="h-5 w-5" />
              {tOnboarding("improve_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{tOnboarding("improve_desc")}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-red-900/30 space-y-2">
                <h4 className="text-xs font-medium text-red-300 uppercase">{tOnboarding("before")}</h4>
                <p className="text-sm"><span className="text-muted-foreground">{t("headline")}:</span> {headline}</p>
                <p className="text-sm text-muted-foreground line-clamp-3">{summary}</p>
              </div>
              <div className="p-3 rounded-lg border border-green-900/30 space-y-2">
                <h4 className="text-xs font-medium text-green-300 uppercase">{tOnboarding("after")}</h4>
                <p className="text-sm">
                  <span className="text-muted-foreground">{t("headline")}:</span>{" "}
                  <span className={improvedProfile.headline !== headline ? "bg-green-900/30 px-1 rounded" : ""}>
                    {improvedProfile.headline}
                  </span>
                </p>
                <p className={`text-sm text-muted-foreground line-clamp-3 ${
                  improvedProfile.summary !== summary ? "bg-green-900/30 px-1 rounded" : ""
                }`}>
                  {improvedProfile.summary}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={acceptProfileImprovements}>
                <Check className="h-4 w-4 mr-1" />
                {tOnboarding("accept_improvements")}
              </Button>
              <Button variant="outline" size="sm" onClick={dismissProfileImprovements}>
                {tOnboarding("reject_improvements")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Headline & Summary */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("headline")}
            <DiffIndicator field="headline" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="block text-sm text-muted-foreground">{t("headline")}</label>
              {acceptedChanges.has("headline") && (
                <AiFeedbackButtons field="profile.headline" content={headline} context="resume_analysis" />
              )}
            </div>
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="block text-sm text-muted-foreground">
                {t("summary")}
                <DiffIndicator field="summary" />
              </label>
              {acceptedChanges.has("summary") && (
                <AiFeedbackButtons field="profile.summary" content={summary} context="resume_analysis" />
              )}
            </div>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              {t("years_experience")}
              <DiffIndicator field="yearsExperience" />
            </label>
            <Input
              type="number"
              value={yearsOfExperience}
              onChange={(e) => setYearsOfExperience(e.target.value)}
              className="max-w-32"
            />
          </div>
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>
              {t("skills")}
              <DiffIndicator field="skills" />
            </CardTitle>
            {acceptedChanges.has("skills") && (
              <AiFeedbackButtons field="profile.skills" content={skills.join(", ")} context="resume_analysis" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-sm text-primary/80"
              >
                {skill}
                <button
                  onClick={() => removeSkill(skill)}
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
              onKeyDown={(e) => e.key === "Enter" && addSkill()}
              placeholder={t("skills") + "..."}
              className="max-w-64"
            />
            <Button variant="outline" size="md" onClick={addSkill}>
              <Plus className="h-4 w-4 mr-1" /> {tCommon("save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Languages */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("languages")}
            <DiffIndicator field="languages" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {languageEntries.map((entry) => (
              <div
                key={entry.language}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${getLevelColor(entry.level)}`}
              >
                <span className="font-medium">{entry.language}</span>
                <select
                  value={entry.level}
                  onChange={(e) => updateLanguageLevel(entry.language, e.target.value as LanguageLevel)}
                  className="bg-transparent border-none text-xs cursor-pointer focus:outline-none"
                >
                  {LANGUAGE_LEVELS.map((level) => (
                    <option key={level} value={level} className="bg-muted text-foreground">
                      {t(`level_${level.toLowerCase()}`)}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeLanguage(entry.language)}
                  className="ml-0.5 opacity-60 hover:opacity-100 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {showLanguageAdd ? (
            <div className="flex gap-2 items-center">
              <select
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                className="rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">{t("select_language")}</option>
                {LANGUAGE_OPTIONS.filter(
                  (l) => !languageEntries.find((e) => e.language === l)
                ).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <select
                value={newLanguageLevel}
                onChange={(e) => setNewLanguageLevel(e.target.value as LanguageLevel)}
                className="rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {LANGUAGE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {t(`level_${level.toLowerCase()}`)}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="md" onClick={addLanguage} disabled={!newLanguage}>
                <Plus className="h-4 w-4 mr-1" /> {tCommon("save")}
              </Button>
              <Button variant="ghost" size="md" onClick={() => setShowLanguageAdd(false)}>
                {tCommon("cancel")}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowLanguageAdd(true)}>
              <Plus className="h-4 w-4 mr-1" /> {t("add_language")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Portfolio */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("portfolio")}
            <DiffIndicator field="portfolioUrls" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{t("portfolio")}</label>
            <Input
              type="url"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={() =>
            updateProfile({
              headline,
              summary,
              yearsExperience: yearsOfExperience ? parseInt(yearsOfExperience) : null,
              skills,
              languages: serializeLanguages(languageEntries),
              portfolioUrls: portfolioUrl ? [portfolioUrl] : [],
              resumeUrl: resumeUrl || null,
            })
          }
        >
          {t("save_profile")}
        </Button>
      </div>
    </div>
  );
}
