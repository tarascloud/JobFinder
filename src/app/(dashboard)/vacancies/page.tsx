"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ArrowUpDown,
  Filter,
  Briefcase,
  RefreshCw,
  Sparkles,
  ExternalLink,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Loader2,
  CheckSquare,
  Square,
  MinusSquare,
  X,
  Ban,
  Send,
  Tag,
  Check,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getVacancies,
  batchScoreVacancies,
  batchQueueVacancies,
  batchDismissVacancies,
} from "@/actions/vacancies";
import { getScrapeStatus, triggerScrape } from "@/actions/scraper";
import { scoreVacancies } from "@/actions/scoring";
import { getSearchProfiles } from "@/actions/search-profiles";
import { queueVacancyForApply } from "@/actions/apply-queue";

type SortBy = "score" | "date" | "salary";

interface Vacancy {
  id: number;
  platform: string;
  url: string;
  title: string;
  company: string | null;
  location: string | null;
  description: string;
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryMinEur: number | null;
  salaryMaxEur: number | null;
  remoteType: string | null;
  employmentType: string | null;
  postedAt: Date | string | null;
  scrapedAt: Date | string | null;
  matchScore: number | null;
  matchNotes: string | null;
  salaryFit: string | null;
  remoteFit: string | null;
  dismissed: boolean;
  applicationStatus: string | null;
  tagStack: string[];
  tagLevel: string | null;
  tagIndustry: string | null;
  tagTeamSize: string | null;
}

interface ScrapeStatus {
  lastScrapeAt: Date | string | null;
  newLast24h: number;
  total: number;
  byPlatform: Record<string, number>;
  error?: string;
}

interface SearchProfile {
  id: number;
  name: string;
  isActive: boolean;
}

function scoreBadgeVariant(score: number | null): "green" | "yellow" | "red" | "default" {
  if (score === null) return "default";
  if (score > 70) return "green";
  if (score > 40) return "yellow";
  return "red";
}

