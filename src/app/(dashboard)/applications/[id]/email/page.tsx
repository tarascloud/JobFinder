"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Mail,
  Send,
  MessageSquare,
  Heart,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateFollowUp } from "@/actions/email-templates";

type FollowUpType =
  | "after_apply"
  | "after_interview"
  | "thank_you"
  | "check_status";

const typeIcons: Record<FollowUpType, typeof Send> = {
  after_apply: Send,
  after_interview: MessageSquare,
  thank_you: Heart,
  check_status: Clock,
};

export default function EmailTemplatePage() {
  const params = useParams();
  const applicationId = Number(params.id);
  const t = useTranslations("email_templates");
  const tCommon = useTranslations("common");

  const [selectedType, setSelectedType] = useState<FollowUpType>("after_apply");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const templateTypes: { type: FollowUpType; key: string }[] = [
    { type: "after_apply", key: "type_after_apply" },
    { type: "after_interview", key: "type_after_interview" },
    { type: "thank_you", key: "type_thank_you" },
    { type: "check_status", key: "type_check_status" },
  ];

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    setCopied(false);
    const result = await generateFollowUp(applicationId, selectedType);
    if ("error" in result) {
      setError(result.error);
    } else {
      setSubject(result.subject);
      setBody(result.body);
    }
    setIsGenerating(false);
  }

  async function handleCopy() {
    const text = `Subject: ${subject}\n\n${body}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Auto-generate on first load
  useEffect(() => {
    if (applicationId && !isNaN(applicationId)) {
      handleGenerate();
    }
  }, []);

  return (
    <div className="space-y-6">
      <Link
        href="/applications"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tCommon("back")}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {/* Template Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {templateTypes.map(({ type, key }) => {
          const Icon = typeIcons[type];
          return (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
                selectedType === type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm font-medium text-center">
                {t(key)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Generate Button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("generating")}
            </>
          ) : subject ? (
            <>
              <RefreshCw className="h-4 w-4" />
              {t("regenerate")}
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" />
              {t("generate")}
            </>
          )}
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4">
            <p className="text-red-400 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Email Preview */}
      {(subject || body) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {t("preview")}
              </CardTitle>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    {t("copied")}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    {t("copy")}
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("subject_label")}
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("body_label")}
              </label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                className="text-sm"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {!subject && !body && !isGenerating && !error && (
        <Card>
          <CardContent className="p-12 text-center">
            <Mail className="h-12 w-12 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-muted-foreground text-lg">{t("no_email")}</p>
            <p className="text-muted-foreground text-sm mt-2">
              {t("no_email_hint")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
