"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  getApplicationFunnel,
  getWeeklyApplicationStats,
  getPlatformStats,
  getTopCompanies,
  getScoreDistribution,
  getApplyTimeAnalysis,
  getPlatformResponseRates,
  getBestTimeToApply,
  getCompanyResponseRates,
  getCoverLetterVariantStats,
} from "@/actions/analytics";

interface FunnelData {
  queued: number;
  approved: number;
  applied: number;
  response: number;
  interview: number;
  offer: number;
  rejected: number;
}

interface WeeklyData {
  week: string;
  applied: number;
  responses: number;
  interviews: number;
}

interface PlatformData {
  platform: string;
  vacancies: number;
  applied: number;
  responses: number;
  responseRate: number;
}

interface CompanyData {
  company: string;
  vacancies: number;
  applied: number;
  avgScore: number;
}

interface ScoreData {
  range: string;
  count: number;
}

interface TimeData {
  hour: number;
  applications: number;
  responses: number;
}

interface PlatformResponseData {
  platform: string;
  applied: number;
  responses: number;
  responseRate: number;
}

interface BestTimeData {
  hour: number;
  applied: number;
  responses: number;
  responseRate: number;
}

interface CompanyResponseData {
  company: string;
  applied: number;
  responses: number;
  responseRate: number;
}

interface VariantData {
  variant: string;
  sent: number;
  responses: number;
  responseRate: number;
}

const CHART_COLORS = {
  blue: "var(--chart-1)",
  green: "var(--chart-2)",
  yellow: "var(--chart-3)",
  purple: "var(--chart-4)",
  red: "var(--chart-5)",
  cyan: "var(--chart-6)",
  orange: "var(--chart-7)",
};

const FUNNEL_COLORS = [
  CHART_COLORS.yellow,
  CHART_COLORS.blue,
  CHART_COLORS.cyan,
  CHART_COLORS.green,
  CHART_COLORS.purple,
  CHART_COLORS.orange,
];

const SCORE_COLORS = [
  CHART_COLORS.red,
  CHART_COLORS.orange,
  CHART_COLORS.yellow,
  CHART_COLORS.blue,
  CHART_COLORS.green,
];

const VARIANT_COLORS: Record<string, string> = {
  formal: CHART_COLORS.blue,
  casual: CHART_COLORS.green,
  technical: CHART_COLORS.purple,
};

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--popover-foreground)",
};

const GRID_STROKE = "var(--border)";
const AXIS_STROKE = "var(--muted-foreground)";

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-[250px] w-full" />
    </div>
  );
}

