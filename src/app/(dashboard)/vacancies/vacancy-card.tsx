"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ExternalLink,
  MapPin,
  ChevronDown,
  Loader2,
  Send,
  MousePointerClick,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { queueVacancyForApply, markAsManuallyApplied } from "@/actions/apply-queue";
import type { Vacancy } from "./types";
import {
  scoreBadgeColor,
  platformIcon,
  platformColor,
  formatRelativeDate,
  applicationStatusVariant,
  applicationStatusLabel,
} from "./types";

interface VacancyCardProps {
  vacancy: Vacancy;
  isExpanded: boolean;
  queuingId: number | null;
  canQueue: boolean;
  onToggleExpand: (id: number) => void;
  onQuickQueue: (id: number, e: React.MouseEvent) => void;
}

export function VacancyCard({
  vacancy: v,
  isExpanded,
  queuingId,
  canQueue,
  onToggleExpand,
  onQuickQueue,
}: VacancyCardProps) {
  const t = useTranslations("vacancies");
  const tCommon = useTranslations("common");
  const tq = useTranslations("apply_queue");
  const [applyingManual, setApplyingManual] = useState(false);

  async function handleApplyManual(e: React.MouseEvent) {
    e.stopPropagation();
    if (!v.url) return;
    window.open(v.url, "_blank", "noopener,noreferrer");
    setApplyingManual(true);
    try {
      if (v.applicationId) {
        await markAsManuallyApplied(v.applicationId);
      } else {
        const result = await queueVacancyForApply(v.id, 0);
        if ("application" in result && result.application) {
          await markAsManuallyApplied(result.application.id);
        }
      }
    } catch {
      // Silently fail
    }
    setApplyingManual(false);
  }

  const salaryDisplay = v.salaryText
    ? v.salaryText
    : v.salaryMin || v.salaryMax
    ? `${v.salaryMinEur?.toLocaleString() ?? v.salaryMin?.toLocaleString() ?? "?"} - ${v.salaryMaxEur?.toLocaleString() ?? v.salaryMax?.toLocaleString() ?? "?"} ${v.salaryMinEur || v.salaryMaxEur ? "EUR" : v.salaryCurrency ?? ""}`
    : null;

  return (
    <Card
      className={`transition-all cursor-pointer hover:shadow-md hover:border-primary/20 ${
        v.dismissed ? "opacity-50" : ""
      } ${!v.seen ? "bg-primary/10" : ""}`}
    >
      <CardContent className="p-4 sm:p-5">
        {/* Main card content */}
        <div
          onClick={() => onToggleExpand(v.id)}
          className="flex items-start gap-3"
        >
          {/* Platform icon */}
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold shadow-sm ${platformColor(v.platform)}`}>
            {platformIcon(v.platform)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {/* Title */}
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground truncate leading-snug">{v.title}</p>
                  {!v.seen && (
                    <span className="inline-flex h-2 w-2 rounded-full bg-primary shrink-0 animate-[breathe_2s_ease-in-out_infinite]" />
                  )}
                </div>

                {/* Company + Location */}
                <div className="flex items-center gap-2 mt-1">
                  {v.company && (
                    <span className="text-sm text-muted-foreground truncate">{v.company}</span>
                  )}
                  {v.location && (
                    <span className="text-xs text-muted-foreground/70 flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate max-w-[150px]">{v.location}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Score badge - enhanced circular style */}
              <div className="flex items-center gap-2 shrink-0">
                {v.matchScore !== null && v.matchScore > 0 ? (
                  <div className={`relative flex items-center justify-center h-11 w-11 rounded-full border-2 ${
                    v.matchScore >= 80 ? "border-green-500/40 bg-green-500/10" :
                    v.matchScore >= 60 ? "border-yellow-500/40 bg-yellow-500/10" :
                    "border-red-500/40 bg-red-500/10"
                  }`}>
                    <span className={`text-xs font-bold ${
                      v.matchScore >= 80 ? "text-green-600 dark:text-green-400" :
                      v.matchScore >= 60 ? "text-yellow-600 dark:text-yellow-400" :
                      "text-red-600 dark:text-red-400"
                    }`}>
                      {v.matchScore}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-11 w-11 rounded-full border-2 border-muted bg-muted/30">
                    <span className="text-xs text-muted-foreground/40">&mdash;</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom row: salary, badges, date */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {salaryDisplay && (
                <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-500/10 rounded-md px-1.5 py-0.5">
                  {salaryDisplay}
                </span>
              )}
              {(v.remoteType === "remote" || /remote/i.test(v.title ?? "") || /remote/i.test(v.location ?? "")) && (
                <Badge variant="green" className="text-[10px] px-1.5 py-0">Remote</Badge>
              )}
              {v.applicationStatus && (
                <span className="inline-flex items-center gap-1">
                  <Badge variant={applicationStatusVariant(v.applicationStatus)} className="text-[10px] px-1.5 py-0">
                    {applicationStatusLabel(v.applicationStatus)}
                  </Badge>
                  {v.appliedWithPersonalAccount && (
                    <Tooltip content={t("personal_account_tooltip")} side="top">
                      <span className="text-yellow-400 text-xs cursor-help" aria-label={t("personal_account_tooltip")}>!</span>
                    </Tooltip>
                  )}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground/50">{v.platform}</span>
              <span className="text-[11px] text-muted-foreground/30">/</span>
              <span className="text-[11px] text-muted-foreground/50">
                {formatRelativeDate(v.postedAt || v.scrapedAt)}
              </span>
              {v.url && (
                <>
                  <span className="text-[11px] text-muted-foreground/30">/</span>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[11px] text-primary/70 hover:text-primary flex items-center gap-0.5 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="hidden sm:inline">{t("open_original")}</span>
                  </a>
                </>
              )}
              <span className="ml-auto" />
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground/30 transition-transform duration-200 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </div>
          </div>
        </div>

        {/* Expandable details */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isExpanded ? "max-h-[2000px] opacity-100 mt-4" : "max-h-0 opacity-0"
          }`}
        >
          {isExpanded && (
            <div className="border-t border-border pt-4 space-y-4">
              {/* Match info - pill layout */}
              {(v.matchScore !== null || v.matchNotes) && (
                <div className="flex flex-wrap gap-2">
                  {v.salaryFit !== null && (
                    <div className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      v.salaryFit ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${v.salaryFit ? "bg-green-500" : "bg-red-500"}`} />
                      {t("salary_fit")}
                    </div>
                  )}
                  {v.remoteFit !== null && (
                    <div className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      v.remoteFit ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${v.remoteFit ? "bg-green-500" : "bg-red-500"}`} />
                      {t("remote_fit")}
                    </div>
                  )}
                </div>
              )}

              {/* Tags - improved styling */}
              {(v.tagLevel || (v.tagStack && v.tagStack.length > 0) || v.tagIndustry) && (
                <div className="flex flex-wrap gap-1.5">
                  {v.tagLevel && <Badge variant="purple" className="text-[11px] px-2 py-0.5">{v.tagLevel}</Badge>}
                  {v.tagIndustry && v.tagIndustry !== "other" && <Badge variant="blue" className="text-[11px] px-2 py-0.5">{v.tagIndustry}</Badge>}
                  {v.tagStack?.slice(0, 8).map((tech) => (
                    <Badge key={tech} variant="secondary" className="text-[11px] px-2 py-0.5 font-mono">{tech}</Badge>
                  ))}
                  {(v.tagStack?.length ?? 0) > 8 && (
                    <span className="text-[11px] text-muted-foreground self-center">+{(v.tagStack?.length ?? 0) - 8}</span>
                  )}
                </div>
              )}

              {/* Match notes */}
              {v.matchNotes && (
                <div className="rounded-xl bg-muted/40 border border-border/50 p-3.5">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{t("match_notes")}</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{v.matchNotes}</p>
                </div>
              )}

              {/* Description preview */}
              {v.description && (
                <p className="text-sm text-foreground/60 line-clamp-2 leading-relaxed">
                  {v.description.replace(/<[^>]+>/g, "")}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                {!v.applicationStatus && !v.dismissed && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickQueue(v.id, e);
                    }}
                    disabled={queuingId === v.id || !canQueue}
                  >
                    {queuingId === v.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {tq("queue_for_apply")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleApplyManual}
                  disabled={applyingManual}
                >
                  {applyingManual ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MousePointerClick className="h-4 w-4" />
                  )}
                  {tq("apply_manual")}
                </Button>
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("open_original")}
                </a>
                <Link
                  href={`/vacancies/${v.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-muted-foreground hover:text-foreground ml-auto"
                >
                  {tCommon("edit")} &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
