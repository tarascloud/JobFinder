"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X, Pencil, Trash2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AiFeedbackButtons from "@/components/shared/ai-feedback-buttons";
import type { AnalyzedSearchProfile, AnalyzedProfile } from "./types";

interface ReviewSearchesTabProps {
  searchProfiles: AnalyzedSearchProfile[];
  setSearchProfiles: React.Dispatch<React.SetStateAction<AnalyzedSearchProfile[]>>;
  aiOriginalSearches: AnalyzedSearchProfile[] | null;
  profile: AnalyzedProfile;
}

export function ReviewSearchesTab({
  searchProfiles,
  setSearchProfiles,
  aiOriginalSearches,
  profile,
}: ReviewSearchesTabProps) {
  const tSearches = useTranslations("searches");

  const [editingSearch, setEditingSearch] = useState<number | null>(null);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newGeo, setNewGeo] = useState("");

  function updateSearchProfile(index: number, updates: Partial<AnalyzedSearchProfile>) {
    setSearchProfiles((prev) => prev.map((sp, i) => (i === index ? { ...sp, ...updates } : sp)));
  }

  function removeSearchProfile(index: number) {
    setSearchProfiles((prev) => prev.filter((_, i) => i !== index));
  }

  function addSearchProfile() {
    setSearchProfiles((prev) => [
      ...prev,
      {
        name: `Search ${prev.length + 1}`,
        jobTitles: profile.headline ? [profile.headline] : [],
        minSalary: profile.salaryMin,
        currency: profile.salaryCurrency,
        geographies: [],
        remoteOnly: true,
        employmentTypes: ["full-time"],
      },
    ]);
    setEditingSearch(searchProfiles.length);
  }

  return (
    <div className="space-y-4">
      {searchProfiles.map((sp, idx) => (
        <Card key={idx}>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                {editingSearch === idx ? (
                  <Input value={sp.name} onChange={(e) => updateSearchProfile(idx, { name: e.target.value })} className="max-w-64" />
                ) : (
                  <h3 className="font-medium">{sp.name}</h3>
                )}
                {aiOriginalSearches && aiOriginalSearches[idx] && (
                  <AiFeedbackButtons field={`search.${idx}`} content={`${sp.name}: ${sp.jobTitles.join(", ")}`} context="onboarding" />
                )}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditingSearch(editingSearch === idx ? null : idx)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {searchProfiles.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeSearchProfile(idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                )}
              </div>
            </div>

            {editingSearch === idx ? (
              <div className="space-y-4">
                {/* Job titles */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">{tSearches("job_titles")}</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {sp.jobTitles.map((title) => (
                      <span key={title} className="inline-flex items-center gap-1 rounded-full bg-green-900/40 border border-green-700/40 px-3 py-1 text-sm text-green-300">
                        {title}
                        <button onClick={() => updateSearchProfile(idx, { jobTitles: sp.jobTitles.filter((t) => t !== title) })} className="ml-0.5 text-green-400 hover:text-primary/80 cursor-pointer">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newJobTitle}
                      onChange={(e) => setNewJobTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newJobTitle.trim()) {
                          updateSearchProfile(idx, { jobTitles: [...sp.jobTitles, newJobTitle.trim()] });
                          setNewJobTitle("");
                        }
                      }}
                      placeholder="e.g. Senior Engineer"
                      className="flex-1"
                    />
                    <Button variant="outline" size="md" onClick={() => { if (newJobTitle.trim()) { updateSearchProfile(idx, { jobTitles: [...sp.jobTitles, newJobTitle.trim()] }); setNewJobTitle(""); } }}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Salary + Remote */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1.5">{tSearches("min_salary")}</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={sp.minSalary ?? ""}
                        onChange={(e) => updateSearchProfile(idx, { minSalary: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="80000"
                        className="flex-1"
                      />
                      <select
                        value={sp.currency}
                        onChange={(e) => updateSearchProfile(idx, { currency: e.target.value })}
                        className="rounded-lg border border-input bg-muted px-2 text-sm text-foreground focus:border-ring focus:outline-none"
                      >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                        <option value="UAH">UAH</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1.5">{tSearches("remote_only")}</label>
                    <button
                      onClick={() => updateSearchProfile(idx, { remoteOnly: !sp.remoteOnly })}
                      className={`w-full rounded-lg border px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                        sp.remoteOnly ? "border-primary bg-primary/20 text-primary/80" : "border-input bg-muted text-muted-foreground"
                      }`}
                    >
                      {sp.remoteOnly ? tSearches("remote_only") : "Include on-site/hybrid"}
                    </button>
                  </div>
                </div>

                {/* Geographies */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">{tSearches("geography")}</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {sp.geographies.map((geo) => (
                      <span key={geo} className="inline-flex items-center gap-1 rounded-full bg-indigo-900/40 border border-indigo-700/40 px-3 py-1 text-sm text-indigo-300">
                        {geo}
                        <button onClick={() => updateSearchProfile(idx, { geographies: sp.geographies.filter((g) => g !== geo) })} className="ml-0.5 text-indigo-400 hover:text-primary/80 cursor-pointer">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newGeo}
                      onChange={(e) => setNewGeo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newGeo.trim()) {
                          updateSearchProfile(idx, { geographies: [...sp.geographies, newGeo.trim()] });
                          setNewGeo("");
                        }
                      }}
                      placeholder="e.g. EU, Remote worldwide"
                      className="flex-1"
                    />
                    <Button variant="outline" size="md" onClick={() => { if (newGeo.trim()) { updateSearchProfile(idx, { geographies: [...sp.geographies, newGeo.trim()] }); setNewGeo(""); } }}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Employment types */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">{tSearches("employment_types")}</label>
                  <div className="flex flex-wrap gap-2">
                    {["full-time", "contract", "part-time", "freelance"].map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          const types = sp.employmentTypes.includes(type)
                            ? sp.employmentTypes.filter((t) => t !== type)
                            : [...sp.employmentTypes, type];
                          updateSearchProfile(idx, { employmentTypes: types });
                        }}
                        className={`rounded-full border px-3 py-1 text-sm transition-colors cursor-pointer ${
                          sp.employmentTypes.includes(type)
                            ? "border-primary bg-primary/20 text-primary/80"
                            : "border-input bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {sp.jobTitles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sp.jobTitles.map((jt) => (
                      <Badge key={jt} color="green">{jt}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                  {sp.minSalary && <span>{sp.minSalary.toLocaleString()} {sp.currency}</span>}
                  <span>{sp.remoteOnly ? "Remote" : "Any location"}</span>
                  {sp.geographies.length > 0 && <span>{sp.geographies.join(", ")}</span>}
                  {sp.employmentTypes.length > 0 && <span>{sp.employmentTypes.join(", ")}</span>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={addSearchProfile} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add Search Profile
      </Button>
    </div>
  );
}
