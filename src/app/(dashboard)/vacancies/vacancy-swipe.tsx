"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  MapPin,
  Loader2,
  Check,
  X,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Vacancy } from "./types";
import {
  scoreBadgeColor,
  platformIcon,
  platformColor,
  formatRelativeDate,
  applicationStatusVariant,
  applicationStatusLabel,
} from "./types";

interface VacancySwipeProps {
  vacancies: Vacancy[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSwipeRight: (vacancyId: number) => void;
  onSwipeLeft: (vacancyId: number) => void;
  onPullToRefresh: () => void;
}

export function VacancySwipe({
  vacancies,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onSwipeRight,
  onSwipeLeft,
  onPullToRefresh,
}: VacancySwipeProps) {
  const t = useTranslations("vacancies");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeX, setSwipeX] = useState(0);
  const [swipeStartX, setSwipeStartX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [exitAnimation, setExitAnimation] = useState<"left" | "right" | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [pullStartY, setPullStartY] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 100;
  const PULL_THRESHOLD = 80;

  // Load more when near end
  useEffect(() => {
    if (currentIndex >= vacancies.length - 3 && hasMore && !loadingMore) {
      onLoadMore();
    }
  }, [currentIndex, vacancies.length, hasMore, loadingMore, onLoadMore]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setSwipeStartX(touch.clientX);
    setPullStartY(touch.clientY);
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeStartX;
    const deltaY = touch.clientY - pullStartY;

    // Pull to refresh (only when at top card)
    if (deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX) && currentIndex === 0) {
      e.preventDefault();
      setPullY(Math.min(deltaY * 0.5, PULL_THRESHOLD * 1.5));
      return;
    }

    setSwipeX(deltaX);
    if (deltaX > 30) setSwipeDirection("right");
    else if (deltaX < -30) setSwipeDirection("left");
    else setSwipeDirection(null);
  }, [isSwiping, swipeStartX, pullStartY, currentIndex]);

  const handleTouchEnd = useCallback(() => {
    setIsSwiping(false);

    // Handle pull to refresh
    if (pullY >= PULL_THRESHOLD) {
      setRefreshing(true);
      onPullToRefresh();
      setTimeout(() => {
        setRefreshing(false);
        setCurrentIndex(0);
      }, 1000);
    }
    setPullY(0);

    if (Math.abs(swipeX) >= SWIPE_THRESHOLD) {
      const direction = swipeX > 0 ? "right" : "left";
      setExitAnimation(direction);

      const vacancy = vacancies[currentIndex];
      if (vacancy) {
        if (direction === "right") onSwipeRight(vacancy.id);
        else onSwipeLeft(vacancy.id);
      }

      setTimeout(() => {
        setExitAnimation(null);
        setSwipeX(0);
        setSwipeDirection(null);
        setShowDetails(false);
        setCurrentIndex((prev) => Math.min(prev + 1, vacancies.length));
      }, 300);
    } else {
      setSwipeX(0);
      setSwipeDirection(null);
    }
  }, [swipeX, pullY, vacancies, currentIndex, onSwipeRight, onSwipeLeft, onPullToRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (vacancies.length === 0 || currentIndex >= vacancies.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
        <p className="text-lg text-muted-foreground">{t("no_vacancies")}</p>
        <p className="text-sm text-muted-foreground/60 mt-2">{t("swipe_empty")}</p>
      </div>
    );
  }

  const v = vacancies[currentIndex];
  const rotation = swipeX * 0.05;
  const opacity = 1 - Math.abs(swipeX) / 400;

  const cardStyle = exitAnimation
    ? {
        transform: `translateX(${exitAnimation === "right" ? "120%" : "-120%"}) rotate(${exitAnimation === "right" ? 15 : -15}deg)`,
        opacity: 0,
        transition: "transform 0.3s ease-out, opacity 0.3s ease-out",
      }
    : {
        transform: `translateX(${swipeX}px) rotate(${rotation}deg)`,
        opacity,
        transition: isSwiping ? "none" : "transform 0.3s ease-out, opacity 0.3s ease-out",
      };

  const salaryDisplay = v.salaryText
    ? v.salaryText
    : v.salaryMin || v.salaryMax
    ? `${v.salaryMinEur?.toLocaleString() ?? v.salaryMin?.toLocaleString() ?? "?"} - ${v.salaryMaxEur?.toLocaleString() ?? v.salaryMax?.toLocaleString() ?? "?"} ${v.salaryMinEur || v.salaryMaxEur ? "EUR" : v.salaryCurrency ?? ""}`
    : null;

  return (
    <div ref={containerRef} className="relative">
      {/* Pull to refresh indicator */}
      {(pullY > 0 || refreshing) && (
        <div
          className="flex items-center justify-center py-3 transition-all"
          style={{ height: refreshing ? 48 : pullY }}
        >
          <Loader2
            className={`h-5 w-5 text-primary ${refreshing ? "animate-spin" : ""}`}
            style={{ opacity: pullY / PULL_THRESHOLD }}
          />
        </div>
      )}

      {/* Swipe indicators */}
      <div className="relative flex items-center justify-center mb-4">
        {/* Left indicator (dismiss) */}
        <div
          className={`absolute left-4 flex items-center gap-1 rounded-full px-3 py-1.5 transition-opacity ${
            swipeDirection === "left" ? "opacity-100" : "opacity-0"
          } bg-red-500/20 text-red-500`}
        >
          <X className="h-4 w-4" />
          <span className="text-xs font-medium">{t("swipe_dismiss")}</span>
        </div>

        {/* Right indicator (save) */}
        <div
          className={`absolute right-4 flex items-center gap-1 rounded-full px-3 py-1.5 transition-opacity ${
            swipeDirection === "right" ? "opacity-100" : "opacity-0"
          } bg-green-500/20 text-green-500`}
        >
          <Check className="h-4 w-4" />
          <span className="text-xs font-medium">{t("swipe_save")}</span>
        </div>
      </div>

      {/* Card */}
      <div
        ref={cardRef}
        style={cardStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="touch-none select-none"
      >
        <Card className={`${!v.seen ? "border-l-2 border-l-primary" : ""}`}>
          <CardContent className="p-5">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${platformColor(v.platform)}`}>
                {platformIcon(v.platform)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground text-base leading-tight truncate">{v.title}</h3>
                  {!v.seen && <span className="inline-flex h-2 w-2 rounded-full bg-primary shrink-0" />}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{v.company}</p>
              </div>
              {v.matchScore !== null && v.matchScore > 0 && (
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-bold shrink-0 ${scoreBadgeColor(v.matchScore)}`}>
                  {v.matchScore}%
                </span>
              )}
            </div>

            {/* Key info */}
            <div className="mt-4 space-y-2">
              {v.location && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {v.location}
                </div>
              )}
              {salaryDisplay && (
                <p className="text-sm font-medium text-green-600 dark:text-green-400">{salaryDisplay}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {(v.remoteType === "remote" || /remote/i.test(v.title ?? "") || /remote/i.test(v.location ?? "")) && (
                  <Badge variant="green" className="text-xs">Remote</Badge>
                )}
                {v.applicationStatus && (
                  <Badge variant={applicationStatusVariant(v.applicationStatus)} className="text-xs">
                    {applicationStatusLabel(v.applicationStatus)}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatRelativeDate(v.postedAt || v.scrapedAt)}
                </span>
              </div>
            </div>

            {/* Tags */}
            {(v.tagStack && v.tagStack.length > 0) && (
              <div className="flex flex-wrap gap-1 mt-3">
                {v.tagLevel && <Badge variant="purple" className="text-[10px]">{v.tagLevel}</Badge>}
                {v.tagStack.slice(0, 6).map((tech) => (
                  <Badge key={tech} variant="default" className="text-[10px]">{tech}</Badge>
                ))}
              </div>
            )}

            {/* Expandable details */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-3 transition-colors"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`} />
              {showDetails ? t("hide_details") : t("show_details")}
            </button>

            {showDetails && (
              <div className="mt-3 space-y-3">
                {v.matchNotes && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{t("match_notes")}</p>
                    <p className="text-sm text-foreground/80">{v.matchNotes}</p>
                  </div>
                )}
                {v.description && (
                  <p className="text-sm text-foreground/70 line-clamp-4">
                    {v.description.replace(/<[^>]+>/g, "")}
                  </p>
                )}
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("open_original")}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Counter */}
      <div className="flex items-center justify-center mt-4 gap-4">
        <span className="text-xs text-muted-foreground">
          {currentIndex + 1} / {vacancies.length}
        </span>
        {loadingMore && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      {/* Swipe hint */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground/50">
        <span className="flex items-center gap-1">
          <X className="h-3 w-3" /> {t("swipe_left_hint")}
        </span>
        <span className="flex items-center gap-1">
          {t("swipe_right_hint")} <Check className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}
