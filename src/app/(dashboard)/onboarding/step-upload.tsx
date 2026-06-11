"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Upload,
  Loader2,
  Sparkles,
  FileText,
  Link,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { AIModel } from "./types";
import { FormError } from "@/components/shared/form-error";

interface StepUploadProps {
  onAnalysisStart: (url: string) => void;
  onSkip: () => void;
  onSkipOnboarding: () => void;
}

export default function StepUpload({ onAnalysisStart, onSkip, onSkipOnboarding }: StepUploadProps) {
  const t = useTranslations("onboarding");
  const tProfile = useTranslations("profile");

  const [aiModel, setAiModel] = useState<AIModel>("groq");
  const [resumeUrlInput, setResumeUrlInput] = useState("");
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setIsUploading(false);
      onAnalysisStart(data.url);
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
    onAnalysisStart(resumeUrlInput.trim());
  }

  return (
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
            <option value="groq">Groq (Recommended)</option>
            <option value="gemini">Gemini Flash</option>
            <option value="ollama">Ollama (Local)</option>
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

        <FormError>{analyzeError}</FormError>

        <Button
          variant="ghost"
          onClick={onSkip}
          className="w-full text-muted-foreground"
        >
          {t("skip_manual")}
        </Button>

        <div className="border-t border-border pt-4 mt-2">
          <Button
            variant="link"
            onClick={onSkipOnboarding}
            className="w-full text-muted-foreground/60 text-xs hover:text-muted-foreground"
          >
            {t("skip_onboarding")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
