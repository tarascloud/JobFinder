"use client";

import { useState, useEffect, useTransition } from "react";
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
  BookOpen,
  Mail,
  Gauge,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getApplyQueue, approveWithCoverLetter, rejectFromQueue, revertToQueued, markAsManuallyApplied, triggerAutoApply, retryAutoApply } from "@/actions/apply-queue";
import { getApplications, getApplicationRateLimit } from "@/actions/applications";
import AiFeedbackButtons from "@/components/shared/ai-feedback-buttons";
import { CalendarButton } from "@/components/shared/calendar-button";
import { Tooltip } from "@/components/ui/tooltip";

type AppStatus = "queued" | "approved" | "applied" | "applied_manual" | "response" | "interview" | "offer" | "rejected" | "withdrawn" | "pending_qa" | "failed";

const statusColors: Record<string, "yellow" | "blue" | "green" | "purple" | "indigo" | "red"> = {
  queued: "yellow",
  approved: "blue",
  applied: "green",
  applied_manual: "green",
  response: "purple",
  interview: "indigo",
  offer: "green",
  rejected: "red",
  withdrawn: "red",
  pending_qa: "yellow",
  failed: "red",
};

const statusKeys: Record<string, string> = {
  queued: "status_queued",
  approved: "status_approved",
  applied: "status_applied",
  applied_manual: "status_applied_manual",
  response: "status_response",
  interview: "status_interview",
  offer: "status_offer",
  rejected: "status_rejected",
  withdrawn: "status_rejected",
  pending_qa: "status_pending_qa",
  failed: "status_failed",
};

interface QueueItem {
  id: number;
  vacancyId: number;
  status: string;
  coverLetter: string | null;
  createdAt: Date;
  matchScore: number | null;
  vacancy: {
    id: number;
    title: string;
    company: string | null;
    platform: string;
    url: string;
    location: string | null;
    remoteType: string | null;
    salaryText: string | null;
  };
  searchProfile: {
    id: number;
    name: string;
  };
}

interface ApplicationItem {
  id: number;
  status: string;
  coverLetter: string | null;
  appliedAt: Date | null;
  appliedWithPersonalAccount: boolean;
  createdAt: Date;
  errorMessage: string | null;
  applyLog: string | null;
  vacancy: {
    id: number;
    title: string;
    company: string | null;
    platform: string;
    url: string;
    location: string | null;
    remoteType: string | null;
    salaryText: string | null;
  };
  searchProfile: {
    id: number;
    name: string;
  };
}

interface RateLimitInfo {
  used: number;
  limit: number;
  remaining: number;
}

