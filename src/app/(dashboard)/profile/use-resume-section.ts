"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  type AnalyzedProfile,
  type AnalyzedSearchProfile,
  type AnalyzedQaPair,
  getAnalysisStatus,
  clearAnalysisStatus,
} from "@/actions/profile";
import { createSearchProfile } from "@/actions/search-profiles";
import {
  generateResumeRecommendationsForCurrentUser,
  applyRecommendationsForCurrentUser,
  type ResumeRecommendation,
} from "@/actions/resume-recommendations";
import { submitAiFeedback } from "@/actions/ai-feedback";

export interface ReanalysisResult {
  profile: AnalyzedProfile;
  searchProfiles: AnalyzedSearchProfile[];
  qaPairs: AnalyzedQaPair[];
}

export type AnalysisPhase = "idle" | "uploading" | "upload_done" | "analyzing" | "done" | "error";

export interface UseResumeSectionParams {
  setResumeUrl: (url: string) => void;
  setResumeFilename: (name: string) => void;
  onAcceptChange: (field: string, profile: AnalyzedProfile) => void;
  onAcceptAllChanges: (profile: AnalyzedProfile) => void;
  headline: string;
  summary: string;
  yearsOfExperience: string;
  skills: string[];
  serializedLanguages: string[];
  portfolioUrl: string;
}

export function useResumeSection(params: UseResumeSectionParams) {
  const {
    setResumeUrl,
    setResumeFilename,
    onAcceptChange,
    onAcceptAllChanges,
    headline,
    summary,
    yearsOfExperience,
    skills,
    serializedLanguages,
    portfolioUrl,
  } = params;
  const t = useTranslations("profile");

  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>("idle");
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [reanalysisResult, setReanalysisResult] = useState<ReanalysisResult | null>(null);
  const [acceptedChanges, setAcceptedChanges] = useState<Set<string>>(new Set());

  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState<ResumeRecommendation[]>([]);
  const [recFeedback, setRecFeedback] = useState<Record<string, "like" | "dislike">>({});
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [applyingRecs, setApplyingRecs] = useState(false);
  const [improvedProfile, setImprovedProfile] = useState<AnalyzedProfile | null>(null);
  const [showImprovePanel, setShowImprovePanel] = useState(false);

  const [resumeUrlInput, setResumeUrlInput] = useState("");
  const [showResumeUpload, setShowResumeUpload] = useState(false);

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
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
        await clearAnalysisStatus();
      } else if (status.status === "error") {
        setAnalyzeError(status.error || "Analysis failed");
        setAnalysisPhase("error");
        await clearAnalysisStatus();
      }
    } catch {
      // ignore -- first visit or no profile yet
    }
  }

  useEffect(() => {
    checkExistingAnalysis();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (analysisPhase !== "uploading") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [analysisPhase]);

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
      setResumeFilename(file.name);
      setShowResumeUpload(false);
      setAnalysisPhase("upload_done");
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
        return JSON.stringify(p.languages.sort()) !== JSON.stringify([...serializedLanguages].sort());
      case "portfolioUrls":
        return JSON.stringify(p.portfolioUrls) !== JSON.stringify(portfolioUrl ? [portfolioUrl] : []);
      default:
        return false;
    }
  }

  function acceptChange(field: string) {
    if (!reanalysisResult) return;
    setAcceptedChanges((prev) => new Set(prev).add(field));
    onAcceptChange(field, reanalysisResult.profile);
  }

  function acceptAllChanges() {
    if (!reanalysisResult) return;
    onAcceptAllChanges(reanalysisResult.profile);
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
    onAcceptAllChanges(improvedProfile);
    setShowImprovePanel(false);
    setImprovedProfile(null);
  }

  function dismissProfileImprovements() {
    setShowImprovePanel(false);
    setImprovedProfile(null);
  }

  return {
    analysisPhase,
    uploadedFile,
    analyzeError,
    reanalysisResult,
    acceptedChanges,
    showRecommendations,
    recommendations,
    recFeedback,
    loadingRecs,
    applyingRecs,
    improvedProfile,
    showImprovePanel,
    resumeUrlInput,
    showResumeUpload,
    setResumeUrlInput,
    setShowResumeUpload,
    setShowRecommendations,
    handleFileUpload,
    handleUrlAnalyze,
    hasChanged,
    acceptChange,
    acceptAllChanges,
    acceptSearchProfiles,
    dismissReanalysis,
    loadProfileRecommendations,
    handleProfileRecFeedback,
    handleApplyProfileSuggestions,
    acceptProfileImprovements,
    dismissProfileImprovements,
  };
}
