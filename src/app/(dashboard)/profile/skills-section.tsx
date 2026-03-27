"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import AiFeedbackButtons from "@/components/shared/ai-feedback-buttons";

interface SkillsSectionProps {
  skills: string[];
  setSkills: (skills: string[]) => void;
  hasDiffSuggestion?: boolean;
  isAccepted?: boolean;
  onAcceptChange?: () => void;
}

export default function SkillsSection({
  skills,
  setSkills,
  hasDiffSuggestion,
  isAccepted,
  onAcceptChange,
}: SkillsSectionProps) {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const [newSkill, setNewSkill] = useState("");

  function addSkill() {
    const trimmed = newSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkill("");
    }
  }

  function removeSkill(skill: string) {
    setSkills(skills.filter((s) => s !== skill));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>
            {t("skills")}
            {hasDiffSuggestion && !isAccepted && onAcceptChange && (
              <button
                onClick={onAcceptChange}
                className="ml-2 inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
                title={t("accept_change")}
              >
                <Sparkles className="h-3 w-3" />
                {t("new_suggestion")}
              </button>
            )}
          </CardTitle>
          {isAccepted && (
            <AiFeedbackButtons field="profile.skills" content={skills.join(", ")} context="resume_analysis" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-sm text-primary/80"
            >
              {skill}
              <button
                onClick={() => removeSkill(skill)}
                className="ml-0.5 text-primary hover:text-primary/80 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSkill()}
            placeholder={t("skills") + "..."}
            className="max-w-64"
          />
          <Button variant="outline" size="md" onClick={addSkill}>
            <Plus className="h-4 w-4 mr-1" /> {tCommon("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
