"use client";

import { Loader2, Search, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CompanyData } from "./vacancy-types";

interface CompanyResearchSectionProps {
  company: string;
  companyData: CompanyData | null;
  isResearching: boolean;
  onResearch: () => void;
  tResearch: (key: string) => string;
}

export function CompanyResearchSection({
  company,
  companyData,
  isResearching,
  onResearch,
  tResearch,
}: CompanyResearchSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          {tResearch("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {companyData ? (
          <div className="space-y-3 text-sm">
            <p className="text-foreground/80">{companyData.description}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">{tResearch("industry")}</span>
                <p className="text-foreground/80">{companyData.industry}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{tResearch("size")}</span>
                <p className="text-foreground/80">{companyData.size}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{tResearch("founded")}</span>
                <p className="text-foreground/80">{companyData.founded}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{tResearch("headquarters")}</span>
                <p className="text-foreground/80">{companyData.headquarters}</p>
              </div>
            </div>
            {companyData.glassdoorRating && (
              <div className="text-xs">
                <span className="text-muted-foreground">{tResearch("rating")}: </span>
                <span className="text-foreground/80">{companyData.glassdoorRating}</span>
              </div>
            )}
            {companyData.techStack && companyData.techStack.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">{tResearch("tech_stack")}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {companyData.techStack.map((tech, i) => (
                    <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {companyData.workCulture && (
              <div className="text-xs">
                <span className="text-muted-foreground">{tResearch("work_culture")}</span>
                <p className="text-foreground/80 mt-0.5">{companyData.workCulture}</p>
              </div>
            )}
            {companyData.keyFacts.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">{tResearch("key_facts")}</span>
                <ul className="mt-1 space-y-1">
                  {companyData.keyFacts.map((fact, i) => (
                    <li key={i} className="text-xs text-foreground/70">
                      &bull; {fact}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2"
              onClick={onResearch}
              disabled={isResearching}
            >
              {isResearching ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Search className="h-3 w-3" />
              )}
              {tResearch("refresh")}
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={onResearch}
            disabled={isResearching}
          >
            {isResearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tResearch("researching")}
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                {tResearch("research_button")}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
