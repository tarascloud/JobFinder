"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckSquare,
  Square,
  MinusSquare,
  X,
  Ban,
  Send,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  batchScoreVacancies,
  batchQueueVacancies,
  batchDismissVacancies,
} from "@/actions/vacancies";
import type { Vacancy } from "./types";
import { VacancyRow } from "./vacancy-row";

interface VacancyListProps {
  vacancies: Vacancy[];
  loading: boolean;
  page: number;
  totalPages: number;
  queuingId: number | null;
  canQueue: boolean;
  selectedProfileId: number | null;
  onPageChange: (page: number) => void;
  onQuickQueue: (id: number, e: React.MouseEvent) => void;
  onDataChanged: () => void;
}

export function VacancyList({
  vacancies,
  loading,
  page,
  totalPages,
  queuingId,
  canQueue,
  selectedProfileId,
  onPageChange,
  onQuickQueue,
  onDataChanged,
}: VacancyListProps) {
  const t = useTranslations("vacancies");
  const tCommon = useTranslations("common");

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchScoring, setBatchScoring] = useState(false);
  const [batchQueuing, setBatchQueuing] = useState(false);
  const [batchDismissing, setBatchDismissing] = useState(false);

  const hasSelection = selectedIds.size > 0;
  const allSelected = vacancies.length > 0 && selectedIds.size === vacancies.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < vacancies.length;
  const batchBusy = batchScoring || batchQueuing || batchDismissing;

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(vacancies.map((v) => v.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBatchScore = async () => {
    if (!selectedProfileId || selectedIds.size === 0) return;
    setBatchScoring(true);
    try {
      await batchScoreVacancies(Array.from(selectedIds), selectedProfileId);
      onDataChanged();
    } finally {
      setBatchScoring(false);
    }
  };

  const handleBatchQueue = async () => {
    if (!selectedProfileId || selectedIds.size === 0) return;
    setBatchQueuing(true);
    try {
      await batchQueueVacancies(Array.from(selectedIds), selectedProfileId);
      onDataChanged();
    } finally {
      setBatchQueuing(false);
    }
  };

  const handleBatchDismiss = async () => {
    if (selectedIds.size === 0) return;
    setBatchDismissing(true);
    try {
      await batchDismissVacancies(Array.from(selectedIds));
      onDataChanged();
    } finally {
      setBatchDismissing(false);
    }
  };

  // Clear selection when vacancies change (data reload)
  // This is handled by parent calling onDataChanged which triggers loadVacancies

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-12" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (vacancies.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground/60 mx-auto mb-3" />
          <p className="text-muted-foreground text-lg">{t("no_vacancies")}</p>
          <p className="text-muted-foreground text-sm mt-1">{tCommon("filter")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {/* Header row */}
        <div className="hidden md:grid grid-cols-[auto_1fr] gap-2 items-center">
          <button
            onClick={toggleSelectAll}
            className="flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground transition-colors"
            title={t("select_all")}
          >
            {allSelected ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : someSelected ? (
              <MinusSquare className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="col-span-4">{t("title")}</div>
            <div className="col-span-2">{t("platform")}</div>
            <div className="col-span-1 text-center">{t("status")}</div>
            <div className="col-span-2">{t("location")}</div>
            <div className="col-span-1 text-center">{t("score")}</div>
            <div className="col-span-2 text-center">{t("posted")}</div>
          </div>
        </div>

        {vacancies.map((v) => (
          <VacancyRow
            key={v.id}
            vacancy={v}
            isExpanded={expandedId === v.id}
            isSelected={selectedIds.has(v.id)}
            queuingId={queuingId}
            canQueue={canQueue}
            onToggleExpand={toggleExpand}
            onToggleSelect={toggleSelect}
            onQuickQueue={onQuickQueue}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("page_of", { page, total: totalPages })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Floating Batch Action Bar */}
      {hasSelection && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background/95 backdrop-blur-sm shadow-lg px-5 py-3">
            <Badge variant="secondary" className="text-sm font-medium">
              {selectedIds.size}
            </Badge>

            <Button
              size="sm"
              variant="secondary"
              onClick={handleBatchScore}
              disabled={batchBusy || !selectedProfileId}
            >
              {batchScoring ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {batchScoring
                ? t("batch_scoring")
                : t("batch_score", { count: selectedIds.size })}
            </Button>

            <Button
              size="sm"
              onClick={handleBatchQueue}
              disabled={batchBusy || !selectedProfileId}
            >
              {batchQueuing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {batchQueuing
                ? t("batch_queuing")
                : t("batch_queue", { count: selectedIds.size })}
            </Button>

            <Button
              size="sm"
              variant="destructive"
              onClick={handleBatchDismiss}
              disabled={batchBusy}
            >
              {batchDismissing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              {batchDismissing
                ? t("batch_dismissing")
                : t("batch_dismiss", { count: selectedIds.size })}
            </Button>

            <button
              onClick={clearSelection}
              className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
              title={tCommon("cancel")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom spacer when batch bar is visible */}
      {hasSelection && <div className="h-20" />}
    </>
  );
}
