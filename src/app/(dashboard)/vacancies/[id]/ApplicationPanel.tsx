"use client";

import Link from "next/link";
import { Loader2, Send, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusColors, scoreColor, type VacancyDetail } from "./vacancy-types";

interface ApplicationPanelProps {
  vacancy: VacancyDetail;
  isQueuing: boolean;
  onQueue: () => void;
  tApp: (key: string) => string;
  tq: (key: string) => string;
  t: (key: string) => string;
}

export function ApplicationPanel({
  vacancy,
  isQueuing,
  onQueue,
  tApp,
  tq,
  t,
}: ApplicationPanelProps) {
  const bestScore = vacancy.scores[0];

  return (
    <>
      {/* Match Score */}
      {bestScore && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("score")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-3">
              <span className={`text-4xl font-bold ${scoreColor(bestScore.matchScore)}`}>
                {bestScore.matchScore}%
              </span>
            </div>
            <div className="space-y-2 text-sm">
              {bestScore.salaryFit !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("salary")} fit</span>
                  <Badge color={bestScore.salaryFit ? "green" : "red"}>
                    {bestScore.salaryFit ? "Yes" : "No"}
                  </Badge>
                </div>
              )}
              {bestScore.remoteFit !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remote fit</span>
                  <Badge color={bestScore.remoteFit ? "green" : "red"}>
                    {bestScore.remoteFit ? "Yes" : "No"}
                  </Badge>
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-2">
                {bestScore.searchProfile.name}
              </div>
            </div>
            {bestScore.notes && (
              <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-3">
                {bestScore.notes}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Application Status / Queue Button */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{tApp("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {vacancy.application ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge color={statusColors[vacancy.application.status] || "yellow"}>
                  {tApp(`status_${vacancy.application.status}`)}
                </Badge>
              </div>
              {vacancy.application.appliedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Applied</span>
                  <span className="text-sm text-foreground/80">
                    {new Date(vacancy.application.appliedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <Button
              className="w-full"
              onClick={onQueue}
              disabled={isQueuing}
            >
              {isQueuing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {tq("queue_for_apply")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Interview Prep Button */}
      {vacancy.application && vacancy.application.status === "interview" && (
        <Card>
          <CardContent className="p-4">
            <Link href={`/applications/${vacancy.application.id}/prep`}>
              <Button variant="default" className="w-full">
                <BookOpen className="h-4 w-4" />
                {tApp("prepare")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </>
  );
}
