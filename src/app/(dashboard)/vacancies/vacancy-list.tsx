"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Briefcase,
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
import { VacancyCard } from "./vacancy-card";

interface VacancyListProps {
  vacancies: Vacancy[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  queuingId: number | null;
  canQueue: boolean;
  selectedProfileId: number | null;
  onLoadMore: () => void;
  onQuickQueue: (id: number, e: React.MouseEvent) => void;
  onDataChanged: () => void;
}

export function VacancyList({
  vacancies,
  loading,
  loadingMore,
  hasMore,
  queuingId,
  canQueue,
  selectedProfileId,
  onLoadMore,
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

  const sentinelRef = useRef<HTMLDivElement>(null);

  const hasSelection = selectedIds.size > 0;
  const allSelected = vacancies.length > 0 && selectedIds.size === vacancies.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < vacancies.length;
  const batchBusy = batchScoring || batchQueuing || batchDismissing;

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          onLoadMore();
        }
      },
      { threshold: 0, rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, onLoadMore]);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const toggleSelect = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(vacancies.map((v) => v.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

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

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2.5">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-2/5" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-md" />
                    <Skeleton className="h-5 w-14 rounded-md" />
                    <Skeleton className="h-5 w-20 rounded-md" />
                  </div>
                </div>
                <Skeleton className="h-11 w-11 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (vacancies.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 px-6 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Briefcase className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1.5">{t("no_vacancies")}</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">{tCommon("filter")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Select all toggle (desktop) */}
      <div className="hidden md:flex items-center gap-2 px-1">
        <button
          onClick={toggleSelectAll}
          className="flex items-center justify-center w-7 h-7 text-muted-foreground hover:text-foreground transition-colors"
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
        <span className="text-xs text-muted-foreground">{t("select_all")}</span>
      </div>

      {/* Vacancy cards */}
      <div className="space-y-2">
        {vacancies.map((v, index) => (
          <div
            key={v.id}
            className="flex items-start gap-2"
            style={{
              animation: "fadeInUp 0.4s ease both",
              animationDelay: `${Math.min(index, 12) * 50}ms`,
            }}
          >
            {/* Checkbox (desktop) */}
            <button
              onClick={(e) => toggleSelect(v.id, e)}
              className="hidden md:flex items-center justify-center w-7 h-7 mt-4 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              {selectedIds.has(v.id) ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <VacancyCard
                vacancy={v}
                isExpanded={expandedId === v.id}
                queuingId={queuingId}
                canQueue={canQueue}
                onToggleExpand={toggleExpand}
                onQuickQueue={onQuickQueue}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-4" />

      {/* Loading more spinner */}
      {loadingMore && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* End of list */}
      {!hasMore && vacancies.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">
          {t("no_more_vacancies")}
        </p>
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
