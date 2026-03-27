"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { SortBy, SearchProfile } from "./types";

export interface FilterState {
  platforms: string[];
  profileIds: number[];
  status: string;
  minScore: number;
  sortBy: SortBy;
  level: string;
  industry: string;
  stack: string;
}

interface VacancyFiltersProps {
  platforms: string[];
  profiles: SearchProfile[];
  total: number;
  initialFilters?: Partial<FilterState>;
  onChange: (filters: FilterState) => void;
}

export function VacancyFilters({ platforms, profiles, total, initialFilters, onChange }: VacancyFiltersProps) {
  const t = useTranslations("vacancies");

  const [filters, setFilters] = useState<FilterState>({
    platforms: initialFilters?.platforms ?? [],
    profileIds: initialFilters?.profileIds ?? [],
    status: initialFilters?.status ?? "all",
    minScore: initialFilters?.minScore ?? 50,
    sortBy: initialFilters?.sortBy ?? "score",
    level: initialFilters?.level ?? "all",
    industry: initialFilters?.industry ?? "all",
    stack: initialFilters?.stack ?? "all",
  });

  const update = (partial: Partial<FilterState>) => {
    const next = { ...filters, ...partial };
    setFilters(next);
    onChange(next);
  };

  const togglePlatform = (p: string) => {
    const current = filters.platforms;
    const next = current.includes(p)
      ? current.filter((x) => x !== p)
      : [...current, p];
    update({ platforms: next });
  };

  const toggleProfile = (id: number) => {
    const current = filters.profileIds;
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    update({ profileIds: next });
  };

  return (
    <div className="space-y-3">
      {/* Search Profiles Pills */}
      {profiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">
            {t("all_profiles")}:
          </span>
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => toggleProfile(p.id)}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filters.profileIds.includes(p.id)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Platform Pills */}
      {platforms.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">
            {t("all_platforms")}:
          </span>
          {platforms.map((p) => (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filters.platforms.includes(p)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Min Score Slider + Sort + Count */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">{t("min_score")}:</label>
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={filters.minScore}
            onChange={(e) => update({ minScore: Number(e.target.value) })}
            className="w-24 accent-primary"
          />
          <span className="text-xs font-semibold text-foreground w-8">{filters.minScore}%</span>
        </div>

        <select
          value={filters.sortBy}
          onChange={(e) => update({ sortBy: e.target.value as SortBy })}
          className="rounded-full border border-input bg-muted px-3 py-1 text-xs text-foreground focus:border-ring focus:outline-none"
        >
          <option value="score">{t("sort_score")}</option>
          <option value="date">{t("sort_date")}</option>
          <option value="salary">{t("sort_salary")}</option>
        </select>

        <span className="text-xs text-muted-foreground ml-auto">
          {total} {t("title").toLowerCase()}
        </span>
      </div>
    </div>
  );
}
