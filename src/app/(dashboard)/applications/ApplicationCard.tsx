"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ExternalLink,
  Loader2,
  BookOpen,
  Mail,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { CalendarButton } from "@/components/shared/calendar-button";
import { statusColors, statusKeys, type ApplicationItem } from "./types";

interface ApplicationCardProps {
  app: ApplicationItem;
  loadingAction: number | null;
  showRetryButton?: boolean;
  showFollowUpButton?: boolean;
  showPrepButton?: boolean;
  onRetry: (id: number) => void;
  onManualApply: (id: number, url: string) => void;
  /** "applied" or "all" — controls which columns/Date label */
  variant: "applied" | "all";
}

export function ApplicationCard({
  app,
  loadingAction,
  showRetryButton = false,
  showFollowUpButton = false,
  showPrepButton = false,
  onRetry,
  onManualApply,
  variant,
}: ApplicationCardProps) {
  const t = useTranslations("applications");
  const tq = useTranslations("apply_queue");
  const tv = useTranslations("vacancies");

  const canRetry = app.status === "pending_qa" || app.status === "failed";
  const canFollowUp = app.status === "applied" || app.status === "applied_manual" || app.status === "interview";
  const isInterview = app.status === "interview";

  return (
    <Card className="transition-all hover:shadow-sm hover:border-primary/15">
      <CardContent className="p-4 sm:p-5">
        {app.appliedWithPersonalAccount && (
          <div className="mb-2 flex items-center gap-2 rounded-md bg-yellow-900/30 border border-yellow-700/40 px-3 py-1.5 text-xs text-yellow-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
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
                aria-label={tv("open_original")}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="col-span-3">
            <span className="text-sm text-muted-foreground">{app.vacancy.company}</span>
          </div>
          <div className="col-span-2 text-left md:text-center">
            <span className="inline-flex items-center gap-1">
              <Badge color={statusColors[app.status] || "yellow"}>
                {t(statusKeys[app.status] || (variant === "applied" ? "status_applied" : "status_queued"))}
              </Badge>
              {app.appliedWithPersonalAccount && (
                <Tooltip content={t("personal_account_tooltip")} side="top">
                  <AlertTriangle className="h-3 w-3 text-yellow-400 cursor-help" />
                </Tooltip>
              )}
            </span>
          </div>
          <div className="col-span-2 text-left md:text-center">
            <span className="text-sm text-muted-foreground">
              {variant === "applied"
                ? (app.appliedAt
                  ? new Date(app.appliedAt).toLocaleDateString()
                  : new Date(app.createdAt).toLocaleDateString())
                : new Date(app.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="col-span-1 flex items-center justify-start md:justify-end gap-1">
            {canRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRetry(app.id)}
                disabled={loadingAction === app.id}
                title={t("retry")}
                aria-label={t("retry")}
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
              onClick={() => onManualApply(app.id, app.vacancy.url)}
              disabled={loadingAction === app.id}
              title={tq("apply_manual")}
              aria-label={tq("apply_manual")}
              className="h-7 w-7 p-0"
            >
              {loadingAction === app.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
            </Button>
            {canFollowUp && (
              <Link
                href={`/applications/${app.id}/email`}
                className="text-sm text-green-400 hover:text-green-300"
                title={t("follow_up")}
                aria-label={t("follow_up")}
              >
                <Mail className="h-4 w-4 inline" aria-hidden="true" />
              </Link>
            )}
            {isInterview && (
              <>
                <Link
                  href={`/applications/${app.id}/prep`}
                  className="text-sm text-indigo-400 hover:text-indigo-300"
                  title={t("prepare")}
                  aria-label={t("prepare")}
                >
                  <BookOpen className="h-4 w-4 inline" aria-hidden="true" />
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
  );
}
