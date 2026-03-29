"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getVacancies, markVacanciesAsSeen, getNewVacanciesCount, saveVacancy, dismissVacancy } from "@/actions/vacancies";
import { getScrapeStatus } from "@/actions/scraper";
import { scoreVacancies } from "@/actions/scoring";
import { getSearchProfiles } from "@/actions/search-profiles";
import { queueVacancyForApply } from "@/actions/apply-queue";
import type { Vacancy, ScrapeStatus, SearchProfile, SortBy } from "./types";
import { VacancyFilters, type FilterState } from "./vacancy-filters";
import { VacancyList } from "./vacancy-list";
import { VacancySwipe } from "./vacancy-swipe";
import { ScrapePanel, useScrapeState } from "./scrape-panel";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export default function VacanciesPage() {
  const t = useTranslations("vacancies");
  const isMobile = useIsMobile();

  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [scoring, setScoring] = useState(false);
  const [queuingId, setQueuingId] = useState<number | null>(null);
  const [unseenCount, setUnseenCount] = useState(0);
  const [markingRead, setMarkingRead] = useState(false);

  const [filterPlatforms, setFilterPlatforms] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("jf-filter-platforms");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });
  const [filterProfileIds, setFilterProfileIds] = useState<number[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [minScore, setMinScore] = useState(50);
  const [sortBy, setSortBy] = useState<SortBy>("score");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterIndustry, setFilterIndustry] = useState("all");
  const [filterStack, setFilterStack] = useState("all");

  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);

  const platforms = scrapeStatus?.byPlatform
    ? Object.keys(scrapeStatus.byPlatform)
    : [];

  // Load search profiles on mount
  useEffect(() => {
    async function load() {
      const result = await getSearchProfiles();
      if (Array.isArray(result)) {
        setProfiles(result as SearchProfile[]);
      }
    }
    load();
  }, []);

  // Load unseen count
  const loadUnseenCount = useCallback(async () => {
    const result = await getNewVacanciesCount();
    if (typeof result === "number") setUnseenCount(result);
  }, []);

  useEffect(() => {
    loadUnseenCount();
  }, [loadUnseenCount]);

  // Derive effective selectedProfileId from filters
  const effectiveProfileId = filterProfileIds.length === 1 ? filterProfileIds[0] : selectedProfileId;

  // Build filter params
  const buildFilterParams = useCallback(() => ({
    platforms: filterPlatforms.length > 0 ? filterPlatforms : undefined,
    minScore: minScore > 0 ? minScore : undefined,
    status: filterStatus === "all" ? undefined : filterStatus,
    searchProfileId: filterProfileIds.length === 1 ? filterProfileIds[0] : undefined,
    searchProfileIds: filterProfileIds.length > 1 ? filterProfileIds : undefined,
    tagLevel: filterLevel === "all" ? undefined : filterLevel,
    tagIndustry: filterIndustry === "all" ? undefined : filterIndustry,
    tagStack: filterStack === "all" ? undefined : filterStack,
  }), [filterPlatforms, minScore, filterStatus, filterProfileIds, filterLevel, filterIndustry, filterStack]);

  // Load vacancies (initial or filter change)
  const loadVacancies = useCallback(async () => {
    setLoading(true);
    setCurrentPage(1);
    try {
      const result = await getVacancies({
        ...buildFilterParams(),
        page: 1,
        limit: 20,
      });

      if ("error" in result) {
        console.error(result.error);
        return;
      }

      // Client-side sort
      const sorted = [...result.vacancies].sort((a, b) => {
        if (sortBy === "score") return (b.matchScore ?? -1) - (a.matchScore ?? -1);
        if (sortBy === "date") {
          const da = a.postedAt ? new Date(a.postedAt).getTime() : 0;
          const db = b.postedAt ? new Date(b.postedAt).getTime() : 0;
          return db - da;
        }
        if (sortBy === "salary") return (b.salaryMaxEur ?? b.salaryMax ?? 0) - (a.salaryMaxEur ?? a.salaryMax ?? 0);
        return 0;
      });

      setVacancies(sorted as Vacancy[]);
      setTotal(result.total);
      setHasMore(result.page < result.totalPages);
    } finally {
      setLoading(false);
    }
  }, [buildFilterParams, sortBy]);

  useEffect(() => {
    loadVacancies();
  }, [loadVacancies]);

  // Load more vacancies (infinite scroll)
  const loadMoreVacancies = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = currentPage + 1;
    try {
      const result = await getVacancies({
        ...buildFilterParams(),
        page: nextPage,
        limit: 20,
      });

      if ("error" in result) {
        console.error(result.error);
        return;
      }

      setVacancies((prev) => {
        const existingIds = new Set(prev.map((v) => v.id));
        const newVacancies = result.vacancies.filter((v) => !existingIds.has(v.id));
        return [...prev, ...newVacancies] as Vacancy[];
      });
      setCurrentPage(nextPage);
      setHasMore(nextPage < result.totalPages);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, currentPage, buildFilterParams]);

  // Load scrape status
  const loadScrapeStatus = useCallback(async () => {
    const result = await getScrapeStatus(effectiveProfileId ?? undefined);
    if (!("error" in result)) {
      setScrapeStatus(result);
    }
  }, [effectiveProfileId]);

  useEffect(() => {
    loadScrapeStatus();
  }, [loadScrapeStatus]);

  // Scrape state
  const onScrapeComplete = useCallback(async () => {
    await loadVacancies();
    await loadScrapeStatus();
    await loadUnseenCount();
  }, [loadVacancies, loadScrapeStatus, loadUnseenCount]);

  const {
    scraping,
    scrapeProgress,
    scrapePhase,
    scrapeSummary,
    rateLimitRetry,
    handleScrape,
  } = useScrapeState(profiles, effectiveProfileId, onScrapeComplete, filterPlatforms);

  const handleScore = async () => {
    const profileId = effectiveProfileId || profiles.find(p => p.isActive)?.id;
    if (!profileId) return;
    setScoring(true);
    try {
      await scoreVacancies(profileId);
      await loadVacancies();
      await loadUnseenCount();
    } finally {
      setScoring(false);
    }
  };

  const handleQuickQueue = async (vacancyId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const profileId = effectiveProfileId || profiles.find(p => p.isActive)?.id;
    if (!profileId) return;
    setQueuingId(vacancyId);
    try {
      await queueVacancyForApply(vacancyId, profileId);
      await loadVacancies();
    } finally {
      setQueuingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingRead(true);
    try {
      await markVacanciesAsSeen(effectiveProfileId ?? undefined);
      setVacancies((prev) => prev.map((v) => ({ ...v, seen: true })));
      setUnseenCount(0);
    } finally {
      setMarkingRead(false);
    }
  };

  const handleSwipeRight = async (vacancyId: number) => {
    const profileId = effectiveProfileId || profiles.find(p => p.isActive)?.id;
    if (profileId) {
      await queueVacancyForApply(vacancyId, profileId);
    } else {
      await saveVacancy(vacancyId);
    }
  };

  const handleSwipeLeft = async (vacancyId: number) => {
    await dismissVacancy(vacancyId);
  };

  const handleFiltersChange = (filters: FilterState) => {
    setFilterPlatforms(filters.platforms);
    try { localStorage.setItem("jf-filter-platforms", JSON.stringify(filters.platforms)); } catch {}
    setFilterProfileIds(filters.profileIds);
    setFilterStatus(filters.status);
    setMinScore(filters.minScore);
    setSortBy(filters.sortBy);
    setFilterLevel(filters.level);
    setFilterIndustry(filters.industry);
    setFilterStack(filters.stack);
  };

  const canQueue = !!(effectiveProfileId || profiles.length > 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          {total > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {total} {total === 1 ? "vacancy" : "vacancies"} found
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Mark all as read */}
          {unseenCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkAllRead}
              disabled={markingRead}
            >
              <Eye className={`h-4 w-4 ${markingRead ? "animate-pulse" : ""}`} />
              <span className="hidden sm:inline">{t("mark_all_read")}</span>
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-xs font-bold px-1.5">
                {unseenCount}
              </span>
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleScrape}
            disabled={scraping || (!effectiveProfileId && profiles.length === 0)}
          >
            <RefreshCw className={`h-4 w-4 ${scraping ? "animate-spin" : ""}`} />
            {scraping ? t("scraping") : t("scrape_now")}
          </Button>
        </div>
      </div>

      {/* Scrape panel */}
      <ScrapePanel
        scrapeStatus={scrapeStatus}
        scrapeProgress={scrapeProgress}
        scrapePhase={scrapePhase}
        scrapeSummary={scrapeSummary}
        rateLimitRetry={rateLimitRetry}
        scoring={scoring}
        onScore={handleScore}
        scoreDisabled={scoring || (!effectiveProfileId && profiles.length === 0)}
      />

      {/* Pill Filters */}
      <VacancyFilters
        platforms={platforms}
        profiles={profiles}
        total={total}
        initialFilters={{ platforms: filterPlatforms, minScore }}
        onChange={handleFiltersChange}
      />

      {/* Vacancy list: desktop = flat cards with infinite scroll, mobile = swipe */}
      {isMobile ? (
        <VacancySwipe
          vacancies={vacancies}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={loadMoreVacancies}
          onSwipeRight={handleSwipeRight}
          onSwipeLeft={handleSwipeLeft}
          onPullToRefresh={loadVacancies}
        />
      ) : (
        <VacancyList
          vacancies={vacancies}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          queuingId={queuingId}
          canQueue={canQueue}
          selectedProfileId={effectiveProfileId}
          onLoadMore={loadMoreVacancies}
          onQuickQueue={handleQuickQueue}
          onDataChanged={loadVacancies}
        />
      )}
    </div>
  );
}
