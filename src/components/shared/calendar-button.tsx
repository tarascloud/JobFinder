"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Calendar, Download, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateCalendarLink } from "@/actions/calendar";

export function CalendarButton({ applicationId }: { applicationId: number }) {
  const t = useTranslations("calendar");
  const [loading, setLoading] = useState(false);
  const [calendarData, setCalendarData] = useState<{
    googleCalendarUrl: string;
    icsContent: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await generateCalendarLink(applicationId);
    if ("error" in result) {
      setError(result.error);
    } else {
      setCalendarData(result);
      // Immediately open Google Calendar
      window.open(result.googleCalendarUrl, "_blank");
    }
    setLoading(false);
  }

  function downloadICS() {
    if (!calendarData) return;
    const blob = new Blob([calendarData.icsContent], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `interview-${applicationId}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <span className="text-xs text-red-400">{error}</span>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      {!calendarData ? (
        <Button
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={loading}
          className="gap-1"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Calendar className="h-3 w-3" />
          )}
          {t("add_to_calendar")}
        </Button>
      ) : (
        <>
          <a
            href={calendarData.googleCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
          >
            <ExternalLink className="h-3 w-3" />
            {t("google_calendar")}
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadICS}
            className="gap-1 h-auto py-1 px-2 text-xs"
          >
            <Download className="h-3 w-3" />
            {t("download_ics")}
          </Button>
        </>
      )}
    </div>
  );
}
