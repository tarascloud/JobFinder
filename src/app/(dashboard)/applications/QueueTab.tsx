"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Send,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import AiFeedbackButtons from "@/components/shared/ai-feedback-buttons";
import { statusColors, statusKeys, scoreColor, type QueueItem } from "./types";

interface QueueTabProps {
  queueItems: QueueItem[];
  expandedId: number | null;
  toggleExpand: (id: number) => void;
  coverLetters: Record<number, string>;
  setCoverLetters: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  loadingAction: number | null;
  isPending: boolean;
  batchApplying: boolean;
  batchProgress: { done: number; total: number; succeeded: number; failed: number } | null;
  autoApplyResult: { id: number; success: boolean; newQuestions?: string[]; error?: string } | null;
  onApprove: (id: number) => void;
  onUnapprove: (id: number) => void;
  onReject: (id: number) => void;
  onApproveAll: () => void;
  onManualApply: (id: number, url: string) => void;
  onAutoApply: (id: number) => void;
  onAutoApplyAllApproved: () => void;
}

export function QueueTab({
  queueItems,
  expandedId,
  toggleExpand,
  coverLetters,
  setCoverLetters,
  loadingAction,
  isPending,
  batchApplying,
  batchProgress,
  autoApplyResult,
  onApprove,
  onUnapprove,
  onReject,
  onApproveAll,
  onManualApply,
  onAutoApply,
  onAutoApplyAllApproved,
}: QueueTabProps) {
  const t = useTranslations("applications");
  const tq = useTranslations("apply_queue");

  if (queueItems.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 px-6 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Send className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1.5">{tq("no_queued")}</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Go to Vacancies to find and queue jobs for application
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {queueItems.length} {queueItems.length === 1 ? "item" : "items"}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onApproveAll} disabled={isPending || batchApplying}>
            <CheckCircle2 className="h-4 w-4" />
            {tq("approve_all")}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onAutoApplyAllApproved}
            disabled={isPending || batchApplying || queueItems.filter((q) => q.status === "approved").length === 0}
          >
            {batchApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {tq("auto_apply_all_approved")}
          </Button>
        </div>
      </div>

      {/* Batch progress */}
      {batchProgress && (
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {tq("batch_progress", { done: batchProgress.done, total: batchProgress.total })}
            </span>
            <span className="text-sm">
              <span className="text-green-400">{batchProgress.succeeded} {tq("batch_succeeded")}</span>
              {batchProgress.failed > 0 && (
                <span className="text-red-400 ml-2">{batchProgress.failed} {tq("batch_failed")}</span>
              )}
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${batchProgress.total > 0 ? (batchProgress.done / batchProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {queueItems.map((item) => (
        <Card key={item.id} className={`overflow-hidden transition-all hover:shadow-sm ${
          item.status === "approved" ? "border-l-3 border-l-blue-500" : ""
        }`}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <Link
                    href={`/vacancies/${item.vacancy.id}`}
                    className="font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    {item.vacancy.title}
                  </Link>
                  <a
                    href={item.vacancy.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <Badge color={statusColors[item.status] || "yellow"}>
                    {t(statusKeys[item.status] || "status_queued")}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {item.vacancy.company && <span className="font-medium">{item.vacancy.company}</span>}
                  <span className="text-muted-foreground/60">{item.vacancy.platform}</span>
                  {item.vacancy.salaryText && (
                    <span className="text-green-600 dark:text-green-400 font-medium">{item.vacancy.salaryText}</span>
                  )}
                  {item.matchScore !== null && (
                    <span className={`font-bold ${scoreColor(item.matchScore)}`}>{item.matchScore}%</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => toggleExpand(item.id)} title={tq("edit_cover_letter")}>
                  {expandedId === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                {item.status === "approved" ? (
                  <Button variant="secondary" size="sm" onClick={() => onUnapprove(item.id)} disabled={loadingAction === item.id}>
                    {loadingAction === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    {tq("cancel_approve")}
                  </Button>
                ) : (
                  <Button variant="default" size="sm" onClick={() => onApprove(item.id)} disabled={loadingAction === item.id}>
                    {loadingAction === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {tq("approve")}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => onReject(item.id)} disabled={loadingAction === item.id}>
                  <XCircle className="h-4 w-4" />
                  {tq("reject")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => onManualApply(item.id, item.vacancy.url)} disabled={loadingAction === item.id}>
                  {loadingAction === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  {tq("apply_manual")}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onAutoApply(item.id)} disabled={loadingAction === item.id}>
                  {loadingAction === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {tq("auto_apply")}
                </Button>
              </div>
            </div>

            {autoApplyResult && autoApplyResult.id === item.id && (
              <div className={`mt-3 rounded-md px-4 py-2 text-sm ${
                autoApplyResult.success
                  ? "bg-green-900/30 border border-green-700/40 text-green-300"
                  : "bg-red-900/30 border border-red-700/40 text-red-300"
              }`}>
                {autoApplyResult.success
                  ? tq("auto_apply_success")
                  : tq("auto_apply_failed", { error: autoApplyResult.error || "Unknown error" })}
                {autoApplyResult.newQuestions && autoApplyResult.newQuestions.length > 0 && (
                  <div className="mt-2">
                    <Link href="/qa" className="inline-flex items-center gap-1 text-sm font-medium text-yellow-300 hover:text-yellow-200">
                      {tq("new_questions_banner", { count: autoApplyResult.newQuestions.length })}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
            )}

            {expandedId === item.id && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-foreground/80">{tq("cover_letter")}</label>
                  {item.coverLetter && (
                    <AiFeedbackButtons
                      field="cover_letter"
                      content={item.coverLetter}
                      context={`${item.vacancy.title} at ${item.vacancy.company || "Unknown"}`}
                    />
                  )}
                </div>
                <Textarea
                  value={coverLetters[item.id] ?? item.coverLetter ?? ""}
                  onChange={(e) => setCoverLetters((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  rows={8}
                  className="mb-3"
                />
                <div className="flex items-center gap-2">
                  {item.status === "approved" ? (
                    <Button variant="secondary" size="sm" onClick={() => onUnapprove(item.id)} disabled={loadingAction === item.id}>
                      {loadingAction === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      {tq("cancel_approve")}
                    </Button>
                  ) : (
                    <Button variant="default" size="sm" onClick={() => onApprove(item.id)} disabled={loadingAction === item.id}>
                      {loadingAction === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {tq("approve")}
                    </Button>
                  )}
                  <a href={item.vacancy.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80">
                    <ExternalLink className="h-3 w-3" />
                    Original
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
