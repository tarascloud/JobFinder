"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  Link,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type AnalysisPhase = "idle" | "uploading" | "upload_done" | "analyzing" | "done" | "error";

interface ResumeUploadCardProps {
  resumeUrl: string;
  resumeFilename: string;
  analysisPhase: AnalysisPhase;
  uploadedFile: string | null;
  analyzeError: string | null;
  resumeUrlInput: string;
  showResumeUpload: boolean;
  setResumeUrlInput: (val: string) => void;
  setShowResumeUpload: (val: boolean) => void;
  onFileUpload: (file: File) => void;
  onUrlAnalyze: () => void;
}

export function ResumeUploadCard({
  resumeUrl,
  resumeFilename,
  analysisPhase,
  uploadedFile,
  analyzeError,
  resumeUrlInput,
  showResumeUpload,
  setResumeUrlInput,
  setShowResumeUpload,
  onFileUpload,
  onUrlAnalyze,
}: ResumeUploadCardProps) {
  const t = useTranslations("profile");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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
      if (file) onFileUpload(file);
    },
    [onFileUpload]
  );

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileUpload(file);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t("upload_resume")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(resumeUrl || resumeFilename) && !showResumeUpload && (analysisPhase === "idle" || analysisPhase === "done") ? (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {resumeFilename || (() => {
                  const segment = (resumeUrl || "").split("/").pop() || "";
                  try { return decodeURIComponent(segment); } catch { return segment; }
                })()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("current_resume")}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResumeUpload(true)}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              {t("change_resume")}
            </Button>
          </div>
        ) : (
          <>
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
                onClick={onUrlAnalyze}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