export default function ApplicationsPage() {
  const t = useTranslations("applications");
  const tq = useTranslations("apply_queue");

  const [activeTab, setActiveTab] = useState("queue");
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [appliedItems, setAppliedItems] = useState<ApplicationItem[]>([]);
  const [allItems, setAllItems] = useState<ApplicationItem[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [coverLetters, setCoverLetters] = useState<Record<number, string>>({});
  const [isPending, startTransition] = useTransition();
  const [loadingAction, setLoadingAction] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [autoApplyResult, setAutoApplyResult] = useState<{ id: number; success: boolean; newQuestions?: string[]; error?: string } | null>(null);
  const [batchApplying, setBatchApplying] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; succeeded: number; failed: number } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    startTransition(async () => {
      const [queueResult, appliedResult, appliedManualResult, allResult, rateLimitResult] = await Promise.all([
        getApplyQueue(),
        getApplications({ status: "applied" }),
        getApplications({ status: "applied_manual" }),
        getApplications({}),
        getApplicationRateLimit(),
      ]);

      if ("applications" in queueResult && queueResult.applications) {
        setQueueItems(queueResult.applications as QueueItem[]);
        // Pre-fill cover letters
        const letters: Record<number, string> = {};
        for (const item of queueResult.applications as QueueItem[]) {
          if (item.coverLetter) {
            letters[item.id] = item.coverLetter;
          }
        }
        setCoverLetters((prev) => ({ ...prev, ...letters }));
      }

      if ("applications" in appliedResult && appliedResult.applications) {
        const applied = appliedResult.applications as ApplicationItem[];
        const appliedManual = ("applications" in appliedManualResult && appliedManualResult.applications)
          ? appliedManualResult.applications as ApplicationItem[]
          : [];
        setAppliedItems([...applied, ...appliedManual]);
      }

      if ("applications" in allResult && allResult.applications) {
        setAllItems(allResult.applications as ApplicationItem[]);
      }

      if ("used" in rateLimitResult) {
        setRateLimit(rateLimitResult as RateLimitInfo);
      }
    });
  }

  function toggleExpand(id: number) {
    setExpandedId(expandedId === id ? null : id);
  }

  async function handleApprove(applicationId: number) {
    setLoadingAction(applicationId);
    setError(null);
    try {
      const letter = coverLetters[applicationId] || "";
      const result = await approveWithCoverLetter(applicationId, letter);
      if ("error" in result) {
        setError(result.error as string);
      } else {
        await loadData();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    }
    setLoadingAction(null);
  }

  async function handleUnapprove(applicationId: number) {
    setLoadingAction(applicationId);
    setError(null);
    try {
      const result = await revertToQueued(applicationId);
      if ("error" in result) {
        setError(result.error as string);
      } else {
        await loadData();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revert");
    }
    setLoadingAction(null);
  }

  async function handleReject(applicationId: number) {
    setLoadingAction(applicationId);
    setError(null);
    try {
      const result = await rejectFromQueue(applicationId);
      if ("error" in result) {
        setError(result.error as string);
      } else {
        await loadData();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject");
    }
    setLoadingAction(null);
  }

  async function handleApproveAll() {
    setError(null);
    for (const item of queueItems.filter((q) => q.status === "queued")) {
      const letter = coverLetters[item.id] || item.coverLetter || "";
      const result = await approveWithCoverLetter(item.id, letter);
      if ("error" in result) {
        setError(result.error as string);
        break;
      }
    }
    await loadData();
  }

  async function handleManualApply(applicationId: number, vacancyUrl: string) {
    window.open(vacancyUrl, "_blank", "noopener,noreferrer");
    setLoadingAction(applicationId);
    setError(null);
    try {
      const result = await markAsManuallyApplied(applicationId);
      if ("error" in result) {
        setError(result.error as string);
      } else {
        await loadData();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark as manually applied");
    }
    setLoadingAction(null);
  }

  async function handleAutoApply(applicationId: number) {
    setLoadingAction(applicationId);
    setError(null);
    setAutoApplyResult(null);
    try {
      const result = await triggerAutoApply(applicationId);
      if ("error" in result && !("success" in result)) {
        setError(result.error as string);
      } else if ("success" in result) {
        setAutoApplyResult({
          id: applicationId,
          success: result.success,
          newQuestions: result.newQuestions,
          error: result.error,
        });
        await loadData();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to auto apply");
    }
    setLoadingAction(null);
  }

  async function handleRetry(applicationId: number) {
    setLoadingAction(applicationId);
    setError(null);
    setAutoApplyResult(null);
    try {
      const result = await retryAutoApply(applicationId);
      if ("error" in result && !("success" in result)) {
        setError(result.error as string);
      } else if ("success" in result) {
        setAutoApplyResult({
          id: applicationId,
          success: result.success,
          newQuestions: result.newQuestions,
          error: result.error,
        });
        await loadData();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to retry apply");
    }
    setLoadingAction(null);
  }

  async function handleAutoApplyAllApproved() {
    const approved = queueItems.filter((q) => q.status === "approved");
    if (approved.length === 0) return;

    setBatchApplying(true);
    setBatchProgress({ done: 0, total: approved.length, succeeded: 0, failed: 0 });
    setError(null);

    let succeeded = 0;
    let failed = 0;

    for (const item of approved) {
      try {
        const result = await triggerAutoApply(item.id);
        if ("success" in result && result.success) {
          succeeded++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      setBatchProgress({ done: succeeded + failed, total: approved.length, succeeded, failed });
    }

    await loadData();
    setBatchApplying(false);
  }

  function scoreColor(score: number | null) {
    if (!score) return "text-muted-foreground";
    if (score >= 90) return "text-green-400";
    if (score >= 75) return "text-primary";
    return "text-muted-foreground";
  }

  // Compute pipeline stats
  const pipelineStats = {
    queued: queueItems.filter(q => q.status === "queued").length,
    approved: queueItems.filter(q => q.status === "approved").length,
    applied: appliedItems.length,
    interview: allItems.filter(a => a.status === "interview").length,
    offer: allItems.filter(a => a.status === "offer").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tq("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {allItems.length > 0 ? `${allItems.length} total applications` : "Manage your application pipeline"}
          </p>
        </div>
        {rateLimit && (
          <div className="flex items-center gap-2 text-sm">
            <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${
              rateLimit.remaining === 0 ? "bg-red-500/10 text-red-400" : "bg-muted text-muted-foreground"
            }`}>
              <Gauge className="h-4 w-4" />
              <span className={rateLimit.remaining === 0 ? "font-medium" : ""}>
                {t("rate_limit_status", { used: rateLimit.used, limit: rateLimit.limit })}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Pipeline summary stats */}
      {allItems.length > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Queued", value: pipelineStats.queued, color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
            { label: "Approved", value: pipelineStats.approved, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
            { label: "Applied", value: pipelineStats.applied, color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" },
            { label: "Interview", value: pipelineStats.interview, color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
            { label: "Offer", value: pipelineStats.offer, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
          ].map(stat => (
            <div key={stat.label} className={`rounded-xl border p-3 text-center ${stat.color}`}>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-[11px] font-medium uppercase tracking-wider mt-0.5 opacity-80">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-900/30 border border-red-700/40 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="queue">
            {tq("queue_tab")}
            {queueItems.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-1.5 text-[11px] font-bold">
                {queueItems.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="applied">
            {tq("applied_tab")}
            {appliedItems.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 text-[11px] font-bold">
                {appliedItems.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">
            {tq("all_tab")}
            {allItems.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-muted text-muted-foreground px-1.5 text-[11px] font-bold">
                {allItems.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Queue Tab */}
        <TabsContent value="queue">
          {queueItems.length === 0 ? (
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
          ) : (
            <div className="space-y-4">
              {/* Bulk actions */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {queueItems.length} {queueItems.length === 1 ? "item" : "items"}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleApproveAll}
                    disabled={isPending || batchApplying}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {tq("approve_all")}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleAutoApplyAllApproved}
                    disabled={isPending || batchApplying || queueItems.filter((q) => q.status === "approved").length === 0}
                  >
                    {batchApplying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {tq("auto_apply_all_approved")}
                  </Button>
                </div>
              </div>

              {/* Batch auto-apply progress */}
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
                    {/* Main row */}
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
                            <span className={`font-bold ${scoreColor(item.matchScore)}`}>
                              {item.matchScore}%
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(item.id)}
                          title={tq("edit_cover_letter")}
                        >
                          {expandedId === item.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        {item.status === "approved" ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleUnapprove(item.id)}
                            disabled={loadingAction === item.id}
                          >
                            {loadingAction === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            {tq("cancel_approve")}
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApprove(item.id)}
                            disabled={loadingAction === item.id}
                          >
                            {loadingAction === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            {tq("approve")}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReject(item.id)}
                          disabled={loadingAction === item.id}
                        >
                          <XCircle className="h-4 w-4" />
                          {tq("reject")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManualApply(item.id, item.vacancy.url)}
                          disabled={loadingAction === item.id}
                        >
                          {loadingAction === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ExternalLink className="h-4 w-4" />
                          )}
                          {tq("apply_manual")}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleAutoApply(item.id)}
                          disabled={loadingAction === item.id}
                        >
                          {loadingAction === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          {tq("auto_apply")}
                        </Button>
                      </div>
                    </div>

                    {/* Auto apply result banner */}
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
                            <Link
                              href="/qa"
                              className="inline-flex items-center gap-1 text-sm font-medium text-yellow-300 hover:text-yellow-200"
                            >
                              {tq("new_questions_banner", { count: autoApplyResult.newQuestions.length })}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expandable cover letter editor */}
                    {expandedId === item.id && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="block text-sm font-medium text-foreground/80">
                            {tq("cover_letter")}
                          </label>
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
                          onChange={(e) =>
                            setCoverLetters((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          rows={8}
                          className="mb-3"
                        />
                        <div className="flex items-center gap-2">
                          {item.status === "approved" ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleUnapprove(item.id)}
                              disabled={loadingAction === item.id}
                            >
                              {loadingAction === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                              {tq("cancel_approve")}
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleApprove(item.id)}
                              disabled={loadingAction === item.id}
                            >
                              {loadingAction === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              {tq("approve")}
                            </Button>
                          )}
                          <a
                            href={item.vacancy.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                          >
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
          )}
        </TabsContent>

        {/* Applied Tab */}
        <TabsContent value="applied">
          {appliedItems.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 px-6 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1.5">{t("no_applications")}</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Approve queued applications and they will appear here after applying
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-2.5 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                <div className="col-span-4">Position</div>
                <div className="col-span-3">Company</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-2 text-center">Applied</div>
                <div className="col-span-1" />
              </div>

              {appliedItems.map((app) => (
                <Card key={app.id} className="transition-all hover:shadow-sm hover:border-primary/15">
                  <CardContent className="p-4 sm:p-5">
                    {app.appliedWithPersonalAccount && (
                      <div className="mb-2 flex items-center gap-2 rounded-md bg-yellow-900/30 border border-yellow-700/40 px-3 py-1.5 text-xs text-yellow-300">
                        <span>⚠️</span>
                        {t("personal_account_warning")}
                      </div>
                    )}
                    <div className="md:grid md:grid-cols-12 md:gap-4 md:items-center space-y-2 md:space-y-0">
                      <div className="col-span-4">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/vacancies/${app.vacancy.id}`}
                            className="font-medium text-foreground hover:text-primary transition-colors"
                          >
                            {app.vacancy.title}
                          </Link>
                          <a
                            href={app.vacancy.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                      <div className="col-span-3">
                        <span className="text-sm text-muted-foreground">{app.vacancy.company}</span>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="inline-flex items-center gap-1">
                          <Badge color={statusColors[app.status] || "yellow"}>
                            {t(statusKeys[app.status] || "status_applied")}
                          </Badge>
                          {app.appliedWithPersonalAccount && (
                            <Tooltip content={t("personal_account_tooltip")} side="top">
                              <span className="text-yellow-400 text-xs cursor-help">⚠️</span>
                            </Tooltip>
                          )}
                        </span>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="text-sm text-muted-foreground">
                          {app.appliedAt
                            ? new Date(app.appliedAt).toLocaleDateString()
                            : new Date(app.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="col-span-1 text-right flex items-center justify-end gap-1">
                        {(app.status === "pending_qa" || app.status === "failed") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetry(app.id)}
                            disabled={loadingAction === app.id}
                            title={t("retry")}
                            className="h-7 w-7 p-0"
                          >
                            {loadingAction === app.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManualApply(app.id, app.vacancy.url)}
                          disabled={loadingAction === app.id}
                          title={tq("apply_manual")}
                          className="h-7 w-7 p-0"
                        >
                          {loadingAction === app.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ExternalLink className="h-4 w-4" />
                          )}
                        </Button>
                        {(app.status === "applied" || app.status === "applied_manual" || app.status === "interview") && (
                          <Link
                            href={`/applications/${app.id}/email`}
                            className="text-sm text-green-400 hover:text-green-300"
                            title={t("follow_up")}
                          >
                            <Mail className="h-4 w-4 inline" />
                          </Link>
                        )}
                      </div>
                    </div>
                    {app.status === "failed" && (app.errorMessage || app.applyLog) && (
                      <div className="mt-2 rounded-md bg-red-900/30 border border-red-700/40 px-3 py-2 text-xs text-red-300">
                        <span className="font-medium">{t("failed_reason")}:</span>{" "}
                        {app.errorMessage || app.applyLog}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* All Tab */}
        <TabsContent value="all">
          {allItems.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 px-6 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <Send className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1.5">{t("no_applications")}</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Start by queuing vacancies and approving them for application
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-2.5 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                <div className="col-span-4">Position</div>
                <div className="col-span-3">Company</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-2 text-center">Date</div>
                <div className="col-span-1" />
              </div>

              {allItems.map((app) => (
                <Card key={app.id} className="transition-all hover:shadow-sm hover:border-primary/15">
                  <CardContent className="p-4 sm:p-5">
                    {app.appliedWithPersonalAccount && (
                      <div className="mb-2 flex items-center gap-2 rounded-md bg-yellow-900/30 border border-yellow-700/40 px-3 py-1.5 text-xs text-yellow-300">
                        <span>⚠️</span>
                        {t("personal_account_warning")}
                      </div>
                    )}
                    <div className="md:grid md:grid-cols-12 md:gap-4 md:items-center space-y-2 md:space-y-0">
                      <div className="col-span-4">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/vacancies/${app.vacancy.id}`}
                            className="font-medium text-foreground hover:text-primary transition-colors"
                          >
                            {app.vacancy.title}
                          </Link>
                          <a
                            href={app.vacancy.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                      <div className="col-span-3">
                        <span className="text-sm text-muted-foreground">{app.vacancy.company}</span>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="inline-flex items-center gap-1">
                          <Badge color={statusColors[app.status] || "yellow"}>
                            {t(statusKeys[app.status] || "status_queued")}
                          </Badge>
                          {app.appliedWithPersonalAccount && (
                            <Tooltip content={t("personal_account_tooltip")} side="top">
                              <span className="text-yellow-400 text-xs cursor-help">⚠️</span>
                            </Tooltip>
                          )}
                        </span>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="text-sm text-muted-foreground">
                          {new Date(app.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="col-span-1 text-right flex items-center justify-end gap-1">
                        {(app.status === "pending_qa" || app.status === "failed") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetry(app.id)}
                            disabled={loadingAction === app.id}
                            title={t("retry")}
                            className="h-7 w-7 p-0"
                          >
                            {loadingAction === app.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManualApply(app.id, app.vacancy.url)}
                          disabled={loadingAction === app.id}
                          title={tq("apply_manual")}
                          className="h-7 w-7 p-0"
                        >
                          {loadingAction === app.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ExternalLink className="h-4 w-4" />
                          )}
                        </Button>
                        {(app.status === "applied" || app.status === "applied_manual" || app.status === "interview") && (
                          <Link
                            href={`/applications/${app.id}/email`}
                            className="text-sm text-green-400 hover:text-green-300"
                            title={t("follow_up")}
                          >
                            <Mail className="h-4 w-4 inline" />
                          </Link>
                        )}
                        {app.status === "interview" && (
                          <>
                            <Link
                              href={`/applications/${app.id}/prep`}
                              className="text-sm text-indigo-400 hover:text-indigo-300"
                              title={t("prepare")}
                            >
                              <BookOpen className="h-4 w-4 inline" />
                            </Link>
                            <CalendarButton applicationId={app.id} />
                          </>
                        )}
                      </div>
                    </div>
                    {app.status === "failed" && (app.errorMessage || app.applyLog) && (
                      <div className="mt-2 rounded-md bg-red-900/30 border border-red-700/40 px-3 py-2 text-xs text-red-300">
                        <span className="font-medium">{t("failed_reason")}:</span>{" "}
                        {app.errorMessage || app.applyLog}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
