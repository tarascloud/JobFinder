"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Building2,
  Globe,
  Banknote,
  Loader2,
  MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VacancyDetail } from "./types";

interface VacancyHeaderProps {
  vacancy: VacancyDetail;
  tCommon: (key: string) => string;
  t: (key: string) => string;
  tq: (key: string) => string;
  isApplyingManual: boolean;
  onApplyManual: () => void;
}

export function VacancyHeader({ vacancy, tCommon, t, tq, isApplyingManual, onApplyManual }: VacancyHeaderProps) {
  return (
    <>
      <Link href="/vacancies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {tCommon("back")}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{vacancy.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
            {vacancy.company && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {vacancy.company}
              </span>
            )}
            {vacancy.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {vacancy.location}
              </span>
            )}
            {vacancy.remoteType && (
              <span className="inline-flex items-center gap-1">
                <Globe className="h-4 w-4" />
                {vacancy.remoteType}
              </span>
            )}
            {vacancy.salaryText && (
              <span className="inline-flex items-center gap-1 text-foreground/80">
                <Banknote className="h-4 w-4" />
                {vacancy.salaryText}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={vacancy.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80"
          >
            <ExternalLink className="h-4 w-4" />
            {t("open_original")}
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={onApplyManual}
            disabled={isApplyingManual}
          >
            {isApplyingManual ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MousePointerClick className="h-4 w-4" />
            )}
            {tq("apply_manual")}
          </Button>
        </div>
      </div>
    </>
  );
}
