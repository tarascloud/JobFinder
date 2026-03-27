"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Filter, ArrowUpDown, Tag, Check, ChevronDown } from "lucide-react";
import type { SortBy, Vacancy } from "./types";

export interface FilterState {
  platforms: string[];
  status: string;
  minScore: number;
  sortBy: SortBy;
  level: string;
  industry: string;
  stack: string;
}

interface VacancyFiltersProps {
  platforms: string[];
  vacancies: Vacancy[];
  total: number;
  initialFilters?: Partial<FilterState>;
  onChange: (filters: FilterState) => void;
}

const STATUSES = ["all", "queued", "approved", "applied", "withdrawn", "rejected", "interview", "offer"];

const LEVELS = ["junior", "mid", "senior", "staff", "lead", "director", "vp", "cto"];

const INDUSTRIES = [
  "fintech", "healthtech", "ecommerce", "saas", "gaming", "edtech",
  "adtech", "proptech", "legaltech", "logistics", "travel", "media",
  "telecom", "automotive", "aerospace", "agritech", "cleantech",
  "hrtech", "devtools", "cybersecurity", "ai", "crypto", "foodtech",
  "social", "govtech", "consulting", "other",
];

function PlatformMultiSelect({
  platforms,
  selected,
  onChange,
  allLabel,
}: {
  platforms: string[];
  selected: string[];
  onChange: (platforms: string[]) => void;
  allLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const allSelected = selected.length === 0 || selected.length === platforms.length;

  const toggle = (p: string) => {
    if (selected.includes(p)) {
      const next = selected.filter((s) => s !== p);
      onChange(next.length === 0 ? [] : next);
    } else {
      const next = [...selected, p];
      onChange(next.length === platforms.length ? [] : next);
    }
  };

  const toggleAll = () => onChange([]);

  const label = allSelected
    ? allLabel
    : selected.length === 1
      ? selected[0]
      : `${selected.length} platforms`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none min-w-[140px]"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-56 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
          <button
            type="button"
            onClick={toggleAll}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <div className={`flex h-4 w-4 items-center justify-center rounded border ${allSelected ? "border-primary bg-primary" : "border-input"}`}>
              {allSelected && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
            {allLabel}
          </button>
          {platforms.map((p) => {
            const checked = allSelected || selected.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => toggle(p)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <div className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? "border-primary bg-primary" : "border-input"}`}>
                  {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                {p}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function VacancyFilters({ platforms, vacancies, total, initialFilters, onChange }: VacancyFiltersProps) {
  const t = useTranslations("vacancies");
  const tCommon = useTranslations("common");

  const [filters, setFilters] = useState<FilterState>({
    platforms: initialFilters?.platforms ?? [],
    status: initialFilters?.status ?? "all",
    minScore: initialFilters?.minScore ?? 0,
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

  const stackTags = Array.from(
    new Set(vacancies.flatMap((v) => v.tagStack ?? []))
  ).sort();

  return (
    <>
      {/* Tag Filters */}
      {vacancies.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <select
            value={filters.level}
            onChange={(e) => update({ level: e.target.value })}
            className="rounded-lg border border-input bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-ring focus:outline-none"
          >
            <option value="all">{t("all_levels")}</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
            ))}
          </select>
          <select
            value={filters.industry}
            onChange={(e) => update({ industry: e.target.value })}
            className="rounded-lg border border-input bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-ring focus:outline-none"
          >
            <option value="all">{t("all_industries")}</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
            ))}
          </select>
          {stackTags.length > 0 && (
            <select
              value={filters.stack}
              onChange={(e) => update({ stack: e.target.value })}
              className="rounded-lg border border-input bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-ring focus:outline-none"
            >
              <option value="all">{t("all_stack")}</option>
              {stackTags.slice(0, 40).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Main Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <PlatformMultiSelect
            platforms={platforms}
            selected={filters.platforms}
            onChange={(platforms) => update({ platforms })}
            allLabel={t("all_platforms")}
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => update({ status: e.target.value })}
          className="rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
        >
          {STATUSES.map((s) => (
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
            value={filters.minScore}
            onChange={(e) => update({ minScore: Number(e.target.value) })}
            className="w-24 accent-primary"
          />
          <span className="text-sm text-foreground/80 w-8">{filters.minScore}</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <select
            value={filters.sortBy}
            onChange={(e) => update({ sortBy: e.target.value as SortBy })}
            className="rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
          >
            <option value="score">{t("sort_score")}</option>
            <option value="date">{t("sort_date")}</option>
            <option value="salary">{t("sort_salary")}</option>
          </select>
        </div>
        <span className="text-sm text-muted-foreground">{total} {tCommon("filter")}</span>
      </div>
    </>
  );
}
