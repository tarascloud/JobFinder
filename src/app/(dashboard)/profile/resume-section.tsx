"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { type AnalyzedProfile } from "@/actions/profile";
import { ResumeUploadCard } from "./resume-upload-card";
import { ReanalysisDiffPanel } from "./reanalysis-diff-panel";
import { ResumeRecommendationsPanel } from "./resume-recommendations-panel";
import { ResumeImprovementPanel } from "./resume-improvement-panel";
import { useResumeSection } from "./use-resume-section";

interface ResumeSectionProps {
  resumeUrl: string;
  setResumeUrl: (url: string) => void;
  resumeFilename: string;
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

export default function ResumeSection({
  resumeUrl,
  setResumeUrl,
  resumeFilename,
  setResumeFilename,
  onAcceptChange,
  onAcceptAllChanges,
  headline,
  summary,
  yearsOfExperience,
  skills,
  serializedLanguages,
  portfolioUrl,
}: ResumeSectionProps) {
  const t = useTranslations("profile");
  const {
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
  } = useResumeSection({
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
  });

  return (
    <>
      {analysisPhase === "analyzing" && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <Loader2 className="h-5 w-5 text-amber-400 animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">{t("bg_analyzing")}</p>
            <p className="text-xs text-muted-foreground">{t("bg_analyzing_desc")}</p>
          </div>
        </div>
      )}

      <ResumeUploadCard
        resumeUrl={resumeUrl}
        resumeFilename={resumeFilename}
        analysisPhase={analysisPhase}
        uploadedFile={uploadedFile}
        analyzeError={analyzeError}
        resumeUrlInput={resumeUrlInput}
        showResumeUpload={showResumeUpload}
        setResumeUrlInput={setResumeUrlInput}
        setShowResumeUpload={setShowResumeUpload}
        onFileUpload={handleFileUpload}
        onUrlAnalyze={handleUrlAnalyze}
      />

      {reanalysisResult && (
        <ReanalysisDiffPanel
          reanalysisResult={reanalysisResult}
          acceptedChanges={acceptedChanges}
          onAcceptChange={acceptChange}
          onAcceptAll={acceptAllChanges}
          onAcceptSearchProfiles={acceptSearchProfiles}
          onDismiss={dismissReanalysis}
          onLoadRecommendations={loadProfileRecommendations}
          hasChanged={hasChanged}
        />
      )}

      {showRecommendations && (
        <ResumeRecommendationsPanel
          recommendations={recommendations}
          recFeedback={recFeedback}
          loadingRecs={loadingRecs}
          applyingRecs={applyingRecs}
          onFeedback={handleProfileRecFeedback}
          onApply={handleApplyProfileSuggestions}
          onDismiss={() => setShowRecommendations(false)}
        />
      )}

      {showImprovePanel && improvedProfile && (
        <ResumeImprovementPanel
          improvedProfile={improvedProfile}
          headline={headline}
          summary={summary}
          onAccept={acceptProfileImprovements}
          onDismiss={dismissProfileImprovements}
        />
      )}
    </>
  );
}
