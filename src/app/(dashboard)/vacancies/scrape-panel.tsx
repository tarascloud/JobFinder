"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Clock, Loader2, Check, Sparkles, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ScrapeStatus, ScrapeProgress, SearchProfile } from "./types";

interface ScrapePanelProps {
  scrapeStatus: ScrapeStatus | null;
  profiles: SearchProfile[];
  selectedProfileId: number | null;
  onScrapeComplete: () => void;
}

export function useScrapeState(
  profiles: SearchProfile[],
  selectedProfileId: number | null,
  onComplete: () => void,
  filterPlatforms?: string[],
) {
  const [scraping, setScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState<ScrapeProgress[]>([]);
  const [scrapePhase, setScrapePhase] = useState<string | null>(null);
  const [scrapeSummary, setScrapeSummary] = useState<{ totalNew: number; totalScraped: number } | null>(null);
  const [rateLimitRetry, setRateLimitRetry] = useState<number | null>(null);

  const handleScrape = useCallback(async () => {
    const profileId = selectedProfileId || profiles.find(p => p.isActive)?.id;
    if (!profileId) return;
    setScraping(true);
    setScrapeProgress([]);
    setScrapePhase(null);
    setScrapeSummary(null);
    setRateLimitRetry(null);

    try {
      const response = await fetch("/api/scrape-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchProfileId: profileId,
          ...(filterPlatforms && filterPlatforms.length > 0 && { platforms: filterPlatforms }),
        }),
      });

      if (response.status === 429) {
        const data = await response.json();
        const retryAfter = data.retryAfter ?? 60;
        setRateLimitRetry(retryAfter);
        return;
      }

      if (!response.ok || !response.body) {
        if (selectedProfileId) {
          const { triggerScrape } = await import("@/actions/scraper");
          await triggerScrape(selectedProfileId);
        }
        onComplete();
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

      onComplete();
    } finally {
      setScraping(false);
      setTimeout(() => {
        setScrapeProgress([]);
        setScrapePhase(null);
        setScrapeSummary(null);
      }, 4000);
    }
  }, [selectedProfileId, profiles, onComplete, filterPlatforms]);

  return {
    scraping,
    scrapeProgress,
    scrapePhase,
    scrapeSummary,
    rateLimitRetry,
    handleScrape,
  };
}

export function ScrapePanel({
  scrapeStatus,
  scrapeProgress,
  scrapePhase,
  scrapeSummary,
  rateLimitRetry,
  scoring,
  onScore,
  scoreDisabled,
}: {
  scrapeStatus: ScrapeStatus | null;
  scrapeProgress: ScrapeProgress[];
  scrapePhase: string | null;
  scrapeSummary: { totalNew: number; totalScraped: number } | null;
  rateLimitRetry: number | null;
  scoring: boolean;
  onScore: () => void;
  scoreDisabled: boolean;
}) {
  const t = useTranslations("vacancies");

  return (
    <>
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

      {/* Hint + Score All Button */}
      {scrapeStatus && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" />
            <span>{t("score_hint")}</span>
          </div>
          <Button
            size="lg"
            onClick={onScore}
            disabled={scoreDisabled}
            className="font-semibold"
          >
            <Sparkles className={`h-5 w-5 ${scoring ? "animate-pulse" : ""}`} />
            {scoring ? t("scoring") : t("score_all")}
          </Button>
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
    </>
  );
}
