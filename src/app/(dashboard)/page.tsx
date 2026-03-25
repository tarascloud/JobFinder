"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Briefcase,
  Send,
  CalendarCheck,
  HelpCircle,
  Clock,
  Trophy,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getVacancyStats } from "@/actions/vacancies";
import { getApplicationStats, getApplications } from "@/actions/applications";
import { getQaStats } from "@/actions/qa";
import { getSearchProfiles } from "@/actions/search-profiles";

interface VacancyStatsData {
  totalScored: number;
  totalApplied: number;
  queued: number;
  approved: number;
  applied: number;
  withdrawn: number;
  rejected: number;
  interview: number;
  offer: number;
}

interface AppStatsData {
  total: number;
  queued: number;
  approved: number;
  applied: number;
  withdrawn: number;
  rejected: number;
  interview: number;
  offer: number;
}

interface QaStatsData {
  total: number;
  pending: number;
  answered: number;
}

interface RecentApp {
  id: number;
  status: string;
  createdAt: Date | string;
  vacancy: {
    id: number;
    title: string;
    company: string;
    platform: string;
    url: string;
  };
}

interface SearchProfile {
  id: number;
  name: string;
  jobTitles: string[];
  isActive: boolean;
}

const statusBadgeVariant: Record<string, "green" | "yellow" | "red" | "blue" | "purple" | "default"> = {
  queued: "yellow",
  approved: "blue",
  applied: "green",
  withdrawn: "default",
  rejected: "red",
  interview: "purple",
  offer: "green",
};

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tSearches = useTranslations("searches");
  const tApps = useTranslations("applications");

  const [vacancyStats, setVacancyStats] = useState<VacancyStatsData | null>(null);
  const [appStats, setAppStats] = useState<AppStatsData | null>(null);
  const [qaStats, setQaStats] = useState<QaStatsData | null>(null);
  const [recentApps, setRecentApps] = useState<RecentApp[]>([]);
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [vs, as2, qa, apps, sp] = await Promise.all([
          getVacancyStats(),
          getApplicationStats(),
          getQaStats(),
          getApplications({ limit: 5 }),
          getSearchProfiles(),
        ]);

        if (!("error" in vs)) setVacancyStats(vs as VacancyStatsData);
        if (!("error" in as2)) setAppStats(as2 as AppStatsData);
        if (!("error" in qa)) setQaStats(qa as QaStatsData);
        if ("applications" in apps) {
          setRecentApps(apps.applications as unknown as RecentApp[]);
        }
        if (Array.isArray(sp)) setProfiles(sp as SearchProfile[]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const stats = [
    {
      label: t("total_vacancies"),
      value: vacancyStats?.totalScored ?? 0,
      icon: Briefcase,
      detail: vacancyStats ? `${t("queued")}: ${vacancyStats.queued}` : "",
    },
    {
      label: t("applied"),
      value: appStats?.applied ?? 0,
      icon: Send,
      detail: appStats ? `${t("queued")}: ${appStats.queued}` : "",
    },
    {
      label: t("interviews"),
      value: appStats?.interview ?? 0,
      icon: CalendarCheck,
      detail: appStats?.offer ? `${t("offers")}: ${appStats.offer}` : "",
    },
    {
      label: t("qa_pending"),
      value: qaStats?.pending ?? 0,
      icon: HelpCircle,
      detail: qaStats ? `${qaStats.answered} answered` : "",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, detail }) => (
          <Card key={label} className="metric-card">
            <CardContent className="p-6">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-1 text-3xl font-bold">{value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Mini Funnel */}
      {!loading && appStats && (appStats.applied > 0 || appStats.queued > 0) && (
        <Link href="/analytics" className="block">
          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {t("title")} Funnel
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-1">
                {[
                  { label: t("queued"), value: appStats.queued, color: "bg-yellow-500" },
                  { label: "Approved", value: appStats.approved, color: "bg-blue-500" },
                  { label: t("applied"), value: appStats.applied, color: "bg-cyan-500" },
                  { label: t("interviews"), value: appStats.interview, color: "bg-purple-500" },
                  { label: t("offers"), value: appStats.offer, color: "bg-green-500" },
                ].map((step, i) => {
                  const total = appStats.queued + appStats.approved + appStats.applied + appStats.interview + appStats.offer;
                  const pct = total > 0 ? Math.max((step.value / total) * 100, step.value > 0 ? 4 : 0) : 0;
                  return (
                    <div key={i} className="flex-1 min-w-0">
                      <div
                        className={`${step.color} rounded-sm h-6 transition-all`}
                        style={{ width: `${Math.max(pct, 2)}%`, minWidth: step.value > 0 ? "8px" : "2px" }}
                      />
                      <div className="mt-1 text-center">
                        <p className="text-xs font-medium text-foreground">{step.value}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{step.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Applications */}
        <Card>
          <CardHeader>
            <CardTitle>{t("recent_activity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-3 w-2/5" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : recentApps.length === 0 ? (
              <div className="flex flex-col items-center py-8">
                <Clock className="h-8 w-8 text-muted-foreground/60 mb-2" />
                <p className="text-sm text-muted-foreground">{t("no_activity")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentApps.map((app) => (
                  <a
                    key={app.id}
                    href={app.vacancy.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start justify-between gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {app.vacancy.title} at {app.vacancy.company}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {app.vacancy.platform} &middot;{" "}
                        {new Date(app.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <Badge variant={statusBadgeVariant[app.status] ?? "default"}>
                      {app.status}
                    </Badge>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Searches */}
        <Card>
          <CardHeader>
            <CardTitle>{tSearches("title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <Skeleton className="h-4 w-2/3 mb-1" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                ))}
              </div>
            ) : profiles.length === 0 ? (
              <div className="flex flex-col items-center py-8">
                <Trophy className="h-8 w-8 text-muted-foreground/60 mb-2" />
                <p className="text-sm text-muted-foreground">{tSearches("no_searches")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {profile.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {profile.jobTitles.slice(0, 3).join(", ")}
                        {profile.jobTitles.length > 3 ? ` +${profile.jobTitles.length - 3}` : ""}
                      </p>
                    </div>
                    <Badge variant={profile.isActive ? "green" : "default"}>
                      {profile.isActive ? tSearches("active") : tSearches("inactive")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
