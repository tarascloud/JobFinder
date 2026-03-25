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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getApplyQueue, approveWithCoverLetter, rejectFromQueue } from "@/actions/apply-queue";
import { getApplications } from "@/actions/applications";
import AiFeedbackButtons from "@/components/shared/ai-feedback-buttons";
import { CalendarButton } from "@/components/shared/calendar-button";

type AppStatus = "queued" | "approved" | "applied" | "response" | "interview" | "offer" | "rejected" | "withdrawn";

const statusColors: Record<string, "yellow" | "blue" | "green" | "purple" | "indigo" | "red"> = {
  queued: "yellow",
  approved: "blue",
  applied: "green",
  response: "purple",
  interview: "indigo",
  offer: "green",
  rejected: "red",
  withdrawn: "red",
};

const statusKeys: Record<string, string> = {
  queued: "status_queued",
  approved: "status_approved",
  applied: "status_applied",
  response: "status_response",
  interview: "status_interview",
  offer: "status_offer",
  rejected: "status_rejected",
  withdrawn: "status_rejected",
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
  createdAt: Date;
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

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    startTransition(async () => {
      const [queueResult, appliedResult, allResult] = await Promise.all([
        getApplyQueue(),
        getApplications({ status: "applied" }),
        getApplications({}),
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
        setAppliedItems(appliedResult.applications as ApplicationItem[]);
      }

      if ("applications" in allResult && allResult.applications) {
        setAllItems(allResult.applications as ApplicationItem[]);
      }
    });
  }

  function toggleExpand(id: number) {
    setExpandedId(expandedId === id ? null : id);
  }

  async function handleApprove(applicationId: number) {
    setLoadingAction(applicationId);
    const letter = coverLetters[applicationId] || "";
    const result = await approveWithCoverLetter(applicationId, letter);
    if ("application" in result) {
      await loadData();
    }
    setLoadingAction(null);
  }

  async function handleReject(applicationId: number) {
    setLoadingAction(applicationId);
    const result = await rejectFromQueue(applicationId);
    if ("application" in result) {
      await loadData();
    }
    setLoadingAction(null);
  }

  async function handleApproveAll() {
    for (const item of queueItems.filter((q) => q.status === "queued")) {
      const letter = coverLetters[item.id] || item.coverLetter || "";
      await approveWithCoverLetter(item.id, letter);
    }
    await loadData();
  }

  function scoreColor(score: number | null) {
    if (!score) return "text-muted-foreground";
    if (score >= 90) return "text-green-400";
    if (score >= 75) return "text-primary";
    return "text-muted-foreground";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{tq("title")}</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="queue">
            {tq("queue_tab")}
            {queueItems.length > 0 && (
              <span className="ml-2 rounded-full bg-yellow-900/60 px-2 py-0.5 text-xs text-yellow-300">
                {queueItems.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="applied">{tq("applied_tab")}</TabsTrigger>
          <TabsTrigger value="all">{tq("all_tab")}</TabsTrigger>
        </TabsList>

        {/* Queue Tab */}
        <TabsContent value="queue">
          {queueItems.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Send className="h-12 w-12 text-muted-foreground/60 mx-auto mb-3" />
                <p className="text-muted-foreground text-lg">{tq("no_queued")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Bulk actions */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {queueItems.length} {queueItems.length === 1 ? "item" : "items"}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleApproveAll}
                  disabled={isPending}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {tq("approve_all")}
                </Button>
              </div>

              {queueItems.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    {/* Main row */}
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/vacancies/${item.vacancy.id}`}
                            className="font-medium text-foreground hover:text-primary transition-colors"
                          >
                            {item.vacancy.title}
                          </Link>
                          <Badge color={statusColors[item.status] || "yellow"}>
                            {t(statusKeys[item.status] || "status_queued")}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          {item.vacancy.company && <span>{item.vacancy.company}</span>}
                          <span>{item.vacancy.platform}</span>
                          {item.vacancy.salaryText && (
                            <span className="text-foreground/80">{item.vacancy.salaryText}</span>
                          )}
                          {item.matchScore !== null && (
                            <span className={`font-semibold ${scoreColor(item.matchScore)}`}>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReject(item.id)}
                          disabled={loadingAction === item.id}
                        >
                          <XCircle className="h-4 w-4" />
                          {tq("reject")}
                        </Button>
                      </div>
                    </div>

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
            <Card>
              <CardContent className="p-12 text-center">
                <Send className="h-12 w-12 text-muted-foreground/60 mx-auto mb-3" />
                <p className="text-muted-foreground text-lg">{t("no_applications")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-4">Position</div>
                <div className="col-span-3">Company</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-2 text-center">Applied</div>
                <div className="col-span-1" />
              </div>

              {appliedItems.map((app) => (
                <Card key={app.id} className="hover:border-border transition-colors">
                  <CardContent className="p-4">
                    <div className="md:grid md:grid-cols-12 md:gap-4 md:items-center space-y-2 md:space-y-0">
                      <div className="col-span-4">
                        <Link
                          href={`/vacancies/${app.vacancy.id}`}
                          className="font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {app.vacancy.title}
                        </Link>
                      </div>
                      <div className="col-span-3">
                        <span className="text-sm text-muted-foreground">{app.vacancy.company}</span>
                      </div>
                      <div className="col-span-2 text-center">
                        <Badge color={statusColors[app.status] || "yellow"}>
                          {t(statusKeys[app.status] || "status_applied")}
                        </Badge>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="text-sm text-muted-foreground">
                          {app.appliedAt
                            ? new Date(app.appliedAt).toLocaleDateString()
                            : new Date(app.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="col-span-1 text-right flex items-center justify-end gap-1">
                        {(app.status === "applied" || app.status === "interview") && (
                          <Link
                            href={`/applications/${app.id}/email`}
                            className="text-sm text-green-400 hover:text-green-300"
                            title={t("follow_up")}
                          >
                            <Mail className="h-4 w-4 inline" />
                          </Link>
                        )}
                        <a
                          href={app.vacancy.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="h-4 w-4 inline" />
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* All Tab */}
        <TabsContent value="all">
          {allItems.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Send className="h-12 w-12 text-muted-foreground/60 mx-auto mb-3" />
                <p className="text-muted-foreground text-lg">{t("no_applications")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-4">Position</div>
                <div className="col-span-3">Company</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-2 text-center">Date</div>
                <div className="col-span-1" />
              </div>

              {allItems.map((app) => (
                <Card key={app.id} className="hover:border-border transition-colors">
                  <CardContent className="p-4">
                    <div className="md:grid md:grid-cols-12 md:gap-4 md:items-center space-y-2 md:space-y-0">
                      <div className="col-span-4">
                        <Link
                          href={`/vacancies/${app.vacancy.id}`}
                          className="font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {app.vacancy.title}
                        </Link>
                      </div>
                      <div className="col-span-3">
                        <span className="text-sm text-muted-foreground">{app.vacancy.company}</span>
                      </div>
                      <div className="col-span-2 text-center">
                        <Badge color={statusColors[app.status] || "yellow"}>
                          {t(statusKeys[app.status] || "status_queued")}
                        </Badge>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="text-sm text-muted-foreground">
                          {new Date(app.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="col-span-1 text-right flex items-center justify-end gap-1">
                        {(app.status === "applied" || app.status === "interview") && (
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
                        <a
                          href={app.vacancy.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="h-4 w-4 inline" />
                        </a>
                      </div>
                    </div>
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
