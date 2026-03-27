"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getVacancies } from "@/actions/vacancies";
import { getScrapeStatus } from "@/actions/scraper";
import { scoreVacancies } from "@/actions/scoring";
import { getSearchProfiles } from "@/actions/search-profiles";
import { queueVacancyForApply } from "@/actions/apply-queue";
import type { Vacancy, ScrapeStatus, SearchProfile, SortBy } from "./types";
import { VacancyFilters, type FilterState } from "./vacancy-filters";
import { VacancyList } from "./vacancy-list";
import { ScrapePanel, useScrapeState } from "./scrape-panel";

export default function VacanciesPage() {
  const t = useTranslations("vacancies");

  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [queuingId, setQueuingId] = useState<number | null>(null);

  const [filterPlatforms, setFilterPlatforms] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("jf-filter-platforms");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });
  const [filterStatus, setFilterStatus] = useState("all");
  const [minScore, setMinScore] = useState(0);
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

  // Load vacancies when filters change
  const loadVacancies = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getVacancies({
        platforms: filterPlatforms.length > 0 ? filterPlatforms : undefined,
        minScore: minScore > 0 ? minScore : undefined,
        status: filterStatus === "all" ? undefined : filterStatus,
        searchProfileId: selectedProfileId ?? undefined,
        tagLevel: filterLevel === "all" ? undefined : filterLevel,
        tagIndustry: filterIndustry === "all" ? undefined : filterIndustry,
        tagStack: filterStack === "all" ? undefined : filterStack,
        page,
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
      setTotalPages(result.totalPages);
    } finally {
      setLoading(false);
    }
  }, [filterPlatforms, filterStatus, minScore, selectedProfileId, page, sortBy, filterLevel, filterIndustry, filterStack]);

  useEffect(() => {
    loadVacancies();
  }, [loadVacancies]);

  // Load scrape status
  const loadScrapeStatus = useCallback(async () => {
    const result = await getScrapeStatus(selectedProfileId ?? undefined);
    if (!("error" in result)) {
      setScrapeStatus(result);
    }
  }, [selectedProfileId]);

  useEffect(() => {
    loadScrapeStatus();
  }, [loadScrapeStatus]);

  // Scrape state (managed by useScrapeState hook)
  const onScrapeComplete = useCallback(async () => {
    await loadVacancies();
    await loadScrapeStatus();
  }, [loadVacancies, loadScrapeStatus]);

  const {
    scraping,
    scrapeProgress,
    scrapePhase,
    scrapeSummary,
    rateLimitRetry,
    handleScrape,
  } = useScrapeState(profiles, selectedProfileId, onScrapeComplete, filterPlatforms);

  const handleScore = async () => {
    const profileId = selectedProfileId || profiles.find(p => p.isActive)?.id;
    if (!profileId) return;
    setScoring(true);
    try {
      await scoreVacancies(profileId);
      await loadVacancies();
    } finally {
      setScoring(false);
    }
  };

  const handleQuickQueue = async (vacancyId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const profileId = selectedProfileId || profiles.find(p => p.isActive)?.id;
    if (!profileId) return;
    setQueuingId(vacancyId);
    try {
      await queueVacancyForApply(vacancyId, profileId);
      await loadVacancies();
    } finally {
      setQueuingId(null);
    }
  };

  const handleFiltersChange = (filters: FilterState) => {
    setFilterPlatforms(filters.platforms);
    try { localStorage.setItem("jf-filter-platforms", JSON.stringify(filters.platforms)); } catch {}
    setFilterStatus(filters.status);
    setMinScore(filters.minScore);
    setSortBy(filters.sortBy);
    setFilterLevel(filters.level);
    setFilterIndustry(filters.industry);
    setFilterStack(filters.stack);
    setPage(1);
  };

  const canQueue = !!(selectedProfileId || profiles.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <select
            value={selectedProfileId ?? "all"}
            onChange={(e) => {
              setSelectedProfileId(e.target.value === "all" ? null : Number(e.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
          >
            <option value="all">{t("all_profiles")}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleScrape}
            disabled={scraping || (!selectedProfileId && profiles.length === 0)}
          >
            <RefreshCw className={`h-4 w-4 ${scraping ? "animate-spin" : ""}`} />
            {scraping ? t("scraping") : t("scrape_now")}
          </Button>
        </div>
      </div>

      {/* Scrape status, progress, rate limit */}
      <ScrapePanel
        scrapeStatus={scrapeStatus}
        scrapeProgress={scrapeProgress}
        scrapePhase={scrapePhase}
        scrapeSummary={scrapeSummary}
        rateLimitRetry={rateLimitRetry}
        scoring={scoring}
        onScore={handleScore}
        scoreDisabled={scoring || (!selectedProfileId && profiles.length === 0)}
      />

      {/* Filters */}
      <VacancyFilters
        platforms={platforms}
        vacancies={vacancies}
        total={total}
        initialFilters={{ platforms: filterPlatforms }}
        onChange={handleFiltersChange}
      />

      {/* Vacancy list with batch actions and pagination */}
      <VacancyList
        vacancies={vacancies}
        loading={loading}
        page={page}
        totalPages={totalPages}
        queuingId={queuingId}
        canQueue={canQueue}
        selectedProfileId={selectedProfileId}
        onPageChange={setPage}
        onQuickQueue={handleQuickQueue}
        onDataChanged={loadVacancies}
      />
    </div>
  );
}