export default function AnalyticsPage() {
  const t = useTranslations("analytics");

  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [weekly, setWeekly] = useState<WeeklyData[]>([]);
  const [platforms, setPlatforms] = useState<PlatformData[]>([]);
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [scores, setScores] = useState<ScoreData[]>([]);
  const [timeData, setTimeData] = useState<TimeData[]>([]);
  const [platformResponse, setPlatformResponse] = useState<PlatformResponseData[]>([]);
  const [bestTime, setBestTime] = useState<BestTimeData[]>([]);
  const [companyResponse, setCompanyResponse] = useState<CompanyResponseData[]>([]);
  const [variantStats, setVariantStats] = useState<VariantData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [f, w, p, c, s, td, pr, bt, cr, vs] = await Promise.all([
          getApplicationFunnel(),
          getWeeklyApplicationStats(),
          getPlatformStats(),
          getTopCompanies(),
          getScoreDistribution(),
          getApplyTimeAnalysis(),
          getPlatformResponseRates(),
          getBestTimeToApply(),
          getCompanyResponseRates(),
          getCoverLetterVariantStats(),
        ]);

        if (f && !("error" in f)) setFunnel(f);
        if (Array.isArray(w)) setWeekly(w);
        if (Array.isArray(p)) setPlatforms(p);
        if (Array.isArray(c)) setCompanies(c);
        if (Array.isArray(s)) setScores(s);
        if (Array.isArray(td)) setTimeData(td);
        if (Array.isArray(pr)) setPlatformResponse(pr);
        if (Array.isArray(bt)) setBestTime(bt);
        if (Array.isArray(cr)) setCompanyResponse(cr);
        if (Array.isArray(vs)) setVariantStats(vs);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const hasData =
    funnel &&
    (funnel.queued > 0 ||
      funnel.approved > 0 ||
      funnel.applied > 0 ||
      funnel.interview > 0 ||
      funnel.offer > 0);

  if (!loading && !hasData) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground">{t("no_data")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const funnelChartData = funnel
    ? [
        { name: t("stage_queued"), value: funnel.queued },
        { name: t("stage_approved"), value: funnel.approved },
        { name: t("stage_applied"), value: funnel.applied },
        { name: t("stage_response"), value: funnel.response },
        { name: t("stage_interview"), value: funnel.interview },
        { name: t("stage_offer"), value: funnel.offer },
      ]
    : [];

  // Filter time data to only hours with activity
  const activeHours = timeData.filter((d) => d.applications > 0);
  const showTimeChart = activeHours.length > 0;

  // Filter best time data to hours with activity
  const activeBestTimeHours = bestTime.filter((d) => d.applied > 0);
  const showBestTimeChart = activeBestTimeHours.length > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      {/* Row 1: Funnel + Weekly Trends */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Funnel Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("funnel")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={funnelChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis type="number" stroke={AXIS_STROKE} fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke={AXIS_STROKE}
                    fontSize={12}
                    width={80}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {funnelChartData.map((_, idx) => (
                      <Cell key={idx} fill={FUNNEL_COLORS[idx % FUNNEL_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Weekly Trends */}
        <Card>
          <CardHeader>
            <CardTitle>{t("weekly_trends")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={weekly} margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis
                    dataKey="week"
                    stroke={AXIS_STROKE}
                    fontSize={11}
                    tickFormatter={(v: string) => v.replace(/^\d{4}-/, "")}
                  />
                  <YAxis stroke={AXIS_STROKE} fontSize={12} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line
                    type="monotone"
                    dataKey="applied"
                    stroke={CHART_COLORS.blue}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name={t("applied")}
                  />
                  <Line
                    type="monotone"
                    dataKey="responses"
                    stroke={CHART_COLORS.green}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name={t("responses")}
                  />
                  <Line
                    type="monotone"
                    dataKey="interviews"
                    stroke={CHART_COLORS.purple}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name={t("interviews")}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Platform Comparison + Score Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Platform Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>{t("platform_comparison")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : platforms.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t("no_data")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={platforms} margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis dataKey="platform" stroke={AXIS_STROKE} fontSize={12} />
                  <YAxis stroke={AXIS_STROKE} fontSize={12} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => {
                      if (name === "responseRate") return [`${value}%`, t("response_rate")];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="vacancies" fill={CHART_COLORS.blue} name={t("vacancies")} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="applied" fill={CHART_COLORS.green} name={t("applied")} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="responseRate" fill={CHART_COLORS.purple} name="responseRate" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>{t("score_distribution")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={scores} margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis dataKey="range" stroke={AXIS_STROKE} fontSize={12} />
                  <YAxis stroke={AXIS_STROKE} fontSize={12} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {scores.map((_, idx) => (
                      <Cell key={idx} fill={SCORE_COLORS[idx % SCORE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Top Companies + Best Apply Time */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Companies */}
        <Card>
          <CardHeader>
            <CardTitle>{t("top_companies")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : companies.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t("no_data")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 font-medium">{t("company")}</th>
                      <th className="text-right py-2 font-medium">{t("vacancies")}</th>
                      <th className="text-right py-2 font-medium">{t("applied")}</th>
                      <th className="text-right py-2 font-medium">{t("avg_score")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c) => (
                      <tr key={c.company} className="border-b border-border/50">
                        <td className="py-2 text-foreground truncate max-w-[200px]">
                          {c.company}
                        </td>
                        <td className="py-2 text-right text-foreground/80">{c.vacancies}</td>
                        <td className="py-2 text-right text-foreground/80">{c.applied}</td>
                        <td className="py-2 text-right">
                          <span
                            className={
                              c.avgScore >= 70
                                ? "text-status-success"
                                : c.avgScore >= 40
                                  ? "text-status-warning"
                                  : "text-muted-foreground"
                            }
                          >
                            {c.avgScore}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Best Apply Time */}
        <Card>
          <CardHeader>
            <CardTitle>{t("best_time")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : !showTimeChart ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t("no_data")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={timeData} margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis
                    dataKey="hour"
                    stroke={AXIS_STROKE}
                    fontSize={11}
                    tickFormatter={(h: number) => `${String(h).padStart(2, "0")}:00`}
                  />
                  <YAxis stroke={AXIS_STROKE} fontSize={12} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(h) => `${String(h).padStart(2, "0")}:00`}
                  />
                  <Bar
                    dataKey="applications"
                    fill={CHART_COLORS.blue}
                    name={t("applications")}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="responses"
                    fill={CHART_COLORS.green}
                    name={t("responses")}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Best Platforms (Response Rate) + Best Time to Apply (Response Rate) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Best Platforms by Response Rate */}
        <Card>
          <CardHeader>
            <CardTitle>{t("best_platforms")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : platformResponse.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t("no_data")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={platformResponse} margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis dataKey="platform" stroke={AXIS_STROKE} fontSize={12} />
                  <YAxis stroke={AXIS_STROKE} fontSize={12} unit="%" />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => {
                      if (name === "responseRate") return [`${value}%`, t("response_rate")];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="responseRate" fill={CHART_COLORS.green} name="responseRate" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="applied" fill={CHART_COLORS.blue} name={t("applied")} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Best Time to Apply (Response Rate by Hour) */}
        <Card>
          <CardHeader>
            <CardTitle>{t("best_time_response_rate")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : !showBestTimeChart ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t("no_data")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={activeBestTimeHours} margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis
                    dataKey="hour"
                    stroke={AXIS_STROKE}
                    fontSize={11}
                    tickFormatter={(h: number) => `${String(h).padStart(2, "0")}:00`}
                  />
                  <YAxis stroke={AXIS_STROKE} fontSize={12} unit="%" />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(h) => `${String(h).padStart(2, "0")}:00`}
                    formatter={(value, name) => {
                      if (name === "responseRate") return [`${value}%`, t("response_rate")];
                      return [value, name];
                    }}
                  />
                  <Bar
                    dataKey="responseRate"
                    fill={CHART_COLORS.cyan}
                    name="responseRate"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 5: Company Response Rate + Cover Letter A/B Testing */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Response Rate by Company */}
        <Card>
          <CardHeader>
            <CardTitle>{t("company_response_rate")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : companyResponse.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t("no_data")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 font-medium">{t("company")}</th>
                      <th className="text-right py-2 font-medium">{t("applied")}</th>
                      <th className="text-right py-2 font-medium">{t("responses")}</th>
                      <th className="text-right py-2 font-medium">{t("response_rate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyResponse.map((c) => (
                      <tr key={c.company} className="border-b border-border/50">
                        <td className="py-2 text-foreground truncate max-w-[200px]">
                          {c.company}
                        </td>
                        <td className="py-2 text-right text-foreground/80">{c.applied}</td>
                        <td className="py-2 text-right text-foreground/80">{c.responses}</td>
                        <td className="py-2 text-right">
                          <span
                            className={
                              c.responseRate >= 50
                                ? "text-status-success"
                                : c.responseRate >= 20
                                  ? "text-status-warning"
                                  : "text-muted-foreground"
                            }
                          >
                            {c.responseRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cover Letter A/B Testing */}
        <Card>
          <CardHeader>
            <CardTitle>{t("cover_letter_ab")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : variantStats.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t("no_variant_data")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={variantStats} margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis dataKey="variant" stroke={AXIS_STROKE} fontSize={12} />
                  <YAxis stroke={AXIS_STROKE} fontSize={12} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => {
                      if (name === "responseRate") return [`${value}%`, t("response_rate")];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="sent" name={t("sent")} radius={[4, 4, 0, 0]}>
                    {variantStats.map((entry) => (
                      <Cell
                        key={entry.variant}
                        fill={VARIANT_COLORS[entry.variant] ?? CHART_COLORS.blue}
                      />
                    ))}
                  </Bar>
                  <Bar dataKey="responseRate" fill={CHART_COLORS.green} name="responseRate" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
