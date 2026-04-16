"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import {
  type AnalyzedProfile,
  type AnalyzedSearchProfile,
  type AnalyzedQaPair,
  type ComprehensiveAnalysisResult,
} from "@/actions/profile";
import { completeOnboarding, skipOnboarding } from "@/actions/onboarding";
import { submitAiFeedback } from "@/actions/ai-feedback";
import {
  generateResumeRecommendationsForCurrentUser,
  applyRecommendationsForCurrentUser,
  type ResumeRecommendation,
} from "@/actions/resume-recommendations";
import { trackAIEditsBatch } from "@/actions/ai-edit-tracking";
import { ANALYSIS_MESSAGES } from "./types";
import StepUpload from "./step-upload";
import StepAnalysis from "./step-analysis";
import StepReview from "./step-review";
import StepRecommendations from "./step-recommendations";
import StepImprove from "./step-improve";
import StepReady from "./step-ready";

export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");

  const [step, setStep] = useState(1);

  const STEPS = [
    { number: 1, label: t("step_upload") },
    { number: 2, label: t("step_analysis") },
    { number: 3, label: t("step_review") },
    { number: 4, label: t("step_recommendations") },
    { number: 5, label: t("step_improve") },
    { number: 6, label: t("step_ready") },
  ];

  // Shared state — resume
  const [resumeUrl, setResumeUrl] = useState("");
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  // Step 2 state — analysis progress
  const [analysisMessageIndex, setAnalysisMessageIndex] = useState(0);
  const [analysisError, setAnalysisError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3 state — review (shared with parent for save)
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

  // AI edit tracking
  const [aiOriginalProfile, setAiOriginalProfile] = useState<AnalyzedProfile | null>(null);
  const [aiOriginalSearches, setAiOriginalSearches] = useState<AnalyzedSearchProfile[] | null>(null);
  const [aiOriginalQaPairs, setAiOriginalQaPairs] = useState<AnalyzedQaPair[] | null>(null);

  // Step 6 state
  const [saving, setSaving] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  // Russian language helper
  function isRussianLanguage(lang: string): boolean {
    const lower = lang.toLowerCase();
    return lower.startsWith("russian") || lower.startsWith("русский") || lower.startsWith("русский");
  }

  function normalizeLanguageEntry(lang: string): string {
    if (isRussianLanguage(lang)) {
      const name = lang.replace(/\s*\(.*?\)\s*$/, "").trim();
      return `${name} (Want to forget)`;
    }
    return lang;
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (messageRef.current) clearInterval(messageRef.current);
    };
  }, []);

  // --- Step 1 -> 2: Start background analysis ---
  function startAnalysis(url: string) {
    setResumeUrl(url);
    setStep(2);
    setAnalysisError("");
    setAnalysisMessageIndex(0);

    messageRef.current = setInterval(() => {
      setAnalysisMessageIndex((prev) =>
        prev < ANALYSIS_MESSAGES.length - 1 ? prev + 1 : prev
      );
    }, 4000);

    fetch("/api/analyze-resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeUrl: url }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to start analysis");
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
        if (pollRef.current) clearInterval(pollRef.current);
        if (messageRef.current) clearInterval(messageRef.current);

        const result = data.result as ComprehensiveAnalysisResult;
        const normalizedProfile = {
          ...result.profile,
          languages: result.profile.languages.map(normalizeLanguageEntry),
        };
        setProfile(normalizedProfile);
        setSearchProfiles(result.searchProfiles);
        setQaPairs(result.qaPairs);
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

  // --- Skip onboarding entirely ---
  async function handleSkipOnboarding() {
    setSaving(true);
    try {
      const result = await skipOnboarding();
      if (result && "ok" in result && result.ok) {
        router.push("/profile");
      } else if (result && "error" in result) {
        setAnalyzeError(result.error || "Failed to skip onboarding");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : tCommon("error");
      setAnalyzeError(msg);
    } finally {
      setSaving(false);
    }
  }

  // --- Navigation ---
  function goToStep(targetStep: number) {
    if (targetStep === 4 && step === 3) {
      loadRecommendations();
    }
    setStep(targetStep);
  }

  // --- Step 6: Complete onboarding ---
  async function handleComplete() {
    setSaving(true);
    setAnalyzeError("");
    try {
      // Track AI edits before saving
      if (aiOriginalProfile) {
        const edits: { field: string; originalAI: string; userEdited: string; accepted: boolean }[] = [];

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

        trackAIEditsBatch(edits).catch(() => {});
      }

      const result = await completeOnboarding(
        { ...profile, resumeUrl, resumeFilename: uploadedFile || undefined },
        searchProfiles,
        qaPairs
      );

      if (result && "error" in result && result.error) {
        console.error("[onboarding] completeOnboarding error:", result.error);
        setAnalyzeError(result.error);
      } else if (result && "ok" in result && result.ok) {
        router.push("/");
      } else {
        console.error("[onboarding] Unexpected result:", result);
        setAnalyzeError("Unexpected response from server. Please try again.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : tCommon("error");
      console.error("[onboarding] handleComplete exception:", err);
      setAnalyzeError(`Failed to save: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

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
              className={`ml-1 text-[10px] sm:text-xs whitespace-nowrap ${
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
        {step === 1 && (
          <StepUpload
            onAnalysisStart={startAnalysis}
            onSkip={() => setStep(3)}
            onSkipOnboarding={handleSkipOnboarding}
          />
        )}

        {step === 2 && (
          <StepAnalysis
            analysisMessageIndex={analysisMessageIndex}
            analysisError={analysisError}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <StepReview
            profile={profile}
            setProfile={setProfile}
            searchProfiles={searchProfiles}
            setSearchProfiles={setSearchProfiles}
            qaPairs={qaPairs}
            setQaPairs={setQaPairs}
            aiOriginalProfile={aiOriginalProfile}
            aiOriginalSearches={aiOriginalSearches}
            aiOriginalQaPairs={aiOriginalQaPairs}
            analyzeError={analyzeError}
            onBack={() => setStep(1)}
            onNext={() => goToStep(4)}
          />
        )}

        {step === 4 && (
          <StepRecommendations
            recommendations={recommendations}
            recFeedback={recFeedback}
            loadingRecs={loadingRecs}
            applyingRecs={applyingRecs}
            analyzeError={analyzeError}
            onRecFeedback={handleRecFeedback}
            onApplySuggestions={handleApplySuggestions}
            onSkip={() => setStep(6)}
            onBack={() => setStep(3)}
          />
        )}

        {step === 5 && (
          <StepImprove
            originalProfile={originalProfile}
            improvedProfile={improvedProfile}
            onAccept={acceptImprovements}
            onReject={rejectImprovements}
            onBack={() => setStep(4)}
          />
        )}

        {step === 6 && (
          <StepReady
            profile={profile}
            searchProfiles={searchProfiles}
            qaPairs={qaPairs}
            saving={saving}
            analyzeError={analyzeError}
            onComplete={handleComplete}
            onBack={() => setStep(5)}
          />
        )}
      </div>
    </div>
  );
}
