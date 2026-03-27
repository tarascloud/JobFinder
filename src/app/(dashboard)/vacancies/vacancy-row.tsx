"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ExternalLink,
  MapPin,
  ChevronDown,
  Loader2,
  CheckSquare,
  Square,
  Send,
  MousePointerClick,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { queueVacancyForApply, markAsManuallyApplied } from "@/actions/apply-queue";
import type { Vacancy } from "./types";
import { scoreBadgeVariant, platformIcon, formatDate, applicationStatusVariant, applicationStatusLabel } from "./types";

interface VacancyRowProps {
  vacancy: Vacancy;
  isExpanded: boolean;
  isSelected: boolean;
  queuingId: number | null;
  canQueue: boolean;
  onToggleExpand: (id: number) => void;
  onToggleSelect: (id: number, e: React.MouseEvent) => void;
  onQuickQueue: (id: number, e: React.MouseEvent) => void;
}

export function VacancyRow({
  vacancy: v,
  isExpanded,
  isSelected,
  queuingId,
  canQueue,
  onToggleExpand,
  onToggleSelect,
  onQuickQueue,
}: VacancyRowProps) {
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
      // If there's already an application, just mark it
      if (v.applicationId) {
        await markAsManuallyApplied(v.applicationId);
      } else {
        // Queue first, then mark as manually applied
        const result = await queueVacancyForApply(v.id, 0);
        if ("application" in result && result.application) {
          await markAsManuallyApplied(result.application.id);
        }
      }
    } catch {
      // Silently fail — the URL was already opened
    }
    setApplyingManual(false);
  }

  return (
    <div className="grid grid-cols-[auto_1fr] gap-2 items-start">
      {/* Checkbox */}
      <button
        onClick={(e) => onToggleSelect(v.id, e)}
        className="flex items-center justify-center w-8 h-8 mt-3 text-muted-foreground hover:text-foreground transition-colors"
      >
        {isSelected ? (
          <CheckSquare className="h-4 w-4 text-primary" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </button>

      {/* Card */}
      <Card
        className={`transition-colors cursor-pointer ${
          isSelected ? "border-primary/50" : "hover:border-border"
        } ${v.dismissed ? "opacity-50" : ""}`}
      >
        <CardContent className="p-4">
          {/* Main row - clickable to expand */}
          <div
            onClick={() => onToggleExpand(v.id)}
            className="md:grid md:grid-cols-12 md:gap-4 md:items-center space-y-2 md:space-y-0"
          >
            {/* Title + Company + Platform */}
            <div className="col-span-4 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-foreground/80">
                {platformIcon(v.platform)}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate flex items-center gap-1.5">
                  {v.title}
                  {v.url && (
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <ChevronDown
                    className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </p>
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-sm text-muted-foreground truncate">{v.company}</p>
                  {(v.remoteType === "remote" || /remote/i.test(v.title ?? "") || /remote/i.test(v.location ?? "")) && (
                    <Badge variant="green" className="shrink-0 text-[10px] px-1.5 py-0">Remote</Badge>
                  )}
                  {v.employmentType && (
                    <Badge variant="blue" className="shrink-0 text-[10px] px-1.5 py-0">
                      {v.employmentType.charAt(0).toUpperCase() + v.employmentType.slice(1).replace(/-/g, " ")}
                    </Badge>
                  )}
                </div>
                {v.description && (
                  <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{v.description.replace(/<[^>]+>/g, "").slice(0, 120)}</p>
                )}
              </div>
            </div>

            {/* Platform */}
            <div className="col-span-2">
              <span className="text-xs text-muted-foreground">{v.platform}</span>
            </div>

            {/* Application Status */}
            <div className="col-span-1 text-center">
              {v.applicationStatus ? (
                <span className="inline-flex items-center gap-1">
                  <Badge variant={applicationStatusVariant(v.applicationStatus)} className="text-[10px] px-1.5 py-0">
                    {applicationStatusLabel(v.applicationStatus)}
                  </Badge>
                  {v.appliedWithPersonalAccount && (
                    <Tooltip content={t("personal_account_tooltip")} side="top">
                      <span className="text-yellow-400 text-xs cursor-help" aria-label={t("personal_account_tooltip")}>⚠️</span>
                    </Tooltip>
                  )}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground/40">&mdash;</span>
              )}
            </div>

            {/* Location */}
            <div className="col-span-2">
              {v.location ? (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{v.location}</span>
                </span>
              ) : v.remoteType ? (
                <Badge variant="blue">{v.remoteType}</Badge>
              ) : (
                <span className="text-sm text-muted-foreground/60">---</span>
              )}
            </div>

            {/* Score */}
            <div className="col-span-1 text-center">
              {v.matchScore !== null ? (
                <Badge variant={scoreBadgeVariant(v.matchScore)}>
                  {v.matchScore}%
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground/60">{t("not_scored")}</span>
              )}
            </div>

            {/* Posted */}
            <div className="col-span-2 text-center">
              <span className="text-xs text-muted-foreground">
                {formatDate(v.postedAt)}
              </span>
            </div>
          </div>

          {/* Inline expanded preview */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              isExpanded ? "max-h-[2000px] opacity-100 mt-4" : "max-h-0 opacity-0"
            }`}
          >
            {isExpanded && (
              <div className="border-t border-border pt-4 space-y-4">
                {/* Match info row */}
                {(v.matchScore !== null || v.matchNotes) && (
                  <div className="flex flex-wrap gap-4 text-sm">
                    {v.matchScore !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{t("score")}:</span>
                        <Badge variant={scoreBadgeVariant(v.matchScore)}>
                          {v.matchScore}%
                        </Badge>
                      </div>
                    )}
                    {v.salaryFit !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{t("salary_fit")}:</span>
                        <Badge variant={v.salaryFit ? "green" : "red"}>
                          {v.salaryFit ? "Yes" : "No"}
                        </Badge>
                      </div>
                    )}
                    {v.remoteFit !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{t("remote_fit")}:</span>
                        <Badge variant={v.remoteFit ? "green" : "red"}>
                          {v.remoteFit ? "Yes" : "No"}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}

                {/* Tags */}
                {(v.tagLevel || (v.tagStack && v.tagStack.length > 0) || v.tagIndustry) && (
                  <div className="flex flex-wrap gap-1.5">
                    {v.tagLevel && (
                      <Badge variant="purple">
                        {v.tagLevel}
                      </Badge>
                    )}
                    {v.tagIndustry && v.tagIndustry !== "other" && (
                      <Badge variant="blue">
                        {v.tagIndustry}
                      </Badge>
                    )}
                    {v.tagTeamSize && (
                      <Badge variant="secondary">
                        {v.tagTeamSize}
                      </Badge>
                    )}
                    {v.tagStack?.slice(0, 10).map((tech) => (
                      <Badge key={tech} variant="default" className="text-[10px]">
                        {tech}
                      </Badge>
                    ))}
                    {(v.tagStack?.length ?? 0) > 10 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{(v.tagStack?.length ?? 0) - 10}
                      </span>
                    )}
                  </div>
                )}

                {/* Match notes */}
                {v.matchNotes && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{t("match_notes")}</p>
                    <p className="text-sm text-foreground/80">{v.matchNotes}</p>
                  </div>
                )}

                {/* Salary details */}
                {(v.salaryText || v.salaryMin || v.salaryMax) && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t("salary")}: </span>
                    <span className="text-foreground/80">
                      {v.salaryText
                        ? v.salaryText
                        : `${v.salaryMin?.toLocaleString() ?? "?"} - ${v.salaryMax?.toLocaleString() ?? "?"} ${v.salaryCurrency ?? ""}`}
                    </span>
                    {(v.salaryMinEur || v.salaryMaxEur) && v.salaryCurrency !== "EUR" && (
                      <span className="ml-2 text-muted-foreground">
                        ({t("salary_eur")}: {v.salaryMinEur && v.salaryMaxEur && v.salaryMinEur !== v.salaryMaxEur
                          ? `${v.salaryMinEur.toLocaleString()}-${v.salaryMaxEur.toLocaleString()}`
                          : `~${(v.salaryMaxEur ?? v.salaryMinEur)?.toLocaleString()}`} EUR)
                      </span>
                    )}
                  </div>
                )}

                {/* Description */}
                {v.description && (
                  <p className="text-sm text-foreground/80 line-clamp-1">
                    {v.description.replace(/<[^>]+>/g, "")}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2 border-t border-border">
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
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("open_original")}
                  </a>
                  <Link
                    href={`/vacancies/${v.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-muted-foreground hover:text-foreground ml-auto"
                  >
                    {tCommon("edit")} &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