function platformIcon(platform: string): string {
  const icons: Record<string, string> = {
    linkedin: "LI",
    indeed: "IN",
    glassdoor: "GD",
    weworkremotely: "WR",
    remoteok: "RO",
  };
  return icons[platform.toLowerCase()] ?? platform.slice(0, 2).toUpperCase();
}

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function VacanciesPage() {
  const t = useTranslations("vacancies");
  const tCommon = useTranslations("common");
  const tq = useTranslations("apply_queue");

  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [queuingId, setQueuingId] = useState<number | null>(null);

  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>("score");

  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);

  // Inline expand state
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Tag filters
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterIndustry, setFilterIndustry] = useState("all");
  const [filterStack, setFilterStack] = useState("all");

  // SSE scrape progress
  interface ScrapeProgress {
    platform: string;
    status: "scraping" | "done" | "error";
    count?: number;
  }
  const [scrapeProgress, setScrapeProgress] = useState<ScrapeProgress[]>([]);
  const [scrapePhase, setScrapePhase] = useState<string | null>(null);
  const [scrapeSummary, setScrapeSummary] = useState<{ totalNew: number; totalScraped: number } | null>(null);

  // Rate limit state
  const [rateLimitRetry, setRateLimitRetry] = useState<number | null>(null);

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchScoring, setBatchScoring] = useState(false);
  const [batchQueuing, setBatchQueuing] = useState(false);
  const [batchDismissing, setBatchDismissing] = useState(false);

  const platforms = scrapeStatus?.byPlatform
    ? Object.keys(scrapeStatus.byPlatform)
    : [];

  const statuses = ["all", "queued", "approved", "applied", "withdrawn", "rejected", "interview", "offer"];

  const hasSelection = selectedIds.size > 0;
  const allSelected = vacancies.length > 0 && selectedIds.size === vacancies.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < vacancies.length;

  // Load search profiles on mount
  useEffect(() => {
    async function load() {
      const result = await getSearchProfiles();
      if (Array.isArray(result)) {
        setProfiles(result as SearchProfile[]);
        if (result.length > 0) {
          setSelectedProfileId(result[0].id);
        }
      }
    }
    load();
  }, []);

  // Load vacancies when filters change
  const loadVacancies = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getVacancies({
        platform: filterPlatform === "all" ? undefined : filterPlatform,
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
      // Clear selection on data reload
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [filterPlatform, filterStatus, minScore, selectedProfileId, page, sortBy, filterLevel, filterIndustry, filterStack]);

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

  const handleScrape = async () => {
    if (!selectedProfileId) return;
    setScraping(true);
    setScrapeProgress([]);
    setScrapePhase(null);
    setScrapeSummary(null);
    setRateLimitRetry(null);

    try {
      const response = await fetch("/api/scrape-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchProfileId: selectedProfileId }),
      });

      if (response.status === 429) {
        const data = await response.json();
        const retryAfter = data.retryAfter ?? 60;
        setRateLimitRetry(retryAfter);
        return;
      }

      if (!response.ok || !response.body) {
        // Fallback to non-streaming
        await triggerScrape(selectedProfileId);
        await loadVacancies();
        await loadScrapeStatus();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "platform_start") {
              setScrapeProgress((prev) => [
                ...prev,
                { platform: event.platform, status: "scraping" },
              ]);
              setScrapePhase("scraping");
            } else if (event.type === "platform_done") {
              setScrapeProgress((prev) =>
                prev.map((p) =>
                  p.platform === event.platform
                    ? { ...p, status: "done", count: event.count }
                    : p
                )
              );
            } else if (event.type === "saving") {
              setScrapePhase("saving");
            } else if (event.type === "done") {
              setScrapeSummary({
                totalNew: event.totalNew,
                totalScraped: event.totalScraped,
              });
              setScrapePhase("done");
            } else if (event.type === "error") {
              setScrapePhase("error");
            }
          } catch {
            // skip malformed events
          }
        }
      }

      await loadVacancies();
      await loadScrapeStatus();
    } finally {
      setScraping(false);
      // Auto-hide progress after 4 seconds
      setTimeout(() => {
        setScrapeProgress([]);
        setScrapePhase(null);
        setScrapeSummary(null);
      }, 4000);
    }
  };

  const handleScore = async () => {
    if (!selectedProfileId) return;
    setScoring(true);
    try {
      await scoreVacancies(selectedProfileId);
      await loadVacancies();
    } finally {
      setScoring(false);
    }
  };

  const handleQuickQueue = async (vacancyId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedProfileId) return;
    setQueuingId(vacancyId);
    try {
      await queueVacancyForApply(vacancyId, selectedProfileId);
      await loadVacancies();
    } finally {
      setQueuingId(null);
    }
  };

  // Inline expand toggle
  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Batch selection handlers
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

  // Batch operations
  const handleBatchScore = async () => {
    if (!selectedProfileId || selectedIds.size === 0) return;
    setBatchScoring(true);
    try {
      await batchScoreVacancies(Array.from(selectedIds), selectedProfileId);
      await loadVacancies();
    } finally {
      setBatchScoring(false);
    }
  };

  const handleBatchQueue = async () => {
    if (!selectedProfileId || selectedIds.size === 0) return;
    setBatchQueuing(true);
    try {
      await batchQueueVacancies(Array.from(selectedIds), selectedProfileId);
      await loadVacancies();
    } finally {
      setBatchQueuing(false);
    }
  };

  const handleBatchDismiss = async () => {
    if (selectedIds.size === 0) return;
    setBatchDismissing(true);
    try {
      await batchDismissVacancies(Array.from(selectedIds));
      await loadVacancies();
    } finally {
      setBatchDismissing(false);
    }
  };

  const batchBusy = batchScoring || batchQueuing || batchDismissing;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <select
            value={selectedProfileId ?? ""}
            onChange={(e) => {
              setSelectedProfileId(e.target.value ? Number(e.target.value) : null);
              setPage(1);
            }}
            className="rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
          >
            <option value="">{t("select_profile")}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleScrape}
            disabled={scraping || !selectedProfileId}
          >
            <RefreshCw className={`h-4 w-4 ${scraping ? "animate-spin" : ""}`} />
            {scraping ? t("scraping") : t("scrape_now")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleScore}
            disabled={scoring || !selectedProfileId}
          >
            <Sparkles className={`h-4 w-4 ${scoring ? "animate-pulse" : ""}`} />
            {scoring ? t("scoring") : t("score_all")}
          </Button>
        </div>
      </div>

      {/* Rate Limit Warning */}
      {rateLimitRetry !== null && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
          {t("rate_limited", { minutes: Math.ceil(rateLimitRetry / 60) })}
        </div>
      )}

      {/* Scrape Status Bar */}
      {scrapeStatus && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{t("last_scrape")}:</span>
            <span className="text-foreground">
              {scrapeStatus.lastScrapeAt
                ? new Date(scrapeStatus.lastScrapeAt).toLocaleString()
                : "---"}
            </span>
          </div>
          <div className="text-muted-foreground">
            {t("total_count")}: <span className="text-foreground">{scrapeStatus.total}</span>
          </div>
          <div className="text-muted-foreground">
            {t("new_24h")}: <span className="text-primary">{scrapeStatus.newLast24h}</span>
          </div>
          {Object.entries(scrapeStatus.byPlatform).map(([platform, count]) => (
            <Badge key={platform} variant="secondary">
              {platform}: {count}
            </Badge>
          ))}
        </div>
      )}

      {/* Scrape Progress Overlay */}
      {scrapeProgress.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Loader2 className={`h-4 w-4 ${scrapePhase !== "done" && scrapePhase !== "error" ? "animate-spin" : ""}`} />
            {scrapePhase === "saving"
              ? t("scrape_saving")
              : scrapePhase === "done"
              ? t("scrape_complete")
              : scrapePhase === "error"
              ? t("scrape_error")
              : t("scraping")}
          </div>
          <div className="flex flex-wrap gap-2">
            {scrapeProgress.map((p) => (
              <span
                key={p.platform}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  p.status === "done"
                    ? "bg-green-500/10 text-green-400"
                    : p.status === "scraping"
                    ? "bg-yellow-500/10 text-yellow-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                {p.status === "done" ? (
                  <Check className="h-3 w-3" />
                ) : p.status === "scraping" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : null}
                {p.platform}
                {p.status === "done" && p.count !== undefined && ` ${p.count}`}
              </span>
            ))}
          </div>
          {scrapeSummary && (
            <p className="text-xs text-muted-foreground">
              {t("scrape_summary", {
                total: scrapeSummary.totalScraped,
                new: scrapeSummary.totalNew,
              })}
            </p>
          )}
        </div>
      )}

      {/* Tag Filters */}
      {vacancies.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <select
            value={filterLevel}
            onChange={(e) => { setFilterLevel(e.target.value); setPage(1); }}
            className="rounded-lg border border-input bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-ring focus:outline-none"
          >
            <option value="all">{t("all_levels")}</option>
            {["junior", "mid", "senior", "staff", "lead", "director", "vp", "cto"].map((l) => (
              <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
            ))}
          </select>
          <select
            value={filterIndustry}
            onChange={(e) => { setFilterIndustry(e.target.value); setPage(1); }}
            className="rounded-lg border border-input bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-ring focus:outline-none"
          >
            <option value="all">{t("all_industries")}</option>
            {[
              "fintech", "healthtech", "ecommerce", "saas", "gaming", "edtech",
              "adtech", "proptech", "legaltech", "logistics", "travel", "media",
              "telecom", "automotive", "aerospace", "agritech", "cleantech",
              "hrtech", "devtools", "cybersecurity", "ai", "crypto", "foodtech",
              "social", "govtech", "consulting", "other",
            ].map((i) => (
              <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
            ))}
          </select>
          {(() => {
            // Collect unique stack tags from current vacancies for quick filter
            const stackTags = Array.from(
              new Set(vacancies.flatMap((v) => v.tagStack ?? []))
            ).sort();
            if (stackTags.length === 0) return null;
            return (
              <select
                value={filterStack}
                onChange={(e) => { setFilterStack(e.target.value); setPage(1); }}
                className="rounded-lg border border-input bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-ring focus:outline-none"
              >
                <option value="all">{t("all_stack")}</option>
                {stackTags.slice(0, 40).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            );
          })()}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={filterPlatform}
            onChange={(e) => { setFilterPlatform(e.target.value); setPage(1); }}
            className="rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
          >
            <option value="all">{t("all_platforms")}</option>
            {platforms.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? t("all_statuses") : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">{t("min_score")}:</label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minScore}
            onChange={(e) => { setMinScore(Number(e.target.value)); setPage(1); }}
            className="w-24 accent-primary"
          />
          <span className="text-sm text-foreground/80 w-8">{minScore}</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
          >
            <option value="score">{t("sort_score")}</option>
            <option value="date">{t("sort_date")}</option>
            <option value="salary">{t("sort_salary")}</option>
          </select>
        </div>
        <span className="text-sm text-muted-foreground">{total} {tCommon("filter")}</span>
      </div>

      {/* Loading Skeletons */}
      {loading ? (
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
      ) : !selectedProfileId ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-muted-foreground text-lg">{t("no_profile")}</p>
          </CardContent>
        </Card>
      ) : vacancies.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-muted-foreground text-lg">{t("no_vacancies")}</p>
            <p className="text-muted-foreground text-sm mt-1">{tCommon("filter")}</p>
          </CardContent>
        </Card>
      ) : (
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
                <div className="col-span-1">{t("platform")}</div>
                <div className="col-span-2">{t("salary")}</div>
                <div className="col-span-2">{t("location")}</div>
                <div className="col-span-1 text-center">{t("score")}</div>
                <div className="col-span-1 text-center">{t("posted")}</div>
                <div className="col-span-1 text-center">{t("status")}</div>
              </div>
            </div>

            {vacancies.map((v) => {
              const isExpanded = expandedId === v.id;
              const isSelected = selectedIds.has(v.id);

              return (
                <div key={v.id}>
                  <div className="grid grid-cols-[auto_1fr] gap-2 items-start">
                    {/* Checkbox */}
                    <button
                      onClick={(e) => toggleSelect(v.id, e)}
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
                          onClick={() => toggleExpand(v.id)}
                          className="md:grid md:grid-cols-12 md:gap-4 md:items-center space-y-2 md:space-y-0"
                        >
                          {/* Title + Company */}
                          <div className="col-span-4 flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-foreground/80">
                              {platformIcon(v.platform)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate flex items-center gap-1.5">
                                {v.title}
                                <ChevronDown
                                  className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-200 ${
                                    isExpanded ? "rotate-180" : ""
                                  }`}
                                />
                              </p>
                              <p className="text-sm text-muted-foreground truncate">{v.company}</p>
                            </div>
                          </div>

                          {/* Platform */}
                          <div className="col-span-1">
                            <span className="text-xs text-muted-foreground">{v.platform}</span>
                          </div>

                          {/* Salary */}
                          <div className="col-span-2">
                            <span className="text-sm text-foreground/80">
                              {v.salaryText
                                ? v.salaryText
                                : v.salaryMin || v.salaryMax
                                ? `${v.salaryMin?.toLocaleString() ?? "?"}-${v.salaryMax?.toLocaleString() ?? "?"} ${v.salaryCurrency ?? ""}`
                                : "---"}
                            </span>
                            {(v.salaryMinEur || v.salaryMaxEur) && v.salaryCurrency !== "EUR" && (
                              <span className="block text-xs text-muted-foreground">
                                {t("salary_eur")}: {v.salaryMinEur && v.salaryMaxEur && v.salaryMinEur !== v.salaryMaxEur
                                  ? `${v.salaryMinEur.toLocaleString()}-${v.salaryMaxEur.toLocaleString()}`
                                  : `~${(v.salaryMaxEur ?? v.salaryMinEur)?.toLocaleString()}`} EUR
                              </span>
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
                          <div className="col-span-1 text-center">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(v.postedAt)}
                            </span>
                          </div>

                          {/* Application Status + Quick Queue */}
                          <div className="col-span-1 text-center">
                            {v.dismissed ? (
                              <Badge variant="default">{t("dismissed")}</Badge>
                            ) : v.applicationStatus ? (
                              <Badge
                                variant={
                                  v.applicationStatus === "applied" || v.applicationStatus === "offer"
                                    ? "green"
                                    : v.applicationStatus === "rejected" || v.applicationStatus === "withdrawn"
                                    ? "red"
                                    : v.applicationStatus === "interview"
                                    ? "purple"
                                    : "yellow"
                                }
                              >
                                {v.applicationStatus}
                              </Badge>
                            ) : (v.matchScore ?? 0) > 70 ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickQueue(v.id, e);
                                }}
                                disabled={queuingId === v.id}
                                title={tq("queue_for_apply")}
                              >
                                {queuingId === v.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Plus className="h-4 w-4 text-green-400" />
                                )}
                              </Button>
                            ) : null}
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
                              <div
                                className="prose prose-invert prose-sm max-w-none text-foreground/80 max-h-96 overflow-y-auto"
                                dangerouslySetInnerHTML={{ __html: v.description }}
                              />

                              {/* Actions */}
                              <div className="flex items-center gap-3 pt-2 border-t border-border">
                                {!v.applicationStatus && !v.dismissed && (
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuickQueue(v.id, e);
                                    }}
                                    disabled={queuingId === v.id || !selectedProfileId}
                                  >
                                    {queuingId === v.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Send className="h-4 w-4" />
                                    )}
                                    {tq("queue_for_apply")}
                                  </Button>
                                )}
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
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
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
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
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

      {/* Bottom spacer when batch bar is visible to prevent content overlap */}
      {hasSelection && <div className="h-20" />}
    </div>
  );
}
