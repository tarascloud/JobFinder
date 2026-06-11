"use client";

import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Send,
  CheckCircle2,
  Gauge,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { EmptyState } from "@/components/EmptyState";
import { getApplyQueue, approveWithCoverLetter, rejectFromQueue, revertToQueued, markAsManuallyApplied, triggerAutoApply, retryAutoApply } from "@/actions/apply-queue";
import { getApplications, getApplicationRateLimit } from "@/actions/applications";
import { ApplicationPipeline } from "./ApplicationPipeline";
import { ApplicationCard } from "./ApplicationCard";
import { QueueTab } from "./QueueTab";
import { type QueueItem, type ApplicationItem, type RateLimitInfo } from "./types";

export function ApplicationsList() {
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
  const [initialLoaded, setInitialLoaded] = useState(false);

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
        const letters: Record<number, string> = {};
        for (const item of queueResult.applications as QueueItem[]) {
          if (item.coverLetter) letters[item.id] = item.coverLetter;
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
      setInitialLoaded(true);
    });
  }

  async function handleApprove(id: number) {
    setLoadingAction(id);
    setError(null);
    try {
      const result = await approveWithCoverLetter(id, coverLetters[id] || "");
      if ("error" in result) setError(result.error as string);
      else await loadData();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to approve"); }
    setLoadingAction(null);
  }

  async function handleUnapprove(id: number) {
    setLoadingAction(id);
    setError(null);
    try {
      const result = await revertToQueued(id);
      if ("error" in result) setError(result.error as string);
      else await loadData();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to revert"); }
    setLoadingAction(null);
  }

  async function handleReject(id: number) {
    setLoadingAction(id);
    setError(null);
    try {
      const result = await rejectFromQueue(id);
      if ("error" in result) setError(result.error as string);
      else await loadData();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to reject"); }
    setLoadingAction(null);
  }

  async function handleApproveAll() {
    setError(null);
    for (const item of queueItems.filter((q) => q.status === "queued")) {
      const result = await approveWithCoverLetter(item.id, coverLetters[item.id] || item.coverLetter || "");
      if ("error" in result) { setError(result.error as string); break; }
    }
    await loadData();
  }

  async function handleManualApply(id: number, url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
    setLoadingAction(id);
    setError(null);
    try {
      const result = await markAsManuallyApplied(id);
      if ("error" in result) setError(result.error as string);
      else await loadData();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    setLoadingAction(null);
  }

  async function handleAutoApply(id: number) {
    setLoadingAction(id);
    setError(null);
    setAutoApplyResult(null);
    try {
      const result = await triggerAutoApply(id);
      if ("error" in result && !("success" in result)) setError(result.error as string);
      else if ("success" in result) {
        setAutoApplyResult({ id, success: result.success, newQuestions: result.newQuestions, error: result.error });
        await loadData();
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    setLoadingAction(null);
  }

  async function handleRetry(id: number) {
    setLoadingAction(id);
    setError(null);
    setAutoApplyResult(null);
    try {
      const result = await retryAutoApply(id);
      if ("error" in result && !("success" in result)) setError(result.error as string);
      else if ("success" in result) {
        setAutoApplyResult({ id, success: result.success, newQuestions: result.newQuestions, error: result.error });
        await loadData();
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    setLoadingAction(null);
  }

  async function handleAutoApplyAllApproved() {
    const approved = queueItems.filter((q) => q.status === "approved");
    if (approved.length === 0) return;
    setBatchApplying(true);
    setBatchProgress({ done: 0, total: approved.length, succeeded: 0, failed: 0 });
    setError(null);
    let succeeded = 0, failed = 0;
    for (const item of approved) {
      try {
        const result = await triggerAutoApply(item.id);
        if ("success" in result && result.success) succeeded++;
        else failed++;
      } catch { failed++; }
      setBatchProgress({ done: succeeded + failed, total: approved.length, succeeded, failed });
    }
    await loadData();
    setBatchApplying(false);
  }

  const pipelineStats = {
    queued: queueItems.filter(q => q.status === "queued").length,
    approved: queueItems.filter(q => q.status === "approved").length,
    applied: appliedItems.length,
    interview: allItems.filter(a => a.status === "interview").length,
    offer: allItems.filter(a => a.status === "offer").length,
  };

  if (!initialLoaded) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tq("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("loading")}</p>
        </div>
        <ListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tq("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {allItems.length > 0 ? t("total_applications", { count: allItems.length }) : t("subtitle")}
          </p>
        </div>
        {rateLimit && (
          <div className="flex items-center gap-2 text-sm">
            <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${
              rateLimit.remaining === 0 ? "bg-status-error/10 text-status-error" : "bg-muted text-muted-foreground"
            }`}>
              <Gauge className="h-4 w-4" />
              <span className={rateLimit.remaining === 0 ? "font-medium" : ""}>
                {t("rate_limit_status", { used: rateLimit.used, limit: rateLimit.limit })}
              </span>
            </div>
          </div>
        )}
      </div>

      {allItems.length > 0 && <ApplicationPipeline stats={pipelineStats} />}

      {error && (
        <div className="rounded-md bg-status-error/10 border border-status-error/30 px-4 py-2 text-sm text-status-error">{error}</div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="queue">
            {tq("queue_tab")}
            {queueItems.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-status-warning/20 text-status-warning px-1.5 text-[11px] font-bold">
                {queueItems.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="applied">
            {tq("applied_tab")}
            {appliedItems.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-status-success/20 text-status-success px-1.5 text-[11px] font-bold">
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

        <TabsContent value="queue">
          <QueueTab
            queueItems={queueItems}
            expandedId={expandedId}
            toggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
            coverLetters={coverLetters}
            setCoverLetters={setCoverLetters}
            loadingAction={loadingAction}
            isPending={isPending}
            batchApplying={batchApplying}
            batchProgress={batchProgress}
            autoApplyResult={autoApplyResult}
            onApprove={handleApprove}
            onUnapprove={handleUnapprove}
            onReject={handleReject}
            onApproveAll={handleApproveAll}
            onManualApply={handleManualApply}
            onAutoApply={handleAutoApply}
            onAutoApplyAllApproved={handleAutoApplyAllApproved}
          />
        </TabsContent>

        <TabsContent value="applied">
          {appliedItems.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title={t("no_applications")}
              description={t("empty_applied_hint")}
              className="border border-dashed border-border rounded-xl"
            />
          ) : (
            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-2.5 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                <div className="col-span-4">{t("th_position")}</div>
                <div className="col-span-3">{t("th_company")}</div>
                <div className="col-span-2 text-center">{t("th_status")}</div>
                <div className="col-span-2 text-center">{t("th_applied")}</div>
                <div className="col-span-1" />
              </div>
              {appliedItems.map((app) => (
                <ApplicationCard key={app.id} app={app} loadingAction={loadingAction} onRetry={handleRetry} onManualApply={handleManualApply} variant="applied" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all">
          {allItems.length === 0 ? (
            <EmptyState
              icon={Send}
              title={t("no_applications")}
              description={t("empty_all_hint")}
              className="border border-dashed border-border rounded-xl"
            />
          ) : (
            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-2.5 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                <div className="col-span-4">{t("th_position")}</div>
                <div className="col-span-3">{t("th_company")}</div>
                <div className="col-span-2 text-center">{t("th_status")}</div>
                <div className="col-span-2 text-center">{t("th_date")}</div>
                <div className="col-span-1" />
              </div>
              {allItems.map((app) => (
                <ApplicationCard key={app.id} app={app} loadingAction={loadingAction} onRetry={handleRetry} onManualApply={handleManualApply} variant="all" />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
